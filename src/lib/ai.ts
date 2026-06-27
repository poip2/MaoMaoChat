import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onThinking?: (text: string) => void;
  onDone?: () => void;
  onError?: (msg: string) => void;
  onCancelled?: () => void;
}

/**
 * Invoke the Rust side to start a streaming AI generation.
 * Event listeners are set up before the invoke so no chunks are lost.
 */
export async function streamAI(
  prompt: string,
  handlers: StreamHandlers,
  opts: { configId: string; baseUrl: string; model: string; system?: string },
): Promise<void> {
  const uns: UnlistenFn[] = [];
  const cleanup = () => uns.forEach((u) => u());

  // Register listeners before invoking so we don't miss early events
  uns.push(
    await listen<string>("ai-chunk", (e) => handlers.onChunk(e.payload)),
  );
  uns.push(
    await listen<string>("ai-thinking", (e) => handlers.onThinking?.(e.payload)),
  );
  uns.push(
    await listen("ai-done", () => {
      handlers.onDone?.();
      cleanup();
    }),
  );
  uns.push(
    await listen("ai-cancelled", () => {
      handlers.onCancelled?.();
      cleanup();
    }),
  );
  uns.push(
    await listen<string>("ai-error", (e) => {
      handlers.onError?.(e.payload);
      cleanup();
    }),
  );

  try {
    await invoke("ai_generate", {
      prompt,
      configId: opts.configId,
      baseUrl: opts.baseUrl,
      model: opts.model,
      system: opts.system,
    });
  } catch (err) {
    // invoke itself failed (e.g. keyring read error before stream starts)
    handlers.onError?.(String(err));
    cleanup();
  }
}

/** Cancel an in-flight generation. */
export const cancelAI = () => invoke("ai_cancel");

/** Save an API key for a config (keychain only, skips if empty). */
export const saveAiKey = (id: string, apiKey: string) =>
  invoke("save_ai_key", { id, apiKey });

/** Check which config IDs have API keys stored in keychain. */
export const checkAiKeys = (ids: string[]): Promise<boolean[]> =>
  invoke("check_ai_keys", { ids });

/** Delete the API key for a config from keychain (idempotent). */
export const deleteAiKey = (id: string) =>
  invoke("delete_ai_key", { id });

/** Migrate legacy single-config keychain entries to the new per-config scheme. */
export const migrateLegacyAiConfig = (): Promise<{ migrated: boolean; id: string }> =>
  invoke("migrate_legacy_ai_config");
