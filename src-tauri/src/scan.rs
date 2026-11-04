//! Walks a folder in parallel and builds a size tree.
//!
//! Each folder is read on its own task, and its subfolders fan out across
//! the rayon pool, so a whole drive is read with every core busy. Links and
//! junctions are recorded but never followed, so nothing is counted twice
//! and the walk cannot loop.

use parking_lot::Mutex;
use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::time::UNIX_EPOCH;

use crate::listing;
use crate::tree::Kind;

/// Live counters the progress ticker reads while a scan runs.
#[derive(Default)]
pub struct Progress {
    pub files: AtomicU64,
    pub dirs: AtomicU64,
    pub bytes: AtomicU64,
    pub allocated: AtomicU64,
    pub errors: AtomicU64,
    /// Folders left out because they're in the user's exclusion list.
    pub excluded: AtomicU64,
    pub current: Mutex<String>,
    pub cancel: AtomicBool,
}

/// One entry as the walk finds it, before it is flattened into a `Tree`.
pub struct Raw {
    pub name: Box<str>,
    pub logical: u64,
    pub allocated: u64,
    /// Logical bytes of online-only cloud files at or under this entry.
    pub online: u64,
    pub files: u64,
    pub dirs: u64,
    pub modified: i64,
    /// Last access, for files; 0 for folders.
    pub accessed: i64,
    /// For files, the volume's ID for the data; hard links share it. 0 otherwise.
    pub file_id: u128,
    pub kind: Kind,
    pub children: Vec<Raw>,
}

impl Raw {
    fn folder(name: String, modified: i64) -> Self {
        Raw {
            name: name.into_boxed_str(),
            logical: 0,
            allocated: 0,
            online: 0,
            files: 0,
            dirs: 0,
            modified,
            accessed: 0,
            file_id: 0,
            kind: Kind::Dir,
            children: Vec::new(),
        }
    }

    fn file(item: listing::Item) -> Self {
        Raw {
            online: if item.online_only { item.logical } else { 0 },
            logical: item.logical,
            allocated: item.allocated,
            files: 0,
            dirs: 0,
            modified: item.modified,
            accessed: item.accessed,
            file_id: item.file_id,
            kind: Kind::File,
            children: Vec::new(),
            name: item.name.into_boxed_str(),
        }
    }

    fn link(item: listing::Item) -> Self {
        Raw { kind: Kind::Link, ..Raw::folder(item.name, item.modified) }
    }
}

/// Folders the user chose never to scan. A full path (`C:\Games\Cache`) skips
/// that folder, compared ignoring case and trailing slashes. A plain name
/// (`node_modules`) skips every folder with exactly that name. Anything else
/// is a pattern written like a search term: `*cache*`, `build|dist`, or a
/// path ending such as `Steam\steamapps\shadercache`.
#[derive(Default)]
pub struct Excludes {
    paths: std::collections::HashSet<String>,
    names: std::collections::HashSet<String>,
    patterns: Vec<crate::filter::Rule>,
}

impl Excludes {
    pub fn new<I: IntoIterator<Item = String>>(entries: I) -> Self {
        let mut out = Excludes::default();
        for e in entries {
            let e = e.trim();
            let full = e.as_bytes().get(1) == Some(&b':') || e.starts_with("\\\\") || e.starts_with('/');
            if full {
                let key = Self::key(Path::new(e));
                if !key.is_empty() {
                    out.paths.insert(key);
                }
            } else if !e.is_empty() && !e.contains(['*', '?', '|', '\\', '/']) {
                out.names.insert(e.to_lowercase());
            } else if let Some(rule) = crate::filter::Rule::new(&format!("\"{}\"", e.replace('"', ""))) {
                out.patterns.push(rule);
            }
        }
        out
    }

    fn key(path: &Path) -> String {
        path.to_string_lossy().replace('/', "\\").trim_end_matches('\\').to_lowercase()
    }

    pub fn is_empty(&self) -> bool {
        self.paths.is_empty() && self.names.is_empty() && self.patterns.is_empty()
    }

    pub fn contains(&self, path: &Path) -> bool {
        if self.is_empty() {
            return false;
        }
        let key = Self::key(path);
        if self.paths.contains(&key) {
            return true;
        }
        let name = key.rsplit('\\').next().unwrap_or(&key);
        self.names.contains(name) || self.patterns.iter().any(|r| r.matches(name, &key))
    }
}

/// Scans `root` and everything below it, leaving out `excludes`. Returns `None` if cancelled.
pub fn scan(root: &Path, progress: &Progress, excludes: &Excludes) -> Option<Raw> {
    let modified = fs::metadata(root)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    // Deep folder trees recurse deeply, so give the workers roomy stacks.
    let pool = rayon::ThreadPoolBuilder::new()
        .stack_size(16 * 1024 * 1024)
        .build()
        .ok()?;
    let name = root.to_string_lossy().into_owned();
    let raw = pool.install(|| scan_dir(root, name, modified, progress, excludes));
    if progress.cancel.load(Relaxed) {
        None
    } else {
        Some(raw)
    }
}

fn scan_dir(path: &Path, name: String, modified: i64, p: &Progress, excludes: &Excludes) -> Raw {
    let mut node = Raw::folder(name, modified);
    if p.cancel.load(Relaxed) {
        return node;
    }
    p.dirs.fetch_add(1, Relaxed);

    let items = match listing::list(path) {
        Ok(items) => items,
        Err(_) => {
            p.errors.fetch_add(1, Relaxed);
            node.kind = Kind::Denied;
            return node;
        }
    };

    // Exactly one child per entry, so the list never over-allocates.
    node.children.reserve_exact(items.len());
    let mut subdirs: Vec<(PathBuf, String, i64)> = Vec::new();
    let (mut files, mut logical, mut allocated) = (0u64, 0u64, 0u64);
    for item in items {
        if item.is_link {
            // Symlinks and junctions point at data counted elsewhere.
            node.children.push(Raw::link(item));
        } else if item.is_dir {
            let child = path.join(&item.name);
            if excludes.contains(&child) {
                // Left out on purpose: shown, but never read.
                p.excluded.fetch_add(1, Relaxed);
                node.children.push(Raw { kind: Kind::Excluded, ..Raw::folder(item.name, item.modified) });
            } else {
                subdirs.push((child, item.name, item.modified));
            }
        } else {
            files += 1;
            logical += item.logical;
            allocated += item.allocated;
            node.children.push(Raw::file(item));
        }
    }
    p.files.fetch_add(files, Relaxed);
    p.bytes.fetch_add(logical, Relaxed);
    p.allocated.fetch_add(allocated, Relaxed);
    if let Some(mut current) = p.current.try_lock() {
        *current = path.to_string_lossy().into_owned();
    }

    let dirs: Vec<Raw> = subdirs
        .into_par_iter()
        .map(|(path, name, modified)| scan_dir(&path, name, modified, p, excludes))
        .collect();

    node.files = files + dirs.iter().map(|d| d.files).sum::<u64>();
    node.dirs = dirs.len() as u64 + dirs.iter().map(|d| d.dirs).sum::<u64>();
    node.children.extend(dirs);
    node.logical = node.children.iter().map(|c| c.logical).sum();
    node.allocated = node.children.iter().map(|c| c.allocated).sum();
    node.online = node.children.iter().map(|c| c.online).sum();
    node
}

#[cfg(test)]
pub fn test_file(name: &str, logical: u64, file_id: u64, online_only: bool) -> Raw {
    Raw::file(listing::Item {
        name: name.into(),
        is_dir: false,
        is_link: false,
        logical,
        allocated: if online_only { 0 } else { logical.div_ceil(4096) * 4096 },
        modified: 0,
        accessed: 0,
        file_id: file_id as u128,
        online_only,
    })
}

#[cfg(test)]
pub fn test_folder(name: &str, children: Vec<Raw>) -> Raw {
    let mut node = Raw::folder(name.into(), 0);
    node.files = children.iter().map(|c| if c.kind == Kind::File { 1 } else { c.files }).sum();
    node.dirs = children.iter().map(|c| if c.kind == Kind::Dir { 1 + c.dirs } else { 0 }).sum();
    node.logical = children.iter().map(|c| c.logical).sum();
    node.allocated = children.iter().map(|c| c.allocated).sum();
    node.online = children.iter().map(|c| c.online).sum();
    node.children = children;
    node
}
