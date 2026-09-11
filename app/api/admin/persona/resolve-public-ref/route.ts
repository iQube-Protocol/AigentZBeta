/**
 * GET /api/admin/persona/resolve-public-ref?ref=<16-hex Persona Public Reference>
 *
 * PERSONA-PUBLIC-REF-001 (operator-ratified 2026-08-24): personas.id is a T0,
 * server-internal identifier and must never be the normal user-supplied or
 * external persona identifier. The durable, persisted `public_ref` column
 * (Level 2 of the three-level identity model, `services/identity/
 * personaReferences.ts`) is what forms, CLI tools, and external workflows
 * should ask for instead.
 *
 * This route is the ONE sanctioned reverse path from a public_ref back to the
 * internal id. It is admin-gated via `requireAdminPersona` — the same
 * spine-resolved gate used across this repo's other admin routes — never a
 * public/unauthenticated route, and it returns ONLY `{ personaId }`. No other
 * row fields, no listing/enumeration capability, no fallback to display_name.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolvePersonaIdByPublicRef } from '@/services/identity/personaReferences';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const isAdmin = await requireAdminPersona(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: 'admin required' }, { status: 403 });
  }

  const ref = req.nextUrl.searchParams.get('ref')?.trim().toLowerCase();
  if (!ref || !/^[0-9a-f]{16}$/.test(ref)) {
    return NextResponse.json(
      { ok: false, error: 'ref must be a 16-character hex Persona Public Reference' },
      { status: 400 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Supabase is not configured in this environment' }, { status: 503 });
  }

  const personaId = await resolvePersonaIdByPublicRef(admin, ref);
  if (!personaId) {
    return NextResponse.json({ ok: false, error: 'No persona found for that reference' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, personaId });
}
