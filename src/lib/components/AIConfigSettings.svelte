<script lang="ts">
  import { onMount } from "svelte";
  import { ChevronDown, ChevronRight } from "@lucide/svelte";
  import {
    apiConfigs,
    initApiConfigs,
    addConfig,
    updateConfig,
    removeConfig,
    setActiveConfig,
    refreshConfiguredStatus,
    type ApiConfig,
  } from "$lib/stores/apiConfigs";
  import { saveAiKey } from "$lib/ai";

  let loading = $state(true);
  let expandedId = $state<string | null>(null);
  let saving = $state<string | null>(null); // config ID being saved

  // Form state for the currently expanded config
  let formName = $state("");
  let formApiKey = $state("");
  let formBaseUrl = $state("");
  let formModel = $state("");
  let formError = $state("");
  let formSuccess = $state(false);

  // Add-new state
  let addingNew = $state(false);
  let newName = $state("");
  let newBaseUrl = $state("https://api.anthropic.com/v1");
  let newModel = $state("claude-sonnet-4-20250514");
  let newError = $state("");

  onMount(async () => {
    await initApiConfigs();
    loading = false;
  });

  function toggleExpand(c: ApiConfig) {
    if (expandedId === c.id) {
      expandedId = null;
      return;
    }
    expandedId = c.id;
    formName = c.name;
    formApiKey = "";
    formBaseUrl = c.base_url;
    formModel = c.model;
    formError = "";
    formSuccess = false;
  }

  async function handleSave(c: ApiConfig) {
    if (!formName.trim()) {
      formError = "Name is required";
      return;
    }
    if (!formBaseUrl.trim()) {
      formError = "Base URL is required";
      return;
    }
    if (!formModel.trim()) {
      formError = "Model is required";
      return;
    }

    saving = c.id;
    formError = "";
    formSuccess = false;

    try {
      // Save API key if entered
      if (formApiKey.trim()) {
        await saveAiKey(c.id, formApiKey.trim());
      }
      // Save metadata to localStorage
      updateConfig(c.id, {
        name: formName.trim(),
        base_url: formBaseUrl.trim(),
        model: formModel.trim(),
      });
      // Refresh keychain status
      await refreshConfiguredStatus([c.id]);
      formApiKey = "";
      formSuccess = true;
      setTimeout(() => (formSuccess = false), 2000);
    } catch (e) {
      formError = String(e);
    } finally {
      saving = null;
    }
  }

  async function handleRemove(c: ApiConfig) {
    const count = $apiConfigs.configs.length;
    const msg =
      count <= 1
        ? `Delete "${c.name}"? This is your last config — AI generation will be unavailable until you add a new one.`
        : `Delete "${c.name}"?`;
    if (!confirm(msg)) return;

    await removeConfig(c.id);
    if (expandedId === c.id) {
      expandedId = null;
    }
  }

  function handleSetActive(c: ApiConfig) {
    setActiveConfig(c.id);
  }

  function startAddNew() {
    addingNew = true;
    newName = "";
    newBaseUrl = "https://api.anthropic.com/v1";
    newModel = "claude-sonnet-4-20250514";
    newError = "";
  }

  function cancelAddNew() {
    addingNew = false;
    newError = "";
  }

  function confirmAddNew() {
    if (!newName.trim()) {
      newError = "Name is required";
      return;
    }
    if (!newBaseUrl.trim()) {
      newError = "Base URL is required";
      return;
    }
    if (!newModel.trim()) {
      newError = "Model is required";
      return;
    }
    addConfig(newName.trim(), newBaseUrl.trim(), newModel.trim());
    addingNew = false;
  }

  function handleKeydownAddNew(e: KeyboardEvent) {
    if (e.key === "Escape") {
      cancelAddNew();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      confirmAddNew();
    }
  }
</script>

<div class="api-configs-root">
  {#if loading}
    <div class="loading-msg">Loading API configs…</div>
  {:else}
    {#each $apiConfigs.configs as c (c.id)}
      {@const isExpanded = expandedId === c.id}
      {@const isActive = $apiConfigs.activeId === c.id}

      <div class="config-card" class:config-expanded={isExpanded}>
        <!-- Collapsed row -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="config-row" onclick={() => toggleExpand(c)}>
          <span class="chevron" aria-hidden="true">
            {#if isExpanded}<ChevronDown size={12} strokeWidth={2.25} />{:else}<ChevronRight size={12} strokeWidth={2.25} />{/if}
          </span>
          <span class="config-name">{c.name}</span>
          {#if isActive}
            <span class="active-badge">● Active</span>
          {/if}
          {#if c.configured}
            <span class="configured-dot" title="API key configured"></span>
          {/if}
        </div>

        {#if isExpanded}
          <div class="config-form">
            <div class="field">
              <label class="field-label" for="cfg-name-{c.id}">Name</label>
              <input
                id="cfg-name-{c.id}"
                type="text"
                class="text-input"
                bind:value={formName}
                placeholder="e.g. Anthropic Default"
              />
            </div>

            <div class="field">
              <label class="field-label" for="cfg-key-{c.id}">API Key</label>
              <input
                id="cfg-key-{c.id}"
                type="password"
                class="text-input"
                bind:value={formApiKey}
                placeholder={c.configured ? "•••••••••• (saved)" : "sk-ant-..."}
                autocomplete="off"
                spellcheck="false"
              />
              <p class="field-hint">Stored in your OS keychain — never sent to the frontend.</p>
            </div>

            <div class="field">
              <label class="field-label" for="cfg-url-{c.id}">Base URL</label>
              <input
                id="cfg-url-{c.id}"
                type="text"
                class="text-input mono"
                bind:value={formBaseUrl}
                placeholder="https://api.anthropic.com/v1"
              />
            </div>

            <div class="field">
              <label class="field-label" for="cfg-model-{c.id}">Model</label>
              <input
                id="cfg-model-{c.id}"
                type="text"
                class="text-input mono"
                bind:value={formModel}
                placeholder="claude-sonnet-4-20250514"
              />
            </div>

            {#if formError && expandedId === c.id}
              <div class="form-error">{formError}</div>
            {/if}

            {#if formSuccess && expandedId === c.id}
              <div class="form-success">Saved successfully</div>
            {/if}

            <div class="form-actions">
              <button
                class="form-btn"
                onclick={() => handleSetActive(c)}
                disabled={isActive}
                title={isActive ? "Already active" : "Set as active config"}
              >
                {isActive ? "● Active" : "Set as active"}
              </button>
              <button
                class="form-btn form-btn-danger"
                onclick={() => handleRemove(c)}
              >
                Delete
              </button>
              <button
                class="form-btn form-btn-primary"
                onclick={() => handleSave(c)}
                disabled={saving === c.id}
              >
                {saving === c.id ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}

    {#if addingNew}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="config-card config-expanded" onkeydown={handleKeydownAddNew}>
        <div class="config-form">
          <div class="field">
            <label class="field-label" for="new-name">Name</label>
            <input
              id="new-name"
              type="text"
              class="text-input"
              bind:value={newName}
              placeholder="e.g. Anthropic Default"
            />
          </div>

          <div class="field">
            <label class="field-label" for="new-url">Base URL</label>
            <input
              id="new-url"
              type="text"
              class="text-input mono"
              bind:value={newBaseUrl}
              placeholder="https://api.anthropic.com/v1"
            />
          </div>

          <div class="field">
            <label class="field-label" for="new-model">Model</label>
            <input
              id="new-model"
              type="text"
              class="text-input mono"
              bind:value={newModel}
              placeholder="claude-sonnet-4-20250514"
            />
          </div>

          {#if newError}
            <div class="form-error">{newError}</div>
          {/if}

          <div class="form-actions">
            <button class="form-btn" onclick={cancelAddNew}>Cancel</button>
            <button class="form-btn form-btn-primary" onclick={confirmAddNew}>Add</button>
          </div>
        </div>
      </div>
    {:else}
      <button class="add-config-btn" onclick={startAddNew}>+ Add API config</button>
    {/if}
  {/if}
</div>

<style>
  .api-configs-root {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .loading-msg {
    font-size: 12px;
    color: #8e8e93;
    padding: 8px 0;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  /* --- Config card ------------------------------------------------------ */

  .config-card {
    border: 1px solid #e5e5ea;
    border-radius: 8px;
    background: transparent;
    overflow: hidden;
  }

  :global(html.dark) .config-card {
    border-color: #3a3a3c;
  }

  .config-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    cursor: pointer;
    user-select: none;
    transition: background 0.12s;
  }

  .config-row:hover {
    background: #f7f7f9;
  }

  :global(html.dark) .config-row:hover {
    background: #2a2a2c;
  }

  .chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #aeaeb2;
    width: 14px;
    flex-shrink: 0;
  }

  .config-name {
    font-size: 13px;
    font-weight: 500;
    color: #1c1c1e;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(html.dark) .config-name {
    color: #e5e5e7;
  }

  .active-badge {
    font-size: 11px;
    font-weight: 600;
    color: #0d7a4f;
    background: #d4f5e9;
    padding: 2px 8px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  :global(html.dark) .active-badge {
    color: #4ade80;
    background: #0d2818;
  }

  .configured-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4ade80;
    flex-shrink: 0;
  }

  :global(html.dark) .configured-dot {
    background: #4ade80;
  }

  /* --- Expanded form ---------------------------------------------------- */

  .config-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: #f9f9fb;
    border-top: 1px solid #e5e5ea;
  }

  :global(html.dark) .config-form {
    background: #1c1c1e;
    border-top-color: #3a3a3c;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .field-label {
    font-size: 11px;
    font-weight: 600;
    color: #636366;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  :global(html.dark) .field-label {
    color: #aeaeb2;
  }

  .text-input {
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 5px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: inherit;
    color: #1c1c1e;
  }

  .text-input.mono {
    font-family: "SF Mono", "JetBrains Mono", Menlo, monospace;
    font-size: 11px;
  }

  :global(html.dark) .text-input {
    background: #2c2c2e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .text-input:focus {
    outline: none;
    border-color: #0891b2;
  }

  .field-hint {
    font-size: 10px;
    color: #8e8e93;
    line-height: 1.3;
    margin: 0;
  }

  .form-error {
    font-size: 11px;
    color: #c44;
    padding: 4px 8px;
    background: #fef2f2;
    border-radius: 5px;
  }

  :global(html.dark) .form-error {
    color: #ff6b6b;
    background: #2a1414;
  }

  .form-success {
    font-size: 11px;
    color: #0d7a4f;
    padding: 4px 8px;
    background: #d4f5e9;
    border-radius: 5px;
  }

  :global(html.dark) .form-success {
    color: #4ade80;
    background: #0d2818;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 2px;
  }

  .form-btn {
    padding: 5px 12px;
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 500;
    color: #1c1c1e;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
  }

  :global(html.dark) .form-btn {
    background: #2c2c2e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .form-btn:hover:not(:disabled) {
    background: #f2f2f7;
  }

  :global(html.dark) .form-btn:hover:not(:disabled) {
    background: #3a3a3c;
  }

  .form-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-btn-primary {
    background: #0891b2;
    border-color: #0891b2;
    color: white;
  }

  .form-btn-primary:hover:not(:disabled) {
    background: #0e7490;
  }

  .form-btn-danger:hover {
    background: #fee;
    color: #c44;
    border-color: #fcc;
  }

  :global(html.dark) .form-btn-danger:hover {
    background: #2a1414;
    color: #ff6b6b;
    border-color: #4a1a1a;
  }

  /* --- Add button ------------------------------------------------------- */

  .add-config-btn {
    background: none;
    border: 1px dashed #d1d1d6;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    color: #8e8e93;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    margin-top: 8px;
    text-align: center;
    width: 100%;
  }

  :global(html.dark) .add-config-btn {
    border-color: #48484a;
  }

  .add-config-btn:hover {
    background: #f2f2f7;
    color: #1c1c1e;
    border-color: #aeaeb2;
  }

  :global(html.dark) .add-config-btn:hover {
    background: #2c2c2e;
    color: #e5e5e7;
    border-color: #636366;
  }
</style>
