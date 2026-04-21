<script lang="ts">
  import { document } from "../stores/document";
  import { themeMode, cycleTheme } from "../stores/theme";
  import { tocVisible, tocEntries, toggleToc, activeHeadingId } from "../stores/toc";
  import { openFileDialog } from "../tauri/files";
  import { copyAsRichText, copyAsMarkdown } from "../utils/clipboard";
  import ReaderControls from "./ReaderControls.svelte";

  let {
    onPaste = () => {},
    onOpen = () => {},
    onUrl = () => {},
    rawMode = false,
    onRawToggle = () => {},
  }: {
    onPaste?: () => void;
    onOpen?: () => void;
    onUrl?: () => void;
    rawMode?: boolean;
    onRawToggle?: () => void;
  } = $props();

  let currentHeading = $derived(
    $activeHeadingId && $tocEntries.length > 0
      ? $tocEntries.find((e) => e.id === $activeHeadingId)?.text ?? null
      : null
  );

  let showReaderControls = $state(false);
  let showCopyMenu = $state(false);
  let copyFeedback = $state("");

  function closeAll() {
    showReaderControls = false;
    showCopyMenu = false;
  }

  function toggleReaderControls() {
    const next = !showReaderControls;
    closeAll();
    showReaderControls = next;
  }

  function toggleCopyMenu() {
    const next = !showCopyMenu;
    closeAll();
    showCopyMenu = next;
  }

  function handleThemeToggle() {
    closeAll();
    themeMode.update((m) => cycleTheme(m));
  }

  async function handleExportPdf() {
    try {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      await getCurrentWebview().print();
    } catch {
      window.print();
    }
  }

  async function handleCopyRichText() {
    const article = globalThis.document?.querySelector("article.prose");
    if (!article || !$document.content) return;
    const success = await copyAsRichText(article.innerHTML, $document.content);
    copyFeedback = success ? "Copied!" : "Failed";
    showCopyMenu = false;
    setTimeout(() => (copyFeedback = ""), 1500);
  }

  async function handleCopyMarkdown() {
    if (!$document.content) return;
    const success = await copyAsMarkdown($document.content);
    copyFeedback = success ? "Copied!" : "Failed";
    showCopyMenu = false;
    setTimeout(() => (copyFeedback = ""), 1500);
  }

  function getThemeIcon(mode: string): string {
    switch (mode) {
      case "light": return "\u2600";
      case "dark": return "\u263E";
      default: return "\u25D1";
    }
  }
</script>

<header class="toolbar">
  <div class="toolbar-left">
    <div class="btn-group">
      <button onclick={onOpen} class="btn btn-primary" title="Open file (Cmd+O)">
        Open
      </button>
      <button onclick={onPaste} class="btn btn-ghost" title="Paste markdown (Cmd+Shift+V)">
        Paste
      </button>
      <button onclick={onUrl} class="btn btn-ghost" title="Open URL">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="5.5"/><ellipse cx="7" cy="7" rx="2.5" ry="5.5"/><line x1="1.5" y1="7" x2="12.5" y2="7"/></svg>
      </button>
    </div>

    {#if $document.fileName}
      <span class="filename">{$document.fileName}</span>
      {#if currentHeading}
        <span class="heading-sep">/</span>
        <span class="current-heading">{currentHeading}</span>
      {/if}
    {/if}
  </div>

  <div class="toolbar-right">
    {#if $document.renderedHtml && $tocEntries.length > 0}
      <button
        onclick={toggleToc}
        class="btn btn-icon"
        class:active={$tocVisible}
        title="Table of Contents"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="12" x2="12" y2="12"/></svg>
      </button>
    {/if}

    {#if $document.renderedHtml}
      <button
        onclick={toggleReaderControls}
        class="btn btn-icon"
        class:active={showReaderControls}
        title="Reading preferences (Aa)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><text x="2" y="12" font-size="10" font-weight="600" stroke="none" fill="currentColor" font-family="sans-serif">Aa</text></svg>
      </button>

      <button
        onclick={onRawToggle}
        class="btn btn-icon"
        class:active={rawMode}
        title="View raw markdown (Cmd+U)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="2,4 5,4 5,12"/><polyline points="8,4 11,4 11,12"/><line x1="3" y1="8" x2="7" y2="8"/><line x1="13" y1="4" x2="13" y2="12"/></svg>
      </button>

      <div class="relative">
        <button
          onclick={toggleCopyMenu}
          class="btn btn-icon"
          title="Copy content"
        >
          {#if copyFeedback}
            <span style="font-size:11px">{copyFeedback}</span>
          {:else}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V3h8"/></svg>
          {/if}
        </button>

        {#if showCopyMenu}
          <div class="dropdown">
            <button onclick={handleCopyRichText} class="dropdown-item">
              <span>Rich Text</span>
              <span class="dropdown-hint">for Docs / Notion</span>
            </button>
            <button onclick={handleCopyMarkdown} class="dropdown-item">
              <span>Markdown</span>
              <span class="dropdown-hint">raw source</span>
            </button>
          </div>
        {/if}
      </div>

      <button onclick={handleExportPdf} class="btn btn-icon" title="Export PDF (Print)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="10" height="7" rx="1"/><path d="M5 6V3h6v3"/><circle cx="11" cy="9" r="0.5" fill="currentColor" stroke="none"/></svg>
      </button>

      <div class="separator"></div>
    {/if}

    <button onclick={handleThemeToggle} class="btn btn-icon" title="Toggle theme">
      {getThemeIcon($themeMode)}
    </button>
  </div>
</header>

{#if showCopyMenu || showReaderControls}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[9]" onclick={closeAll} onkeydown={() => {}}></div>
{/if}

<ReaderControls visible={showReaderControls} />

<style>
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(250, 250, 250, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid #e5e5e5;
  }

  :global(html.dark) .toolbar {
    background: rgba(22, 22, 24, 0.85);
    border-bottom-color: #2c2c2e;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .btn-group {
    display: flex;
    gap: 1px;
    background: #e5e5e5;
    border-radius: 7px;
    overflow: hidden;
  }

  :global(html.dark) .btn-group {
    background: #2c2c2e;
  }

  .btn {
    font-size: 12px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .btn-primary {
    padding: 5px 14px;
    background: #0891B2;
    color: white;
    border-radius: 0;
  }

  .btn-primary:hover {
    background: #0E7490;
  }

  .btn-ghost {
    padding: 5px 14px;
    background: #f2f2f7;
    color: #3a3a3c;
  }

  :global(html.dark) .btn-ghost {
    background: #1c1c1e;
    color: #aeaeb2;
  }

  .btn-ghost:hover {
    background: #e5e5ea;
  }

  :global(html.dark) .btn-ghost:hover {
    background: #2c2c2e;
  }

  .btn-icon {
    padding: 5px 10px;
    background: transparent;
    color: #636366;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  :global(html.dark) .btn-icon {
    color: #8e8e93;
  }

  .btn-icon:hover {
    background: #f2f2f7;
    color: #1c1c1e;
  }

  :global(html.dark) .btn-icon:hover {
    background: #2c2c2e;
    color: #e5e5e7;
  }

  .btn-icon.active {
    background: #E5F5F8;
    color: #0891B2;
  }

  :global(html.dark) .btn-icon.active {
    background: #0A1E2E;
    color: #22D3EE;
  }

  .filename {
    font-size: 12px;
    color: #8e8e93;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }

  .heading-sep {
    font-size: 11px;
    color: #d1d1d6;
    margin: 0 2px;
  }

  :global(html.dark) .heading-sep {
    color: #3a3a3c;
  }

  .current-heading {
    font-size: 11px;
    color: #aeaeb2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .separator {
    width: 1px;
    height: 18px;
    background: #d1d1d6;
    margin: 0 4px;
  }

  :global(html.dark) .separator {
    background: #3a3a3c;
  }

  .dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    width: 200px;
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
    z-index: 50;
    padding: 4px;
    overflow: hidden;
  }

  :global(html.dark) .dropdown {
    background: #2c2c2e;
    border-color: #3a3a3c;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 7px 10px;
    font-size: 12px;
    color: #1c1c1e;
    background: none;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    text-align: left;
  }

  :global(html.dark) .dropdown-item {
    color: #e5e5e7;
  }

  .dropdown-item:hover {
    background: #f2f2f7;
  }

  :global(html.dark) .dropdown-item:hover {
    background: #3a3a3c;
  }

  .dropdown-hint {
    font-size: 11px;
    color: #aeaeb2;
  }

  @media print {
    .toolbar { display: none !important; }
  }
</style>
