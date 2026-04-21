<script lang="ts">
  import { onMount, tick } from "svelte";
  import { document as docStore } from "$lib/stores/document";
  import { tabStore, HOME_TAB_ID } from "$lib/stores/tabs";
  import { initRenderer } from "$lib/renderer/pipeline";
  import { openFile, openFileDialog } from "$lib/tauri/files";
  import { settings } from "$lib/stores/settings";
  import { startFileWatcher } from "$lib/tauri/watcher";
  import { themeMode, cycleTheme } from "$lib/stores/theme";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { tocVisible, tocEntries } from "$lib/stores/toc";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import MarkdownRenderer from "$lib/components/MarkdownRenderer.svelte";
  import DropZone from "$lib/components/DropZone.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import TableOfContents from "$lib/components/TableOfContents.svelte";
  import TabBar from "$lib/components/TabBar.svelte";
  import SearchOverlay from "$lib/components/SearchOverlay.svelte";
  import PasteModal from "$lib/components/PasteModal.svelte";
  import OpenDialog from "$lib/components/OpenDialog.svelte";
  import FrontmatterBar from "$lib/components/FrontmatterBar.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ScrollToTop from "$lib/components/ScrollToTop.svelte";
  import ImageLightbox from "$lib/components/ImageLightbox.svelte";
  import UpdateToast from "$lib/components/UpdateToast.svelte";
  import { updateScrollPercent } from "$lib/stores/recents";
  import { checkForUpdates } from "$lib/stores/updater";

  let rendererReady = $state(false);
  let lastWatchedPath: string | null = null;
  let searchVisible = $state(false);
  let pasteVisible = $state(false);
  let pasteDefaultMode = $state<"paste" | "url">("paste");
  let openVisible = $state(false);
  let zenMode = $state(false);
  let rawMode = $state(false);

  // Lightbox state
  let lightboxVisible = $state(false);
  let lightboxImages = $state<string[]>([]);
  let lightboxIndex = $state(0);

  const { tabs, activeTabId } = tabStore;

  onMount(async () => {
    initRenderer();
    rendererReady = true;

    // Expose functions for native menu and OS file-open handlers
    (window as any).__mdhero_open_file = () => { openVisible = true; };
    (window as any).__mdhero_open_path = (path: string) => {
      if (path && rendererReady) {
        openFile(path);
      }
    };
    (window as any).__mdhero_paste = () => {
      pasteDefaultMode = "paste";
      pasteVisible = true;
    };
    (window as any).__mdhero_toggle_theme = () => {
      themeMode.update((m) => cycleTheme(m));
    };
    (window as any).__mdhero_find = () => {
      searchVisible = !searchVisible;
    };
    (window as any).__mdhero_zen = () => {
      zenMode = !zenMode;
    };

    // Listen for keyboard shortcuts
    window.addEventListener("keydown", handleKeydown);

    // Check for files opened via "Open With" / double-click (buffered in Rust state)
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const openedFiles = await invoke<string[]>("get_opened_files");
      if (openedFiles.length > 0) {
        await openFile(openedFiles[0]);
      }
    } catch {}

    // Check for updates (non-blocking, skips in dev)
    checkForUpdates();

    // Check for CLI file argument
    try {
      const { getMatches } = await import("@tauri-apps/plugin-cli");
      const matches = await getMatches();
      if (matches.args?.file?.value) {
        await openFile(matches.args.file.value as string);
      }
    } catch {
      // CLI plugin may not be available in dev
    }

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  let lastKey = "";
  let lastKeyTime = 0;

  function isInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
  }

  function jumpToHeading(direction: "prev" | "next") {
    const headings = document.querySelectorAll("article h1[id], article h2[id], article h3[id], article h4[id], article h5[id], article h6[id]");
    if (headings.length === 0) return;
    const offset = 80;
    const scrollY = window.scrollY + offset;

    if (direction === "next") {
      for (const h of headings) {
        const top = (h as HTMLElement).offsetTop;
        if (top > scrollY + 5) {
          window.scrollTo({ top: top - offset, behavior: "smooth" });
          return;
        }
      }
    } else {
      const arr = Array.from(headings).reverse();
      for (const h of arr) {
        const top = (h as HTMLElement).offsetTop;
        if (top < scrollY - 5) {
          window.scrollTo({ top: top - offset, behavior: "smooth" });
          return;
        }
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Cmd+1-9 tab switching
    if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      if ($tabs[idx]) {
        tabStore.switchTab($tabs[idx].id);
      }
      return;
    }

    // Cmd+Plus / Cmd+= zoom in (works on both macOS and Windows)
    if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      settings.update((s) => ({ ...s, fontSize: Math.min(s.fontSize + 1, 32) }));
      return;
    }

    // Cmd+Minus zoom out
    if ((e.metaKey || e.ctrlKey) && e.key === "-") {
      e.preventDefault();
      settings.update((s) => ({ ...s, fontSize: Math.max(s.fontSize - 1, 10) }));
      return;
    }

    // Cmd+0 reset zoom
    if ((e.metaKey || e.ctrlKey) && e.key === "0") {
      e.preventDefault();
      settings.update((s) => ({ ...s, fontSize: 17 }));
      return;
    }

    // Cmd+U raw toggle
    if ((e.metaKey || e.ctrlKey) && e.key === "u") {
      e.preventDefault();
      rawMode = !rawMode;
      return;
    }

    // Cmd+T new tab (go home)
    if ((e.metaKey || e.ctrlKey) && e.key === "t") {
      e.preventDefault();
      tabStore.goHome();
      return;
    }

    // Cmd+W close tab
    if ((e.metaKey || e.ctrlKey) && e.key === "w") {
      e.preventDefault();
      const activeId = tabStore.getActiveTab()?.id;
      if (activeId) {
        tabStore.closeTab(activeId);
      } else {
        // On home tab with no file tabs, do nothing
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
      e.preventDefault();
      zenMode = !zenMode;
      return;
    }

    // Escape — close panels
    if (e.key === "Escape") {
      if (zenMode) { zenMode = false; return; }
      return;
    }

    // Vim-style keys — only when no input is focused
    if (isInputFocused() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!$docStore.renderedHtml) return;

    const now = Date.now();

    switch (e.key) {
      case "j":
        e.preventDefault();
        window.scrollBy({ top: 100, behavior: "smooth" });
        break;
      case "k":
        e.preventDefault();
        window.scrollBy({ top: -100, behavior: "smooth" });
        break;
      case "d":
        // half page down
        e.preventDefault();
        window.scrollBy({ top: window.innerHeight / 2, behavior: "smooth" });
        break;
      case "u":
        // half page up
        e.preventDefault();
        window.scrollBy({ top: -window.innerHeight / 2, behavior: "smooth" });
        break;
      case "G":
        // Shift+G — go to bottom
        e.preventDefault();
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        break;
      case "g":
        // gg — go to top (double tap g within 500ms)
        if (lastKey === "g" && now - lastKeyTime < 500) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
          lastKey = "";
          return;
        }
        break;
      case "/":
        e.preventDefault();
        searchVisible = true;
        break;
      case "n":
        // next search match (handled by SearchOverlay if visible)
        break;
      case "]":
        e.preventDefault();
        jumpToHeading("next");
        break;
      case "[":
        e.preventDefault();
        jumpToHeading("prev");
        break;
    }

    lastKey = e.key;
    lastKeyTime = now;
  }

  // Sync tab switching with document store — only reads $activeTabId and $tabs
  let prevTabId: string | null = null;

  $effect(() => {
    const id = $activeTabId;
    const allTabs = $tabs;

    // Skip if same tab
    if (id === prevTabId) return;
    prevTabId = id;

    if (!id || id === HOME_TAB_ID) {
      rawMode = false;
      docStore.set({
        filePath: null,
        fileName: null,
        content: "",
        renderedHtml: "",
        frontmatter: null,
        wordCount: 0,
        loading: false,
        error: null,
      });
      tocVisible.set(false);
      tocEntries.set([]);
      getCurrentWindow().setTitle("MDHero").catch(() => {});
      return;
    }

    const tab = allTabs.find((t) => t.id === id);
    if (!tab) return;

    docStore.set({
      filePath: tab.filePath,
      fileName: tab.fileName,
      content: tab.content,
      renderedHtml: tab.renderedHtml,
      frontmatter: tab.frontmatter,
      wordCount: tab.wordCount,
      loading: false,
      error: null,
    });

    getCurrentWindow().setTitle(`${tab.fileName} — MDHero`).catch(() => {});

    const savedScroll = tab.scrollTop;
    tick().then(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScroll);
      });
    });
  });

  // Watch for file path changes to set up watcher (only when path actually changes)
  $effect(() => {
    const path = $docStore.filePath;
    if (path && !path.startsWith("paste://") && path !== lastWatchedPath) {
      lastWatchedPath = path;
      startFileWatcher(path);
    }
  });
</script>

<div class="min-h-screen transition-colors page-root">
  {#if !zenMode}
    <ProgressBar />
    <Toolbar onOpen={() => (openVisible = true)} onPaste={() => { pasteDefaultMode = "paste"; pasteVisible = true; }} onUrl={() => { pasteDefaultMode = "url"; pasteVisible = true; }} {rawMode} onRawToggle={() => (rawMode = !rawMode)} />
    <TabBar />
  {/if}
  <DropZone />
  {#if !zenMode}
    <TableOfContents />
  {/if}
  <SearchOverlay bind:visible={searchVisible} />
  <PasteModal bind:visible={pasteVisible} defaultMode={pasteDefaultMode} />
  <OpenDialog bind:visible={openVisible} />

  {#if !rendererReady}
    <div class="state-center">
      <p class="state-text pulse">Loading renderer...</p>
    </div>
  {:else if $docStore.loading}
    <div class="state-center">
      <p class="state-text pulse">Opening file...</p>
    </div>
  {:else if $docStore.error}
    <div class="state-center">
      <div class="error-box">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p class="error-msg">{$docStore.error}</p>
      </div>
    </div>
  {:else if $docStore.renderedHtml}
    {#if rawMode}
      <main class="content-main">
        <pre class="raw-source"><code>{$docStore.content}</code></pre>
      </main>
    {:else}
      <FrontmatterBar />
      <main class="content-main">
        <MarkdownRenderer
          html={$docStore.renderedHtml}
          onImageClick={(src, all, idx) => { lightboxImages = all; lightboxIndex = idx; lightboxVisible = true; }}
        />
      </main>
    {/if}
    {#if !zenMode}
      <StatusBar />
      <ScrollToTop />
    {/if}
    <ImageLightbox bind:visible={lightboxVisible} src="" images={lightboxImages} bind:index={lightboxIndex} />
  {:else}
    <EmptyState onOpenUrl={() => { pasteDefaultMode = "url"; pasteVisible = true; }} />
  {/if}
  <UpdateToast />
</div>

<style>
  .page-root {
    background: #fafafa;
    color: #1c1c1e;
  }

  :global(html.dark) .page-root {
    background: #161618;
    color: #e5e5e7;
  }

  .state-center {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 75vh;
  }

  .state-text {
    font-size: 14px;
    color: #aeaeb2;
  }

  .pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .error-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    max-width: 400px;
  }

  .error-msg {
    font-size: 13px;
    color: #8e8e93;
    line-height: 1.5;
  }

  .content-main {
    padding-bottom: 4rem;
  }

  .raw-source {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px 32px;
    font-size: 13px;
    font-family: "SF Mono", "JetBrains Mono", Menlo, monospace;
    line-height: 1.6;
    color: #1c1c1e;
    white-space: pre-wrap;
    word-break: break-word;
    background: transparent;
    border: none;
  }

  :global(html.dark) .raw-source {
    color: #d1d1d6;
  }
</style>
