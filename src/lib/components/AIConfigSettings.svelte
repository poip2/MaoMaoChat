<script lang="ts">
  import { onMount } from "svelte";
  import { loadAIConfig, saveAIConfig, type AiConfigPublic } from "$lib/ai";
  import { Eye, EyeOff } from "@lucide/svelte";

  let config = $state<AiConfigPublic | null>(null);
  let apiKey = $state("");
  let baseUrl = $state("https://api.anthropic.com/v1");
  let model = $state("claude-sonnet-4-20250514");
  let showKey = $state(false);
  let saving = $state(false);
  let error = $state("");
  let success = $state(false);

  onMount(async () => {
    try {
      config = await loadAIConfig();
      baseUrl = config.base_url;
      model = config.model;
    } catch (e) {
      console.error("Failed to load AI config:", e);
    }
  });

  async function handleSave() {
    if (!apiKey.trim() && !config?.configured) {
      error = "API Key is required";
      return;
    }

    saving = true;
    error = "";
    success = false;

    try {
      // Only pass apiKey if user entered a new one
      const keyToSave = apiKey.trim() || undefined;
      await saveAIConfig(
        keyToSave ? apiKey : "",  // empty string means "don't change"
        baseUrl,
        model,
      );
      // Reload to confirm
      config = await loadAIConfig();
      apiKey = ""; // Clear the input — key is in keyring now
      success = true;
      setTimeout(() => (success = false), 2000);
    } catch (e) {
      error = String(e);
    } finally {
      saving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }
</script>

<div class="ai-config" onkeydown={handleKeydown}>
  <div class="status-badge" class:configured={config?.configured}>
    {config?.configured ? "✓ Configured" : "Not configured"}
  </div>

  <div class="field">
    <label class="field-label" for="ai-api-key">API Key</label>
    <div class="input-wrap">
      <input
        id="ai-api-key"
        type={showKey ? "text" : "password"}
        bind:value={apiKey}
        placeholder={config?.configured ? "•••••••••••••••••••• (saved)" : "sk-ant-..."}
        class="text-input"
        autocomplete="off"
        spellcheck="false"
      />
      <button
        type="button"
        class="toggle-vis"
        onclick={() => (showKey = !showKey)}
        title={showKey ? "Hide key" : "Show key"}
      >
        {#if showKey}
          <EyeOff size={14} />
        {:else}
          <Eye size={14} />
        {/if}
      </button>
    </div>
    <p class="field-hint">Stored in your OS keychain — never sent to the frontend.</p>
  </div>

  <div class="field">
    <label class="field-label" for="ai-base-url">Base URL</label>
    <input
      id="ai-base-url"
      type="text"
      bind:value={baseUrl}
      placeholder="https://api.anthropic.com/v1"
      class="text-input mono"
    />
    <p class="field-hint">
      Must end with <code>/v1</code>. Examples:
      <code>https://api.anthropic.com/v1</code> or a proxy like
      <code>https://proxy.example.com/v1</code>.
    </p>
  </div>

  <div class="field">
    <label class="field-label" for="ai-model">Model</label>
    <input
      id="ai-model"
      type="text"
      bind:value={model}
      placeholder="claude-sonnet-4-20250514"
      class="text-input mono"
    />
    <p class="field-hint">
      Default: <code>claude-sonnet-4-20250514</code>. Other options: <code>claude-3-5-sonnet-20241022</code>, <code>claude-3-opus-20240229</code>, etc.
    </p>
  </div>

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}

  {#if success}
    <div class="success-msg">Saved successfully</div>
  {/if}

  <button
    class="save-btn"
    onclick={handleSave}
    disabled={saving}
  >
    {saving ? "Saving…" : "Save Configuration"}
  </button>
</div>

<style>
  .ai-config {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    background: #fee;
    color: #c44;
    align-self: flex-start;
  }

  .status-badge.configured {
    background: #d4f5e9;
    color: #0d7a4f;
  }

  :global(html.dark) .status-badge {
    background: #2a1414;
    color: #ff6b6b;
  }

  :global(html.dark) .status-badge.configured {
    background: #0d2818;
    color: #4ade80;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: #636366;
  }

  :global(html.dark) .field-label {
    color: #aeaeb2;
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .text-input {
    width: 100%;
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 12px;
    font-family: inherit;
    color: #1c1c1e;
  }

  .text-input.mono {
    font-family: "SF Mono", "JetBrains Mono", Menlo, monospace;
    font-size: 11px;
  }

  :global(html.dark) .text-input {
    background: #1c1c1e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .text-input:focus {
    outline: none;
    border-color: #0891b2;
  }

  .input-wrap .text-input {
    padding-right: 32px;
  }

  .toggle-vis {
    position: absolute;
    right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    color: #8e8e93;
    cursor: pointer;
    border-radius: 4px;
  }

  .toggle-vis:hover {
    background: #f2f2f7;
    color: #1c1c1e;
  }

  :global(html.dark) .toggle-vis:hover {
    background: #3a3a3c;
    color: #e5e5e7;
  }

  .field-hint {
    font-size: 11px;
    color: #8e8e93;
    line-height: 1.4;
    margin: 0;
  }

  .field-hint code {
    font-family: "SF Mono", "JetBrains Mono", Menlo, monospace;
    font-size: 10px;
    background: #f2f2f7;
    padding: 1px 4px;
    border-radius: 3px;
    color: #0e7490;
  }

  :global(html.dark) .field-hint code {
    background: #2c2c2e;
    color: #22d3ee;
  }

  .error-msg {
    font-size: 11px;
    color: #c44;
    padding: 6px 10px;
    background: #fef2f2;
    border-radius: 6px;
  }

  :global(html.dark) .error-msg {
    color: #ff6b6b;
    background: #2a1414;
  }

  .success-msg {
    font-size: 11px;
    color: #0d7a4f;
    padding: 6px 10px;
    background: #d4f5e9;
    border-radius: 6px;
  }

  :global(html.dark) .success-msg {
    color: #4ade80;
    background: #0d2818;
  }

  .save-btn {
    align-self: flex-start;
    padding: 6px 16px;
    background: #0891b2;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s;
  }

  .save-btn:hover:not(:disabled) {
    background: #0e7490;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
