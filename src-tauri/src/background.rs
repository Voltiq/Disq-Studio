//! The background check: a Windows scheduled task starts Disq Studio with
//! `--background` once a day. That run opens no window. It warns (with a
//! Windows notification) about any fixed drive that is getting full, and
//! for the drives chosen in Settings it scans them, keeps a snapshot for
//! the history, and says when one grew a lot since the last snapshot.
//!
//! The settings live in a small JSON file the app writes, so the background
//! run can read them without the window.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::i18n::tr;
use crate::snapshot;
use crate::tree::{SizeMode, Tree};

pub const FLAG: &str = "--background";
const TASK: &str = "Disq Studio daily check";
/// The app ID the installer gives the Start menu shortcut; notifications show under its name.
const APP_ID: &str = "com.volti.disk-studio";

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Config {
    pub enabled: bool,
    /// Hour of the day (0–23) the check runs; a missed run happens at the next logon.
    pub hour: u32,
    /// Warn when a drive has less than this share free.
    pub min_free_percent: u32,
    /// Drive roots to scan and keep snapshots of.
    pub snapshot_roots: Vec<String>,
    /// Say so when a scanned drive grew at least this much since its last snapshot.
    pub grow_alert_gb: u64,
}

impl Default for Config {
    fn default() -> Self {
        Config { enabled: false, hour: 12, min_free_percent: 10, snapshot_roots: Vec::new(), grow_alert_gb: 10 }
    }
}

/// `%LOCALAPPDATA%\com.volti.disk-studio`: kept local, as snapshots are large.
pub fn data_dir() -> PathBuf {
    std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join(APP_ID)
}

pub fn snapshots_dir() -> PathBuf {
    data_dir().join("snapshots")
}

fn config_file() -> PathBuf {
    data_dir().join("background.json")
}

pub fn load_config() -> Config {
    std::fs::read(config_file()).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

pub fn save_config(c: &Config) -> std::io::Result<()> {
    std::fs::create_dir_all(data_dir())?;
    std::fs::write(config_file(), serde_json::to_vec_pretty(c).map_err(std::io::Error::other)?)
}

/// Creates, updates or removes the scheduled task to match `c`.
pub fn schedule(c: &Config, exe: &Path) -> Result<(), String> {
    if !c.enabled {
        // Not there is fine.
        let _ = schtasks(&["/Delete", "/TN", TASK, "/F"]);
        return Ok(());
    }
    // An XML definition, for what the command line can't say: run when a
    // start was missed, on battery too, and never keep a run going past an hour.
    let xml = format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Warns when a drive is getting full and keeps scan history. Set up in Disq Studio › Settings.</Description></RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T{hour:02}:00:00</StartBoundary>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals><Principal id="Author"><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author"><Exec><Command>{exe}</Command><Arguments>{flag}</Arguments></Exec></Actions>
</Task>
"#,
        hour = c.hour.min(23),
        exe = xml_escape(&exe.to_string_lossy()),
        flag = FLAG,
    );
    let file = std::env::temp_dir().join(format!("disk-studio-task-{}.xml", std::process::id()));
    // Task Scheduler expects UTF-16 with a byte-order mark.
    let mut bytes = vec![0xFF, 0xFE];
    bytes.extend(xml.encode_utf16().flat_map(|u| u.to_le_bytes()));
    std::fs::write(&file, bytes).map_err(|e| e.to_string())?;
    let result = schtasks(&["/Create", "/TN", TASK, "/XML", &file.to_string_lossy(), "/F"]);
    let _ = std::fs::remove_file(&file);
    result
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn schtasks(args: &[&str]) -> Result<(), String> {
    let mut cmd = std::process::Command::new("schtasks.exe");
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// Whether the scheduled task exists, as Windows sees it.
pub fn is_scheduled() -> bool {
    schtasks(&["/Query", "/TN", TASK]).is_ok()
}

/// Shows a Windows notification from Disq Studio.
pub fn notify(title: &str, body: &str) {
    #[cfg(windows)]
    {
        use tauri_winrt_notification::Toast;
        let _ = Toast::new(APP_ID).title(title).text1(body).show();
    }
    #[cfg(not(windows))]
    {
        let _ = (title, body);
    }
}

/// What one check found, also shown in Settings after "Check now".
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub title: String,
    pub body: String,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Free space on every fixed drive, against the threshold.
pub fn check_space(c: &Config) -> Vec<Finding> {
    crate::volumes::list()
        .into_iter()
        .filter(|v| v.kind == "fixed" && v.total > 0)
        .filter_map(|v| {
            let pct = v.free as f64 * 100.0 / v.total as f64;
            (pct < c.min_free_percent as f64).then(|| Finding {
                title: tr("{0} is getting full", &[v.path.trim_end_matches('\\')]),
                body: tr(
                    "{0} free of {1} ({2}%). Open Disq Studio to see what's taking the space.",
                    &[&crate::report::human(v.free), &crate::report::human(v.total), &format!("{pct:.0}")],
                ),
            })
        })
        .collect()
}

/// Scans `root`, keeps a snapshot of it, and says if it grew a lot since the last one.
pub fn snapshot_root(root: &str, c: &Config) -> Result<Option<Finding>, String> {
    let path = PathBuf::from(root);
    let previous = snapshot::list(&snapshots_dir(), Some(root)).into_iter().next();
    let progress = crate::scan::Progress::default();
    let raw = crate::scan::scan(&path, &progress, &crate::scan::Excludes::default()).ok_or_else(|| tr("The scan was cancelled.", &[]))?;
    let tree = Tree::from_raw(path, raw, SizeMode::Allocated, crate::dedupes_links_at(root));
    let meta = snapshot::Meta::of(&tree, now_ms(), false);
    let file = snapshots_dir().join(snapshot::file_name(root, meta.scanned_at));
    snapshot::save(&tree, &meta, &file).map_err(|e| e.to_string())?;
    snapshot::prune(&snapshots_dir(), root, crate::KEEP_SNAPSHOTS);
    let Some(prev) = previous else { return Ok(None) };
    let grew = meta.allocated as i128 - prev.meta.allocated as i128;
    if grew >= (c.grow_alert_gb * 1024 * 1024 * 1024) as i128 {
        return Ok(Some(Finding {
            title: tr("{0} grew {1}", &[root.trim_end_matches('\\'), &crate::report::human(grew as u64)]),
            body: tr(
                "Since the scan of {0}: now {1} on disk. Open Disq Studio › History to see what grew.",
                &[&crate::i18n::date(prev.meta.scanned_at), &crate::report::human(meta.allocated)],
            ),
        }));
    }
    Ok(None)
}

/// Everything a check does; notifications are shown as they're found.
pub fn run_check(c: &Config, show: bool) -> Vec<Finding> {
    let mut findings = check_space(c);
    if show {
        findings.iter().for_each(|f| notify(&f.title, &f.body));
    }
    for root in &c.snapshot_roots {
        match snapshot_root(root, c) {
            Ok(Some(f)) => {
                if show {
                    notify(&f.title, &f.body);
                }
                findings.push(f);
            }
            Ok(None) => {}
            Err(e) => findings.push(Finding { title: tr("Couldn't scan {0}", &[root]), body: e }),
        }
    }
    findings
}

/// The `--background` run: no window, no single-instance hand-off, just the check.
pub fn run_headless() {
    crate::i18n::load();
    let c = load_config();
    run_check(&c, true);
}
