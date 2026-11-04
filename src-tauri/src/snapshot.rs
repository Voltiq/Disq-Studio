//! Saving a scan to a file and reading it back, for history and comparisons.
//!
//! Layout: an 8-byte magic, a format version (u32), the length of a JSON
//! header (u32), the header (what was scanned, when, and the totals, so a
//! list of snapshots never has to unpack them), then the tree, deflated.
//!
//! The tree is written breadth first: the root, then for each folder in turn
//! its number of children followed by the children. Reading it back feeds
//! the same builder the file-table scan uses, folder by folder, so sizes are
//! totalled and hard links counted once exactly as after a real scan.
//! Every name of hard-linked data is written as a full file carrying the
//! data's file ID, which is what lets the builder link them up again.

use flate2::read::DeflateDecoder;
use flate2::write::DeflateEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::File;
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use crate::tree::{Kind, NewNode, SizeMode, Tree};

const MAGIC: &[u8; 8] = b"DSSNAP\r\n";
const VERSION: u32 = 1;

/// What a snapshot holds, readable without unpacking it.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub root: String,
    /// Milliseconds since the Unix epoch.
    pub scanned_at: i64,
    pub files: u64,
    pub folders: u64,
    pub logical: u64,
    pub allocated: u64,
    /// Folders that couldn't be read.
    pub errors: u64,
    pub from_mft: bool,
    /// The app version that wrote it.
    pub app_version: String,
}

impl Meta {
    pub fn of(tree: &Tree, scanned_at: i64, from_mft: bool) -> Meta {
        let root = tree.get(0).expect("a tree has a root");
        Meta {
            root: tree.root_path.to_string_lossy().into_owned(),
            scanned_at,
            files: root.files as u64,
            folders: root.dirs as u64,
            logical: root.logical,
            allocated: root.allocated,
            errors: tree.denied_count(),
            from_mft,
            app_version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

fn bad(what: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, format!("Not a Disq Studio snapshot, or a damaged one: {what}"))
}

/// Writes `tree` to `path`, through a temporary file so a failure never leaves half a snapshot.
pub fn save(tree: &Tree, meta: &Meta, path: &Path) -> io::Result<u64> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("tmp");
    let result = (|| {
        let mut out = BufWriter::new(File::create(&tmp)?);
        out.write_all(MAGIC)?;
        out.write_all(&VERSION.to_le_bytes())?;
        let header = serde_json::to_vec(meta).map_err(io::Error::other)?;
        out.write_all(&(header.len() as u32).to_le_bytes())?;
        out.write_all(&header)?;
        let mut z = DeflateEncoder::new(out, Compression::fast());
        write_tree(tree, &mut z)?;
        z.finish()?.flush()
    })();
    match result {
        Ok(()) => {
            std::fs::rename(&tmp, path)?;
            Ok(std::fs::metadata(path)?.len())
        }
        Err(e) => {
            let _ = std::fs::remove_file(&tmp);
            Err(e)
        }
    }
}

fn kind_code(kind: Kind) -> u8 {
    match kind {
        Kind::File | Kind::Hardlink => 0,
        Kind::Dir => 1,
        Kind::Link => 2,
        Kind::Denied => 3,
        Kind::Excluded => 4,
        Kind::Deleted => 5,
    }
}

fn kind_of(code: u8) -> io::Result<Kind> {
    Ok(match code {
        0 => Kind::File,
        1 => Kind::Dir,
        2 => Kind::Link,
        3 => Kind::Denied,
        4 => Kind::Excluded,
        _ => return Err(bad("unknown entry")),
    })
}

fn write_node(tree: &Tree, id: u32, w: &mut impl Write) -> io::Result<()> {
    let n = tree.get(id).expect("live node");
    let name = tree.name(id).as_bytes();
    let name = &name[..name.len().min(u16::MAX as usize)];
    w.write_all(&[kind_code(n.kind)])?;
    w.write_all(&(name.len() as u16).to_le_bytes())?;
    w.write_all(name)?;
    if matches!(n.kind, Kind::File | Kind::Hardlink) {
        // A link's own sizes are zeroed in the tree; its data is the counted name's.
        let (file_id, data) = match tree.link_of(id) {
            Some((file_id, primary)) => (file_id, primary),
            None => (0, id),
        };
        let d = tree.get(data).expect("live node");
        w.write_all(&d.logical.to_le_bytes())?;
        w.write_all(&d.allocated.to_le_bytes())?;
        w.write_all(&tree.online(data).to_le_bytes())?;
        w.write_all(&n.modified.to_le_bytes())?;
        w.write_all(&tree.accessed(data).unwrap_or(0).to_le_bytes())?;
        w.write_all(&file_id.to_le_bytes())?;
    } else {
        w.write_all(&n.modified.to_le_bytes())?;
    }
    Ok(())
}

fn write_tree(tree: &Tree, w: &mut impl Write) -> io::Result<()> {
    write_node(tree, 0, w)?;
    let mut queue = VecDeque::from([0u32]);
    while let Some(dir) = queue.pop_front() {
        let kids: Vec<u32> = tree.live_children(dir).collect();
        w.write_all(&(kids.len() as u32).to_le_bytes())?;
        for &k in &kids {
            write_node(tree, k, w)?;
            if tree.get(k).is_some_and(|n| n.kind == Kind::Dir) {
                queue.push_back(k);
            }
        }
    }
    Ok(())
}

/// Reads just the header.
pub fn read_meta(path: &Path) -> io::Result<Meta> {
    let mut r = BufReader::new(File::open(path)?);
    read_header(&mut r)
}

fn read_header(r: &mut impl Read) -> io::Result<Meta> {
    let mut magic = [0u8; 8];
    r.read_exact(&mut magic).map_err(|_| bad("too short"))?;
    if &magic != MAGIC {
        return Err(bad("wrong kind of file"));
    }
    let version = read_u32(r)?;
    if version > VERSION {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "This snapshot was saved by a newer Disq Studio. Update to open it.",
        ));
    }
    let len = read_u32(r)? as usize;
    if len > 1 << 20 {
        return Err(bad("header too long"));
    }
    let mut header = vec![0u8; len];
    r.read_exact(&mut header)?;
    serde_json::from_slice(&header).map_err(|_| bad("unreadable header"))
}

fn read_u32(r: &mut impl Read) -> io::Result<u32> {
    let mut b = [0u8; 4];
    r.read_exact(&mut b)?;
    Ok(u32::from_le_bytes(b))
}

fn read_u64(r: &mut impl Read) -> io::Result<u64> {
    let mut b = [0u8; 8];
    r.read_exact(&mut b)?;
    Ok(u64::from_le_bytes(b))
}

/// An entry as read, owning its name until it's added to the tree.
struct Entry {
    kind: Kind,
    name: String,
    logical: u64,
    allocated: u64,
    online: u64,
    modified: i64,
    accessed: i64,
    file_id: u128,
}

fn read_entry(r: &mut impl Read) -> io::Result<Entry> {
    let mut code = [0u8; 1];
    r.read_exact(&mut code)?;
    let kind = kind_of(code[0])?;
    let mut b2 = [0u8; 2];
    r.read_exact(&mut b2)?;
    let mut name = vec![0u8; u16::from_le_bytes(b2) as usize];
    r.read_exact(&mut name)?;
    let name = String::from_utf8(name).map_err(|_| bad("unreadable name"))?;
    let mut e = Entry { kind, name, logical: 0, allocated: 0, online: 0, modified: 0, accessed: 0, file_id: 0 };
    if kind == Kind::File {
        e.logical = read_u64(r)?;
        e.allocated = read_u64(r)?;
        e.online = read_u64(r)?;
        e.modified = read_u64(r)? as i64;
        e.accessed = read_u64(r)? as i64;
        let mut b16 = [0u8; 16];
        r.read_exact(&mut b16)?;
        e.file_id = u128::from_le_bytes(b16);
    } else {
        e.modified = read_u64(r)? as i64;
    }
    Ok(e)
}

impl Entry {
    fn node(&self) -> NewNode<'_> {
        NewNode {
            name: &self.name,
            logical: self.logical,
            allocated: self.allocated,
            online: self.online,
            modified: self.modified,
            accessed: self.accessed,
            file_id: self.file_id,
            kind: self.kind,
        }
    }
}

/// Reads a whole snapshot back into a tree.
pub fn load(path: &Path, mode: SizeMode) -> io::Result<(Tree, Meta)> {
    let mut r = BufReader::new(File::open(path)?);
    let meta = read_header(&mut r)?;
    let mut z = BufReader::with_capacity(1 << 16, DeflateDecoder::new(r));
    let truncated = |e: io::Error| if e.kind() == io::ErrorKind::UnexpectedEof { bad("cut short") } else { e };

    let root = read_entry(&mut z).map_err(truncated)?;
    let capacity = (meta.files + meta.folders + 1).min(50_000_000) as usize;
    let mut tree = Tree::start(PathBuf::from(&meta.root), mode, NewNode { name: &meta.root, ..root.node() }, capacity);
    let mut ids = Vec::new();
    let mut queue = VecDeque::from([0u32]);
    let mut kids: Vec<Entry> = Vec::new();
    while let Some(dir) = queue.pop_front() {
        let count = read_u32(&mut z).map_err(truncated)? as usize;
        kids.clear();
        for _ in 0..count {
            kids.push(read_entry(&mut z).map_err(truncated)?);
        }
        let nodes: Vec<NewNode> = kids.iter().map(Entry::node).collect();
        let first = tree.add_children(dir, &nodes, &mut ids);
        for (i, k) in kids.iter().enumerate() {
            if k.kind == Kind::Dir {
                queue.push_back(first + i as u32);
            }
        }
    }
    tree.finish(ids, true);
    Ok((tree, meta))
}

/// A snapshot on disk, for the history list.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Saved {
    pub path: String,
    pub bytes: u64,
    #[serde(flatten)]
    pub meta: Meta,
}

/// Snapshots in `dir`, newest first; only those of `root` when given.
pub fn list(dir: &Path, root: Option<&str>) -> Vec<Saved> {
    let Ok(entries) = std::fs::read_dir(dir) else { return Vec::new() };
    let mut out: Vec<Saved> = entries
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "dss"))
        .filter_map(|e| {
            let path = e.path();
            let meta = read_meta(&path).ok()?;
            if root.is_some_and(|r| !same_root(r, &meta.root)) {
                return None;
            }
            Some(Saved { bytes: e.metadata().map(|m| m.len()).unwrap_or(0), path: path.to_string_lossy().into_owned(), meta })
        })
        .collect();
    out.sort_by_key(|s| std::cmp::Reverse(s.meta.scanned_at));
    out
}

pub fn same_root(a: &str, b: &str) -> bool {
    a.trim_end_matches(['\\', '/']).eq_ignore_ascii_case(b.trim_end_matches(['\\', '/']))
}

/// A file name for a snapshot of `root` taken at `at`, safe on any drive.
pub fn file_name(root: &str, at: i64) -> String {
    let safe: String = root
        .trim_end_matches(['\\', '/'])
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '.' { c } else { '_' })
        .collect();
    let (y, mo, d, h, mi, s) = crate::report::civil(at);
    format!("{safe} {y:04}-{mo:02}-{d:02} {h:02}{mi:02}{s:02}.dss")
}

/// Keeps the newest `keep` automatic snapshots of `root` in `dir`, deleting older ones.
pub fn prune(dir: &Path, root: &str, keep: usize) {
    for old in list(dir, Some(root)).into_iter().skip(keep) {
        let _ = std::fs::remove_file(old.path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scan::{test_file, test_folder};

    #[test]
    fn a_saved_scan_reads_back_the_same() {
        let raw = test_folder(
            "root",
            vec![
                test_folder("a", vec![test_file("x.bin", 5000, 1, false), test_file("linked.bin", 7000, 9, false)]),
                test_folder("b", vec![test_folder("deep", vec![test_file("linked.bin", 7000, 9, false), test_file("cloud.mp4", 9000, 3, true)])]),
                test_file("ünïcode name.txt", 10, 4, false),
            ],
        );
        let tree = Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true);
        let dir = std::env::temp_dir().join(format!("disk-studio-snap-{}", std::process::id()));
        let file = dir.join(file_name("C:\\root", 1_700_000_000_000));
        let meta = Meta::of(&tree, 1_700_000_000_000, false);
        save(&tree, &meta, &file).unwrap();

        assert_eq!(read_meta(&file).unwrap().files, tree.get(0).unwrap().files as u64);
        let (back, meta2) = load(&file, SizeMode::Logical).unwrap();
        assert_eq!(meta2.scanned_at, 1_700_000_000_000);
        for path in ["", "a", "b\\deep", "b\\deep\\linked.bin", "ünïcode name.txt", "b\\deep\\cloud.mp4"] {
            let p = PathBuf::from("C:\\root").join(path);
            let (old, new) = (tree.find(&p).unwrap(), back.find(&p).unwrap());
            let (o, n) = (tree.entry(old), back.entry(new));
            assert_eq!((o.logical, o.allocated, o.online, o.linked, o.files, o.kind), (n.logical, n.allocated, n.online, n.linked, n.files, n.kind), "{path}");
        }
        assert_eq!(back.entry(0).size, tree.entry(0).size);

        assert_eq!(list(&dir, Some("c:\\ROOT\\")).len(), 1);
        assert!(list(&dir, Some("D:\\")).is_empty());
        std::fs::write(dir.join("broken.dss"), b"DSSNAP\r\n\x01\x00\x00\x00").unwrap();
        assert!(load(&dir.join("broken.dss"), SizeMode::Logical).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
