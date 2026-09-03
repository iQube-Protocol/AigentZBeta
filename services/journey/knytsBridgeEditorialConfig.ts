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
import { CI_BRIDGE_VIEW_CONTENT } from '@/services/journey/constitutionalInternetBridgeViewContent';
import { FS_STAGE_CONTENT, FS_LEARN_PLATES } from '@/services/journey/financialSovereigntyContent';

/**
 * CFS content pack integration (2026-09-03) — the six Financial Sovereignty
 * stage ids shared verbatim by both journey definitions
 * (constitutionalInternetBridgeJourney.ts / knytsBridgeCrossingJourney.ts's
 * `fs-*` stage ids). Defined here (not re-derived from the journey files) to
 * avoid a circular import — journey definitions are data, this module is
 * lower-level editorial config; both are allowed to reference this same
 * small id list.
 */
export const FS_STAGE_IDS = ['discover', 'learn', 'explore', 'prepare', 'operate', 'cross'] as const;
export type FsStageId = (typeof FS_STAGE_IDS)[number];

/** The one authoritative (bridge, stage) -> editorial-config section-key
 *  mapping for the CFS placements — never hand-construct these strings at a
 *  call site. KNYTS reuses its existing bare-key convention ('home' not
 *  'knyts-home'); CI reuses its existing 'ci-' prefix — exactly the same
 *  disambiguation scheme every other shared section already uses. */
export function fsBridgeSectionKey(bridge: 'ci' | 'knyts', stage: FsStageId): string {
  return bridge === 'ci' ? `ci-fs-${stage}` : `fs-${stage}`;
}

/** Learn is the one CFS stage with three plates (content/step-composition.json's
 *  learn-purposes/value/agents sub-sections) rather than one. Plate 0 uses the
 *  plain fsBridgeSectionKey('*', 'learn') section (consistent with every other
 *  stage); plates 1/2 get their own small extra section so all three can be
 *  admin-published independently — the same generic PlacementAssetsPanel/
 *  KnytsBridgeAdminPanel pair, never a bespoke multi-asset editor. */
export function fsLearnPlateSectionKey(bridge: 'ci' | 'knyts', plateIndex: 0 | 1 | 2): string {
  if (plateIndex === 0) return fsBridgeSectionKey(bridge, 'learn');
  const base = bridge === 'ci' ? 'ci-fs-learn' : 'fs-learn';
  return `${base}-${plateIndex + 1}`;
}

/**
 * The one authoritative section allow-list (moved here from
 * editorial-config/route.ts, 2026-09-01, so the new placements route can
 * reuse it without importing a Next.js route file — inv.engineering.036/037,
 * never a second hand-copied list). `ci-view-*` keys derive from
 * CI_BRIDGE_VIEW_CONTENT so a vignette addition/removal can never drift
 * this list out of sync.
 */
export const KNYTS_BRIDGE_ALLOWED_SECTIONS = new Set<string>([
  'home',
  'orient',
  'choose',
  'ci-home',
  'ci-orient',
  'ci-passport-established',
  ...CI_BRIDGE_VIEW_CONTENT.map((block) => `ci-view-${block.id}`),
  // MoneyPenny Cartridge C-15/C-17 (2026-09-02) — the ONE section MoneyPenny
  // owns in this shared registry, so its inline educational video is
  // administered through the SAME native Qriptopian Bridges admin flow
  // every other bridge section uses (services/journey/moneyPennyEducationalMedia.ts
  // is the only reader; no second editorial store).
  'moneypenny-financial-basics',
  // CFS content pack integration (2026-09-03) — the twelve Financial
  // Sovereignty bridge-stage placements (six stages × two bridges), same
  // bare/`ci-` prefix convention as every section above. Each carries only
  // headline/shortCopy/infographicUrl — the per-stage PRIMARY plate and its
  // caption — never the full card/topic copy, which ships as static content
  // in financialSovereigntyContent.ts (same division of labour as the View
  // stage: text static, one asset admin-overridable). See
  // FS_BRIDGE_SECTION_KEYS below for the canonical (bridge, stage) -> section
  // key mapping so callers never hand-construct these strings.
  ...FS_STAGE_IDS.map((stage) => `fs-${stage}`),
  ...FS_STAGE_IDS.map((stage) => `ci-fs-${stage}`),
  // Learn's second/third plate — see fsLearnPlateSectionKey's own comment.
  'fs-learn-2',
  'fs-learn-3',
  'ci-fs-learn-2',
  'ci-fs-learn-3',
]);

export interface KnytsBridgeEditorialSection {
  section: string;
  headline: string | null;
  shortCopy: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  /**
   * infographic_url (2026-09-02, A2 completion — migration
   * 20260902010000_knyts_bridge_editorial_config_infographic_url.sql). Null
   * both when no infographic has been published AND when the column itself
   * doesn't exist yet in this environment — see the two-tier read in
   * getKnytsBridgeEditorialSection below, which keeps headline/copy/video/
   * poster fully working even before that migration lands.
   */
  infographicUrl: string | null;
  campaignCta: string | null;
  rewardCopy: string | null;
  /**
   * structured_content (2026-09-03, CFS editorial coverage completion —
   * migration 20260903140000). One coherent jsonb blob per section:
   * topics/understanding-checks/exercise summary/contextual line/asset
   * caption+alt/(Learn only) lesson label — published together in one
   * write, never as separate mismatched fields. Optional field: existing
   * non-CFS sections (home/orient/...) never set it and read back `null`.
   * Shape: FsStructuredContent (services/journey/financialSovereigntyContent.ts).
   */
  structuredContent?: Record<string, unknown> | null;
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
    infographicUrl: null,
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
    infographicUrl: null,
    campaignCta: 'Claim your Passport',
    rewardCopy: null,
    updatedAt: null,
  },
  // Added 2026-08-14 (final Choose-surface closure pass) — the CHOOSE
  // stage's contextual left pane (KnytsBridgeChooseSurface.tsx). Only
  // `videoUrl`/`posterUrl` are actually consumed there: when an admin sets a
  // video, it plays on landing; when absent, the surface falls back to its
  // own hardcoded "Where next?" explainer (never derived from headline/
  // shortCopy below — those exist only so the generic admin form has
  // sensible starting text, matching every other section's shape).
  choose: {
    section: 'choose',
    headline: 'Where next?',
    shortCopy: 'Your crossing is published. Choose how to continue in the Polity.',
    videoUrl: null,
    posterUrl: null,
    infographicUrl: null,
    campaignCta: null,
    rewardCopy: null,
    updatedAt: null,
  },
  // Added 2026-08-12 (KNYTS↔CI parity pass) — the PASSPORT stage's
  // post-crossing surface (KnytsBridgePassportRoom.tsx's "established"
  // branch), mirroring `ci-passport-established`'s pattern exactly.
  'passport-established': {
    section: 'passport-established',
    headline: 'You have crossed the Threshold.',
    shortCopy:
      'Your constitutional presence is confirmed. What you do next is yours to choose — tell your own ' +
      'crossing when you are ready.',
    videoUrl: null,
    posterUrl: null,
    infographicUrl: null,
    campaignCta: null,
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
    infographicUrl: null,
    campaignCta: 'Enter',
    rewardCopy: null,
    updatedAt: null,
  },
  'ci-orient': {
    section: 'ci-orient',
    headline: 'Personhood precedes identity.',
    // Compressed 2026-08-11 (editorial polish pass) from a two-paragraph
    // essay to the operator's own suggested two-line version — same
    // meaning, far less visual weight ahead of the actual questions.
    shortCopy:
      'The Polity begins with you as the constitutional subject. These three questions help establish ' +
      'what you want agents to do — and what must remain yours.',
    videoUrl: null,
    posterUrl: null,
    infographicUrl: null,
    campaignCta: null,
    rewardCopy: null,
    updatedAt: null,
  },
  // Added 2026-08-11 (integration pass) — the PASSPORT stage's post-crossing
  // orientation surface (ConstitutionalInternetBridgePassportRoom.tsx's
  // "established" branch), same admin-editable video pattern as ci-orient.
  'ci-passport-established': {
    section: 'ci-passport-established',
    headline: 'Your constitutional presence is confirmed.',
    shortCopy:
      'You are now recognized as a constitutional subject in the Polity. What you do next is yours to ' +
      'choose — an agent can help, but only within what you decide here.',
    videoUrl: null,
    posterUrl: null,
    infographicUrl: null,
    campaignCta: null,
    rewardCopy: null,
    updatedAt: null,
  },
  // Added 2026-09-02 (Turn E, admin-picker acceptance-gap fix) — a starting
  // default for the ADMIN edit form only (QriptopianAdminTab.tsx's Bridges
  // tab -> MoneyPenny). Without this entry, defaultsForSection() would show
  // HOME's "Cross the Threshold. Come home." copy as the starting point for
  // an admin opening this section for the first time — harmless (the public
  // reader never uses this generic default; moneyPennyEducationalMedia.ts
  // always checks the real placement/config row first) but misleading in
  // the editing UI itself.
  'moneypenny-financial-basics': {
    section: 'moneypenny-financial-basics',
    headline: 'Financial Sovereignty basics',
    shortCopy:
      'A short introduction to how MoneyPenny works with you — reviewing your financial profile, ' +
      'explaining recommendations, and never moving funds without your explicit authorization.',
    videoUrl: null,
    posterUrl: null,
    infographicUrl: null,
    campaignCta: null,
    rewardCopy: null,
    updatedAt: null,
  },
  // ── CFS content pack (2026-09-03) — twelve stage-level placements (six
  // stages × two bridges). headline/shortCopy mirror the pack's per-stage
  // `headline`/`lead` (content/bridge-pages.json) as the starting default —
  // never invented copy — and infographicUrl stays null until an admin
  // publishes the corresponding plate through this same panel. The full
  // card/topic/exercise content lives in financialSovereigntyContent.ts
  // (static, like every other FS stage's body copy today); only the
  // headline/summary/primary-plate are admin-overridable here, matching the
  // View stage's own "text static, one asset admin-overridable" precedent.
  ...(() => {
    const stageCopy: Record<FsStageId, { headline: string; shortCopy: string; campaignCta: string }> = {
      discover: {
        headline: 'Your money. Your choices. A clearer way to begin.',
        shortCopy:
          'Financial services help you manage money today and prepare for tomorrow. Explore familiar financial ' +
          'tools alongside crypto, and see how constitutional financial services put your goals, permissions and ' +
          'oversight at the centre. You do not need a trading account or a deposit to learn.',
        campaignCta: 'Explore the financial map',
      },
      learn: {
        headline: 'Know what a service does—and what you remain responsible for.',
        shortCopy:
          'Start with the purpose of each financial service, then look at its costs, risks and controls. Learn how ' +
          'fiat and crypto fit into the picture, and how an agent can help without receiving unlimited authority.',
        campaignCta: 'Start the short lessons',
      },
      explore: {
        headline: 'Try the thinking before you commit the money.',
        shortCopy:
          'Pick a sample goal, compare a few approaches and see how a rehearsal changes when assumptions change. ' +
          'Meet MoneyPenny in action without handing over control.',
        campaignCta: 'Try a guided example',
      },
      prepare: {
        headline: 'Build a financial picture you understand and control.',
        shortCopy:
          'Review what comes in, what goes out, what you hold and what you owe. Add a goal, choose a first task and ' +
          'decide what help you want from AgentMe and MoneyPenny. Connecting a wallet or delegating an action is a ' +
          'separate choice.',
        campaignCta: 'Build or review my profile',
      },
      operate: {
        headline: 'Put understanding into practice—with you in charge.',
        shortCopy:
          'Ask a question, shape a plan, rehearse an action or review an authorized task. MoneyPenny works within ' +
          'the role and permissions you choose. Moving into advanced automation is optional.',
        campaignCta: 'Work with MoneyPenny',
      },
      cross: {
        headline: 'More automation. More explicit responsibility.',
        shortCopy:
          'Advanced operations are for people ready to define sustained agent mandates, coordinate multiple agents, ' +
          'or build financial services for others. Automation changes how work is carried out; it does not remove ' +
          'financial uncertainty or the need for oversight.',
        campaignCta: 'Review advanced readiness',
      },
    };
    const entries: Record<string, KnytsBridgeEditorialSection> = {};
    for (const stage of FS_STAGE_IDS) {
      const copy = stageCopy[stage];
      const content = FS_STAGE_CONTENT[stage];
      for (const bridge of ['ci', 'knyts'] as const) {
        entries[fsBridgeSectionKey(bridge, stage)] = {
          section: fsBridgeSectionKey(bridge, stage),
          headline: copy.headline,
          shortCopy: copy.shortCopy,
          videoUrl: null,
          posterUrl: null,
          infographicUrl: null,
          campaignCta: copy.campaignCta,
          rewardCopy: null,
          // Real CFS pack content as the starting default (2026-09-03,
          // editorial coverage completion) — an admin who never opens this
          // section still gets the corrected pack copy; an admin who DOES
          // edit+save replaces this default with their own row, published
          // together in one write (topics/checks/exercise/contextual line/
          // asset caption+alt never split into separate mismatched fields).
          //
          // Learn is special-cased: content/step-composition.json v1.2 maps
          // learn-purposes -> [L-TOPIC-01], learn-value -> [L-TOPIC-02,
          // L-Q01, L-Q03], learn-agents -> [L-TOPIC-03, L-X01, L-Q02] — the
          // primary fs-learn section (plate 1) carries ONLY learn-purposes'
          // slice, never all three topics dumped together; plates 2/3 carry
          // their own slice via the override block below this loop.
          structuredContent:
            stage === 'learn'
              ? {
                  topics: content.topics.filter((t) => t.id === 'L-TOPIC-01'),
                  checks: [],
                  exerciseSummary: '',
                  contextualLine: content.contextualLine[bridge],
                  assetCaption: content.asset.caption,
                  assetAlt: content.asset.alt,
                  lessonLabel: 'Lesson 1 — What money helps you do',
                }
              : {
                  topics: content.topics,
                  checks: content.checks,
                  exerciseSummary: content.exerciseSummary,
                  contextualLine: content.contextualLine[bridge],
                  assetCaption: content.asset.caption,
                  assetAlt: content.asset.alt,
                },
          updatedAt: null,
        };
      }
    }
    // Learn's second/third plate — a starting default for the admin edit
    // form. Per content/step-composition.json v1.2: learn-value carries
    // [L-TOPIC-02, L-Q01, L-Q03]; learn-agents carries [L-TOPIC-03, L-X01,
    // L-Q02] (L-X01's own summary, since it's referenced there, not on
    // plate 1). Each plate's slice is its own — never a duplicate of what
    // the primary fs-learn section (plate 1, learn-purposes) already shows.
    const learnContent = FS_STAGE_CONTENT.learn;
    const byTopicId = (id: string) => learnContent.topics.filter((t) => t.id === id);
    const byCheckIds = (ids: string[]) => learnContent.checks.filter((c) => ids.includes(c.id));
    const learnPlateMeta: { title: string; label: string; plate: (typeof FS_LEARN_PLATES)[number]; topicId: string; checkIds: string[]; exerciseSummary?: string }[] = [
      { title: 'Fiat, crypto and value', label: 'Lesson 2 — Fiat, crypto and value', plate: FS_LEARN_PLATES[1], topicId: 'L-TOPIC-02', checkIds: ['L-Q01', 'L-Q03'] },
      { title: 'You, AgentMe and MoneyPenny', label: 'Lesson 3 — You, AgentMe and MoneyPenny', plate: FS_LEARN_PLATES[2], topicId: 'L-TOPIC-03', checkIds: ['L-Q02'], exerciseSummary: learnContent.exerciseSummary },
    ];
    for (const [i, meta] of learnPlateMeta.entries()) {
      const plateIndex = (i + 1) as 1 | 2;
      for (const bridge of ['ci', 'knyts'] as const) {
        const key = fsLearnPlateSectionKey(bridge, plateIndex);
        entries[key] = {
          section: key,
          headline: meta.title,
          shortCopy: null,
          videoUrl: null,
          posterUrl: null,
          infographicUrl: null,
          campaignCta: null,
          rewardCopy: null,
          structuredContent: {
            topics: byTopicId(meta.topicId),
            checks: byCheckIds(meta.checkIds),
            exerciseSummary: meta.exerciseSummary ?? '',
            contextualLine: '',
            assetCaption: meta.plate.caption,
            assetAlt: meta.plate.alt,
            lessonLabel: meta.label,
          },
          updatedAt: null,
        };
      }
    }
    return entries;
  })(),
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
    // Absent on a row read via the legacy (pre-migration) column list below
    // — `row.infographic_url` is simply undefined then, and `?? null`
    // correctly reports "not available" rather than throwing.
    infographicUrl: (row.infographic_url as string) ?? null,
    campaignCta: (row.campaign_cta as string) ?? null,
    rewardCopy: (row.reward_copy as string) ?? null,
    // Absent on a row read via MID_COLUMNS/LEGACY_COLUMNS (structured_content
    // migration not yet applied in this environment) — `?? null` reports
    // "not available" the same way infographicUrl already does above.
    structuredContent: (row.structured_content as Record<string, unknown>) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

const LEGACY_COLUMNS = 'section, headline, short_copy, video_url, poster_url, campaign_cta, reward_copy, updated_at';
const MID_COLUMNS = `section, headline, short_copy, video_url, poster_url, infographic_url, campaign_cta, reward_copy, updated_at`;
const FULL_COLUMNS = `section, headline, short_copy, video_url, poster_url, infographic_url, campaign_cta, reward_copy, structured_content, updated_at`;

/** Postgres 42703 (undefined_column) — the infographic_url migration
 *  hasn't landed in this environment yet. Distinct from isMissingTable
 *  (42P01): the TABLE exists and is fully live, only the new COLUMN is
 *  absent, so every other field must keep working while this one degrades. */
function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  if (typeof error.message === 'string' && /column .* does not exist/i.test(error.message)) return true;
  return false;
}

/**
 * Fail faithful (not silently defaulted): a missing ROW is a legitimate,
 * expected state (falls back to defaultsForSection) — a missing TABLE, a
 * bad column, or any other query failure is a real error and must say so,
 * never be indistinguishable from "no row yet". Swallowing `error` here
 * previously meant this function returned the exact same shipped-copy
 * defaults whether the editorial_config migration had been applied or not,
 * so a 200 from the route it backs proved nothing about migration state.
 *
 * Two-tier read (2026-09-02, infographic_url addition): tries the FULL
 * column list first; if that specific column doesn't exist yet
 * (isMissingColumn), retries with the LEGACY list so headline/copy/video/
 * poster — all already-live, already-working fields — are never taken down
 * by a not-yet-applied migration for a field nothing else depends on.
 */
export async function getKnytsBridgeEditorialSection(
  supabase: SupabaseClient,
  section: string,
): Promise<KnytsBridgeEditorialSection> {
  let { data, error } = await supabase
    .from('knyts_bridge_editorial_config')
    .select(FULL_COLUMNS)
    .eq('section', section)
    .maybeSingle();
  if (error && isMissingColumn(error)) {
    ({ data, error } = await supabase
      .from('knyts_bridge_editorial_config')
      .select(MID_COLUMNS)
      .eq('section', section)
      .maybeSingle());
    if (error && isMissingColumn(error)) {
      ({ data, error } = await supabase
        .from('knyts_bridge_editorial_config')
        .select(LEGACY_COLUMNS)
        .eq('section', section)
        .maybeSingle());
    }
  }
  if (error) throw new Error(`knyts_bridge_editorial_config read failed: ${error.message}`);
  return rowToSection(data as Record<string, unknown> | null, section);
}

export interface KnytsBridgeEditorialUpdate {
  headline?: string | null;
  shortCopy?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  infographicUrl?: string | null;
  campaignCta?: string | null;
  rewardCopy?: string | null;
  structuredContent?: Record<string, unknown> | null;
}

/** Thrown by upsertKnytsBridgeEditorialSection when an update sets
 *  infographicUrl but the column doesn't exist yet — distinct from every
 *  other write failure so callers (publishPlacement) can surface an honest
 *  "not available in this environment yet" rather than a raw Postgres
 *  error, exactly the same discipline as FinancialProfileTableMissingError
 *  and 'bridge-placements-table-missing'. */
export class KnytsBridgeInfographicColumnMissingError extends Error {
  constructor() {
    super(
      'knyts_bridge_editorial_config.infographic_url does not exist in this environment yet — apply ' +
        'supabase/migrations/20260902010000_knyts_bridge_editorial_config_infographic_url.sql.',
    );
  }
}

/** Same discipline as KnytsBridgeInfographicColumnMissingError, for the
 *  2026-09-03 structured_content column (CFS editorial coverage). */
export class KnytsBridgeStructuredContentColumnMissingError extends Error {
  constructor() {
    super(
      'knyts_bridge_editorial_config.structured_content does not exist in this environment yet — apply ' +
        'supabase/migrations/20260903140000_knyts_bridge_editorial_config_structured_content.sql.',
    );
  }
}

export async function upsertKnytsBridgeEditorialSection(
  supabase: SupabaseClient,
  section: string,
  update: KnytsBridgeEditorialUpdate,
  updatedBy: string,
): Promise<KnytsBridgeEditorialSection> {
  const setsInfographic = update.infographicUrl !== undefined;
  const setsStructuredContent = update.structuredContent !== undefined;
  const writePayload = {
    section,
    ...(update.headline !== undefined ? { headline: update.headline } : {}),
    ...(update.shortCopy !== undefined ? { short_copy: update.shortCopy } : {}),
    ...(update.videoUrl !== undefined ? { video_url: update.videoUrl } : {}),
    ...(update.posterUrl !== undefined ? { poster_url: update.posterUrl } : {}),
    ...(setsInfographic ? { infographic_url: update.infographicUrl } : {}),
    ...(update.campaignCta !== undefined ? { campaign_cta: update.campaignCta } : {}),
    ...(update.rewardCopy !== undefined ? { reward_copy: update.rewardCopy } : {}),
    ...(setsStructuredContent ? { structured_content: update.structuredContent } : {}),
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from('knyts_bridge_editorial_config')
    .upsert(writePayload, { onConflict: 'section' })
    .select(FULL_COLUMNS)
    .single();

  if (error && isMissingColumn(error)) {
    // Retry against MID (drops structured_content only) — a caller that
    // never touched structuredContent must keep working even before the
    // 09-03 migration lands, same discipline infographicUrl already has.
    if (setsStructuredContent) throw new KnytsBridgeStructuredContentColumnMissingError();
    const { structured_content: _dropSc, ...midPayload } = writePayload as typeof writePayload & { structured_content?: Record<string, unknown> | null };
    ({ data, error } = await supabase
      .from('knyts_bridge_editorial_config')
      .upsert(midPayload, { onConflict: 'section' })
      .select(MID_COLUMNS)
      .single());
    if (error && isMissingColumn(error)) {
      if (setsInfographic) throw new KnytsBridgeInfographicColumnMissingError();
      const { infographic_url: _drop, ...legacyPayload } = midPayload as typeof midPayload & { infographic_url?: string | null };
      ({ data, error } = await supabase
        .from('knyts_bridge_editorial_config')
        .upsert(legacyPayload, { onConflict: 'section' })
        .select(LEGACY_COLUMNS)
        .single());
    }
  }
  if (error) throw new Error(error.message);
  return rowToSection(data as Record<string, unknown>, section);
}
