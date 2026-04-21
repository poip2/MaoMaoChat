/**
 * Detect if text looks like escaped LLM output (JSON string, API response, etc.)
 */
export function isLlmEscaped(text: string): boolean {
  const trimmed = text.trim();

  // Wrapped in quotes like a JSON string
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return true;
  }

  // Contains escaped newlines (common in LLM API responses)
  if (trimmed.includes("\\n") && !trimmed.includes("\n")) {
    return true;
  }

  // High density of escape sequences
  const escapeCount =
    (trimmed.match(/\\n|\\t|\\"|\\\\|\\r/g) || []).length;
  const ratio = escapeCount / trimmed.length;
  if (escapeCount > 3 && ratio > 0.01) {
    return true;
  }

  return false;
}

/**
 * Unescape LLM output: converts escaped strings back to readable markdown.
 * Handles JSON string wrapping, double-escaped sequences, etc.
 */
export function unescapeLlmOutput(text: string): string {
  let result = text.trim();

  // Step 1: Strip surrounding quotes (JSON string wrapper)
  if (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith("'") && result.endsWith("'"))
  ) {
    result = result.slice(1, -1);
  }

  // Step 2: Try JSON.parse first — handles all standard JSON escaping correctly
  try {
    const parsed = JSON.parse(`"${result}"`);
    if (typeof parsed === "string") {
      return parsed;
    }
  } catch {
    // Fall through to manual unescaping
  }

  // Step 3: Manual unescape (order matters — double-escaped first)
  result = result.replace(/\\\\n/g, "\n"); // \\n → newline
  result = result.replace(/\\\\t/g, "\t"); // \\t → tab
  result = result.replace(/\\\\"/g, '"');  // \\" → "
  result = result.replace(/\\n/g, "\n");   // \n → newline
  result = result.replace(/\\r/g, "\r");   // \r → carriage return
  result = result.replace(/\\t/g, "\t");   // \t → tab
  result = result.replace(/\\"/g, '"');    // \" → "
  result = result.replace(/\\\\/g, "\\");  // \\ → \

  return result;
}
