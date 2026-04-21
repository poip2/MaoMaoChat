import { writable } from "svelte/store";

const STORAGE_KEY = "mdhero_pinned_folders";

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function savePinned(folders: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  } catch {}
}

const store = writable<string[]>(loadPinned());

store.subscribe((folders) => {
  savePinned(folders);
});

export const pinnedFolders = {
  subscribe: store.subscribe,

  add(path: string) {
    store.update((folders) => {
      if (folders.includes(path)) return folders;
      return [...folders, path];
    });
  },

  remove(path: string) {
    store.update((folders) => folders.filter((f) => f !== path));
  },
};
