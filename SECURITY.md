# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in MaoMaoChat, please report it responsibly.

**Email:** [your-email@example.com]

Please do **not** open a public issue for security vulnerabilities.

## Scope

MaoMaoChat runs locally on your machine. It does not collect data, require accounts, or communicate with external servers except for:

- **Update check:** Fetches `https://api.github.com/repos/poip2/MaoMaoChat/releases/latest` once per 24 hours to check for new releases. **No device ID, no IP storage beyond standard request handling, no file paths, no personal data.**
- **Open URL:** When you explicitly paste a URL, MaoMaoChat fetches the raw content from that URL.

Both of these are user-initiated or clearly disclosed.

File reads, writes (from the in-app editor), and rendering all happen locally. Your files never leave your machine.
