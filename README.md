# Disq Studio

**See what's filling your drive, and clear it out safely.** A fast disk space visualizer for Windows, built
with Tauri 2, Rust and React.

[![CI](https://github.com/Voltiq/Disq-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Voltiq/Disq-Studio/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/Voltiq/Disq-Studio)](https://github.com/Voltiq/Disq-Studio/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Download

Get **`Disq.Studio_<version>_x64-setup.exe`** from the [latest release](https://github.com/Voltiq/Disq-Studio/releases/latest)
and double-click it. It installs for your account only (no administrator rights), adds "Analyze with Disq
Studio" to File Explorer's right-click menu, and keeps itself up to date.

Windows 10 or 11, 64-bit. The installer isn't code-signed yet, so the first time SmartScreen says "Windows
protected your PC": choose **More info › Run anyway**.

## What it does

- **Scans fast.** Every core reads in parallel: 1.8 million files in about 10 seconds. Run as administrator,
  a whole NTFS drive is read from its file table in 2 to 4 seconds, including what folder scans can't see.
- **Shows where the space goes**: a treemap or a sunburst, coloured by file type or by age, with free space
  as its own block. Click to zoom in; everything works from the keyboard too.
- **Counts honestly**: hard links count once; online-only OneDrive files show apart, since they take no space
  on the drive; "Size" or "On disk" at the flick of a switch.
- **Finds things**: search with several terms, `*` and `?`, `a|b`, `-exclusions` and full paths
  (`AppData\Local\*.log`); filter by type, size and age; save searches.
- **Finds duplicates** by content (BLAKE3), never downloading cloud files, and frees them by recycling the
  extra copies or replacing them with hard links.
- **Suggests cleanup**: temp files, browser and app caches, build output (`node_modules`, `target`, `bin`/`obj`),
  package caches, old installers, big files not opened in a year, and rules of your own.
- **Deletes safely**: everything goes to the Recycle Bin after a check of what the bin can take (Windows
  silently deletes what doesn't fit), with Undo. Permanent delete only if you turn it on.
- **Remembers**: each scan is kept as a snapshot, so you can see what grew, what shrank and what's new since.
- **Watches**: an optional daily check warns when a drive is getting full, without opening a window.
- **Exports** a folder as a web page report, CSV or JSON.
- **Speaks English and German**, following Windows or your choice in Settings.

Nothing leaves your PC: Disq Studio sends no files, folder names or usage anywhere. The only network
request is the update check against this repository's releases.

## Build it yourself

You need [Node.js](https://nodejs.org) 20 or later, [Rust](https://rustup.rs) (stable, MSVC) and the
[Tauri prerequisites for Windows](https://v2.tauri.app/start/prerequisites/) (WebView2 and the C++ build tools).

```bash
npm install
npm run tauri dev
```

To work on the interface without the Rust side, run `npm run dev` and open http://localhost:1420: a mock
backend with a generated folder tree loads when the page isn't running inside Tauri.

```bash
npm run installer
```

Builds a per-user NSIS installer at `release\Disq Studio Setup <version>.exe` and prints its SHA-256. Update
files are signed with `%USERPROFILE%\.tauri\disq-studio.key` when it exists; otherwise they're left out.

Tests (the Rust side, on Windows):

```bash
cd src-tauri
cargo test
```

A few slower checks run only when asked, on real folders and read-only, for example
`$env:DISK_STUDIO_BENCH = "C:\"; cargo test --release bench -- --ignored --nocapture`.

## Releasing

1. Bump `version` in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`, and add a
   section to [CHANGELOG.md](CHANGELOG.md).
2. Commit, then tag and push: `git tag v1.2.3 && git push origin v1.2.3`.
3. [The release workflow](.github/workflows/release.yml) builds the installer, signs the update files with the
   `TAURI_SIGNING_PRIVATE_KEY` secret, and publishes a GitHub release with `latest.json`, which installed
   copies check for updates.

## How it's put together

- `src-tauri/src/scan.rs`, `listing.rs`: the parallel folder walk; one batched directory read per folder
- `src-tauri/src/mft.rs`: whole-drive scans from the NTFS file table (as administrator)
- `src-tauri/src/tree.rs`: the size tree and its queries; hard links; refreshing one folder in place
- `src-tauri/src/filter.rs`: search and filter
- `src-tauri/src/dupes.rs`: duplicate finder, hash cache, replacing copies with hard links
- `src-tauri/src/junk.rs`: cleanup rules
- `src-tauri/src/recyclebin.rs`: what the Recycle Bin can take, checked before every delete
- `src-tauri/src/snapshot.rs`, `compare.rs`: saved scans and what changed between two
- `src-tauri/src/report.rs`: CSV / JSON / HTML export
- `src-tauri/src/background.rs`: the daily check (`--background`, Task Scheduler, notifications)
- `src-tauri/src/lib.rs`: Tauri commands and events
- `src/`: the React interface; `src/lib/treemap.ts` is the squarified treemap layout
- `src/lib/i18n.ts`, `de.ts`: translation; the English text is the key, `de.ts` the German table, and
  `npm test` checks that every string has one (`node scripts/i18n-wrap.mjs --keys` lists them)
- `installer/`: NSIS hooks (the Explorer menu entry) and the installer artwork

[ROADMAP.md](ROADMAP.md) has the details and measurements behind each feature, and what's next.

## Contributing

Issues and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
