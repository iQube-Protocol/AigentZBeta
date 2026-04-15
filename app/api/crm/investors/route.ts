/**
 * GET /api/crm/investors
 *
 * Returns actual investors from nakamoto_knyt_personas, filtered to exclude
 * system/test accounts. A record qualifies as an investor if it has a real
 * name OR any investment/identity marker (Total-Invested, Metaiye-Shares-Owned,
 * OM-Tier-Status, KNYT-ID, KNYT-COYN-Owned, csv_investment_status).
 *
 * Activation status:
 *   activated  — platform_activated_at IS NOT NULL (stamped by /api/wallet/identity/consolidate on real login)
 *   inactive   — platform_activated_at IS NULL (investor-only, no platform account)
 *
 * Query params:
 *   activated   boolean  filter activated (true) / inactive (false) only
 *   search      string   partial match on name, email, or KNYT-ID
 *   limit       number   page size, default 200, max 500
 *   offset      number   default 0 (applied after in-memory filter/sort)
 *   sort        string   "name" | "invested" | "activated" | "tier"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

// OM tier sort order (higher = better)
const TIER_RANK: Record<string, number> = {
  KETA: 5, KEJI: 4, FIRST: 3, ZERO: 2, SAT: 1,
};

// Normalize raw OM-Tier-Status values from the DB ("Sat KNYT", "SAT KNYT", "SAT", "Zero", etc.)
// to the canonical short code used in TIER_RANK / TIER_TO_X.
function normalizeTierKey(raw: string): string {
  const c = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (c.includes('SAT'))   return 'SAT';
  if (c.includes('ZERO'))  return 'ZERO';
  if (c.includes('FIRST')) return 'FIRST';
  if (c.includes('KEJI'))  return 'KEJI';
  if (c.includes('KETA'))  return 'KETA';
  return raw.toUpperCase().trim();
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Returns true if this record looks like a real investor/prospect, not a test/system account.
 * nakamoto_knyt_personas only contains real people — any row with an email is legitimate.
 * The filter exists solely to drop genuinely empty/system rows with no identifying data at all.
 */
function isRealInvestor(inv: Record<string, unknown>): boolean {
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activatedFilter = searchParams.get('activated');
  const search    = searchParams.get('search')?.trim().toLowerCase() ?? '';
  const cohort    = searchParams.get('cohort')?.trim() ?? '';   // campaign_cohort filter
  const band      = searchParams.get('band')?.trim() ?? '';     // investment_amount_band filter
  const limit     = Math.min(parseInt(searchParams.get('limit')  ?? '100', 10), 5000);
  const offset    = parseInt(searchParams.get('offset') ?? '0', 10);
  const sort      = searchParams.get('sort') ?? 'tier';

  const client = getCrmClient();

  // ── Fetch ALL records, paginating past Supabase's 1000-row default cap ──────
  // Always page through everything and filter in-memory. This guarantees
  // correct results regardless of PostgREST column-name quoting behaviour
  // for hyphenated column names (First-Name, Last-Name, KNYT-ID, etc.).
  const PAGE_SIZE = 1000;
  let rawInvestors: Record<string, unknown>[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await client
      .from('nakamoto_knyt_personas')
      .select('*')
      .order('First-Name', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    rawInvestors = rawInvestors.concat(data as Record<string, unknown>[]);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  // ── Step 1: filter to real investors only ──────────────────────────────────
  const investorRows = rawInvestors.filter(isRealInvestor);

  // ── Step 2: build response objects ────────────────────────────────────────
  // Activation is now driven by platform_activated_at on the investor row itself,
  // stamped by /api/wallet/identity/consolidate on real logins.
  // (crm_personas.identity_persona_id was bulk-imported and is not a reliable signal)
  let results = investorRows.map((inv) => {
    const email = str(inv['Email']);
    const isActivated = !!(inv['platform_activated_at']);
    const isLinked = isActivated;
    const personaId = str(inv['platform_auth_profile_id'] as string) || null;

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
      personaId,
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
  });

  // ── Step 4: search filter ──────────────────────────────────────────────────
  if (search) {
    results = results.filter((r) =>
      r.firstName.toLowerCase().includes(search) ||
      r.lastName.toLowerCase().includes(search) ||
      r.name.toLowerCase().includes(search) ||
      r.email.toLowerCase().includes(search) ||
      r.knytId.toLowerCase().includes(search) ||
      r.profession.toLowerCase().includes(search) ||
      r.city.toLowerCase().includes(search)
    );
  }

  // ── Step 5: activation filter ──────────────────────────────────────────────
  if (activatedFilter === 'true') {
    results = results.filter((r) => r.isActivated);
  } else if (activatedFilter === 'false') {
    results = results.filter((r) => !r.isActivated);
  }

  // ── Step 5b: cohort filter ─────────────────────────────────────────────────
  if (cohort === 'unassigned') {
    results = results.filter((r) => !r.campaign_cohort);
  } else if (cohort) {
    results = results.filter((r) => r.campaign_cohort === cohort);
  }

  // ── Step 5c: investment band filter ───────────────────────────────────────
  if (band === 'unassigned') {
    results = results.filter((r) => !r.investment_amount_band);
  } else if (band) {
    results = results.filter((r) => r.investment_amount_band === band);
  }

  // ── Step 6: sort ───────────────────────────────────────────────────────────
  if (sort === 'invested') {
    results.sort((a, b) => {
      const aVal = parseFloat(a.totalInvested.replace(/[^0-9.]/g, '')) || 0;
      const bVal = parseFloat(b.totalInvested.replace(/[^0-9.]/g, '')) || 0;
      return bVal - aVal;
    });
  } else if (sort === 'tier') {
    results.sort((a, b) => {
      const aRank = TIER_RANK[normalizeTierKey(a.omTier ?? '')] ?? 0;
      const bRank = TIER_RANK[normalizeTierKey(b.omTier ?? '')] ?? 0;
      if (aRank !== bRank) return bRank - aRank;
      return a.name.localeCompare(b.name);
    });
  } else if (sort === 'activated') {
    results.sort((a, b) => {
      if (a.isActivated !== b.isActivated) return a.isActivated ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } else {
    // Default: name sort, but put records with no name at the end
    results.sort((a, b) => {
      const aHasName = !!(a.firstName || a.lastName);
      const bHasName = !!(b.firstName || b.lastName);
      if (aHasName !== bHasName) return aHasName ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  const total = results.length;
  const paged = results.slice(offset, offset + limit);

  return NextResponse.json({ data: paged, total, offset, limit });
}

/**
 * POST /api/crm/investors
 *
 * Creates a new prospect/backer row in nakamoto_knyt_personas.
 * Used for: KS backers, campaign prospects, acolytes — anyone who isn't
 * already in the DB. Requires at minimum a first name or email.
 * user_id is omitted — will be linked at signup via email match.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName  = typeof body.lastName  === 'string' ? body.lastName.trim()  : '';
  const email     = typeof body.email     === 'string' ? body.email.trim()     : '';

  if (!firstName && !lastName && !email) {
    return NextResponse.json({ error: 'At least one of firstName, lastName, or email is required' }, { status: 400 });
  }

  const client = getCrmClient();

  // Check for duplicate email
  if (email) {
    const { data: existing } = await client
      .from('nakamoto_knyt_personas')
      .select('id')
      .eq('Email', email)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'A record with this email already exists', existingId: existing.id }, { status: 409 });
    }
  }

  const insertPayload: Record<string, unknown> = {
    'First-Name':      firstName || null,
    'Last-Name':       lastName  || null,
    'Email':           email     || null,
    campaign_cohort:   typeof body.campaign_cohort   === 'string' ? body.campaign_cohort   : null,
    campaign_state:    typeof body.campaign_state    === 'string' ? body.campaign_state    : 'unsent',
    campaign_notes:    typeof body.campaign_notes    === 'string' ? body.campaign_notes    : null,
    preferred_channel_primary: typeof body.preferred_channel === 'string' ? body.preferred_channel : null,
    // Source tag — how this prospect entered the system
    campaign_tags:     body.source ? [String(body.source)] : ['manual_entry'],
  };

  const { data, error } = await client
    .from('nakamoto_knyt_personas')
    .insert(insertPayload)
    .select('id, "First-Name", "Last-Name", "Email", campaign_cohort, campaign_state')
    .single();

  if (error) {
    console.error('[investors POST] insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
