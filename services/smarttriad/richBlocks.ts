/**
 * SmartTriad Rich Block parser/validator/normalizer — the ONE place a
 * `smarttriad.block.v1` envelope (or a legacy `smarttriad.media.video.v0`
 * MoneyPenny payload) is recognized, validated and extracted from either a
 * chat message's text or its first-class `blocks` transport field. Both
 * copilot renderer families (SmartTriadInferenceRenderer.tsx,
 * CopilotInferenceBodyRenderer.tsx) call this module — neither defines its
 * own parsing.
 *
 * Promoted from the MoneyPenny-only implementation
 * (components/smarttriad/copilot/SmartTriadInferenceRenderer.tsx's former
 * `extractMediaVideoPayload`) per the 2026-09-04 "first-class, universal
 * SmartTriad Copilot video capability" mandate.
 *
 * Malformed-payload ruling (documented per that mandate's explicit
 * instruction to decide and record this): a fenced block that carries
 * neither schema marker is left completely alone — it is ordinary text/code,
 * not this module's concern. A fenced block that DOES carry one of this
 * module's schema markers but fails validation (missing required fields, a
 * forbidden URL scheme) is never rendered as raw JSON and never silently
 * dropped either — both would be worse than an honest notice: raw JSON leaks
 * internal payload shape to the operator, and silent dropping makes a real
 * authoring/publishing defect invisible. It renders as a short inline
 * "Unsupported or invalid media content" notice (see
 * components/smarttriad/richblocks/SmartTriadRichBlockRenderer.tsx), and the
 * raw fenced JSON is still stripped from the surrounding text.
 */

import {
  SMARTTRIAD_BLOCK_SCHEMA_VERSION,
  type SmartTriadMediaAction,
  type SmartTriadMediaActionKind,
  type SmartTriadRichBlockEnvelope,
  type SmartTriadVideoBlock,
  type SmartTriadVideoCaption,
  type SmartTriadVideoChapter,
} from '@/types/smarttriad/richBlocks';

/** The legacy MoneyPenny Cartridge C-15 payload shape (still emitted by any
 *  caller that hasn't migrated — see normalizeLegacyVideoV0). */
export const LEGACY_MEDIA_VIDEO_V0_SCHEMA = 'smarttriad.media.video.v0' as const;

export interface LegacyMediaVideoV0Payload {
  schema_version: typeof LEGACY_MEDIA_VIDEO_V0_SCHEMA;
  url: string;
  posterUrl: string | null;
  title: string;
  relatedChip: { label: string; cartridgeId: string; tab: string };
}

/** Outcome of parsing ONE candidate block: a valid envelope, or a marker
 *  match that failed validation (rendered as an honest notice, never raw
 *  JSON — see this file's header). `null` means "not a rich block at all". */
export type SmartTriadBlockParseResult =
  | { ok: true; envelope: SmartTriadRichBlockEnvelope }
  | { ok: false; reason: string };

const ACTION_KINDS: ReadonlySet<SmartTriadMediaActionKind> = new Set([
  'open-cartridge-tab',
  'open-capsule',
  'seek-chapter',
  'open-transcript',
  'open-document',
  'continue-prompt',
]);

/**
 * Rejects the URL schemes CLAUDE.md's Gated Content rules forbid outright
 * (`javascript:`, `data:`) and anything that isn't a plausible http(s) or
 * same-origin relative reference. This is a floor, not a full allowlist —
 * per the platform's No-Guessing rule this module does not invent a list of
 * "approved" hostnames; the actual entitlement/gating decision belongs to
 * whatever server-side resolver produced the URL in the first place (see
 * services/smarttriad/mediaProviders.ts).
 */
export function isForbiddenMediaUrl(url: unknown): boolean {
  if (typeof url !== 'string') return true;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return true;
  }
  return !(trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/'));
}

function isValidCaption(value: unknown): value is SmartTriadVideoCaption {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<SmartTriadVideoCaption>;
  return typeof c.label === 'string' && typeof c.language === 'string' && typeof c.src === 'string' && !isForbiddenMediaUrl(c.src);
}

function isValidChapter(value: unknown): value is SmartTriadVideoChapter {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<SmartTriadVideoChapter>;
  return typeof c.id === 'string' && typeof c.label === 'string' && typeof c.startAtSeconds === 'number' && c.startAtSeconds >= 0;
}

function isValidAction(value: unknown): value is SmartTriadMediaAction {
  if (!value || typeof value !== 'object') return false;
  const a = value as Partial<SmartTriadMediaAction>;
  if (typeof a.id !== 'string' || typeof a.label !== 'string' || typeof a.kind !== 'string') return false;
  if (!ACTION_KINDS.has(a.kind as SmartTriadMediaActionKind)) return false;
  if ((a.kind === 'open-cartridge-tab' || a.kind === 'open-capsule') && typeof a.cartridgeId !== 'string') return false;
  if (a.kind === 'seek-chapter' && typeof a.chapterId !== 'string') return false;
  if (a.kind === 'open-document' && (typeof a.documentUrl !== 'string' || isForbiddenMediaUrl(a.documentUrl))) return false;
  if (a.kind === 'continue-prompt' && typeof a.prompt !== 'string') return false;
  return true;
}

/** Strict structural + safety validation for a v1 video block payload. */
export function validateSmartTriadVideoBlock(value: unknown): SmartTriadVideoBlock | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Partial<SmartTriadVideoBlock>;
  if (typeof p.assetId !== 'string' || !p.assetId) return null;
  if (typeof p.url !== 'string' || isForbiddenMediaUrl(p.url)) return null;
  if (typeof p.title !== 'string' || !p.title) return null;
  if (p.posterUrl != null && (typeof p.posterUrl !== 'string' || isForbiddenMediaUrl(p.posterUrl))) return null;
  if (p.captions != null && (!Array.isArray(p.captions) || !p.captions.every(isValidCaption))) return null;
  if (p.chapters != null && (!Array.isArray(p.chapters) || !p.chapters.every(isValidChapter))) return null;
  if (p.actions != null && (!Array.isArray(p.actions) || !p.actions.every(isValidAction))) return null;
  if (p.access != null && !['public', 'authenticated', 'entitled', 'admin'].includes(p.access.class as string)) return null;

  const playback = p.playback
    ? {
        startAtSeconds: typeof p.playback.startAtSeconds === 'number' ? p.playback.startAtSeconds : undefined,
        autoplay: p.playback.autoplay === true,
        // Never forced autoplay with sound — enforced here, not left to callers.
        muted: p.playback.autoplay === true ? true : p.playback.muted === true,
      }
    : undefined;

  return {
    assetId: p.assetId,
    url: p.url,
    posterUrl: p.posterUrl ?? null,
    title: p.title,
    description: typeof p.description === 'string' ? p.description : undefined,
    playback,
    captions: p.captions as SmartTriadVideoCaption[] | undefined,
    transcript: p.transcript && typeof p.transcript.available === 'boolean' ? p.transcript : undefined,
    chapters: p.chapters as SmartTriadVideoChapter[] | undefined,
    actions: p.actions as SmartTriadMediaAction[] | undefined,
    provenance:
      p.provenance && typeof p.provenance.sourceType === 'string' && typeof p.provenance.sourceId === 'string'
        ? p.provenance
        : undefined,
    access: p.access as SmartTriadVideoBlock['access'],
  };
}

/** Validates a full v1 envelope (schemaVersion + id + kind + payload). */
export function validateSmartTriadRichBlockEnvelope(value: unknown): SmartTriadRichBlockEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as Partial<SmartTriadRichBlockEnvelope>;
  if (e.schemaVersion !== SMARTTRIAD_BLOCK_SCHEMA_VERSION) return null;
  if (typeof e.id !== 'string' || !e.id) return null;
  if (e.kind !== 'media.video') return null;
  const payload = validateSmartTriadVideoBlock(e.payload);
  if (!payload) return null;
  return { schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION, id: e.id, kind: 'media.video', payload };
}

function isLegacyVideoV0(value: unknown): value is LegacyMediaVideoV0Payload {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<LegacyMediaVideoV0Payload>;
  return (
    p.schema_version === LEGACY_MEDIA_VIDEO_V0_SCHEMA &&
    typeof p.url === 'string' &&
    typeof p.title === 'string' &&
    !!p.relatedChip &&
    typeof p.relatedChip.cartridgeId === 'string' &&
    typeof p.relatedChip.tab === 'string'
  );
}

/**
 * Compatibility adapter — synthesizes a v1 envelope from a legacy v0
 * MoneyPenny payload so existing published/cached MoneyPenny messages keep
 * rendering unchanged. `assetId` is derived deterministically from the URL
 * (v0 never carried a canonical id); access defaults to 'public' because
 * every v0 source (Qriptopian Bridges editorial config) is a public bridge
 * placement, never gated content.
 */
export function normalizeLegacyVideoV0(payload: LegacyMediaVideoV0Payload): SmartTriadRichBlockEnvelope | null {
  if (isForbiddenMediaUrl(payload.url)) return null;
  const assetId = `legacy-v0:${payload.url}`;
  return {
    schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
    id: assetId,
    kind: 'media.video',
    payload: {
      assetId,
      url: payload.url,
      posterUrl: payload.posterUrl ?? null,
      title: payload.title,
      actions: [
        {
          id: 'legacy-related-chip',
          kind: 'open-cartridge-tab',
          label: payload.relatedChip.label,
          cartridgeId: payload.relatedChip.cartridgeId,
          tab: payload.relatedChip.tab,
        },
      ],
      access: { class: 'public' },
      provenance: { sourceType: 'legacy-v0', sourceId: assetId },
    },
  };
}

/** Parses one already-JSON.parse'd candidate value into an outcome. Returns
 *  `null` when the value carries neither schema marker (not this module's
 *  concern at all). */
export function parseSmartTriadBlockCandidate(value: unknown): SmartTriadBlockParseResult | null {
  if (!value || typeof value !== 'object') return null;
  const marker = (value as Record<string, unknown>).schemaVersion ?? (value as Record<string, unknown>).schema_version;

  if (marker === SMARTTRIAD_BLOCK_SCHEMA_VERSION) {
    const envelope = validateSmartTriadRichBlockEnvelope(value);
    return envelope ? { ok: true, envelope } : { ok: false, reason: 'invalid-v1-envelope' };
  }

  if (marker === LEGACY_MEDIA_VIDEO_V0_SCHEMA) {
    if (!isLegacyVideoV0(value)) return { ok: false, reason: 'invalid-legacy-v0-payload' };
    const envelope = normalizeLegacyVideoV0(value);
    return envelope ? { ok: true, envelope } : { ok: false, reason: 'invalid-legacy-v0-payload' };
  }

  return null;
}

export interface ExtractedSmartTriadBlock {
  envelope: SmartTriadRichBlockEnvelope | null;
  /** Present (with envelope null) when a schema marker matched but
   *  validation failed — the caller renders the honest notice for this one. */
  invalid: boolean;
  rawMatch: string;
}

export interface RichBlockExtractionResult {
  blocks: ExtractedSmartTriadBlock[];
  /** message.content with every matched fenced block/bare-JSON span removed
   *  — the raw JSON must never reach the line-level text renderer. */
  contentWithoutBlocks: string;
}

const FENCE_REGEX = /```(?:json)?\s*([\s\S]*?)```/gi;

/**
 * Scans `content` for every fenced (or bare, whole-message) JSON block that
 * carries a recognized SmartTriad rich-block schema marker — mirrors the
 * A2UI extraction convention (schema-keyed JSON, not a special info-string)
 * already established in SmartTriadInferenceRenderer.tsx. Collects ALL
 * matches in document order (not just the first) so multiple blocks in one
 * message preserve deterministic order.
 */
export function extractRichBlocksFromText(content: string): RichBlockExtractionResult {
  const blocks: ExtractedSmartTriadBlock[] = [];
  let contentWithoutBlocks = content;

  const tryCandidate = (raw: string, rawMatch: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const result = parseSmartTriadBlockCandidate(parsed);
    if (!result) return;
    blocks.push(
      result.ok
        ? { envelope: result.envelope, invalid: false, rawMatch }
        : { envelope: null, invalid: true, rawMatch },
    );
    contentWithoutBlocks = contentWithoutBlocks.replace(rawMatch, '');
  };

  const trimmed = content.trim();
  if (
    trimmed.startsWith('{') &&
    (trimmed.includes(SMARTTRIAD_BLOCK_SCHEMA_VERSION) || trimmed.includes(LEGACY_MEDIA_VIDEO_V0_SCHEMA))
  ) {
    tryCandidate(trimmed, trimmed);
  }

  let match: RegExpExecArray | null;
  FENCE_REGEX.lastIndex = 0;
  while ((match = FENCE_REGEX.exec(content)) !== null) {
    tryCandidate(match[1], match[0]);
  }

  return { blocks, contentWithoutBlocks };
}
