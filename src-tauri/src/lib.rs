mod admin;
mod background;
mod compare;
mod dupes;
mod filter;
mod i18n;
mod junk;
mod listing;
mod mft;
mod recyclebin;
mod report;
mod scan;
mod snapshot;
mod tree;
mod volumes;

use parking_lot::{Mutex, RwLock};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

use scan::Progress;
use tree::{Entry, ExtStat, FileHit, MapNode, NodeInfo, SizeMode, Tree};

#[derive(Default)]
struct AppState {
    tree: RwLock<Option<Tree>>,
    job: Mutex<Option<Arc<Progress>>>,
    /// Applied to each new scan, and to the current one when it changes.
    mode: Mutex<SizeMode>,
    /// The last finished scan, kept so the window can ask for it: a small scan
    /// can finish before the window is listening for `scan-done`.
    last_done: Mutex<Option<DoneEvent>>,
    dup_job: Mutex<Option<Arc<dupes::Progress>>>,
    dup_generation: AtomicU64,
    /// Hashes remembered between duplicate searches; loaded from disk on first use.
    hash_cache: Mutex<Option<Arc<dupes::HashCache>>>,
    /// What the last recycle moved to the Recycle Bin, for "Undo".
    last_recycle: Mutex<Option<LastRecycle>>,
    /// Where the scan in view came from: when it was taken, and the snapshot file if one was opened.
    origin: Mutex<Origin>,
    /// An earlier scan being compared with the one in view.
    compare: RwLock<Option<compare::Compare>>,
    /// Bumped on every scan, so events from an older scan can be ignored.
    generation: AtomicU64,
}

#[derive(Default, Clone)]
struct Origin {
    scanned_at: i64,
    from_mft: bool,
    /// Set when the scan in view was opened from a snapshot rather than scanned.
    snapshot: Option<snapshot::Meta>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    generation: u64,
    files: u64,
    dirs: u64,
    bytes: u64,
    allocated: u64,
    errors: u64,
    current: String,
    elapsed_ms: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DoneEvent {
    generation: u64,
    status: &'static str,
    root: Option<Entry>,
    path: String,
    errors: u64,
    /// Folders left out by the user's exclusion list.
    excluded: u64,
    /// Read from the drive's file table (as administrator) rather than folder by folder.
    from_mft: bool,
    elapsed_ms: u64,
}

struct LastRecycle {
    paths: Vec<PathBuf>,
    /// Seconds since the Unix epoch, a little before the first item went.
    started: i64,
}

type Res<T> = Result<T, String>;

const NO_SCAN: &str = "Nothing has been scanned yet.";

#[tauri::command]
fn list_volumes() -> Vec<volumes::Volume> {
    volumes::list()
}

/// The folder Disq Studio was started with, such as from Explorer's
/// "Analyze with Disq Studio", if it's a folder that exists.
#[tauri::command]
fn startup_path() -> Option<String> {
    let args: Vec<String> = std::env::args_os().map(|a| a.to_string_lossy().into_owned()).collect();
    folder_arg(&args, None)
}

/// The folder in a command line (`args[0]` is the program), if it names one
/// that exists. Relative paths are taken from `cwd` when given.
fn folder_arg(args: &[String], cwd: Option<&std::path::Path>) -> Option<String> {
    // Skip `--after <pid>`, added when restarting as administrator.
    let mut rest = args.iter().skip(1);
    let arg = loop {
        let a = rest.next()?;
        if a == admin::WAIT_FLAG {
            rest.next();
        } else {
            break a.trim();
        }
    };
    // "C:" on its own means the current folder on C:, not the drive.
    let arg = if arg.len() == 2 && arg.ends_with(':') { format!("{arg}\\") } else { arg.to_string() };
    let mut path = PathBuf::from(arg);
    if path.is_relative() {
        path = cwd?.join(path);
    }
    path.is_dir().then(|| path.to_string_lossy().into_owned())
}

/// Shows the main window and puts it in front of whatever has focus.
fn bring_to_front(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    let _ = window.unminimize();
    let _ = window.show();
    // Windows only lets a process take the foreground in some cases; briefly
    // going always-on-top gets the window above Explorer even when it doesn't.
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    let _ = window.set_always_on_top(false);
}

/// Lets whichever process ends up drawing the window take the foreground.
/// Called in every launch: one started from Explorer has that right, and
/// passes it on to the instance that's already open.
#[cfg(windows)]
fn allow_foreground_handoff() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{AllowSetForegroundWindow, ASFW_ANY};
    unsafe { AllowSetForegroundWindow(ASFW_ANY) };
}

#[cfg(not(windows))]
fn allow_foreground_handoff() {}

/// Starts scanning `path` in the background. Progress arrives as
/// `scan-progress` events and the result as one `scan-done` event.
#[tauri::command]
fn start_scan(app: AppHandle, state: State<'_, AppState>, path: String, excludes: Vec<String>) -> Res<u64> {
    let excludes = scan::Excludes::new(excludes);
    let root = std::path::absolute(&path).unwrap_or_else(|_| PathBuf::from(&path));
    if !root.is_dir() {
        return Err(format!("{path} is not a folder that can be opened."));
    }
    if let Some(old) = state.job.lock().take() {
        old.cancel.store(true, Relaxed);
    }
    let generation = state.generation.fetch_add(1, Relaxed) + 1;
    let progress = Arc::new(Progress::default());
    *state.job.lock() = Some(progress.clone());

    let done = Arc::new(AtomicBool::new(false));
    let started = Instant::now();

    // Ticker: reports the counters ten times a second until the walk ends.
    {
        let (app, progress, done) = (app.clone(), progress.clone(), done.clone());
        std::thread::spawn(move || {
            while !done.load(Relaxed) {
                let _ = app.emit(
                    "scan-progress",
                    ProgressEvent {
                        generation,
                        files: progress.files.load(Relaxed),
                        dirs: progress.dirs.load(Relaxed),
                        bytes: progress.bytes.load(Relaxed),
                        allocated: progress.allocated.load(Relaxed),
                        errors: progress.errors.load(Relaxed),
                        current: progress.current.lock().clone(),
                        elapsed_ms: started.elapsed().as_millis() as u64,
                    },
                );
                std::thread::sleep(Duration::from_millis(100));
            }
        });
    }

    std::thread::spawn(move || {
        let mode = *app.state::<AppState>().mode.lock();
        let (tree, from_mft) = scan_root(&root, &progress, &excludes, mode);
        let state = app.state::<AppState>();
        let current = state.generation.load(Relaxed) == generation;
        let mut event = DoneEvent {
            generation,
            status: "cancelled",
            root: None,
            path: root.to_string_lossy().into_owned(),
            errors: progress.errors.load(Relaxed),
            excluded: progress.excluded.load(Relaxed),
            from_mft,
            elapsed_ms: 0,
        };
        if let (Some(mut tree), true) = (tree, current) {
            // The size mode may have changed while scanning.
            tree.set_mode(*state.mode.lock());
            event.root = Some(tree.entry(0));
            event.status = "done";
            *state.tree.write() = Some(tree);
            *state.origin.lock() = Origin { scanned_at: now_ms(), from_mft, snapshot: None };
            state.compare.write().take();
        }
        event.elapsed_ms = started.elapsed().as_millis() as u64;
        done.store(true, Relaxed);
        if current {
            state.job.lock().take();
        }
        *state.last_done.lock() = Some(event.clone());
        let _ = app.emit("scan-done", event);
    });

    Ok(generation)
}

/// Reads a whole NTFS drive from its file table when that's possible (a
/// drive root, as administrator), and walks it folder by folder otherwise.
/// Returns the tree (None if cancelled) and whether the file table was used.
fn scan_root(root: &std::path::Path, progress: &Progress, excludes: &scan::Excludes, mode: SizeMode) -> (Option<Tree>, bool) {
    let fs = volumes::file_system_of(root);
    if admin::is_elevated() && mft::drive_letter(root).is_some() && fs.eq_ignore_ascii_case("NTFS") {
        match mft::scan_drive(root, progress, excludes, mode) {
            Ok(tree) => return (tree, true),
            Err(_) => {
                // Start the counters again for the walk.
                for c in [&progress.files, &progress.dirs, &progress.bytes, &progress.allocated, &progress.excluded] {
                    c.store(0, Relaxed);
                }
            }
        }
    }
    let tree = scan::scan(root, progress, excludes).map(|raw| Tree::from_raw(root.to_path_buf(), raw, mode, dedupes_links(root)));
    (tree, false)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RefreshResult {
    root: Entry,
    /// Folders in the whole scan that couldn't be read, after the refresh.
    errors: u64,
}

/// Rescans one folder of the current scan and puts the result in place,
/// instead of rescanning everything.
#[tauri::command]
async fn refresh_folder(state: State<'_, AppState>, id: u32, excludes: Vec<String>) -> Res<RefreshResult> {
    let (path, generation) = {
        let guard = state.tree.read();
        let tree = guard.as_ref().ok_or(NO_SCAN)?;
        let n = tree.get(id).ok_or(GONE)?;
        if !matches!(n.kind, tree::Kind::Dir | tree::Kind::Denied) {
            return Err("Only folders can be refreshed.".into());
        }
        (tree.path(id), state.generation.load(Relaxed))
    };
    if !path.is_dir() {
        return Err(format!("{} is no longer there.", path.display()));
    }
    let excludes = scan::Excludes::new(excludes);
    let progress = Arc::new(Progress::default());
    // A new full scan cancels this one, like any other.
    *state.job.lock() = Some(progress.clone());
    let walk = {
        let (path, progress) = (path.clone(), progress.clone());
        tauri::async_runtime::spawn_blocking(move || scan::scan(&path, &progress, &excludes))
    };
    let raw = walk.await.map_err(|e| e.to_string())?;
    {
        let mut job = state.job.lock();
        if job.as_ref().is_some_and(|j| Arc::ptr_eq(j, &progress)) {
            job.take();
        }
    }
    let raw = raw.ok_or("The refresh was cancelled.")?;

    let mut guard = state.tree.write();
    let tree = guard.as_mut().ok_or(NO_SCAN)?;
    if state.generation.load(Relaxed) != generation || tree.get(id).is_none_or(|n| n.kind == tree::Kind::Deleted) {
        return Err(GONE.into());
    }
    let dedupe = dedupes_links(&tree.root_path);
    tree.replace_children(id, raw, dedupe);
    Ok(RefreshResult { root: tree.entry(0), errors: tree.denied_count() })
}

const GONE: &str = "That item is no longer in the scan.";

/// Whether Disq Studio is running as administrator.
#[tauri::command]
fn is_elevated() -> bool {
    admin::is_elevated()
}

/// Restarts Disq Studio as administrator (Windows asks first), opening
/// `path` there. Returns false if the user said no; otherwise this copy closes.
#[tauri::command]
fn relaunch_as_admin(app: AppHandle, path: Option<String>) -> Res<bool> {
    if !admin::relaunch_elevated(path.as_deref())? {
        return Ok(false);
    }
    app.exit(0);
    Ok(true)
}

/// Whether files sharing an ID on this drive are hard links to one piece of
/// data. FAT and exFAT have no stable file IDs; NTFS and ReFS do.
pub(crate) fn dedupes_links_at(root: &str) -> bool {
    dedupes_links(std::path::Path::new(root))
}

fn dedupes_links(root: &std::path::Path) -> bool {
    let fs = volumes::file_system_of(root);
    fs.eq_ignore_ascii_case("NTFS") || fs.eq_ignore_ascii_case("ReFS") || fs == "unix"
}

/// Switches between logical size and size on disk. Returns the scanned
/// folder in the new mode, or nothing if no scan has finished yet.
#[tauri::command]
async fn set_size_mode(state: State<'_, AppState>, mode: SizeMode) -> Res<Option<Entry>> {
    *state.mode.lock() = mode;
    if let Some(c) = state.compare.write().as_mut() {
        c.old.set_mode(mode);
    }
    let mut guard = state.tree.write();
    Ok(guard.as_mut().map(|tree| {
        tree.set_mode(mode);
        tree.entry(0)
    }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FilterResult {
    /// The scanned folder, with matching sizes while the filter is on.
    root: Entry,
    /// None when no filter is on.
    summary: Option<filter::Summary>,
}

const MAX_FILTER_HITS: usize = 500;

fn filter_result(tree: &Tree) -> FilterResult {
    FilterResult {
        root: tree.entry(0),
        summary: tree.filter.as_ref().map(|f| f.summary(tree, MAX_FILTER_HITS)),
    }
}

/// Filters every view to matching files; an empty query turns the filter off.
#[tauri::command]
async fn set_filter(state: State<'_, AppState>, query: filter::Query) -> Res<FilterResult> {
    let mut guard = state.tree.write();
    let tree = guard.as_mut().ok_or(NO_SCAN)?;
    tree.set_filter(query);
    Ok(filter_result(tree))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MatchSelection {
    ids: Vec<u32>,
    /// What recycling them frees: the data on this drive.
    bytes: u64,
    files: u64,
    /// The largest few, to show in the confirmation.
    paths: Vec<String>,
}

/// Everything the filter matches, as items to recycle in one go.
#[tauri::command]
async fn filter_selection(state: State<'_, AppState>) -> Res<MatchSelection> {
    let guard = state.tree.read();
    let tree = guard.as_ref().ok_or(NO_SCAN)?;
    let ids = tree.select_matches();
    let mut items = targets(tree, &ids);
    let files = ids.iter().map(|&id| tree.get(id).map_or(0, |n| if n.kind == tree::Kind::File { 1 } else { n.files as u64 })).sum();
    let bytes = items.iter().map(|t| t.size).sum();
    items.sort_unstable_by_key(|t| std::cmp::Reverse(t.size));
    let paths = items.iter().take(6).map(|t| t.path.to_string_lossy().into_owned()).collect();
    Ok(MatchSelection { ids, bytes, files, paths })
}

/// The current filter's results, after something changed them (size mode, a delete).
#[tauri::command]
async fn filter_results(state: State<'_, AppState>) -> Res<FilterResult> {
    let guard = state.tree.read();
    Ok(filter_result(guard.as_ref().ok_or(NO_SCAN)?))
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DupProgressEvent {
    generation: u64,
    /// "edges" while comparing the start and end of files, "full" while comparing whole files.
    phase: &'static str,
    done: u64,
    total: u64,
    bytes_done: u64,
    bytes_total: u64,
    elapsed_ms: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DupDoneEvent {
    generation: u64,
    status: &'static str,
    /// The largest groups; capped so the UI stays quick.
    groups: Vec<dupes::DupGroup>,
    total_groups: u64,
    duplicate_files: u64,
    /// Space that removing all but one copy in every group would free.
    wasted: u64,
    candidates: u64,
    skipped: u64,
    /// Files whose hashes were remembered from an earlier search, so weren't read.
    cached: u64,
    elapsed_ms: u64,
}

const MAX_DUP_GROUPS: usize = 2000;

fn hash_cache_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_cache_dir().ok().map(|d| d.join("hashes.bin"))
}

fn hash_cache(app: &AppHandle) -> Arc<dupes::HashCache> {
    let state = app.state::<AppState>();
    let mut slot = state.hash_cache.lock();
    slot.get_or_insert_with(|| {
        Arc::new(hash_cache_file(app).map(|f| dupes::HashCache::load(&f)).unwrap_or_default())
    })
    .clone()
}

/// Looks for identical files under `id`. Progress arrives as
/// `dup-progress` events and the result as one `dup-done` event.
#[tauri::command]
fn find_duplicates(app: AppHandle, state: State<'_, AppState>, id: u32, min_size: u64) -> Res<u64> {
    let candidates = with_tree(&state, id, |t| t.dup_candidates(id, min_size))?;
    if let Some(old) = state.dup_job.lock().take() {
        old.cancel.store(true, Relaxed);
    }
    let generation = state.dup_generation.fetch_add(1, Relaxed) + 1;
    let progress = Arc::new(dupes::Progress::default());
    *state.dup_job.lock() = Some(progress.clone());
    let started = Instant::now();
    let done = Arc::new(AtomicBool::new(false));

    {
        let (app, progress, done) = (app.clone(), progress.clone(), done.clone());
        std::thread::spawn(move || {
            while !done.load(Relaxed) {
                let _ = app.emit(
                    "dup-progress",
                    DupProgressEvent {
                        generation,
                        phase: if progress.phase.load(Relaxed) == 0 { "edges" } else { "full" },
                        done: progress.done.load(Relaxed),
                        total: progress.total.load(Relaxed),
                        bytes_done: progress.bytes_done.load(Relaxed),
                        bytes_total: progress.bytes_total.load(Relaxed),
                        elapsed_ms: started.elapsed().as_millis() as u64,
                    },
                );
                std::thread::sleep(Duration::from_millis(150));
            }
        });
    }

    std::thread::spawn(move || {
        let count = candidates.len() as u64;
        let cache = hash_cache(&app);
        let result = dupes::find(candidates.clone(), &progress, &cache);
        done.store(true, Relaxed);
        if let Some(file) = hash_cache_file(&app) {
            let _ = cache.save(&file, &candidates);
        }
        let mut event = DupDoneEvent {
            generation,
            status: "cancelled",
            groups: Vec::new(),
            total_groups: 0,
            duplicate_files: 0,
            wasted: 0,
            candidates: count,
            skipped: progress.skipped.load(Relaxed),
            cached: progress.cached.load(Relaxed),
            elapsed_ms: started.elapsed().as_millis() as u64,
        };
        if let Some(mut groups) = result {
            event.status = "done";
            event.total_groups = groups.len() as u64;
            event.duplicate_files = groups.iter().map(|g| g.files.len() as u64 - 1).sum();
            event.wasted = groups.iter().map(|g| g.size * (g.files.len() as u64 - 1)).sum();
            groups.truncate(MAX_DUP_GROUPS);
            event.groups = groups;
        }
        let state = app.state::<AppState>();
        if state.dup_generation.load(Relaxed) == generation {
            state.dup_job.lock().take();
        }
        let _ = app.emit("dup-done", event);
    });

    Ok(generation)
}

#[tauri::command]
fn cancel_duplicates(state: State<'_, AppState>) {
    if let Some(job) = state.dup_job.lock().take() {
        job.cancel.store(true, Relaxed);
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkPair {
    /// The copy that stays as it is.
    keep: u32,
    /// The copy that becomes another name for `keep`'s data.
    copy: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LinkReport {
    root: Entry,
    done: Vec<u32>,
    /// Bytes on disk freed.
    freed: u64,
    failed: Vec<RecycleFailure>,
}

/// Replaces duplicate copies with hard links to the copy that stays: every
/// name keeps working, but the data is stored once.
#[tauri::command]
async fn link_duplicates(state: State<'_, AppState>, pairs: Vec<LinkPair>) -> Res<LinkReport> {
    let candidate = |tree: &Tree, id: u32| -> Option<dupes::Candidate> {
        let n = tree.get(id).filter(|n| n.kind == tree::Kind::File)?;
        Some(dupes::Candidate { id, path: tree.path(id), size: n.logical, modified: n.modified })
    };
    let jobs: Vec<(Option<dupes::Candidate>, Option<dupes::Candidate>, u32)> = {
        let guard = state.tree.read();
        let tree = guard.as_ref().ok_or(NO_SCAN)?;
        pairs.iter().map(|p| (candidate(tree, p.keep), candidate(tree, p.copy), p.copy)).collect()
    };
    // The slow part runs without holding the tree.
    let mut done = Vec::new();
    let mut failed = Vec::new();
    for (keep, copy, copy_id) in jobs {
        let (Some(keep), Some(copy)) = (keep, copy) else {
            failed.push(RecycleFailure { id: copy_id, path: String::new(), error: GONE.into() });
            continue;
        };
        match dupes::link_copy(&keep, &copy) {
            Ok(file_id) => done.push((keep.id, copy.id, file_id)),
            Err(error) => failed.push(RecycleFailure { id: copy.id, path: copy.path.to_string_lossy().into_owned(), error }),
        }
    }
    let mut guard = state.tree.write();
    let tree = guard.as_mut().ok_or(NO_SCAN)?;
    let freed = done.iter().map(|&(keep, copy, file_id)| tree.link_copy(keep, copy, file_id)).sum();
    tree.refilter();
    Ok(LinkReport { root: tree.entry(0), done: done.into_iter().map(|(_, c, _)| c).collect(), freed, failed })
}

/// The result of scan `generation`, if it has already finished.
#[tauri::command]
fn scan_result(state: State<'_, AppState>, generation: u64) -> Option<DoneEvent> {
    state.last_done.lock().clone().filter(|d| d.generation == generation)
}

#[tauri::command]
fn cancel_scan(state: State<'_, AppState>) {
    if let Some(job) = state.job.lock().take() {
        job.cancel.store(true, Relaxed);
    }
}

fn with_tree<T>(state: &AppState, id: u32, f: impl FnOnce(&Tree) -> T) -> Res<T> {
    let guard = state.tree.read();
    let tree = guard.as_ref().ok_or(NO_SCAN)?;
    tree.get(id).ok_or(GONE)?;
    Ok(f(tree))
}

/// The id of whatever is at `path` in the current scan, if it's there.
#[tauri::command]
async fn find_path(state: State<'_, AppState>, path: String) -> Res<Option<u32>> {
    let guard = state.tree.read();
    Ok(guard.as_ref().ok_or(NO_SCAN)?.find(std::path::Path::new(&path)))
}

#[tauri::command]
async fn list_children(state: State<'_, AppState>, id: u32) -> Res<Vec<Entry>> {
    with_tree(&state, id, |t| t.list(id))
}

#[tauri::command]
async fn node_info(state: State<'_, AppState>, id: u32) -> Res<NodeInfo> {
    with_tree(&state, id, |t| t.info(id))
}

#[tauri::command]
async fn treemap(state: State<'_, AppState>, id: u32, max_depth: u32, min_size: u64) -> Res<MapNode> {
    with_tree(&state, id, |t| t.map(id, max_depth, min_size.max(1)))
}

#[tauri::command]
async fn extensions(state: State<'_, AppState>, id: u32, limit: usize) -> Res<Vec<ExtStat>> {
    with_tree(&state, id, |t| t.extensions(id, limit))
}

#[tauri::command]
async fn largest_files(state: State<'_, AppState>, id: u32, limit: usize) -> Res<Vec<FileHit>> {
    with_tree(&state, id, |t| t.largest(id, limit))
}

/// An item about to be recycled, with the size Windows weighs against the
/// Recycle Bin's limit: the data actually on this drive.
struct Target {
    id: u32,
    path: PathBuf,
    size: u64,
}

/// Leaves out the root, anything gone, and anything inside another of the
/// items (it goes with that one), so a selection can mix folders and their contents.
fn targets(tree: &Tree, ids: &[u32]) -> Vec<Target> {
    let set: std::collections::HashSet<u32> = ids.iter().copied().collect();
    ids.iter()
        .filter(|&&id| id != 0)
        .filter(|&&id| tree.get(id).is_some_and(|n| !tree.is_within(n.parent, &set)))
        .filter_map(|&id| {
            let n = tree.get(id)?;
            if n.kind == tree::Kind::Deleted {
                return None;
            }
            Some(Target {
                id,
                path: tree.path(id),
                size: n.logical.saturating_sub(tree.online(id)).max(n.allocated),
            })
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Blocked {
    id: u32,
    path: String,
    size: u64,
    reason: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecycleCheck {
    #[serde(flatten)]
    bin: recyclebin::BinInfo,
    selected_bytes: u64,
    /// Older items Windows will permanently drop from the bin to make room.
    overflow_bytes: u64,
    /// Items that can't be recycled and would be deleted permanently.
    blocked: Vec<Blocked>,
    /// Items holding online-only cloud files (OneDrive and similar), and those files' size.
    /// Deleting them skips Windows' Recycle Bin: they go to the cloud service's own.
    online_items: usize,
    online_bytes: u64,
}

/// Says, before anything is deleted, what the Recycle Bin can take.
#[tauri::command]
async fn recycle_check(state: State<'_, AppState>, ids: Vec<u32>) -> Res<RecycleCheck> {
    let guard = state.tree.read();
    let tree = guard.as_ref().ok_or(NO_SCAN)?;
    let bin = recyclebin::info(&tree.root_path);
    let items = targets(tree, &ids);
    let blocked: Vec<Blocked> = items
        .iter()
        .filter_map(|t| {
            bin.blocks(t.size).map(|reason| Blocked {
                id: t.id,
                path: t.path.to_string_lossy().into_owned(),
                size: t.size,
                reason,
            })
        })
        .collect();
    let recyclable: u64 = items.iter().filter(|t| !blocked.iter().any(|b| b.id == t.id)).map(|t| t.size).sum();
    let overflow_bytes = match bin.max_bytes {
        Some(max) if bin.has_bin && !bin.nuke_on_delete => (bin.used_bytes + recyclable).saturating_sub(max),
        _ => 0,
    };
    let online: Vec<u64> = items.iter().map(|t| tree.online(t.id)).filter(|&b| b > 0).collect();
    Ok(RecycleCheck {
        online_items: online.len(),
        online_bytes: online.iter().sum(),
        selected_bytes: items.iter().map(|t| t.size).sum(),
        overflow_bytes,
        blocked,
        bin,
    })
}

/// Known junk anywhere in the scan, by category. Ignores any filter.
#[tauri::command]
async fn find_junk(state: State<'_, AppState>, rules: Vec<String>) -> Res<Vec<junk::JunkCategory>> {
    let guard = state.tree.read();
    let tree = guard.as_ref().ok_or(NO_SCAN)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    Ok(junk::find(tree, now, &rules))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecycleFailure {
    id: u32,
    path: String,
    error: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecycleReport {
    root: Entry,
    done: Vec<u32>,
    /// Bytes (on disk) of the items that were moved.
    freed: u64,
    /// Items Windows refused, usually because a program has them open.
    failed: Vec<RecycleFailure>,
    /// Items left alone because they would have been deleted permanently.
    kept: Vec<RecycleFailure>,
    /// How many items were deleted permanently, with the user's say-so.
    permanent: usize,
}

/// Moves each item to the Recycle Bin on its own, so one locked file
/// doesn't stop the rest. Anything Windows can't recycle (it would destroy
/// it while reporting success) is kept, unless `allow_permanent` is set.
#[tauri::command]
async fn recycle_each(state: State<'_, AppState>, ids: Vec<u32>, allow_permanent: bool) -> Res<RecycleReport> {
    let (items, bin) = {
        let guard = state.tree.read();
        let tree = guard.as_ref().ok_or(NO_SCAN)?;
        (targets(tree, &ids), recyclebin::info(&tree.root_path))
    };
    // The slow part runs without holding the tree.
    let mut done = Vec::new();
    let mut failed = Vec::new();
    let mut kept = Vec::new();
    let mut permanent = 0;
    let started = now_secs() - 2;
    let mut recycled = Vec::new();
    for t in items {
        let path = t.path.to_string_lossy().into_owned();
        let blocked = bin.blocks(t.size);
        if let (Some(reason), false) = (&blocked, allow_permanent) {
            kept.push(RecycleFailure { id: t.id, path, error: reason.clone() });
            continue;
        }
        match trash::delete(&t.path) {
            Ok(()) => {
                done.push(t.id);
                permanent += blocked.is_some() as usize;
                if blocked.is_none() {
                    recycled.push(t.path);
                }
            }
            Err(e) => failed.push(RecycleFailure { id: t.id, path, error: e.to_string() }),
        }
    }
    *state.last_recycle.lock() = (!recycled.is_empty()).then_some(LastRecycle { paths: recycled, started });
    let mut guard = state.tree.write();
    let tree = guard.as_mut().ok_or(NO_SCAN)?;
    // Hard-linked data that keeps another name isn't freed.
    let freed = tree.remove_many(&done);
    tree.refilter();
    Ok(RecycleReport { root: tree.entry(0), done, freed, failed, kept, permanent })
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Automatic snapshots kept per scanned location.
pub(crate) const KEEP_SNAPSHOTS: usize = 8;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedSnapshot {
    path: String,
    bytes: u64,
}

/// Saves the scan in view: to `path`, or into the history (keeping the newest few) when none is given.
#[tauri::command]
async fn save_snapshot(state: State<'_, AppState>, path: Option<String>) -> Res<SavedSnapshot> {
    let origin = state.origin.lock().clone();
    if origin.snapshot.is_some() && path.is_none() {
        return Err("This is an opened snapshot; it's already saved.".into());
    }
    let guard = state.tree.read();
    let tree = guard.as_ref().ok_or(NO_SCAN)?;
    let meta = snapshot::Meta::of(tree, origin.scanned_at, origin.from_mft);
    let auto = path.is_none();
    let file = match path {
        Some(p) => PathBuf::from(p),
        None => background::snapshots_dir().join(snapshot::file_name(&meta.root, meta.scanned_at)),
    };
    let bytes = snapshot::save(tree, &meta, &file).map_err(|e| e.to_string())?;
    if auto {
        snapshot::prune(&background::snapshots_dir(), &meta.root, KEEP_SNAPSHOTS);
    }
    Ok(SavedSnapshot { path: file.to_string_lossy().into_owned(), bytes })
}

/// Snapshots in the history, newest first; only those of `root` when given.
#[tauri::command]
fn list_snapshots(root: Option<String>) -> Vec<snapshot::Saved> {
    snapshot::list(&background::snapshots_dir(), root.as_deref())
}

#[tauri::command]
fn snapshots_folder() -> String {
    background::snapshots_dir().to_string_lossy().into_owned()
}

/// Deletes a snapshot from the history (nothing outside it).
#[tauri::command]
fn delete_snapshot(path: String) -> Res<()> {
    let path = PathBuf::from(path);
    let dir = background::snapshots_dir();
    if path.parent() != Some(dir.as_path()) || path.extension().is_none_or(|x| x != "dss") {
        return Err("Only snapshots in the history can be deleted here.".into());
    }
    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedSnapshot {
    root: Entry,
    meta: snapshot::Meta,
    errors: u64,
}

/// Opens a snapshot in place of the scan in view, to look around in it as it was.
#[tauri::command]
async fn open_snapshot(state: State<'_, AppState>, path: String) -> Res<OpenedSnapshot> {
    let mode = *state.mode.lock();
    let (tree, meta) = tauri::async_runtime::spawn_blocking(move || snapshot::load(std::path::Path::new(&path), mode))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if let Some(job) = state.job.lock().take() {
        job.cancel.store(true, Relaxed);
    }
    state.generation.fetch_add(1, Relaxed);
    let root = tree.entry(0);
    let errors = tree.denied_count();
    *state.tree.write() = Some(tree);
    *state.origin.lock() = Origin { scanned_at: meta.scanned_at, from_mft: meta.from_mft, snapshot: Some(meta.clone()) };
    state.compare.write().take();
    state.last_recycle.lock().take();
    Ok(OpenedSnapshot { root, meta, errors })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompareSummary {
    meta: snapshot::Meta,
    /// The whole scan then and now, in the size mode shown.
    before: u64,
    now: u64,
    files_before: u64,
    files_now: u64,
}

/// Starts comparing the scan in view with the snapshot at `path`.
#[tauri::command]
async fn compare_with(state: State<'_, AppState>, path: String) -> Res<CompareSummary> {
    let mode = *state.mode.lock();
    let (old, meta) = tauri::async_runtime::spawn_blocking(move || snapshot::load(std::path::Path::new(&path), mode))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    let guard = state.tree.read();
    let tree = guard.as_ref().ok_or(NO_SCAN)?;
    let root = tree.root_path.to_string_lossy().into_owned();
    if !snapshot::same_root(&root, &meta.root) {
        return Err(format!("That snapshot is of {}, not {root}.", meta.root));
    }
    let summary = CompareSummary {
        before: old.node_size(0),
        now: tree.node_size(0),
        files_before: old.get(0).map_or(0, |n| n.files as u64),
        files_now: tree.get(0).map_or(0, |n| n.files as u64),
        meta: meta.clone(),
    };
    *state.compare.write() = Some(compare::Compare { old });
    Ok(summary)
}

#[tauri::command]
fn compare_close(state: State<'_, AppState>) {
    state.compare.write().take();
}

/// Folder `id` of the scan in view, compared item by item with the snapshot.
#[tauri::command]
async fn compare_children(state: State<'_, AppState>, id: u32) -> Res<Vec<compare::DiffEntry>> {
    let guard = state.tree.read();
    let tree = guard.as_ref().ok_or(NO_SCAN)?;
    tree.get(id).ok_or(GONE)?;
    let cmp = state.compare.read();
    let c = cmp.as_ref().ok_or("Nothing is being compared.")?;
    Ok(c.children(tree, id))
}

#[tauri::command]
async fn compare_top(state: State<'_, AppState>, limit: usize) -> Res<compare::Top> {
    let guard = state.tree.read();
    let tree = guard.as_ref().ok_or(NO_SCAN)?;
    let cmp = state.compare.read();
    let c = cmp.as_ref().ok_or("Nothing is being compared.")?;
    Ok(c.top(tree, limit))
}

/// Writes a report of folder `id` to `path`; returns how many rows it has.
#[tauri::command]
async fn export_report(state: State<'_, AppState>, id: u32, path: String, options: report::Options) -> Res<usize> {
    let guard = state.tree.read();
    let tree = guard.as_ref().ok_or(NO_SCAN)?;
    tree.get(id).ok_or(GONE)?;
    report::write(tree, id, &options, std::path::Path::new(&path)).map_err(|e| e.to_string())
}

/// The interface's language, for the text Rust writes itself (notifications, the HTML report).
#[tauri::command]
fn set_language(language: String) {
    i18n::set(&language);
}

/// Writes exported settings; only to a `.json` file.
#[tauri::command]
fn write_settings_file(path: String, contents: String) -> Res<()> {
    let path = PathBuf::from(path);
    if path.extension().is_none_or(|x| !x.eq_ignore_ascii_case("json")) {
        return Err("Settings are saved as a .json file.".into());
    }
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

/// Reads settings to import; only from a `.json` file, and not a huge one.
#[tauri::command]
fn read_settings_file(path: String) -> Res<String> {
    let path = PathBuf::from(path);
    if path.extension().is_none_or(|x| !x.eq_ignore_ascii_case("json")) {
        return Err("Pick a .json settings file.".into());
    }
    if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > 1024 * 1024 {
        return Err("That file is too big to be Disq Studio settings.".into());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackgroundState {
    config: background::Config,
    /// The scheduled task exists.
    scheduled: bool,
}

#[tauri::command]
async fn background_state() -> BackgroundState {
    BackgroundState { config: background::load_config(), scheduled: background::is_scheduled() }
}

/// Saves the background-check settings and sets up (or removes) the daily task.
#[tauri::command]
async fn set_background(config: background::Config) -> Res<BackgroundState> {
    background::save_config(&config).map_err(|e| e.to_string())?;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    background::schedule(&config, &exe)?;
    Ok(BackgroundState { scheduled: background::is_scheduled(), config })
}

/// Runs the check now, with its notifications, and says what it found.
#[tauri::command]
async fn check_now() -> Res<Vec<background::Finding>> {
    let config = background::load_config();
    tauri::async_runtime::spawn_blocking(move || {
        let found = background::run_check(&config, true);
        if found.is_empty() {
            background::notify(
                &i18n::tr("Disq Studio checked your drives", &[]),
                &i18n::tr("Nothing to report: every drive has room to spare.", &[]),
            );
        }
        found
    })
    .await
    .map_err(|e| e.to_string())
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Deletes items for good, without the Recycle Bin. Only reached through the
/// "Delete permanently" setting and its own confirmation.
#[tauri::command]
async fn delete_each(state: State<'_, AppState>, ids: Vec<u32>) -> Res<RecycleReport> {
    let items = {
        let guard = state.tree.read();
        targets(guard.as_ref().ok_or(NO_SCAN)?, &ids)
    };
    let mut done = Vec::new();
    let mut failed = Vec::new();
    for t in items {
        let result = if t.path.is_dir() { std::fs::remove_dir_all(&t.path) } else { std::fs::remove_file(&t.path) };
        match result {
            Ok(()) => done.push(t.id),
            Err(e) => failed.push(RecycleFailure { id: t.id, path: t.path.to_string_lossy().into_owned(), error: e.to_string() }),
        }
    }
    let mut guard = state.tree.write();
    let tree = guard.as_mut().ok_or(NO_SCAN)?;
    let freed = tree.remove_many(&done);
    tree.refilter();
    let permanent = done.len();
    Ok(RecycleReport { root: tree.entry(0), done, freed, failed, kept: Vec::new(), permanent })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UndoReport {
    root: Entry,
    restored: usize,
    /// Items that were no longer in the Recycle Bin (emptied, or restored by hand).
    missing: usize,
    errors: u64,
}

/// Puts back what the last recycle moved to the Recycle Bin, then rescans
/// the folders they came from so the map shows them again.
#[tauri::command]
async fn undo_recycle(state: State<'_, AppState>) -> Res<UndoReport> {
    let last = state.last_recycle.lock().take().ok_or("There's nothing to undo.")?;
    let wanted: std::collections::HashSet<PathBuf> = last.paths.iter().cloned().collect();
    let in_bin = trash::os_limited::list().map_err(|e| e.to_string())?;
    // The newest bin entry for each path, in case the same path was recycled before.
    let mut found: std::collections::HashMap<PathBuf, trash::TrashItem> = std::collections::HashMap::new();
    for item in in_bin {
        let path = item.original_path();
        if item.time_deleted >= last.started && wanted.contains(&path) {
            let newer = found.get(&path).is_none_or(|old| old.time_deleted < item.time_deleted);
            if newer {
                found.insert(path, item);
            }
        }
    }
    let restored = found.len();
    let missing = wanted.len() - restored;
    let folders: Vec<PathBuf> = found.keys().filter_map(|p| p.parent().map(PathBuf::from)).collect();
    if restored > 0 {
        trash::os_limited::restore_all(found.into_values()).map_err(|e| e.to_string())?;
    }

    // Rescan each folder they went back into (the outermost ones only).
    let ids: Vec<u32> = {
        let guard = state.tree.read();
        let tree = guard.as_ref().ok_or(NO_SCAN)?;
        let mut ids: Vec<u32> = folders.iter().filter_map(|p| tree.find(p)).collect();
        ids.sort_unstable();
        ids.dedup();
        let set: std::collections::HashSet<u32> = ids.iter().copied().collect();
        ids.into_iter().filter(|&id| tree.get(id).is_some_and(|n| !tree.is_within(n.parent, &set))).collect()
    };
    let mut scans = Vec::new();
    for id in ids {
        let path = state.tree.read().as_ref().map(|t| t.path(id)).ok_or(NO_SCAN)?;
        let raw = tauri::async_runtime::spawn_blocking(move || {
            scan::scan(&path, &Progress::default(), &scan::Excludes::default())
        })
        .await
        .map_err(|e| e.to_string())?;
        if let Some(raw) = raw {
            scans.push((id, raw));
        }
    }
    let mut guard = state.tree.write();
    let tree = guard.as_mut().ok_or(NO_SCAN)?;
    let dedupe = dedupes_links(&tree.root_path);
    for (id, raw) in scans {
        if tree.get(id).is_some_and(|n| n.kind != tree::Kind::Deleted) {
            tree.replace_children(id, raw, dedupe);
        }
    }
    tree.refilter();
    Ok(UndoReport { root: tree.entry(0), restored, missing, errors: tree.denied_count() })
}

#[tauri::command]
fn can_undo_recycle(state: State<'_, AppState>) -> bool {
    state.last_recycle.lock().is_some()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Started by the daily scheduled task: check, notify and leave, with no window.
    if std::env::args().any(|a| a == background::FLAG) {
        background::run_headless();
        return;
    }
    // Restarted as administrator: let the old window close first, or this
    // copy would just hand over to it.
    admin::wait_for_previous(&std::env::args().collect::<Vec<_>>());
    allow_foreground_handoff();
    tauri::Builder::default()
        // First, so a second launch hands over before anything else starts.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            bring_to_front(app);
            if let Some(path) = folder_arg(&args, Some(std::path::Path::new(&cwd))) {
                let _ = app.emit("open-path", path);
            }
        }))
        .setup(|app| {
            admin::accept_handoff_while_elevated();
            // Started on a folder (from Explorer): make sure the window isn't left behind.
            if startup_path().is_some() {
                bring_to_front(app.handle());
            }
            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            list_volumes,
            startup_path,
            start_scan,
            scan_result,
            cancel_scan,
            set_size_mode,
            find_duplicates,
            cancel_duplicates,
            link_duplicates,
            delete_each,
            undo_recycle,
            can_undo_recycle,
            save_snapshot,
            list_snapshots,
            snapshots_folder,
            delete_snapshot,
            open_snapshot,
            compare_with,
            compare_close,
            compare_children,
            compare_top,
            export_report,
            background_state,
            set_background,
            check_now,
            write_settings_file,
            set_language,
            read_settings_file,
            set_filter,
            filter_results,
            filter_selection,
            find_junk,
            recycle_each,
            list_children,
            find_path,
            node_info,
            treemap,
            extensions,
            largest_files,
            recycle_check,
            refresh_folder,
            is_elevated,
            relaunch_as_admin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::folder_arg;

    fn args(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| s.to_string()).collect()
    }

    /// Recycles a file into the real Recycle Bin and finds and restores it the
    /// way `undo_recycle` does. Uses the Recycle Bin of the drive in
    /// `DISK_STUDIO_UNDO_DIR`: `cargo test undo_restores -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn undo_restores_from_the_recycle_bin() {
        let dir = std::path::PathBuf::from(std::env::var("DISK_STUDIO_UNDO_DIR").expect("set DISK_STUDIO_UNDO_DIR"));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join(format!("undo-test-{}.txt", std::process::id()));
        std::fs::write(&file, b"restore me").unwrap();
        let started = super::now_secs() - 2;
        trash::delete(&file).unwrap();
        assert!(!file.exists());
        let item = trash::os_limited::list()
            .unwrap()
            .into_iter()
            .find(|i| i.original_path() == file && i.time_deleted >= started)
            .expect("in the Recycle Bin");
        trash::os_limited::restore_all([item]).unwrap();
        assert_eq!(std::fs::read(&file).unwrap(), b"restore me");
        println!("recycled and restored {}", file.display());
        std::fs::remove_file(&file).unwrap();
        let _ = std::fs::remove_dir(&dir);
    }

    #[test]
    fn folder_from_the_command_line() {
        let dir = std::env::temp_dir();
        let dir_s = dir.to_string_lossy().into_owned();
        assert_eq!(folder_arg(&args(&["app.exe", &dir_s]), None), Some(dir_s.clone()));
        assert_eq!(folder_arg(&args(&["app.exe"]), None), None, "no argument");
        assert_eq!(folder_arg(&args(&["app.exe", "Z:\\no\\such\\folder"]), None), None);
        // A file isn't a folder.
        let file = dir.join("disk-studio-arg-test.txt");
        std::fs::write(&file, b"x").unwrap();
        assert_eq!(folder_arg(&args(&["app.exe", &file.to_string_lossy()]), None), None);
        std::fs::remove_file(file).unwrap();
        // Relative paths need the caller's folder.
        let parent = dir.parent().unwrap();
        let name = dir.file_name().unwrap().to_string_lossy().into_owned();
        assert_eq!(folder_arg(&args(&["app.exe", &name]), None), None);
        assert!(folder_arg(&args(&["app.exe", &name]), Some(parent)).is_some());
    }

    #[cfg(windows)]
    #[test]
    fn bare_drive_letter_means_the_drive() {
        let drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
        assert_eq!(folder_arg(&args(&["app.exe", &drive]), None), Some(format!("{drive}\\")));
    }
}