<script lang="ts">
  import { tick } from "svelte";

  let {
    visible = $bindable(false),
    onGenerate = (_prompt: string, _system?: string) => {},
    aiConfigured = false,
  }: {
    visible: boolean;
    onGenerate?: (prompt: string, system?: string) => void;
    aiConfigured?: boolean;
  } = $props();

  let promptText = $state("");
  let systemPrompt = $state("");
  let promptEl: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    if (visible) {
      promptText = "";
      systemPrompt = "";
      tick().then(() => promptEl?.focus());
    }
  });

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) visible = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      visible = false;
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  }

  function handleGenerate() {
    if (!promptText.trim()) return;
    onGenerate(
      promptText.trim(),
      systemPrompt.trim() || undefined,
    );
    visible = false;
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
    <div class="dialog">
      <div class="dialog-header">
        <h2 class="dialog-title">AI Generate</h2>
        <button onclick={() => (visible = false)} class="dialog-close" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/>
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        {#if !aiConfigured}
          <div class="warning-box">
            <p>⚠️ AI is not configured yet. Please go to <strong>Settings → AI Generate</strong> to set your API key first.</p>
          </div>
        {/if}

        <div class="field">
          <label class="field-label" for="ai-prompt">Prompt</label>
          <textarea
            id="ai-prompt"
            bind:this={promptEl}
            bind:value={promptText}
            placeholder="Write me a markdown document about..."
            class="prompt-input"
            rows="6"
          ></textarea>
          <p class="field-hint">
            The AI will generate markdown content based on your prompt and insert it into the editor.
          </p>
        </div>

        <div class="field">
          <label class="field-label" for="ai-system">System Prompt <span class="optional">(optional)</span></label>
          <textarea
            id="ai-system"
            bind:value={systemPrompt}
            placeholder="You are a helpful writing assistant. Write in markdown format."
            class="prompt-input system-input"
            rows="3"
          ></textarea>
          <p class="field-hint">
            Guides the AI's behavior. Leave empty for default.
          </p>
        </div>
      </div>

      <div class="dialog-footer">
        <button onclick={() => (visible = false)} class="btn btn-secondary">
          Cancel
        </button>
        <button
          onclick={handleGenerate}
          disabled={!promptText.trim() || !aiConfigured}
          class="btn btn-primary"
        >
          Generate →
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    background: rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
  }

  .dialog {
    width: 560px;
    max-height: 80vh;
    background: white;
    border: 1px solid #e5e5ea;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :global(html.dark) .dialog {
    background: #2c2c2e;
    border-color: #3a3a3c;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #f2f2f7;
  }

  :global(html.dark) .dialog-header {
    border-bottom-color: #3a3a3c;
  }

  .dialog-title {
    font-size: 15px;
    font-weight: 600;
    color: #1c1c1e;
    margin: 0;
  }

  :global(html.dark) .dialog-title {
    color: #e5e5e7;
  }

  .dialog-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    color: #aeaeb2;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .dialog-close:hover {
    background: #f2f2f7;
    color: #636366;
  }

  :global(html.dark) .dialog-close:hover {
    background: #3a3a3c;
    color: #e5e5e7;
  }

  .dialog-body {
    padding: 14px 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .warning-box {
    padding: 10px 12px;
    background: #fff8e1;
    border: 1px solid #ffe082;
    border-radius: 8px;
    font-size: 12px;
    color: #795548;
    line-height: 1.5;
  }

  :global(html.dark) .warning-box {
    background: #2a1f00;
    border-color: #5d4300;
    color: #ffcc80;
  }

  .warning-box p {
    margin: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: #636366;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  :global(html.dark) .field-label {
    color: #aeaeb2;
  }

  .optional {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: #aeaeb2;
  }

  .field-hint {
    font-size: 11px;
    color: #8e8e93;
    line-height: 1.4;
    margin: 0;
  }

  .prompt-input {
    width: 100%;
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    color: #1c1c1e;
    font-family: inherit;
    resize: vertical;
    line-height: 1.45;
  }

  :global(html.dark) .prompt-input {
    background: #1c1c1e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .prompt-input:focus {
    outline: none;
    border-color: #0891b2;
  }

  .system-input {
    font-size: 12px;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #f2f2f7;
  }

  :global(html.dark) .dialog-footer {
    border-top-color: #3a3a3c;
  }

  .btn {
    padding: 6px 14px;
    border: none;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
  }

  .btn-secondary {
    background: #f2f2f7;
    color: #1c1c1e;
  }

  :global(html.dark) .btn-secondary {
    background: #3a3a3c;
    color: #e5e5e7;
  }

  .btn-secondary:hover {
    background: #e5e5ea;
  }

  :global(html.dark) .btn-secondary:hover {
    background: #48484a;
  }

  .btn-primary {
    background: #0891b2;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0e7490;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
