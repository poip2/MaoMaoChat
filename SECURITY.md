# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in MDHero, please report it responsibly.

**Email:** vaibhavuk.dev@gmail.com

Please do **not** open a public issue for security vulnerabilities.

I will acknowledge your report within 48 hours and work with you to address the issue.

## Scope

MDHero runs locally on your machine. It does not collect data, require accounts, or communicate with external servers except for:

- **Update check:** Fetches `api.github.com` once per 24 hours to check for new releases. No user data is sent.
- **Open URL:** When you explicitly paste a URL, MDHero fetches the raw content from that URL.

Both of these are user-initiated or clearly disclosed.
