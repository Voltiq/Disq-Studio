//! The few sentences the Rust side shows itself, without the window: the
//! daily check's notifications and the HTML report. Everything else is
//! translated in the interface (src/lib/de.ts), including Rust's errors.
//!
//! The window says which language it uses when it starts (`set_language`);
//! that's also written to a file, so the daily check, which runs without the
//! window, speaks the same language.

use std::sync::atomic::{AtomicBool, Ordering::Relaxed};

static GERMAN: AtomicBool = AtomicBool::new(false);

fn language_file() -> std::path::PathBuf {
    crate::background::data_dir().join("language")
}

/// Sets the language, and remembers it for the daily check.
pub fn set(language: &str) {
    GERMAN.store(language == "de", Relaxed);
    let _ = std::fs::create_dir_all(crate::background::data_dir());
    let _ = std::fs::write(language_file(), language);
}

/// For the daily check: the language the window last used.
pub fn load() {
    if let Ok(language) = std::fs::read_to_string(language_file()) {
        GERMAN.store(language.trim() == "de", Relaxed);
    }
}

pub fn german() -> bool {
    GERMAN.load(Relaxed)
}

/// `text` in the language in use; `{0}`, `{1}`… are filled from `args`.
pub fn tr(text: &str, args: &[&str]) -> String {
    let own = if german() { de(text).unwrap_or(text) } else { text };
    let mut out = own.to_string();
    for (i, a) in args.iter().enumerate() {
        out = out.replace(&format!("{{{i}}}"), a);
    }
    out
}

fn de(text: &str) -> Option<&'static str> {
    Some(match text {
        // The daily check
        "{0} is getting full" => "{0} wird voll",
        "{0} free of {1} ({2}%). Open Disq Studio to see what's taking the space." => {
            "{0} von {1} frei ({2} %). Öffnen Sie Disq Studio, um zu sehen, was den Platz belegt."
        }
        "{0} grew {1}" => "{0} ist um {1} gewachsen",
        "Since the scan of {0}: now {1} on disk. Open Disq Studio › History to see what grew." => {
            "Seit dem Scan vom {0}: jetzt {1} auf Datenträger. Öffnen Sie Disq Studio › Verlauf, um zu sehen, was gewachsen ist."
        }
        "Couldn't scan {0}" => "{0} konnte nicht gescannt werden",
        "Disq Studio checked your drives" => "Disq Studio hat Ihre Laufwerke geprüft",
        "Nothing to report: every drive has room to spare." => "Nichts zu melden: Auf jedem Laufwerk ist genug Platz.",
        "The scan was cancelled." => "Der Scan wurde abgebrochen.",
        // The HTML report
        "Disq Studio report" => "Disq-Studio-Bericht",
        "Disq Studio report: {0}" => "Disq-Studio-Bericht: {0}",
        " · filtered: only matching files count" => " · gefiltert: Nur passende Dateien zählen",
        "Total ({0})" => "Gesamt ({0})",
        "on disk" => "auf Datenträger",
        "size" => "Größe",
        "Files" => "Dateien",
        "Folders" => "Ordner",
        "On disk" => "Auf Datenträger",
        "Contents" => "Inhalt",
        "Name" => "Name",
        "Size" => "Größe",
        "Share" => "Anteil",
        "Modified" => "Geändert",
        "File types" => "Dateitypen",
        "Extension" => "Endung",
        "no extension" => "ohne Endung",
        "Largest files" => "Größte Dateien",
        "File" => "Datei",
        "Made by Disq Studio {0} on {1} UTC. Sizes in binary units (1 KB = 1,024 bytes)." => {
            "Erstellt mit Disq Studio {0} am {1} UTC. Größen in Binäreinheiten (1 KB = 1.024 Bytes)."
        }
        _ => return None,
    })
}

/// A number with one or two decimals in the language's style: 1.50 or 1,50.
pub fn decimal(v: f64, digits: usize) -> String {
    let s = format!("{v:.digits$}");
    if german() { s.replace('.', ",") } else { s }
}

/// A date as people write it in the language: 2026-11-03 or 03.11.2026.
pub fn date(ms: i64) -> String {
    let (y, m, d, ..) = crate::report::civil(ms);
    if german() { format!("{d:02}.{m:02}.{y}") } else { format!("{y}-{m:02}-{d:02}") }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fills_in_and_falls_back() {
        GERMAN.store(false, Relaxed);
        assert_eq!(tr("{0} grew {1}", &["C:", "12 GB"]), "C: grew 12 GB");
        GERMAN.store(true, Relaxed);
        assert_eq!(tr("{0} grew {1}", &["C:", "12 GB"]), "C: ist um 12 GB gewachsen");
        assert_eq!(tr("Not in the table", &[]), "Not in the table");
        assert_eq!(decimal(1.5, 2), "1,50");
        assert_eq!(date(1_793_792_096_000), "04.11.2026");
        GERMAN.store(false, Relaxed);
    }
}
