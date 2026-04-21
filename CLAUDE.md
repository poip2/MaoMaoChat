# CLAUDE.md

## Commands

```bash
pnpm tauri dev          # Run dev server with hot-reload (frontend + Rust)
pnpm tauri build        # Production build (outputs DMG/MSI/AppImage)
pnpm build              # Build frontend only (SvelteKit static)
pnpm check              # TypeScript type checking
cargo build --manifest-path src-tauri/Cargo.toml  # Build Rust backend only
```

Port 1420 is used for dev. Kill stale processes with `lsof -ti:1420 | xargs kill -9` before relaunching.

## What This Is

A lightweight, native desktop Markdown viewer (~11MB) built with Tauri v2 + SvelteKit. Read-only — not an editor. Opens `.md` files and renders them beautifully with syntax highlighting, math, and diagrams. Includes LLM paste-to-render mode for AI-generated markdown. Targets macOS, Windows, and Linux.

## Architecture

Single-window app. Rust backend handles file I/O and watching; SvelteKit frontend handles rendering and UI.

**Rendering pipeline** (`src/lib/renderer/pipeline.ts`): markdown-it parses markdown → Shiki highlights code (23 languages, dual light/dark themes) → markdown-it-texmath renders KaTeX math → DOMPurify sanitizes HTML → Svelte renders via `{@html}`. Mermaid diagrams are post-processed after DOM update in `MarkdownRenderer.svelte`.

**File watching** (`src-tauri/src/watcher.rs`): Watches the parent directory (not the file directly) using the `notify` crate with 500ms debounce. This survives atomic saves (delete + rename) that editors like VS Code and vim use. Emits `file-changed` Tauri event filtered by target filename.

**State management**: Svelte stores in `src/lib/stores/`. `tabs.ts` manages multi-tab state with per-tab scroll position. `document.ts` holds the active document. `theme.ts` manages light/dark/system with class-based toggling. `settings.ts` persists reader preferences to localStorage.

**Tauri bridge** (`src/lib/tauri/`): `files.ts` wraps IPC commands and coordinates opening/reloading. `watcher.ts` listens for `file-changed` events with frontend-side debounce.

## Key Files

- `src/lib/renderer/pipeline.ts` — Core rendering: markdown-it + Shiki + KaTeX + DOMPurify
- `src/lib/components/MarkdownRenderer.svelte` — Renders HTML, handles Mermaid post-processing, TOC extraction via IntersectionObserver
- `src/lib/components/PasteModal.svelte` — LLM paste-to-render modal with auto-detect and unescape
- `src/lib/components/SearchOverlay.svelte` — Cmd+F search with mark.js highlighting
- `src/lib/components/TabBar.svelte` — Multi-tab bar with scroll position persistence
- `src/lib/tauri/files.ts` — File open (dialog, drag-drop, CLI, "Open With"), reload logic
- `src/lib/utils/llm.ts` — LLM output detection and unescaping (`\n`, `\"`, JSON strings)
- `src/lib/utils/clipboard.ts` — Copy as rich text (HTML) or raw markdown
- `src/lib/stores/tabs.ts` — Multi-tab state: per-tab document, scroll position, watcher
- `src-tauri/src/watcher.rs` — Rust file watcher (notify crate, watches parent dir)
- `src-tauri/src/commands.rs` — Rust IPC command: `read_markdown_file`
- `src-tauri/src/lib.rs` — Tauri setup: plugins, commands, menu, state, `OpenedFiles` buffer for "Open With"
- `src-tauri/src/menu.rs` — Native menu bar: App (Quit/About), File (Open/Paste/Close), Edit (Cut/Copy/Paste/Find), View
- `src-tauri/tauri.conf.json` — Window config, file associations, CLI args, bundle settings
- `src-tauri/capabilities/default.json` — Tauri permissions (add new ones here when getting permission errors)
- `src-tauri/Info.plist` — macOS file type declarations for "Open With" / double-click support

## Things That Will Bite You

- **Tailwind v4 dark mode**: Uses `@custom-variant dark (&:where(.dark, .dark *))` in `app.css`. Without this, `dark:` utilities follow OS preference only and ignore the class toggle.
- **Shiki unknown languages**: Shiki throws if a code block uses an unloaded language (e.g. `mermaid`). The pipeline overrides the fence rule to fall back to plain `<pre><code>` for unknown languages. If adding new languages, add them to the `langs` array in `pipeline.ts`.
- **Svelte 5 runes mode**: No `afterUpdate` or `beforeUpdate`. Use `$effect` with `tick()` instead. Components use `$props()`, `$state()`, `$effect()`.
- **Vite HMR watches everything**: Editing `.md` files inside the project triggers a full page reload, losing app state. The `vite.config.js` ignores `**/tests/**` and `**/src-tauri/**`. If users report files "closing" on save, check if Vite is watching that path.
- **Tauri permissions**: New IPC commands or webview APIs need explicit permissions in `src-tauri/capabilities/default.json`. Error messages include the required permission name (e.g. `core:window:allow-set-title`).
- **Atomic saves break file watchers**: Watching a file directly fails when editors delete + rename. That's why `watcher.rs` watches the parent directory and filters by filename.
- **DOMPurify strips SVG/MathML**: The sanitizer config in `pipeline.ts` has explicit `ADD_TAGS` and `ADD_ATTR` for KaTeX MathML elements and Mermaid SVG. If new rendered content gets stripped, add its tags/attrs there.
- **macOS Cmd+V in textareas**: Custom menus replace the default Edit menu. Without `PredefinedMenuItem::paste` in `menu.rs`, Cmd+V won't work in any text input. Always include Cut/Copy/Paste predefined items.
- **"Open With" fires before webview**: The `RunEvent::Opened` event arrives before the frontend loads. File paths are buffered in `OpenedFiles` state (Rust) and polled by the frontend on mount via `get_opened_files` command.
- **Pasted content uses `paste://` paths**: Tabs created from pasted markdown use `paste://` as the file path prefix. The watcher skips these (no file to watch).

## Code Conventions

- Runtime: Rust (Tauri v2) + SvelteKit (Vite). Package manager: pnpm.
- Svelte 5 runes syntax throughout — `$state()`, `$props()`, `$effect()`, `$derived()`.
- Styling: Tailwind CSS v4 with `@tailwindcss/typography` prose classes. No separate CSS files for components — use `<style>` blocks with `:global()` for rendered markdown targeting.
- Stores: Svelte writable stores, not external state libraries.
- Tauri commands: defined in Rust with `#[tauri::command]`, called from frontend via `invoke()`.
- Non-blocking Tauri calls: `setTitle`, `start_watching`, and other non-critical IPC calls use `.catch(() => {})` to prevent failures from breaking the main flow.
- File structure: components in `src/lib/components/`, stores in `src/lib/stores/`, Tauri wrappers in `src/lib/tauri/`, rendering in `src/lib/renderer/`.
