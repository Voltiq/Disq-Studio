//! Exports a folder of the scan as CSV, JSON or a self-contained HTML page.
//!
//! Exports follow what's on screen: the size mode, and the filter if one is
//! on. Rows go down to `max_depth` levels and leave out anything smaller
//! than `min_size` (the folder exported is always there).

use serde::{Deserialize, Serialize};
use std::fmt::Write as _;
use std::fs::File;
use std::io::{self, BufWriter, Write};
use std::path::Path;

use crate::i18n::tr;
use crate::tree::{Entry, Kind, SizeMode, Tree};

#[derive(Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    Csv,
    Json,
    Html,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    pub format: Format,
    /// Levels below the folder; 0 for no limit.
    pub max_depth: u32,
    pub min_size: u64,
    pub include_files: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Row {
    pub depth: u32,
    pub path: String,
    pub name: String,
    pub kind: Kind,
    /// In the size mode shown.
    pub size: u64,
    pub logical: u64,
    pub allocated: u64,
    pub online: u64,
    pub files: u64,
    pub folders: u64,
    /// ISO 8601, UTC.
    pub modified: String,
    /// The size of the folder it's in (its own, for the top row), for shares.
    #[serde(skip)]
    pub parent_size: u64,
}

/// Year, month, day, hour, minute, second (UTC) of `ms` since the Unix epoch.
pub fn civil(ms: i64) -> (i64, u32, u32, u32, u32, u32) {
    let secs = ms.div_euclid(1000);
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    // Howard Hinnant's days-to-civil.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = yoe + era * 400 + (m <= 2) as i64;
    (y, m, d, (rem / 3600) as u32, (rem % 3600 / 60) as u32, (rem % 60) as u32)
}

pub fn iso(ms: i64) -> String {
    if ms <= 0 {
        return String::new();
    }
    let (y, mo, d, h, mi, s) = civil(ms);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

fn row(tree: &Tree, e: &Entry, depth: u32, parent_size: u64) -> Row {
    Row {
        depth,
        path: tree.path(e.id).to_string_lossy().into_owned(),
        name: e.name.clone(),
        kind: e.kind,
        size: e.size,
        logical: e.logical,
        allocated: e.allocated,
        online: e.online,
        files: e.files,
        folders: e.dirs,
        modified: iso(e.modified),
        parent_size,
    }
}

/// The rows of an export, each folder followed by its contents, largest first.
pub fn rows(tree: &Tree, id: u32, o: &Options) -> Vec<Row> {
    let mut out = Vec::new();
    let top = tree.entry(id);
    let whole = top.size;
    let mut stack: Vec<(Entry, u32, u64)> = vec![(top, 0, whole)];
    while let Some((e, depth, parent_size)) = stack.pop() {
        let open = e.kind == Kind::Dir && (o.max_depth == 0 || depth < o.max_depth);
        let (id, size) = (e.id, e.size);
        out.push(row(tree, &e, depth, parent_size));
        if open {
            let kids = tree
                .list(id)
                .into_iter()
                .filter(|k| k.size >= o.min_size && (o.include_files || !matches!(k.kind, Kind::File | Kind::Hardlink)));
            let kids: Vec<Entry> = kids.collect();
            for k in kids.into_iter().rev() {
                stack.push((k, depth + 1, size));
            }
        }
    }
    out
}

fn csv_field(s: &str) -> String {
    if s.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

fn kind_label(kind: Kind) -> &'static str {
    match kind {
        Kind::File => "file",
        Kind::Dir => "folder",
        Kind::Link => "link",
        Kind::Denied => "unreadable folder",
        Kind::Excluded => "skipped folder",
        Kind::Hardlink => "hard link",
        Kind::Deleted => "deleted",
    }
}

pub fn write(tree: &Tree, id: u32, o: &Options, path: &Path) -> io::Result<usize> {
    let rows = rows(tree, id, o);
    let mut w = BufWriter::new(File::create(path)?);
    match o.format {
        Format::Csv => {
            // A byte-order mark, so Excel reads the names as UTF-8.
            w.write_all("\u{feff}".as_bytes())?;
            writeln!(w, "Path,Type,Size,Size on disk,Online only,Files,Folders,Modified,Depth")?;
            for r in &rows {
                writeln!(
                    w,
                    "{},{},{},{},{},{},{},{},{}",
                    csv_field(&r.path),
                    kind_label(r.kind),
                    r.logical,
                    r.allocated,
                    r.online,
                    r.files,
                    r.folders,
                    r.modified,
                    r.depth
                )?;
            }
        }
        Format::Json => {
            #[derive(Serialize)]
            #[serde(rename_all = "camelCase")]
            struct Doc<'a> {
                root: String,
                exported_at: String,
                size_mode: SizeMode,
                rows: &'a [Row],
            }
            let doc = Doc {
                root: tree.path(id).to_string_lossy().into_owned(),
                exported_at: iso(now_ms()),
                size_mode: tree.mode,
                rows: &rows,
            };
            serde_json::to_writer_pretty(&mut w, &doc).map_err(io::Error::other)?;
        }
        Format::Html => w.write_all(html(tree, id, &rows).as_bytes())?,
    }
    w.flush()?;
    Ok(rows.len())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Like the app: 1 KB = 1,024 bytes.
pub fn human(bytes: u64) -> String {
    let units = crate::i18n::units();
    if bytes < 1024 {
        return tr("{0} bytes", &[&bytes.to_string()]);
    }
    let mut v = bytes as f64 / 1024.0;
    let mut i = 0;
    while v >= 1024.0 && i < units.len() - 1 {
        v /= 1024.0;
        i += 1;
    }
    let digits = if v < 10.0 { 2 } else if v < 100.0 { 1 } else { 0 };
    format!("{} {}", crate::i18n::decimal(v, digits), units[i])
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn html(tree: &Tree, id: u32, rows: &[Row]) -> String {
    let top = &rows[0];
    let l = |text: &str| esc(&tr(text, &[]));
    let mode = if tree.mode == SizeMode::Allocated { l("on disk") } else { l("size") };
    let filtered = tree.filter.is_some();
    let mut s = String::with_capacity(64 * 1024 + rows.len() * 200);
    let (y, mo, d, h, mi, _) = civil(now_ms());
    let _ = write!(
        s,
        r#"<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{page_title}</title>
<style>
:root {{ --bg:#f6f6f9; --card:#fff; --text:#16171d; --sub:#5b5e6b; --line:#e3e4ea; --accent:#6457f0; --bar:#e9e8fd; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#0f1014; --card:#17181e; --text:#eceef4; --sub:#9a9eae; --line:#2a2c35; --bar:#2a2752; }} }}
* {{ box-sizing:border-box; }}
body {{ margin:0; padding:32px 16px; background:var(--bg); color:var(--text); font:14px/1.5 "Segoe UI Variable","Segoe UI",system-ui,sans-serif; }}
main {{ max-width:1100px; margin:0 auto; display:flex; flex-direction:column; gap:20px; }}
h1 {{ margin:0; font-size:22px; overflow-wrap:anywhere; }} h2 {{ margin:0 0 12px; font-size:15px; }}
.card {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px; overflow-x:auto; }}
.sub {{ color:var(--sub); }} .stats {{ display:flex; flex-wrap:wrap; gap:28px; margin-top:12px; }}
.stat b {{ display:block; font-size:22px; font-family:"Cascadia Mono",Consolas,monospace; }}
table {{ width:100%; border-collapse:collapse; }} th,td {{ padding:5px 8px; text-align:left; white-space:nowrap; }}
th {{ color:var(--sub); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid var(--line); }}
td.num, th.num {{ text-align:right; font-family:"Cascadia Mono",Consolas,monospace; }}
td.name {{ max-width:520px; overflow:hidden; text-overflow:ellipsis; }}
tr + tr td {{ border-top:1px solid var(--line); }}
.bar {{ width:140px; }} .bar span {{ display:block; height:6px; border-radius:3px; background:var(--accent); min-width:1px; }}
.bar div {{ background:var(--bar); border-radius:3px; }}
.dir {{ font-weight:600; }} footer {{ color:var(--sub); font-size:12px; text-align:center; }}
</style>
</head>
<body>
<main>
<section class="card">
<div class="sub">{report}{filter_note}</div>
<h1>{title}</h1>
<div class="stats">
<div class="stat"><span class="sub">{total_label}</span><b>{total}</b></div>
<div class="stat"><span class="sub">{files_label}</span><b>{files}</b></div>
<div class="stat"><span class="sub">{folders_label}</span><b>{folders}</b></div>
<div class="stat"><span class="sub">{on_disk_label}</span><b>{alloc}</b></div>
</div>
</section>
"#,
        lang = crate::i18n::code(),
        page_title = esc(&tr("Disq Studio report: {0}", &[&top.path])),
        title = esc(&top.path),
        report = l("Disq Studio report"),
        filter_note = if filtered { l(" · filtered: only matching files count") } else { String::new() },
        total_label = esc(&tr("Total ({0})", &[&mode])),
        files_label = l("Files"),
        folders_label = l("Folders"),
        on_disk_label = l("On disk"),
        total = human(top.size),
        files = top.files,
        folders = top.folders,
        alloc = human(top.allocated),
    );

    // Contents, indented, with each item's share of its parent.
    let _ = write!(
        s,
        r#"<section class="card"><h2>{}</h2><table><thead><tr><th>{}</th><th class="num">{}</th><th class="num">{}</th><th></th><th class="num">{}</th><th>{}</th></tr></thead><tbody>"#,
        l("Contents"),
        l("Name"),
        l("Size"),
        l("Share"),
        l("Files"),
        l("Modified")
    );
    for r in rows {
        let share = r.size as f64 / r.parent_size.max(1) as f64;
        let is_dir = matches!(r.kind, Kind::Dir | Kind::Denied);
        let _ = write!(
            s,
            r#"<tr><td class="name{cls}" style="padding-left:{pad}px" title="{title}">{name}</td><td class="num">{size}</td><td class="num">{pct:.1}%</td><td class="bar"><div><span style="width:{w:.1}%"></span></div></td><td class="num">{files}</td><td class="sub">{date}</td></tr>"#,
            cls = if is_dir { " dir" } else { "" },
            pad = 8 + r.depth * 18,
            title = esc(&r.path),
            name = esc(if r.depth == 0 { &r.path } else { &r.name }),
            size = human(r.size),
            pct = share * 100.0,
            w = share * 100.0,
            files = if is_dir { r.files.to_string() } else { String::new() },
            date = r.modified.get(..10).unwrap_or(""),
        );
    }
    s.push_str("</tbody></table></section>");

    // File types and the largest files.
    let exts = tree.extensions(id, 15);
    let _ = write!(
        s,
        r#"<section class="card"><h2>{}</h2><table><thead><tr><th>{}</th><th class="num">{}</th><th class="num">{}</th><th></th></tr></thead><tbody>"#,
        l("File types"),
        l("Extension"),
        l("Files"),
        l("Size")
    );
    let biggest = exts.first().map_or(1, |e| e.bytes.max(1));
    for e in &exts {
        let _ = write!(
            s,
            r#"<tr><td>{ext}</td><td class="num">{count}</td><td class="num">{size}</td><td class="bar"><div><span style="width:{w:.1}%"></span></div></td></tr>"#,
            ext = if e.ext.is_empty() { l("no extension") } else { format!(".{}", esc(&e.ext)) },
            count = e.count,
            size = human(e.bytes),
            w = e.bytes as f64 * 100.0 / biggest as f64,
        );
    }
    s.push_str("</tbody></table></section>");
    let _ = write!(
        s,
        r#"<section class="card"><h2>{}</h2><table><thead><tr><th>{}</th><th class="num">{}</th><th>{}</th></tr></thead><tbody>"#,
        l("Largest files"),
        l("File"),
        l("Size"),
        l("Modified")
    );
    for f in tree.largest(id, 50) {
        let _ = write!(
            s,
            r#"<tr><td class="name" title="{p}">{p}</td><td class="num">{size}</td><td class="sub">{date}</td></tr>"#,
            p = esc(&f.path),
            size = human(f.size),
            date = iso(f.modified).get(..10).unwrap_or(""),
        );
    }
    let _ = write!(
        s,
        "</tbody></table></section><footer>{}</footer></main></body></html>\n",
        esc(&tr(
            "Made by Disq Studio {0} on {1} UTC. Sizes in binary units (1 KB = 1,024 bytes).",
            &[env!("CARGO_PKG_VERSION"), &format!("{y:04}-{mo:02}-{d:02} {h:02}:{mi:02}")]
        )),
    );
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scan::{test_file, test_folder};

    #[test]
    fn dates_convert() {
        assert_eq!(iso(0), "");
        assert_eq!(iso(1), "1970-01-01T00:00:00Z");
        assert_eq!(iso(951_782_400_000), "2000-02-29T00:00:00Z", "a leap day");
        assert_eq!(iso(1_793_792_096_000), "2026-11-04T11:34:56Z");
    }

    #[test]
    fn exports_follow_depth_size_and_files() {
        let raw = test_folder(
            "root",
            vec![
                test_folder("big", vec![test_folder("inner", vec![test_file("deep.bin", 9000, 1, false)]), test_file("a,b.txt", 4000, 2, false)]),
                test_folder("small", vec![test_file("s.txt", 10, 3, false)]),
                test_file("top.iso", 20_000, 4, false),
            ],
        );
        let tree = Tree::from_raw("C:\\root".into(), raw, SizeMode::Logical, true);
        let names = |o: Options| rows(&tree, 0, &o).into_iter().map(|r| format!("{}{}", " ".repeat(r.depth as usize), r.name)).collect::<Vec<_>>();
        assert_eq!(
            names(Options { format: Format::Csv, max_depth: 0, min_size: 0, include_files: true }),
            ["root", " top.iso", " big", "  inner", "   deep.bin", "  a,b.txt", " small", "  s.txt"],
            "largest first, each folder followed by its contents"
        );
        assert_eq!(names(Options { format: Format::Csv, max_depth: 1, min_size: 100, include_files: false }), ["root", " big"]);

        let dir = std::env::temp_dir().join(format!("disk-studio-report-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        for format in [Format::Csv, Format::Json, Format::Html] {
            let file = dir.join("out");
            write(&tree, 0, &Options { format, max_depth: 0, min_size: 0, include_files: true }, &file).unwrap();
            let text = std::fs::read_to_string(&file).unwrap();
            match format {
                Format::Csv => assert!(text.contains("\"C:\\root\\big\\a,b.txt\",file,4000,4096,")),
                Format::Json => assert_eq!(serde_json::from_str::<serde_json::Value>(&text).unwrap()["rows"].as_array().unwrap().len(), 8),
                Format::Html => assert!(text.contains("<h1>C:\\root</h1>") && text.contains("top.iso")),
            }
        }
        std::fs::remove_dir_all(dir).unwrap();
    }
}
