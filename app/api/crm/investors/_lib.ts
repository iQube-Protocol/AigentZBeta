/**
 * Shared helpers for the investor routes under app/api/crm/investors/**.
 *
 * `isRealInvestor` / `str` were originally defined only in route.ts (the
 * row-level GET/POST handler). The aggregate endpoint (aggregate/route.ts)
 * needs the identical "is this a real investor row, not a test/system
 * account" predicate — copying it would create a second source of truth that
 * silently drifts (CLAUDE.md "Source-of-truth parity"). Both routes import
 * from here instead.
 */

export function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Returns true if this record looks like a real investor/prospect, not a test/system account.
 * nakamoto_knyt_personas only contains real people — any row with an email is legitimate.
 * The filter exists solely to drop genuinely empty/system rows with no identifying data at all.
 */
export function isRealInvestor(inv: Record<string, unknown>): boolean {
  const firstName = str(inv['First-Name']);
  const lastName = str(inv['Last-Name']);
  const email = str(inv['Email']);
  const invested = str(inv['Total-Invested']);
  const shares = str(inv['Metaiye-Shares-Owned']);
  const omTier = str(inv['OM-Tier-Status']);
  const knytId = str(inv['KNYT-ID']);
  const knytCoyn = str(inv['KNYT-COYN-Owned']);
  const csvStatus = str(inv['csv_investment_status']);
  const motionComics = str(inv['Motion-Comics-Owned']);
  const paperComics = str(inv['Paper-Comics-Owned']);
  const digitalComics = str(inv['Digital-Comics-Owned']);
  const knytPosters = str(inv['KNYT-Posters-Owned']);
  const knytCards = str(inv['KNYT-Cards-Owned']);
  const characters = str(inv['Characters-Owned']);

  const hasName       = !!(firstName || lastName);
  const hasEmail      = !!email;
  const hasInvestment = !!(
    invested || shares || omTier || knytId || knytCoyn ||
    csvStatus || motionComics || paperComics || digitalComics ||
    knytPosters || knytCards || characters
  );
  // Any row with name, email, or investment signal is a real person
  return hasName || hasEmail || hasInvestment;
}

/** Shape of one row in GET /api/crm/investors's `data` array. */
export interface InvestorResponseRow {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  knytId: string;
  omTier: string;
  omSince: string;
  totalInvested: string;
  metaiyeShares: string;
  knytCoyn: string;
  motionComics: string;
  paperComics: string;
  digitalComics: string;
  knytPosters: string;
  knytCards: string;
  characters: string;
  profileImageUrl: string;
  profession: string;
  city: string;
  csvInvestmentStatus: string;
  csvTransactionCount: number;
  csvFirstCommittedDate: string;
  csvLastDisbursedDate: string;
  csvTransferMethods: string;
  createdAt: string;
  isActivated: boolean;
  isLinked: boolean;
  campaign_cohort: string | null;
  campaign_state: string | null;
  campaign_notes: string | null;
  investment_amount_band: string | null;
  investor_priority_band: string | null;
  preferred_channel_primary: string | null;
  kickstarter_clicked_at: string | null;
  kickstarter_backed_at: string | null;
  last_campaign_sent_at: string | null;
  last_campaign_sequence: string | null;
}

/**
 * Maps one raw nakamoto_knyt_personas row to the shape GET /api/crm/investors
 * sends to the browser. Extracted as a standalone, pure, importable function
 * so tests can assert the no-T0-leak property behaviourally (call it, inspect
 * the keys/values of what comes back) rather than only via source grep.
 *
 * MUST NEVER read `platform_auth_profile_id` (crm_auth_profiles.id — a T0
 * identifier per CLAUDE.md's Identity & Access Spine) into the returned
 * object under any field name. `isActivated` / `isLinked` are the only
 * platform-linkage signals exposed, and they are booleans, not identifiers.
 * See tests/crm-investors-no-t0-leak.test.ts.
 */
export function buildInvestorResponseRow(inv: Record<string, unknown>): InvestorResponseRow {
  const email = str(inv['Email']);
  const isActivated = !!(inv['platform_activated_at']);
  const isLinked = isActivated;

  // Strip embedded " KNYT" unit from KNYT-COYN-Owned if present
  const knytCoynRaw = str(inv['KNYT-COYN-Owned']);
  const knytCoyn = knytCoynRaw.replace(/\s*KNYT\s*$/i, '').trim();

  return {
    id: str(inv['id'] as string),
    firstName: str(inv['First-Name']),
    lastName: str(inv['Last-Name']),
    name: `${str(inv['First-Name'])} ${str(inv['Last-Name'])}`.trim() || email,
    email,
    knytId: str(inv['KNYT-ID']),
    omTier: str(inv['OM-Tier-Status']),
    omSince: str(inv['OM-Member-Since']),
    totalInvested: str(inv['Total-Invested']),
    metaiyeShares: str(inv['Metaiye-Shares-Owned']),
    knytCoyn,
    motionComics: str(inv['Motion-Comics-Owned']),
    paperComics: str(inv['Paper-Comics-Owned']),
    digitalComics: str(inv['Digital-Comics-Owned']),
    knytPosters: str(inv['KNYT-Posters-Owned']),
    knytCards: str(inv['KNYT-Cards-Owned']),
    characters: str(inv['Characters-Owned']),
    profileImageUrl: str(inv['profile_image_url']),
    profession: str(inv['Profession']),
    city: str(inv['Local-City']),
    // CSV enrichment fields (populated once investor_csv_diff.py is run)
    csvInvestmentStatus: str(inv['csv_investment_status']),
    csvTransactionCount: (inv['csv_transaction_count'] as number) ?? 0,
    csvFirstCommittedDate: str(inv['csv_first_committed_date']),
    csvLastDisbursedDate: str(inv['csv_last_disbursed_date']),
    csvTransferMethods: str(inv['csv_transfer_methods']),
    createdAt: str(inv['created_at'] as string),
    // Activation
    isActivated,
    isLinked,
    // Campaign fields (populated by migration 20260411000000)
    campaign_cohort:           (inv['campaign_cohort']           as string | null) ?? null,
    campaign_state:            (inv['campaign_state']            as string | null) ?? null,
    campaign_notes:            (inv['campaign_notes']            as string | null) ?? null,
    investment_amount_band:    (inv['investment_amount_band']    as string | null) ?? null,
    investor_priority_band:    (inv['investor_priority_band']    as string | null) ?? null,
    preferred_channel_primary: (inv['preferred_channel_primary'] as string | null) ?? null,
    kickstarter_clicked_at:    (inv['kickstarter_clicked_at']    as string | null) ?? null,
    kickstarter_backed_at:     (inv['kickstarter_backed_at']     as string | null) ?? null,
    last_campaign_sent_at:     (inv['last_campaign_sent_at']     as string | null) ?? null,
    last_campaign_sequence:    (inv['last_campaign_sequence']    as string | null) ?? null,
  };
}
