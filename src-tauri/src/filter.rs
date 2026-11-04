//! Search and filter over a scanned tree.
//!
//! A filter gives every node a "matching size": the bytes of matching files
//! at or under it. While a filter is on, the tree reports those sizes
//! instead of the real ones, so the treemap, lists and stats all show only
//! what matches, with no other code needing to know.
//!
//! The text is a list of terms separated by spaces ("quotes" keep spaces in
//! one). A file matches when every term matches its own name or the name of
//! a folder above it, so `node_modules *.js` finds JavaScript inside every
//! node_modules folder. `a|b` matches either. A term starting with `-`
//! leaves out what it matches, folders with everything inside. A term with
//! a `\` (or `/`) is matched against the full path instead of the name.
//! The other conditions (type, size, date) apply to files.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::tree::{Kind, Tree};

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Query {
    /// Terms: parts of names, or patterns with `*` and `?`. Case-insensitive.
    pub text: String,
    /// Extensions without the dot, lower case. Empty means any.
    pub exts: Vec<String>,
    /// Files whose extension is none of these also pass the type condition
    /// (the "Other" file type). Empty means unused.
    pub other_than: Vec<String>,
    pub min_size: Option<u64>,
    pub max_size: Option<u64>,
    /// Milliseconds since the Unix epoch.
    pub modified_after: Option<i64>,
    pub modified_before: Option<i64>,
}

impl Query {
    pub fn is_empty(&self) -> bool {
        self.text.trim().is_empty()
            && self.exts.is_empty()
            && self.other_than.is_empty()
            && self.min_size.is_none()
            && self.max_size.is_none()
            && self.modified_after.is_none()
            && self.modified_before.is_none()
    }
}

enum Pattern {
    Contains(String),
    /// Kept as text and as characters: plain ASCII names (most of them) are
    /// matched byte by byte, without collecting characters first.
    Glob(String, Vec<char>),
}

impl Pattern {
    /// `text` is already lower case.
    fn new(text: &str) -> Pattern {
        if text.contains(['*', '?']) {
            Pattern::Glob(text.to_string(), text.chars().collect())
        } else {
            Pattern::Contains(text.to_string())
        }
    }

    /// `name` is already lower case.
    fn matches(&self, name: &str) -> bool {
        match self {
            Pattern::Contains(part) => name.contains(part.as_str()),
            Pattern::Glob(text, _) if text.is_ascii() && name.is_ascii() => glob(text.as_bytes(), name.as_bytes(), b'?', b'*'),
            Pattern::Glob(_, chars) => glob(chars, &name.chars().collect::<Vec<_>>(), '?', '*'),
        }
    }
}

/// One `|` alternative of a term.
struct Alt {
    pattern: Pattern,
    /// Matched against the full path rather than the name.
    path: bool,
}

impl Alt {
    /// `text` is lower case, with `/` already turned into `\`.
    fn new(text: &str) -> Alt {
        if !text.contains('\\') {
            return Alt { pattern: Pattern::new(text), path: false };
        }
        // A path pattern matches from any folder down, unless it starts at a
        // drive (`c:\...`) or says where to start with a `*`.
        let anchored = text.starts_with('*') || text.as_bytes().get(1) == Some(&b':');
        let text = match (text.contains(['*', '?']), anchored, text.starts_with('\\')) {
            (true, false, true) => format!("*{text}"),
            (true, false, false) => format!("*\\{text}"),
            _ => text.to_string(),
        };
        Alt { pattern: Pattern::new(&text), path: true }
    }
}

/// One term: matches when any of its `|` alternatives does.
struct Term {
    alts: Vec<Alt>,
}

impl Term {
    fn matches(&self, name: &str, path: &str) -> bool {
        self.alts.iter().any(|a| a.pattern.matches(if a.path { path } else { name }))
    }

    fn needs_path(&self) -> bool {
        self.alts.iter().any(|a| a.path)
    }
}

/// Splits the text into terms, keeping "quoted parts" together.
fn split_terms(text: &str) -> Vec<String> {
    let mut terms = Vec::new();
    let mut cur = String::new();
    let mut quoted = false;
    for c in text.chars() {
        match c {
            '"' => quoted = !quoted,
            c if c.is_whitespace() && !quoted => {
                if !cur.is_empty() {
                    terms.push(std::mem::take(&mut cur));
                }
            }
            c => cur.push(c),
        }
    }
    if !cur.is_empty() {
        terms.push(cur);
    }
    terms
}

/// The terms to match (at most 64) and the terms that leave things out.
fn parse(text: &str) -> (Vec<Term>, Vec<Term>) {
    let mut include = Vec::new();
    let mut exclude = Vec::new();
    for raw in split_terms(&text.to_lowercase()) {
        let (negated, body) = match raw.strip_prefix('-') {
            Some(rest) if !rest.is_empty() => (true, rest),
            _ => (false, raw.as_str()),
        };
        let body = body.replace('/', "\\");
        let alts: Vec<Alt> = body.split('|').filter(|a| !a.is_empty()).map(Alt::new).collect();
        if alts.is_empty() {
            continue;
        }
        let term = Term { alts };
        if negated {
            exclude.push(term);
        } else if include.len() < 64 {
            include.push(term);
        }
    }
    (include, exclude)
}

/// `*` matches any run of characters, `?` any one character.
fn glob<T: Copy + PartialEq>(pattern: &[T], name: &[T], one: T, any: T) -> bool {
    let (mut p, mut n) = (0, 0);
    let mut star: Option<(usize, usize)> = None;
    while n < name.len() {
        if p < pattern.len() && (pattern[p] == one || pattern[p] == name[n]) {
            p += 1;
            n += 1;
        } else if p < pattern.len() && pattern[p] == any {
            star = Some((p, n));
            p += 1;
        } else if let Some((sp, sn)) = star {
            // Let the last star swallow one more character and retry.
            p = sp + 1;
            n = sn + 1;
            star = Some((sp, sn + 1));
        } else {
            return false;
        }
    }
    pattern[p..].iter().all(|&c| c == any)
}

pub struct Filter {
    pub query: Query,
    /// Matching bytes at or under each node, in the tree's size mode.
    pub sizes: Vec<u64>,
    /// Matching files at or under each node.
    pub counts: Vec<u32>,
    /// The outermost matches, largest first: folders whose own name matches
    /// the text, and matching files that aren't inside one of those.
    pub hits: Vec<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hit {
    pub id: u32,
    pub parent: u32,
    pub name: String,
    pub path: String,
    pub kind: Kind,
    /// Matching bytes (all of a file; the matching part of a folder).
    pub size: u64,
    pub files: u32,
    pub modified: i64,
    pub online: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub files: u32,
    pub bytes: u64,
    pub total_hits: usize,
    pub hits: Vec<Hit>,
}

impl Filter {
    /// Works out matching sizes for the whole tree in two linear passes.
    /// Relies on ids being handed out breadth first, so a parent's id is
    /// always lower than its children's.
    pub fn build(tree: &Tree, query: Query) -> Filter {
        let (include, exclude) = parse(&query.text);
        let exts: HashSet<String> = query.exts.iter().map(|e| e.trim_start_matches('.').to_lowercase()).collect();
        let others: HashSet<String> = query.other_than.iter().map(|e| e.trim_start_matches('.').to_lowercase()).collect();
        let any_type = exts.is_empty() && others.is_empty();
        // Bit i: term i matched this node or a folder above it.
        let all: u64 = if include.len() == 64 { u64::MAX } else { (1u64 << include.len()) - 1 };
        let needs_paths = include.iter().chain(&exclude).any(Term::needs_path);
        let n = tree.nodes.len();
        let mut matched = vec![0u64; n];
        let mut dead = vec![false; n];
        let mut sizes = vec![0u64; n];
        let mut counts = vec![0u32; n];
        let mut hits = Vec::new();
        // Folder paths in lower case, only kept when a term needs them.
        let mut paths: Vec<Option<Box<str>>> = Vec::new();
        if needs_paths {
            paths.resize(n, None);
            let root = tree.root_path.to_string_lossy().to_lowercase();
            paths[0] = Some(root.trim_end_matches('\\').into());
        }

        let mut name = String::new();
        let mut path = String::new();
        for i in 1..n {
            let node = &tree.nodes[i];
            let parent = node.parent as usize;
            dead[i] = dead[parent] || node.kind == Kind::Deleted;
            if dead[i] {
                continue;
            }
            // Two buffers reused for every node: this loop runs once per file on the drive.
            lower_into(&mut name, tree.name_of(node));
            if needs_paths {
                path.clear();
                path.push_str(paths[parent].as_deref().unwrap_or(""));
                path.push('\\');
                path.push_str(&name);
            }
            if exclude.iter().any(|t| t.matches(&name, &path)) {
                dead[i] = true;
                continue;
            }
            let own = include
                .iter()
                .enumerate()
                .filter(|(_, t)| t.matches(&name, &path))
                .fold(0u64, |m, (b, _)| m | 1 << b);
            let above = matched[parent];
            let parent_done = !include.is_empty() && above == all;
            let mask = above | own;
            match node.kind {
                Kind::Dir | Kind::Denied => {
                    matched[i] = mask;
                    if needs_paths {
                        paths[i] = Some(path.as_str().into());
                    }
                    if !include.is_empty() && mask == all && !parent_done {
                        hits.push(i as u32);
                    }
                }
                Kind::File => {
                    if mask != all {
                        continue;
                    }
                    let size = node.logical;
                    if query.min_size.is_some_and(|min| size < min)
                        || query.max_size.is_some_and(|max| size > max)
                        || query.modified_after.is_some_and(|t| node.modified < t)
                        || query.modified_before.is_some_and(|t| node.modified > t)
                    {
                        continue;
                    }
                    if !any_type {
                        let ext = extension(tree.name_of(node));
                        if !exts.contains(&ext) && (others.is_empty() || others.contains(&ext)) {
                            continue;
                        }
                    }
                    sizes[i] = tree.node_size(i as u32);
                    counts[i] = 1;
                    if !parent_done {
                        hits.push(i as u32);
                    }
                }
                _ => {}
            }
        }
        drop(paths);

        for i in (1..n).rev() {
            let parent = tree.nodes[i].parent as usize;
            sizes[parent] += sizes[i];
            counts[parent] += counts[i];
        }

        // Folders whose name matched but hold nothing that passes the other conditions drop out.
        hits.retain(|&h| counts[h as usize] > 0);
        hits.sort_unstable_by_key(|&h| std::cmp::Reverse(sizes[h as usize]));
        Filter { query, sizes, counts, hits }
    }

    pub fn summary(&self, tree: &Tree, limit: usize) -> Summary {
        Summary {
            files: self.counts[0],
            bytes: self.sizes[0],
            total_hits: self.hits.len(),
            hits: self
                .hits
                .iter()
                .take(limit)
                .map(|&id| {
                    let n = &tree.nodes[id as usize];
                    Hit {
                        id,
                        parent: n.parent,
                        name: tree.name_of(n).to_string(),
                        path: tree.path(id).to_string_lossy().into_owned(),
                        kind: n.kind,
                        size: self.sizes[id as usize],
                        files: self.counts[id as usize],
                        modified: n.modified,
                        online: n.kind == Kind::File && tree.online(id) > 0,
                    }
                })
                .collect(),
        }
    }
}

/// A pattern written the way search terms are (a name, `*`/`?`, `a|b`, or a
/// path with `\`), matched against one item on its own: for user cleanup rules.
pub struct Rule(Vec<Term>);

impl Rule {
    pub fn new(text: &str) -> Option<Rule> {
        let (terms, _) = parse(text);
        (!terms.is_empty()).then_some(Rule(terms))
    }

    pub fn needs_path(&self) -> bool {
        self.0.iter().any(Term::needs_path)
    }

    /// `name` and `path` in lower case (`lower_into`).
    pub fn matches(&self, name: &str, path: &str) -> bool {
        self.0.iter().all(|t| t.matches(name, path))
    }
}

/// `text` in lower case, into `out`.
pub fn lower_into(out: &mut String, text: &str) {
    out.clear();
    if text.is_ascii() {
        out.push_str(text);
        out.make_ascii_lowercase();
    } else {
        out.extend(text.chars().flat_map(char::to_lowercase));
    }
}

pub fn extension(name: &str) -> String {
    match name.rfind('.') {
        Some(i) if i > 0 && i + 1 < name.len() => name[i + 1..].to_ascii_lowercase(),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn glob_patterns() {
        let g = |p: &str, n: &str| {
            let by_char = glob(&p.chars().collect::<Vec<_>>(), &n.chars().collect::<Vec<_>>(), '?', '*');
            assert_eq!(by_char, glob(p.as_bytes(), n.as_bytes(), b'?', b'*'), "{p} on {n}");
            by_char
        };
        assert!(g("*.mp4", "holiday.mp4"));
        assert!(!g("*.mp4", "holiday.mp4.part"));
        assert!(g("img_????.jpg", "img_0042.jpg"));
        assert!(!g("img_????.jpg", "img_042.jpg"));
        assert!(g("*cache*", "shadercache"));
        assert!(g("a*b*c", "aXXbYYc"));
        assert!(!g("a*b*c", "aXXbYY"));
    }
}
