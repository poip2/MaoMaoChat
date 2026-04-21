import { writable, get } from "svelte/store";

export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  renderedHtml: string;
  frontmatter: Record<string, unknown> | null;
  wordCount: number;
  scrollTop: number;
}

export const HOME_TAB_ID = "__home__";

function createTabStore() {
  const tabs = writable<Tab[]>([]);
  const activeTabId = writable<string | null>(HOME_TAB_ID);

  function generateId(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  function addTab(filePath: string, fileName: string, content: string, renderedHtml: string, frontmatter?: Record<string, unknown> | null, wordCount?: number): string {
    const currentTabs = get(tabs);

    // If file is already open, switch to it
    const existing = currentTabs.find((t) => t.filePath === filePath);
    if (existing) {
      activeTabId.set(existing.id);
      tabs.update((ts) =>
        ts.map((t) =>
          t.id === existing.id ? { ...t, content, renderedHtml, frontmatter: frontmatter ?? null, wordCount: wordCount ?? 0 } : t
        )
      );
      return existing.id;
    }

    const id = generateId();
    const newTab: Tab = { id, filePath, fileName, content, renderedHtml, frontmatter: frontmatter ?? null, wordCount: wordCount ?? 0, scrollTop: 0 };

    tabs.update((ts) => [...ts, newTab]);
    activeTabId.set(id);
    return id;
  }

  function closeTab(id: string) {
    if (id === HOME_TAB_ID) return; // Can't close home tab
    saveScrollPosition();
    const currentTabs = get(tabs);
    const idx = currentTabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const newTabs = currentTabs.filter((t) => t.id !== id);
    tabs.set(newTabs);

    // If closing the active tab, switch to adjacent or home
    if (get(activeTabId) === id) {
      if (newTabs.length === 0) {
        activeTabId.set(HOME_TAB_ID);
      } else {
        const newIdx = Math.min(idx, newTabs.length - 1);
        activeTabId.set(newTabs[newIdx].id);
      }
    }
  }

  function goHome() {
    saveScrollPosition();
    activeTabId.set(HOME_TAB_ID);
  }

  function saveScrollPosition() {
    const currentId = get(activeTabId);
    if (currentId) {
      const scrollTop = window.scrollY;
      tabs.update((ts) =>
        ts.map((t) => (t.id === currentId ? { ...t, scrollTop } : t))
      );
    }
  }

  function switchTab(id: string) {
    if (get(activeTabId) === id) return;
    saveScrollPosition();
    activeTabId.set(id);
  }

  function updateTabContent(filePath: string, content: string, renderedHtml: string, frontmatter?: Record<string, unknown> | null, wordCount?: number) {
    tabs.update((ts) =>
      ts.map((t) =>
        t.filePath === filePath ? { ...t, content, renderedHtml, frontmatter: frontmatter ?? t.frontmatter, wordCount: wordCount ?? t.wordCount } : t
      )
    );
  }

  function getActiveTab(): Tab | null {
    const id = get(activeTabId);
    if (!id) return null;
    return get(tabs).find((t) => t.id === id) ?? null;
  }

  function reorderTabs(fromIndex: number, toIndex: number) {
    tabs.update((ts) => {
      const arr = [...ts];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });
  }

  return {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    switchTab,
    updateTabContent,
    getActiveTab,
    reorderTabs,
    goHome,
  };
}

export const tabStore = createTabStore();
