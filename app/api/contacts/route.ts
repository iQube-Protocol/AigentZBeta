/**
 * GET /api/contacts
 *
 * Returns the active persona's contacts from persona_contacts.
 * Supports full-text search via ?q= (name, email, org).
 * Supports ?source= filter (google_contacts | vcard | manual).
 * Returns up to 200 results by default; ?limit= overrides (max 500).
 *
 * Response: { ok, contacts: Contact[], total }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() || '';
  const source = searchParams.get('source') || '';
  const limitParam = parseInt(searchParams.get('limit') ?? '200', 10);
  const limit = Math.min(isNaN(limitParam) ? 200 : limitParam, 500);

  const supabase = getSupabaseServer();
  let query = supabase
    .from('persona_contacts')
    .select('id, display_name, first_name, last_name, organization, job_title, email, email_2, phone, phone_2, address, source, updated_at', { count: 'exact' })
    .eq('persona_id', persona.personaId)
    .order('display_name', { ascending: true })
    .limit(limit);

  if (source) {
    query = query.eq('source', source);
  }

  if (q) {
    // Full-text search across name + email + org
    query = query.textSearch(
      'fts',
      q.split(/\s+/).map(w => w + ':*').join(' & '),
      { config: 'english', type: 'websearch' }
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[contacts] query error:', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contacts: data ?? [], total: count ?? 0 });
}
