/*
 * German. The key is the English text as it stands in the source; a key
 * that is missing here shows in English. `node scripts/i18n-wrap.mjs --keys`
 * lists every key, and src/lib/i18n.test.ts reports the ones without a
 * translation.
 *
 * Terms, as in Windows: the Recycle Bin is the "Papierkorb", on disk is
 * "auf Datenträger", a snapshot is a "Momentaufnahme". The cleanup basket
 * is the "Korb", so it isn't confused with the Papierkorb.
 */
export const de: Record<string, string> = {
  // ----- Window and toolbar -----
  "Minimise": "Minimieren",
  "Maximise": "Maximieren",
  "Restore": "Verkleinern",
  "Close window": "Fenster schließen",
  "Running as administrator: every folder can be read": "Läuft als Administrator: Jeder Ordner kann gelesen werden",
  "Admin": "Admin",
  "Theme: dark": "Design: dunkel",
  "Theme: light": "Design: hell",
  "Theme: follow Windows": "Design: wie Windows",
  "Something went wrong": "Etwas ist schiefgelaufen",
  "Scanning": "Wird gescannt",
  "No scan yet": "Noch kein Scan",
  "Measure sizes by": "Größen messen nach",
  "How long each file is, like Explorer's Size column": "Wie lang jede Datei ist, wie die Spalte „Größe“ im Explorer",
  "Space actually used on the drive: whole clusters, after compression, without online-only cloud files":
    "Tatsächlich belegter Platz auf dem Laufwerk: ganze Cluster, nach Komprimierung, ohne nur online verfügbare Cloud-Dateien",
  "Scan this location again": "Diesen Ort erneut scannen",
  "Rescan": "Neu scannen",
  "History: earlier scans, and what changed since": "Verlauf: frühere Scans und was sich seitdem geändert hat",
  "Export a report of the folder in view": "Einen Bericht über den angezeigten Ordner exportieren",
  "Cleanup basket: {0}": "Aufräumkorb: {0}",
  "Cleanup basket": "Aufräumkorb",
  "Hide details": "Details ausblenden",
  "Show details": "Details einblenden",
  "Settings": "Einstellungen",
  "Resize the folder list": "Breite der Ordnerliste ändern",
  "Drag to resize; double-click to reset": "Ziehen, um die Breite zu ändern; Doppelklick setzt sie zurück",
  "Location": "Ort",
  "Back": "Zurück",
  "Up one level": "Eine Ebene nach oben",
  "Chart": "Diagramm",
  "Treemap": "Treemap",
  "Treemap: blocks sized by space used": "Treemap: Blöcke nach belegtem Platz bemessen",
  "Sunburst": "Sunburst",
  "Sunburst: rings out from this folder, one per level": "Sunburst: Ringe von diesem Ordner nach außen, einer pro Ebene",
  "Map options": "Kartenoptionen",
  "Refreshing…": "Wird aktualisiert…",
  "Showing {0}": "Angezeigt: {0}",
  "Stop": "Beenden",
  "Colours by when files last changed": "Farben nach der letzten Änderung der Dateien",
  "Free space": "Freier Speicher",
  "File types: click one to show only that type": "Dateitypen: Klicken Sie auf einen, um nur diesen Typ anzuzeigen",
  "Stop showing only {0}": "Nicht mehr nur {0} anzeigen",
  "Show only {0}": "Nur {0} anzeigen",
  "Online only": "Nur online",
  "Report exported": "Bericht exportiert",
  "{0} in {1}": "{0} in {1}",
  "Dismiss": "Ausblenden",
  "Close": "Schließen",
  "View": "Ansicht",
  "Map": "Karte",
  "Duplicates": "Duplikate",
  "Cleanup": "Aufräumen",
  "Changes": "Änderungen",
  "Not for a snapshot: scan again to look for duplicates":
    "Nicht bei einer Momentaufnahme: Scannen Sie erneut, um nach Duplikaten zu suchen",
  "Not for a snapshot: scan again to clean up": "Nicht bei einer Momentaufnahme: Scannen Sie erneut, um aufzuräumen",
  "A filter is on: the map, lists and totals only count matching files":
    "Ein Filter ist aktiv: Karte, Listen und Summen zählen nur passende Dateien",
  "Filtered · {0} in {1}": "Gefiltert · {0} in {1}",
  "An earlier scan, opened from History. Nothing can be deleted from it; Rescan to see the drive as it is now.":
    "Ein früherer Scan, aus dem Verlauf geöffnet. Daraus kann nichts gelöscht werden; scannen Sie neu, um das Laufwerk im jetzigen Zustand zu sehen.",
  "Snapshot · {0}": "Momentaufnahme · {0}",
  "Online-only cloud files (OneDrive and similar). Their data isn't on this drive; switch to On disk to leave them out.":
    "Nur online verfügbare Cloud-Dateien (OneDrive und Ähnliches). Ihre Daten liegen nicht auf diesem Laufwerk; wechseln Sie zu „Auf Datenträger“, um sie auszulassen.",
  "{0} online only": "{0} nur online",
  "Folders left out by Settings › Folders to skip": "Ordner, die unter Einstellungen › Ausgelassene Ordner ausgelassen werden",
  "Read from the drive's file table in one go. Includes NTFS's own files ($MFT and others) and System Volume Information.":
    "In einem Zug aus der Dateitabelle des Laufwerks gelesen. Enthält die eigenen Dateien von NTFS ($MFT und andere) und System Volume Information.",
  "File table": "Dateitabelle",
  "Folders Windows didn't allow to be read, even as administrator. Their sizes aren't counted.":
    "Ordner, die Windows nicht lesen ließ, auch nicht als Administrator. Ihre Größe wird nicht gezählt.",
  "Folders your account isn't allowed to read; their sizes aren't counted. Click to restart as administrator and read them too.":
    "Ordner, die Ihr Konto nicht lesen darf; ihre Größe wird nicht gezählt. Klicken Sie, um als Administrator neu zu starten und auch diese zu lesen.",
  "Restart as administrator": "Als Administrator neu starten",

  // ----- Messages -----
  "Disq Studio {0} is available": "Disq Studio {0} ist verfügbar",
  "It installs in a moment, then Disq Studio starts again. Or later, from Settings › Updates.":
    "Das Update wird gleich installiert, dann startet Disq Studio neu. Oder später, unter Einstellungen › Updates.",
  "Install and restart": "Installieren und neu starten",
  "Refreshed {0}": "{0} aktualisiert",
  "Still {0}.": "Weiterhin {0}.",
  "Now {0}, {1} more than before.": "Jetzt {0}, {1} mehr als vorher.",
  "Now {0}, {1} less than before.": "Jetzt {0}, {1} weniger als vorher.",
  "Still running normally": "Läuft weiterhin normal",
  "Windows didn't get permission to restart Disq Studio as administrator.":
    "Windows hat keine Erlaubnis bekommen, Disq Studio als Administrator neu zu starten.",
  "Choose a folder to scan": "Ordner zum Scannen auswählen",
  "{0}. A folder goes as a whole only when everything in it matches; elsewhere just the matching files go, and nothing that doesn't match is touched.":
    "{0}. Ein Ordner wird nur dann als Ganzes entfernt, wenn alles darin passt; sonst werden nur die passenden Dateien entfernt, und was nicht passt, bleibt unberührt.",
  "Added {0} to the basket": "{0} in den Korb gelegt",
  "Already in the basket": "Schon im Korb",
  "The basket holds {0}, {1} on disk.": "Im Korb: {0}, {1} auf Datenträger.",
  "Open basket": "Korb öffnen",
  "Restored {0}": "{0} wiederhergestellt",
  "Nothing was restored": "Nichts wurde wiederhergestellt",
  "{0} in the Recycle Bin any more.": "{0} nicht mehr im Papierkorb.",
  "Everything is back where it was.": "Alles ist wieder dort, wo es war.",
  "{0} freed once the Recycle Bin is emptied.": "{0} frei, sobald der Papierkorb geleert wird.",
  "{0} freed.": "{0} freigegeben.",
  "{0} deleted permanently, as you chose.": "{0} endgültig gelöscht, wie gewählt.",
  "1 item was kept: Windows would have deleted it permanently.":
    "1 Element wurde behalten: Windows hätte es endgültig gelöscht.",
  "{0} items were kept: Windows would have deleted them permanently.":
    "{0} Elemente wurden behalten: Windows hätte sie endgültig gelöscht.",
  "1 item was skipped, most likely because a program is using it: {0}":
    "1 Element wurde übersprungen, wahrscheinlich weil ein Programm es verwendet: {0}",
  "{0} items were skipped, most likely because a program is using them: {1}{2}":
    "{0} Elemente wurden übersprungen, wahrscheinlich weil ein Programm sie verwendet: {1}{2}",
  "Moved {0} to the Recycle Bin": "{0} in den Papierkorb verschoben",
  "Deleted {0} permanently": "{0} endgültig gelöscht",
  "Nothing was removed": "Nichts wurde entfernt",
  "Undo": "Rückgängig",
  "Replaced {0} with links": "{0} durch Links ersetzt",
  "Nothing was replaced": "Nichts wurde ersetzt",
  "{0} freed. Every file still opens under its own name.": "{0} freigegeben. Jede Datei öffnet sich weiterhin unter ihrem eigenen Namen.",
  "{0} skipped: {1}{2}": "{0} übersprungen: {1}{2}",
  "Nothing in the basket is in the scan any more.": "Nichts im Korb ist noch im Scan.",
  "What goes is taken out of the basket.": "Was entfernt wird, wird aus dem Korb genommen.",

  // ----- Words counted with plural() -----
  "file": "Datei",
  "files": "Dateien",
  "matching file": "passende Datei",
  "matching files": "passende Dateien",
  "folder": "Ordner",
  "folders": "Ordner",
  "item": "Element",
  "items": "Elemente",
  "item selected": "Element ausgewählt",
  "items selected": "Elemente ausgewählt",
  "item was": "Element wurde",
  "items were": "Elemente wurden",
  "item wasn't": "Element war",
  "items weren't": "Elemente waren",
  "copy": "Kopie",
  "copies": "Kopien",
  "copy was": "Kopie wurde",
  "copies were": "Kopien wurden",
  "group": "Gruppe",
  "groups": "Gruppen",
  "hash": "Prüfsumme",
  "hashes": "Prüfsummen",
  "row": "Zeile",
  "rows": "Zeilen",

  // ----- Selection and context menu -----
  "Copy paths": "Pfade kopieren",
  "Clear selection": "Auswahl aufheben",
  "Add to basket": "In den Korb legen",
  "Move {0} to Recycle Bin": "{0} in den Papierkorb verschieben",
  "Zoom in": "Hineinzoomen",
  "Refresh this folder": "Diesen Ordner aktualisieren",
  "Try reading it again": "Erneut zu lesen versuchen",
  "Open": "Öffnen",
  "Show in Explorer": "Im Explorer zeigen",
  "Copy path": "Pfad kopieren",
  "Move to Recycle Bin": "In den Papierkorb verschieben",
  "Colour files by": "Dateien färben nach",
  "File type": "Dateityp",
  "Age (last changed)": "Alter (letzte Änderung)",
  "Cushion shading": "Kissenschattierung",
  "All drives": "Alle Laufwerke",

  // ----- Basket -----
  "The basket is empty": "Der Korb ist leer",
  "Add things from the map (right-click › Add to basket), from Duplicates or from Cleanup, then recycle them all here in one go.":
    "Legen Sie Dinge aus der Karte (Rechtsklick › In den Korb legen), aus Duplikate oder aus Aufräumen hinein und verschieben Sie hier alles auf einmal in den Papierkorb.",
  "{0}, about {1} on disk. Nothing is removed until you recycle them.":
    "{0}, etwa {1} auf Datenträger. Nichts wird entfernt, bevor Sie sie in den Papierkorb verschieben.",
  "Take {0} out of the basket": "{0} aus dem Korb nehmen",
  "Empty the basket": "Korb leeren",
  "Recycle all": "Alle in den Papierkorb",

  // ----- Changes -----
  "Folder by folder": "Ordner für Ordner",
  "Grew": "Gewachsen",
  "Shrank": "Geschrumpft",
  "New": "Neu",
  "Gone": "Entfernt",
  "on disk": "auf Datenträger",
  "size": "Größe",
  "Changes since a snapshot": "Änderungen seit einer Momentaufnahme",
  "Changes in {0} since": "Änderungen in {0} seit",
  "Stop comparing": "Vergleich beenden",
  "Then": "Damals",
  "Now": "Jetzt",
  "Change": "Änderung",
  "By {0}. Files: {1} then, {2} now. Items are matched by path.":
    "Nach {0}. Dateien: damals {1}, jetzt {2}. Elemente werden über ihren Pfad zugeordnet.",
  "Show": "Anzeigen",
  "Folder": "Ordner",
  "Comparing": "Wird verglichen",
  "Nothing here": "Hier ist nichts",
  "This folder is empty in both scans.": "Dieser Ordner ist in beiden Scans leer.",
  "No items of this kind changed.": "Keine Elemente dieser Art haben sich geändert.",
  "Show on the map": "Auf der Karte zeigen",
  "The largest new or gone items; a new folder is listed once, not every file in it.":
    "Die größten neuen oder entfernten Elemente; ein neuer Ordner wird einmal aufgeführt, nicht jede Datei darin.",
  "Up to 150 files that changed most. Folders are compared on the Folder by folder tab.":
    "Bis zu 150 Dateien, die sich am stärksten geändert haben. Ordner werden auf dem Tab „Ordner für Ordner“ verglichen.",

  // ----- Cleanup -----
  "Cleanup suggestions": "Aufräumvorschläge",
  "Cleanup suggestions in": "Aufräumvorschläge in",
  "Caches, temp files and build output that apps rebuild on their own":
    "Caches, temporäre Dateien und Build-Ausgaben, die Apps von selbst neu erstellen",
  "Look again": "Erneut suchen",
  "Looking for junk": "Suche nach Überflüssigem",
  "Nothing to clean up here": "Hier gibt es nichts aufzuräumen",
  "No caches, temp files or build output of 1 MB or more were found in this scan.":
    "In diesem Scan wurden keine Caches, temporären Dateien oder Build-Ausgaben ab 1 MB gefunden.",
  "Safe to remove": "Sicher entfernbar",
  "Review first": "Erst prüfen",
  "Selected": "Ausgewählt",
  "Select everything safe": "Alles Sichere auswählen",
  "Clear": "Leeren",
  "Select all {0}": "Alle {0} auswählen",
  "Safe": "Sicher",
  "For information": "Zur Information",
  "Select {0}": "{0} auswählen",
  "Show fewer": "Weniger anzeigen",
  "Show all {0}": "Alle {0} anzeigen",
  " (largest {0} of {1})": " (die größten {0} von {1})",
  "{0} selected · frees about {1}": "{0} ausgewählt · gibt etwa {1} frei",
  "Tick what you want gone. Nothing is removed until you confirm.":
    "Haken Sie an, was weg soll. Nichts wird entfernt, bevor Sie bestätigen.",
  "Collect them in the basket and recycle everything there in one go":
    "Im Korb sammeln und dort alles auf einmal in den Papierkorb verschieben",
  "Files a program is still using are skipped and listed afterwards.":
    "Dateien, die ein Programm noch verwendet, werden übersprungen und danach aufgeführt.",
  // Categories from the Rust side (junk.rs)
  "Temporary files": "Temporäre Dateien",
  "Files programs leave behind in the temp folders. Anything still in use is skipped.":
    "Dateien, die Programme in den Temp-Ordnern zurücklassen. Was noch verwendet wird, wird übersprungen.",
  "Browser and app caches": "Browser- und App-Caches",
  "Copies of web pages, images and scripts kept to load faster. They refill as you browse.":
    "Kopien von Webseiten, Bildern und Skripten, damit sie schneller laden. Sie füllen sich beim Surfen wieder.",
  "Graphics shader caches": "Shader-Caches der Grafik",
  "Compiled shaders from graphics drivers and games. Rebuilt the next time each game runs.":
    "Kompilierte Shader von Grafiktreibern und Spielen. Werden beim nächsten Start des jeweiligen Spiels neu erstellt.",
  "Crash dumps and error reports": "Absturzabbilder und Fehlerberichte",
  "Memory dumps and reports written when programs crash. Only useful for debugging.":
    "Speicherabbilder und Berichte, die beim Absturz von Programmen geschrieben werden. Nur zur Fehlersuche nützlich.",
  "Windows Update downloads": "Downloads von Windows Update",
  "Update packages that were already installed. Removing them may need administrator rights.":
    "Updatepakete, die schon installiert wurden. Zum Entfernen können Administratorrechte nötig sein.",
  "Developer build output": "Build-Ausgaben für Entwickler",
  "node_modules, Rust target folders and Python caches. Rebuilt by npm install, cargo build and so on.":
    "node_modules, Rust-target-Ordner und Python-Caches. Werden von npm install, cargo build usw. neu erstellt.",
  "Package manager caches": "Caches von Paketmanagern",
  "Downloaded packages kept by npm, pip, Cargo, NuGet, Gradle and Yarn. Downloaded again when needed.":
    "Heruntergeladene Pakete von npm, pip, Cargo, NuGet, Gradle und Yarn. Werden bei Bedarf erneut heruntergeladen.",
  "Teams and Slack caches": "Caches von Teams und Slack",
  "Cached messages, pictures and web pages of Microsoft Teams and Slack. Quit them first; they may ask you to sign in again.":
    "Zwischengespeicherte Nachrichten, Bilder und Webseiten von Microsoft Teams und Slack. Beenden Sie die Apps zuerst; danach müssen Sie sich eventuell neu anmelden.",
  "Large log files": "Große Protokolldateien",
  "Log files of 1 MB or more. Usually safe, but check none is a log you need.":
    "Protokolldateien ab 1 MB. Meist unbedenklich, aber prüfen Sie, dass keines davon ein Protokoll ist, das Sie brauchen.",
  "Old installers in Downloads": "Alte Installer in Downloads",
  "Setup files in Downloads not changed for 30 days or more. Usually no longer needed once installed.":
    "Setup-Dateien in Downloads, die seit 30 Tagen oder länger nicht geändert wurden. Nach der Installation meist nicht mehr nötig.",
  "Big files not opened in a year": "Große Dateien, seit einem Jahr nicht geöffnet",
  "Files of 100 MB or more that nobody has opened or changed for a year. Check each one: some are kept on purpose, like backups.":
    "Dateien ab 100 MB, die seit einem Jahr niemand geöffnet oder geändert hat. Prüfen Sie jede einzeln: Manche werden absichtlich aufbewahrt, etwa Sicherungen.",
  "Your rules": "Ihre Regeln",
  "Matches for the rules in Settings › Cleanup rules.": "Treffer für die Regeln unter Einstellungen › Aufräumregeln.",
  "WSL and Docker disk images": "Datenträgerabbilder von WSL und Docker",
  "Virtual disks of Linux distributions and Docker. Deleting one erases everything in it, so they can't be selected here. To shrink them, use docker system prune or wsl --manage <distro> --set-sparse true.":
    "Virtuelle Datenträger von Linux-Distributionen und Docker. Wer einen löscht, löscht alles darin, deshalb können sie hier nicht ausgewählt werden. Zum Verkleinern verwenden Sie docker system prune oder wsl --manage <distro> --set-sparse true.",

  // ----- Confirmations -----
  "Delete {0} permanently?": "{0} endgültig löschen?",
  "Move {0} to the Recycle Bin?": "{0} in den Papierkorb verschieben?",
  "This can't be undone": "Das kann nicht rückgängig gemacht werden",
  "Nothing goes to the Recycle Bin: 1 item ({0}) will be deleted for good, with no way to restore it.":
    "Nichts kommt in den Papierkorb: 1 Element ({0}) wird endgültig gelöscht und kann nicht wiederhergestellt werden.",
  "Nothing goes to the Recycle Bin: {0} items ({1}) will be deleted for good, with no way to restore them.":
    "Nichts kommt in den Papierkorb: {0} Elemente ({1}) werden endgültig gelöscht und können nicht wiederhergestellt werden.",
  "This frees about {0} once the Recycle Bin is emptied, and you can restore anything from there until then.":
    "Das gibt etwa {0} frei, sobald der Papierkorb geleert wird, und bis dahin können Sie alles von dort wiederherstellen.",
  "Delete permanently": "Endgültig löschen",
  "Delete permanently…": "Endgültig löschen…",
  "Cancel": "Abbrechen",
  "Delete permanently?": "Endgültig löschen?",
  "Move to Recycle Bin?": "In den Papierkorb verschieben?",
  "It won't go to the Recycle Bin: it will be deleted for good, with no way to restore it.":
    "Es kommt nicht in den Papierkorb: Es wird endgültig gelöscht und kann nicht wiederhergestellt werden.",

  // ----- Recycle Bin check -----
  "Couldn't check the Recycle Bin": "Der Papierkorb konnte nicht geprüft werden",
  "Checking the Recycle Bin…": "Papierkorb wird geprüft…",
  "about {0}": "etwa {0}",
  "These can't go to the Recycle Bin": "Diese können nicht in den Papierkorb",
  "{0} can't go to the Recycle Bin": "{0} kann nicht in den Papierkorb",
  "Windows would delete it permanently, with no way to restore it: {0}.":
    "Windows würde es endgültig löschen, ohne Möglichkeit zur Wiederherstellung: {0}.",
  "Windows would delete them permanently, with no way to restore them.":
    "Windows würde sie endgültig löschen, ohne Möglichkeit zur Wiederherstellung.",
  "Windows would delete these permanently, with no way to restore them.":
    "Windows würde diese endgültig löschen, ohne Möglichkeit zur Wiederherstellung.",
  "and {0} more": "und {0} weitere",
  "Delete it permanently ({0})": "Endgültig löschen ({0})",
  "Delete these {0} permanently ({1})": "Diese {0} endgültig löschen ({1})",
  "Left unticked, they're skipped and everything else goes to the Recycle Bin.":
    "Ohne Haken werden sie übersprungen, und alles andere kommt in den Papierkorb.",
  "The Recycle Bin will make room": "Der Papierkorb wird Platz schaffen",
  "The Recycle Bin on {0} holds {1} and already has {2}. Windows will permanently remove about {3} of the oldest things in it to fit these.":
    "Der Papierkorb auf {0} fasst {1} und enthält schon {2}. Windows entfernt endgültig etwa {3} der ältesten Dinge darin, damit diese hineinpassen.",
  "Online-only OneDrive files skip the Recycle Bin": "Nur online verfügbare OneDrive-Dateien umgehen den Papierkorb",
  "This holds {0} of files that are only in the cloud.": "Das enthält {0} an Dateien, die nur in der Cloud liegen.",
  "1 of these holds {0} of files that are only in the cloud.": "1 davon enthält {0} an Dateien, die nur in der Cloud liegen.",
  "{0} of these hold {1} of files that are only in the cloud.": "{0} davon enthalten {1} an Dateien, die nur in der Cloud liegen.",
  "Deleting them removes them from OneDrive on all your devices. They can be restored from the OneDrive recycle bin on the web for 30 days (93 for work or school accounts), but not from Windows' Recycle Bin, and Undo can't bring them back.":
    "Beim Löschen verschwinden sie aus OneDrive auf all Ihren Geräten. Sie lassen sich 30 Tage lang (93 bei Geschäfts- oder Schulkonten) aus dem OneDrive-Papierkorb im Web wiederherstellen, aber nicht aus dem Windows-Papierkorb, und „Rückgängig“ kann sie nicht zurückholen.",
  "Everything fits in the Recycle Bin on {0} ({1} of {2} used), so it can all be restored.":
    "Alles passt in den Papierkorb auf {0} ({1} von {2} belegt), also lässt sich alles wiederherstellen.",
  "Everything fits in the Recycle Bin on {0}, so it can all be restored.":
    "Alles passt in den Papierkorb auf {0}, also lässt sich alles wiederherstellen.",
  "Nothing can be recycled": "Nichts kann in den Papierkorb",
  "Recycle and delete the rest": "In den Papierkorb, den Rest löschen",
  "Recycle {0}, skip {1}": "{0} in den Papierkorb, {1} überspringen",
  // Reasons from the Rust side (recyclebin.rs)
  "{0} has no Recycle Bin": "{0} hat keinen Papierkorb",
  "the Recycle Bin on {0} is set to delete files right away": "der Papierkorb auf {0} ist so eingestellt, dass er Dateien sofort löscht",
  "bigger than the Recycle Bin on {0}, which holds {1}": "größer als der Papierkorb auf {0}, der {1} fasst",

  // ----- Duplicates -----
  "Duplicate files": "Doppelte Dateien",
  "Find duplicates in": "Duplikate suchen in",
  "Only files that match the filter are compared": "Nur Dateien, die zum Filter passen, werden verglichen",
  "Files from": "Dateien ab",
  "Smallest file to check": "Kleinste zu prüfende Datei",
  "Search again": "Erneut suchen",
  "Find duplicates": "Duplikate suchen",
  "Comparing whole files": "Ganze Dateien werden verglichen",
  "Comparing the start and end of same-size files": "Anfang und Ende gleich großer Dateien werden verglichen",
  "{0} of {1} files": "{0} von {1} Dateien",
  "Starting…": "Wird gestartet…",
  " · {0} read · {1}": " · {0} gelesen · {1}",
  "Duplicate search progress": "Fortschritt der Duplikatsuche",
  "Find files that are stored more than once": "Dateien finden, die mehrfach gespeichert sind",
  "Disq Studio compares files of the same size, first by their start and end, then by their whole contents. Online-only cloud files are skipped, so nothing gets downloaded, and files that haven't changed since an earlier search aren't read again.":
    "Disq Studio vergleicht gleich große Dateien, zuerst an Anfang und Ende, dann am ganzen Inhalt. Nur online verfügbare Cloud-Dateien werden übersprungen, damit nichts heruntergeladen wird, und Dateien, die sich seit einer früheren Suche nicht geändert haben, werden nicht erneut gelesen.",
  "Can be freed": "Kann freigegeben werden",
  "Extra copies": "Zusätzliche Kopien",
  "Groups": "Gruppen",
  "In {0}: checked {1} with a same-size twin in {2}.": "In {0}: {1} mit einem gleich großen Gegenstück in {2} geprüft.",
  " {0} remembered from earlier searches.": " {0} aus früheren Suchen übernommen.",
  " {0} couldn't be read.": " {0} nicht lesbar.",
  " Showing the {0} groups that waste the most.": " Angezeigt werden die {0} Gruppen, die am meisten verschwenden.",
  " The scan has changed since; search again for current results.":
    " Der Scan hat sich seitdem geändert; suchen Sie erneut für aktuelle Ergebnisse.",
  "No duplicates found": "Keine Duplikate gefunden",
  "No two files of {0} or more have the same contents here.": "Hier haben keine zwei Dateien ab {0} denselben Inhalt.",
  "Only groups with a copy in… (path or *pattern)": "Nur Gruppen mit einer Kopie in… (Pfad oder *Muster)",
  "Show only groups with a copy whose path matches": "Nur Gruppen mit einer Kopie anzeigen, deren Pfad passt",
  "All types": "Alle Typen",
  "Highlight the extra copies (all but the oldest of each) on the map":
    "Die zusätzlichen Kopien (alle außer der ältesten jeder Gruppe) auf der Karte hervorheben",
  "{0} of duplicate files": "{0} an doppelten Dateien",
  "Show on map": "Auf der Karte zeigen",
  "Select extra copies in the groups shown:": "Zusätzliche Kopien in den angezeigten Gruppen auswählen:",
  "Select extra copies:": "Zusätzliche Kopien auswählen:",
  "Keep oldest": "Älteste behalten",
  "Keep newest": "Neueste behalten",
  "Keep shortest path": "Kürzesten Pfad behalten",
  "No groups match": "Keine Gruppe passt",
  "No duplicate group has a copy matching that path and type.":
    "Keine Duplikatgruppe hat eine Kopie, die zu diesem Pfad und Typ passt.",
  "Keep at least one copy": "Mindestens eine Kopie behalten",
  "Select every copy in {0}": "Jede Kopie in {0} auswählen",
  "Show {0} more groups": "{0} weitere Gruppen anzeigen",
  "{0} selected · frees {1}": "{0} ausgewählt · gibt {1} frei",
  "Select the copies you don't need. One copy in each group always stays.":
    "Wählen Sie die Kopien aus, die Sie nicht brauchen. Eine Kopie jeder Gruppe bleibt immer erhalten.",
  "Keep every name, but store the data once: each selected copy becomes a hard link to the copy that stays":
    "Jeden Namen behalten, die Daten aber nur einmal speichern: Jede ausgewählte Kopie wird ein Hardlink auf die verbleibende Kopie",
  "Replace with links": "Durch Links ersetzen",
  "Replace {0} with links?": "{0} durch Links ersetzen?",
  "Every file stays where it is and opens as before, but the data is stored once, freeing about {0}. Each selected copy becomes a hard link: another name for the copy that stays.":
    "Jede Datei bleibt, wo sie ist, und öffnet sich wie bisher, aber die Daten werden nur einmal gespeichert, was etwa {0} freigibt. Jede ausgewählte Kopie wird ein Hardlink: ein weiterer Name für die verbleibende Kopie.",
  "Linked names share one file": "Verknüpfte Namen teilen sich eine Datei",
  "Editing a linked file changes it under every name. Use this for files you only keep, like photos, music, installers or downloads, not for copies you mean to edit separately. Copies that changed since the search, or are on another drive, are skipped.":
    "Wer eine verknüpfte Datei bearbeitet, ändert sie unter jedem Namen. Nutzen Sie das für Dateien, die Sie nur aufbewahren, etwa Fotos, Musik, Installer oder Downloads, nicht für Kopien, die Sie getrennt bearbeiten wollen. Kopien, die sich seit der Suche geändert haben oder auf einem anderen Laufwerk liegen, werden übersprungen.",
  // Errors from the Rust side (dupes.rs)
  "{0} changed since the search": "{0} hat sich seit der Suche geändert",
  "already the same file": "schon dieselbe Datei",
  "the contents differ now": "der Inhalt unterscheidet sich jetzt",

  // ----- Export -----
  "Web page": "Webseite",
  "A report to read or share: totals, contents with bars, file types, largest files.":
    "Ein Bericht zum Lesen oder Weitergeben: Summen, Inhalt mit Balken, Dateitypen, größte Dateien.",
  "One row per item, for Excel or another spreadsheet.": "Eine Zeile pro Element, für Excel oder eine andere Tabellenkalkulation.",
  "One object per item, for scripts and other tools.": "Ein Objekt pro Element, für Skripte und andere Werkzeuge.",
  "1 level": "1 Ebene",
  "2 levels": "2 Ebenen",
  "3 levels": "3 Ebenen",
  "Everything": "Alles",
  "Any size": "Jede Größe",
  "1 MB or more": "Ab 1 MB",
  "100 MB or more": "Ab 100 MB",
  "1 GB or more": "Ab 1 GB",
  "Disk": "Datenträger",
  "Export a report": "Bericht exportieren",
  "{0} - Disq Studio report.{1}": "{0} - Disq-Studio-Bericht.{1}",
  "Export": "Exportieren",
  "Format": "Format",
  "How deep": "Wie tief",
  "Levels of folders below {0}.": "Ordnerebenen unterhalb von {0}.",
  "Leave out items smaller than": "Elemente auslassen, die kleiner sind als",
  "Include files": "Dateien einschließen",
  "Off: folders only.": "Aus: nur Ordner.",
  "Every item, of any size: for a whole drive that's a file with millions of rows.":
    "Jedes Element jeder Größe: Für ein ganzes Laufwerk ist das eine Datei mit Millionen Zeilen.",
  "A filter is on, so only matching files are counted, as on screen.":
    "Ein Filter ist aktiv, daher werden wie auf dem Bildschirm nur passende Dateien gezählt.",
  "Export…": "Exportieren…",

  // ----- Filter -----
  "Any time": "Jederzeit",
  "Changed in the last 30 days": "In den letzten 30 Tagen geändert",
  "Not changed for 1 year": "Seit 1 Jahr nicht geändert",
  "Not changed for 3 years": "Seit 3 Jahren nicht geändert",
  "This search is saved": "Diese Suche ist gespeichert",
  "Save this search": "Diese Suche speichern",
  "Saved searches": "Gespeicherte Suchen",
  "Forget this search": "Diese Suche vergessen",
  "Search names: node_modules *.js, *.mp4|*.mkv, -*.log, Users\\Me\\Videos…":
    "Namen suchen: node_modules *.js, *.mp4|*.mkv, -*.log, Users\\Ich\\Videos…",
  "Search file and folder names. Separate terms with spaces; all must match. a|b matches either, -term leaves matches out, a term with a backslash matches the full path.":
    "Datei- und Ordnernamen suchen. Begriffe durch Leerzeichen trennen; alle müssen passen. a|b passt auf eines von beiden, -begriff lässt Treffer aus, ein Begriff mit einem umgekehrten Schrägstrich passt auf den ganzen Pfad.",
  "Terms separated by spaces must all match a name or a folder above it. a|b: either. -term: leave out. A term with \\ matches the full path. Quotes keep spaces.":
    "Durch Leerzeichen getrennte Begriffe müssen alle auf einen Namen oder einen Ordner darüber passen. a|b: eines von beiden. -begriff: auslassen. Ein Begriff mit \\ passt auf den ganzen Pfad. Anführungszeichen erhalten Leerzeichen.",
  "Ctrl+F": "Strg+F",
  "File types": "Dateitypen",
  "Minimum file size": "Mindestgröße der Dateien",
  "Last changed": "Zuletzt geändert",
  "Filtering": "Wird gefiltert",

  // ----- Folder list -----
  "Folder contents": "Ordnerinhalt",
  "List": "Liste",
  "Matches": "Treffer",
  "This folder": "Dieser Ordner",
  "Move every match to the Recycle Bin, after a check of what the Recycle Bin can take":
    "Alle Treffer in den Papierkorb verschieben, nachdem geprüft wurde, was der Papierkorb aufnehmen kann",
  "Contents of {0}": "Inhalt von {0}",
  "Loading": "Wird geladen",
  "Nothing in this folder matches": "Nichts in diesem Ordner passt",
  "This folder is empty": "Dieser Ordner ist leer",
  " · {0} online only": " · {0} nur online",
  "{0} · couldn't be read": "{0} · konnte nicht gelesen werden",
  "{0} · skipped by Settings › Folders to skip, so its size isn't counted":
    "{0} · durch Einstellungen › Ausgelassene Ordner ausgelassen, daher wird die Größe nicht gezählt",
  "{0} · hard link, counted once under its other name": "{0} · Hardlink, einmal unter seinem anderen Namen gezählt",
  "Columns": "Spalten",
  " (needs a wider list)": " (braucht eine breitere Liste)",
  "Sort by {0}": "Nach {0} sortieren",
  "Resize {0}": "Breite von {0} ändern",
  "Nothing matches": "Nichts passt",
  "Try fewer terms or conditions, or part of a name instead of all of it.":
    "Versuchen Sie weniger Begriffe oder Bedingungen, oder einen Teil eines Namens statt des ganzen.",
  "Showing the largest {0} of {1} matches": "Angezeigt werden die größten {0} von {1} Treffern",
  "Name": "Name",
  "Share": "Anteil",

  // ----- History -----
  "Save this scan as a snapshot": "Diesen Scan als Momentaufnahme speichern",
  "Disq Studio snapshot.dss": "Disq Studio Momentaufnahme.dss",
  "Compare with a snapshot": "Mit einer Momentaufnahme vergleichen",
  "Open a snapshot": "Eine Momentaufnahme öffnen",
  "History": "Verlauf",
  " of {0}": " von {0}",
  "Each finished scan is kept as a snapshot (the newest 8 of each location), so you can see what changed since. Compare one with the scan in view, or open it to look around as it was.":
    "Jeder abgeschlossene Scan wird als Momentaufnahme aufbewahrt (die neuesten 8 jedes Orts), damit Sie sehen, was sich seitdem geändert hat. Vergleichen Sie eine mit dem angezeigten Scan, oder öffnen Sie sie, um sich umzusehen, wie es damals war.",
  "Show snapshots of every location": "Momentaufnahmen aller Orte anzeigen",
  "Reading the history": "Verlauf wird gelesen",
  "No snapshots yet": "Noch keine Momentaufnahmen",
  "Save one now, or it'll be saved after the next scan.": "Speichern Sie jetzt eine, sonst wird nach dem nächsten Scan eine gespeichert.",
  "Scan a drive or folder to start the history.": "Scannen Sie ein Laufwerk oder einen Ordner, um den Verlauf zu beginnen.",
  "{0} on disk · {1}": "{0} auf Datenträger · {1}",
  " · {0} since": " · {0} seitdem",
  "Compare": "Vergleichen",
  "Delete this snapshot": "Diese Momentaufnahme löschen",
  "{0} of snapshots.": "{0} an Momentaufnahmen.",
  "Show folder": "Ordner zeigen",
  "Open a file…": "Eine Datei öffnen…",
  "Compare with a file…": "Mit einer Datei vergleichen…",
  "Save as…": "Speichern unter…",
  "Save snapshot now": "Momentaufnahme jetzt speichern",

  // ----- Home -----
  "See what's filling your drive.": "Sehen Sie, was Ihr Laufwerk füllt.",
  "Pick a drive or folder. Disq Studio reads it on every core, then draws each file as a block sized by the space it takes, so the biggest things are impossible to miss.":
    "Wählen Sie ein Laufwerk oder einen Ordner. Disq Studio liest es auf allen Kernen und zeichnet dann jede Datei als Block in der Größe des Platzes, den sie belegt, sodass die größten Dinge nicht zu übersehen sind.",
  "Refresh drives": "Laufwerke aktualisieren",
  "Looking for drives": "Laufwerke werden gesucht",
  "Local Disk": "Lokaler Datenträger",
  "Drive": "Laufwerk",
  "Unknown": "Unbekannt",
  "{0}% used": "{0} % belegt",
  "{0} free of {1}": "{0} von {1} frei",
  "Choose a folder…": "Ordner auswählen…",
  "Scan just one folder and what's inside it": "Nur einen Ordner und seinen Inhalt scannen",

  // ----- Details -----
  "Takes {0} more on disk than its size. Many small files waste the unused end of each cluster.":
    "Belegt auf dem Datenträger {0} mehr als seine Größe. Viele kleine Dateien verschwenden das ungenutzte Ende jedes Clusters.",
  "Online only: the data is in the cloud, not on this drive. Opening it downloads it.":
    "Nur online: Die Daten liegen in der Cloud, nicht auf diesem Laufwerk. Beim Öffnen werden sie heruntergeladen.",
  "Takes no space of its own: it's small enough to live in the file table.":
    "Belegt keinen eigenen Platz: Es ist klein genug, um in der Dateitabelle zu stehen.",
  "Takes {0} less on disk than its size, because {1} of it is online only.":
    "Belegt auf dem Datenträger {0} weniger als seine Größe, weil {1} davon nur online liegen.",
  "Takes {0} less on disk than its size: {1} is online only, the rest is saved by compression or sparse files.":
    "Belegt auf dem Datenträger {0} weniger als seine Größe: {1} liegen nur online, den Rest sparen Komprimierung oder Sparse-Dateien.",
  "Takes {0} less on disk than its size, from compression or sparse files.":
    "Belegt auf dem Datenträger {0} weniger als seine Größe, durch Komprimierung oder Sparse-Dateien.",
  "Details": "Details",
  "Selection": "Auswahl",
  "Adding up the selection": "Auswahl wird zusammengezählt",
  "matching the filter, on disk": "passend zum Filter, auf Datenträger",
  "matching the filter, size": "passend zum Filter, Größe",
  "Size": "Größe",
  "On disk": "Auf Datenträger",
  "Files": "Dateien",
  "Inside others": "In anderen enthalten",
  "Selected items that are inside another selected folder; they're counted with it":
    "Ausgewählte Elemente, die in einem anderen ausgewählten Ordner liegen; sie werden mit diesem gezählt",
  "Recycle": "In den Papierkorb",
  "Recycle {0}": "{0} in den Papierkorb",
  "Ctrl+click adds or removes an item; Shift+click in the list selects a range.":
    "Strg+Klick fügt ein Element hinzu oder entfernt es; Umschalt+Klick in der Liste wählt einen Bereich aus.",
  "Current folder": "Aktueller Ordner",
  "File": "Datei",
  "Hard links here that point at data counted under another name":
    "Hardlinks hier, die auf Daten zeigen, die unter einem anderen Namen gezählt werden",
  "Hard links": "Hardlinks",
  "counted once": "einmal gezählt",
  "Of parent folder": "Vom übergeordneten Ordner",
  "Of whole scan": "Vom ganzen Scan",
  "Folders": "Ordner",
  "Modified": "Geändert",
  "Bytes": "Bytes",
  "Hard link": "Hardlink",
  "The same {0} of data also has another name, and it's counted there so it isn't counted twice. Recycling only this name frees no space.":
    "Dieselben {0} an Daten haben noch einen anderen Namen und werden dort gezählt, damit sie nicht doppelt zählen. Nur diesen Namen in den Papierkorb zu verschieben, gibt keinen Platz frei.",
  "Select the counted name": "Den gezählten Namen auswählen",
  "Skipped because it's in Settings › Folders to skip, so its size isn't counted.":
    "Ausgelassen, weil es unter Einstellungen › Ausgelassene Ordner steht, daher wird die Größe nicht gezählt.",
  "Windows didn't allow this folder to be read, so its size isn't counted.":
    "Windows ließ diesen Ordner nicht lesen, daher wird seine Größe nicht gezählt.",
  "File types in {0}": "Dateitypen in {0}",
  "Counting file types": "Dateitypen werden gezählt",
  "No files here.": "Hier sind keine Dateien.",
  "Share of space by file type": "Anteil am Platz nach Dateityp",
  "Top extensions": "Häufigste Endungen",
  "no extension": "ohne Endung",
  "Largest files": "Größte Dateien",
  "Finding the largest files": "Größte Dateien werden gesucht",

  // ----- Scan -----
  "Scan progress": "Scanfortschritt",
  " · {0} folders skipped": " · {0} Ordner übersprungen",

  // ----- Settings -----
  "Dark": "Dunkel",
  "Light": "Hell",
  "Follow Windows": "Wie Windows",
  "Downloading…": "Wird heruntergeladen…",
  "Downloading… {0}%": "Wird heruntergeladen… {0} %",
  "Export settings": "Einstellungen exportieren",
  "Disq Studio settings.json": "Disq Studio Einstellungen.json",
  "Saved to {0}.": "Gespeichert unter {0}.",
  "Import settings": "Einstellungen importieren",
  "Choose a folder Disq Studio should skip": "Ordner auswählen, den Disq Studio auslassen soll",
  "Appearance": "Darstellung",
  "Theme": "Design",
  "Language": "Sprache",
  "Applies when Disq Studio starts again.": "Gilt, sobald Disq Studio neu startet.",
  "Restart now": "Jetzt neu starten",
  "Accent colour": "Akzentfarbe",
  "Sizes": "Größen",
  "Measure by": "Messen nach",
  "Size is how long files are; on disk is the space they really take.":
    "Größe ist, wie lang Dateien sind; auf Datenträger ist der Platz, den sie wirklich belegen.",
  "Units": "Einheiten",
  "Matches Explorer: a 500 GB drive shows as about 466 GB.": "Wie im Explorer: Ein 500-GB-Laufwerk erscheint als etwa 466 GB.",
  "Matches the box: a 500 GB drive shows as 500 GB.": "Wie auf der Verpackung: Ein 500-GB-Laufwerk erscheint als 500 GB.",
  "Like Windows (1,024)": "Wie Windows (1.024)",
  "Decimal (1,000)": "Dezimal (1.000)",
  "Folders to skip": "Ausgelassene Ordner",
  "These are never read. They show up as skipped, with no size, in every scan that would include them. Add a folder, or a name to skip wherever it is: {0} skips every folder of that name, {1} any with \"cache\" in it, {2} that path ending.":
    "Diese werden nie gelesen. Sie erscheinen als ausgelassen, ohne Größe, in jedem Scan, der sie enthalten würde. Fügen Sie einen Ordner hinzu oder einen Namen, der überall ausgelassen wird: {0} lässt jeden Ordner dieses Namens aus, {1} jeden mit „cache“ im Namen, {2} dieses Pfadende.",
  "Stop skipping {0}": "{0} nicht mehr auslassen",
  "Nothing is skipped.": "Nichts wird ausgelassen.",
  "Add folder…": "Ordner hinzufügen…",
  "or a name: node_modules, *cache*…": "oder ein Name: node_modules, *cache*…",
  "Folder name or pattern to skip everywhere": "Ordnername oder Muster, das überall ausgelassen wird",
  "Add": "Hinzufügen",
  "Rescan now to apply": "Jetzt neu scannen, um es anzuwenden",
  "Cleanup rules": "Aufräumregeln",
  "Your own suggestions for the Cleanup tab, under \"Your rules\". Write them like a search: a name such as {0}, or a path such as {1} (a matching folder is suggested whole).":
    "Ihre eigenen Vorschläge für den Tab „Aufräumen“, unter „Ihre Regeln“. Schreiben Sie sie wie eine Suche: einen Namen wie {0} oder einen Pfad wie {1} (ein passender Ordner wird als Ganzes vorgeschlagen).",
  "Remove the rule {0}": "Regel {0} entfernen",
  "No rules of your own yet.": "Noch keine eigenen Regeln.",
  "*.bak, Renders\\scratch…": "*.bak, Renders\\entwurf…",
  "New cleanup rule": "Neue Aufräumregel",
  "Add rule": "Regel hinzufügen",
  "Deleting": "Löschen",
  "Offer \"Delete permanently\"": "„Endgültig löschen“ anbieten",
  "Adds a button to delete confirmations that skips the Recycle Bin. Everything it deletes is gone for good, so it always asks a second time.":
    "Fügt Löschbestätigungen eine Schaltfläche hinzu, die den Papierkorb umgeht. Alles, was sie löscht, ist endgültig weg, deshalb fragt sie immer ein zweites Mal.",
  "Permanent delete is on.": "Endgültiges Löschen ist eingeschaltet.",
  "Keep a snapshot of every scan": "Von jedem Scan eine Momentaufnahme aufbewahren",
  "The newest 8 of each drive or folder, about 30 MB each for a full C: drive. History compares them with the scan in view.":
    "Die neuesten 8 jedes Laufwerks oder Ordners, je etwa 30 MB für ein volles Laufwerk C:. Der Verlauf vergleicht sie mit dem angezeigten Scan.",
  "Daily check": "Tägliche Prüfung",
  "Reading…": "Wird gelesen…",
  "Check my drives once a day": "Meine Laufwerke einmal täglich prüfen",
  "Runs without opening a window, through Windows' Task Scheduler, and sends a notification when a drive is getting full. A check missed while the PC was off runs at the next sign-in.":
    "Läuft ohne Fenster über die Windows-Aufgabenplanung und meldet sich, wenn ein Laufwerk voll wird. Eine Prüfung, die verpasst wurde, weil der PC aus war, läuft bei der nächsten Anmeldung.",
  "At": "Um",
  "Time of the daily check": "Uhrzeit der täglichen Prüfung",
  "Warn when a drive has less free than": "Warnen, wenn auf einem Laufwerk weniger frei ist als",
  "{0}% of its size": "{0} % seiner Größe",
  "Also scan and keep history of": "Außerdem scannen und Verlauf führen für",
  "Takes a snapshot each day, and says when a drive grew {0} GB or more since the last one.":
    "Erstellt jeden Tag eine Momentaufnahme und meldet, wenn ein Laufwerk seit der letzten um {0} GB oder mehr gewachsen ist.",
  "Check now": "Jetzt prüfen",
  "Scheduled in Task Scheduler.": "In der Aufgabenplanung eingetragen.",
  "Not scheduled yet.": "Noch nicht eingetragen.",
  "Off.": "Aus.",
  "Nothing to report: every drive has room to spare.": "Nichts zu melden: Auf jedem Laufwerk ist genug Platz.",
  "Settings file": "Einstellungsdatei",
  "Everything set here, saved searches and list columns, in one file: to keep a copy, or to set up another PC the same way.":
    "Alles, was hier eingestellt ist, dazu gespeicherte Suchen und Listenspalten, in einer Datei: als Sicherung oder um einen anderen PC genauso einzurichten.",
  "Import…": "Importieren…",
  "Administrator": "Administrator",
  "Running as administrator": "Läuft als Administrator",
  "Running normally": "Läuft normal",
  "Every folder can be read, and whole NTFS drives are read from their file table in a few seconds.":
    "Jeder Ordner kann gelesen werden, und ganze NTFS-Laufwerke werden in wenigen Sekunden aus ihrer Dateitabelle gelesen.",
  "As administrator, Disq Studio can read folders your account can't, and reads whole NTFS drives from their file table in a few seconds.":
    "Als Administrator kann Disq Studio Ordner lesen, die Ihr Konto nicht lesen darf, und liest ganze NTFS-Laufwerke in wenigen Sekunden aus ihrer Dateitabelle.",
  "Updates": "Updates",
  "Disq Studio is up to date": "Disq Studio ist auf dem neuesten Stand",
  "Installing the update…": "Update wird installiert…",
  "Checks for a new version once a day": "Sucht einmal täglich nach einer neuen Version",
  "It installs on its own and Disq Studio starts again, where you were.":
    "Das Update installiert sich selbst, und Disq Studio startet neu, dort, wo Sie waren.",
  "New versions come from the project's releases on GitHub, signed so only real ones install.":
    "Neue Versionen kommen aus den Releases des Projekts auf GitHub, signiert, damit nur echte installiert werden.",
  "About": "Info",
  "Disq Studio {0}. Everything stays on this PC: Disq Studio doesn't send your files, folder names or usage anywhere.":
    "Disq Studio {0}. Alles bleibt auf diesem PC: Disq Studio sendet weder Ihre Dateien noch Ordnernamen oder Nutzungsdaten irgendwohin.",
  "Done": "Fertig",
  "That file isn't Disq Studio settings.": "Diese Datei enthält keine Einstellungen von Disq Studio.",

  // ----- Map and chart -----
  "{0}, {1}, {2} of view{3}": "{0}, {1}, {2} der Ansicht{3}",
  ", folder": ", Ordner",
  "Sunburst of the current folder. Left and Right move along a ring, Down goes out a ring, Up comes back, Enter zooms in.":
    "Sunburst des aktuellen Ordners. Links und Rechts bewegen sich entlang eines Rings, Unten geht einen Ring nach außen, Oben zurück, Eingabe zoomt hinein.",
  "Drawing the chart": "Diagramm wird gezeichnet",
  "{0} · online only": "{0} · nur online",
  "Treemap of the current folder. Arrow keys move between blocks, ] goes into a folder, [ goes back out, Enter zooms in.":
    "Treemap des aktuellen Ordners. Pfeiltasten wechseln zwischen Blöcken, ] geht in einen Ordner, [ wieder hinaus, Eingabe zoomt hinein.",
  "Drawing the map": "Karte wird gezeichnet",
  "Many small items": "Viele kleine Elemente",
  "Folder · access denied": "Ordner · Zugriff verweigert",
  "Online only, not on this drive": "Nur online, nicht auf diesem Laufwerk",
  "{0} free on this drive": "{0} frei auf diesem Laufwerk",
  "{0} · {1} of view · {2}": "{0} · {1} der Ansicht · {2}",
  "Changed {0}": "Geändert: {0}",
  "Online only: stored in the cloud, not on this drive": "Nur online: in der Cloud gespeichert, nicht auf diesem Laufwerk",

  // ----- File type groups and ages -----
  "Video": "Video",
  "Images": "Bilder",
  "Audio": "Audio",
  "Archives & disk images": "Archive & Datenträgerabbilder",
  "Code & data": "Code & Daten",
  "Documents": "Dokumente",
  "Programs": "Programme",
  "System & cache": "System & Cache",
  "Other": "Sonstiges",
  "changed in 30 days": "in 30 Tagen geändert",
  "unchanged 1 year": "1 Jahr unverändert",
  "unchanged 3 years": "3 Jahre unverändert",

  // ----- Units -----
  "0 bytes": "0 Bytes",
  "1 byte": "1 Byte",
  "{0} bytes": "{0} Bytes",
  "{0} min {1} s": "{0} min {1} s",
  "no change": "keine Änderung",

  // ----- Errors from the Rust side (lib.rs, snapshot.rs, admin.rs) -----
  "Nothing has been scanned yet.": "Es wurde noch nichts gescannt.",
  "That item is no longer in the scan.": "Dieses Element ist nicht mehr im Scan.",
  "There's nothing to undo.": "Es gibt nichts rückgängig zu machen.",
  "Only folders can be refreshed.": "Nur Ordner können aktualisiert werden.",
  "{0} is no longer there.": "{0} ist nicht mehr vorhanden.",
  "{0} is not a folder that can be opened.": "{0} ist kein Ordner, der geöffnet werden kann.",
  "The refresh was cancelled.": "Die Aktualisierung wurde abgebrochen.",
  "The scan was cancelled.": "Der Scan wurde abgebrochen.",
  "This is an opened snapshot; it's already saved.": "Das ist eine geöffnete Momentaufnahme; sie ist schon gespeichert.",
  "Only snapshots in the history can be deleted here.": "Hier können nur Momentaufnahmen aus dem Verlauf gelöscht werden.",
  "That snapshot is of {0}, not {1}": "Diese Momentaufnahme gehört zu {0}, nicht zu {1}",
  "Nothing is being compared.": "Es wird nichts verglichen.",
  "Settings are saved as a .json file.": "Einstellungen werden als .json-Datei gespeichert.",
  "Pick a .json settings file.": "Wählen Sie eine .json-Einstellungsdatei.",
  "That file is too big to be Disq Studio settings.": "Diese Datei ist zu groß für Einstellungen von Disq Studio.",
  "Not a Disq Studio snapshot, or a damaged one: {0}": "Keine Momentaufnahme von Disq Studio oder eine beschädigte: {0}",
  "This snapshot was saved by a newer Disq Studio. Update to open it.":
    "Diese Momentaufnahme wurde mit einem neueren Disq Studio gespeichert. Aktualisieren Sie, um sie zu öffnen.",
  "Restarting as administrator is only available on Windows.": "Der Neustart als Administrator ist nur unter Windows möglich.",
  // ----- Mixed text -----
  "in {0}": "in {0}",
  "{0} excluded": "{0} ausgelassen",
  "{0} skipped": "{0} übersprungen",
  "Scanning {0}…": "{0} wird gescannt…",
  "{0} of {1}": "{0} von {1}",
  "{0} extra": "{0} zusätzlich",
  "oldest": "älteste",
  "{0} selected": "{0} ausgewählt",
  "{0} used": "{0} belegt",
  "fixed": "fest",
  "removable": "Wechseldatenträger",
  "network": "Netzwerk",
  "optical": "optisch",
  "RAM disk": "RAM-Disk",
};
