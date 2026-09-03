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
import { isMoneyPennyLearnVideoRequest, MONEYPENNY_LEARN_VIDEO_PROMPT } from '@/services/journey/moneyPennyEducationalMedia';

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

  it('reads ONLY getKnytsBridgeEditorialSection — the SAME public projection every CI/KNYTS bridge reader uses (Turn F, 2026-09-02: bridge_content_placements is admin-only draft bookkeeping, never a public read path)', () => {
    expect(src).toMatch(/import \{ getKnytsBridgeEditorialSection \} from '@\/services\/journey\/knytsBridgeEditorialConfig'/);
    expect(src).not.toMatch(/getPlacementsForSection|bridgeContentPlacements/);
  });

  it('never returns a video block before a real published videoUrl exists — gates on section.videoUrl, never a fabricated one', () => {
    const fnStart = src.indexOf('export async function getMoneyPennyIntroVideoBlock');
    const fnEnd = src.indexOf('\n}', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/const section = await getKnytsBridgeEditorialSection\(supabase, MONEYPENNY_LEARN_SECTION\);/);
    expect(fnBody).toMatch(/if \(!section\.videoUrl\) return null;/);
  });

  it('getMoneyPennyLearnContent reads the SAME section — safe now that moneypenny-financial-basics has its OWN default entry (Turn E) instead of falling through to HOME\'s mythos copy', () => {
    const fnStart = src.indexOf('export async function getMoneyPennyLearnContent');
    const fnBody = src.slice(fnStart, src.indexOf('\n}', fnStart));
    expect(fnBody).toMatch(/const section = await getKnytsBridgeEditorialSection\(supabase, MONEYPENNY_LEARN_SECTION\);/);
    expect(fnBody).toMatch(/videoUrl: section\.videoUrl \?\? null,/);
    // The section-specific default (services/journey/knytsBridgeEditorialConfig.ts)
    // is what makes an unpublished read honest — checked in the describe block
    // below, not re-derived here.
  });

  it('the section-specific default (added Turn E) is what makes reading editorial_config directly safe — no HOME fallback risk', () => {
    const configSrc = stripComments(readSource('services/journey/knytsBridgeEditorialConfig.ts'));
    const entry = configSrc.match(/'moneypenny-financial-basics': \{([\s\S]*?)\},\n\};/)?.[1] ?? '';
    expect(entry).toMatch(/videoUrl: null,/);
    expect(entry).toMatch(/infographicUrl: null,/);
    expect(entry).not.toMatch(/Cross the Threshold/);
  });

  it('the video block schema_version is smarttriad.media.video.v0 and carries a relatedChip with cartridgeId/tab', () => {
    expect(src).toMatch(/MONEYPENNY_VIDEO_SCHEMA_VERSION = 'smarttriad\.media\.video\.v0'/);
    expect(src).toMatch(/relatedChip: \{\s*label: 'Open Financial Sovereignty basics',\s*cartridgeId: 'moneypenny-codex',\s*tab: 'learn',\s*\}/);
  });

  it('MONEYPENNY_LEARN_VIDEO_PROMPT is a fixed, exported constant string — the deterministic trigger, not free text', () => {
    expect(src).toMatch(/export const MONEYPENNY_LEARN_VIDEO_PROMPT = 'Show me the Financial Sovereignty basics video\.';/);
  });
});

describe('isMoneyPennyLearnVideoRequest — Turn E natural-language discovery, not a magic phrase (2026-09-02)', () => {
  it('the exact deterministic prompt (for repeatable testing) still matches', () => {
    expect(isMoneyPennyLearnVideoRequest(MONEYPENNY_LEARN_VIDEO_PROMPT)).toBe(true);
  });

  it('ordinary conversational phrasing about the video also matches', () => {
    expect(isMoneyPennyLearnVideoRequest('Can you show me the financial sovereignty basics video?')).toBe(true);
    expect(isMoneyPennyLearnVideoRequest('how do agent me and moneypenny work together?')).toBe(true);
    expect(isMoneyPennyLearnVideoRequest('I want to watch the MoneyPenny intro')).toBe(true);
    expect(isMoneyPennyLearnVideoRequest('please play the moneypenny explainer')).toBe(true);
  });

  it('is case-insensitive and tolerates leading/trailing whitespace', () => {
    expect(isMoneyPennyLearnVideoRequest('  SHOW ME THE FINANCIAL SOVEREIGNTY BASICS VIDEO  ')).toBe(true);
  });

  it('an unrelated MoneyPenny question does NOT misfire into a video reply — conjunctive match, not a single broad keyword', () => {
    expect(isMoneyPennyLearnVideoRequest("what's my risk envelope?")).toBe(false);
    expect(isMoneyPennyLearnVideoRequest('review my financial profile')).toBe(false);
    expect(isMoneyPennyLearnVideoRequest('show me my portfolio')).toBe(false); // "show" alone, no video topic
    expect(isMoneyPennyLearnVideoRequest('moneypenny basics')).toBe(false); // topic word present but no request verb
  });

  it('empty/whitespace-only messages never match', () => {
    expect(isMoneyPennyLearnVideoRequest('')).toBe(false);
    expect(isMoneyPennyLearnVideoRequest('   ')).toBe(false);
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

  it('checks groundContext.cartridge === "moneypenny" AND isMoneyPennyLearnVideoRequest(message) — a deterministic classifier, never LLM-interpreted (widened Turn E, 2026-09-02, from an exact-string match to ordinary phrasing)', () => {
    const idx = src.lastIndexOf('getMoneyPennyIntroVideoReply');
    expect(idx).toBeGreaterThan(-1);
    const around = src.slice(Math.max(0, idx - 700), idx + 100);
    expect(around).toMatch(/\(groundContext as Record<string, unknown>\)\.cartridge === 'moneypenny'/);
    expect(around).toMatch(/isMoneyPennyLearnVideoRequest\(message\)/);
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

describe('learn is deliberately excluded from the area-nav rail — a chip-triggered capsule, not a persistent destination', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));

  it('MONEYPENNY_AREA_FOR_PANEL excludes "learn" ("crm" now maps to Activity per the experience-coherence correction)', () => {
    expect(src).toMatch(/Record<Exclude<MoneyPennyPanelKey, "learn">, MoneyPennyAreaId>/);
  });

  it('areaForPanel returns null for "learn" only — "crm" now resolves to a real area (Activity)', () => {
    expect(src).toMatch(/if \(panel === "learn"\) return null;/);
    expect(src).toMatch(/crm: "activity"/);
  });
});
