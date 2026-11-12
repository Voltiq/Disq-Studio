//! The few sentences the Rust side shows itself, without the window: the
//! daily check's notifications and the HTML report. Everything else is
//! translated in the interface (src/lib/de.ts, es.ts, fr.ts), including
//! Rust's errors.
//!
//! The window says which language it uses when it starts (`set_language`);
//! that's also written to a file, so the daily check, which runs without the
//! window, speaks the same language.

use std::sync::atomic::{AtomicU8, Ordering::Relaxed};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Language {
    English = 0,
    German = 1,
    Spanish = 2,
    French = 3,
}

static LANGUAGE: AtomicU8 = AtomicU8::new(Language::English as u8);

fn language_file() -> std::path::PathBuf {
    crate::background::data_dir().join("language")
}

fn parse(code: &str) -> Language {
    match code.trim() {
        "de" => Language::German,
        "es" => Language::Spanish,
        "fr" => Language::French,
        _ => Language::English,
    }
}

fn store(l: Language) {
    LANGUAGE.store(l as u8, Relaxed);
}

/// Sets the language, and remembers it for the daily check.
pub fn set(code: &str) {
    store(parse(code));
    let _ = std::fs::create_dir_all(crate::background::data_dir());
    let _ = std::fs::write(language_file(), code);
}

/// For the daily check: the language the window last used.
pub fn load() {
    if let Ok(code) = std::fs::read_to_string(language_file()) {
        store(parse(&code));
    }
}

pub fn current() -> Language {
    match LANGUAGE.load(Relaxed) {
        1 => Language::German,
        2 => Language::Spanish,
        3 => Language::French,
        _ => Language::English,
    }
}

/// The language's code, for `<html lang>`.
pub fn code() -> &'static str {
    match current() {
        Language::English => "en",
        Language::German => "de",
        Language::Spanish => "es",
        Language::French => "fr",
    }
}

/// `text` in the language in use; `{0}`, `{1}`… are filled from `args`.
pub fn tr(text: &str, args: &[&str]) -> String {
    let own = match current() {
        Language::English => None,
        Language::German => de(text),
        Language::Spanish => es(text),
        Language::French => fr(text),
    };
    let mut out = own.unwrap_or(text).to_string();
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
        "{0} bytes" => "{0} Bytes",
        "Made by Disq Studio {0} on {1} UTC. Sizes in binary units (1 KB = 1,024 bytes)." => {
            "Erstellt mit Disq Studio {0} am {1} UTC. Größen in Binäreinheiten (1 KB = 1.024 Bytes)."
        }
        _ => return None,
    })
}

fn es(text: &str) -> Option<&'static str> {
    Some(match text {
        // The daily check
        "{0} is getting full" => "{0} se está llenando",
        "{0} free of {1} ({2}%). Open Disq Studio to see what's taking the space." => {
            "{0} libres de {1} ({2} %). Abre Disq Studio para ver qué ocupa el espacio."
        }
        "{0} grew {1}" => "{0} ha crecido {1}",
        "Since the scan of {0}: now {1} on disk. Open Disq Studio › History to see what grew." => {
            "Desde el análisis del {0}: ahora {1} en disco. Abre Disq Studio › Historial para ver qué ha crecido."
        }
        "Couldn't scan {0}" => "No se ha podido analizar {0}",
        "Disq Studio checked your drives" => "Disq Studio ha comprobado tus unidades",
        "Nothing to report: every drive has room to spare." => "Nada que informar: todas las unidades tienen espacio de sobra.",
        "The scan was cancelled." => "Se ha cancelado el análisis.",
        // The HTML report
        "Disq Studio report" => "Informe de Disq Studio",
        "Disq Studio report: {0}" => "Informe de Disq Studio: {0}",
        " · filtered: only matching files count" => " · filtrado: solo cuentan los archivos que coinciden",
        "Total ({0})" => "Total ({0})",
        "on disk" => "en disco",
        "size" => "tamaño",
        "Files" => "Archivos",
        "Folders" => "Carpetas",
        "On disk" => "En disco",
        "Contents" => "Contenido",
        "Name" => "Nombre",
        "Size" => "Tamaño",
        "Share" => "Proporción",
        "Modified" => "Modificado",
        "File types" => "Tipos de archivo",
        "Extension" => "Extensión",
        "no extension" => "sin extensión",
        "Largest files" => "Archivos más grandes",
        "File" => "Archivo",
        "{0} bytes" => "{0} bytes",
        "Made by Disq Studio {0} on {1} UTC. Sizes in binary units (1 KB = 1,024 bytes)." => {
            "Creado con Disq Studio {0} el {1} UTC. Tamaños en unidades binarias (1 KB = 1024 bytes)."
        }
        _ => return None,
    })
}

fn fr(text: &str) -> Option<&'static str> {
    Some(match text {
        // The daily check
        "{0} is getting full" => "{0} se remplit",
        "{0} free of {1} ({2}%). Open Disq Studio to see what's taking the space." => {
            "{0} libres sur {1} ({2} %). Ouvrez Disq Studio pour voir ce qui occupe l’espace."
        }
        "{0} grew {1}" => "{0} a grossi de {1}",
        "Since the scan of {0}: now {1} on disk. Open Disq Studio › History to see what grew." => {
            "Depuis l’analyse du {0} : maintenant {1} sur le disque. Ouvrez Disq Studio › Historique pour voir ce qui a grossi."
        }
        "Couldn't scan {0}" => "Impossible d’analyser {0}",
        "Disq Studio checked your drives" => "Disq Studio a vérifié vos lecteurs",
        "Nothing to report: every drive has room to spare." => "Rien à signaler : chaque lecteur a de la place.",
        "The scan was cancelled." => "L’analyse a été annulée.",
        // The HTML report
        "Disq Studio report" => "Rapport Disq Studio",
        "Disq Studio report: {0}" => "Rapport Disq Studio : {0}",
        " · filtered: only matching files count" => " · filtré : seuls les fichiers correspondants comptent",
        "Total ({0})" => "Total ({0})",
        "on disk" => "sur le disque",
        "size" => "taille",
        "Files" => "Fichiers",
        "Folders" => "Dossiers",
        "On disk" => "Sur le disque",
        "Contents" => "Contenu",
        "Name" => "Nom",
        "Size" => "Taille",
        "Share" => "Part",
        "Modified" => "Modifié",
        "File types" => "Types de fichiers",
        "Extension" => "Extension",
        "no extension" => "sans extension",
        "Largest files" => "Plus gros fichiers",
        "File" => "Fichier",
        "{0} bytes" => "{0} octets",
        "Made by Disq Studio {0} on {1} UTC. Sizes in binary units (1 KB = 1,024 bytes)." => {
            "Créé avec Disq Studio {0} le {1} UTC. Tailles en unités binaires (1 Ko = 1 024 octets)."
        }
        _ => return None,
    })
}

/// Size units: French writes octets (Ko, Mo, Go), as Windows does.
pub fn units() -> [&'static str; 5] {
    if current() == Language::French { ["Ko", "Mo", "Go", "To", "Po"] } else { ["KB", "MB", "GB", "TB", "PB"] }
}

/// A number with one or two decimals in the language's style: 1.50 or 1,50.
pub fn decimal(v: f64, digits: usize) -> String {
    let s = format!("{v:.digits$}");
    if current() == Language::English { s } else { s.replace('.', ",") }
}

/// A date as people write it in the language: 2026-11-03, 03.11.2026 or 03/11/2026.
pub fn date(ms: i64) -> String {
    let (y, m, d, ..) = crate::report::civil(ms);
    match current() {
        Language::English => format!("{y}-{m:02}-{d:02}"),
        Language::German => format!("{d:02}.{m:02}.{y}"),
        Language::Spanish | Language::French => format!("{d:02}/{m:02}/{y}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fills_in_and_falls_back() {
        store(Language::English);
        assert_eq!(tr("{0} grew {1}", &["C:", "12 GB"]), "C: grew 12 GB");
        store(Language::German);
        assert_eq!(tr("{0} grew {1}", &["C:", "12 GB"]), "C: ist um 12 GB gewachsen");
        assert_eq!(tr("Not in the table", &[]), "Not in the table");
        assert_eq!(decimal(1.5, 2), "1,50");
        assert_eq!(date(1_793_792_096_000), "04.11.2026");
        store(Language::Spanish);
        assert_eq!(tr("{0} grew {1}", &["C:", "12 GB"]), "C: ha crecido 12 GB");
        assert_eq!(date(1_793_792_096_000), "04/11/2026");
        store(Language::French);
        assert_eq!(tr("{0} is getting full", &["D:"]), "D: se remplit");
        assert_eq!(units()[2], "Go");
        assert_eq!(code(), "fr");
        store(Language::English);
    }

    #[test]
    fn every_language_has_every_sentence() {
        let keys = [
            "{0} is getting full",
            "{0} free of {1} ({2}%). Open Disq Studio to see what's taking the space.",
            "{0} grew {1}",
            "Since the scan of {0}: now {1} on disk. Open Disq Studio › History to see what grew.",
            "Couldn't scan {0}",
            "Disq Studio checked your drives",
            "Nothing to report: every drive has room to spare.",
            "The scan was cancelled.",
            "Disq Studio report",
            "Disq Studio report: {0}",
            " · filtered: only matching files count",
            "Total ({0})",
            "on disk",
            "size",
            "Files",
            "Folders",
            "On disk",
            "Contents",
            "Name",
            "Size",
            "Share",
            "Modified",
            "File types",
            "Extension",
            "no extension",
            "Largest files",
            "File",
            "{0} bytes",
            "Made by Disq Studio {0} on {1} UTC. Sizes in binary units (1 KB = 1,024 bytes).",
        ];
        let tables: [(&str, fn(&str) -> Option<&'static str>); 3] = [("de", de), ("es", es), ("fr", fr)];
        for k in keys {
            for (name, table) in tables {
                let own = table(k).unwrap_or_else(|| panic!("{name} has no {k:?}"));
                let holes = |s: &str| (0..4).filter(|i| s.contains(&format!("{{{i}}}"))).count();
                assert_eq!(holes(k), holes(own), "{name}: {k:?}");
            }
        }
    }
}
