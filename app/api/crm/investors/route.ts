/**
 * GET /api/crm/investors
 *
 * Returns all investors from nakamoto_knyt_personas enriched with activation status.
 * An investor is "activated" if their email is linked to a crm_personas record that
 * has an identity_persona_id (i.e. they've signed in and created a KNYT or Qripto persona).
 * "Linked" means crm_personas.email matches but identity_persona_id may be null.
 *
 * Query params:
 *   activated   boolean  filter to activated (true) / inactive (false) only
 *   search      string   partial match on name, email, or KNYT-ID
 *   limit       number   default 100
 *   offset      number   default 0
 *   sort        string   "name" | "invested" | "activated"  default "name"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activatedFilter = searchParams.get('activated');
  const search = searchParams.get('search')?.trim() ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const sort = searchParams.get('sort') ?? 'name';

  const client = getCrmClient();

  // ── Fetch all nakamoto_knyt_personas ────────────────────────────────────────
  let query = client
    .from('nakamoto_knyt_personas')
    .select('*');

  // Apply search filter at DB level where possible
  if (search) {
    query = query.or(
      `"First-Name".ilike.%${search}%,"Last-Name".ilike.%${search}%,` +
      `"Email".ilike.%${search}%,"KNYT-ID".ilike.%${search}%`
    );
  }

  const { data: investors, error } = await query
    .order('"First-Name"', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!investors || investors.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  // ── Resolve activation status via crm_personas ──────────────────────────────
  // Collect non-empty emails then do a single batch lookup
  const emails = investors
    .map((inv) => (inv['Email'] as string)?.toLowerCase())
    .filter(Boolean);

  let crmByEmail: Record<string, { identity_persona_id: string | null }> = {};

  if (emails.length > 0) {
    // We need case-insensitive match; fetch crm_personas for these emails
    const { data: crmRows } = await client
      .from('crm_personas')
      .select('email, identity_persona_id')
      .in('email', emails);

    (crmRows ?? []).forEach((row) => {
      if (row.email) {
        crmByEmail[row.email.toLowerCase()] = {
          identity_persona_id: row.identity_persona_id ?? null,
        };
      }
    });
  }

  // ── Build response ──────────────────────────────────────────────────────────
  let results = investors.map((inv) => {
    const email = (inv['Email'] as string) ?? '';
    const emailLower = email.toLowerCase();
    const crmRecord = crmByEmail[emailLower];
    const isLinked = !!crmRecord;
    const isActivated = !!(crmRecord?.identity_persona_id);
    const personaId = crmRecord?.identity_persona_id ?? null;

    return {
      id: inv['id'] as string,
      firstName: (inv['First-Name'] as string) ?? '',
      lastName: (inv['Last-Name'] as string) ?? '',
      name: `${inv['First-Name'] ?? ''} ${inv['Last-Name'] ?? ''}`.trim() || email,
      email,
      knytId: (inv['KNYT-ID'] as string) ?? '',
      omTier: (inv['OM-Tier-Status'] as string) ?? '',
      totalInvested: (inv['Total-Invested'] as string) ?? '',
      metaiyeShares: (inv['Metaiye-Shares-Owned'] as string) ?? '',
      knytCoyn: (inv['KNYT-COYN-Owned'] as string) ?? '',
      motionComics: (inv['Motion-Comics-Owned'] as string) ?? '',
      paperComics: (inv['Paper-Comics-Owned'] as string) ?? '',
      digitalComics: (inv['Digital-Comics-Owned'] as string) ?? '',
      knytPosters: (inv['KNYT-Posters-Owned'] as string) ?? '',
      knytCards: (inv['KNYT-Cards-Owned'] as string) ?? '',
      characters: (inv['Characters-Owned'] as string) ?? '',
      profileImageUrl: (inv['profile_image_url'] as string) ?? '',
      createdAt: inv['created_at'] as string,
      // Activation
      isLinked,          // email is in crm_personas (may or may not have a persona)
      isActivated,       // has a linked identity persona (signed in, created KNYT/Qripto persona)
      personaId,         // the personas.id if activated — use for /crm/personas/:id links
    };
  });

  // ── Apply activated filter ──────────────────────────────────────────────────
  if (activatedFilter === 'true') {
    results = results.filter((r) => r.isActivated);
  } else if (activatedFilter === 'false') {
    results = results.filter((r) => !r.isActivated);
  }

  // ── Sort ────────────────────────────────────────────────────────────────────
  if (sort === 'invested') {
    results.sort((a, b) => {
      const aVal = parseFloat(a.totalInvested.replace(/[^0-9.]/g, '')) || 0;
      const bVal = parseFloat(b.totalInvested.replace(/[^0-9.]/g, '')) || 0;
      return bVal - aVal;
    });
  } else if (sort === 'activated') {
    results.sort((a, b) => {
      if (a.isActivated === b.isActivated) return a.name.localeCompare(b.name);
      return a.isActivated ? -1 : 1;
    });
  }

  return NextResponse.json({
    data: results,
    total: results.length,
    offset,
    limit,
  });
}
