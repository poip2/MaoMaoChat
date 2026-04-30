# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in MDHero, please report it responsibly.

**Email:** vaibhavuk.dev@gmail.com

Please do **not** open a public issue for security vulnerabilities.

I will acknowledge your report within 48 hours and work with you to address the issue.

## Scope

MDHero runs locally on your machine. It does not collect data, require accounts, or communicate with external servers except for:

- **Update check:** Fetches `https://mdhero.app/api/version` once per 24 hours to check for new releases. The request includes only your current MDHero version (e.g. `0.2.0`) and OS family (`darwin` / `win32` / `linux`) as URL parameters. **No device ID, no IP storage beyond standard request handling, no file paths, no personal data.** If `mdhero.app` is unreachable, MDHero falls back to `api.github.com` (same data — version + OS — is not sent there).
- **Open URL:** When you explicitly paste a URL, MDHero fetches the raw content from that URL.

Both of these are user-initiated or clearly disclosed.

File reads, writes (from the in-app editor), and rendering all happen locally. Your files never leave your machine.
