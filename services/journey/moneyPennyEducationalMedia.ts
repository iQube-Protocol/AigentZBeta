/**
 * moneyPennyEducationalMedia — MoneyPenny Cartridge C-15 (inline educational
 * video in the copilot conversation) / A-07-A-08 (native Qriptopian Bridges
 * publication, shared delivery), 2026-09-02.
 *
 * The ONE reader for MoneyPenny's educational video. It does not maintain a
 * second content store: the video is administered through the SAME native
 * Qriptopian Bridges admin flow (PlacementAssetsPanel -> assignDraftAsset ->
 * publishPlacement) every other bridge section already uses, under the
 * section `MONEYPENNY_LEARN_SECTION` (registered in
 * KNYTS_BRIDGE_ALLOWED_SECTIONS, knytsBridgeEditorialConfig.ts). The
 * structured right-pane content (title/description) reuses the SAME
 * knyts_bridge_editorial_config row's headline/shortCopy fields the CI/KNYTS
 * bridge readers already read — no parallel "MoneyPenny learn copy" table.
 *
 * Honesty discipline: `getKnytsBridgeEditorialSection` falls back to HOME's
 * own mythos copy ("Cross the Threshold. Come home.") when no row exists yet
 * for a section — correct for the bridge HOME reader, but WRONG for
 * MoneyPenny if used blindly (it would show unrelated copy before anything
 * is published). This module therefore checks the PLACEMENT's
 * `publishedAssetUrl` first (bridge_content_placements — null until a real
 * publish happens, never fabricated) and only reads the editorial-config
 * headline/shortCopy once a real publish is confirmed — by which point
 * `publishPlacement` has already written real values into that row, not the
 * generic default.
 *
 * Scope note: the Cartridge spec's C-15 also describes chapter-level seek
 * chips (§11). `bridge_content_placements` has no per-chapter timing field
 * today and this pass does not add one (no speculative schema for data that
 * does not exist) — this module supports one video + one related chip
 * opening the structured right-pane content, an honest subset. Chapter
 * navigation is a follow-up, not silently claimed here.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlacementsForSection } from '@/services/journey/bridgeContentPlacements';
import { getKnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';

/** The one section MoneyPenny owns in the shared bridge editorial registry. */
export const MONEYPENNY_LEARN_SECTION = 'moneypenny-financial-basics';

/**
 * The exact chat message the "Watch: Financial Sovereignty basics" quick
 * prompt sends. app/api/codex/chat/route.ts matches this verbatim (scoped
 * additionally to groundContext.cartridge === 'moneypenny', so no other
 * cartridge's chat can accidentally trigger it) to short-circuit straight to
 * getMoneyPennyIntroVideoBlock() — a deterministic lookup, never an LLM-
 * authored instruction, per the Admin spec's own A-08 constraint ("related
 * chips... cannot contain arbitrary executable instructions").
 */
export const MONEYPENNY_LEARN_VIDEO_PROMPT = 'Show me the Financial Sovereignty basics video.';

/** Schema marker SmartTriadInferenceRenderer.tsx detects — mirrors the A2UI
 *  fenced-JSON-block precedent (schema_version-keyed, not an info-string) so
 *  the SAME generic fence-scanning logic finds either payload type. */
export const MONEYPENNY_VIDEO_SCHEMA_VERSION = 'smarttriad.media.video.v0';

export interface MoneyPennyVideoBlockPayload {
  schema_version: typeof MONEYPENNY_VIDEO_SCHEMA_VERSION;
  url: string;
  posterUrl: string | null;
  title: string;
  relatedChip: {
    label: string;
    cartridgeId: string;
    tab: string;
  };
}

export interface MoneyPennyLearnContent {
  title: string;
  description: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
}

/**
 * Reads the published MoneyPenny video placement and, ONLY when one is
 * genuinely published, formats it as a fenced JSON block for the copilot's
 * shared media-rendering path. Returns `null` when nothing has been
 * published yet — never a fabricated URL, never HOME's fallback copy
 * mistaken for a real asset.
 */
export async function getMoneyPennyIntroVideoBlock(supabase: SupabaseClient): Promise<string | null> {
  const placements = await getPlacementsForSection(supabase, MONEYPENNY_LEARN_SECTION);
  const publishedUrl = placements.video?.publishedAssetUrl;
  if (!publishedUrl) return null;

  const section = await getKnytsBridgeEditorialSection(supabase, MONEYPENNY_LEARN_SECTION);
  const payload: MoneyPennyVideoBlockPayload = {
    schema_version: MONEYPENNY_VIDEO_SCHEMA_VERSION,
    url: publishedUrl,
    posterUrl: placements.poster?.publishedAssetUrl ?? null,
    title: section.headline ?? 'Financial Sovereignty basics',
    relatedChip: {
      label: 'Open Financial Sovereignty basics',
      cartridgeId: 'moneypenny-codex',
      tab: 'learn',
    },
  };
  return '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
}

/**
 * The full chat reply text for the deterministic learn-video short-circuit
 * — either the fenced video block, or an honest "nothing published yet"
 * sentence (never a fabricated video). The ONE function
 * app/api/codex/chat/route.ts's short-circuit calls.
 */
export async function getMoneyPennyIntroVideoReply(supabase: SupabaseClient): Promise<string> {
  const block = await getMoneyPennyIntroVideoBlock(supabase);
  if (block) return block;
  return (
    "No educational video has been published for MoneyPenny's Financial Sovereignty basics yet. " +
    'An admin can publish one through native Qriptopian Bridges (Bridges tab, section "moneypenny-financial-basics", video slot).'
  );
}

/**
 * The structured right-pane content the A3 "related chip" opens (MoneyPenny
 * panel key `'learn'`). Reuses the SAME editorial-config row the video block
 * reads — one source, two presentations (inline player vs. structured
 * reading view), never two content stores. Returns an honest "not yet
 * published" shape (all content fields null) rather than HOME's fallback
 * copy when nothing has been published.
 */
export async function getMoneyPennyLearnContent(supabase: SupabaseClient): Promise<MoneyPennyLearnContent> {
  const placements = await getPlacementsForSection(supabase, MONEYPENNY_LEARN_SECTION);
  const publishedUrl = placements.video?.publishedAssetUrl;
  if (!publishedUrl) {
    return { title: 'Financial Sovereignty basics', description: null, videoUrl: null, posterUrl: null };
  }
  const section = await getKnytsBridgeEditorialSection(supabase, MONEYPENNY_LEARN_SECTION);
  return {
    title: section.headline ?? 'Financial Sovereignty basics',
    description: section.shortCopy ?? null,
    videoUrl: publishedUrl,
    posterUrl: placements.poster?.publishedAssetUrl ?? null,
  };
}
