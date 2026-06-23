import { writable, get } from "svelte/store";

const STORAGE_KEY = "maomaochat-recent-files";
const MAX_RECENTS = 15;

export interface RecentFile {
  path: string;
  name: string;
  openedAt: number;
  scrollPercent?: number;
}

function load(): RecentFile[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(files: RecentFile[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export const recentFiles = writable<RecentFile[]>(load());

export function addRecentFile(path: string, name: string, scrollPercent?: number) {
  if (path.startsWith("paste://")) return;

  recentFiles.update((files) => {
    const existing = files.find((f) => f.path === path);
    const sp = scrollPercent ?? existing?.scrollPercent ?? 0;
    const filtered = files.filter((f) => f.path !== path);
    const updated = [{ path, name, openedAt: Date.now(), scrollPercent: sp }, ...filtered].slice(0, MAX_RECENTS);
    save(updated);
    return updated;
  });
}

export function updateScrollPercent(path: string, scrollPercent: number) {
  if (path.startsWith("paste://")) return;

  recentFiles.update((files) => {
    const updated = files.map((f) =>
      f.path === path ? { ...f, scrollPercent } : f
    );
    save(updated);
    return updated;
  });
}

export function removeRecentFile(path: string) {
  recentFiles.update((files) => {
    const updated = files.filter((f) => f.path !== path);
    save(updated);
    return updated;
  });
}

export function clearRecentFiles() {
  recentFiles.set([]);
  save([]);
}
