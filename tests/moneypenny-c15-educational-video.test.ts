/**
 * Turn D (2026-09-02) — MoneyPenny Cartridge C-15 (inline educational video
 * in the copilot conversation) and A3 (Studio/agent placement integration:
 * "same stored result through native UI and authorized connector").
 *
 * One educational asset, administered through native Qriptopian Bridges
 * (the SAME assignDraftAsset/publishPlacement path every other bridge
 * section uses — services/journey/bridgeContentPlacements.ts), playable
 * inline in the MoneyPenny copilot conversation, with a related chip
 * opening its structured right-pane content (the new `learn` panel).
 *
 * Scope note (stated once, not repeated per test): chapter-level seek chips
 * from the Cartridge spec's fuller C-15 vision are NOT built this pass —
 * bridge_content_placements has no per-chapter timing field and none is
 * added here (no speculative schema for data that does not exist). This
 * pass supports one video + one related chip, an honest subset.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('MoneyPenny owns exactly one section in the shared bridge editorial registry — no second content store', () => {
  it('moneypenny-financial-basics is registered in KNYTS_BRIDGE_ALLOWED_SECTIONS', () => {
    const src = stripComments(readSource('services/journey/knytsBridgeEditorialConfig.ts'));
    const setStart = src.indexOf('export const KNYTS_BRIDGE_ALLOWED_SECTIONS');
    const setEnd = src.indexOf(']);', setStart);
    const setBody = src.slice(setStart, setEnd);
    expect(setBody).toMatch(/'moneypenny-financial-basics'/);
  });
});

describe('services/journey/moneyPennyEducationalMedia.ts — the ONE reader, never a parallel content store', () => {
  const src = stripComments(readSource('services/journey/moneyPennyEducationalMedia.ts'));

  it('reuses getPlacementsForSection and getKnytsBridgeEditorialSection — no second read path', () => {
    expect(src).toMatch(/import \{ getPlacementsForSection \} from '@\/services\/journey\/bridgeContentPlacements'/);
    expect(src).toMatch(/import \{ getKnytsBridgeEditorialSection \} from '@\/services\/journey\/knytsBridgeEditorialConfig'/);
  });

  it('never returns a video block or editorial copy before a real publish exists — checks placements.video?.publishedAssetUrl FIRST', () => {
    const fnStart = src.indexOf('export async function getMoneyPennyIntroVideoBlock');
    const fnEnd = src.indexOf('\n}', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    const placementsCallIdx = fnBody.indexOf('getPlacementsForSection');
    const editorialCallIdx = fnBody.indexOf('getKnytsBridgeEditorialSection');
    expect(placementsCallIdx).toBeGreaterThan(-1);
    expect(editorialCallIdx).toBeGreaterThan(placementsCallIdx);
    expect(fnBody).toMatch(/if \(!publishedUrl\) return null;/);
  });

  it('getMoneyPennyLearnContent likewise gates on publishedUrl before trusting headline/shortCopy — never HOME\'s fallback mythos copy for MoneyPenny', () => {
    const fnStart = src.indexOf('export async function getMoneyPennyLearnContent');
    const fnBody = src.slice(fnStart, src.indexOf('\n}', src.indexOf('\n}', fnStart) + 1));
    expect(fnBody).toMatch(/if \(!publishedUrl\) \{/);
    expect(fnBody).toMatch(/title: 'Financial Sovereignty basics', description: null, videoUrl: null, posterUrl: null/);
  });

  it('the video block schema_version is smarttriad.media.video.v0 and carries a relatedChip with cartridgeId/tab', () => {
    expect(src).toMatch(/MONEYPENNY_VIDEO_SCHEMA_VERSION = 'smarttriad\.media\.video\.v0'/);
    expect(src).toMatch(/relatedChip: \{\s*label: 'Open Financial Sovereignty basics',\s*cartridgeId: 'moneypenny-codex',\s*tab: 'learn',\s*\}/);
  });

  it('MONEYPENNY_LEARN_VIDEO_PROMPT is a fixed, exported constant string — the deterministic trigger, not free text', () => {
    expect(src).toMatch(/export const MONEYPENNY_LEARN_VIDEO_PROMPT = 'Show me the Financial Sovereignty basics video\.';/);
  });
});

describe('GET /api/moneypenny/learn-content — public, unauthenticated, reuses the ONE reader', () => {
  const src = stripComments(readSource('app/api/moneypenny/learn-content/route.ts'));

  it('calls getMoneyPennyLearnContent, no personaFetch/auth gate (matches editorial-config GET\'s own public posture)', () => {
    expect(src).toMatch(/import \{ getMoneyPennyLearnContent \} from '@\/services\/journey\/moneyPennyEducationalMedia'/);
    expect(src).not.toMatch(/requireAdminPersona|getActivePersona/);
  });
});

describe('app/api/codex/chat/route.ts — deterministic learn-video short-circuit, never an LLM-interpreted match', () => {
  const src = stripComments(readSource('app/api/codex/chat/route.ts'));

  it('checks groundContext.cartridge === "moneypenny" AND an EXACT message match against the fixed prompt constant', () => {
    const idx = src.lastIndexOf('getMoneyPennyIntroVideoReply');
    expect(idx).toBeGreaterThan(-1);
    const around = src.slice(Math.max(0, idx - 700), idx + 100);
    expect(around).toMatch(/\(groundContext as Record<string, unknown>\)\.cartridge === 'moneypenny'/);
    expect(around).toMatch(/message\.trim\(\) === MONEYPENNY_LEARN_VIDEO_PROMPT/);
  });

  it('short-circuit sits BEFORE the "Message is required" guard and the entire prompt-construction pipeline — no persona/auth resolution needed first', () => {
    const shortCircuitIdx = src.lastIndexOf('getMoneyPennyIntroVideoReply');
    const messageRequiredIdx = src.indexOf("'Message is required'");
    const getActivePersonaIdx = src.indexOf('await getActivePersona(request)');
    expect(shortCircuitIdx).toBeGreaterThan(-1);
    expect(messageRequiredIdx).toBeGreaterThan(shortCircuitIdx);
    expect(getActivePersonaIdx).toBeGreaterThan(shortCircuitIdx);
  });

  it('returns the same response contract shape the normal path uses (response/persona/event_meta) — no bespoke envelope', () => {
    const idx = src.lastIndexOf('getMoneyPennyIntroVideoReply');
    const returnStmt = src.slice(idx, src.indexOf(';', src.indexOf('NextResponse.json', idx)) + 1);
    expect(returnStmt).toMatch(/NextResponse\.json\(\{ response, persona, event_meta: eventMeta \}\)/);
  });
});

describe('MONEYPENNY_QUICK_PROMPTS — the chip that sends the deterministic prompt', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));

  it('has a "Watch: Financial Sovereignty basics" chip whose prompt is the imported constant, not a re-typed literal', () => {
    expect(src).toMatch(/import \{ MONEYPENNY_LEARN_VIDEO_PROMPT \} from '@\/services\/journey\/moneyPennyEducationalMedia'/);
    expect(src).toMatch(/id: 'mpy-learn-video', label: 'Watch: Financial Sovereignty basics', prompt: MONEYPENNY_LEARN_VIDEO_PROMPT/);
  });
});

describe('SmartTriadInferenceRenderer.tsx — shared, generic media-video rendering (extends the common framework, not a MoneyPenny-only fork)', () => {
  const src = stripComments(readSource('components/smarttriad/copilot/SmartTriadInferenceRenderer.tsx'));

  it('extractMediaVideoPayload mirrors extractA2UIPayload\'s exact fenced-JSON detection pattern (schema_version-keyed, not an info-string)', () => {
    expect(src).toMatch(/schema_version === 'smarttriad\.media\.video\.v0'/);
    expect(src).toMatch(/const fenceRegex = \/```\(\?:json\)\?\\s\*\(\[\\s\\S\]\*\?\)```\/gi;/g);
  });

  it('MediaVideoPreview renders a plain native <video> element (BridgeMediaStage\'s public-content pattern), never the gated VideoPlayer component', () => {
    const componentStart = src.indexOf('function MediaVideoPreview');
    const componentBody = src.slice(componentStart, src.indexOf('\n}', componentStart));
    expect(componentBody).toMatch(/<video\s/);
    expect(componentBody).not.toMatch(/VideoPlayer/);
  });

  it('the related chip calls tryOpenInMountedCartridge with the payload\'s OWN cartridgeId/tab — generic, not hardcoded to moneypenny-codex, so any cartridge emitting this schema is supported', () => {
    expect(src).toMatch(/import \{ tryOpenInMountedCartridge \} from '@\/services\/cartridge\/CartridgePresenceRegistry'/);
    const componentStart = src.indexOf('function MediaVideoPreview');
    const componentBody = src.slice(componentStart, src.indexOf('\n}', componentStart));
    expect(componentBody).toMatch(/tryOpenInMountedCartridge\(\{ cartridgeId: payload\.relatedChip\.cartridgeId, tab: payload\.relatedChip\.tab \}\)/);
    expect(componentBody).not.toMatch(/cartridgeId:\s*['"]moneypenny-codex['"]/);
  });

  it('mediaVideoPayload is wired into the main render alongside a2uiPayload — additive, does not replace it', () => {
    expect(src).toMatch(/const mediaVideoPayload = useMemo\(\(\) => extractMediaVideoPayload\(message\.content\), \[message\.content\]\);/);
    expect(src).toMatch(/\{a2uiPayload && <A2UIPayloadPreview payload=\{a2uiPayload\} \/>\}/);
    expect(src).toMatch(/\{mediaVideoPayload && <MediaVideoPreview payload=\{mediaVideoPayload\} \/>\}/);
  });
});

describe('MoneyPennyPanelTab.tsx — new "learn" panel key, the A3 related chip\'s destination', () => {
  const src = stripComments(readSource('app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx'));

  it('"learn" is a real MoneyPennyPanelKey mapped to MoneyPennyLearnPanel', () => {
    expect(src).toMatch(/\| "learn";/);
    expect(src).toMatch(/learn: MoneyPennyLearnPanel,/);
  });
});

describe('MoneyPennyLearnPanel.tsx — the structured right-pane content, reusing the SAME published data as the inline video', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyLearnPanel.tsx'));

  it('fetches GET /api/moneypenny/learn-content — the same reader the chat short-circuit uses, not a duplicated fetch', () => {
    expect(src).toMatch(/fetch\("\/api\/moneypenny\/learn-content"\)/);
  });

  it('renders an honest "not yet published" state when videoUrl is absent, never a placeholder video', () => {
    expect(src).toMatch(/No educational video has been published yet\./);
  });

  it('renders a plain native <video> element, matching the shared renderer\'s public-content pattern', () => {
    expect(src).toMatch(/<video\s/);
  });
});

describe('learn is deliberately excluded from the area-nav rail — a chip-triggered capsule, not a persistent destination (mirrors the existing crm exception)', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));

  it('MONEYPENNY_AREA_FOR_PANEL excludes both "crm" and "learn"', () => {
    expect(src).toMatch(/Record<Exclude<MoneyPennyPanelKey, "crm" \| "learn">, MoneyPennyAreaId>/);
  });

  it('areaForPanel returns null for "learn", same as "crm"', () => {
    expect(src).toMatch(/if \(panel === "crm" \|\| panel === "learn"\) return null;/);
  });
});
