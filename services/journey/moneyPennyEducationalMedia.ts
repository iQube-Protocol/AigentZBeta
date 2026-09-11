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
 * Turn F (2026-09-02) architecture correction — READS ONLY
 * knyts_bridge_editorial_config, never bridge_content_placements:
 *
 * Earlier (Turn D) this module checked `bridge_content_placements` FIRST
 * before trusting `knyts_bridge_editorial_config`'s headline/copy, because
 * `getKnytsBridgeEditorialSection` falls back to a generic default when no
 * row exists for a section — and at the time, MoneyPenny had no default
 * entry of its own, so a missing row would have fallen through to HOME's
 * own mythos copy ("Cross the Threshold. Come home."), which would be
 * actively wrong to surface here.
 *
 * That precondition no longer holds: `KNYTS_BRIDGE_SECTION_DEFAULTS` now
 * carries a `moneypenny-financial-basics` entry (added Turn E) whose
 * `videoUrl`/`infographicUrl`/`posterUrl` are all `null` — an honest
 * "nothing published yet" default, not HOME's copy. Reading
 * `getKnytsBridgeEditorialSection` directly is therefore now correct AND
 * is the SAME pattern every CI/KNYTS public bridge reader already uses
 * (they never consult `bridge_content_placements` either — that table is
 * ADMIN-ONLY bookkeeping: draft state, revision counters, actor,
 * timestamps. It exists so an admin can preview a draft before publishing;
 * it was never meant to be a second source of truth for public readers,
 * and RLS enforces this — `pg_policies` on `bridge_content_placements`
 * grants `service_role` only, zero anon/authenticated policies).
 *
 * The prior design additionally had a subtler, unintended failure mode in
 * an environment missing `SUPABASE_SERVICE_ROLE_KEY`: an anon-key client's
 * read of the service-role-only `bridge_content_placements` table doesn't
 * error, it just returns zero rows (RLS row-filtering, not an access
 * error) — so this module was reading "I have no visibility into whether
 * this is published" as "nothing is published," silently, for every
 * caller. Reading the SAME public projection every other bridge section
 * uses removes this module's dependency on the protected table entirely —
 * it now needs only whatever access level `knyts_bridge_editorial_config`
 * itself grants, exactly matching CI/KNYTS. (Whether THAT table's own
 * access is correctly configured in a given environment is a separate,
 * environment-level concern — see services/supabase/requireServiceRoleClient.ts
 * and this module's callers in app/api/moneypenny/learn-content/route.ts.)
 *
 * Scope note: the Cartridge spec's C-15 also describes chapter-level seek
 * chips (§11). `bridge_content_placements` has no per-chapter timing field
 * today and this pass does not add one (no speculative schema for data that
 * does not exist) — this module supports one video + one related chip
 * opening the structured right-pane content, an honest subset. Chapter
 * navigation is a follow-up, not silently claimed here.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
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
 * chips... cannot contain arbitrary executable instructions"). Kept as the
 * exact deterministic string for repeatable testing.
 */
export const MONEYPENNY_LEARN_VIDEO_PROMPT = 'Show me the Financial Sovereignty basics video.';

/**
 * Turn E (2026-09-02) — operator directive: "An exact-match prompt is
 * useful for deterministic testing, but the specification does not require
 * users to recite a magic phrase." Widens the short-circuit's TRIGGER to
 * ordinary conversational phrasing, while keeping A-08's safety property
 * fully intact: this is still a plain regex classifier evaluated BEFORE the
 * LLM ever runs, on the raw user message — the LLM is never asked or
 * trusted to decide whether/what video block to emit, so it can never
 * fabricate a URL or be prompt-injected into emitting one. Only the
 * TRIGGER got more natural; the RESPONSE mechanism (a deterministic lookup
 * of the real published placement, never a fabricated URL) is unchanged.
 *
 * Deliberately narrow and conjunctive (topic word AND request word) rather
 * than a single broad keyword, so an unrelated MoneyPenny message ("what's
 * my risk envelope video call schedule") doesn't misfire — a false negative
 * here just means the person types more plainly or uses the quick-prompt
 * chip; a false positive would mean an unrelated question gets answered
 * with a video instead of a real LLM response, which is the worse failure
 * mode to avoid.
 */
// Self-sufficient: asking HOW two things work together already IS the
// request — no separate request-verb needed. Tolerant of words in between
// ("how DO agent me and moneypenny work TOGETHER?") without becoming a
// broad/unbounded match, since "and moneypenny" and "work" are both still
// required literals.
const LEARN_VIDEO_HOW_THEY_WORK = /how\s+(?:\w+\s+)*?(agent\s?me|aigentme)\s+(?:\w+\s+)*?and\s+moneypenny\s+(?:\w+\s+)*?work/i;
const LEARN_VIDEO_TOPIC = /(financial sovereignty basics|moneypenny.{0,20}(intro|introduc\w*|basics|explainer))/i;
const LEARN_VIDEO_REQUEST = /(show|watch|play|see|view|open|explain|understand)/i;

export function isMoneyPennyLearnVideoRequest(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (trimmed === MONEYPENNY_LEARN_VIDEO_PROMPT) return true;
  if (LEARN_VIDEO_HOW_THEY_WORK.test(trimmed)) return true;
  return LEARN_VIDEO_TOPIC.test(trimmed) && LEARN_VIDEO_REQUEST.test(trimmed);
}

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
 * Reads MoneyPenny's published video/poster/copy through the SAME public
 * projection (`knyts_bridge_editorial_config`) every CI/KNYTS bridge reader
 * uses — never `bridge_content_placements` (admin-only draft bookkeeping;
 * see this file's header). Formats a fenced JSON block for the copilot's
 * shared media-rendering path ONLY when a real video URL exists. Returns
 * `null` when nothing has been published yet — never a fabricated URL.
 */
export async function getMoneyPennyIntroVideoBlock(supabase: SupabaseClient): Promise<string | null> {
  const section = await getKnytsBridgeEditorialSection(supabase, MONEYPENNY_LEARN_SECTION);
  if (!section.videoUrl) return null;

  const payload: MoneyPennyVideoBlockPayload = {
    schema_version: MONEYPENNY_VIDEO_SCHEMA_VERSION,
    url: section.videoUrl,
    posterUrl: section.posterUrl ?? null,
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
 * published" shape (all content fields null) when the section's own
 * default applies (no admin has published anything for this section yet).
 */
export async function getMoneyPennyLearnContent(supabase: SupabaseClient): Promise<MoneyPennyLearnContent> {
  const section = await getKnytsBridgeEditorialSection(supabase, MONEYPENNY_LEARN_SECTION);
  return {
    title: section.headline ?? 'Financial Sovereignty basics',
    description: section.shortCopy ?? null,
    videoUrl: section.videoUrl ?? null,
    posterUrl: section.posterUrl ?? null,
  };
}
