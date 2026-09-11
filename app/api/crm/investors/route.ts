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
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { isRealInvestor, buildInvestorResponseRow } from './_lib';

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

export async function GET(request: NextRequest) {
  if (!(await requireAdminPersona(request))) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 },
    );
  }

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
  // NOTE: platform_auth_profile_id (crm_auth_profiles.id) is a T0 identifier
  // (see CLAUDE.md Identity & Access Spine — "authProfileId" never-serialise
  // field). buildInvestorResponseRow() MUST NEVER return it under any field
  // name — see tests/crm-investors-no-t0-leak.test.ts. isActivated/isLinked
  // already convey everything the client needs (whether this investor has a
  // platform account) without exposing the internal id. There is no working
  // client-facing "view linked persona" flow today — personas.id and
  // auth_profile_id are different values, so passing this id into
  // /crm/personas/[id] (which matches on personas.id) never resolved
  // correctly even before this field was removed. Do not reintroduce it.
  let results = investorRows.map(buildInvestorResponseRow);

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
  if (!(await requireAdminPersona(request))) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 },
    );
  }

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
