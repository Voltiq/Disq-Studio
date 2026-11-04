//! Finds known kinds of junk in a scan: caches, temp files, build output
//! and other things that are safe to remove or come back on their own.
//!
//! Rules match on the end of a folder's path (so `AppData\Local\Temp`
//! matches whoever's profile it is in), optionally on a file next to the
//! folder (a `target` folder only counts as Rust build output beside a
//! `Cargo.toml`), or on file names and ages. One linear pass over the tree;
//! once a folder is claimed by a rule, nothing inside it is looked at again.
//!
//! Sizes are always space on disk, whatever the size mode: that's what
//! removing something frees. Online-only cloud files count as nothing.
//!
//! The user can add rules of their own, written like search terms.

use serde::Serialize;

use crate::filter::{extension, lower_into, Rule};
use crate::tree::{Kind, Tree};

#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Safety {
    /// Rebuilt automatically by the app that made it.
    Safe,
    /// Fine to remove, but costs a re-download or a rebuild; check first.
    Review,
    /// Shown so it's known where the space goes, but removing it loses data:
    /// the app offers no way to select these.
    Info,
}

struct Category {
    key: &'static str,
    label: &'static str,
    description: &'static str,
    safety: Safety,
}

const CATEGORIES: &[Category] = &[
    Category {
        key: "temp",
        label: "Temporary files",
        description: "Files programs leave behind in the temp folders. Anything still in use is skipped.",
        safety: Safety::Safe,
    },
    Category {
        key: "browser",
        label: "Browser and app caches",
        description: "Copies of web pages, images and scripts kept to load faster. They refill as you browse.",
        safety: Safety::Safe,
    },
    Category {
        key: "shader",
        label: "Graphics shader caches",
        description: "Compiled shaders from graphics drivers and games. Rebuilt the next time each game runs.",
        safety: Safety::Safe,
    },
    Category {
        key: "crash",
        label: "Crash dumps and error reports",
        description: "Memory dumps and reports written when programs crash. Only useful for debugging.",
        safety: Safety::Safe,
    },
    Category {
        key: "update",
        label: "Windows Update downloads",
        description: "Update packages that were already installed. Removing them may need administrator rights.",
        safety: Safety::Safe,
    },
    Category {
        key: "build",
        label: "Developer build output",
        description: "node_modules, Rust target folders and Python caches. Rebuilt by npm install, cargo build and so on.",
        safety: Safety::Review,
    },
    Category {
        key: "packages",
        label: "Package manager caches",
        description: "Downloaded packages kept by npm, pip, Cargo, NuGet, Gradle and Yarn. Downloaded again when needed.",
        safety: Safety::Review,
    },
    Category {
        key: "chat",
        label: "Teams and Slack caches",
        description: "Cached messages, pictures and web pages of Microsoft Teams and Slack. Quit them first; they may ask you to sign in again.",
        safety: Safety::Review,
    },
    Category {
        key: "logs",
        label: "Large log files",
        description: "Log files of 1 MB or more. Usually safe, but check none is a log you need.",
        safety: Safety::Review,
    },
    Category {
        key: "installers",
        label: "Old installers in Downloads",
        description: "Setup files in Downloads not changed for 30 days or more. Usually no longer needed once installed.",
        safety: Safety::Review,
    },
    Category {
        key: "old",
        label: "Big files not opened in a year",
        description: "Files of 100 MB or more that nobody has opened or changed for a year. Check each one: some are kept on purpose, like backups.",
        safety: Safety::Review,
    },
    Category {
        key: "custom",
        label: "Your rules",
        description: "Matches for the rules in Settings › Cleanup rules.",
        safety: Safety::Review,
    },
    Category {
        key: "vdisks",
        label: "WSL and Docker disk images",
        description: "Virtual disks of Linux distributions and Docker. Deleting one erases everything in it, so they can't be selected here. To shrink them, use docker system prune or wsl --manage <distro> --set-sparse true.",
        safety: Safety::Info,
    },
];

/// A folder rule: the end of its path, lower case, `*` for any one name.
struct FolderRule {
    category: &'static str,
    path: &'static [&'static str],
    /// A file that must sit beside the folder, lower case; `*.ext` for any with that extension.
    beside: Option<&'static str>,
}

const fn rule(category: &'static str, path: &'static [&'static str]) -> FolderRule {
    FolderRule { category, path, beside: None }
}

const fn beside(category: &'static str, path: &'static [&'static str], file: &'static str) -> FolderRule {
    FolderRule { category, path, beside: Some(file) }
}

const FOLDER_RULES: &[FolderRule] = &[
    rule("temp", &["appdata", "local", "temp"]),
    rule("temp", &["windows", "temp"]),
    // Chromium browsers (Chrome, Edge, Brave, Opera, Vivaldi) keep one set per profile.
    rule("browser", &["user data", "*", "cache"]),
    rule("browser", &["user data", "*", "code cache"]),
    rule("browser", &["user data", "*", "gpucache"]),
    rule("browser", &["user data", "*", "service worker", "cachestorage"]),
    rule("browser", &["user data", "shadercache"]),
    rule("browser", &["firefox", "profiles", "*", "cache2"]),
    // Electron apps (Discord, Slack, Teams, VS Code) keep Chromium caches in Roaming.
    rule("browser", &["appdata", "roaming", "*", "cache"]),
    rule("browser", &["appdata", "roaming", "*", "code cache"]),
    rule("browser", &["appdata", "roaming", "*", "gpucache"]),
    rule("shader", &["nvidia", "dxcache"]),
    rule("shader", &["nvidia", "glcache"]),
    rule("shader", &["nvidia corporation", "nv_cache"]),
    rule("shader", &["amd", "dxcache"]),
    rule("shader", &["amd", "glcache"]),
    rule("shader", &["appdata", "local", "d3dscache"]),
    rule("shader", &["steamapps", "shadercache"]),
    rule("crash", &["appdata", "local", "crashdumps"]),
    rule("crash", &["microsoft", "windows", "wer"]),
    rule("update", &["softwaredistribution", "download"]),
    // Classic Teams and Slack are Electron apps one folder deeper than the rules above.
    rule("chat", &["microsoft", "teams", "cache"]),
    rule("chat", &["microsoft", "teams", "code cache"]),
    rule("chat", &["microsoft", "teams", "gpucache"]),
    rule("chat", &["microsoft", "teams", "service worker", "cachestorage"]),
    rule("chat", &["slack", "service worker", "cachestorage"]),
    // New Teams keeps its web cache in its package folder.
    rule("chat", &["msteams_8wekyb3d8bbwe", "localcache", "microsoft", "msteams", "ebwebview"]),
    beside("build", &[".vs"], "*.sln"),
    beside("build", &["bin"], "*.csproj"),
    beside("build", &["obj"], "*.csproj"),
    beside("build", &["bin"], "*.fsproj"),
    beside("build", &["obj"], "*.fsproj"),
    beside("build", &["bin"], "*.vbproj"),
    beside("build", &["obj"], "*.vbproj"),
    beside("build", &["node_modules"], "package.json"),
    beside("build", &["target"], "cargo.toml"),
    beside("build", &[".next"], "package.json"),
    beside("build", &[".nuxt"], "package.json"),
    rule("build", &["__pycache__"]),
    rule("build", &[".pytest_cache"]),
    rule("build", &[".mypy_cache"]),
    rule("build", &[".gradle", "caches"]),
    rule("packages", &["appdata", "local", "npm-cache"]),
    rule("packages", &["appdata", "roaming", "npm-cache"]),
    rule("packages", &["appdata", "local", "pip", "cache"]),
    rule("packages", &["appdata", "local", "yarn", "cache"]),
    rule("packages", &["appdata", "local", "pnpm-cache"]),
    rule("packages", &[".cargo", "registry"]),
    rule("packages", &[".nuget", "packages"]),
];

/// Folders smaller than this aren't worth listing.
const MIN_FOLDER: u64 = 1024 * 1024;
const MIN_LOG: u64 = 1024 * 1024;
const MIN_DUMP: u64 = 1024 * 1024;
const INSTALLER_AGE_MS: i64 = 30 * 86_400_000;
const OLD_MIN: u64 = 100 * 1024 * 1024;
const OLD_AGE_MS: i64 = 365 * 86_400_000;
const MIN_VDISK: u64 = 1024 * 1024 * 1024;
const MAX_ITEMS: usize = 300;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JunkItem {
    pub id: u32,
    pub path: String,
    pub kind: Kind,
    pub size: u64,
    pub files: u64,
    pub modified: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JunkCategory {
    pub key: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub safety: Safety,
    pub total: u64,
    pub total_items: usize,
    /// The largest items; capped so the UI stays quick.
    pub items: Vec<JunkItem>,
}

/// Names from `id` upwards, lower case, ending with the scanned folder's own
/// path split into parts, so rules can match across the scan root.
fn names_up(tree: &Tree, id: u32) -> impl Iterator<Item = String> + '_ {
    let mut cur = Some(id);
    let mut root_parts: Option<std::vec::IntoIter<String>> = None;
    std::iter::from_fn(move || {
        if let Some(parts) = root_parts.as_mut() {
            return parts.next();
        }
        let id = cur?;
        if id == 0 {
            cur = None;
            let mut parts: Vec<String> = tree
                .root_path
                .components()
                .map(|c| c.as_os_str().to_string_lossy().trim_end_matches(['\\', '/']).to_lowercase())
                .filter(|s| !s.is_empty())
                .collect();
            parts.reverse();
            root_parts = Some(parts.into_iter());
            return root_parts.as_mut().unwrap().next();
        }
        let n = &tree.nodes[id as usize];
        cur = Some(n.parent);
        Some(tree.name_of(n).to_lowercase())
    })
}

fn path_ends_with(tree: &Tree, id: u32, pattern: &[&str]) -> bool {
    let mut names = names_up(tree, id);
    pattern.iter().rev().all(|want| names.next().is_some_and(|name| *want == "*" || name == *want))
}

fn has_file_beside(tree: &Tree, id: u32, file: &str) -> bool {
    let parent = tree.nodes[id as usize].parent;
    if parent == u32::MAX {
        return false;
    }
    let p = &tree.nodes[parent as usize];
    let wanted = |name: &str| match file.strip_prefix("*.") {
        Some(ext) => extension(name) == ext,
        None => name.eq_ignore_ascii_case(file),
    };
    tree.links[p.first as usize..(p.first + p.count) as usize]
        .iter()
        .any(|&c| tree.nodes[c as usize].kind == Kind::File && wanted(tree.name(c)))
}

fn file_category(tree: &Tree, id: u32, now_ms: i64) -> Option<&'static str> {
    let n = &tree.nodes[id as usize];
    let ext = extension(tree.name_of(n));
    match ext.as_str() {
        "dmp" | "mdmp" | "hdmp" if n.logical >= MIN_DUMP => Some("crash"),
        "log" | "etl" if n.logical >= MIN_LOG => Some("logs"),
        "exe" | "msi" | "msix" if now_ms - n.modified >= INSTALLER_AGE_MS && in_downloads(tree, id) => Some("installers"),
        "vhdx" if n.allocated >= MIN_VDISK && is_vdisk(tree.name_of(n)) => Some("vdisks"),
        _ if is_old(tree, id, now_ms) => Some("old"),
        _ => None,
    }
}

fn is_vdisk(name: &str) -> bool {
    name.eq_ignore_ascii_case("ext4.vhdx") || name.eq_ignore_ascii_case("docker_data.vhdx")
}

/// Big, on this drive, and neither opened nor changed for a year. Windows'
/// own files are left out: they're "opened" by being loaded, not read.
fn is_old(tree: &Tree, id: u32, now_ms: i64) -> bool {
    let n = &tree.nodes[id as usize];
    if n.allocated < OLD_MIN || now_ms - n.modified < OLD_AGE_MS {
        return false;
    }
    let Some(accessed) = tree.accessed(id) else { return false };
    if now_ms - accessed < OLD_AGE_MS {
        return false;
    }
    let mut names: Vec<String> = names_up(tree, id).collect();
    let top = names.len().saturating_sub(2); // just below the drive
    let system = names.get(top).is_some_and(|n| matches!(n.as_str(), "windows" | "system volume information" | "$recycle.bin"));
    names.truncate(1);
    !system && !names[0].starts_with('$')
}

fn in_downloads(tree: &Tree, id: u32) -> bool {
    names_up(tree, id).skip(1).any(|name| name == "downloads")
}

/// Known junk anywhere in the scan, plus whatever the user's `rules` match.
pub fn find(tree: &Tree, now_ms: i64, rules: &[String]) -> Vec<JunkCategory> {
    let n = tree.nodes.len();
    // Inside a folder a rule already claimed (or a deleted one): skip.
    let mut claimed = vec![false; n];
    let mut found: Vec<(&'static str, u32)> = Vec::new();
    let rules: Vec<Rule> = rules.iter().filter_map(|r| Rule::new(r)).collect();
    // Folder paths in lower case, kept only when a rule needs them.
    let needs_paths = rules.iter().any(Rule::needs_path);
    let mut paths: Vec<Option<Box<str>>> = Vec::new();
    if needs_paths {
        paths.resize(n, None);
        paths[0] = Some(tree.root_path.to_string_lossy().to_lowercase().trim_end_matches('\\').into());
    }
    let (mut name, mut path) = (String::new(), String::new());

    for i in 1..n {
        let node = &tree.nodes[i];
        let parent = node.parent as usize;
        if claimed[parent] || node.kind == Kind::Deleted {
            claimed[i] = true;
            continue;
        }
        let id = i as u32;
        lower_into(&mut name, tree.name_of(node));
        if needs_paths {
            path.clear();
            path.push_str(paths[parent].as_deref().unwrap_or(""));
            path.push('\\');
            path.push_str(&name);
        }
        let custom = !rules.is_empty() && rules.iter().any(|r| r.matches(&name, &path));
        match node.kind {
            Kind::Dir => {
                let hit = FOLDER_RULES
                    .iter()
                    .find(|r| {
                        // Cheap check on the last name before walking up the path.
                        let last = r.path[r.path.len() - 1];
                        (last == "*" || last == name)
                            && path_ends_with(tree, id, r.path)
                            && r.beside.is_none_or(|f| has_file_beside(tree, id, f))
                    })
                    .map(|r| r.category)
                    .or(custom.then_some("custom"));
                if let Some(category) = hit {
                    claimed[i] = true;
                    if tree.nodes[id as usize].allocated >= MIN_FOLDER || category == "custom" {
                        found.push((category, id));
                    }
                } else if needs_paths {
                    paths[i] = Some(path.as_str().into());
                }
            }
            Kind::File => {
                if let Some(category) = file_category(tree, id, now_ms).or(custom.then_some("custom")) {
                    found.push((category, id));
                }
            }
            _ => {}
        }
    }

    CATEGORIES
        .iter()
        .filter_map(|c| {
            let mut ids: Vec<u32> = found.iter().filter(|(k, _)| *k == c.key).map(|&(_, id)| id).collect();
            if ids.is_empty() {
                return None;
            }
            ids.sort_unstable_by_key(|&id| std::cmp::Reverse(tree.nodes[id as usize].allocated));
            let total = ids.iter().map(|&id| tree.nodes[id as usize].allocated).sum();
            let total_items = ids.len();
            let items = ids
                .into_iter()
                .take(MAX_ITEMS)
                .map(|id| {
                    let node = &tree.nodes[id as usize];
                    JunkItem {
                        id,
                        path: tree.path(id).to_string_lossy().into_owned(),
                        kind: node.kind,
                        size: tree.nodes[id as usize].allocated,
                        files: if node.kind == Kind::File { 1 } else { node.files as u64 },
                        modified: node.modified,
                    }
                })
                .collect();
            Some(JunkCategory {
                key: c.key,
                label: c.label,
                description: c.description,
                safety: c.safety,
                total,
                total_items,
                items,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scan::{test_file, test_folder};
    use crate::tree::SizeMode;

    const MB: u64 = 1024 * 1024;
    const DAY: i64 = 86_400_000;

    fn old(mut raw: crate::scan::Raw, modified: i64) -> crate::scan::Raw {
        raw.modified = modified;
        raw
    }

    #[test]
    fn finds_each_kind_once() {
        let now = 1_000 * DAY;
        let raw = test_folder(
            "nico",
            vec![
                test_folder(
                    "AppData",
                    vec![
                        test_folder(
                            "Local",
                            vec![
                                test_folder("Temp", vec![test_file("a.tmp", 5 * MB, 1, false), test_file("big.log", 3 * MB, 2, false)]),
                                test_folder(
                                    "Google",
                                    vec![test_folder(
                                        "Chrome",
                                        vec![test_folder(
                                            "User Data",
                                            vec![test_folder("Default", vec![test_folder("Cache", vec![test_file("f_1", 2 * MB, 3, false)])])],
                                        )],
                                    )],
                                ),
                                test_folder("CrashDumps", vec![test_file("app.dmp", 4 * MB, 4, false)]),
                            ],
                        ),
                    ],
                ),
                test_folder(
                    "code",
                    vec![
                        test_folder(
                            "web",
                            vec![test_file("package.json", 100, 5, false), test_folder("node_modules", vec![test_file("x.js", 8 * MB, 6, false)])],
                        ),
                        // No Cargo.toml beside it: not Rust build output.
                        test_folder("target", vec![test_file("goal.txt", 9 * MB, 7, false)]),
                        test_file("server.log", 2 * MB, 8, false),
                        test_file("tiny.log", 1000, 9, false),
                    ],
                ),
                test_folder(
                    "Downloads",
                    vec![
                        old(test_file("setup.exe", 50 * MB, 10, false), now - 90 * DAY),
                        old(test_file("new.msi", 50 * MB, 11, false), now - 2 * DAY),
                    ],
                ),
                // Below the folder size floor.
                test_folder("other", vec![test_folder("__pycache__", vec![test_file("m.pyc", 10, 12, false)])]),
            ],
        );
        let tree = Tree::from_raw("C:\\Users\\nico".into(), raw, SizeMode::Logical, true);
        let found = find(&tree, now, &[]);
        let by_key = |k: &str| found.iter().find(|c| c.key == k);

        let temp = by_key("temp").unwrap();
        assert_eq!(temp.items.len(), 1);
        assert_eq!(temp.total, 8 * MB, "the whole Temp folder, log included");
        assert!(by_key("browser").unwrap().items[0].path.ends_with("Cache"));
        assert_eq!(by_key("crash").unwrap().total, 4 * MB, "the CrashDumps folder, not the dump twice");
        let build = by_key("build").unwrap();
        assert_eq!(build.items.len(), 1, "node_modules beside package.json only");
        assert!(build.items[0].path.ends_with("node_modules"));
        let logs = by_key("logs").unwrap();
        assert_eq!(logs.items.len(), 1, "server.log; big.log is inside Temp, tiny.log is small");
        let installers = by_key("installers").unwrap();
        assert_eq!(installers.items.len(), 1);
        assert!(installers.items[0].path.ends_with("setup.exe"));
        assert!(by_key("packages").is_none());
    }

    #[test]
    fn newer_rules_old_files_and_user_rules() {
        let now = 2_000 * DAY;
        let aged = |mut raw: crate::scan::Raw, modified: i64, accessed: i64| {
            raw.modified = modified;
            raw.accessed = accessed;
            raw
        };
        let raw = test_folder(
            "C:",
            vec![
                test_folder(
                    "Users",
                    vec![test_folder(
                        "nico",
                        vec![
                            test_folder(
                                "AppData",
                                vec![test_folder(
                                    "Roaming",
                                    vec![test_folder("Microsoft", vec![test_folder("Teams", vec![test_folder("Cache", vec![test_file("c", 3 * MB, 1, false)])])])],
                                )],
                            ),
                            test_folder(
                                "src",
                                vec![
                                    test_file("App.sln", 100, 2, false),
                                    test_folder(".vs", vec![test_file("db", 5 * MB, 3, false)]),
                                    test_folder(
                                        "Api",
                                        vec![
                                            test_file("Api.csproj", 100, 4, false),
                                            test_folder("bin", vec![test_file("Api.dll", 2 * MB, 5, false)]),
                                            test_folder("obj", vec![test_file("x", 2 * MB, 6, false)]),
                                        ],
                                    ),
                                    // No project file beside it: someone's own bin folder.
                                    test_folder("bin", vec![test_file("tool.exe", 2 * MB, 7, false)]),
                                ],
                            ),
                            test_folder(
                                "Videos",
                                vec![
                                    aged(test_file("old.mkv", 900 * MB, 8, false), now - 800 * DAY, now - 700 * DAY),
                                    // Changed long ago but watched last week.
                                    aged(test_file("watched.mkv", 900 * MB, 9, false), now - 800 * DAY, now - 7 * DAY),
                                    // Old, but online only: frees nothing.
                                    aged(test_file("cloud.mkv", 900 * MB, 10, true), now - 800 * DAY, now - 700 * DAY),
                                ],
                            ),
                            test_folder("wsl", vec![test_file("ext4.vhdx", 3000 * MB, 11, false)]),
                            test_folder("Renders", vec![test_folder("scratch", vec![test_file("frame.exr", 4 * MB, 12, false)])]),
                        ],
                    )],
                ),
                test_folder("Windows", vec![aged(test_file("old.iso", 900 * MB, 13, false), now - 800 * DAY, now - 700 * DAY)]),
            ],
        );
        let tree = Tree::from_raw("C:\\".into(), raw, SizeMode::Logical, true);
        let found = find(&tree, now, &[r"renders\scratch".into(), "*.bak".into()]);
        let names = |k: &str| -> Vec<String> {
            let mut v: Vec<String> = found
                .iter()
                .find(|c| c.key == k)
                .map(|c| c.items.iter().map(|i| i.path.trim_start_matches("C:\\").to_string()).collect())
                .unwrap_or_default();
            v.sort();
            v
        };
        assert_eq!(names("chat"), [r"Users\nico\AppData\Roaming\Microsoft\Teams\Cache"]);
        assert_eq!(
            names("build"),
            [r"Users\nico\src\.vs", r"Users\nico\src\Api\bin", r"Users\nico\src\Api\obj"],
            "only next to a solution or project file"
        );
        assert_eq!(names("old"), [r"Users\nico\Videos\old.mkv"], "not watched, not online only, not Windows' own");
        assert_eq!(names("vdisks"), [r"Users\nico\wsl\ext4.vhdx"]);
        assert!(found.iter().find(|c| c.key == "vdisks").unwrap().safety == Safety::Info);
        assert_eq!(names("custom"), [r"Users\nico\Renders\scratch"]);
    }

    #[test]
    fn rules_match_across_the_scan_root() {
        // Scanning AppData\Local itself: "appdata" is part of the root path, not a node.
        let raw = test_folder("Local", vec![test_folder("Temp", vec![test_file("a.tmp", 5 * MB, 1, false)])]);
        let tree = Tree::from_raw("C:\\Users\\nico\\AppData\\Local".into(), raw, SizeMode::Logical, true);
        let found = find(&tree, 0, &[]);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].key, "temp");
    }

    #[test]
    fn online_only_frees_nothing() {
        let raw = test_folder(
            "proj",
            vec![
                test_file("Cargo.toml", 100, 1, false),
                test_folder("target", vec![test_file("cloud.rlib", 50 * MB, 2, true), test_file("local.rlib", 3 * MB, 3, false)]),
            ],
        );
        let tree = Tree::from_raw("C:\\proj".into(), raw, SizeMode::Logical, true);
        let found = find(&tree, 0, &[]);
        assert_eq!(found[0].total, 3 * MB, "only the local file takes space on disk");
    }
}
