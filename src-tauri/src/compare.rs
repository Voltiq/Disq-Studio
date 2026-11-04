//! Compares the current scan with an earlier one (a snapshot): what grew,
//! what shrank, what is new and what is gone.
//!
//! Items are matched by path, case-insensitively, folder by folder. Sizes
//! are real sizes in the current size mode; any filter is ignored.

use serde::Serialize;
use std::collections::{HashMap, VecDeque};

use crate::tree::{Kind, Tree};

pub struct Compare {
    pub old: Tree,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffEntry {
    /// The item in the current scan; none when it's gone.
    pub id: Option<u32>,
    pub name: String,
    pub path: String,
    pub kind: Kind,
    /// None when it didn't exist then (new) or doesn't now (gone).
    pub before: Option<u64>,
    pub now: Option<u64>,
    pub files_before: u64,
    pub files_now: u64,
    /// A folder that exists in both, so it can be opened to see what changed inside.
    pub can_open: bool,
}

impl DiffEntry {
    fn change(&self) -> i128 {
        self.now.unwrap_or(0) as i128 - self.before.unwrap_or(0) as i128
    }
}

fn files(tree: &Tree, id: u32) -> u64 {
    let n = tree.get(id).expect("live node");
    if n.kind == Kind::File { 1 } else { n.files as u64 }
}

fn key(name: &str) -> String {
    name.to_lowercase()
}

/// The old scan's children of `old_id`, by lower-case name.
fn old_children(old: &Tree, old_id: u32) -> HashMap<String, u32> {
    old.live_children(old_id).map(|c| (key(old.name(c)), c)).collect()
}

impl Compare {
    /// The item in the old scan at the same path as `id` in the new one.
    pub fn old_of(&self, new: &Tree, id: u32) -> Option<u32> {
        self.old.find(&new.path(id))
    }

    /// The contents of folder `id`, with gone items mixed in, biggest change first.
    pub fn children(&self, new: &Tree, id: u32) -> Vec<DiffEntry> {
        let old_parent = self.old_of(new, id);
        let mut olds = old_parent.map(|p| old_children(&self.old, p)).unwrap_or_default();
        let mut out = Vec::new();
        for c in new.live_children(id) {
            let n = new.get(c).expect("live node");
            let matched = olds.remove(&key(new.name(c)));
            out.push(DiffEntry {
                id: Some(c),
                name: new.name(c).to_string(),
                path: new.path(c).to_string_lossy().into_owned(),
                kind: n.kind,
                before: matched.map(|o| self.old.node_size(o)),
                now: Some(new.node_size(c)),
                files_before: matched.map_or(0, |o| files(&self.old, o)),
                files_now: files(new, c),
                can_open: n.kind == Kind::Dir && matched.is_some_and(|o| self.old.get(o).is_some_and(|x| x.kind == Kind::Dir)),
            });
        }
        for (_, o) in olds {
            let n = self.old.get(o).expect("live node");
            out.push(DiffEntry {
                id: None,
                name: self.old.name(o).to_string(),
                path: self.old.path(o).to_string_lossy().into_owned(),
                kind: n.kind,
                before: Some(self.old.node_size(o)),
                now: None,
                files_before: files(&self.old, o),
                files_now: 0,
                can_open: false,
            });
        }
        out.sort_by_key(|e| std::cmp::Reverse(e.change().unsigned_abs()));
        out
    }

    /// Across the whole scan: the files that grew and shrank most, and the
    /// biggest items that are new or gone (outermost only: a new folder, not
    /// every file in it).
    pub fn top(&self, new: &Tree, limit: usize) -> Top {
        let mut grew = Vec::new();
        let mut shrank = Vec::new();
        let mut added = Vec::new();
        let mut removed = Vec::new();
        let mut queue = VecDeque::from([(0u32, 0u32)]);
        while let Some((nid, oid)) = queue.pop_front() {
            let mut olds = old_children(&self.old, oid);
            for c in new.live_children(nid) {
                let n = new.get(c).expect("live node");
                match olds.remove(&key(new.name(c))) {
                    None => added.push((new.node_size(c), c)),
                    Some(o) => {
                        let ok = self.old.get(o).expect("live node");
                        if n.kind == Kind::Dir && ok.kind == Kind::Dir {
                            queue.push_back((c, o));
                        } else if n.kind == Kind::File {
                            let (b, a) = (self.old.node_size(o), new.node_size(c));
                            if a > b {
                                grew.push((a - b, c, o));
                            } else if b > a {
                                shrank.push((b - a, c, o));
                            }
                        }
                    }
                }
            }
            removed.extend(olds.into_values().map(|o| (self.old.node_size(o), o)));
        }
        let take = |mut v: Vec<(u64, u32, u32)>| {
            v.sort_unstable_by_key(|x| std::cmp::Reverse(x.0));
            v.truncate(limit);
            v.into_iter().map(|(_, c, o)| self.entry(new, Some(c), Some(o))).collect()
        };
        let take2 = |mut v: Vec<(u64, u32)>, is_new: bool| -> Vec<DiffEntry> {
            v.sort_unstable_by_key(|x| std::cmp::Reverse(x.0));
            v.truncate(limit);
            v.into_iter()
                .map(|(_, id)| if is_new { self.entry(new, Some(id), None) } else { self.entry(new, None, Some(id)) })
                .collect()
        };
        Top { grew: take(grew), shrank: take(shrank), added: take2(added, true), removed: take2(removed, false) }
    }

    fn entry(&self, new: &Tree, c: Option<u32>, o: Option<u32>) -> DiffEntry {
        let (name, path, kind) = match (c, o) {
            (Some(c), _) => (new.name(c).to_string(), new.path(c), new.get(c).unwrap().kind),
            (None, Some(o)) => (self.old.name(o).to_string(), self.old.path(o), self.old.get(o).unwrap().kind),
            (None, None) => unreachable!(),
        };
        DiffEntry {
            id: c,
            name,
            path: path.to_string_lossy().into_owned(),
            kind,
            before: o.map(|o| self.old.node_size(o)),
            now: c.map(|c| new.node_size(c)),
            files_before: o.map_or(0, |o| files(&self.old, o)),
            files_now: c.map_or(0, |c| files(new, c)),
            can_open: false,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Top {
    pub grew: Vec<DiffEntry>,
    pub shrank: Vec<DiffEntry>,
    pub added: Vec<DiffEntry>,
    pub removed: Vec<DiffEntry>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scan::{test_file, test_folder};
    use crate::tree::SizeMode;

    #[test]
    fn finds_what_grew_shrank_came_and_went() {
        let before = test_folder(
            "root",
            vec![
                test_folder("Videos", vec![test_file("a.mp4", 1000, 1, false), test_file("old.mp4", 5000, 2, false)]),
                test_folder("Gone", vec![test_file("x", 700, 3, false)]),
                test_file("log.txt", 300, 4, false),
            ],
        );
        let after = test_folder(
            "root",
            vec![
                test_folder("videos", vec![test_file("a.mp4", 4000, 1, false), test_file("new.mp4", 2000, 5, false)]),
                test_folder("Fresh", vec![test_file("y", 900, 6, false)]),
                test_file("log.txt", 100, 4, false),
            ],
        );
        let c = Compare {
            old: Tree::from_raw("C:\\root".into(), before, SizeMode::Logical, true),
        };
        let new = Tree::from_raw("C:\\root".into(), after, SizeMode::Logical, true);

        let top = c.children(&new, 0);
        let summary: Vec<(String, Option<u64>, Option<u64>)> = top.iter().map(|e| (e.name.clone(), e.before, e.now)).collect();
        assert_eq!(
            summary,
            [
                ("Fresh".to_string(), None, Some(900)),
                ("Gone".to_string(), Some(700), None),
                ("log.txt".to_string(), Some(300), Some(100)),
                ("videos".to_string(), Some(6000), Some(6000)),
            ],
            "biggest change first; matched by name whatever the case"
        );
        assert!(top.iter().find(|e| e.name == "videos").unwrap().can_open);

        let t = c.top(&new, 10);
        let names = |v: &[DiffEntry]| v.iter().map(|e| e.name.clone()).collect::<Vec<_>>();
        assert_eq!(names(&t.grew), ["a.mp4"]);
        assert_eq!(names(&t.shrank), ["log.txt"]);
        assert_eq!(names(&t.added), ["new.mp4", "Fresh"]);
        assert_eq!(names(&t.removed), ["old.mp4", "Gone"]);
    }
}
