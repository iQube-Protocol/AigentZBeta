import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../_lib/supabaseServer';

export async function POST(_req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });

  try {
    const now = new Date();
    const { aliasTtlDays } = await import('@/services/identity/policy');
    const ttlMs = aliasTtlDays() * 24 * 60 * 60 * 1000;
    const reverifyBefore = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // refresh those expiring within 3 days

    const { data: rows, error } = await supabase
      .from('identity_aliases')
      .select('id, entity_did, alias_type, alias_value, verified, expires_at, last_verified_at')
      .eq('alias_type', 'fio')
      .or(`expires_at.lte.${reverifyBefore.toISOString()},verified.eq.false`)
      .limit(100);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const results: any[] = [];

    for (const row of rows || []) {
      const handle = row.alias_value;
      let ok = false;
      let owner: string | null = null;
      try {
        const r = await fetch(`${base}/api/identity/fio/lookup?handle=${encodeURIComponent(handle)}`, { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          owner = j?.data?.owner || null;
          ok = !!owner;
        }
      } catch {}

      const update: any = { verified: ok, last_verified_at: now.toISOString() };
      if (ok) update.expires_at = new Date(now.getTime() + ttlMs).toISOString();

      const { error: uerr } = await supabase
        .from('identity_aliases')
        .update(update)
        .eq('id', row.id);

      results.push({ id: row.id, ok, owner, error: uerr?.message });
    }

    return NextResponse.json({ ok: true, count: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'reverify failed' }, { status: 500 });
  }
}
