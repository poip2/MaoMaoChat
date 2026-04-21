/**
 * Convert various markdown URLs to their raw content URLs.
 * Returns null if the URL doesn't look like it points to markdown.
 */
export function toRawUrl(url: string): string {
  try {
    const u = new URL(url);

    // GitHub blob → raw.githubusercontent.com
    // e.g. https://github.com/user/repo/blob/main/README.md
    const ghBlob = u.hostname === "github.com" && /^\/[^/]+\/[^/]+\/blob\//.test(u.pathname);
    if (ghBlob) {
      const path = u.pathname.replace(/^\/([^/]+\/[^/]+)\/blob\//, "$1/");
      return `https://raw.githubusercontent.com/${path}`;
    }

    // GitHub raw already
    if (u.hostname === "raw.githubusercontent.com") {
      return url;
    }

    // GitHub Gist
    // e.g. https://gist.github.com/user/abc123
    if (u.hostname === "gist.github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `https://gist.githubusercontent.com/${parts[0]}/${parts[1]}/raw`;
      }
    }

    // GitLab blob → raw
    // e.g. https://gitlab.com/user/repo/-/blob/main/README.md
    if (u.hostname === "gitlab.com" && u.pathname.includes("/-/blob/")) {
      const rawPath = u.pathname.replace("/-/blob/", "/-/raw/");
      return `https://gitlab.com${rawPath}`;
    }

    // Bitbucket src → raw
    // e.g. https://bitbucket.org/user/repo/src/main/README.md
    if (u.hostname === "bitbucket.org" && u.pathname.includes("/src/")) {
      const rawPath = u.pathname.replace("/src/", "/raw/");
      return `https://bitbucket.org${rawPath}`;
    }

    // Already a raw URL — return as-is
    return url;
  } catch {
    return url;
  }
}

/**
 * Check if a string looks like a URL
 */
export function isUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\//i.test(trimmed);
}

/**
 * Extract a display name from a URL
 */
export function urlToFileName(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && /\.(md|markdown|mdown|mkd|txt)$/i.test(last)) {
      return last;
    }
    // For gists and other URLs without a clear filename
    if (segments.length >= 2) {
      return `${segments[segments.length - 2]}/${last || "index"}`;
    }
    return u.hostname + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url.slice(0, 40);
  }
}
