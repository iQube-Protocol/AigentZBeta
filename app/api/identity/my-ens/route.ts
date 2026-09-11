/**
 * GET /api/identity/my-ens — return the caller's ENS assignment.
 * POST /api/identity/my-ens — mint an ENS subname for the caller.
 *
 * Resolves the persona from the spine (no persona_id in the URL).
 * The client surface (T1) never holds personaId, so this route
 * replaces the /api/identity/persona/[id]/ens pattern for client use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { mintEnsSubname } from '@/services/identity/namestoneClient';

export const dynamic = 'force-dynamic';

const LABEL_RE = /^[a-z][a-z0-9-]{2,40}$/;

function publicRef(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getActivePersona(req);
    if (!caller?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { data, error } = await admin
      .from('persona_ens_names')
      .select('ens_id, ens_full, ens_label, ens_parent, status, minted_at')
      .eq('persona_id', caller.personaId)
      .eq('status', 'live')
      .maybeSingle();

    if (error && error.message.includes('persona_ens_names')) {
      return NextResponse.json({ ok: true, ens: null, migrationPending: '20260613500000_persona_ens_names.sql' });
    }
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (data) {
      return NextResponse.json({
        ok: true,
        ens: {
          ensName: data.ens_full,
          ensLabel: data.ens_label,
          ensParent: data.ens_parent,
          status: data.status,
          mintedAt: data.minted_at,
          mode: 'live',
        },
      });
    }

    return NextResponse.json({ ok: true, ens: null });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Lookup failed' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getActivePersona(req);
    if (!caller?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { label?: string };
    const label = (body.label ?? '').toLowerCase().trim();
    if (!LABEL_RE.test(label)) {
      return NextResponse.json(
        { ok: false, error: 'label must be 3-41 chars, lowercase letters/digits/hyphens, starting with a letter' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const personaPublicRef = publicRef(caller.personaId);
    const resolveAddress = `0x${personaPublicRef.padEnd(40, '0').slice(0, 40)}`;

    const mintResult = await mintEnsSubname({
      label,
      resolveAddress,
      textRecords: {
        polity: 'persona',
        public_ref: personaPublicRef,
      },
    });

    const { data: row, error: insertErr } = await admin
      .from('persona_ens_names')
      .insert({
        persona_id: caller.personaId,
        persona_public_ref: personaPublicRef,
        ens_label: mintResult.ensLabel,
        ens_parent: mintResult.ensParent,
        ens_full: mintResult.ensFull,
        namestone_response: mintResult.rawResponse,
        status: 'live',
      })
      .select('ens_id, ens_full, ens_label, ens_parent, status, minted_at')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505' || insertErr.message.includes('ens_full')) {
        return NextResponse.json(
          { ok: false, error: `${mintResult.ensFull} already taken — choose another label` },
          { status: 409 },
        );
      }
      if (insertErr.message.includes('persona_ens_names')) {
        return NextResponse.json(
          { ok: false, error: 'Pending migration: 20260613500000_persona_ens_names.sql must be applied in Supabase.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      ens: {
        ensName: row.ens_full,
        ensLabel: row.ens_label,
        ensParent: row.ens_parent,
        status: row.status,
        mintedAt: row.minted_at,
        mode: mintResult.mode,
        personaPublicRef,
        note: mintResult.note,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'ENS mint failed' },
      { status: 500 },
    );
  }
}
