# Disq Studio — Roadmap

A fast, Graphiq-styled disk space visualizer built with Tauri 2, Rust and React.
`[x]` = done, `[ ]` = to do. Work top to bottom: each milestone builds on the one before it.

---

## v0.1 — Foundation (this build)

### Backend (Rust)
- [x] Parallel folder scanner on a rayon pool (every core busy, deep-tree-safe stacks)
- [x] Symlinks and junctions recorded but never followed (no double counting, no loops)
- [x] Unreadable folders counted and flagged as "denied" instead of failing the scan
- [x] Compact flat tree (one array, children sorted largest first)
- [x] Live progress events (files, folders, bytes, current path) 10× per second
- [x] Cancel a scan; starting a new one cancels the old one
- [x] Drive list with label, file system, type, total and free space
- [x] Queries: children, node info + breadcrumbs, trimmed treemap subtree, file types, largest files
- [x] Move to Recycle Bin, then update sizes up the tree without rescanning

### Frontend (React + Graphiq design system)
- [x] Graphite (dark) / Porcelain (light) themes from the shared Graphiq tokens
- [x] Start screen: drive cards with usage bars, "Choose folder…"
- [x] Scan progress view with live counters and Cancel
- [x] Squarified, nested treemap on canvas (HiDPI), coloured by file type
- [x] Hover highlight + tooltip, click to select, double-click to zoom into a folder
- [x] Breadcrumbs and Back / Up navigation
- [x] Folder list (sorted by size, with share bars) synced with the treemap
- [x] Inspector: details, file-type breakdown, largest files
- [x] Context menu: Open, Show in Explorer, Copy path, Move to Recycle Bin (with confirmation)
- [x] Keyboard: Backspace / Alt+← to go up, Enter to zoom, Delete to recycle, Ctrl+R to rescan
- [x] Browser mock backend (`npm run dev` → localhost:1420) for UI work without Rust
- [x] Unit tests for scanner + tree math, size on disk, hard links and online-only (`cargo test`)
- [x] Benchmark on real folders (`DISK_STUDIO_BENCH=<folder> cargo test --release bench -- --ignored --nocapture`):
      1.38M files / 102k folders in 4.6 s

### Known gaps in v0.1 (all fixed)
- [x] Full scan of `C:\` measured (release build, not elevated):
      1,731,782 files + 211,969 folders in **12.8 s**; tree built in 0.4 s; **272 MB** held (147 bytes per entry),
      **469 MB peak**; 206 folders skipped (admin only); 198 GB on disk found vs 225 GB used on the drive — the
      gap is what a normal user can't read (those folders, page file, file-system metadata).
      Filters 0.1–0.3 s, junk finder 57 ms on the same tree.
- [x] Treemap keyboard navigation: focusable map, arrows move to the nearest neighbouring block, `]` into a
      folder's contents, `[` back out, Home to the largest, Enter zooms in; screen-reader announcement of each selection
- [x] Rescan returns to the folder you were in and re-selects what was selected (found again by path)
- [x] File-type categories in the details panel count every extension (was the top 200 only)
- [x] Fixed along the way: the map's selection outline could vanish after a redraw until the next hover
- [x] Fixed along the way: Vite Fast Refresh served stale modules after edits, because component files also
      exported plain helpers; those helpers now live in `src/lib/` (`filterState.ts`, `recycle.ts`)

---

## v0.2 — Accuracy & speed (done in 0.6.0)
- [x] **Size on disk** vs logical size, switchable in the top bar ("Size" / "On disk"), remembered between runs
  - Folders are read in batches with `GetFileInformationByHandleEx(FileFullDirectoryInfo)`, which returns
    each file's allocation size with no extra call per file (replaces `std::fs::read_dir`)
  - Treemap, list, sorting, file types, largest files and the drive progress bar all follow the mode
  - Inspector shows both sizes and explains big gaps (compression, online-only, cluster waste)
  - Long paths (>260 chars) handled with `\\?\` prefixes
- [x] **Hard links counted once** (NTFS file IDs from `FileIdBothDirectoryInfo`, no extra call per file)
  - The name nearest the top of the scan keeps the size; other names become zero-size "hard link" rows
  - Details panel shows "Hard links: X counted once" per folder, and for a link, where its data is counted
  - Only on NTFS (FAT/exFAT have no stable IDs, ReFS needs 128-bit IDs)
  - Measured: `C:\Windows` has 59,518 hard links (10.2 GB no longer double-counted)
- [x] **Online-only cloud files** (OneDrive placeholders, detected by their recall/offline attributes)
  - Own figure per folder ("Online only"), a tag in the top bar, cloud badges in lists
  - Drawn as hatched "ghost" blocks in the treemap in Size mode; take no space in On disk mode
  - Measured: 430 GB of the user folder is online-only
- [x] ReFS: 128-bit file IDs (`FileIdExtdDirectoryInfo`, falling back to `FileIdBothDirectoryInfo` on FAT and
      network drives), so hard links dedupe on ReFS too
- [x] Recycling the counted name of a hard link promotes another name to carry the size, and reports nothing
      freed while the data still has a name (also when the counted name is inside a recycled folder)
- [x] Browser mock has hard links (details panel shows "Hard links … counted once" and the link target)
- [x] Compressed and sparse files ask the file itself (`GetCompressedFileSizeW`) for their size on disk,
      since directory entries can lag behind
- [x] **NTFS MFT reader** (`mft.rs`): as administrator, a drive root is read from its Master File Table in one
      sequential pass; anything unexpected falls back to the normal walk. Checked against the walk on this PC's
      `C:\` (elevated, release build):

      | | Time | Files | Size | On disk | Online only | Memory held / peak |
      |---|---|---|---|---|---|---|
      | File table | **3.2 s** | 1,917,893 | 707.95 GB | 256.25 GB | 453.99 GB | 233 MB / 528 MB |
      | Walk | 4.5 s (warm) | 1,935,643 | 695.17 GB | 243.52 GB | 453.99 GB | — |

      Same online-only bytes, sizes within 0.01% under `C:\Users`. The file table also counts System Volume
      Information (10.2 GB), NTFS's own files ($MFT 2.2 GB, $LogFile, …) and folders even admins can't list.
      The walk's extra files were `AppData\Roaming\Claude`, which only exists virtually for apps running inside
      Claude's package. Lesson learned: in the file table, attribute 0x40000 means "has extended attributes"
      (signed programs, Store apps), not "recall on open" as in directory listings.
- [x] "Run as administrator": the "N skipped" badge offers a restart as administrator (Windows asks first);
      also in Settings › Administrator. An "Admin" badge shows when elevated, and "File table" after an MFT scan.
      The elevated copy accepts "Analyze with Disq Studio" hand-offs from normal programs.
- [x] Refresh one folder in place (button beside the breadcrumbs, or right-click › Refresh this folder):
      rescans just that folder and splices it into the tree; hard links rejoin their groups, and the name nearest
      the top keeps counting the data, as in a full scan: fewest folders down, then first by path (0.6.2; `refresh_matches_a_full_scan` on this
      PC's `C:\`: refreshing Program Files or Windows changes no top-level folder's size; verified installed: Program Files
      "149 bytes more", Windows unchanged at 27.9 GB)
- [x] Lower memory per node: names in one shared buffer, 32-bit counts, online-only and hard-link bytes in side
      tables. A node is 56 bytes (was ~88 plus a heap allocation per name). Full `C:\` walk: **211 MB held
      (113 bytes per entry, was 272 MB / 147)**, 1.75M files in 9.8 s
- [x] Benchmarks: measured on this PC's real 1.75M–1.92M-file `C:\` rather than a generated 1M-file tree, which
      would grow the drive's MFT by about 1 GB for good (NTFS never shrinks it)
- [x] Files in the file table but not in folder listings, explained (0.6.1; `explain_extra_files` test, run
      elevated): they are in folders only Windows' own system account may open, which even administrators can't
      list (WMI log subfolders, WebThreatDefSvc, CSC, CapabilityAccessManager), so the walk skips them. Prefetch
      matched exactly (247 / 247) on a second run: Windows rewrites it between scans. Files being written
      (DriverData, LogFiles) show their current size in the table, while listings lag behind. The table is the
      more complete of the two; nothing to fix.
- [x] MFT reader builds the tree straight from the table, folder by folder (breadth first, no recursion and no
      intermediate tree; `Tree::start` / `add_children` / `finish`). `C:\` with 1.92M files: **2.2 s, 229 MB held,
      451 MB peak** (was 3.2 s, 233 MB, 528 MB)

## v0.3 — Exploration
- [x] **Search and filter** (filter bar above the map and duplicates, Ctrl+F)
  - Name text or `*`/`?` patterns; matches file names *and* folder names, so `node_modules`
    shows everything inside every node_modules folder
  - File-type chips, minimum size, last-changed age
  - While on, the treemap, folder list, details, file types, largest files and duplicate search
    all count matching files only; a "Matches" tab lists the outermost matches, largest first
  - Measured on 1.38M files: 70–230 ms per filter (`node_modules`: 408,611 files, 9.87 GB in 1,778 folders)
- [x] **Several terms, exclusions and saved searches** (0.7.0)
  - Terms separated by spaces must all match (a name, or a folder above): `node_modules *.js`
  - `a|b` matches either; `-term` leaves out what matches, folders with everything inside: `-*.log`;
    `"quotes"` keep a space inside one term
  - Bookmark button beside the search box: save the current search (text, types, size, age), pick a saved
    one, or forget it. Kept between runs
- [x] **Match on the full path** (0.7.0): a term containing `\` or `/` is matched against the whole path,
  e.g. `AppData\Local\*.log` or `\Projects\`. Path patterns match from any folder down (fixed in 0.7.1;
  checked on C:: 2,643 logs under AppData\Local), or from the drive when they start with `C:\`
- [x] **Recycle all matches** (0.7.0): "Recycle all" on the Matches tab, through the usual Recycle Bin check.
  A folder goes as a whole only when every file in it matches and nothing in it went unread; elsewhere just
  the matching files go, so nothing that doesn't match is ever taken (tested in
  `selecting_every_match_never_takes_what_doesnt_match`)
- [x] **Sunburst view** (0.7.0): toggle beside the folder path. Rings out from the folder in view, one per
  level (6 deep); click to select, double-click a folder to zoom in, click the centre to go up, arrow keys
  move along and between rings
- [x] **Free space block** (0.7.0): scanning a whole drive shows its free space as a dashed block (and ring
  segment) at the top level, unless a filter is on
- [x] **Cushion shading and colour by age** (0.7.0): map options button (sliders icon). Age colours: this
  week, this month, this year, 1–3 years, older; the legend switches to match
- [x] **Zoom animation** (0.7.0): the old view grows into the opened folder, or shrinks back into its block
  when going up. Off when Windows' "Animation effects" is off
- [x] **Multi-select** (0.7.0): Ctrl+click in the list or on the map adds or removes, Shift+click in the
  list selects a range, Ctrl+A selects the whole folder. The details panel adds the selection up (items
  inside another selected folder count once); Delete or "Recycle N items" asks once for all of them
- [x] **List columns** (0.7.0): Name, Size, Share, Files, Modified. Click a heading to sort (again to
  reverse), drag a heading's left edge to resize (double-click resets), right-click to show or hide
  columns. The list panel itself resizes from its right edge. Columns that don't fit make way for the name
  on their own. All remembered
- [x] **Clickable file-type legend** (0.7.0): click a type to show only it, click more to add them; the
  "Other" type (and its chip in the filter bar) now works too
- Measured on C: (1.85M files): filters take 65–140 ms, full-path terms 365 ms
- Checked installed (0.7.2) on this PC: sunburst, free space (218 GB), multi-select (3 items, 64.3 GB),
  `appdata/local/*.log` (2,648 files) with Matches columns lined up under their headings. The zoom animation
  stays off here because Windows' Animation effects are off

## v0.4 — Cleanup tools
- [x] **Duplicate finder** ("Duplicates" tab in the top bar)
  - Same size → BLAKE3 of first + last 64 KB → BLAKE3 of the whole file; 4 parallel readers, cancellable
  - Skips online-only files (no downloads) and hard links (same data, not copies)
  - Searches the folder in view; minimum file size 64 KB / 1 MB / 10 MB / 100 MB
  - Groups sorted by space wasted; quick picks: keep oldest / newest / shortest path
  - Can never select every copy in a group; confirmation before moving to the Recycle Bin
  - Measured on the user folder: 3,456 candidates → 253 groups, 2.51 GB of extra copies, 36 s (4.47 GB read)
- [x] **Duplicates: filter and select by folder** (0.8.0): a path box (part of a path, or `*`/`?`) and a type
  picker narrow the groups shown, and the quick picks act on those only. The folder button on any copy
  selects every copy in that folder across all groups, but never the last copy of a group
- [x] **Duplicates: replace with hard links** (0.8.0): "Replace with links" keeps every name and stores the
  data once. Each copy is checked first (same size and last-write time as found, same first and last
  64 KB), linked under a temporary name and moved over the copy, so a failure leaves it as it was.
  Copies on another drive, on FAT/exFAT, or in use are reported and skipped. The tree counts the data
  once, under the name a rescan would (tested: `linking_a_copy_keeps_the_contents_and_frees_the_space`,
  `linking_a_duplicate_counts_its_data_once`)
- [x] **Duplicates: hash cache** (0.8.0): hashes are kept in `%LOCALAPPDATA%\com.volti.disk-studio\hashes.bin` (up to
  400,000 files), keyed by path + size + last-write time, so a repeat search reads only what changed;
  the summary says how many came from the cache. Files are hashed without updating their last-access
  time (`SetFileTime` with -1), so a search doesn't make them look recently opened
- [x] **Duplicates on the map** (0.8.0): "Show on map" dims everything but the extra copies, on the treemap
  and the sunburst, until "Stop"
- [x] **Junk finder** ("Cleanup" tab), one pass over the scan, 33 ms on 1.38M files
  - Safe: temp folders, browser + Electron app caches, GPU shader caches, crash dumps / WER,
    Windows Update downloads
  - Review first: `node_modules` (beside package.json), Rust `target` (beside Cargo.toml), Python caches,
    npm/pip/Cargo/NuGet/Yarn/Gradle caches, log files ≥ 1 MB, installers in Downloads older than 30 days
  - Rules match path endings, so they work for any user profile and across the scan root
  - Always measured on disk: online-only OneDrive data counts as nothing (on the user folder,
    build output is 9.75 GB on disk vs 89.5 GB by file size)
  - Items are recycled one by one; files in use are skipped and reported instead of failing the batch
- [x] **Recycle Bin safety check** (map, Duplicates and Cleanup)
  - Tested: on a drive with no Recycle Bin, `trash::delete` returns `Ok(())` and the file is deleted
    permanently, with no dialog and nothing in any bin. Folders bigger than the bin go the same way.
  - Before any delete, each item is checked against its drive's Recycle Bin: missing (removable /
    network), set to "delete immediately", or smaller than the item (limit read per volume from
    `BitBucket\Volume\{GUID}\MaxCapacity`; C: here holds 25.2 GB)
  - Such items are held back in the backend unless "Delete permanently" is ticked; the dialogs say what
    will happen, warn when Windows will push older items out of the bin, and label the button to match
  - One delete path for everything (`recycle_each`), reporting moved / in use / kept / deleted permanently
- [x] **OneDrive in the Recycle Bin check** (0.8.0): online-only files skip Windows' Recycle Bin: deleting
  one removes it from OneDrive everywhere, restorable from the OneDrive web recycle bin for 30 days (93 for
  work or school), per Microsoft's documentation. A local test wasn't possible: OneDrive didn't sync a file
  created from the sandbox, and no real file was touched to find out. The dialog now says how much of a
  delete is online-only, and that Undo can't bring it back
- [x] Remove the leftover empty `D:\disk-studio-recycle-test` folder from the safety test (done by hand, 2026-11-04)
- [x] **More cleanup rules and your own** (0.8.0): Teams (classic and new) and Slack caches; `.vs` beside a
  `.sln`; `bin`/`obj` beside a `.csproj`/`.fsproj`/`.vbproj`; WSL and Docker disk images (`ext4.vhdx`,
  `docker_data.vhdx`) listed "for information" only, with no checkbox, since deleting one erases a Linux
  distribution. Settings › Cleanup rules adds rules written like searches (`*.bak`, `Renders\scratch`),
  shown under "Your rules". On this PC the Teams rule finds 0.99 GB
- [x] Duplicates: switch to the per-item recycle so one locked copy doesn't stop the rest
- [x] **Big files not opened in a year** (0.8.0): a Cleanup category for files of 100 MB or more, on this
  drive, neither opened nor changed for a year, leaving out Windows' own folders. Scans now keep the
  last-access time of files of 64 MB and up (directory listing and NTFS file table). Last-access tracking
  is on here (`fsutil behavior query disablelastaccess` = 2); C: has 830 such files, the oldest opened
  126 days ago, so the list is empty until next summer
- [x] **Cleanup basket** (0.8.0): "Add to basket" in the map's right-click menu (one item or a selection),
  Duplicates and Cleanup; the basket button in the top bar shows the count, the total, and recycles all
  of it through the usual check. Kept by path, so it survives rescans
- [x] **Undo last recycle** (0.8.0): the toast after recycling has "Undo" (also Ctrl+Z): finds those paths in
  the Recycle Bin (deleted since the recycle started), restores them and rescans the folders they went
  back to. Tested on the real Recycle Bin (`undo_restores_from_the_recycle_bin`)
- Checked installed (0.8.0) on this PC: Cleanup lists the new Teams cache (EBWebView, 946 MB); duplicates of
  100 MB+ on C: took 5.2 s, then 0.0 s with 100 hashes remembered; "Show on map" picks out the 28 extra
  copies; the basket opens. Nothing was deleted, linked or restored on real files in this check
- [x] **Permanent delete** (0.8.0): off by default; Settings › Deleting › Offer "Delete permanently" adds a
  button to every delete confirmation, which asks a second time ("This can't be undone") before deleting

## v0.5 — History & reports
- [x] **Snapshots** (0.9.0, `snapshot.rs`): `.dss` files: an 8-byte magic, a version, a JSON header (location,
  time, totals: enough to list them without unpacking), then the tree breadth first, deflated. Read back
  through the same builder as a file-table scan, so totals and hard links come out exactly as scanned.
  Every finished scan is kept in `%LOCALAPPDATA%\com.volti.disk-studio\snapshots` (the newest 8 of each
  location; Settings › History turns it off). History (top bar, or Home) lists them; "Open" shows one
  read-only (no deleting, Duplicates or Cleanup), "Save as…" / "Open a file…" for snapshots elsewhere.
  Measured on C: (1.85M files): 32.4 MB, saved in 3.1 s, read back in 0.76 s with identical totals
- [x] **Compare two scans** (0.9.0, `compare.rs`): History › Compare (or "Compare with a file…") opens a
  Changes tab: totals then and now; folder by folder (biggest change first, gone items struck through, drill
  into any folder that exists in both); and lists of the files that grew or shrank most and the biggest new
  and gone items (a new folder once, not every file in it). Matched by path, case-insensitively, in the size
  mode shown. Compare an opened snapshot with another to compare two old scans
- [x] **Export** (0.9.0, `report.rs`): the folder in view as CSV (UTF-8 with BOM, for Excel), JSON or a
  self-contained HTML report (totals, indented contents with share bars, file types, largest 50 files; light
  and dark). Depth 1–3 levels or all, minimum size, folders only or with files; follows the size mode and
  any filter
- [x] **Daily check** (0.9.0, `background.rs`): Settings › Daily check creates a per-user Task Scheduler task
  (from XML: daily at the chosen hour, runs when missed, on battery too, 1-hour limit) that starts
  `disk-studio.exe --background`. That run opens no window: it sends a Windows notification for each fixed
  drive under the free-space threshold (5–25%), and scans the drives picked, keeping a snapshot and saying
  when one grew more than 10 GB since the last. Notifications use the app ID the installer gives the Start
  menu shortcut (`com.volti.disk-studio`, checked with `Get-StartApps`). "Check now" runs it on the spot
- Checked installed (0.9.0) on this PC: a scan of C: saved its snapshot automatically (30.5 MB); comparing
  the scan with it shows 630 GB then and now and nothing grew, shrank, came or went, so 1.83 million entries
  read back exactly. "Check now" ran ("every drive has room to spare") and its Windows notification
  appeared (confirmed by the user). Turning the daily check on creates a scheduled task, so that's left to
  the user

## v1.0 — Release polish
- [x] Settings dialog (0.5.0, Ctrl+,): theme, accent, size mode, units (1,024 / 1,000), folders to skip, about
- [x] Accent colour picker: the four Graphiq accents; everything derives from `--accent`
- [x] **Skip rules by name** (1.0.0): Settings › Folders to skip takes a full path (that folder), a plain name
  (`node_modules`: every folder with exactly that name) or a pattern written like a search (`*cache*`,
  `build|dist`, `steamapps\shadercache`); in both the folder walk and the file-table scan. Tested in
  `excluded_folders_are_left_out`
- [x] **Settings file** (1.0.0): Settings › Settings file exports every stored preference (theme, accent, skip
  list, rules, saved searches, list columns…) and the daily check to a `.json` file, and imports one (the
  window restarts to apply it). Only `.json`, at most 1 MB, and only plain keys are written back
- [x] **Keyboard and screen readers** (1.0.0): treemap and sunburst were already fully keyboard driven (arrows,
  `[` `]`, Enter, Home) with live announcements; the folder list, matches, duplicates, cleanup and changes
  lists are buttons and checkboxes in order. Added: Tab and Shift+Tab stay inside open dialogs, and labels on
  the three dropdowns that had none. Checked with a script over every view and dialog: every control and field
  has an accessible name, no duplicate ids, no positive tabindex
- [x] Explorer context menu entry: "Analyze with Disq Studio" (folders, drives, folder backgrounds;
      per-user, removed on uninstall); the app scans the path it's started with
- [x] **Installer (v0.4.0)**: per-user NSIS setup, no admin rights, Graphiq-branded pages, WebView2
      bootstrapper, `npm run installer` → `release\Disq Studio Setup <version>.exe` + SHA-256; CHANGELOG.md
- [ ] Code signing (needs a certificate; until then SmartScreen warns on first run). Options: Azure Trusted
      Signing (about $10 a month, needs an identity check), SignPath's free plan for open-source projects, or
      an OV certificate from a CA (from about $200 a year, on a hardware token or cloud HSM)
- [x] **Auto-updater** (1.0.0, `tauri-plugin-updater` + `tauri-plugin-process`): checks
      `releases/latest/download/latest.json` on GitHub once a day at start (quietly when offline) and offers
      "Install and restart"; Settings › Updates checks on demand. The installer runs in passive mode, then the
      app restarts. Updates must be signed by the key whose public half is in `tauri.conf.json`; the private
      key lives in `%USERPROFILE%\.tauri\disq-studio.key` and, for releases, in the `TAURI_SIGNING_PRIVATE_KEY`
      repository secret
- [x] **Renamed to Disq Studio** (1.0.0): window, installer, Start menu, Explorer menu ("Analyze with Disq
      Studio"; the installer removes the old entry), docs. The internal ID stays `com.volti.disk-studio`, so
      history, settings and notifications carry over
- [x] **Public repository, CI and releases** (1.0.0): MIT license, README, CONTRIBUTING, SECURITY, issue forms,
      Dependabot. CI (`ci.yml`) on every push and pull request: npm build, `cargo test`, a release build.
      Releases (`release.yml`) on a `v*` tag: tests, then `tauri-action` builds the installer, signs the update
      files, and publishes the release with notes from CHANGELOG.md and `latest.json`
- [x] Verified on this PC (0.4.1): installed through Explorer, "Analyze with Disq Studio" opens straight into
      the scan. 0.4.0 hung on small folders (scan finished before the window listened); fixed in 0.4.1.
- [x] Single instance (0.4.2, `tauri-plugin-single-instance`): a second launch hands its folder to the open
      window (`open-path` event) and exits. Verified installed: one process, started without a folder, showing
      the folder picked with "Analyze with Disq Studio"
- [x] Bring the window to the front when started from Explorer or handed a folder (`AllowSetForegroundWindow`
      in every launch, then unminimize / show / focus with a brief always-on-top). Verified on 0.4.2 by the user
- Note: `npm run tauri dev` shares the app ID, so a running dev build also receives Explorer launches;
  close it when testing the installed app
- [ ] Crash reporting and a log file
- [ ] macOS and Linux support (volume listing, Trash, reveal in Finder)
- [x] Unit tests for tree math and the scanner (39 tests, plus `compare_with_walk` checks the MFT reader as administrator)

---

## Notes
- The project lives in OneDrive. `npm run installer` builds into `%LOCALAPPDATA%\cargo-target\disk-studio`,
  outside OneDrive. `npm run tauri dev` still uses `src-tauri/target` (several GB, synced) unless
  `CARGO_TARGET_DIR` is set the same way.
- Design system source: Graphiq Studio redesign (tokens copied from `FTP-Client/src/styles/tokens.css`).

## v1.1 — German, title bar, dropdowns
- [x] **German** (1.1.0): every string goes through `t()` (`src/lib/i18n.ts`, as in Inq and Uplinq Studio);
  the English text is the key and `src/lib/de.ts` holds about 560 German strings. Sentences are whole
  (`t("{0} free of {1}", …)`, `tx()` when a part is bold or code), so word order can change. Errors and
  cleanup categories from Rust are translated by `te()`, which turns paths, sizes and quoted names into
  placeholders. The Rust side translates what it shows itself (`i18n.rs`: the daily check's notifications,
  the HTML report) and remembers the language for the daily check. Numbers and dates use the interface's
  locale. `npm test` (vitest, also in CI and before every release) fails when a string has no German or a
  translation loses a placeholder
- [x] **Own title bar** (1.1.0): `decorations: false`, `TitleBar.tsx` with the icon, the name, the folder
  in view, an Admin badge when elevated, and minimise / maximise-restore / close (red on hover, as in
  Windows)
- [x] **Graphiq dropdowns** (1.1.0): `ui/Select.tsx` replaces the six native `<select>`s: a portal list with
  the spring animation of the menus, combobox / listbox roles, arrows, Home/End, type-ahead, Esc and Tab
- [x] Checked in the preview in German: home, scan, map, list, details, duplicates, settings and the
  language dropdown; no console errors
