import { writable, get } from "svelte/store";
import { checkAiKeys, deleteAiKey, migrateLegacyAiConfig } from "$lib/ai";

const STORAGE_KEY = "maomaochat:apiConfigs";
const SCHEMA_VERSION = 1 as const;

export interface ApiConfig {
  id: string; // crypto.randomUUID()
  name: string; // user-defined label, e.g. "Anthropic Default"
  base_url: string; // e.g. "https://api.anthropic.com/v1"
  model: string; // e.g. "claude-sonnet-4-20250514"
  configured: boolean; // NOT persisted; filled by check_ai_keys() at runtime
}

interface ApiConfigStore {
  schemaVersion: typeof SCHEMA_VERSION;
  configs: ApiConfig[];
  activeId: string; // ID of the config used for AI generation
}

const DEFAULT_CONFIG: ApiConfigStore = {
  schemaVersion: SCHEMA_VERSION,
  configs: [
    {
      id: "default",
      name: "Default",
      base_url: "https://api.anthropic.com/v1",
      model: "claude-sonnet-4-20250514",
      configured: false,
    },
  ],
  activeId: "default",
};

function isValidStore(raw: unknown): raw is ApiConfigStore {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Partial<ApiConfigStore>;
  return (
    s.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(s.configs) &&
    typeof s.activeId === "string"
  );
}

function load(): ApiConfigStore {
  if (typeof localStorage === "undefined") return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    const parsed = JSON.parse(raw);
    if (!isValidStore(parsed)) return structuredClone(DEFAULT_CONFIG);
    return parsed;
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

function persist(s: ApiConfigStore) {
  if (typeof localStorage === "undefined") return;
  // Strip configured flag before persisting — it reflects keychain state, not app state
  const stripped: ApiConfigStore = {
    ...s,
    configs: s.configs.map((c) => ({ ...c, configured: false })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
}

const store = writable<ApiConfigStore>(load());

function update(fn: (s: ApiConfigStore) => ApiConfigStore) {
  store.update((s) => {
    const next = fn(s);
    persist(next);
    return next;
  });
}

/**
 * Initialize the API configs store. Call once on app mount.
 * Handles migration from legacy single-config format and checks keychain
 * status for all configs.
 */
export async function initApiConfigs(): Promise<void> {
  const s = get(store);

  // If store is empty or invalid, attempt legacy migration first
  if (s.configs.length === 0) {
    try {
      const result = await migrateLegacyAiConfig();
      if (result.migrated) {
        const migratedStore: ApiConfigStore = {
          schemaVersion: SCHEMA_VERSION,
          configs: [
            {
              id: result.id,
              name: "Default",
              base_url: "https://api.anthropic.com/v1",
              model: "claude-sonnet-4-20250514",
              configured: false, // will be checked below
            },
          ],
          activeId: result.id,
        };
        store.set(migratedStore);
        persist(migratedStore);
      }
    } catch (e) {
      console.error("Legacy AI config migration failed:", e);
    }
  }

  // Check keychain status for all configs
  const current = get(store);
  if (current.configs.length === 0) return;

  try {
    const ids = current.configs.map((c) => c.id);
    const results = await checkAiKeys(ids);
    store.update((s) => ({
      ...s,
      configs: s.configs.map((c, i) => ({
        ...c,
        configured: results[i] ?? false,
      })),
    }));
  } catch (e) {
    console.error("Failed to check AI keys:", e);
  }
}

function newId(): string {
  return crypto.randomUUID();
}

/** Add a new API config. Returns the new config's ID. */
export function addConfig(name: string, base_url: string, model: string): string {
  const id = newId();
  update((s) => ({
    ...s,
    configs: [...s.configs, { id, name, base_url, model, configured: false }],
    // First config added to an empty store becomes active
    activeId: s.activeId || id,
  }));
  return id;
}

/** Update an existing config's metadata (name, base_url, model). */
export function updateConfig(
  id: string,
  patch: Partial<Pick<ApiConfig, "name" | "base_url" | "model">>,
) {
  update((s) => ({
    ...s,
    configs: s.configs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  }));
}

/**
 * Remove a config. Deletes its API key from keychain first.
 * If the removed config was active, falls back to the first remaining config.
 */
export async function removeConfig(id: string): Promise<void> {
  try {
    await deleteAiKey(id);
  } catch (e) {
    console.error("Failed to delete AI key:", e);
  }
  update((s) => {
    const configs = s.configs.filter((c) => c.id !== id);
    const activeId = s.activeId === id ? (configs[0]?.id ?? "") : s.activeId;
    return { ...s, configs, activeId };
  });
}

/** Set the active config by ID. */
export function setActiveConfig(id: string) {
  update((s) => ({ ...s, activeId: id }));
}

/**
 * Check keychain status for specific config IDs and update the in-memory store.
 * Does NOT persist the configured flag (it's runtime-only).
 */
export async function refreshConfiguredStatus(ids: string[]): Promise<void> {
  try {
    const results = await checkAiKeys(ids);
    store.update((s) => ({
      ...s,
      configs: s.configs.map((c) => {
        const idx = ids.indexOf(c.id);
        return idx >= 0 ? { ...c, configured: results[idx] ?? false } : c;
      }),
    }));
  } catch (e) {
    console.error("Failed to refresh configured status:", e);
  }
}

/** Get the currently active config, or null if none. */
export function getActiveConfig(): ApiConfig | null {
  const s = get(store);
  return s.configs.find((c) => c.id === s.activeId) ?? null;
}

export const apiConfigs = {
  subscribe: store.subscribe,
};
