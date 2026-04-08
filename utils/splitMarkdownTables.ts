/**
 * splitMarkdownTables
 *
 * Splits a markdown string into alternating text and GFM-table segments.
 * Table segments are detected by the standard GFM pattern:
 *   row starting with | followed immediately by a separator row (|---|---|)
 *
 * Purpose: let callers render text segments via ReactMarkdown (no remark-gfm
 * plugin needed) and table segments via plain JSX, sidestepping the
 * remark-gfm@4 / unified@10 version mismatch that causes a runtime crash.
 */

export interface MarkdownSegment {
  type: "text" | "table";
  content: string;
}

const TABLE_SEPARATOR_RE = /^\|[\s\-:|]+\|/;

export function splitMarkdownTables(content: string): MarkdownSegment[] {
  const lines = content.split("\n");
  const segments: MarkdownSegment[] = [];
  let textLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    const nextTrimmed = (lines[i + 1] ?? "").trim();

    // Detect GFM table: current line starts with | and next line is a separator
    if (trimmed.startsWith("|") && TABLE_SEPARATOR_RE.test(nextTrimmed)) {
      if (textLines.length > 0) {
        segments.push({ type: "text", content: textLines.join("\n") });
        textLines = [];
      }
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      segments.push({ type: "table", content: tableLines.join("\n") });
      continue;
    }

    textLines.push(lines[i]);
    i++;
  }

  if (textLines.length > 0) {
    segments.push({ type: "text", content: textLines.join("\n") });
  }

  return segments;
}

/** Parse a pipe-delimited table row into trimmed cell strings. */
export function parseTableRow(line: string): string[] {
  const parts = line.split("|");
  // drop first and last (empty strings outside the outer pipes)
  return parts.slice(1, parts.length - 1).map((c) => c.trim());
}
