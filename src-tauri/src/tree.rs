//! The scanned size tree, flattened into one array so millions of entries
//! stay compact, plus the queries the UI runs against it.
//!
//! Node 0 is the scanned folder. A node's children are `links[first..first + count]`,
//! sorted largest first by the current size mode. Keeping child ids in
//! `links`, rather than storing siblings next to each other, lets folders
//! re-sort (after a delete, or when the size mode changes) without
//! renumbering anything. A parent's id is always lower than its children's
//! (ids are handed out breadth first, and a refreshed folder's new children
//! are appended), which the filter and junk finder rely on.
//!
//! To keep each node small, names live in one shared string, and the figures
//! most nodes don't have (online-only bytes, hard-linked bytes) live in side
//! tables.

use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};
use std::path::PathBuf;

use crate::filter::{Filter, Query};
use crate::scan::Raw;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    File,
    Dir,
    /// A symlink or junction; never followed.
    Link,
    /// A folder that could not be read.
    Denied,
    /// A folder in the user's exclusion list; never read, so it has no size.
    Excluded,
    /// Another name for a file counted elsewhere in the scan (a hard link);
    /// its sizes are zero so the data is counted once.
    Hardlink,
    /// Moved to the Recycle Bin during this session, or replaced by a refresh.
    Deleted,
}

/// Which size every query reports and sorts by.
#[derive(Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SizeMode {
    /// The file's length: what Explorer shows as "Size".
    #[default]
    Logical,
    /// Space actually taken on the drive: rounded up to whole clusters,
    /// smaller for compressed or sparse files, zero for online-only cloud files.
    Allocated,
}

/// Files at least this big keep their last-access time (see `Tree::accessed`).
pub const BIG_FILE: u64 = 64 * 1024 * 1024;

/// 56 bytes, plus the name's bytes in `Tree::names`.
pub struct Node {
    pub logical: u64,
    pub allocated: u64,
    pub modified: i64,
    pub files: u32,
    pub dirs: u32,
    pub parent: u32,
    pub first: u32,
    pub count: u32,
    name_at: u32,
    name_len: u16,
    pub kind: Kind,
}

impl Node {
    fn size(&self, mode: SizeMode) -> u64 {
        match mode {
            SizeMode::Logical => self.logical,
            SizeMode::Allocated => self.allocated,
        }
    }
}

/// One entry to add with `Tree::start` or `Tree::add_children`. Folder sizes
/// and counts are left at zero; `Tree::finish` totals them.
pub struct NewNode<'a> {
    pub name: &'a str,
    pub logical: u64,
    pub allocated: u64,
    /// Logical bytes if it's an online-only cloud file.
    pub online: u64,
    pub modified: i64,
    /// Last access, for files; 0 when unknown. Only kept for big files.
    pub accessed: i64,
    /// For files: the volume's ID for the data; hard links share it. 0 when unknown.
    pub file_id: u128,
    pub kind: Kind,
}

/// The names that share one piece of data, and which of them it's counted under.
struct LinkGroup {
    file_id: u128,
    /// The other names, each a zero-size `Hardlink`.
    others: Vec<u32>,
}

pub struct Tree {
    pub root_path: PathBuf,
    pub nodes: Vec<Node>,
    pub links: Vec<u32>,
    pub mode: SizeMode,
    /// Every node's name, back to back.
    names: String,
    /// Logical bytes of online-only cloud files at or under a node. Most have none.
    online: HashMap<u32, u64>,
    /// Last access of files of `BIG_FILE` or more, for the "not opened in a year" report.
    accessed: HashMap<u32, i64>,
    /// Logical bytes of hard links at or under a node that are counted once,
    /// under another name.
    linked: HashMap<u32, u64>,
    /// Each hard link's counted name.
    pub hardlinks: HashMap<u32, u32>,
    /// Counted name → the group it heads.
    link_groups: HashMap<u32, LinkGroup>,
    /// File ID → counted name, so a refreshed folder's links find their group.
    link_ids: HashMap<u128, u32>,
    /// While set, every query reports matching sizes only.
    pub filter: Option<Filter>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: u32,
    pub name: String,
    /// The size in the current mode.
    pub size: u64,
    pub logical: u64,
    pub allocated: u64,
    pub online: u64,
    pub linked: u64,
    pub files: u64,
    pub dirs: u64,
    pub modified: i64,
    pub kind: Kind,
    pub has_children: bool,
}

/// A trimmed subtree for drawing the treemap.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapNode {
    pub id: u32,
    pub name: String,
    pub size: u64,
    pub kind: Kind,
    /// An online-only cloud file.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub online: bool,
    /// Milliseconds since the Unix epoch; for "colour by age".
    pub modified: i64,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<MapNode>,
    /// Bytes in children too small to draw, shown as one block.
    #[serde(skip_serializing_if = "is_zero")]
    pub rest: u64,
    #[serde(skip_serializing_if = "is_zero")]
    pub rest_count: u64,
}

fn is_zero(n: &u64) -> bool {
    *n == 0
}

#[derive(Serialize)]
pub struct Crumb {
    pub id: u32,
    pub name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeInfo {
    #[serde(flatten)]
    pub entry: Entry,
    pub path: String,
    pub ancestors: Vec<Crumb>,
    pub parent_size: u64,
    pub root_size: u64,
    /// For a hard link: the name its data is counted under.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link_target: Option<LinkTarget>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkTarget {
    pub id: u32,
    pub path: String,
    pub logical: u64,
    pub allocated: u64,
}

#[derive(Serialize)]
pub struct ExtStat {
    pub ext: String,
    pub bytes: u64,
    pub count: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHit {
    pub id: u32,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: i64,
    pub online: bool,
}

const NO_PARENT: u32 = u32::MAX;

/// Adds `add` and takes off `sub` in a side table, dropping entries that reach zero.
fn bump(map: &mut HashMap<u32, u64>, id: u32, add: u64, sub: u64) {
    if add == sub {
        return;
    }
    let v = map.entry(id).or_insert(0);
    *v = (*v + add).saturating_sub(sub);
    if *v == 0 {
        map.remove(&id);
    }
}

impl Tree {
    /// Flattens a scan. With `dedupe_links`, files that share a file ID are
    /// hard links to the same data, and only the first one found is counted.
    /// Only pass it for file systems with stable, unique IDs (NTFS, ReFS).
    pub fn from_raw(root_path: PathBuf, raw: Raw, mode: SizeMode, dedupe_links: bool) -> Tree {
        let total = (raw.files + raw.dirs + 1) as usize;
        let mut tree = Tree::empty(root_path, mode, total);
        tree.push_node(&raw, NO_PARENT);
        let ids = tree.append_children(raw, 0, dedupe_links);
        tree.names.shrink_to_fit();
        tree.dedupe(ids);
        tree.sort_all();
        tree
    }

    /// An empty tree holding just the scanned folder, to fill breadth first
    /// with `add_children` and complete with `finish`. Used by the file-table
    /// reader, which skips building a `Raw` tree first.
    pub fn start(root_path: PathBuf, mode: SizeMode, root: NewNode, capacity: usize) -> Tree {
        let mut tree = Tree::empty(root_path, mode, capacity);
        tree.push(&root, NO_PARENT);
        tree
    }

    fn empty(root_path: PathBuf, mode: SizeMode, capacity: usize) -> Tree {
        Tree {
            root_path,
            nodes: Vec::with_capacity(capacity),
            links: Vec::with_capacity(capacity),
            mode,
            names: String::new(),
            online: HashMap::new(),
            accessed: HashMap::new(),
            linked: HashMap::new(),
            hardlinks: HashMap::new(),
            link_groups: HashMap::new(),
            link_ids: HashMap::new(),
            filter: None,
        }
    }

    /// Adds every child of folder `parent` at once (each folder exactly once,
    /// after its own parent). Sizes are totalled up by `finish`. Returns the
    /// first child's id; the rest follow in order. Files with an ID are
    /// added to `ids`, for `finish` to find hard links.
    pub fn add_children(&mut self, parent: u32, kids: &[NewNode], ids: &mut Vec<(u128, u32)>) -> u32 {
        let first = self.nodes.len() as u32;
        let first_link = self.links.len() as u32;
        for kid in kids {
            let id = self.push(kid, parent);
            self.links.push(id);
            if kid.kind == Kind::File && kid.file_id != 0 {
                ids.push((kid.file_id, id));
            }
        }
        let p = &mut self.nodes[parent as usize];
        p.first = first_link;
        p.count = kids.len() as u32;
        first
    }

    /// Totals sizes and counts up the folders (children always have higher
    /// ids than their parents), counts hard links once, and sorts.
    pub fn finish(&mut self, ids: Vec<(u128, u32)>, dedupe_links: bool) {
        for i in (1..self.nodes.len()).rev() {
            let n = &self.nodes[i];
            let (files, dirs) = match n.kind {
                Kind::File => (1, 0),
                Kind::Dir | Kind::Denied => (n.files, n.dirs + 1),
                _ => (0, 0),
            };
            let (logical, allocated, parent) = (n.logical, n.allocated, n.parent as usize);
            let online = self.online(i as u32);
            let p = &mut self.nodes[parent];
            p.logical += logical;
            p.allocated += allocated;
            p.files += files;
            p.dirs += dirs;
            bump(&mut self.online, parent as u32, online, 0);
        }
        self.names.shrink_to_fit();
        self.nodes.shrink_to_fit();
        self.links.shrink_to_fit();
        if dedupe_links {
            self.dedupe(ids);
        }
        self.sort_all();
    }

    fn push(&mut self, n: &NewNode, parent: u32) -> u32 {
        let id = self.nodes.len() as u32;
        let mut name = n.name;
        if name.len() > u16::MAX as usize {
            let mut end = u16::MAX as usize;
            while !name.is_char_boundary(end) {
                end -= 1;
            }
            name = &name[..end];
        }
        let name_at = self.names.len() as u32;
        self.names.push_str(name);
        self.nodes.push(Node {
            logical: n.logical,
            allocated: n.allocated,
            modified: n.modified,
            files: 0,
            dirs: 0,
            parent,
            first: 0,
            count: 0,
            name_at,
            name_len: name.len() as u16,
            kind: n.kind,
        });
        if n.online > 0 {
            self.online.insert(id, n.online);
        }
        if n.kind == Kind::File && n.logical >= BIG_FILE && n.accessed > 0 {
            self.accessed.insert(id, n.accessed);
        }
        id
    }

    /// Adds a scanned entry, whose folder sizes and counts are already totalled.
    fn push_node(&mut self, raw: &Raw, parent: u32) -> u32 {
        let id = self.push(
            &NewNode {
                name: &raw.name,
                logical: raw.logical,
                allocated: raw.allocated,
                online: raw.online,
                modified: raw.modified,
                accessed: raw.accessed,
                file_id: raw.file_id,
                kind: raw.kind,
            },
            parent,
        );
        let n = &mut self.nodes[id as usize];
        n.files = raw.files.min(u32::MAX as u64) as u32;
        n.dirs = raw.dirs.min(u32::MAX as u64) as u32;
        id
    }

    /// Adds `raw`'s children (and everything under them) beneath node `id`,
    /// breadth first so each folder's children get their links in one run.
    /// Returns the file IDs found, for `dedupe`.
    fn append_children(&mut self, raw: Raw, id: u32, collect_ids: bool) -> Vec<(u128, u32)> {
        let mut ids = Vec::new();
        let mut queue: VecDeque<(Raw, u32)> = VecDeque::new();
        queue.push_back((raw, id));
        while let Some((raw, id)) = queue.pop_front() {
            let first = self.links.len() as u32;
            let count = raw.children.len() as u32;
            for child in raw.children {
                let child_id = self.push_node(&child, id);
                self.links.push(child_id);
                if collect_ids && child.kind == Kind::File && child.file_id != 0 {
                    ids.push((child.file_id, child_id));
                }
                if !child.children.is_empty() {
                    queue.push_back((child, child_id));
                }
            }
            let node = &mut self.nodes[id as usize];
            node.first = first;
            node.count = count;
        }
        ids
    }

    /// Counts each hard-linked file once: the name that ranks first (see
    /// `link_rank`) keeps the sizes, and every other name becomes a zero-size
    /// `Hardlink`. A refreshed folder's names join the group their data
    /// already has, taking over if one of them ranks first.
    fn dedupe(&mut self, mut ids: Vec<(u128, u32)>) {
        ids.sort_unstable();
        for run in ids.chunk_by(|a, b| a.0 == b.0) {
            let file_id = run[0].0;
            let (primary, others) = match self.link_ids.get(&file_id) {
                Some(&p) => {
                    let best = run.iter().map(|&(_, id)| id).min_by_key(|&id| self.link_rank(id)).unwrap();
                    if self.link_rank(best) < self.link_rank(p) {
                        self.hand_over(p, best, file_id);
                        let rest: Vec<(u128, u32)> = run.iter().copied().filter(|&(_, id)| id != best).collect();
                        for &(_, dup) in &rest {
                            self.make_link(dup, best);
                        }
                        if let Some(g) = self.link_groups.get_mut(&best) {
                            g.others.extend(rest.iter().map(|&(_, d)| d));
                        }
                        continue;
                    }
                    (p, run)
                }
                None if run.len() > 1 => {
                    let best = run.iter().min_by_key(|&&(_, id)| self.link_rank(id)).unwrap().1;
                    let rest: Vec<(u128, u32)> = run.iter().copied().filter(|&(_, id)| id != best).collect();
                    self.link_ids.insert(file_id, best);
                    for &(_, dup) in &rest {
                        self.make_link(dup, best);
                    }
                    self.link_groups.insert(best, LinkGroup { file_id, others: rest.iter().map(|&(_, d)| d).collect() });
                    continue;
                }
                None => continue,
            };
            self.link_ids.insert(file_id, primary);
            for &(_, dup) in others {
                self.make_link(dup, primary);
            }
            self.link_groups
                .entry(primary)
                .or_insert(LinkGroup { file_id, others: Vec::new() })
                .others
                .extend(others.iter().map(|&(_, d)| d));
        }
    }

    /// Which of a hard-linked file's names carries its size: the one fewest
    /// folders down, then the first by path (ignoring case). An explicit rule,
    /// so a full scan, a file-table scan and a refreshed folder all agree.
    fn link_rank(&self, id: u32) -> (usize, Vec<String>) {
        let mut names = Vec::new();
        let mut cur = id;
        while cur != 0 && cur != NO_PARENT {
            names.push(self.name(cur).to_uppercase());
            cur = self.nodes[cur as usize].parent;
        }
        names.reverse();
        (names.len(), names)
    }

    /// After `copy` was replaced on disk by a hard link to `keep`'s data
    /// (`file_id`): counts the data once, under whichever name a rescan would.
    /// Returns the bytes on disk this freed.
    pub fn link_copy(&mut self, keep: u32, copy: u32, file_id: u128) -> u64 {
        let freed = self.nodes[copy as usize].allocated;
        let run = if self.link_ids.contains_key(&file_id) { vec![(file_id, copy)] } else { vec![(file_id, keep), (file_id, copy)] };
        self.dedupe(run);
        for id in [keep, copy] {
            let parent = self.nodes[id as usize].parent;
            if parent != NO_PARENT {
                self.sort_children(parent);
            }
        }
        freed
    }

    /// Moves the counting of a hard-linked file's data from `old`, its counted
    /// name, to `new`, a file with the same data that isn't a link yet.
    fn hand_over(&mut self, old: u32, new: u32, file_id: u128) {
        let mut group = self.link_groups.remove(&old).unwrap_or(LinkGroup { file_id, others: Vec::new() });
        self.make_link(old, new);
        for &o in &group.others {
            self.hardlinks.insert(o, new);
        }
        group.others.push(old);
        self.link_ids.insert(file_id, new);
        self.link_groups.insert(new, group);
    }

    /// Turns `dup` into a zero-size name for `primary`'s data.
    fn make_link(&mut self, dup: u32, primary: u32) {
        let online = self.online(dup);
        let n = &mut self.nodes[dup as usize];
        let (logical, allocated) = (n.logical, n.allocated);
        n.logical = 0;
        n.allocated = 0;
        n.kind = Kind::Hardlink;
        self.online.remove(&dup);
        bump(&mut self.linked, dup, logical, 0);
        self.adjust_ancestors(dup, 0, logical, 0, allocated, 0, online, logical, 0);
        self.hardlinks.insert(dup, primary);
    }

    /// Adds to and takes from the sizes of every folder above `id`.
    #[allow(clippy::too_many_arguments)]
    fn adjust_ancestors(
        &mut self,
        id: u32,
        add_logical: u64,
        sub_logical: u64,
        add_allocated: u64,
        sub_allocated: u64,
        add_online: u64,
        sub_online: u64,
        add_linked: u64,
        sub_linked: u64,
    ) {
        let mut cur = self.nodes[id as usize].parent;
        while cur != NO_PARENT {
            let a = &mut self.nodes[cur as usize];
            a.logical = (a.logical + add_logical).saturating_sub(sub_logical);
            a.allocated = (a.allocated + add_allocated).saturating_sub(sub_allocated);
            let parent = a.parent;
            bump(&mut self.online, cur, add_online, sub_online);
            bump(&mut self.linked, cur, add_linked, sub_linked);
            cur = parent;
        }
    }

    pub fn name(&self, id: u32) -> &str {
        self.name_of(&self.nodes[id as usize])
    }

    pub fn name_of(&self, n: &Node) -> &str {
        &self.names[n.name_at as usize..n.name_at as usize + n.name_len as usize]
    }

    /// Logical bytes of online-only cloud files at or under `id`.
    /// Live children of `id`, ignoring any filter.
    pub fn live_children(&self, id: u32) -> impl Iterator<Item = u32> + '_ {
        let node = &self.nodes[id as usize];
        let range = node.first as usize..(node.first + node.count) as usize;
        self.links[range].iter().copied().filter(|&c| self.nodes[c as usize].kind != Kind::Deleted)
    }

    /// For any name of hard-linked data: the data's file ID and the name it's counted under.
    pub fn link_of(&self, id: u32) -> Option<(u128, u32)> {
        if let Some(&primary) = self.hardlinks.get(&id) {
            return self.link_groups.get(&primary).map(|g| (g.file_id, primary));
        }
        self.link_groups.get(&id).map(|g| (g.file_id, id))
    }

    /// When a big file was last opened, if known.
    pub fn accessed(&self, id: u32) -> Option<i64> {
        self.accessed.get(&id).copied()
    }

    pub fn online(&self, id: u32) -> u64 {
        self.online.get(&id).copied().unwrap_or(0)
    }

    /// Logical bytes of hard links at or under `id` counted under another name.
    pub fn linked(&self, id: u32) -> u64 {
        self.linked.get(&id).copied().unwrap_or(0)
    }

    /// Switches the size mode and re-sorts every folder to match.
    pub fn set_mode(&mut self, mode: SizeMode) {
        if self.mode != mode {
            self.mode = mode;
            self.sort_all();
            self.refilter();
        }
    }

    /// Turns the filter on, or off for an empty query.
    pub fn set_filter(&mut self, query: Query) {
        self.filter = None;
        if !query.is_empty() {
            self.filter = Some(Filter::build(self, query));
        }
    }

    /// Rebuilds the filter after sizes or the tree changed. Call once after a
    /// batch of `remove`s rather than after each one.
    pub fn refilter(&mut self) {
        if let Some(f) = self.filter.take() {
            self.set_filter(f.query);
        }
    }

    fn sort_all(&mut self) {
        let mode = self.mode;
        let Tree { nodes, links, .. } = self;
        let nodes: &Vec<Node> = nodes;
        for n in nodes.iter().filter(|n| n.count > 1 && n.kind != Kind::Deleted) {
            let range = n.first as usize..(n.first + n.count) as usize;
            links[range].sort_unstable_by_key(|&c| Reverse(nodes[c as usize].size(mode)));
        }
    }

    fn sort_children(&mut self, id: u32) {
        let mode = self.mode;
        let n = &self.nodes[id as usize];
        let range = n.first as usize..(n.first + n.count) as usize;
        let nodes = &self.nodes;
        self.links[range].sort_by_key(|&c| Reverse(nodes[c as usize].size(mode)));
    }

    /// The size every query reports: the matching size while a filter is on.
    fn size(&self, id: u32) -> u64 {
        match &self.filter {
            Some(f) => f.sizes[id as usize],
            None => self.node_size(id),
        }
    }

    /// The real size in the current mode, ignoring any filter.
    pub fn node_size(&self, id: u32) -> u64 {
        self.nodes[id as usize].size(self.mode)
    }

    /// Hidden by the filter: nothing under it matches.
    fn filtered_out(&self, id: u32) -> bool {
        self.filter.as_ref().is_some_and(|f| f.counts[id as usize] == 0)
    }

    pub fn get(&self, id: u32) -> Option<&Node> {
        self.nodes.get(id as usize)
    }

    fn children(&self, id: u32) -> impl Iterator<Item = u32> + '_ {
        let node = &self.nodes[id as usize];
        let range = node.first as usize..(node.first + node.count) as usize;
        self.links[range]
            .iter()
            .copied()
            .filter(|&c| self.nodes[c as usize].kind != Kind::Deleted && !self.filtered_out(c))
    }

    pub fn entry(&self, id: u32) -> Entry {
        let n = &self.nodes[id as usize];
        Entry {
            id,
            name: self.name_of(n).to_string(),
            size: self.size(id),
            logical: n.logical,
            allocated: n.allocated,
            online: self.online(id),
            linked: self.linked(id),
            files: n.files as u64,
            dirs: n.dirs as u64,
            modified: n.modified,
            kind: n.kind,
            has_children: self.children(id).next().is_some(),
        }
    }

    pub fn path(&self, id: u32) -> PathBuf {
        let mut names = Vec::new();
        let mut cur = id;
        while cur != 0 && cur != NO_PARENT {
            let n = &self.nodes[cur as usize];
            names.push(self.name_of(n));
            cur = n.parent;
        }
        let mut path = self.root_path.clone();
        for name in names.into_iter().rev() {
            path.push(name);
        }
        path
    }

    pub fn list(&self, id: u32) -> Vec<Entry> {
        let mut entries: Vec<Entry> = self.children(id).map(|c| self.entry(c)).collect();
        if self.filter.is_some() {
            // Children are kept sorted by real size; matching sizes can order differently.
            entries.sort_by_key(|e| Reverse(e.size));
        }
        entries
    }

    pub fn info(&self, id: u32) -> NodeInfo {
        let mut ancestors = Vec::new();
        let mut cur = id;
        while cur != NO_PARENT {
            ancestors.push(Crumb { id: cur, name: self.name(cur).to_string() });
            cur = self.nodes[cur as usize].parent;
        }
        ancestors.reverse();
        let parent = self.nodes[id as usize].parent;
        NodeInfo {
            entry: self.entry(id),
            path: self.path(id).to_string_lossy().into_owned(),
            ancestors,
            parent_size: if parent == NO_PARENT { 0 } else { self.size(parent) },
            root_size: self.size(0),
            link_target: self.hardlinks.get(&id).map(|&t| {
                let n = &self.nodes[t as usize];
                LinkTarget {
                    id: t,
                    path: self.path(t).to_string_lossy().into_owned(),
                    logical: n.logical,
                    allocated: n.allocated,
                }
            }),
        }
    }

    /// The subtree under `id`, down to `max_depth` levels, leaving out
    /// anything smaller than `min_size` (rolled into each folder's `rest`).
    pub fn map(&self, id: u32, max_depth: u32, min_size: u64) -> MapNode {
        let n = &self.nodes[id as usize];
        let mut out = MapNode {
            id,
            name: self.name_of(n).to_string(),
            size: self.size(id),
            kind: n.kind,
            online: n.kind == Kind::File && self.online(id) > 0,
            modified: n.modified,
            children: Vec::new(),
            rest: 0,
            rest_count: 0,
        };
        if max_depth == 0 {
            return out;
        }
        for c in self.children(id) {
            let size = self.size(c);
            if size == 0 {
                continue;
            }
            if size < min_size {
                out.rest += size;
                out.rest_count += 1;
            } else {
                out.children.push(self.map(c, max_depth - 1, min_size));
            }
        }
        out
    }

    /// What recycling every match of the filter means: whole folders where
    /// everything in them matches (and nothing in them went unread), the
    /// matching files themselves everywhere else. Never anything that doesn't match.
    pub fn select_matches(&self) -> Vec<u32> {
        let Some(f) = &self.filter else { return Vec::new() };
        // Folders holding something whose contents the scan doesn't know.
        let mut opaque = vec![false; self.nodes.len()];
        for i in (1..self.nodes.len()).rev() {
            let n = &self.nodes[i];
            if n.kind == Kind::Deleted {
                continue;
            }
            if opaque[i] || matches!(n.kind, Kind::Denied | Kind::Excluded) {
                opaque[n.parent as usize] = true;
            }
        }
        let whole = |id: u32| {
            let n = &self.nodes[id as usize];
            match n.kind {
                Kind::File => true,
                Kind::Dir => !opaque[id as usize] && f.counts[id as usize] == n.files,
                _ => false,
            }
        };
        let mut out = Vec::new();
        let mut stack: Vec<u32> = f.hits.iter().rev().copied().collect();
        while let Some(id) = stack.pop() {
            if f.counts[id as usize] == 0 {
                continue;
            }
            if whole(id) {
                out.push(id);
            } else {
                stack.extend(self.children(id));
            }
        }
        out
    }

    /// Visits every file under `id`; while a filter is on, only matching ones.
    fn walk_files(&self, id: u32, mut visit: impl FnMut(u32, &Node)) {
        let mut stack = vec![id];
        while let Some(cur) = stack.pop() {
            let n = &self.nodes[cur as usize];
            match n.kind {
                Kind::File => visit(cur, n),
                Kind::Dir => stack.extend(self.children(cur)),
                _ => {}
            }
        }
    }

    pub fn extensions(&self, id: u32, limit: usize) -> Vec<ExtStat> {
        let mut map: HashMap<String, (u64, u64)> = HashMap::new();
        self.walk_files(id, |fid, n| {
            let slot = map.entry(crate::filter::extension(self.name_of(n))).or_default();
            slot.0 += self.size(fid);
            slot.1 += 1;
        });
        let mut stats: Vec<ExtStat> = map
            .into_iter()
            .map(|(ext, (bytes, count))| ExtStat { ext, bytes, count })
            .collect();
        stats.sort_unstable_by(|a, b| b.bytes.cmp(&a.bytes));
        // 0 means all of them, for exact per-category totals.
        if limit > 0 {
            stats.truncate(limit);
        }
        stats
    }

    /// The node at `path`, matching names the way Windows does (ignoring
    /// case). Used to find the same folder again after a rescan.
    pub fn find(&self, path: &std::path::Path) -> Option<u32> {
        let full = path.to_string_lossy().to_lowercase();
        let root = self.root_path.to_string_lossy().to_lowercase();
        let rest = full.strip_prefix(root.trim_end_matches(['\\', '/']))?;
        // "C:\Users\nico2" must not match a scan of "C:\Users\nico".
        if !(rest.is_empty() || rest.starts_with(['\\', '/'])) {
            return None;
        }
        let mut cur = 0u32;
        for name in rest.split(['\\', '/']).filter(|s| !s.is_empty()) {
            let n = &self.nodes[cur as usize];
            cur = self.links[n.first as usize..(n.first + n.count) as usize]
                .iter()
                .copied()
                .find(|&c| {
                    let child = &self.nodes[c as usize];
                    child.kind != Kind::Deleted && self.name_of(child).to_lowercase() == name
                })?;
        }
        Some(cur)
    }

    pub fn largest(&self, id: u32, limit: usize) -> Vec<FileHit> {
        let mut heap: BinaryHeap<Reverse<(u64, u32)>> = BinaryHeap::with_capacity(limit + 1);
        self.walk_files(id, |fid, _| {
            let size = self.size(fid);
            if heap.len() < limit {
                heap.push(Reverse((size, fid)));
            } else if heap.peek().is_some_and(|Reverse((s, _))| size > *s) {
                heap.pop();
                heap.push(Reverse((size, fid)));
            }
        });
        let mut hits: Vec<(u64, u32)> = heap.into_iter().map(|Reverse(x)| x).collect();
        hits.sort_unstable_by(|a, b| b.0.cmp(&a.0));
        hits.into_iter()
            .map(|(size, fid)| {
                let n = &self.nodes[fid as usize];
                FileHit {
                    id: fid,
                    name: self.name_of(n).to_string(),
                    path: self.path(fid).to_string_lossy().into_owned(),
                    size,
                    modified: n.modified,
                    online: self.online(fid) > 0,
                }
            })
            .collect()
    }

    /// Files under `id` of at least `min_size` bytes that share their exact
    /// size with another: the only ones that can be duplicates. Online-only
    /// files are left out (reading them would download them), and so are
    /// hard links, which are the same data rather than copies of it.
    /// While a filter is on, only matching files are considered.
    pub fn dup_candidates(&self, id: u32, min_size: u64) -> Vec<crate::dupes::Candidate> {
        let mut sized: Vec<(u64, u32)> = Vec::new();
        self.walk_files(id, |fid, n| {
            if n.logical >= min_size.max(1) && self.online(fid) == 0 {
                sized.push((n.logical, fid));
            }
        });
        sized.sort_unstable();
        let mut out = Vec::new();
        for run in sized.chunk_by(|a, b| a.0 == b.0).filter(|run| run.len() > 1) {
            for &(size, fid) in run {
                out.push(crate::dupes::Candidate {
                    id: fid,
                    path: self.path(fid),
                    size,
                    modified: self.nodes[fid as usize].modified,
                });
            }
        }
        out
    }

    /// Folders in the scan that couldn't be read.
    pub fn denied_count(&self) -> u64 {
        (0..self.nodes.len() as u32)
            .filter(|&id| self.nodes[id as usize].kind == Kind::Denied && !self.is_gone(id))
            .count() as u64
    }

    /// `id` itself or something above it was removed.
    fn is_gone(&self, id: u32) -> bool {
        let mut cur = id;
        while cur != NO_PARENT {
            let n = &self.nodes[cur as usize];
            if n.kind == Kind::Deleted {
                return true;
            }
            cur = n.parent;
        }
        false
    }

    /// `id` is one of `set`, or inside one of them.
    pub fn is_within(&self, id: u32, set: &HashSet<u32>) -> bool {
        let mut cur = id;
        while cur != NO_PARENT {
            if set.contains(&cur) {
                return true;
            }
            cur = self.nodes[cur as usize].parent;
        }
        false
    }

    /// Before the nodes in `going` (and everything inside them) disappear:
    /// hard links among them leave their groups, and a counted name among
    /// them hands its data to a name that stays, since the data stays on the
    /// drive while any name does. Returns the bytes on disk handed over.
    fn release_links(&mut self, going: &HashSet<u32>) -> u64 {
        if self.hardlinks.is_empty() || going.is_empty() {
            return 0;
        }
        let leaving: Vec<u32> = self.hardlinks.keys().copied().filter(|&d| self.is_within(d, going)).collect();
        for d in leaving {
            if let Some(p) = self.hardlinks.remove(&d) {
                if let Some(g) = self.link_groups.get_mut(&p) {
                    g.others.retain(|&x| x != d);
                }
            }
        }

        let primaries: Vec<u32> = self.link_groups.keys().copied().filter(|&p| self.is_within(p, going)).collect();
        let mut kept = 0;
        for p in primaries {
            let Some(group) = self.link_groups.remove(&p) else { continue };
            let alive: Vec<u32> = group.others.into_iter().filter(|&m| !self.is_gone(m)).collect();
            let mut alive = alive;
            alive.sort_by_cached_key(|&m| self.link_rank(m));
            let Some((&heir, rest)) = alive.split_first() else {
                self.link_ids.remove(&group.file_id);
                for m in alive {
                    self.hardlinks.remove(&m);
                }
                continue;
            };
            let (logical, allocated) = (self.nodes[p as usize].logical, self.nodes[p as usize].allocated);
            let online = self.online(p);
            let n = &mut self.nodes[heir as usize];
            n.logical = logical;
            n.allocated = allocated;
            n.kind = Kind::File;
            bump(&mut self.online, heir, online, 0);
            self.linked.remove(&heir);
            self.adjust_ancestors(heir, logical, 0, allocated, 0, online, 0, 0, logical);
            self.hardlinks.remove(&heir);
            for &r in rest {
                self.hardlinks.insert(r, heir);
            }
            self.link_ids.insert(group.file_id, heir);
            if !rest.is_empty() {
                self.link_groups.insert(heir, LinkGroup { file_id: group.file_id, others: rest.to_vec() });
            }
            kept += allocated;
        }
        // Folders above an heir grew back; keep them in order.
        self.sort_all();
        kept
    }

    /// Marks a node as gone and takes its sizes off every folder above it.
    /// Returns the bytes on disk this frees.
    pub fn remove(&mut self, id: u32) -> u64 {
        self.remove_many(&[id])
    }

    /// Removes several nodes at once (some may be inside others). Returns the
    /// bytes on disk this frees: hard-linked data that still has a name
    /// elsewhere isn't freed.
    pub fn remove_many(&mut self, ids: &[u32]) -> u64 {
        let going: HashSet<u32> = ids
            .iter()
            .copied()
            .filter(|&id| id != 0 && (id as usize) < self.nodes.len() && !self.is_gone(id))
            .collect();
        let kept = self.release_links(&going);
        let mut freed = 0;
        for &id in &going {
            if !self.is_gone(id) {
                freed += self.detach(id);
            }
        }
        freed.saturating_sub(kept)
    }

    fn detach(&mut self, id: u32) -> u64 {
        let (logical, allocated, files, dirs) = {
            let n = &self.nodes[id as usize];
            let is_dir = matches!(n.kind, Kind::Dir | Kind::Denied);
            let files = if is_dir { n.files } else { 1 };
            let dirs = if is_dir { n.dirs + 1 } else { 0 };
            (n.logical, n.allocated, files, dirs)
        };
        let (online, linked) = (self.online(id), self.linked(id));
        self.nodes[id as usize].kind = Kind::Deleted;
        self.adjust_ancestors(id, 0, logical, 0, allocated, 0, online, 0, linked);
        let mut cur = self.nodes[id as usize].parent;
        while cur != NO_PARENT {
            let n = &mut self.nodes[cur as usize];
            n.files = n.files.saturating_sub(files);
            n.dirs = n.dirs.saturating_sub(dirs);
            let parent = n.parent;
            // Keep siblings largest first now that one of them shrank.
            self.sort_children(cur);
            cur = parent;
        }
        allocated
    }

    /// Replaces everything under folder `id` with a fresh scan of it, and
    /// updates the folders above. The old entries stay in the arrays, marked
    /// deleted and out of reach, until the next full scan.
    pub fn replace_children(&mut self, id: u32, raw: Raw, dedupe_links: bool) {
        // Links among the old entries leave their groups first.
        let old_children: Vec<u32> = {
            let n = &self.nodes[id as usize];
            self.links[n.first as usize..(n.first + n.count) as usize].to_vec()
        };
        let going: HashSet<u32> = old_children.iter().copied().collect();
        self.release_links(&going);
        for &c in &old_children {
            self.nodes[c as usize].kind = Kind::Deleted;
        }

        let (old_logical, old_allocated, old_files, old_dirs) = {
            let n = &self.nodes[id as usize];
            (n.logical, n.allocated, n.files, n.dirs)
        };
        let (old_online, old_linked) = (self.online(id), self.linked(id));
        self.adjust_ancestors(id, raw.logical, old_logical, raw.allocated, old_allocated, raw.online, old_online, 0, old_linked);
        let (new_files, new_dirs) = (raw.files.min(u32::MAX as u64) as u32, raw.dirs.min(u32::MAX as u64) as u32);
        let mut cur = self.nodes[id as usize].parent;
        while cur != NO_PARENT {
            let n = &mut self.nodes[cur as usize];
            n.files = (n.files + new_files).saturating_sub(old_files);
            n.dirs = (n.dirs + new_dirs).saturating_sub(old_dirs);
            cur = n.parent;
        }
        {
            let n = &mut self.nodes[id as usize];
            n.logical = raw.logical;
            n.allocated = raw.allocated;
            n.files = new_files;
            n.dirs = new_dirs;
            n.modified = raw.modified;
            n.kind = raw.kind;
        }
        self.online.remove(&id);
        self.linked.remove(&id);
        if raw.online > 0 {
            self.online.insert(id, raw.online);
        }

        let ids = self.append_children(raw, id, dedupe_links);
        self.dedupe(ids);
        self.sort_all();
        self.refilter();
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::scan::{scan, Excludes, Progress};
    use std::fs;

    fn sample(name: &str) -> (PathBuf, Tree) {
        let root = std::env::temp_dir().join(format!("disk-studio-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("big/inner")).unwrap();
        fs::create_dir_all(root.join("small")).unwrap();
        fs::write(root.join("big/video.mp4"), vec![1u8; 5000]).unwrap();
        fs::write(root.join("big/inner/a.log"), vec![1u8; 3000]).unwrap();
        fs::write(root.join("small/note.txt"), vec![1u8; 10]).unwrap();
        fs::write(root.join("top.txt"), vec![1u8; 100]).unwrap();
        let raw = scan(&root, &Progress::default(), &Excludes::default()).unwrap();
        let tree = Tree::from_raw(root.clone(), raw, SizeMode::Logical, true);
        (root, tree)
    }

    fn find(tree: &Tree, name: &str) -> u32 {
        (0..tree.nodes.len() as u32)
            .find(|&i| tree.name(i) == name && tree.nodes[i as usize].kind != Kind::Deleted)
            .unwrap()
    }

    #[test]
    fn nodes_stay_small() {
        assert_eq!(std::mem::size_of::<Node>(), 56);
    }

    #[test]
    fn hard_links_count_once() {
        let root = std::env::temp_dir().join(format!("disk-studio-links-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("a/deeper")).unwrap();
        fs::create_dir_all(root.join("b")).unwrap();
        fs::write(root.join("a/deeper/data.bin"), vec![1u8; 20_000]).unwrap();
        fs::hard_link(root.join("a/deeper/data.bin"), root.join("b/copy.bin")).unwrap();
        fs::hard_link(root.join("a/deeper/data.bin"), root.join("top.bin")).unwrap();

        let raw = scan(&root, &Progress::default(), &Excludes::default()).unwrap();
        let tree = Tree::from_raw(root.clone(), raw, SizeMode::Logical, true);
        let r = tree.entry(0);
        assert_eq!(r.logical, 20_000, "the data is counted once");
        assert_eq!(r.linked, 40_000, "the two other names are reported as linked");
        assert_eq!(r.files, 3);

        // The shallowest name keeps the size; the others point at it.
        let top = find(&tree, "top.bin");
        assert_eq!(tree.entry(top).kind, Kind::File);
        assert_eq!(tree.entry(top).logical, 20_000);
        for name in ["copy.bin", "data.bin"] {
            let id = find(&tree, name);
            assert_eq!(tree.entry(id).kind, Kind::Hardlink);
            assert_eq!(tree.entry(id).size, 0);
            assert_eq!(tree.info(id).link_target.unwrap().id, top);
        }
        assert_eq!(tree.entry(find(&tree, "a")).logical, 0);
        assert_eq!(tree.entry(find(&tree, "a")).linked, 20_000);
        assert_eq!(tree.largest(0, 10).len(), 1);

        // Without deduping (e.g. on FAT), every name counts.
        let raw = scan(&root, &Progress::default(), &Excludes::default()).unwrap();
        let plain = Tree::from_raw(root.clone(), raw, SizeMode::Logical, false);
        assert_eq!(plain.entry(0).logical, 60_000);

        fs::remove_dir_all(root).unwrap();
    }

    fn linked_sample() -> Tree {
        use crate::scan::{test_file, test_folder};
        // One piece of data under three names; id 7 is shared.
        let raw = test_folder(
            "root",
            vec![
                test_file("top.bin", 20_000, 7, false),
                test_folder("a", vec![test_folder("deeper", vec![test_file("data.bin", 20_000, 7, false)])]),
                test_folder("b", vec![test_file("copy.bin", 20_000, 7, false), test_file("own.txt", 500, 8, false)]),
            ],
        );
        Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true)
    }

    #[test]
    fn recycling_the_counted_name_promotes_another() {
        let mut tree = linked_sample();
        assert_eq!(tree.entry(0).logical, 20_500);
        let top = find(&tree, "top.bin");

        // The data has other names, so nothing is freed and the total stays.
        let freed = tree.remove(top);
        assert_eq!(freed, 0, "the data is still on the drive under two names");
        assert_eq!(tree.entry(0).logical, 20_500);
        assert_eq!(tree.entry(0).linked, 20_000);

        // The lowest remaining id ("data.bin" or "copy.bin", whichever came first) now carries it.
        let data = find(&tree, "data.bin");
        let copy = find(&tree, "copy.bin");
        let heir = data.min(copy);
        let other = data.max(copy);
        assert_eq!(tree.entry(heir).kind, Kind::File);
        assert_eq!(tree.entry(heir).logical, 20_000);
        assert_eq!(tree.entry(heir).linked, 0);
        assert_eq!(tree.entry(other).kind, Kind::Hardlink);
        assert_eq!(tree.info(other).link_target.unwrap().id, heir);

        // Recycling the last two names frees the data.
        let freed = tree.remove_many(&[heir, other]);
        assert_eq!(freed, 20_480, "five 4 KB clusters");
        assert_eq!(tree.entry(0).logical, 500);
        assert_eq!(tree.entry(0).linked, 0);
        assert!(tree.hardlinks.is_empty());
    }

    #[test]
    fn recycling_a_folder_with_the_counted_name_inside() {
        let mut tree = linked_sample();
        // Recycle "b" and "top.bin" together: only data.bin is left to carry the data.
        let b = find(&tree, "b");
        let top = find(&tree, "top.bin");
        tree.remove_many(&[b, top]);
        let data = find(&tree, "data.bin");
        assert_eq!(tree.entry(data).kind, Kind::File);
        assert_eq!(tree.entry(0).logical, 20_000);
        assert_eq!(tree.entry(0).linked, 0);
        assert_eq!(tree.entry(find(&tree, "a")).logical, 20_000);
        assert!(tree.hardlinks.is_empty());
    }

    #[test]
    fn refreshing_a_folder_updates_it_in_place() {
        use crate::scan::{test_file, test_folder};
        let mut tree = linked_sample();
        let b = find(&tree, "b");
        let before = tree.nodes.len();

        // "b" now holds the shared data (still linked) and a new, bigger file.
        let fresh = test_folder("b", vec![test_file("copy.bin", 20_000, 7, false), test_file("new.iso", 90_000, 9, false)]);
        tree.replace_children(b, fresh, true);

        assert_eq!(tree.entry(0).logical, 110_000, "20,000 shared + 90,000 new");
        assert_eq!(tree.entry(0).files, 4);
        assert_eq!(tree.entry(b).logical, 90_000);
        assert_eq!(tree.entry(b).files, 2);
        let copy = find(&tree, "copy.bin");
        assert!(copy as usize >= before, "new entries are appended");
        assert_eq!(tree.entry(copy).kind, Kind::Hardlink, "joins the group it was in");
        assert_eq!(tree.info(copy).link_target.unwrap().id, find(&tree, "top.bin"));
        let names: Vec<String> = tree.list(b).into_iter().map(|e| e.name).collect();
        assert_eq!(names, ["new.iso", "copy.bin"]);
        assert_eq!(tree.list(0)[0].name, "b", "the folder moved up among its siblings");
        assert!(tree.find(std::path::Path::new("C:\\root\\b\\own.txt")).is_none());

        // The filter and junk finder only see the live entries.
        tree.set_filter(Query { text: "own".into(), ..Default::default() });
        assert_eq!(tree.filter.as_ref().unwrap().counts[0], 0);
        tree.set_filter(Query::default());
        assert!(crate::junk::find(&tree, 0, &[]).is_empty());
    }

    #[test]
    fn refreshing_keeps_the_shallowest_name_counted() {
        use crate::scan::{test_file, test_folder};
        let raw = test_folder(
            "root",
            vec![
                test_folder("x", vec![test_folder("y", vec![test_folder("z", vec![test_file("f.bin", 20_000, 7, false)])])]),
                test_folder("b", vec![test_file("g.bin", 20_000, 7, false)]),
            ],
        );
        let mut tree = Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true);
        let b = find(&tree, "b");
        let x = find(&tree, "x");
        assert_eq!(tree.entry(b).logical, 20_000, "the shallower name counts");

        // Refreshing b: its new g.bin is still the shallower name, so it keeps the size.
        tree.replace_children(b, test_folder("b", vec![test_file("g.bin", 20_000, 7, false)]), true);
        assert_eq!(tree.entry(0).logical, 20_000);
        assert_eq!(tree.entry(b).logical, 20_000);
        assert_eq!(tree.entry(x).logical, 0);
        assert_eq!(tree.entry(x).linked, 20_000);
        let g = find(&tree, "g.bin");
        let f = find(&tree, "f.bin");
        assert_eq!(tree.entry(g).kind, Kind::File);
        assert_eq!(tree.info(f).link_target.unwrap().id, g);

        // And the data is freed only when both names go.
        assert_eq!(tree.remove(g), 0);
        assert_eq!(tree.entry(x).logical, 20_000);
        assert_eq!(tree.remove(f), 20_480);
        assert!(tree.hardlinks.is_empty());
    }

    #[test]
    fn equal_depth_links_count_under_the_first_path() {
        use crate::scan::{test_file, test_folder};
        // Listed with Windows first, as a file-table scan might: the path order still decides.
        let raw = test_folder(
            "C:\\",
            vec![
                test_folder("Windows", vec![test_file("a.dll", 9000, 9, false)]),
                test_folder("Program Files", vec![test_file("A.dll", 9000, 9, false)]),
            ],
        );
        let mut tree = Tree::from_raw("C:\\".into(), raw, SizeMode::Logical, true);
        let pf = find(&tree, "Program Files");
        let win = find(&tree, "Windows");
        assert_eq!((tree.entry(pf).logical, tree.entry(win).logical), (9000, 0));

        // Refreshing either folder leaves the count where it was.
        tree.replace_children(pf, test_folder("Program Files", vec![test_file("A.dll", 9000, 9, false)]), true);
        assert_eq!((tree.entry(pf).logical, tree.entry(win).logical), (9000, 0));
        tree.replace_children(win, test_folder("Windows", vec![test_file("a.dll", 9000, 9, false)]), true);
        assert_eq!((tree.entry(pf).logical, tree.entry(win).logical), (9000, 0));
    }

    /// Refreshes one folder of a real scan and checks every top-level folder
    /// keeps its size: `DISK_STUDIO_REFRESH="C:\|Program Files" cargo test --release refresh_matches -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn refresh_matches_a_full_scan() {
        let Ok(spec) = std::env::var("DISK_STUDIO_REFRESH") else { return };
        let (root, folder) = spec.split_once('|').unwrap();
        let raw = scan(std::path::Path::new(root), &Progress::default(), &Excludes::default()).unwrap();
        let mut tree = Tree::from_raw(root.into(), raw, SizeMode::Logical, true);
        let before: Vec<(String, u64)> = tree.list(0).into_iter().map(|e| (e.name, e.logical)).collect();
        let id = tree.find(&std::path::Path::new(root).join(folder)).unwrap();
        let started = std::time::Instant::now();
        let raw = scan(&tree.path(id), &Progress::default(), &Excludes::default()).unwrap();
        tree.replace_children(id, raw, true);
        println!("refreshed {folder} in {:?}", started.elapsed());
        let after: HashMap<String, u64> = tree.list(0).into_iter().map(|e| (e.name, e.logical)).collect();
        let mut moved = 0;
        for (name, size) in &before {
            let now = after[name];
            if now != *size {
                moved += 1;
                println!("  {name}: {size} -> {now} ({:+} bytes)", now as i64 - *size as i64);
            }
        }
        println!("{moved} top-level folders changed size");
    }

    #[test]
    fn online_only_bytes_roll_up() {
        use crate::scan::{test_file, test_folder};
        let raw = test_folder(
            "root",
            vec![
                test_folder("OneDrive", vec![test_file("cloud.mp4", 9_000_000, 1, true), test_file("local.jpg", 50_000, 2, false)]),
                test_file("other.txt", 1_000, 3, false),
            ],
        );
        let mut tree = Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true);
        let r = tree.entry(0);
        assert_eq!(r.online, 9_000_000);
        assert_eq!(r.logical, 9_051_000);
        let cloud = find(&tree, "cloud.mp4");
        assert!(tree.map(0, 4, 1).children[0].children.iter().any(|c| c.id == cloud && c.online));
        assert!(tree.largest(0, 1)[0].online);

        // On disk, the cloud file takes nothing and drops to the bottom.
        tree.set_mode(SizeMode::Allocated);
        let one = tree.list(find(&tree, "OneDrive"));
        assert_eq!(one[0].name, "local.jpg");

        tree.remove(cloud);
        assert_eq!(tree.entry(0).online, 0);
    }

    #[test]
    fn sizes_counts_and_queries() {
        let (root, mut tree) = sample("queries");
        let r = tree.entry(0);
        assert_eq!(r.size, 8110);
        assert_eq!(r.logical, 8110);
        assert_eq!(r.files, 4);
        assert_eq!(r.dirs, 3);

        // Children come largest first.
        let kids = tree.list(0);
        assert_eq!(kids[0].name, "big");
        assert_eq!(kids[0].size, 8000);
        assert!(kids.windows(2).all(|w| w[0].size >= w[1].size));

        let largest = tree.largest(0, 2);
        assert_eq!(largest[0].name, "video.mp4");
        assert_eq!(largest[1].name, "a.log");
        assert!(tree.path(largest[1].id).exists());

        let exts = tree.extensions(0, 10);
        assert_eq!(exts[0].ext, "mp4");
        assert_eq!(exts.iter().find(|e| e.ext == "txt").unwrap().count, 2);

        // Trimming rolls small children into `rest`.
        let map = tree.map(0, 4, 1000);
        assert_eq!(map.children.len(), 1);
        assert_eq!(map.rest, 110);

        // Removing a folder updates every size above it.
        let big = kids[0].id;
        let big_alloc = kids[0].allocated;
        let root_alloc = r.allocated;
        assert_eq!(tree.remove(big), big_alloc);
        assert_eq!(tree.entry(0).size, 110);
        assert_eq!(tree.entry(0).allocated, root_alloc - big_alloc);
        assert_eq!(tree.entry(0).files, 2);
        assert_eq!(tree.list(0)[0].name, "top.txt");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn size_on_disk() {
        let (root, mut tree) = sample("alloc");
        let video = tree.largest(0, 1).remove(0);
        let video = tree.entry(video.id);
        // 5000 bytes is too big to live inside the file record, so it takes whole clusters.
        assert!(video.allocated >= 5000, "allocated {}", video.allocated);
        assert_eq!(video.allocated % 512, 0);
        let folder_total: u64 = tree.list(0).iter().map(|e| e.allocated).sum();
        assert_eq!(tree.entry(0).allocated, folder_total);

        tree.set_mode(SizeMode::Allocated);
        assert_eq!(tree.entry(0).size, tree.entry(0).allocated);
        let kids = tree.list(0);
        assert!(kids.windows(2).all(|w| w[0].allocated >= w[1].allocated));
        assert_eq!(tree.largest(0, 1)[0].size, video.allocated);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn filter_by_text_type_and_size() {
        use crate::scan::{test_file, test_folder};
        let raw = test_folder(
            "root",
            vec![
                test_folder(
                    "app",
                    vec![
                        test_folder("node_modules", vec![test_file("lib.js", 4000, 1, false), test_file("big.wasm", 9000, 2, false)]),
                        test_file("main.js", 1000, 3, false),
                    ],
                ),
                test_folder("site", vec![test_folder("node_modules", vec![test_file("x.js", 500, 4, false)])]),
                test_file("movie.mp4", 50_000, 5, false),
                test_file("Node_Notes.txt", 300, 6, false),
            ],
        );
        let mut tree = Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true);
        let real_root = tree.entry(0).size;

        // Folder names match too, and everything inside a matching folder counts.
        tree.set_filter(Query { text: "NODE_".into(), ..Default::default() });
        let f = tree.filter.as_ref().unwrap();
        assert_eq!(f.counts[0], 4, "3 files in node_modules folders + Node_Notes.txt");
        assert_eq!(tree.entry(0).size, 13_800);
        let hits = f.summary(&tree, 10).hits;
        let names: Vec<_> = hits.iter().map(|h| h.name.as_str()).collect();
        assert_eq!(names, ["node_modules", "node_modules", "Node_Notes.txt"], "outermost matches, largest first");
        assert_eq!(hits[0].size, 13_000);
        assert_eq!(hits[0].files, 2);

        // Queries and the map only see matches.
        let app = tree.list(0)[0].id;
        assert_eq!(tree.list(0)[0].name, "app");
        assert_eq!(tree.list(app).len(), 1, "main.js is hidden");
        assert!(tree.largest(0, 10).iter().all(|h| h.name != "movie.mp4"));
        assert_eq!(tree.map(0, 5, 1).size, 13_800);

        // Type and size conditions apply to files.
        tree.set_filter(Query { text: "node_modules".into(), exts: vec!["js".into()], min_size: Some(1000), ..Default::default() });
        assert_eq!(tree.entry(0).size, 4000);
        assert_eq!(tree.filter.as_ref().unwrap().hits.len(), 1, "site/node_modules has nothing left");

        // Globs match whole names.
        tree.set_filter(Query { text: "*.mp4".into(), ..Default::default() });
        assert_eq!(tree.entry(0).size, 50_000);

        // Survives a size-mode switch, and an empty query clears it.
        tree.set_mode(SizeMode::Allocated);
        assert_eq!(tree.entry(0).size, 53_248, "50,000 bytes in 4 KB clusters");
        tree.set_filter(Query::default());
        assert!(tree.filter.is_none());
        tree.set_mode(SizeMode::Logical);
        assert_eq!(tree.entry(0).size, real_root);
    }

    #[test]
    fn filter_terms_exclusions_and_paths() {
        use crate::scan::{test_file, test_folder};
        let raw = test_folder(
            "root",
            vec![
                test_folder(
                    "Projects",
                    vec![
                        test_folder("site", vec![test_file("logo.psd", 7000, 1, false), test_file("build.log", 900, 2, false)]),
                        test_file("cover.psd", 3000, 3, false),
                        test_file("notes.txt", 200, 4, false),
                    ],
                ),
                test_folder("Photos", vec![test_file("cover.psd", 5000, 5, false), test_file("a.jpg", 800, 6, false)]),
                test_file("setup.log", 400, 7, false),
            ],
        );
        let mut tree = Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true);
        let total =|t: &Tree| t.entry(0).size;

        // Every term has to match, by the file's name or a folder above it.
        tree.set_filter(Query { text: "projects *.psd".into(), ..Default::default() });
        assert_eq!(total(&tree), 10_000);
        // `|` is either.
        tree.set_filter(Query { text: "*.psd|*.jpg".into(), ..Default::default() });
        assert_eq!(total(&tree), 15_800);
        // `-` leaves things out, folders with everything inside.
        tree.set_filter(Query { text: "*.psd -site".into(), ..Default::default() });
        assert_eq!(total(&tree), 8000);
        tree.set_filter(Query { text: "-*.log -photos".into(), ..Default::default() });
        assert_eq!(total(&tree), 10_200);
        // A backslash matches against the full path.
        tree.set_filter(Query { text: r"root\photos\".into(), ..Default::default() });
        assert_eq!(total(&tree), 5800);
        tree.set_filter(Query { text: "*/site/*.psd".into(), ..Default::default() });
        assert_eq!(total(&tree), 7000);
        // A path pattern matches from any folder down, without a leading `*`.
        tree.set_filter(Query { text: "projects/*.psd".into(), ..Default::default() });
        assert_eq!(total(&tree), 10_000);
        tree.set_filter(Query { text: r"\site\*.log".into(), ..Default::default() });
        assert_eq!(total(&tree), 900);
        tree.set_filter(Query { text: r"c:\root\photos\*".into(), ..Default::default() });
        assert_eq!(total(&tree), 5800, "from the drive");
        tree.set_filter(Query { text: r"c:\photos\*".into(), ..Default::default() });
        assert_eq!(total(&tree), 0, "a drive start is taken as written");
        // Each alternative is a path or a name on its own.
        tree.set_filter(Query { text: "photos/*.jpg|*.log".into(), ..Default::default() });
        assert_eq!(total(&tree), 2100);
        tree.set_filter(Query { text: "*.psd -projects/site".into(), ..Default::default() });
        assert_eq!(total(&tree), 8000);
        tree.set_filter(Query { text: "\"cover.psd\"".into(), ..Default::default() });
        assert_eq!(total(&tree), 8000, "quotes keep a term together");
        // "Other": extensions outside the given list.
        tree.set_filter(Query { other_than: vec!["psd".into(), "jpg".into()], ..Default::default() });
        assert_eq!(total(&tree), 1500, "the two logs and notes.txt");
        tree.set_filter(Query { exts: vec!["jpg".into()], other_than: vec!["psd".into(), "jpg".into(), "log".into()], ..Default::default() });
        assert_eq!(total(&tree), 1000, "a.jpg and notes.txt");
    }

    #[test]
    fn selecting_every_match_never_takes_what_doesnt_match() {
        use crate::scan::{test_file, test_folder};
        let raw = test_folder(
            "root",
            vec![
                test_folder("cache", vec![test_file("a.tmp", 100, 1, false), test_folder("deep", vec![test_file("b.tmp", 50, 2, false)])]),
                test_folder("mixed", vec![test_file("c.tmp", 30, 3, false), test_file("keep.doc", 999, 4, false)]),
                test_file("d.tmp", 10, 5, false),
            ],
        );
        let mut tree = Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true);
        let names =|t: &Tree, ids: Vec<u32>| {
            let mut v: Vec<String> = ids.iter().map(|&i| t.name(i).to_string()).collect();
            v.sort();
            v
        };
        tree.set_filter(Query { text: "*.tmp".into(), ..Default::default() });
        // Matches by file name: each file on its own, not the folders holding them.
        assert_eq!(names(&tree, tree.select_matches()), ["a.tmp", "b.tmp", "c.tmp", "d.tmp"]);
        // A folder that matches by name goes whole when everything in it matches.
        tree.set_filter(Query { text: "cache|mixed".into(), ..Default::default() });
        assert_eq!(names(&tree, tree.select_matches()), ["cache", "mixed"]);
        // With a size condition, only part of "mixed" matches: just that part goes.
        tree.set_filter(Query { text: "cache|mixed".into(), max_size: Some(500), ..Default::default() });
        assert_eq!(names(&tree, tree.select_matches()), ["c.tmp", "cache"]);
    }

    #[test]
    fn linking_a_duplicate_counts_its_data_once() {
        use crate::scan::{test_file, test_folder};
        let raw = test_folder(
            "root",
            vec![
                test_folder("a", vec![test_file("movie.mkv", 40_000, 1, false)]),
                test_folder("b", vec![test_folder("deep", vec![test_file("movie.mkv", 40_000, 2, false)])]),
                test_file("note.txt", 100, 3, false),
            ],
        );
        let mut tree = Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true);
        let before = tree.entry(0).size;
        let keep = tree.find(std::path::Path::new("C:\\root\\b\\deep\\movie.mkv")).unwrap();
        let copy = tree.find(std::path::Path::new("C:\\root\\a\\movie.mkv")).unwrap();

        // The deeper copy stays, but the shallower name is the one counted, as a rescan would.
        let freed = tree.link_copy(keep, copy, 77);
        assert_eq!(freed, 40_960, "the copy's clusters");
        assert_eq!(tree.entry(0).size, before - 40_000);
        assert_eq!(tree.entry(copy).kind, Kind::File, "the shallower name counts");
        assert_eq!(tree.entry(keep).kind, Kind::Hardlink);
        assert_eq!(tree.info(keep).link_target.unwrap().id, copy);
    }

    #[test]
    fn excluded_folders_are_left_out() {
        let root = std::env::temp_dir().join(format!("disk-studio-excl-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("keep")).unwrap();
        fs::create_dir_all(root.join("Skip/deep")).unwrap();
        fs::write(root.join("keep/a.bin"), vec![1u8; 4000]).unwrap();
        fs::write(root.join("Skip/deep/b.bin"), vec![1u8; 9000]).unwrap();

        // Different case and a trailing slash still match.
        let skip = format!("{}/", root.join("skip").to_string_lossy().to_uppercase());
        let progress = Progress::default();
        let raw = scan(&root, &progress, &Excludes::new([skip])).unwrap();
        let tree = Tree::from_raw(root.clone(), raw, SizeMode::Logical, true);

        assert_eq!(tree.entry(0).logical, 4000, "nothing under Skip is counted");
        assert_eq!(tree.entry(0).files, 1);
        assert_eq!(progress.excluded.load(std::sync::atomic::Ordering::Relaxed), 1);
        let skipped = tree.list(0).into_iter().find(|e| e.name == "Skip").unwrap();
        assert_eq!(skipped.kind, Kind::Excluded);
        assert!(!skipped.has_children);

        // Patterns skip every folder they match, at any depth.
        let by_name = Excludes::new(["DEEP".to_string()]);
        let raw = scan(&root, &Progress::default(), &by_name).unwrap();
        assert_eq!(Tree::from_raw(root.clone(), raw, SizeMode::Logical, true).entry(0).logical, 4000, "skip\\deep is skipped by name");
        let by_path = Excludes::new(["skip/deep".to_string(), "*.nothing".to_string()]);
        assert!(by_path.contains(&root.join("Skip").join("deep")));
        assert!(!by_path.contains(&root.join("keep").join("deep")), "a path pattern needs the folder above too");
        assert!(!Excludes::new(["keep".to_string()]).contains(&root.join("keeper")), "a name means the whole name");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn finds_paths_again_and_lists_every_extension() {
        use crate::scan::{test_file, test_folder};
        let mut files: Vec<_> = (0..250).map(|i| test_file(&format!("f.e{i}"), 10, i + 10, false)).collect();
        files.push(test_folder("Projects", vec![test_folder("Web", vec![test_file("a.js", 5, 1, false)])]));
        let raw = test_folder("root", files);
        let tree = Tree::from_raw("C:\\Users\\nico".into(), raw, SizeMode::Logical, true);

        assert_eq!(tree.extensions(0, 0).len(), 251, "0 = no limit");
        assert_eq!(tree.extensions(0, 10).len(), 10);

        let web = tree.find(std::path::Path::new("C:\\Users\\nico\\Projects\\Web")).unwrap();
        assert_eq!(tree.name(web), "Web");
        assert_eq!(tree.find(std::path::Path::new("c:\\users\\NICO\\projects\\web")), Some(web), "case doesn't matter");
        assert_eq!(tree.find(std::path::Path::new("C:\\Users\\nico")), Some(0));
        assert_eq!(tree.find(std::path::Path::new("C:\\Users\\nico\\Gone")), None);
        assert_eq!(tree.find(std::path::Path::new("D:\\elsewhere")), None);
    }

    #[test]
    fn dup_candidates_need_a_size_twin() {
        use crate::scan::{test_file, test_folder};
        let raw = test_folder(
            "root",
            vec![
                test_file("a.bin", 5000, 1, false),
                test_file("b.bin", 5000, 2, false),
                test_file("cloud.bin", 5000, 3, true),
                test_file("lonely.bin", 7000, 4, false),
                test_file("tiny.txt", 10, 5, false),
                test_file("tiny2.txt", 10, 6, false),
            ],
        );
        let tree = Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true);
        let mut names: Vec<_> = tree
            .dup_candidates(0, 100)
            .iter()
            .map(|c| c.path.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        names.sort();
        assert_eq!(names, ["a.bin", "b.bin"], "no online-only, no unique sizes, nothing under the minimum");
    }

    /// This process's (current, peak) memory in MB.
    #[cfg(windows)]
    pub fn memory_mb() -> (f64, f64) {
        use windows_sys::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
        use windows_sys::Win32::System::Threading::GetCurrentProcess;
        let mut c: PROCESS_MEMORY_COUNTERS = unsafe { std::mem::zeroed() };
        c.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
        unsafe { GetProcessMemoryInfo(GetCurrentProcess(), &mut c, c.cb) };
        let mb = |b: usize| b as f64 / (1024.0 * 1024.0);
        (mb(c.WorkingSetSize), mb(c.PeakWorkingSetSize))
    }

    #[cfg(not(windows))]
    pub fn memory_mb() -> (f64, f64) {
        (0.0, 0.0)
    }

    /// Times a real scan: `DISK_STUDIO_BENCH=C:\some\folder cargo test --release bench -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn bench() {
        let Ok(path) = std::env::var("DISK_STUDIO_BENCH") else { return };
        let started = std::time::Instant::now();
        let progress = Progress::default();
        let raw = scan(std::path::Path::new(&path), &progress, &Excludes::default()).unwrap();
        let scanned = started.elapsed();
        let (_, scan_peak_mb) = memory_mb();
        let tree = Tree::from_raw(path.into(), raw, SizeMode::Logical, true);
        let r = tree.entry(0);
        println!(
            "{} files, {} folders, {} skipped | size {:.2} GB, on disk {:.2} GB, online-only {:.2} GB, \
             hard links {} ({:.2} GB counted once) | scan {:?}, build {:?}",
            r.files,
            r.dirs,
            progress.errors.load(std::sync::atomic::Ordering::Relaxed),
            r.logical as f64 / 1e9,
            r.allocated as f64 / 1e9,
            r.online as f64 / 1e9,
            tree.hardlinks.len(),
            r.linked as f64 / 1e9,
            scanned,
            started.elapsed() - scanned,
        );
        let (now_mb, peak_mb) = memory_mb();
        println!(
            "memory: {now_mb:.0} MB holding the tree ({:.0} bytes per entry), {scan_peak_mb:.0} MB peak after the walk, \
             {peak_mb:.0} MB peak while building",
            now_mb * 1024.0 * 1024.0 / tree.nodes.len() as f64
        );

        let mut tree = tree;
        for text in ["node_modules", "*.mp4", "cache", "node_modules *.js -test", r"appdata\local\*.log", r"appdata\local\*.tmp -microsoft"] {
            let started = std::time::Instant::now();
            tree.set_filter(Query { text: text.into(), ..Default::default() });
            let f = tree.filter.as_ref().unwrap();
            println!(
                "filter {text:?}: {} files, {:.2} GB, {} outermost hits | {:?}",
                f.counts[0],
                f.sizes[0] as f64 / 1e9,
                f.hits.len(),
                started.elapsed()
            );
        }
        tree.set_filter(Query::default());

        let started = std::time::Instant::now();
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
        let junk = crate::junk::find(&tree, now, &[]);
        println!("junk finder: {:?}", started.elapsed());
        for c in &junk {
            println!("  {:<32} {:>5} items  {:>8.2} GB", c.label, c.total_items, c.total as f64 / 1e9);
        }
        // A snapshot of it, saved and read back.
        let file = std::env::temp_dir().join(format!("disk-studio-bench-{}.dss", std::process::id()));
        let started = std::time::Instant::now();
        let bytes = crate::snapshot::save(&tree, &crate::snapshot::Meta::of(&tree, now, false), &file).unwrap();
        let saved = started.elapsed();
        let started = std::time::Instant::now();
        let (back, _) = crate::snapshot::load(&file, tree.mode).unwrap();
        println!(
            "snapshot: {:.1} MB, saved in {:?}, read back in {:?}; same total: {}, same file count: {}",
            bytes as f64 / 1e6,
            saved,
            started.elapsed(),
            back.entry(0).logical == tree.entry(0).logical && back.entry(0).allocated == tree.entry(0).allocated,
            back.entry(0).files == tree.entry(0).files
        );
        let _ = std::fs::remove_file(file);
        let opened: Vec<i64> = tree.accessed.values().copied().collect();
        let year = 365 * 86_400_000;
        println!(
            "big files with a last-access time: {}, oldest {} days ago, {} not opened for a year",
            opened.len(),
            opened.iter().min().map_or(0, |&t| (now - t) / 86_400_000),
            opened.iter().filter(|&&t| now - t >= year).count()
        );

        // Duplicates of 1 MB and up: reads files, so only when asked.
        if std::env::var("DISK_STUDIO_BENCH_DUPES").is_err() {
            return;
        }
        let started = std::time::Instant::now();
        let cands = tree.dup_candidates(0, 1024 * 1024);
        let count = cands.len();
        let p = crate::dupes::Progress::default();
        let groups = crate::dupes::find(cands, &p, &crate::dupes::HashCache::default()).unwrap();
        let wasted: u64 = groups.iter().map(|g| g.size * (g.files.len() as u64 - 1)).sum();
        println!(
            "duplicates >= 1 MB: {count} candidates, {} groups, {:.2} GB wasted, {} unreadable, \
             {:.2} GB read | {:?}",
            groups.len(),
            wasted as f64 / 1e9,
            p.skipped.load(std::sync::atomic::Ordering::Relaxed),
            p.bytes_done.load(std::sync::atomic::Ordering::Relaxed) as f64 / 1e9,
            started.elapsed(),
        );
    }
}
