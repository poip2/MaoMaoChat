import { writable } from "svelte/store";

const GITHUB_REPO = "vaibhavuk-dev/mdhero";
const CURRENT_VERSION = "0.2.0";
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = "mdhero_update_check";

export interface UpdateInfo {
  version: string;
  url: string;
}

export const updateAvailable = writable<UpdateInfo | null>(null);
export const updateDismissed = writable(false);

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export async function checkForUpdates(): Promise<void> {
  // Skip in dev mode
  if (import.meta.env.DEV) return;

  // Throttle: only check once per 24h
  try {
    const last = localStorage.getItem(STORAGE_KEY);
    if (last && Date.now() - parseInt(last) < CHECK_INTERVAL) return;
  } catch {}

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github.v3+json" } }
    );
    if (!res.ok) return;

    const data = await res.json();
    const latestTag: string = data.tag_name ?? "";
    const releaseUrl: string = data.html_url ?? "";

    if (latestTag && compareVersions(latestTag, CURRENT_VERSION) > 0) {
      updateAvailable.set({
        version: latestTag.replace(/^v/, ""),
        url: releaseUrl,
      });
    }

    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  } catch {
    // Network error — silently skip
  }
}

export function dismissUpdate(): void {
  updateDismissed.set(true);
}
