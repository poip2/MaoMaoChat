import { writable } from "svelte/store";

/**
 * In-app update notification layer.
 *
 * The *detection* layer lives in `updater.ts` (it polls GitHub releases and
 * drives the banner/toast). Since the native updater plugin is disabled,
 * "Update now" opens the release page in the user's browser instead.
 */

/** True while a download/install is in progress. */
export const updateInstalling = writable(false);
/** 0–100 once content length is known; -1 while indeterminate. */
export const updateProgress = writable(-1);
/** Human-readable error if the install failed (null = no error). */
export const updateError = writable<string | null>(null);

/**
 * Open the release page in the browser — the native updater plugin is
 * disabled, so we can't do in-app installs.
 */
export async function installUpdate(): Promise<void> {
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl("https://github.com/poip2/MaoMaoChat/releases/latest");
}
