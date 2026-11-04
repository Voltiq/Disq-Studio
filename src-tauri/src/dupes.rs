//! Finds files with identical contents.
//!
//! Work is cut down in stages, so most files are never read at all:
//! 1. only files that share their exact size with another can be duplicates
//!    (done against the tree, before this module runs);
//! 2. of those, hash the first and last 64 KB, which tells most different
//!    files apart, and covers small files completely;
//! 3. hash the whole of whatever still matches.
//!
//! Hashes are BLAKE3, so equal hashes mean equal contents for all practical purposes.
//!
//! Hashes are remembered between searches (`HashCache`), keyed by path, size
//! and last-write time, so a second search only reads files that changed.
//! Files are read without touching their last-access time, so a search
//! doesn't make every candidate look recently opened.

use parking_lot::RwLock;
use rayon::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::{self, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};

/// How much of each end of a file the quick pass reads.
const EDGE: u64 = 64 * 1024;

#[derive(Clone)]
pub struct Candidate {
    pub id: u32,
    pub path: PathBuf,
    pub size: u64,
    pub modified: i64,
}

/// Live counters the progress ticker reads.
#[derive(Default)]
pub struct Progress {
    /// 0: comparing file edges, 1: comparing whole files.
    pub phase: AtomicU64,
    pub done: AtomicU64,
    pub total: AtomicU64,
    pub bytes_done: AtomicU64,
    pub bytes_total: AtomicU64,
    pub skipped: AtomicU64,
    /// Files whose hash came from the cache instead of being read.
    pub cached: AtomicU64,
    pub cancel: AtomicBool,
}

/// What a file's contents hashed to, as long as it hasn't changed since.
#[derive(Clone, Copy, Default)]
struct Hashes {
    edges: Option<[u8; 32]>,
    full: Option<[u8; 32]>,
}

type Key = (Box<str>, u64, i64);

/// Hashes kept between searches. Entries for files that changed simply stop
/// matching (the size or time in the key differs) and age out.
#[derive(Default)]
pub struct HashCache {
    map: RwLock<HashMap<Key, Hashes>>,
}

const CACHE_MAGIC: &[u8; 8] = b"DSHASH1\n";
/// Entries kept on disk at most; about 100 bytes each.
const CACHE_LIMIT: usize = 400_000;

impl HashCache {
    /// Reads the cache file; a missing or damaged file just means an empty cache.
    pub fn load(path: &Path) -> HashCache {
        let cache = HashCache::default();
        let Ok(file) = File::open(path) else { return cache };
        let mut r = BufReader::new(file);
        let mut magic = [0u8; 8];
        if r.read_exact(&mut magic).is_err() || &magic != CACHE_MAGIC {
            return cache;
        }
        let mut map = cache.map.write();
        let mut read_entry = || -> io::Result<(Key, Hashes)> {
            let mut b2 = [0u8; 2];
            r.read_exact(&mut b2)?;
            let mut name = vec![0u8; u16::from_le_bytes(b2) as usize];
            r.read_exact(&mut name)?;
            let mut b8 = [0u8; 8];
            r.read_exact(&mut b8)?;
            let size = u64::from_le_bytes(b8);
            r.read_exact(&mut b8)?;
            let modified = i64::from_le_bytes(b8);
            let mut flags = [0u8; 1];
            r.read_exact(&mut flags)?;
            let mut h = Hashes::default();
            let mut hash = [0u8; 32];
            if flags[0] & 1 != 0 {
                r.read_exact(&mut hash)?;
                h.edges = Some(hash);
            }
            if flags[0] & 2 != 0 {
                r.read_exact(&mut hash)?;
                h.full = Some(hash);
            }
            let name = String::from_utf8(name).map_err(|_| io::ErrorKind::InvalidData)?;
            Ok(((name.into_boxed_str(), size, modified), h))
        };
        while let Ok((key, h)) = read_entry() {
            map.insert(key, h);
        }
        drop(map);
        cache
    }

    /// Writes the cache, keeping `keep` (this search's files) first if it's over the limit.
    pub fn save(&self, path: &Path, keep: &[Candidate]) -> io::Result<()> {
        let map = self.map.read();
        let mut order: Vec<&Key> = Vec::with_capacity(map.len().min(CACHE_LIMIT));
        let mut seen = std::collections::HashSet::new();
        for c in keep {
            let key = key_of(c);
            if let Some((k, _)) = map.get_key_value(&key) {
                if seen.insert(k) {
                    order.push(k);
                }
            }
        }
        for k in map.keys() {
            if order.len() >= CACHE_LIMIT {
                break;
            }
            if !seen.contains(k) {
                order.push(k);
            }
        }
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let tmp = path.with_extension("tmp");
        {
            let mut w = BufWriter::new(File::create(&tmp)?);
            w.write_all(CACHE_MAGIC)?;
            for key in order.into_iter().take(CACHE_LIMIT) {
                let h = map[key];
                let name = key.0.as_bytes();
                if name.len() > u16::MAX as usize {
                    continue;
                }
                w.write_all(&(name.len() as u16).to_le_bytes())?;
                w.write_all(name)?;
                w.write_all(&key.1.to_le_bytes())?;
                w.write_all(&key.2.to_le_bytes())?;
                let flags = h.edges.is_some() as u8 | (h.full.is_some() as u8) << 1;
                w.write_all(&[flags])?;
                if let Some(e) = h.edges {
                    w.write_all(&e)?;
                }
                if let Some(f) = h.full {
                    w.write_all(&f)?;
                }
            }
            w.flush()?;
        }
        std::fs::rename(tmp, path)
    }

    fn get(&self, c: &Candidate) -> Hashes {
        self.map.read().get(&key_of(c)).copied().unwrap_or_default()
    }

    fn put(&self, c: &Candidate, update: impl FnOnce(&mut Hashes)) {
        update(self.map.write().entry(key_of(c)).or_default());
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.map.read().len()
    }
}

fn key_of(c: &Candidate) -> Key {
    (c.path.to_string_lossy().into(), c.size, c.modified)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DupFile {
    pub id: u32,
    pub path: String,
    pub modified: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DupGroup {
    /// Size of each copy.
    pub size: u64,
    pub files: Vec<DupFile>,
}

/// Groups `candidates` (already filtered to sizes that occur more than once)
/// into sets of identical files, largest waste first. `None` if cancelled.
/// Hashes are taken from, and added to, `cache`.
pub fn find(candidates: Vec<Candidate>, p: &Progress, cache: &HashCache) -> Option<Vec<DupGroup>> {
    // A few readers at once suits SSDs without thrashing spinning disks too badly.
    let pool = rayon::ThreadPoolBuilder::new().num_threads(4).build().ok()?;
    pool.install(|| {
        p.total.store(candidates.len() as u64, Relaxed);
        p.bytes_total.store(candidates.iter().map(|c| c.size.min(EDGE * 2)).sum(), Relaxed);
        let quick = refine(by_size(candidates), p, cache, Pass::Edges)?;

        // Files of up to two edges were read completely in the quick pass.
        let (done, big): (Vec<_>, Vec<_>) = quick.into_iter().partition(|g| g[0].size <= EDGE * 2);
        p.phase.store(1, Relaxed);
        p.done.store(0, Relaxed);
        p.bytes_done.store(0, Relaxed);
        p.total.store(big.iter().map(|g| g.len() as u64).sum(), Relaxed);
        p.bytes_total.store(big.iter().flatten().map(|c| c.size).sum(), Relaxed);
        let full = refine(big, p, cache, Pass::Full)?;

        let mut groups: Vec<DupGroup> = done
            .into_iter()
            .chain(full)
            .map(|mut files| {
                // Oldest first: usually the original.
                files.sort_by_key(|c| c.modified);
                DupGroup {
                    size: files[0].size,
                    files: files
                        .into_iter()
                        .map(|c| DupFile {
                            id: c.id,
                            path: c.path.to_string_lossy().into_owned(),
                            modified: c.modified,
                        })
                        .collect(),
                }
            })
            .collect();
        groups.sort_by_key(|g| std::cmp::Reverse(g.size * (g.files.len() as u64 - 1)));
        Some(groups)
    })
}

fn by_size(mut candidates: Vec<Candidate>) -> Vec<Vec<Candidate>> {
    candidates.sort_unstable_by_key(|c| c.size);
    let mut groups = Vec::new();
    let mut iter = candidates.into_iter().peekable();
    while let Some(first) = iter.next() {
        let mut group = vec![first];
        while iter.peek().is_some_and(|c| c.size == group[0].size) {
            group.push(iter.next().unwrap());
        }
        if group.len() > 1 {
            groups.push(group);
        }
    }
    groups
}

#[derive(Clone, Copy)]
enum Pass {
    Edges,
    Full,
}

/// A file's hash for `pass`, from the cache if the file hasn't changed.
fn hash(c: &Candidate, p: &Progress, cache: &HashCache, pass: Pass) -> io::Result<[u8; 32]> {
    let known = cache.get(c);
    let cached = match pass {
        Pass::Edges => known.edges,
        Pass::Full => known.full,
    };
    if let Some(h) = cached {
        p.cached.fetch_add(1, Relaxed);
        let counted = match pass {
            Pass::Edges => c.size.min(EDGE * 2),
            Pass::Full => c.size,
        };
        p.bytes_done.fetch_add(counted, Relaxed);
        return Ok(h);
    }
    let h = match pass {
        Pass::Edges => hash_edges(c, p)?,
        Pass::Full => hash_all(c, p)?,
    };
    cache.put(c, |e| match pass {
        Pass::Edges => e.edges = Some(h),
        Pass::Full => e.full = Some(h),
    });
    Ok(h)
}

/// Hashes every file in every group and splits groups by hash, keeping
/// only sets of two or more. Unreadable files are dropped and counted.
fn refine(groups: Vec<Vec<Candidate>>, p: &Progress, cache: &HashCache, pass: Pass) -> Option<Vec<Vec<Candidate>>> {
    let hashed: Vec<Vec<([u8; 32], Candidate)>> = groups
        .into_par_iter()
        .map(|group| {
            group
                .into_par_iter()
                .filter_map(|c| {
                    if p.cancel.load(Relaxed) {
                        return None;
                    }
                    let result = hash(&c, p, cache, pass);
                    p.done.fetch_add(1, Relaxed);
                    match result {
                        Ok(h) => Some((h, c)),
                        Err(_) => {
                            p.skipped.fetch_add(1, Relaxed);
                            None
                        }
                    }
                })
                .collect()
        })
        .collect();
    if p.cancel.load(Relaxed) {
        return None;
    }

    let mut out = Vec::new();
    for mut group in hashed {
        group.sort_unstable_by(|a, b| a.0.cmp(&b.0));
        let mut iter = group.into_iter().peekable();
        while let Some((h, first)) = iter.next() {
            let mut set = vec![first];
            while iter.peek().is_some_and(|(next, _)| *next == h) {
                set.push(iter.next().unwrap().1);
            }
            if set.len() > 1 {
                out.push(set);
            }
        }
    }
    Some(out)
}

/// Opens a file for reading without updating its last-access time, where
/// Windows allows that (it needs permission to write the file's attributes).
fn open_quietly(path: &Path) -> io::Result<File> {
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::Foundation::{FILETIME, GENERIC_READ};
        use windows_sys::Win32::Storage::FileSystem::{SetFileTime, FILE_WRITE_ATTRIBUTES};
        if let Ok(file) = std::fs::OpenOptions::new().access_mode(GENERIC_READ | FILE_WRITE_ATTRIBUTES).open(path) {
            // All ones: "leave the last-access time alone for reads through this handle".
            let keep = FILETIME { dwLowDateTime: u32::MAX, dwHighDateTime: u32::MAX };
            unsafe { SetFileTime(file.as_raw_handle(), std::ptr::null(), &keep, std::ptr::null()) };
            return Ok(file);
        }
    }
    File::open(path)
}

fn hash_edges(c: &Candidate, p: &Progress) -> io::Result<[u8; 32]> {
    let mut file = open_quietly(&c.path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buf = vec![0u8; EDGE as usize];
    let head = read_up_to(&mut file, &mut buf)?;
    hasher.update(&buf[..head]);
    let mut read = head as u64;
    if c.size > EDGE {
        // The tail, without overlapping the head.
        let start = c.size.saturating_sub(EDGE).max(EDGE);
        file.seek(SeekFrom::Start(start))?;
        let tail = read_up_to(&mut file, &mut buf)?;
        hasher.update(&buf[..tail]);
        read += tail as u64;
    }
    p.bytes_done.fetch_add(read, Relaxed);
    Ok(*hasher.finalize().as_bytes())
}

fn hash_all(c: &Candidate, p: &Progress) -> io::Result<[u8; 32]> {
    let mut file = open_quietly(&c.path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        if p.cancel.load(Relaxed) {
            return Err(io::Error::new(io::ErrorKind::Interrupted, "cancelled"));
        }
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        p.bytes_done.fetch_add(n as u64, Relaxed);
    }
    Ok(*hasher.finalize().as_bytes())
}

/// The volume's ID for a file's data, as directory listings report it.
#[cfg(windows)]
pub fn file_id(path: &Path) -> io::Result<u128> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{FileIdInfo, GetFileInformationByHandleEx, FILE_ID_INFO};
    let file = File::open(path)?;
    let mut info: FILE_ID_INFO = unsafe { std::mem::zeroed() };
    let ok = unsafe {
        GetFileInformationByHandleEx(
            file.as_raw_handle(),
            FileIdInfo,
            (&mut info as *mut FILE_ID_INFO).cast(),
            std::mem::size_of::<FILE_ID_INFO>() as u32,
        )
    };
    if ok == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(u128::from_le_bytes(info.FileId.Identifier))
}

#[cfg(not(windows))]
pub fn file_id(path: &Path) -> io::Result<u128> {
    use std::os::unix::fs::MetadataExt;
    Ok(std::fs::metadata(path)?.ino() as u128)
}

fn modified_ms(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Replaces `copy` with a hard link to `keep`, so both names share one copy
/// of the data. Both must still be exactly as the search found them (size
/// and last-write time), and their first and last 64 KB are compared again.
/// The link is made under a temporary name first and then moved over the
/// copy, so a failure leaves the copy as it was. Returns the data's file ID.
pub fn link_copy(keep: &Candidate, copy: &Candidate) -> Result<u128, String> {
    let err = |what: &str, e: io::Error| format!("{what}: {e}");
    for c in [keep, copy] {
        let meta = std::fs::metadata(&c.path).map_err(|e| err("couldn't read it", e))?;
        if meta.len() != c.size || modified_ms(&meta) != c.modified {
            return Err(format!("{} changed since the search", c.path.display()));
        }
    }
    let keep_id = file_id(&keep.path).map_err(|e| err("couldn't read it", e))?;
    if file_id(&copy.path).ok() == Some(keep_id) {
        return Err("already the same file".into());
    }
    let p = Progress::default();
    if hash_edges(keep, &p).map_err(|e| err("couldn't read it", e))? != hash_edges(copy, &p).map_err(|e| err("couldn't read it", e))? {
        return Err("the contents differ now".into());
    }
    let name = copy.path.file_name().ok_or("no file name")?.to_string_lossy().into_owned();
    let tmp = copy.path.with_file_name(format!("{name}.disk-studio-link"));
    std::fs::hard_link(&keep.path, &tmp).map_err(|e| match e.raw_os_error() {
        // ERROR_NOT_SAME_DEVICE, ERROR_INVALID_FUNCTION (FAT, exFAT), ERROR_TOO_MANY_LINKS
        Some(17) => "it's on a different drive from the copy that stays".to_string(),
        Some(1) | Some(50) => "this drive can't hold hard links".to_string(),
        Some(1142) => "the file already has the most names a file can have".to_string(),
        _ => err("couldn't make the link", e),
    })?;
    // A read-only copy can't be replaced; the link carries the kept file's attributes anyway.
    if let Ok(meta) = std::fs::metadata(&copy.path) {
        let mut perms = meta.permissions();
        if perms.readonly() {
            #[allow(clippy::permissions_set_readonly_false)]
            perms.set_readonly(false);
            let _ = std::fs::set_permissions(&copy.path, perms);
        }
    }
    if let Err(e) = std::fs::rename(&tmp, &copy.path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(err("couldn't replace it, most likely because a program is using it", e));
    }
    Ok(keep_id)
}

/// Reads until `buf` is full or the file ends.
fn read_up_to(file: &mut File, buf: &mut [u8]) -> io::Result<usize> {
    let mut filled = 0;
    while filled < buf.len() {
        let n = file.read(&mut buf[filled..])?;
        if n == 0 {
            break;
        }
        filled += n;
    }
    Ok(filled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn cand(id: u32, path: PathBuf, modified: i64) -> Candidate {
        let size = fs::metadata(&path).unwrap().len();
        Candidate { id, path, size, modified }
    }

    #[test]
    fn finds_only_identical_files() {
        let dir = std::env::temp_dir().join(format!("disk-studio-dupes-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let big: Vec<u8> = (0..300_000u32).map(|i| (i % 251) as u8).collect();
        let mut big_mid = big.clone();
        big_mid[150_000] ^= 1; // same size, same edges, different middle
        let small = b"hello duplicate".to_vec();
        let mut small_other = small.clone();
        small_other[0] = b'j';

        let files = [
            ("a.bin", &big),
            ("b.bin", &big),
            ("c.bin", &big),
            ("mid.bin", &big_mid),
            ("s1.txt", &small),
            ("s2.txt", &small),
            ("s3.txt", &small_other),
        ];
        let mut cands = Vec::new();
        for (i, (name, data)) in files.iter().enumerate() {
            fs::write(dir.join(name), data).unwrap();
            cands.push(cand(i as u32, dir.join(name), 100 - i as i64));
        }

        let cache = HashCache::default();
        let again = cands.clone();
        let groups = find(cands, &Progress::default(), &cache).unwrap();
        assert_eq!(groups.len(), 2);
        // Most wasted space first: two extra copies of the big file.
        assert_eq!(groups[0].size, 300_000);
        let names: Vec<_> = groups[0].files.iter().map(|f| f.path.rsplit(['\\', '/']).next().unwrap()).collect();
        assert_eq!(names, ["c.bin", "b.bin", "a.bin"], "oldest first, and not the edited copy");
        assert_eq!(groups[1].files.len(), 2);

        // A second search reads nothing, through a save and a load.
        let file = dir.join("cache.bin");
        cache.save(&file, &again).unwrap();
        let loaded = HashCache::load(&file);
        assert_eq!(loaded.len(), cache.len());
        let p = Progress::default();
        let groups2 = find(again, &p, &loaded).unwrap();
        assert_eq!(groups2.len(), 2);
        assert_eq!(p.cached.load(Relaxed), 7 + 4, "every edge hash and the 4 full hashes of the big files");

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn linking_a_copy_keeps_the_contents_and_frees_the_space() {
        let dir = std::env::temp_dir().join(format!("disk-studio-link-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("sub")).unwrap();
        let data: Vec<u8> = (0..200_000u32).map(|i| (i % 253) as u8).collect();
        fs::write(dir.join("keep.bin"), &data).unwrap();
        fs::write(dir.join("sub").join("copy.bin"), &data).unwrap();
        let cand = |p: PathBuf| {
            let meta = fs::metadata(&p).unwrap();
            Candidate { id: 0, size: meta.len(), modified: modified_ms(&meta), path: p }
        };
        let keep = cand(dir.join("keep.bin"));
        let copy = cand(dir.join("sub").join("copy.bin"));

        let id = link_copy(&keep, &copy).unwrap();
        assert_eq!(file_id(&copy.path).unwrap(), id, "both names are one file now");
        assert_eq!(fs::read(&copy.path).unwrap(), data);
        assert!(!dir.join("sub").join("copy.bin.disk-studio-link").exists());
        assert_eq!(link_copy(&keep, &cand(copy.path.clone())).unwrap_err(), "already the same file");

        // A copy that changed after the search is left alone.
        fs::write(dir.join("other.bin"), &data).unwrap();
        let stale = Candidate { modified: 1, ..cand(dir.join("other.bin")) };
        assert!(link_copy(&keep, &stale).unwrap_err().contains("changed since"));

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn cancel_stops_early() {
        let p = Progress::default();
        p.cancel.store(true, Relaxed);
        let cands = vec![
            Candidate { id: 0, path: "nope-a".into(), size: 5, modified: 0 },
            Candidate { id: 1, path: "nope-b".into(), size: 5, modified: 0 },
        ];
        assert!(find(cands, &p, &HashCache::default()).is_none());
    }
}
