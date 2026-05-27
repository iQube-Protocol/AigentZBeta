/**
 * services/uploads/uploadIndexer.ts
 *
 * Parse-on-upload pass. Dispatches by mime type / extension to a
 * matching extractor and returns the partial index row the service
 * upserts into `persona_upload_index`.
 *
 * Phase-1 coverage (this file):
 *   - text/plain, text/markdown, .md, .txt  → contentMd (truncated)
 *   - application/json, .json                → contentJson + schemaMeta
 *   - text/csv, .csv                         → contentJson (rows[]) + schemaMeta (columns[])
 *
 * Phase-2 extensions (stubs to be wired):
 *   - application/pdf                        → contentMd via pdf-parse
 *   - .docx                                  → contentMd via mammoth
 *   - image/*                                → contentMd vision summary
 *   - audio/*                                → contentMd via Whisper
 *
 * The indexer NEVER throws — it returns `{ error }` on failure so the
 * service can flip the row to `status='failed'` while preserving the
 * upload itself.
 */

import type { UploadIndexer, PersonaUploadRow } from './personaUploadService';
import { UPLOAD_LIMITS } from './personaUploadService';

const TEXT_MIME = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]);
const TEXT_EXTS = new Set(['txt', 'md', 'csv', 'json']);

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i < 0 ? '' : filename.slice(i + 1).toLowerCase();
}

function estimateTokens(text: string): number {
  // Cheap heuristic — roughly 4 chars per token. Good enough for
  // budgeting context injection; not used for billing.
  return Math.ceil(text.length / 4);
}

function detectJsonSchema(value: unknown, depth = 0): unknown {
  if (depth > 3) return { type: typeof value };
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    const sample = value.slice(0, 5).map((v) => detectJsonSchema(v, depth + 1));
    return { type: 'array', length: value.length, items: sample };
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 32);
    const props: Record<string, unknown> = {};
    for (const k of keys) {
      props[k] = detectJsonSchema((value as Record<string, unknown>)[k], depth + 1);
    }
    return { type: 'object', keys: keys.length, properties: props };
  }
  return { type: typeof value };
}

function parseCsv(text: string): { rows: Record<string, string>[]; columns: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], columns: [] };
  const splitLine = (l: string): string[] =>
    l.split(',').map((s) => s.trim().replace(/^"(.*)"$/, '$1'));
  const columns = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < columns.length; j++) {
      row[columns[j]] = cells[j] ?? '';
    }
    rows.push(row);
  }
  return { rows, columns };
}

function summariseText(text: string, maxChars = 280): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxChars) return collapsed;
  return collapsed.slice(0, maxChars - 1) + '…';
}

export const defaultUploadIndexer: UploadIndexer = async ({ upload, bytes }) => {
  const ext = extOf(upload.filename);
  const mime = upload.mimeType.toLowerCase();

  // ── JSON ────────────────────────────────────────────────────────────
  if (mime === 'application/json' || ext === 'json') {
    const text = decodeUtf8(bytes);
    try {
      const parsed = JSON.parse(text);
      const schemaMeta = detectJsonSchema(parsed);
      const preview = text.slice(0, UPLOAD_LIMITS.maxIndexedChars);
      return {
        contentMd: preview,
        contentJson: parsed,
        summary: summariseText(`JSON · ${upload.filename}\n${text}`),
        tokensEstimate: estimateTokens(text),
        schemaMeta,
        error: null,
      };
    } catch (err) {
      return {
        contentMd: text.slice(0, UPLOAD_LIMITS.maxIndexedChars),
        contentJson: null,
        summary: `Invalid JSON — kept as raw text. ${err instanceof Error ? err.message : ''}`,
        tokensEstimate: estimateTokens(text),
        schemaMeta: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── CSV ─────────────────────────────────────────────────────────────
  if (mime === 'text/csv' || ext === 'csv') {
    const text = decodeUtf8(bytes);
    const { rows, columns } = parseCsv(text);
    return {
      contentMd: text.slice(0, UPLOAD_LIMITS.maxIndexedChars),
      contentJson: { rows: rows.slice(0, 1000), truncated: rows.length > 1000 },
      summary: `CSV · ${columns.length} columns × ${rows.length} rows · cols: ${columns.slice(0, 8).join(', ')}`,
      tokensEstimate: estimateTokens(text),
      schemaMeta: { columns, rowCount: rows.length },
      error: null,
    };
  }

  // ── Text / Markdown ─────────────────────────────────────────────────
  if (TEXT_MIME.has(mime) || TEXT_EXTS.has(ext) || mime.startsWith('text/')) {
    const text = decodeUtf8(bytes);
    return {
      contentMd: text.slice(0, UPLOAD_LIMITS.maxIndexedChars),
      contentJson: null,
      summary: summariseText(text),
      tokensEstimate: estimateTokens(text),
      schemaMeta: null,
      error: null,
    };
  }

  // ── PDF ─────────────────────────────────────────────────────────────
  if (mime === 'application/pdf' || ext === 'pdf') {
    try {
      const text = await extractPdfText(bytes);
      return {
        contentMd: text.slice(0, UPLOAD_LIMITS.maxIndexedChars),
        contentJson: null,
        summary: summariseText(text || `PDF · ${upload.filename}`),
        tokensEstimate: estimateTokens(text),
        schemaMeta: null,
        error: null,
      };
    } catch (err) {
      return {
        contentMd: null,
        contentJson: null,
        summary: `PDF parse failed — file stored. ${err instanceof Error ? err.message : ''}`,
        tokensEstimate: 0,
        schemaMeta: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── DOCX — stub until `mammoth` is added as a dep. ──────────────────
  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return placeholderIndex(upload, 'DOCX parse — install `mammoth` to enable. File stored.');
  }

  // ── Image — OpenAI Vision summary via gpt-4o-mini. ──────────────────
  if (mime.startsWith('image/')) {
    try {
      const summary = await summariseImageViaOpenAI(bytes, mime);
      return {
        contentMd: summary,
        contentJson: null,
        summary: summariseText(summary || `Image · ${upload.filename}`),
        tokensEstimate: estimateTokens(summary ?? ''),
        schemaMeta: { width: null, height: null },
        error: summary ? null : 'no-vision-output',
      };
    } catch (err) {
      return {
        contentMd: null,
        contentJson: null,
        summary: `Image vision failed — file stored. ${err instanceof Error ? err.message : ''}`,
        tokensEstimate: 0,
        schemaMeta: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Audio — Whisper transcription. ──────────────────────────────────
  if (mime.startsWith('audio/')) {
    try {
      const text = await transcribeAudioViaWhisper(bytes, mime, upload.filename);
      return {
        contentMd: text.slice(0, UPLOAD_LIMITS.maxIndexedChars),
        contentJson: null,
        summary: summariseText(text || `Audio · ${upload.filename}`),
        tokensEstimate: estimateTokens(text),
        schemaMeta: null,
        error: null,
      };
    } catch (err) {
      return {
        contentMd: null,
        contentJson: null,
        summary: `Audio transcription failed — file stored. ${err instanceof Error ? err.message : ''}`,
        tokensEstimate: 0,
        schemaMeta: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Unknown — keep the row, no extracted content. ───────────────────
  return placeholderIndex(upload, `Unsupported type ${mime || ext}. File stored; no preview generated.`);
};

// ── Phase 2 helpers ───────────────────────────────────────────────────

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // Dynamic import keeps the heavy native dep out of the cold-start
  // path for non-PDF uploads.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — pdf-parse ships without typings
  const pdfParse = (await import('pdf-parse')).default as (data: Buffer) => Promise<{ text: string }>;
  const buf = Buffer.from(bytes);
  const result = await pdfParse(buf);
  return (result?.text ?? '').trim();
}

async function summariseImageViaOpenAI(bytes: Uint8Array, mime: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured — image vision skipped.');
  }
  const base64 = Buffer.from(bytes).toString('base64');
  const dataUrl = `data:${mime};base64,${base64}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Describe this image in 2–3 sentences. Identify the main subject(s), composition, text content if any, and any obviously notable features. Be concise — this summary is indexed as context for an AI assistant.',
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 300,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI vision failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (json.choices?.[0]?.message?.content ?? '').trim();
}

async function transcribeAudioViaWhisper(
  bytes: Uint8Array,
  mime: string,
  filename: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured — Whisper skipped.');
  }
  const form = new FormData();
  // Whisper accepts mp3, mp4, mpeg, mpga, m4a, wav, webm. The blob's
  // type drives the file extension Whisper detects.
  const blob = new Blob([bytes], { type: mime || 'audio/webm' });
  form.append('file', blob, filename || 'audio');
  form.append('model', 'whisper-1');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Whisper failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? '').trim();
}

function placeholderIndex(upload: PersonaUploadRow, summary: string) {
  return {
    contentMd: null,
    contentJson: null,
    summary,
    tokensEstimate: 0,
    schemaMeta: null,
    error: null,
  };
}
