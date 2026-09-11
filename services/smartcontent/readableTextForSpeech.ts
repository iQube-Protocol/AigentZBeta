/**
 * readableTextForSpeech — sanitizes canonical article Markdown/HTML into
 * plain, speakable prose for the shared SmartContent Listen controller
 * (services/smartcontent/smartContentAudioController.tsx).
 *
 * Never a second TTS system — this module only prepares TEXT; the one
 * shared `useTTSPlayer` (app/hooks/useTTSPlayer.ts) is what actually
 * synthesizes and plays it. Kept as a pure, dependency-free function
 * (no markdown-parser package added) since the transformations needed are
 * narrow: strip syntax that reads awkwardly aloud, never touch the words
 * themselves, and preserve paragraph/sentence boundaries.
 */

/**
 * Strip Markdown/HTML syntax noise so a TTS engine speaks only the prose:
 * heading markers, link/image syntax (keeping link text, dropping image alt
 * text entirely — alt text describes a visual, not something to narrate),
 * emphasis markers, code fences/inline code delimiters, raw HTML tags, and
 * bare URLs. Paragraph breaks are preserved as sentence-boundary pauses.
 */
export function sanitizeMarkdownForSpeech(input: string): string {
  if (!input) return '';

  let text = input;

  // Code fences — drop the fenced block entirely (code reads as noise, not
  // prose) rather than trying to narrate source code.
  text = text.replace(/```[\s\S]*?```/g, ' ');
  // Inline code — keep the content, drop the backticks.
  text = text.replace(/`([^`]+)`/g, '$1');

  // Images — alt text describes a visual; never narrate it as if it were
  // article prose. Drop the whole token.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');

  // Links — keep the visible text, drop the URL.
  text = text.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1');

  // Raw HTML tags (e.g. from a `dangerouslySetInnerHTML` source) — strip
  // the tags, keep the text between them.
  text = text.replace(/<\/(p|div|li|h[1-6]|br)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');

  // Heading markers ("## Title" -> "Title").
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Blockquote / list markers at line start.
  text = text.replace(/^>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // Emphasis markers — bold/italic/strikethrough. Longest markers first so
  // "**text**" doesn't get half-eaten by the single-marker pass.
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  text = text.replace(/___([^_]+)___/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // Horizontal rules.
  text = text.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, ' ');

  // Bare URLs left over (e.g. a plain pasted link with no markdown syntax)
  // — not useful spoken aloud letter-by-letter.
  text = text.replace(/https?:\/\/\S+/g, '');

  // Decode the handful of HTML entities that show up in imported prose.
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse whitespace WITHIN a line, but preserve paragraph breaks (a
  // blank line becomes a sentence-ending pause the TTS chunker already
  // splits on via its own sentence-boundary regex).
  text = text
    .split(/\n{2,}/)
    .map((para) => para.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('. ')
    // A paragraph that already ended in terminal punctuation doesn't need
    // a second one glued on by the join above.
    .replace(/([.?!])\.\s/g, '$1 ');

  return text.trim();
}

/**
 * Build the full spoken script for a piece of content: title first (so the
 * listener knows what they're hearing before the body starts), then the
 * sanitized body. Used identically for Threshold essays, Papers, and
 * ordinary Qriptopian articles — one shape, no per-surface variants.
 */
export function buildSpeechScript(title: string, bodyMarkdownOrHtml: string): string {
  const body = sanitizeMarkdownForSpeech(bodyMarkdownOrHtml);
  const cleanTitle = title.trim();
  if (!body) return cleanTitle;
  if (!cleanTitle) return body;
  return `${cleanTitle}. ${body}`;
}
