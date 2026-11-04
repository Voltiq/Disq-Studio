# Contributing to Disq Studio

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an issue with the bug report form. The most useful things to include: your Windows version, the Disq
Studio version (Settings › About), what you did, what you expected, and what happened instead. For a wrong
size, say which folder and whether "Size" or "On disk" was selected.

## Working on the code

See [README.md](README.md#build-it-yourself) for the tools and commands. In short:

- `npm run tauri dev` runs the app with live reload.
- `npm run dev` runs only the interface in a browser, against a mock backend (`src/lib/mock.ts`). Keep the
  mock in step when you add a command.
- `cd src-tauri && cargo test` runs the Rust tests; CI runs them, the TypeScript check and a build on every
  pull request.

A few habits the code follows:

- **Never delete what the user didn't choose**, and never let Windows delete permanently without saying so:
  every delete goes through `recycle_check` / `recycle_each`.
- **Numbers must be right.** A change to how sizes are counted comes with a test in `tree.rs`, and a
  measurement on a real drive is worth noting in ROADMAP.md.
- Interface text is plain and specific: say what will happen, in the user's words.
- Match the surrounding code: its comments, naming and structure.

## Pull requests

Keep them focused, describe what changed and why, and add a line to the top of CHANGELOG.md for anything a
user would notice.

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
