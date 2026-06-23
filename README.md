<div align="center">
<img alt="MaoMaoChat" src=".github/assets/banner-light.png" width="100%">
<br>
A beautiful, native Markdown viewer and lightweight editor for macOS and Windows.
<br><br>

[![GitHub Stars](https://img.shields.io/github/stars/poip2/MaoMaoChat?style=flat-square)](https://github.com/poip2/MaoMaoChat/stargazers)
[![Downloads](https://img.shields.io/github/downloads/poip2/MaoMaoChat/total?style=flat-square)](https://github.com/poip2/MaoMaoChat/releases/latest)
[![License](https://img.shields.io/github/license/poip2/MaoMaoChat?style=flat-square)](LICENSE)
![macOS](https://img.shields.io/badge/macOS-supported-blue?style=flat-square&logo=apple)
![Windows](https://img.shields.io/badge/Windows-supported-blue?style=flat-square&logo=windows)
[![Built with Tauri](https://img.shields.io/badge/Built_with-Tauri-FFC131?style=flat-square&logo=tauri)](https://tauri.app)

[Download](https://github.com/poip2/MaoMaoChat/releases/latest) · [Discussions](https://github.com/poip2/MaoMaoChat/discussions)

</div>

<table>
<tr>
<td><img src=".github/assets/hero-light.png" alt="MaoMaoChat Light Mode"></td>
<td><img src=".github/assets/hero-dark.png" alt="MaoMaoChat Dark Mode"></td>
</tr>
<tr>
<td align="center"><em>Light mode</em></td>
<td align="center"><em>Dark mode</em></td>
</tr>
</table>

Open local `.md` files, paste AI-generated markdown, or fetch from any public URL — and read or edit it the way it was meant to be.

---

## Why MaoMaoChat

Markdown is where developers, writers, and AI live today — READMEs, Claude Code plans, LLM chat exports, notes, documentation. But opening a `.md` file in a code editor gives you ugly monospace text. Opening a web-based viewer means uploading your files. GitHub renders it beautifully but only if the file is in a repo.

**MaoMaoChat is a native app for everything in between.** Your files stay local. Rendering is instant. Edit in place when you need to. Works offline. Looks like it belongs on your machine.

---

## Features

### Reading
- **Beautiful rendering** — Apple-inspired typography, light & dark themes
- **Syntax highlighting** — 25+ languages via highlight.js
- **Math & diagrams** — KaTeX for equations, Mermaid for flowcharts
- **Reader controls** — adjust font, size, line height, width
- **Zen mode** — distraction-free full-screen reading
- **Print/Export to PDF** — with clean print styles

### Editing
- **Lightweight in-app editor** — `Ctrl+E` flips any local file into edit mode
- **Save with `Ctrl+S`** — writes back to disk
- **Stays where you were** — source-line scroll sync keeps your position
- **Dirty indicator** — `•` in the tab title and toolbar when you have unsaved changes

### Navigation
- **Multiple tabs** — open many files, drag to reorder, Ctrl+1–9 to switch
- **Table of Contents** — auto-generated sidebar with active heading tracking
- **Search (Ctrl+F)** — with match highlighting
- **Vim keys** — j/k/gg/G/d/u/[/] for keyboard-first navigation
- **Image lightbox** — click to zoom, arrow keys for next/prev

### Opening Files
- **Local files** — drag-drop, Ctrl+O, "Open With" from Explorer
- **Pinned folders** — quick access to markdown in your favorite directories
- **Claude Code Plans** — auto-discovers `~/.claude/plans/`
- **Open URL** — fetch from GitHub, Gist, GitLab, Bitbucket, or any public URL
- **Paste mode (Ctrl+Shift+V)** — render LLM output instantly
- **Recent files** — pick up where you left off, with reading progress per file

### Live
- **File watching** — edit in VS Code, see updates instantly in MaoMaoChat
- **Auto-reload** — survives atomic saves (VS Code, vim, etc.)

---

## Install

**macOS**: Download `.dmg` from [Releases →](https://github.com/poip2/MaoMaoChat/releases/latest)

**Windows**: Download `.msi` from [Releases →](https://github.com/poip2/MaoMaoChat/releases/latest)

Or build from source (see below).

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+O` | Browse files |
| `Ctrl+Shift+V` | Paste markdown |
| `Ctrl+T` | New tab (home) |
| `Ctrl+W` | Close tab |
| `Ctrl+1..9` | Switch to tab N |
| `Ctrl+F` | Find in document |
| `Ctrl+E` | Toggle edit mode |
| `Ctrl+S` | Save edits to disk |
| `Ctrl+U` | Toggle raw markdown view |
| `Ctrl+Shift+F` | Zen mode |
| `Ctrl+=` / `Ctrl+-` | Zoom in / out |
| `Ctrl+0` | Reset zoom |
| `j` / `k` | Scroll down / up |
| `gg` / `G` | Jump to top / bottom |
| `[` / `]` | Previous / next heading |
| `/` | Open search |

---

## Development

```bash
pnpm install
pnpm tauri dev          # Run dev with hot reload
pnpm tauri build        # Production build (outputs DMG/MSI)
pnpm check              # TypeScript check
```

**Requirements:** Node 22+, Rust stable, pnpm 10+.

### Stack

- [Tauri v2](https://tauri.app) — Rust backend
- [SvelteKit](https://kit.svelte.dev) — frontend with Svelte 5 runes
- [markdown-it](https://github.com/markdown-it/markdown-it) — rendering pipeline
- [highlight.js](https://highlightjs.org) — syntax highlighting
- [KaTeX](https://katex.org) — math rendering
- [Mermaid](https://mermaid.js.org) — diagram rendering
- [Tailwind CSS v4](https://tailwindcss.com) — styling

---

## Privacy

MaoMaoChat runs entirely on your machine.

- **No telemetry.** No analytics. No tracking.
- **No account required.** Use it anonymously.
- **Your files never leave your computer.** Rendering happens locally.

---

## Attribution

MaoMaoChat is based on [MDHero](https://github.com/vaibhavuk-dev/mdhero) by Vaibhav Kakde, licensed under the [MIT License](LICENSE).

---

## License

[MIT](LICENSE)
