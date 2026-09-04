/**
 * SmartTriad Rich Blocks — the platform-wide, first-class media primitive
 * promoted out of MoneyPenny's Cartridge-C-15-only implementation (2026-09-04
 * "first-class, universal SmartTriad Copilot video capability" mandate).
 *
 * Runtime unit tests for the shared parser/validator/normalizer
 * (services/smarttriad/richBlocks.ts) and the cartridge-aware provider
 * registry (services/smarttriad/mediaProviders.ts) — both pure functions,
 * tested directly rather than via source-text canaries. The two renderer
 * wiring points (SmartTriadInferenceRenderer.tsx, CopilotInferenceBodyRenderer.tsx)
 * are covered by source-level canaries in tests/moneypenny-c15-educational-video.test.ts,
 * matching this component family's existing no-RTL-harness convention.
 */
import { describe, it, expect } from 'vitest';
import {
  extractRichBlocksFromText,
  isForbiddenMediaUrl,
  normalizeLegacyVideoV0,
  parseSmartTriadBlockCandidate,
  validateSmartTriadRichBlockEnvelope,
  validateSmartTriadVideoBlock,
} from '@/services/smarttriad/richBlocks';
import { SMARTTRIAD_BLOCK_SCHEMA_VERSION } from '@/types/smarttriad/richBlocks';
import {
  financialSovereigntyLessonVideoProvider,
  moneyPennyLearnVideoProvider,
  resolveSmartTriadMedia,
  SMARTTRIAD_MEDIA_PROVIDERS,
} from '@/services/smarttriad/mediaProviders';
import { FS_PLACEHOLDER_VIDEO_URL } from '@/services/journey/fsPlaceholderVideo';

function validEnvelope(payloadOverrides: Partial<Record<string, unknown>> = {}, envelopeId = 'video-1') {
  return {
    schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
    id: envelopeId,
    kind: 'media.video',
    payload: {
      assetId: 'asset-1',
      url: 'https://example.supabase.co/storage/v1/object/public/content-assets/clip.mp4',
      title: 'A real published video',
      ...payloadOverrides,
    },
  };
}

describe('SmartTriad Rich Block validation — canonical v1', () => {
  it('accepts a minimal valid v1 envelope', () => {
    const result = validateSmartTriadRichBlockEnvelope(validEnvelope());
    expect(result).not.toBeNull();
    expect(result?.payload.assetId).toBe('asset-1');
  });

  it('rejects a payload missing assetId', () => {
    const bad = validEnvelope();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (bad.payload as any).assetId;
    expect(validateSmartTriadRichBlockEnvelope(bad)).toBeNull();
  });

  it('rejects a payload missing title', () => {
    const bad = validEnvelope();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (bad.payload as any).title;
    expect(validateSmartTriadRichBlockEnvelope(bad)).toBeNull();
  });

  it('rejects an unknown schemaVersion', () => {
    expect(validateSmartTriadRichBlockEnvelope({ ...validEnvelope(), schemaVersion: 'smarttriad.block.v99' })).toBeNull();
  });

  it('rejects an unsupported kind', () => {
    expect(validateSmartTriadRichBlockEnvelope({ ...validEnvelope(), kind: 'media.audio' })).toBeNull();
  });

  it('rejects an invalid access class', () => {
    expect(
      validateSmartTriadVideoBlock({
        assetId: 'a',
        url: 'https://example.com/v.mp4',
        title: 'x',
        access: { class: 'super-admin' },
      }),
    ).toBeNull();
  });

  it('accepts each valid access class', () => {
    for (const cls of ['public', 'authenticated', 'entitled', 'admin']) {
      expect(
        validateSmartTriadVideoBlock({ assetId: 'a', url: 'https://example.com/v.mp4', title: 'x', access: { class: cls } }),
      ).not.toBeNull();
    }
  });
});

describe('SmartTriad Rich Block validation — forbidden URLs never pass', () => {
  it('rejects javascript: and data: schemes on the primary url', () => {
    expect(isForbiddenMediaUrl('javascript:alert(1)')).toBe(true);
    expect(isForbiddenMediaUrl('DATA:text/html,<script>alert(1)</script>')).toBe(true);
    expect(validateSmartTriadVideoBlock({ assetId: 'a', url: 'javascript:alert(1)', title: 'x' })).toBeNull();
  });

  it('accepts https and same-origin relative URLs', () => {
    expect(isForbiddenMediaUrl('https://example.com/v.mp4')).toBe(false);
    expect(isForbiddenMediaUrl('/api/content/media/abc')).toBe(false);
  });

  it('rejects a forbidden URL on a caption src or an open-document action, not just the primary url', () => {
    expect(
      validateSmartTriadVideoBlock({
        assetId: 'a',
        url: 'https://example.com/v.mp4',
        title: 'x',
        captions: [{ label: 'EN', language: 'en', src: 'javascript:alert(1)' }],
      }),
    ).toBeNull();
    expect(
      validateSmartTriadVideoBlock({
        assetId: 'a',
        url: 'https://example.com/v.mp4',
        title: 'x',
        actions: [{ id: 'doc', kind: 'open-document', label: 'Doc', documentUrl: 'data:text/html,x' }],
      }),
    ).toBeNull();
  });

  it('never forces autoplay with sound — muted is coerced true whenever autoplay is true, even if the payload said otherwise', () => {
    const block = validateSmartTriadVideoBlock({
      assetId: 'a',
      url: 'https://example.com/v.mp4',
      title: 'x',
      playback: { autoplay: true, muted: false },
    });
    expect(block?.playback?.autoplay).toBe(true);
    expect(block?.playback?.muted).toBe(true);
  });
});

describe('SmartTriad Rich Block — v0 compatibility adapter', () => {
  const legacyPayload = {
    schema_version: 'smarttriad.media.video.v0' as const,
    url: 'https://example.supabase.co/storage/v1/object/public/content-assets/clip.mp4',
    posterUrl: null,
    title: 'Financial Sovereignty basics',
    relatedChip: { label: 'Open Financial Sovereignty basics', cartridgeId: 'moneypenny-codex', tab: 'learn' },
  };

  it('normalizes a legacy v0 payload into a valid v1 envelope with a deterministic assetId', () => {
    const envelope = normalizeLegacyVideoV0(legacyPayload);
    expect(envelope).not.toBeNull();
    expect(envelope?.schemaVersion).toBe(SMARTTRIAD_BLOCK_SCHEMA_VERSION);
    expect(envelope?.payload.url).toBe(legacyPayload.url);
    expect(envelope?.payload.access?.class).toBe('public');
    // Deterministic — same input, same assetId every time (idempotent).
    expect(normalizeLegacyVideoV0(legacyPayload)?.payload.assetId).toBe(envelope?.payload.assetId);
  });

  it('carries the relatedChip forward as a typed open-cartridge-tab action, never a raw navigation string', () => {
    const envelope = normalizeLegacyVideoV0(legacyPayload);
    const action = envelope?.payload.actions?.[0];
    expect(action?.kind).toBe('open-cartridge-tab');
    expect(action?.cartridgeId).toBe('moneypenny-codex');
    expect(action?.tab).toBe('learn');
  });

  it('refuses to normalize a v0 payload carrying a forbidden URL', () => {
    expect(normalizeLegacyVideoV0({ ...legacyPayload, url: 'javascript:alert(1)' })).toBeNull();
  });

  it('parseSmartTriadBlockCandidate recognizes v0 by its own schema_version marker', () => {
    const result = parseSmartTriadBlockCandidate(legacyPayload);
    expect(result?.ok).toBe(true);
  });

  it('a v0-shaped payload missing required fields is reported invalid, not silently ignored', () => {
    const result = parseSmartTriadBlockCandidate({ schema_version: 'smarttriad.media.video.v0', url: 'https://x.com/v.mp4' });
    expect(result).toEqual({ ok: false, reason: 'invalid-legacy-v0-payload' });
  });
});

describe('SmartTriad Rich Block — malformed-payload ruling (never raw JSON, never silently dropped)', () => {
  it('a fenced block with NO recognized schema marker is left alone entirely (ordinary code, not this module\'s concern)', () => {
    const content = 'Some prose.\n```json\n{"foo": "bar"}\n```\nMore prose.';
    const { blocks, contentWithoutBlocks } = extractRichBlocksFromText(content);
    expect(blocks).toHaveLength(0);
    expect(contentWithoutBlocks).toBe(content);
  });

  it('a fenced block carrying a recognized marker but failing validation is reported invalid AND stripped from display text', () => {
    const badFence = '```json\n{"schemaVersion":"smarttriad.block.v1","id":"x","kind":"media.video","payload":{"title":"no url or assetId"}}\n```';
    const content = `Before.\n${badFence}\nAfter.`;
    const { blocks, contentWithoutBlocks } = extractRichBlocksFromText(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].invalid).toBe(true);
    expect(blocks[0].envelope).toBeNull();
    expect(contentWithoutBlocks).not.toContain('schemaVersion');
    expect(contentWithoutBlocks).toContain('Before.');
    expect(contentWithoutBlocks).toContain('After.');
  });
});

describe('SmartTriad Rich Block — extraction ordering and stripping', () => {
  it('a valid block extracted from text is removed from the display text exactly once (never rendered twice)', () => {
    const fence = '```json\n' + JSON.stringify(validEnvelope()) + '\n```';
    const content = `Watch this:\n${fence}\nThanks.`;
    const { blocks, contentWithoutBlocks } = extractRichBlocksFromText(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].invalid).toBe(false);
    expect(contentWithoutBlocks).not.toContain('```json');
    expect(contentWithoutBlocks).not.toContain('asset-1');
  });

  it('multiple blocks in one message preserve document order', () => {
    const first = validEnvelope({ assetId: 'asset-first' }, 'first');
    const second = validEnvelope({ assetId: 'asset-second' }, 'second');
    const content =
      '```json\n' + JSON.stringify(first) + '\n```\n' + 'and then\n' + '```json\n' + JSON.stringify(second) + '\n```';
    const { blocks } = extractRichBlocksFromText(content);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].envelope?.id).toBe('first');
    expect(blocks[1].envelope?.id).toBe('second');
  });

  it('prose plus one block both survive — the block is stripped, the surrounding prose is not', () => {
    const fence = '```json\n' + JSON.stringify(validEnvelope()) + '\n```';
    const { contentWithoutBlocks } = extractRichBlocksFromText(`Here is the video you asked for.\n${fence}`);
    expect(contentWithoutBlocks.trim()).toBe('Here is the video you asked for.');
  });
});

describe('SmartTriad media providers — cartridge-scoped resolution, never a central-route special case', () => {
  it('MoneyPenny provider only matches when groundContext.cartridge is moneypenny', () => {
    expect(moneyPennyLearnVideoProvider.matches('show me the financial sovereignty basics video', { cartridge: 'moneypenny' })).toBe(true);
    expect(moneyPennyLearnVideoProvider.matches('show me the financial sovereignty basics video', { cartridge: 'knyt' })).toBe(false);
    expect(moneyPennyLearnVideoProvider.matches('show me the financial sovereignty basics video', undefined)).toBe(false);
  });

  it('the non-MoneyPenny Financial Sovereignty provider matches on a DIFFERENT groundContext dimension (journey surface, not cartridge)', () => {
    expect(
      financialSovereigntyLessonVideoProvider.matches('please show me the financial sovereignty lesson video', {
        surface: 'journey-runtime',
      }),
    ).toBe(true);
    expect(
      financialSovereigntyLessonVideoProvider.matches('please show me the financial sovereignty lesson video', {
        cartridge: 'moneypenny',
      }),
    ).toBe(false);
  });

  it('resolveSmartTriadMedia reports matched:false when no provider claims the request — the route falls through to the ordinary LLM pipeline', async () => {
    const result = await resolveSmartTriadMedia({} as never, 'what is the weather like', { cartridge: 'moneypenny' });
    expect(result.matched).toBe(false);
    expect(result.blocks).toHaveLength(0);
  });

  it('the non-MoneyPenny provider resolves to a real, already-published asset URL — never a fabricated one', async () => {
    const result = await financialSovereigntyLessonVideoProvider.resolve({} as never, 'x', { surface: 'journey-runtime' });
    expect(result).toHaveLength(1);
    expect(result[0].payload.url).toBe(FS_PLACEHOLDER_VIDEO_URL);
  });

  it('every registered provider has a stable, unique id', () => {
    const ids = SMARTTRIAD_MEDIA_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
