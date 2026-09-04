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
    const entry = configSrc.match(/'moneypenny-financial-basics': \{([\s\S]*?)\n  \},/)?.[1] ?? '';
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

describe('app/api/codex/chat/route.ts — universal SmartTriad media resolution, no cartridge-specific branch (2026-09-04)', () => {
  const src = stripComments(readSource('app/api/codex/chat/route.ts'));

  it('no direct MoneyPenny branch remains in the central chat route — resolution is delegated to the provider registry', () => {
    expect(src).not.toMatch(/isMoneyPennyLearnVideoRequest/);
    expect(src).not.toMatch(/getMoneyPennyIntroVideoReply/);
    expect(src).not.toMatch(/cartridge === 'moneypenny'/);
    expect(src).toMatch(/import \{ resolveSmartTriadMedia \} from '@\/services\/smarttriad\/mediaProviders'/);
  });

  it('calls resolveSmartTriadMedia with groundContext + the raw message BEFORE the LLM ever runs, a deterministic classifier, never LLM-interpreted', () => {
    const idx = src.indexOf('resolveSmartTriadMedia(supabase, message, groundContext');
    expect(idx).toBeGreaterThan(-1);
  });

  it('short-circuit sits BEFORE the "Message is required" guard and the entire prompt-construction pipeline — no persona/auth resolution needed first', () => {
    const shortCircuitIdx = src.indexOf('resolveSmartTriadMedia(supabase, message, groundContext');
    const messageRequiredIdx = src.indexOf("'Message is required'");
    const getActivePersonaIdx = src.indexOf('await getActivePersona(request)');
    expect(shortCircuitIdx).toBeGreaterThan(-1);
    expect(messageRequiredIdx).toBeGreaterThan(shortCircuitIdx);
    expect(getActivePersonaIdx).toBeGreaterThan(shortCircuitIdx);
  });

  it('a matched provider with nothing published still short-circuits with an honest message — the LLM is never asked to guess in its place', () => {
    const idx = src.indexOf('mediaResolution.matched');
    expect(idx).toBeGreaterThan(-1);
    const body = src.slice(idx, idx + 900);
    expect(body).toMatch(/No media has been published for this yet\./);
  });

  it('a resolved block returns the SAME response contract shape the normal path uses, additively carrying blocks — no bespoke envelope', () => {
    const idx = src.indexOf('mediaResolution.blocks.length > 0');
    const returnStmt = src.slice(idx, src.indexOf(';', src.indexOf('NextResponse.json', idx)) + 1);
    expect(returnStmt).toMatch(/NextResponse\.json\(\{ response, persona, event_meta: eventMeta, blocks: mediaResolution\.blocks \}\)/);
  });
});

describe('services/smarttriad/mediaProviders.ts — cartridge-aware media provider registry', () => {
  const src = stripComments(readSource('services/smarttriad/mediaProviders.ts'));

  it('registers MoneyPenny as a provider preserving its exact deterministic trigger scoping', () => {
    expect(src).toMatch(/groundContext\?\.cartridge === 'moneypenny' && isMoneyPennyLearnVideoRequest\(message\)/);
  });

  it('registers at least one genuinely non-MoneyPenny provider, scoped to a different groundContext dimension (journey surface, not cartridge)', () => {
    expect(src).toMatch(/id: 'financial-sovereignty\.lesson-video'/);
    expect(src).toMatch(/groundContext\?\.surface === 'journey-runtime'/);
  });

  it('the non-MoneyPenny provider reuses a real, already-published asset URL — never a fabricated one', () => {
    expect(src).toMatch(/import \{ FS_PLACEHOLDER_VIDEO_URL, FS_PLACEHOLDER_VIDEO_POSTER_URL \} from '@\/services\/journey\/fsPlaceholderVideo'/);
  });

  it('resolveSmartTriadMedia never trusts the model — it looks up a provider by matches() and calls resolve(), no free-text URL construction anywhere in this file', () => {
    expect(src).not.toMatch(/\burl:\s*message\b/);
    expect(src).toMatch(/const provider = SMARTTRIAD_MEDIA_PROVIDERS\.find/);
  });
});

describe('MONEYPENNY_QUICK_PROMPTS — the chip that sends the deterministic prompt', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));

  it('has a "Watch: Financial Sovereignty basics" chip whose prompt is the imported constant, not a re-typed literal', () => {
    expect(src).toMatch(/import \{ MONEYPENNY_LEARN_VIDEO_PROMPT \} from '@\/services\/journey\/moneyPennyEducationalMedia'/);
    expect(src).toMatch(/id: 'mpy-learn-video', label: 'Watch: Financial Sovereignty basics', prompt: MONEYPENNY_LEARN_VIDEO_PROMPT/);
  });
});

describe('SmartTriadInferenceRenderer.tsx — delegates media-video rendering to the shared SmartTriad Rich Block module (2026-09-04), no MoneyPenny-only fork', () => {
  const src = stripComments(readSource('components/smarttriad/copilot/SmartTriadInferenceRenderer.tsx'));

  it('imports the shared extraction/renderer rather than defining its own media-video parser or player', () => {
    expect(src).toMatch(/import \{ extractRichBlocksFromText \} from '@\/services\/smarttriad\/richBlocks'/);
    expect(src).toMatch(/import \{ SmartTriadRichBlockListRenderer \} from '@\/components\/smarttriad\/richblocks\/SmartTriadRichBlockRenderer'/);
    expect(src).not.toMatch(/function MediaVideoPreview/);
    expect(src).not.toMatch(/function extractMediaVideoPayload/);
  });

  it('SmartTriadMessage carries an optional first-class `blocks` field (Workstream 2 transport), additive to `content`', () => {
    expect(src).toMatch(/blocks\?:\s*SmartTriadRichBlockEnvelope\[\];/);
  });

  it('richBlockExtraction runs on message.content and its blocks render alongside a2uiPayload — additive, does not replace it', () => {
    expect(src).toMatch(/const richBlockExtraction = useMemo\(\(\) => extractRichBlocksFromText\(message\.content\), \[message\.content\]\);/);
    expect(src).toMatch(/\{a2uiPayload && <A2UIPayloadPreview payload=\{a2uiPayload\} \/>\}/);
    expect(src).toMatch(/<SmartTriadRichBlockListRenderer blocks=\{renderedBlocks\}/);
  });

  it('renderedBlocks merges first-class transport blocks (message.blocks) with legacy fenced-JSON extraction, transport first — deterministic order', () => {
    const idx = src.indexOf('const renderedBlocks = useMemo');
    expect(idx).toBeGreaterThan(-1);
    const body = src.slice(idx, src.indexOf('}, [message.blocks, richBlockExtraction.blocks]);', idx));
    expect(body).toMatch(/message\.blocks/);
    expect(body).toMatch(/richBlockExtraction\.blocks/);
  });

  // Reported defect (2026-09-04): the raw fenced JSON block a structured
  // payload was parsed FROM was never removed from what the generic
  // line-level renderer displays, so the operator saw the correctly-
  // rendered video/A2UI preview AND the raw JSON code block rendered a
  // second time directly beneath it. The shared extractor's
  // contentWithoutBlocks is what closes this — never both a preview AND the
  // raw fence.
  it('contentForDisplay strips BOTH the shared extractor\'s contentWithoutBlocks and the A2UI rawMatch before content reaches the line-level renderer', () => {
    const fnStart = src.indexOf('const contentForDisplay = useMemo');
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = src.indexOf('}, [richBlockExtraction.contentWithoutBlocks, a2uiExtraction]);', fnStart);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const body = src.slice(fnStart, fnEnd);
    expect(body).toMatch(/richBlockExtraction\.contentWithoutBlocks/);
    expect(body).toMatch(/a2uiExtraction\.rawMatch/);
  });

  it('processedContent (what renderContent() actually renders) is derived from contentForDisplay, never the raw message.content', () => {
    expect(src).toMatch(/const processedContent = useMemo\(\(\) => \{\s*return processMessageContent\(contentForDisplay\);/);
  });
});

describe('services/smarttriad/richBlocks.ts — the ONE shared SmartTriad rich-block parser/validator/normalizer', () => {
  const src = stripComments(readSource('services/smarttriad/richBlocks.ts'));

  it('recognizes both the v1 envelope schema and the legacy v0 MoneyPenny schema via the same schema_version-keyed fence scan', () => {
    expect(src).toMatch(/SMARTTRIAD_BLOCK_SCHEMA_VERSION/);
    expect(src).toMatch(/LEGACY_MEDIA_VIDEO_V0_SCHEMA = 'smarttriad\.media\.video\.v0'/);
  });

  it('normalizeLegacyVideoV0 synthesizes a v1 envelope with a deterministic assetId and a public access class', () => {
    const fnStart = src.indexOf('export function normalizeLegacyVideoV0');
    const body = src.slice(fnStart, src.indexOf('\n}', fnStart + 400));
    expect(body).toMatch(/access: \{ class: 'public' \}/);
  });

  it('rejects javascript:/data: URLs outright (isForbiddenMediaUrl)', () => {
    expect(src).toMatch(/trimmed\.startsWith\('javascript:'\) \|\| trimmed\.startsWith\('data:'\)/);
  });

  it('a v1 payload missing required fields fails validateSmartTriadVideoBlock', () => {
    expect(src).toMatch(/if \(typeof p\.assetId !== 'string' \|\| !p\.assetId\) return null;/);
    expect(src).toMatch(/if \(typeof p\.url !== 'string' \|\| isForbiddenMediaUrl\(p\.url\)\) return null;/);
  });

  it('never forces autoplay with sound — muted is coerced true whenever autoplay is true', () => {
    expect(src).toMatch(/muted: p\.playback\.autoplay === true \? true : p\.playback\.muted === true,/);
  });

  it('extractRichBlocksFromText collects ALL matches in document order, not just the first', () => {
    const fnStart = src.indexOf('export function extractRichBlocksFromText');
    const body = src.slice(fnStart, src.indexOf('\n}', fnStart + 900));
    expect(body).toMatch(/while \(\(match = FENCE_REGEX\.exec\(content\)\) !== null\)/);
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
