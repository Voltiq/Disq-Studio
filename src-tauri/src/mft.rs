//! Reads a whole NTFS drive from its Master File Table: every file's names,
//! parent folders, sizes and times come from one long sequential read of
//! the table, instead of opening every folder one by one. It needs
//! administrator rights (it opens the drive itself), and also sees folders
//! no account may list, such as System Volume Information, and NTFS's own
//! files ($MFT, $LogFile, ...).
//!
//! Anything unexpected makes it give up with an error, and the caller falls
//! back to the normal walk.

use std::io;
use std::collections::VecDeque;
use std::path::Path;
use std::sync::atomic::Ordering::Relaxed;

use crate::scan::{Excludes, Progress};
use crate::tree::{Kind, NewNode, SizeMode, Tree};

/// What one file record says, gathered from its base record and any extension records.
#[derive(Default)]
struct Rec {
    in_use: bool,
    is_dir: bool,
    /// The record's sequence number; a child's parent reference must match it.
    seq: u16,
    /// How many names the record header says the file has.
    links: u16,
    attrs: u32,
    reparse_tag: u32,
    logical: u64,
    allocated: u64,
    /// Last write time, in milliseconds since the Unix epoch.
    modified: i64,
    /// Last access time, the same way.
    accessed: i64,
}

/// One name of a file in a folder; a file has one per hard link. DOS short names are left out.
struct Name {
    /// The folder's file reference: record number in the low 48 bits, sequence number above.
    parent: u64,
    rec: u32,
    /// Where the name is in Names::text.
    at: u32,
    len: u16,
    /// 0 POSIX, 1 Win32, 3 Win32 and DOS (2, DOS only, is left out).
    namespace: u8,
}

/// Every name, with their text back to back so millions of them stay compact.
#[derive(Default)]
struct Names {
    list: Vec<Name>,
    text: String,
}

impl Names {
    fn get(&self, n: &Name) -> &str {
        &self.text[n.at as usize..n.at as usize + n.len as usize]
    }
}

const ROOT: usize = 5;
const NAME_SURROGATE: u32 = 0x2000_0000;
const ATTR_REPARSE_POINT: u32 = 0x400;
/// Recall on data access, and offline. Directory listings also report 0x40000 (recall on
/// open), but in the file table that bit means "has extended attributes", which signed
/// programs and Store apps have; cloud placeholder files always carry recall on data access.
const ONLINE_ONLY: u32 = 0x0040_0000 | 0x1000;
const REF_MASK: u64 = 0xFFFF_FFFF_FFFF;
const UNIX_EPOCH_TICKS: i64 = 116_444_736_000_000_000;

fn u16_at(b: &[u8], at: usize) -> u16 {
    u16::from_le_bytes([b[at], b[at + 1]])
}
fn u32_at(b: &[u8], at: usize) -> u32 {
    u32::from_le_bytes(b[at..at + 4].try_into().unwrap())
}
fn u64_at(b: &[u8], at: usize) -> u64 {
    u64::from_le_bytes(b[at..at + 8].try_into().unwrap())
}

fn bad(what: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, format!("unexpected file table: {what}"))
}

/// Undoes NTFS's "update sequence" protection: the last two bytes of every
/// 512-byte stride were swapped out for a check value when written.
fn apply_fixups(rec: &mut [u8]) -> bool {
    let usa_at = u16_at(rec, 4) as usize;
    let usa_count = u16_at(rec, 6) as usize;
    if usa_count == 0 || usa_at + usa_count * 2 > rec.len() || (usa_count - 1) * 512 > rec.len() {
        return false;
    }
    let check = u16_at(rec, usa_at);
    for i in 1..usa_count {
        let end = i * 512 - 2;
        if u16_at(rec, end) != check {
            return false;
        }
        rec[end] = rec[usa_at + i * 2];
        rec[end + 1] = rec[usa_at + i * 2 + 1];
    }
    true
}

/// A record's attributes as (type, attribute bytes).
fn attributes(rec: &[u8]) -> impl Iterator<Item = (u32, &[u8])> {
    let mut at = u16_at(rec, 0x14) as usize;
    std::iter::from_fn(move || {
        if at + 8 > rec.len() {
            return None;
        }
        let kind = u32_at(rec, at);
        let len = u32_at(rec, at + 4) as usize;
        if kind == 0xFFFF_FFFF || len < 16 || at + len > rec.len() {
            return None;
        }
        let attr = &rec[at..at + len];
        at += len;
        Some((kind, attr))
    })
}

/// A resident attribute's value.
fn resident_value(attr: &[u8]) -> Option<&[u8]> {
    if attr[8] != 0 || attr.len() < 24 {
        return None;
    }
    let len = u32_at(attr, 16) as usize;
    let at = u16_at(attr, 20) as usize;
    attr.get(at..at + len)
}

/// Decodes a non-resident attribute's data runs into (first cluster, cluster count).
fn data_runs(attr: &[u8]) -> Option<Vec<(i64, u64)>> {
    let mut at = u16_at(attr, 32) as usize;
    let mut lcn = 0i64;
    let mut runs = Vec::new();
    loop {
        let header = *attr.get(at)?;
        if header == 0 {
            return Some(runs);
        }
        let (len_size, off_size) = ((header & 0x0F) as usize, (header >> 4) as usize);
        let bytes = attr.get(at + 1..at + 1 + len_size + off_size)?;
        let mut count = 0u64;
        for (i, &b) in bytes[..len_size].iter().enumerate() {
            count |= (b as u64) << (8 * i);
        }
        if off_size == 0 {
            // A sparse run: no clusters on disk. The table itself never has one.
            return None;
        }
        let mut delta = 0i64;
        for (i, &b) in bytes[len_size..].iter().enumerate() {
            delta |= (b as i64) << (8 * i);
        }
        // Sign-extend the offset.
        let shift = 64 - 8 * off_size as u32;
        delta = (delta << shift) >> shift;
        lcn += delta;
        runs.push((lcn, count));
        at += 1 + len_size + off_size;
    }
}

/// Reads one file record into `recs` (into its base record's slot when it is an extension).
fn parse_record(index: usize, rec: &[u8], recs: &mut [Rec], names: &mut Names) {
    if &rec[0..4] != b"FILE" {
        return;
    }
    let flags = u16_at(rec, 0x16);
    if flags & 1 == 0 {
        return;
    }
    let base = (u64_at(rec, 0x20) & REF_MASK) as usize;
    let slot = if base == 0 { index } else { base };
    let Some(r) = recs.get_mut(slot) else { return };
    if base == 0 {
        r.in_use = true;
        r.is_dir = flags & 2 != 0;
        r.seq = u16_at(rec, 0x10);
        r.links = u16_at(rec, 0x12);
    }
    for (kind, attr) in attributes(rec) {
        match kind {
            // $STANDARD_INFORMATION
            0x10 => {
                if let Some(v) = resident_value(attr).filter(|v| v.len() >= 36) {
                    let ticks = u64_at(v, 8) as i64;
                    r.modified = if ticks > UNIX_EPOCH_TICKS { (ticks - UNIX_EPOCH_TICKS) / 10_000 } else { 0 };
                    let ticks = u64_at(v, 24) as i64;
                    r.accessed = if ticks > UNIX_EPOCH_TICKS { (ticks - UNIX_EPOCH_TICKS) / 10_000 } else { 0 };
                    r.attrs = u32_at(v, 32);
                }
            }
            // $FILE_NAME
            0x30 => {
                let Some(v) = resident_value(attr).filter(|v| v.len() >= 66) else { continue };
                let namespace = v[65];
                if namespace == 2 {
                    continue; // the 8.3 short name; the long one is stored too
                }
                let units = v[64] as usize;
                let Some(raw) = v.get(66..66 + units * 2) else { continue };
                let wide: Vec<u16> = raw.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
                let name = String::from_utf16_lossy(&wide);
                names.list.push(Name {
                    parent: u64_at(v, 0),
                    rec: slot as u32,
                    at: names.text.len() as u32,
                    len: name.len() as u16,
                    namespace,
                });
                names.text.push_str(&name);
            }
            // $DATA: only the unnamed stream, the one directory listings report.
            0x80 if attr[9] == 0 => {
                if attr[8] == 0 {
                    r.logical = u32_at(attr, 16) as u64;
                    r.allocated = 0;
                } else if attr.len() >= 64 && u64_at(attr, 16) == 0 {
                    // Sizes are only kept in the piece that starts at cluster 0.
                    let compressed_or_sparse = u16_at(attr, 12) & (0x0001 | 0x8000) != 0;
                    r.logical = u64_at(attr, 48);
                    r.allocated = if compressed_or_sparse && attr.len() >= 72 { u64_at(attr, 64) } else { u64_at(attr, 40) };
                }
            }
            // $REPARSE_POINT
            0xC0 => {
                if let Some(v) = resident_value(attr).filter(|v| v.len() >= 4) {
                    r.reparse_tag = u32_at(v, 0);
                }
            }
            _ => {}
        }
    }
}

/// NTFS_VOLUME_DATA_BUFFER, as FSCTL_GET_NTFS_VOLUME_DATA fills it.
#[repr(C)]
#[derive(Default)]
struct VolumeData {
    serial: i64,
    sectors: i64,
    clusters: i64,
    free_clusters: i64,
    reserved: i64,
    bytes_per_sector: u32,
    bytes_per_cluster: u32,
    bytes_per_record: u32,
    clusters_per_record: u32,
    mft_valid_length: i64,
    mft_start_lcn: i64,
    mft2_start_lcn: i64,
    mft_zone_start: i64,
    mft_zone_end: i64,
}

/// `C:\` → `C`, for drive roots only.
pub fn drive_letter(root: &Path) -> Option<char> {
    let s = root.to_string_lossy();
    let s = s.trim_end_matches(['\\', '/']);
    let mut chars = s.chars();
    match (chars.next(), chars.next(), chars.next()) {
        (Some(letter), Some(':'), None) if letter.is_ascii_alphabetic() => Some(letter.to_ascii_uppercase()),
        _ => None,
    }
}

/// A drive's file table, read and sorted: every record, and every name by folder.
struct Table {
    recs: Vec<Rec>,
    names: Names,
}

impl Table {
    /// The names inside folder record `dir`.
    fn children(&self, dir: usize) -> &[Name] {
        let list = &self.names.list;
        let start = list.partition_point(|n| ((n.parent & REF_MASK) as usize) < dir);
        let end = list.partition_point(|n| ((n.parent & REF_MASK) as usize) <= dir);
        &list[start..end]
    }
}

/// Scans the drive whose root is `root` (such as `C:\`) from its file table.
/// `Ok(None)` means cancelled.
pub fn scan_drive(root: &Path, progress: &Progress, excludes: &Excludes, mode: SizeMode) -> io::Result<Option<Tree>> {
    let letter = drive_letter(root).ok_or_else(|| bad("not a drive root"))?;
    let Some(table) = read_table(letter, progress)? else { return Ok(None) };
    let tree = build(root, table, progress, excludes, mode);
    if let Some(t) = &tree {
        let r = t.entry(0);
        progress.bytes.store(r.logical, Relaxed);
        progress.allocated.store(r.allocated, Relaxed);
    }
    Ok(tree)
}

/// Reads and parses drive `letter`'s whole file table. `Ok(None)` means cancelled.
#[cfg(windows)]
fn read_table(letter: char, progress: &Progress) -> io::Result<Option<Table>> {
    use std::os::windows::fs::FileExt;
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::System::IO::DeviceIoControl;

    const FSCTL_GET_NTFS_VOLUME_DATA: u32 = 0x0009_0064;

    let volume = std::fs::File::open(format!(r"\\.\{letter}:"))?;

    let mut vd = VolumeData::default();
    let mut returned = 0u32;
    let ok = unsafe {
        DeviceIoControl(
            volume.as_raw_handle(),
            FSCTL_GET_NTFS_VOLUME_DATA,
            std::ptr::null(),
            0,
            (&mut vd as *mut VolumeData).cast(),
            std::mem::size_of::<VolumeData>() as u32,
            &mut returned,
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        return Err(io::Error::last_os_error());
    }
    let cluster = vd.bytes_per_cluster as u64;
    let rec_size = vd.bytes_per_record as usize;
    if cluster == 0 || !(512..=65536).contains(&rec_size) || vd.mft_valid_length <= 0 {
        return Err(bad("volume data"));
    }

    // Record 0 describes the table itself: where its pieces are on the drive.
    let mut first = vec![0u8; rec_size.max(vd.bytes_per_sector as usize)];
    volume.seek_read(&mut first, vd.mft_start_lcn as u64 * cluster)?;
    let first = &mut first[..rec_size];
    if &first[0..4] != b"FILE" || !apply_fixups(first) {
        return Err(bad("record 0"));
    }
    let data = attributes(first)
        .find(|&(kind, attr)| kind == 0x80 && attr[9] == 0 && attr[8] != 0)
        .ok_or_else(|| bad("no $MFT data"))?;
    let runs = data_runs(data.1).ok_or_else(|| bad("$MFT runs"))?;
    let mapped: u64 = runs.iter().map(|r| r.1).sum::<u64>() * cluster;
    let table_len = (vd.mft_valid_length as u64).min(u64_at(data.1, 48));
    if mapped < table_len {
        // The rest of the table is described by an attribute list; rare enough to leave to the walk.
        return Err(bad("$MFT continues in an attribute list"));
    }

    let count = (table_len / rec_size as u64) as usize;
    let mut recs: Vec<Rec> = Vec::with_capacity(count);
    recs.resize_with(count, Rec::default);
    let mut names = Names::default();

    // Read the table piece by piece, in big chunks.
    const CHUNK: u64 = 8 * 1024 * 1024;
    let mut buf = vec![0u8; CHUNK as usize];
    let mut index = 0usize;
    for &(lcn, clusters) in &runs {
        let mut offset = lcn as u64 * cluster;
        let mut left = (clusters * cluster).min((count - index) as u64 * rec_size as u64);
        while left > 0 {
            if progress.cancel.load(Relaxed) {
                return Ok(None);
            }
            let len = left.min(CHUNK) as usize;
            let chunk = &mut buf[..len];
            volume.seek_read(chunk, offset)?;
            for rec in chunk.chunks_exact_mut(rec_size) {
                if apply_fixups(rec) {
                    parse_record(index, rec, &mut recs, &mut names);
                }
                index += 1;
            }
            offset += len as u64;
            left -= len as u64;
            if let Some(mut current) = progress.current.try_lock() {
                *current = format!("{letter}:\\ file table, {}%", index * 100 / count.max(1));
            }
            progress.dirs.store(index as u64, Relaxed);
        }
    }

    if recs.get(ROOT).is_none_or(|r| !r.in_use || !r.is_dir) {
        return Err(bad("no root folder"));
    }

    // Keep the names whose folder is real, sorted by folder so each folder's
    // names are one run.
    names.list.retain(|n| {
        let parent = (n.parent & REF_MASK) as usize;
        let seq = (n.parent >> 48) as u16;
        // A parent that was deleted and its record reused isn't this file's folder.
        recs[n.rec as usize].in_use
            && n.rec as usize != ROOT
            && parent != n.rec as usize
            && recs.get(parent).is_some_and(|p| p.in_use && p.is_dir && p.seq == seq)
    });
    names.list.sort_unstable_by_key(|n| (n.parent & REF_MASK, n.rec));
    names.list.shrink_to_fit();
    progress.files.store(names.list.iter().filter(|n| !recs[n.rec as usize].is_dir).count() as u64, Relaxed);
    Ok(Some(Table { recs, names }))
}

#[cfg(not(windows))]
fn read_table(_letter: char, _progress: &Progress) -> io::Result<Option<Table>> {
    Err(io::Error::new(io::ErrorKind::Unsupported, "NTFS file tables are only read on Windows"))
}

/// Builds the size tree straight from the table, folder by folder, breadth first.
fn build(root: &Path, table: Table, progress: &Progress, excludes: &Excludes, mode: SizeMode) -> Option<Tree> {
    let root_name = root.to_string_lossy();
    let root_node = NewNode {
        name: &root_name,
        logical: 0,
        allocated: 0,
        online: 0,
        modified: table.recs[ROOT].modified,
        accessed: 0,
        file_id: 0,
        kind: Kind::Dir,
    };
    let mut tree = Tree::start(root.to_path_buf(), mode, root_node, table.names.list.len() + 1);
    let mut ids = Vec::new();
    let mut queue: VecDeque<(u32, u32)> = VecDeque::from([(ROOT as u32, 0)]);
    let mut kids: Vec<NewNode> = Vec::new();
    let mut folders: Vec<(usize, u32)> = Vec::new();
    while let Some((rec, id)) = queue.pop_front() {
        if progress.cancel.load(Relaxed) {
            return None;
        }
        // Only needed to match folders against the skip list.
        let path = (!excludes.is_empty()).then(|| tree.path(id));
        kids.clear();
        folders.clear();
        for n in table.children(rec as usize) {
            let c = &table.recs[n.rec as usize];
            let name = table.names.get(n);
            let is_link = c.attrs & ATTR_REPARSE_POINT != 0 && c.reparse_tag & NAME_SURROGATE != 0;
            let mut kid = NewNode { name, logical: 0, allocated: 0, online: 0, modified: c.modified, accessed: 0, file_id: 0, kind: Kind::Dir };
            if is_link {
                kid.kind = Kind::Link;
            } else if c.is_dir {
                if path.as_ref().is_some_and(|p| excludes.contains(&p.join(name))) {
                    progress.excluded.fetch_add(1, Relaxed);
                    kid.kind = Kind::Excluded;
                } else {
                    folders.push((kids.len(), n.rec));
                }
            } else {
                kid.kind = Kind::File;
                kid.logical = c.logical;
                kid.allocated = c.allocated;
                kid.online = if c.attrs & ONLINE_ONLY != 0 { c.logical } else { 0 };
                kid.accessed = c.accessed;
                // The same reference a directory listing reports, so refreshes match up.
                kid.file_id = ((c.seq as u128) << 48) | n.rec as u128;
            }
            kids.push(kid);
        }
        let first = tree.add_children(id, &kids, &mut ids);
        for &(i, child_rec) in &folders {
            queue.push_back((child_rec, first + i as u32));
        }
    }
    // The table is done with; free it before deduping and sorting.
    drop(kids);
    drop(table);
    tree.finish(ids, true);
    (!progress.cancel.load(Relaxed)).then_some(tree)
}
#[cfg(test)]
mod tests {
    use super::*;

    /// For folders where the file table has more files than a directory
    /// listing shows, prints what each extra file's record says (needs administrator):
    /// `DISK_STUDIO_MFT_DIRS=C:\Windows\Prefetch;... <test exe> explain_extra_files --ignored --nocapture`
    #[test]
    #[ignore]
    fn explain_extra_files() {
        let Ok(dirs) = std::env::var("DISK_STUDIO_MFT_DIRS") else { return };
        let dirs: Vec<&str> = dirs.split(';').filter(|d| !d.is_empty()).collect();
        let letter = dirs[0].chars().next().unwrap().to_ascii_uppercase();
        let table = read_table(letter, &Progress::default()).unwrap().unwrap();
        for dir in dirs {
            // Find the folder's record by name, from the root down.
            let mut cur = ROOT;
            for part in dir[3..].split('\\').filter(|p| !p.is_empty()) {
                let want = part.to_lowercase();
                cur = table
                    .children(cur)
                    .iter()
                    .find(|n| table.recs[n.rec as usize].is_dir && table.names.get(n).to_lowercase() == want)
                    .map(|n| n.rec as usize)
                    .unwrap_or_else(|| panic!("{dir}: no folder {part} in the file table"));
            }
            let listed: std::collections::HashSet<String> = std::fs::read_dir(dir)
                .unwrap()
                .flatten()
                .map(|e| e.file_name().to_string_lossy().to_lowercase())
                .collect();
            let names = table.children(cur);
            let extra: Vec<&Name> = names.iter().filter(|n| !listed.contains(&table.names.get(n).to_lowercase())).collect();
            println!("{dir}: record {cur}, {} names in the file table, {} in the listing, {} extra", names.len(), listed.len(), extra.len());
            for n in extra.iter().take(15) {
                let r = &table.recs[n.rec as usize];
                let all: Vec<String> = table
                    .names
                    .list
                    .iter()
                    .filter(|m| m.rec == n.rec)
                    .map(|m| format!("{} (ns {}, parent {})", table.names.get(m), m.namespace, m.parent & REF_MASK))
                    .collect();
                let here = std::path::Path::new(dir).join(table.names.get(n));
                let opens = match std::fs::symlink_metadata(&here) {
                    Ok(m) => format!("opens, {} bytes", m.len()),
                    Err(e) => format!("doesn't open: {e}"),
                };
                println!(
                    "  rec {} seq {} links {} dir {} attrs {:#x} size {} | names: {} | {opens}",
                    n.rec, r.seq, r.links, r.is_dir, r.attrs, r.logical, all.join("; ")
                );
            }
        }
    }

    #[test]
    fn building_breadth_first_matches_the_walk_tree() {
        use crate::scan::{test_file, test_folder};
        let make = || {
            test_folder(
                "root",
                vec![
                    test_folder("a", vec![test_file("x.bin", 5000, 1, false), test_file("cloud.mp4", 9000, 2, true)]),
                    test_folder("b", vec![test_folder("c", vec![test_file("y.bin", 300, 3, false), test_file("x2.bin", 5000, 1, false)])]),
                    test_file("top.txt", 70, 4, false),
                ],
            )
        };
        let walk = Tree::from_raw("C:\\root".into(), make(), SizeMode::Logical, true);

        // The same entries, added folder by folder.
        let file = |name, logical: u64, id: u128, online: bool| NewNode {
            name,
            logical,
            allocated: if online { 0 } else { logical.div_ceil(4096) * 4096 },
            online: if online { logical } else { 0 },
            modified: 0,
            accessed: 0,
            file_id: id,
            kind: Kind::File,
        };
        let dir = |name| NewNode { name, logical: 0, allocated: 0, online: 0, modified: 0, accessed: 0, file_id: 0, kind: Kind::Dir };
        let mut tree = Tree::start("C:\\root".into(), SizeMode::Logical, dir("root"), 8);
        let mut ids = Vec::new();
        let first = tree.add_children(0, &[dir("a"), dir("b"), file("top.txt", 70, 4, false)], &mut ids);
        tree.add_children(first, &[file("x.bin", 5000, 1, false), file("cloud.mp4", 9000, 2, true)], &mut ids);
        let c = tree.add_children(first + 1, &[dir("c")], &mut ids);
        tree.add_children(c, &[file("y.bin", 300, 3, false), file("x2.bin", 5000, 1, false)], &mut ids);
        tree.finish(ids, true);

        for id in [0, first, first + 1, c] {
            let (a, b) = (walk.entry(id), tree.entry(id));
            assert_eq!(
                (a.name, a.logical, a.allocated, a.online, a.linked, a.files, a.dirs),
                (b.name, b.logical, b.allocated, b.online, b.linked, b.files, b.dirs)
            );
        }
        assert_eq!(tree.entry(0).logical, 14_370, "x2.bin is a hard link of x.bin");
        assert_eq!(tree.hardlinks.len(), 1);
    }

    /// Scans a drive both ways and compares them (needs administrator):
    /// `DISK_STUDIO_MFT=C:\ <test exe> compare_with_walk --ignored --nocapture`
    #[test]
    #[ignore]
    fn compare_with_walk() {
        use std::path::PathBuf;
        let Ok(root) = std::env::var("DISK_STUDIO_MFT") else { return };
        let root = PathBuf::from(root);
        let gb = |b: u64| b as f64 / 1e9;

        let started = std::time::Instant::now();
        let mft = scan_drive(&root, &Progress::default(), &Excludes::default(), SizeMode::Logical).unwrap().unwrap();
        let mft_time = started.elapsed();
        let (mft_mb, mft_peak) = crate::tree::tests::memory_mb();

        let started = std::time::Instant::now();
        let progress = Progress::default();
        let raw = crate::scan::scan(&root, &progress, &Excludes::default()).unwrap();
        let walk_time = started.elapsed();
        let walk = Tree::from_raw(root.clone(), raw, SizeMode::Logical, true);

        for (label, t, time) in [("file table", &mft, mft_time), ("walk", &walk, walk_time)] {
            let r = t.entry(0);
            println!(
                "{label:>10}: {:?} | {} files, {} folders | size {:.2} GB, on disk {:.2} GB, online {:.2} GB, linked {:.2} GB",
                time, r.files, r.dirs, gb(r.logical), gb(r.allocated), gb(r.online), gb(r.linked)
            );
        }
        println!("file table memory: {mft_mb:.0} MB after, {mft_peak:.0} MB peak; walk skipped {} folders",
            progress.errors.load(Relaxed));

        // Folder by folder, two levels down, where they differ by more than 1% or 10 MB.
        fn compare(mft: &Tree, walk: &Tree, m: u32, w: u32, depth: u32) {
            let mine: std::collections::HashMap<String, crate::tree::Entry> =
                mft.list(m).into_iter().map(|e| (e.name.to_lowercase(), e)).collect();
            for e in walk.list(w) {
                let Some(o) = mine.get(&e.name.to_lowercase()) else {
                    println!("  only in walk: {} ({:.3} GB)", walk.path(e.id).display(), e.logical as f64 / 1e9);
                    continue;
                };
                let off = |a: u64, b: u64| a.abs_diff(b) > (a.max(b) / 100).max(10_000_000);
                if off(o.logical, e.logical) || off(o.allocated, e.allocated) || off(o.online, e.online) || o.files != e.files {
                    println!(
                        "  {:<60} size {:>8.3} / {:>8.3} GB  on disk {:>8.3} / {:>8.3} GB  online {:>8.3} / {:>8.3} GB  files {} / {}  ({:?} / {:?})",
                        walk.path(e.id).display(), o.logical as f64 / 1e9, e.logical as f64 / 1e9,
                        o.allocated as f64 / 1e9, e.allocated as f64 / 1e9, o.online as f64 / 1e9, e.online as f64 / 1e9,
                        o.files, e.files, o.kind, e.kind
                    );
                    if depth > 0 && e.kind == Kind::Dir {
                        compare(mft, walk, o.id, e.id, depth - 1);
                    }
                }
            }
            let names: std::collections::HashSet<String> = walk.list(w).into_iter().map(|e| e.name.to_lowercase()).collect();
            for (name, o) in &mine {
                if !names.contains(name) && o.logical > 10_000_000 {
                    println!("  only in file table: {} ({:.3} GB)", mft.path(o.id).display(), o.logical as f64 / 1e9);
                }
            }
        }
        println!("differences (file table / walk):");
        compare(&mft, &walk, 0, 0, 3);

        // File by file under the folders named in DISK_STUDIO_MFT_FOCUS (separated by ;).
        fn files(t: &Tree, id: u32, out: &mut std::collections::HashMap<String, crate::tree::Entry>) {
            for e in t.list(id) {
                match e.kind {
                    Kind::Dir => files(t, e.id, out),
                    _ => {
                        out.insert(t.path(e.id).to_string_lossy().to_lowercase(), e);
                    }
                }
            }
        }
        for focus in std::env::var("DISK_STUDIO_MFT_FOCUS").unwrap_or_default().split(';').filter(|s| !s.is_empty()) {
            let (Some(m), Some(w)) = (mft.find(Path::new(focus)), walk.find(Path::new(focus))) else {
                println!("{focus}: not in both scans");
                continue;
            };
            let (mut a, mut b) = (Default::default(), Default::default());
            files(&mft, m, &mut a);
            files(&walk, w, &mut b);
            println!("{focus}: {} entries in the file table, {} in the walk", a.len(), b.len());
            let show = |label: &str, list: Vec<String>| {
                println!("  {label}: {}", list.len());
                let mut list = list;
                list.sort();
                for p in list.iter().take(12) {
                    println!("    {p}");
                }
            };
            show("only in walk", b.keys().filter(|k| !a.contains_key(*k)).cloned().collect());
            show("only in file table", a.keys().filter(|k| !b.contains_key(*k)).cloned().collect());
            show(
                "online-only in file table, not in walk",
                a.iter()
                    .filter(|(k, e)| e.online > 0 && b.get(*k).is_some_and(|o| o.online == 0))
                    .map(|(k, e)| format!("{k} ({} bytes, {:?})", e.logical, e.kind))
                    .collect(),
            );
            show(
                "online-only in walk, not in file table",
                b.iter().filter(|(k, e)| e.online > 0 && a.get(*k).is_some_and(|o| o.online == 0)).map(|(k, _)| k.clone()).collect(),
            );
            show(
                "different kind",
                a.iter()
                    .filter_map(|(k, e)| b.get(k).filter(|o| o.kind != e.kind).map(|o| format!("{k} {:?} / {:?}", e.kind, o.kind)))
                    .collect(),
            );
        }
    }

    #[test]
    fn drive_roots_only() {
        assert_eq!(drive_letter(Path::new("C:\\")), Some('C'));
        assert_eq!(drive_letter(Path::new("d:")), Some('D'));
        assert_eq!(drive_letter(Path::new("C:\\Users")), None);
        assert_eq!(drive_letter(Path::new("\\\\server\\share")), None);
    }

    #[test]
    fn decodes_data_runs() {
        // A non-resident attribute whose runs start at byte 40.
        let mut attr = vec![0u8; 40];
        attr[8] = 1;
        attr[32..34].copy_from_slice(&40u16.to_le_bytes());
        // 0x21 = 1-byte length, 2-byte offset. 0x10 clusters at 0x1000, then
        // 0x08 clusters 0x100 back (a negative offset), then the end marker.
        attr.extend_from_slice(&[0x21, 0x10, 0x00, 0x10, 0x21, 0x08, 0x00, 0xFF, 0x00]);
        assert_eq!(data_runs(&attr), Some(vec![(0x1000, 0x10), (0x0F00, 0x08)]));
    }

    #[test]
    fn fixups_restore_sector_ends() {
        let mut rec = vec![0u8; 1024];
        rec[0..4].copy_from_slice(b"FILE");
        rec[4..6].copy_from_slice(&0x30u16.to_le_bytes());
        rec[6..8].copy_from_slice(&3u16.to_le_bytes());
        // Check value 0xABCD; the real bytes were 0x1111 and 0x2222.
        rec[0x30..0x32].copy_from_slice(&0xABCDu16.to_le_bytes());
        rec[0x32..0x34].copy_from_slice(&0x1111u16.to_le_bytes());
        rec[0x34..0x36].copy_from_slice(&0x2222u16.to_le_bytes());
        rec[510..512].copy_from_slice(&0xABCDu16.to_le_bytes());
        rec[1022..1024].copy_from_slice(&0xABCDu16.to_le_bytes());
        assert!(apply_fixups(&mut rec));
        assert_eq!(u16_at(&rec, 510), 0x1111);
        assert_eq!(u16_at(&rec, 1022), 0x2222);
        // A torn write (check value missing) is rejected.
        rec[510..512].copy_from_slice(&0u16.to_le_bytes());
        assert!(!apply_fixups(&mut rec));
    }
}
