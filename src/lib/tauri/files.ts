import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { document } from "../stores/document";
import { tabStore } from "../stores/tabs";
import { renderFull } from "../renderer/pipeline";
import { addRecentFile } from "../stores/recents";

export async function readMarkdownFile(path: string): Promise<string> {
  return invoke<string>("read_markdown_file", { path });
}

export async function openFile(path: string): Promise<void> {
  const fileName = path.split("/").pop() ?? path;

  document.set({
    filePath: path,
    fileName,
    content: "",
    renderedHtml: "",
    frontmatter: null,
    wordCount: 0,
    loading: true,
    error: null,
  });

  try {
    const content = await readMarkdownFile(path);
    const baseDir = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : undefined;
    const result = renderFull(content, baseDir);

    tabStore.addTab(path, fileName, content, result.html, result.frontmatter, result.wordCount);

    document.set({
      filePath: path,
      fileName,
      content,
      renderedHtml: result.html,
      frontmatter: result.frontmatter,
      wordCount: result.wordCount,
      loading: false,
      error: null,
    });

    addRecentFile(path, fileName);
    getCurrentWindow().setTitle(`${fileName} — MDHero`).catch(() => {});
    invoke("start_watching", { path }).catch(() => {});
  } catch (err) {
    document.set({
      filePath: path,
      fileName,
      content: "",
      renderedHtml: "",
      frontmatter: null,
      wordCount: 0,
      loading: false,
      error: `Failed to open file: ${err}`,
    });
  }
}

export async function openFileDialog(): Promise<void> {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Markdown",
          extensions: ["md", "markdown", "mdown", "mkd", "txt"],
        },
      ],
    });

    if (selected) {
      // selected can be string or string[] depending on version
      const path = typeof selected === "string" ? selected : (selected as any)?.path ?? String(selected);
      await openFile(path);
    }
  } catch (err) {
    console.error("File dialog error:", err);
  }
}

export async function reloadCurrentFile(path: string): Promise<void> {
  try {
    const content = await readMarkdownFile(path);
    const baseDir = path.substring(0, path.lastIndexOf("/"));
    const result = renderFull(content, baseDir);
    const fileName = path.split("/").pop() ?? path;

    tabStore.updateTabContent(path, content, result.html, result.frontmatter, result.wordCount);

    document.set({
      filePath: path,
      fileName,
      content,
      renderedHtml: result.html,
      frontmatter: result.frontmatter,
      wordCount: result.wordCount,
      loading: false,
      error: null,
    });
  } catch (err) {
    console.error("Failed to reload file:", err);
  }
}
