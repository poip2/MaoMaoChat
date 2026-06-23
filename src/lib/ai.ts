import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AiConfigPublic {
  configured: boolean;
  base_url: string;
  model: string;
}

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
  opts?: { model?: string; system?: string },
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
      model: opts?.model,
      system: opts?.system,
    });
  } catch (err) {
    // invoke itself failed (e.g. keyring read error before stream starts)
    handlers.onError?.(String(err));
    cleanup();
  }
}

/** Cancel an in-flight generation. */
export const cancelAI = () => invoke("ai_cancel");

/** Persist API key + base URL into the OS keychain. */
export const saveAIConfig = (
  apiKey: string,
  baseUrl: string,
  model?: string,
) => invoke("save_ai_config", { apiKey, baseUrl, model });

/** Load the public part of the AI config (no key). */
export const loadAIConfig = (): Promise<AiConfigPublic> =>
  invoke("load_ai_config");
