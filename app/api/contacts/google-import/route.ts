/**
 * POST /api/contacts/google-import
 *
 * Imports the caller's Google Contacts into persona_contacts via the
 * People API (people.googleapis.com). Requires the 'contacts' Google
 * source to be connected (OAuth consent with contacts.readonly scope).
 *
 * Idempotent — re-importing upserts on (persona_id, source, source_id)
 * so duplicates are merged rather than doubled.
 *
 * Response: { ok, imported, skipped, total }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveAccessToken } from '@/services/google/oauth';

export const dynamic = 'force-dynamic';

interface PeopleContact {
  resourceName?: string;
  names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>;
  emailAddresses?: Array<{ value?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  addresses?: Array<{ formattedValue?: string }>;
  biographies?: Array<{ value?: string }>;
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const tokenResult = await resolveAccessToken(persona.personaId, 'contacts');
  if (!tokenResult.ok) {
    return NextResponse.json(
      { ok: false, error: 'Google Contacts not connected', detail: tokenResult.code },
      { status: 403 },
    );
  }

  const supabase = getSupabaseServer();

  // Paginate through all contacts from People API
  const allContacts: PeopleContact[] = [];
  let pageToken: string | undefined;
  const FIELDS = 'names,emailAddresses,phoneNumbers,organizations,addresses,biographies';

  try {
    do {
      const url = new URL('https://people.googleapis.com/v1/people/me/connections');
      url.searchParams.set('personFields', FIELDS);
      url.searchParams.set('pageSize', '1000');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${tokenResult.token}` },
      });

      if (!res.ok) {
        const body = await res.text();
        console.error('[contacts/google-import] People API error:', res.status, body);
        let detail = `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(body);
          detail = parsed?.error?.message ?? parsed?.error ?? detail;
        } catch { /* use raw status */ }
        return NextResponse.json(
          { ok: false, error: 'Google People API error', detail, status: res.status },
          { status: 502 },
        );
      }

      const data = (await res.json()) as { connections?: PeopleContact[]; nextPageToken?: string };
      if (Array.isArray(data.connections)) allContacts.push(...data.connections);
      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.error('[contacts/google-import] fetch error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to fetch contacts from Google' }, { status: 502 });
  }

  if (allContacts.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: 0, total: 0 });
  }

  // Map Google contacts → persona_contacts rows
  const rows = allContacts
    .filter(c => c.resourceName)
    .map(c => {
      const name = c.names?.[0];
      const emails = (c.emailAddresses ?? []).map(e => e.value).filter(Boolean) as string[];
      const phones = (c.phoneNumbers ?? []).map(p => p.value).filter(Boolean) as string[];
      const org = c.organizations?.[0];
      const address = c.addresses?.[0]?.formattedValue ?? null;
      const notes = c.biographies?.[0]?.value ?? null;

      return {
        persona_id: persona.personaId,
        source: 'google_contacts' as const,
        source_id: c.resourceName!,
        display_name: name?.displayName ?? null,
        first_name: name?.givenName ?? null,
        last_name: name?.familyName ?? null,
        organization: org?.name ?? null,
        job_title: org?.title ?? null,
        email: emails[0] ?? null,
        email_2: emails[1] ?? null,
        email_3: emails[2] ?? null,
        phone: phones[0] ?? null,
        phone_2: phones[1] ?? null,
        address,
        notes,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(r => r.display_name || r.email || r.phone);

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: allContacts.length, total: allContacts.length });
  }

  // Upsert in batches of 200
  const BATCH = 200;
  let imported = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('persona_contacts')
      .upsert(batch, { onConflict: 'persona_id,source,source_id', ignoreDuplicates: false });
    if (error) {
      console.error('[contacts/google-import] upsert error:', error.message);
    } else {
      imported += batch.length;
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped: allContacts.length - rows.length,
    total: allContacts.length,
  });
}
