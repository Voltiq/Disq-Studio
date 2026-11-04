# Security

Disq Studio reads and deletes files, so security reports are taken seriously.

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's private reporting instead: the repository's **Security** tab ›
**Report a vulnerability**. Include what's affected, how to reproduce it, and the version (Settings › About).
You'll get an answer within a week.

## Supported versions

Only the latest release gets fixes; installed copies update themselves.

## How updates are protected

Updates are only installed when their signature matches the public key built into the app
(`plugins.updater.pubkey` in `src-tauri/tauri.conf.json`). The private key is kept out of the repository and
is only available to the release workflow as a secret.
