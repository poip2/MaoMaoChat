/**
 * Scroll synchronization across viewer / raw / editor modes.
 *
 * Strategy: anchor on the source markdown's line number. The renderer stamps
 * `data-source-line="N"` on every top-level block element. Raw and editor
 * use lineHeight × scrollTop to estimate the line.
 *
 * Limitation: long lines that visually wrap are counted as a single source line
 * but occupy multiple visual rows. For typical markdown documents the drift is
 * small; if it ever matters we can add a hidden mirror-div line measurer.
 */

export type ViewMode = "viewer" | "raw" | "editor";

const TOOLBAR_TABBAR_HEIGHT = 80; // approximate sticky chrome at top

/** Read the source line currently anchored at the top of the viewport. */
export function getCurrentSourceLine(mode: ViewMode): number {
  if (mode === "viewer") return readViewerLine();
  if (mode === "raw") return readRawLine();
  return readEditorLine();
}

/** Scroll the destination mode so source `line` is anchored at the top. */
export function scrollToSourceLine(mode: ViewMode, line: number): void {
  if (line <= 0) {
    if (mode === "editor") {
      const ta = getEditorEl();
      if (ta) ta.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
    }
    return;
  }
  if (mode === "viewer") scrollViewerToLine(line);
  else if (mode === "raw") scrollRawToLine(line);
  else scrollEditorToLine(line);
}

// --- Viewer (rendered HTML with data-source-line stamps) ---

function readViewerLine(): number {
  const article = document.querySelector("article.prose");
  if (!article) return 0;
  const elements = article.querySelectorAll<HTMLElement>("[data-source-line]");
  if (elements.length === 0) return 0;

  // Find the topmost element whose bottom is below the chrome line.
  // That is the block currently "in view" at the top.
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom > TOOLBAR_TABBAR_HEIGHT) {
      return parseInt(el.getAttribute("data-source-line") || "0", 10);
    }
  }
  // Past the end — return the last block's line
  const last = elements[elements.length - 1];
  return parseInt(last.getAttribute("data-source-line") || "0", 10);
}

function scrollViewerToLine(line: number): void {
  const article = document.querySelector("article.prose");
  if (!article) return;
  const elements = Array.from(article.querySelectorAll<HTMLElement>("[data-source-line]"));
  if (elements.length === 0) return;

  // Find the element at or just past the target line
  let target: HTMLElement | null = null;
  for (const el of elements) {
    const elLine = parseInt(el.getAttribute("data-source-line") || "0", 10);
    if (elLine >= line) {
      target = el;
      break;
    }
  }
  if (!target) target = elements[elements.length - 1];

  const rect = target.getBoundingClientRect();
  window.scrollTo(0, window.scrollY + rect.top - TOOLBAR_TABBAR_HEIGHT);
}

// --- Raw (window-scrolled <pre class="raw-source">) ---

function readRawLine(): number {
  const pre = document.querySelector<HTMLPreElement>(".raw-source");
  if (!pre) return 0;
  const lineHeight = parseFloat(getComputedStyle(pre).lineHeight) || 16;
  const preTop = pre.getBoundingClientRect().top;
  // pixels of pre that have scrolled above the chrome line
  const hidden = TOOLBAR_TABBAR_HEIGHT - preTop;
  if (hidden <= 0) return 0;
  return Math.floor(hidden / lineHeight);
}

function scrollRawToLine(line: number): void {
  const pre = document.querySelector<HTMLPreElement>(".raw-source");
  if (!pre) return;
  const lineHeight = parseFloat(getComputedStyle(pre).lineHeight) || 16;
  const preTopAbsolute = pre.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, preTopAbsolute + line * lineHeight - TOOLBAR_TABBAR_HEIGHT);
}

// --- Editor (textarea with internal scroll) ---

function getEditorEl(): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>(".editor");
}

function readEditorLine(): number {
  const ta = getEditorEl();
  if (!ta) return 0;
  const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 16;
  return Math.floor(ta.scrollTop / lineHeight);
}

function scrollEditorToLine(line: number): void {
  const ta = getEditorEl();
  if (!ta) return;
  const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 16;
  ta.scrollTop = Math.round(line * lineHeight);
}
