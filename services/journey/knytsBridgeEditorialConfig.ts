/**
 * Threshold Guide bridge editorial configuration (HOME's media/copy, and any
 * future Bridge-owned media section, per the same shape — see the KNYTS
 * reconstitution spec, point 6). Deliberately narrow: this is copy and media
 * ONLY. Pulse content, Passport mechanics, myCanvas templates, Standing and
 * the Store are never read or written here — they stay owned by their own
 * canonical systems and surfaces.
 *
 * Despite the KNYTS-specific filename, this module now backs MORE than one
 * bridge: the Constitutional Internet Bridge's `ci-home`/`ci-orient`/
 * `ci-view-*` sections reuse it as-is (2026-08-11 experience evolution pass,
 * operator instruction: reuse for speed, mark for later generalization
 * rather than renaming now). A future pass may promote this to a
 * bridge-neutral "Threshold Guide editorial config" module once a second
 * bridge beyond CI proves the reuse is durable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface KnytsBridgeEditorialSection {
  section: string;
  headline: string | null;
  shortCopy: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  campaignCta: string | null;
  rewardCopy: string | null;
  updatedAt: string | null;
}

/** Falls back to the copy that shipped with the original front door — never
 *  a blank page when a config row is missing (e.g. a fresh environment
 *  before the seed migration has run). One default set per media-stage
 *  section (HOME and ORIENT — reconstitution spec, points 5/6: "The
 *  distinction is important: Home speaks Mythos. Orient explains the
 *  constitutional choice."). Both sections share KnytsBridgeMediaStage;
 *  only their copy/media differ. */
export const KNYTS_BRIDGE_SECTION_DEFAULTS: Record<string, KnytsBridgeEditorialSection> = {
  home: {
    section: 'home',
    headline: 'Cross the Threshold. Come home.',
    shortCopy:
      'The KNYTS Bridge is one path into the Polity — a constitutional home for people and their agents ' +
      'in the emerging Constitutional Internet.\n\nFollow the stories of those who are crossing. When ' +
      "you're ready, claim your Passport, cross the Threshold and tell your own.\n\nShare your crossing. " +
      'Discover others. Earn Standing. Win rewards.',
    videoUrl: null,
    posterUrl: null,
    campaignCta: 'Explore the crossings',
    rewardCopy: 'Every crossing builds the bridge.',
    updatedAt: null,
  },
  orient: {
    section: 'orient',
    headline: 'Before you cross',
    shortCopy:
      'Your personhood comes before your identity. Whatever name or persona you use here, it is you — ' +
      'a person — the Polity recognises.\n\nClaiming your Passport is your first constitutional act. ' +
      'Everything before it was browsing; this is the actual crossing.',
    videoUrl: null,
    posterUrl: null,
    campaignCta: 'Claim your Passport',
    rewardCopy: null,
    updatedAt: null,
  },
  // ── Constitutional Internet Bridge sections (added 2026-08-11, experience
  // evolution pass) — same table, distinct section keys, zero schema change.
  // `ci-home` mirrors the copy that already ships hardcoded in
  // constitutionalInternetBridgeJourney.ts's home stage (never invented
  // here — this is a fallback for when no admin row exists yet, not new
  // copy). `ci-orient` is genuinely new: CI's ORIENT stage previously had no
  // media header at all (the questionnaire was the whole surface), so this
  // is the intro copy ConstitutionalInternetBridgeOrientIntro.tsx falls back
  // to. `ci-view-<blockId>` sections (one per CI_BRIDGE_VIEW_CONTENT block)
  // deliberately have NO default entry here — they exist only to carry an
  // optional admin-overridden `videoUrl`; a missing row correctly falls
  // through to defaultsForSection()'s generic fallback, whose `videoUrl` is
  // null, meaning "no override — use the vignette's own static videoUrl".
  'ci-home': {
    section: 'ci-home',
    headline: 'The Internet recognizes accounts. The Constitutional Internet recognizes persons.',
    shortCopy:
      'This is one path into the Polity — a constitutional home for people and their agents in the ' +
      'emerging Constitutional Internet.',
    videoUrl: null,
    posterUrl: null,
    campaignCta: 'Enter',
    rewardCopy: null,
    updatedAt: null,
  },
  'ci-orient': {
    section: 'ci-orient',
    headline: 'Personhood precedes identity.',
    shortCopy:
      'Before the questions below, one proposition: whatever name or persona you use here, it is you — ' +
      'a person — the Polity recognises.\n\nIf you are the constitutional unit, what follows is what must ' +
      'remain yours. The reflection below is how you start to answer that for yourself.',
    videoUrl: null,
    posterUrl: null,
    campaignCta: null,
    rewardCopy: null,
    updatedAt: null,
  },
};

/** @deprecated kept for callers that haven't migrated to KNYTS_BRIDGE_SECTION_DEFAULTS.home yet. */
export const KNYTS_BRIDGE_HOME_DEFAULTS = KNYTS_BRIDGE_SECTION_DEFAULTS.home;

function defaultsForSection(section: string): KnytsBridgeEditorialSection {
  return KNYTS_BRIDGE_SECTION_DEFAULTS[section] ?? { ...KNYTS_BRIDGE_SECTION_DEFAULTS.home, section };
}

function rowToSection(row: Record<string, unknown> | null, section: string): KnytsBridgeEditorialSection {
  if (!row) return defaultsForSection(section);
  return {
    section,
    headline: (row.headline as string) ?? null,
    shortCopy: (row.short_copy as string) ?? null,
    videoUrl: (row.video_url as string) ?? null,
    posterUrl: (row.poster_url as string) ?? null,
    campaignCta: (row.campaign_cta as string) ?? null,
    rewardCopy: (row.reward_copy as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

/**
 * Fail faithful (not silently defaulted): a missing ROW is a legitimate,
 * expected state (falls back to defaultsForSection) — a missing TABLE, a
 * bad column, or any other query failure is a real error and must say so,
 * never be indistinguishable from "no row yet". Swallowing `error` here
 * previously meant this function returned the exact same shipped-copy
 * defaults whether the editorial_config migration had been applied or not,
 * so a 200 from the route it backs proved nothing about migration state.
 */
export async function getKnytsBridgeEditorialSection(
  supabase: SupabaseClient,
  section: string,
): Promise<KnytsBridgeEditorialSection> {
  const { data, error } = await supabase
    .from('knyts_bridge_editorial_config')
    .select('section, headline, short_copy, video_url, poster_url, campaign_cta, reward_copy, updated_at')
    .eq('section', section)
    .maybeSingle();
  if (error) throw new Error(`knyts_bridge_editorial_config read failed: ${error.message}`);
  return rowToSection(data as Record<string, unknown> | null, section);
}

export interface KnytsBridgeEditorialUpdate {
  headline?: string | null;
  shortCopy?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  campaignCta?: string | null;
  rewardCopy?: string | null;
}

export async function upsertKnytsBridgeEditorialSection(
  supabase: SupabaseClient,
  section: string,
  update: KnytsBridgeEditorialUpdate,
  updatedBy: string,
): Promise<KnytsBridgeEditorialSection> {
  const { data, error } = await supabase
    .from('knyts_bridge_editorial_config')
    .upsert(
      {
        section,
        ...(update.headline !== undefined ? { headline: update.headline } : {}),
        ...(update.shortCopy !== undefined ? { short_copy: update.shortCopy } : {}),
        ...(update.videoUrl !== undefined ? { video_url: update.videoUrl } : {}),
        ...(update.posterUrl !== undefined ? { poster_url: update.posterUrl } : {}),
        ...(update.campaignCta !== undefined ? { campaign_cta: update.campaignCta } : {}),
        ...(update.rewardCopy !== undefined ? { reward_copy: update.rewardCopy } : {}),
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section' },
    )
    .select('section, headline, short_copy, video_url, poster_url, campaign_cta, reward_copy, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return rowToSection(data as Record<string, unknown>, section);
}
