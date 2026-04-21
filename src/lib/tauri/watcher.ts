import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { reloadCurrentFile } from "./files";

let unlisten: UnlistenFn | null = null;
let reloadTimeout: ReturnType<typeof setTimeout> | null = null;

export async function startFileWatcher(filePath: string): Promise<void> {
  if (unlisten) {
    unlisten();
  }

  unlisten = await listen<{ path: string }>("file-changed", () => {
    // Debounce on frontend too — editors may trigger multiple events
    if (reloadTimeout) clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
      reloadCurrentFile(filePath);
    }, 100);
  });
}

export function stopFileWatcher(): void {
  if (reloadTimeout) {
    clearTimeout(reloadTimeout);
    reloadTimeout = null;
  }
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
}
