# Changelog

## 1.2.0 — 2026-11-12

### Added
- **Spanish and French**: Disq Studio now speaks English, German, Spanish and French. It follows Windows, or
  pick one in Settings › Appearance › Language. Both use the words Windows uses (Papelera de reciclaje,
  Corbeille), and French writes sizes in octets (Ko, Mo, Go), as Windows does. The daily check's
  notifications and the HTML report are translated too.

## 1.1.0 — 2026-11-12

### Added
- **German**: Disq Studio speaks German (Sie form, with Windows' own terms: Papierkorb, Datenträger,
  Momentaufnahme). It follows Windows, or pick English or Deutsch in Settings › Appearance › Language
  (applies at the next start; "Restart now" does it straight away). Numbers and dates follow the language
  too, and so do the daily check's notifications and the HTML report.
- **Own title bar**: the window has the app's icon and name, the folder in view, and minimise, maximise and
  close buttons drawn to match the rest of the app. Drag it to move the window, double-click to maximise.

### Changed
- **Dropdowns** are drawn by the app instead of Windows: they open with a short animation, fit the theme and
  accent, and work from the keyboard (arrows, Home/End, typing a letter, Enter, Esc).
- Fixed a message in the Recycle Bin check that said the OneDrive warning twice.

## 1.0.0 — 2026-11-04

Disk Studio is now **Disq Studio**, and open source under the MIT license.

### Added
- **Updates**: Disq Studio checks for a new version once a day and offers to install it; it installs on its
  own and starts again. Settings › Updates checks on demand. Updates are signed and checked before installing.
- **Skip folders by name**: Settings › Folders to skip takes names and patterns as well as folders:
  `node_modules` skips every folder of that name, `*cache*` any with "cache" in it.
- **Settings file**: export everything you've set (and saved searches, list columns, the daily check) to a
  file, and import it on another PC.

### Changed
- Tab and Shift+Tab stay inside an open dialog; every list, menu and control has a name screen readers read
  out.
- Renamed to Disq Studio. Your history, settings and saved searches carry over. The old "Disk Studio" stays
  installed next to it: remove it in Settings › Apps (leave "delete app data" unticked, as the new name uses
  the same data).

## 0.9.0 — 2026-11-04

### Added
- **History**: every scan is kept as a snapshot (the newest 8 of each drive or folder). The History button in
  the top bar, or on the home screen, lists them. Open one to look around as it was, or save and open
  snapshot files anywhere.
- **What changed**: compare the scan in view with any snapshot. The Changes tab shows the totals then and
  now, folder by folder (biggest change first), and the files that grew or shrank most, and what's new and
  what's gone.
- **Export a report** of the folder in view (download button in the top bar): a web page to read or share,
  CSV for Excel, or JSON. Choose how deep, the smallest item, and whether to include files.
- **Daily check** (Settings › Daily check): once a day, without opening a window, Disk Studio sends a
  Windows notification when a drive is getting full. It can also scan chosen drives to keep their history,
  and says when one grew a lot. "Check now" tries it straight away.

## 0.8.0 — 2026-11-04

### Added
- **Undo** after moving things to the Recycle Bin: the button in the message (or Ctrl+Z) puts them back and
  shows them on the map again.
- **Cleanup basket**: collect things from the map (right-click › Add to basket), Duplicates and Cleanup, see
  the total, and recycle them all in one go. The basket button sits in the top bar.
- **Duplicates**:
  - "Replace with links": keeps every name but stores the data once, as hard links. Files that changed
    since the search, or are on another drive, are left alone.
  - Filter the groups by path or file type, and select every copy in a folder with the folder button.
  - "Show on map" picks out the extra copies on the treemap or sunburst.
  - Searching again is much faster: hashes of files that haven't changed are remembered.
  - Searching no longer makes files look recently opened.
- **Cleanup**:
  - Big files not opened in a year (100 MB or more).
  - Teams and Slack caches; Visual Studio `.vs` folders and .NET `bin`/`obj` beside their project.
  - WSL and Docker disk images, listed so you know where the space goes, but never selectable.
  - Your own rules: Settings › Cleanup rules, written like searches (`*.bak`, `Renders\scratch`).
- **Delete permanently**, off unless turned on in Settings › Deleting; it always asks a second time.
- Deleting online-only OneDrive files now says they skip the Recycle Bin and go to OneDrive's own recycle bin
  on the web.

## 0.7.2 — 2026-11-04

### Fixed
- In the Matches list, sizes and dates didn't line up with the column headings (the date wrapped onto a
  line of its own). Headings also sat a scrollbar's width off their columns in both lists.

## 0.7.1 — 2026-11-04

### Fixed
- Path searches such as `AppData\Local\*.tmp` found nothing unless they started with `*` or the drive. A
  path pattern now matches from any folder down; start it with a drive (`C:\...`) to match from there only.
  In `a|b`, each alternative is a path or a name on its own (`AppData\Local\*.log|*.tmp`).

## 0.7.0 — 2026-11-04

### Added
- **Sunburst**: a second way to draw the folder in view (toggle beside the folder path), as rings out from
  the middle, one per level. Click the centre to go up.
- **Map options** (sliders button): colour files by **age** (this week to older than 3 years) instead of
  type, and **cushion shading** that makes the treemap's nesting easier to see.
- **Free space** shows as its own block when a whole drive is in view.
- **Zoom animation** when going into a folder or back up (off when Windows' animation effects are off).
- **Search terms**: several terms that must all match (`node_modules *.js`), `a|b` for either, `-term` to
  leave things out (`-*.log`), and terms with a `\` matched against the full path (`AppData\Local\*.tmp`).
- **Saved searches**: the bookmark button beside the search box saves the current search and brings it back.
- **Recycle all matches** from the Matches tab, with the usual Recycle Bin check. Only what matches goes:
  a folder is taken whole only when everything in it matches.
- **Select several items**: Ctrl+click in the list or on the map, Shift+click for a range in the list,
  Ctrl+A for the whole folder. The details panel adds them up, and Delete recycles them together.
- **List columns**: Files and Modified next to Size and Share. Click a heading to sort, drag its edge to
  resize, right-click to choose columns; drag the list's right edge to make it wider.
- The file-type legend under the map filters by type when clicked, and the "Other" type can be filtered on.

### Changed
- Searching is 1.5 to 3 times faster (C: with 1.85 million files: 65–140 ms per search).

## 0.6.2 — 2026-11-04

### Fixed
- Refreshing a folder no longer moves any hard-linked data between folders. 0.6.1 still moved some (127 MB
  from Program Files to Windows on this PC) when both names were equally deep. Which name counts is now one
  fixed rule everywhere: the one fewest folders down, then the first by path. Checked on this PC: refreshing
  Program Files or Windows leaves every top-level folder's size unchanged.

## 0.6.1 — 2026-11-04

### Fixed
- Refreshing a folder could move hard-linked data to being counted under a name elsewhere (the folder seemed
  to shrink and another to grow, with the total unchanged). A refreshed folder now counts hard links the way a
  full scan does: under the name nearest the top.

### Changed
- Whole-drive scans as administrator are faster and lighter: they build the result straight from the drive's
  file table (C: with 1.9 million files: about 2 seconds, 450 MB at most, was 530 MB).

## 0.6.0 — 2026-11-04

### Added
- **Run as administrator**: click the "skipped" badge (or Settings › Administrator) to restart as administrator
  after Windows asks. An "Admin" badge shows while elevated.
- **Whole drives in seconds**: as administrator, a drive is read straight from its NTFS file table. `C:\` with
  1.9 million files takes about 3 seconds, and includes what folder-by-folder scans can't see: System Volume
  Information and NTFS's own files. A "File table" badge says when this was used.
- **Refresh one folder** (button next to the folder path, or right-click › Refresh this folder): rescans just
  that folder instead of the whole drive.

### Changed
- Recycling the name a hard link's data is counted under moves the size to one of its other names, and no
  longer reports space freed while the data still has another name.
- Hard links are counted once on ReFS drives too.
- Compressed and sparse files report their exact size on disk, even right after they changed.
- Uses about a fifth less memory: a full `C:\` scan holds 211 MB instead of 272 MB.

## 0.5.0 — 2026-11-03

### Added
- **Settings** (gear button in the top bar, or Ctrl+,). Every change applies straight away and is remembered:
  - Theme: dark, light or follow Windows
  - Accent colour: violet, blue, raspberry or teal; the whole interface follows
  - Measure by: size or on disk (same switch as the top bar)
  - Units: like Windows (1 KB = 1,024 bytes) or decimal (1 kB = 1,000 bytes, as drives are sold)
  - Folders to skip: never read in any scan; they appear as "excluded", with no size, and the top bar
    counts them. Changing the list offers a rescan.
  - About: version, and a note that nothing leaves your PC

## 0.4.2 — 2026-11-03

### Changed
- One window: "Analyze with Disk Studio" while Disk Studio is open scans that folder in the open window
  instead of starting a second copy.
- The window comes to the front when started from Explorer, or when a folder is handed to it.

## 0.4.1 — 2026-11-03

### Fixed
- "Analyze with Disk Studio" on a small folder could hang on "Scanning… 0 files": the scan finished
  before the window was listening for it. The window now also asks for the result right after starting,
  so a finished scan can't be missed. The same race could affect very small scans started in the app.

## 0.4.0 — 2026-11-03

The first release with an installer.

### Install
- Per-user installer (`Disk Studio Setup 0.4.0.exe`): no administrator rights needed, uninstalls cleanly
  from Settings › Apps. Downloads the WebView2 runtime only if Windows doesn't already have it.
- "Analyze with Disk Studio" in File Explorer's right-click menu for folders, drives and folder backgrounds.

### See what's using space
- Parallel scanner: a full `C:\` (1.7 million files) in about 13 seconds, holding about 270 MB.
- Treemap coloured by file type, with folder list, details panel, breadcrumbs and Back / Up.
- **Size / On disk** switch: file length or the space actually taken on the drive.
- Hard links counted once (NTFS), so `C:\Windows\WinSxS` isn't double counted.
- Online-only OneDrive files shown as their own figure, and as ghost blocks in the treemap.
- Keyboard navigation on the treemap (arrows, `[` `]`, Home, Enter) with screen-reader announcements.
- Rescan keeps the folder you were in and what you had selected.

### Find things
- Search and filter (Ctrl+F): name text or `*`/`?` patterns that also match folder names,
  file-type chips, minimum size and age. Every view follows the filter.

### Clean up
- **Duplicates**: same size, then the start and end, then whole-file BLAKE3 hashes. Online-only files
  are never downloaded, and one copy in each group always stays.
- **Cleanup**: temp files, browser and app caches, shader caches, crash dumps, Windows Update downloads
  (safe), plus build output, package caches, large logs and old installers (review first).
  Sizes are always what removing them would free on this drive.
- **Recycle Bin safety**: every delete is checked against the drive's Recycle Bin first. Anything Windows
  would delete permanently (no bin, bin set to delete right away, or bigger than the bin) is held back
  unless you tick "Delete permanently". Items in use are skipped and reported, not fatal.

### Known limits
- Not code-signed yet, so Windows SmartScreen will warn on first run ("More info" › "Run anyway").
- No automatic updates yet.
- Windows only.
- Folders only an administrator can read are skipped and counted, not scanned.
