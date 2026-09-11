/**
 * /api/steward/participation/research-persona — the persistent Research
 * Persona/handle (IRL Stewardship, item 3). NOT personhood — composes with,
 * never replaces, the Person-Persona-iQube protocol.
 *
 * GET  ?personaId=<id>   → the record (or honest placeholder) for that
 *                          persona. Omit personaId for the caller's OWN.
 *                          A caller may always read their own; reading
 *                          someone else's requires steward authority over at
 *                          least one of that persona's grants.
 * PATCH { personaId?, displayName, handle, privacyMode }
 *                        → create/confirm/edit. personaId omitted or equal
 *                          to the caller's own = the participant's own
 *                          confirm/edit action (`proposedOnly: false`).
 *                          personaId naming someone else = a steward
 *                          PROPOSING a handle pre-confirmation
 *                          (`proposedOnly: true`) — requires the same
 *                          steward-over-that-persona containment as GET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { InvitationAuthority } from '@/services/passport/participationAccess';
import {
  getResearchPersona,
  placeholderResearchPersona,
  upsertResearchPersona,
  type ResearchPersonaPrivacyMode,
  type ResearchPersonaRecord,
} from '@/services/passport/researchPersona';
import { resolveStewardAuthority, grantWithinAuthority } from '@/app/api/steward/participation/_lib/resolveStewardAuthority';

export const dynamic = 'force-dynamic';

const PRIVACY_MODES: ResearchPersonaPrivacyMode[] = ['identified', 'pseudonymous', 'anonymous'];

/**
 * T0→T2 boundary for this route's OWN JSON responses (Identity & Access
 * Spine). The owner-self-view exception lets a caller see their OWN
 * personaId; a steward viewing/proposing for someone ELSE never gets that
 * persona's raw T0 id back — only the display fields the UI actually needs.
 */
function toClientResearchPersona(
  record: ResearchPersonaRecord | { displayName: string; handle: string; isPlaceholder: true },
  revealPersonaId: boolean,
): Record<string, unknown> {
  const { ...rest } = record as Record<string, unknown>;
  if (!revealPersonaId) delete rest.personaId;
  return rest;
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const targetPersonaId = new URL(req.url).searchParams.get('personaId') ?? persona.personaId;
  const isSelf = targetPersonaId === persona.personaId;

  if (!isSelf) {
    const stewardCheck = await resolveStewardAuthority(req);
    if ('error' in stewardCheck) return stewardCheck.error;
    const authorized = await isPersonaWithinAuthority(admin, stewardCheck.authority, targetPersonaId);
    if (!authorized) return NextResponse.json({ ok: false, error: 'Not authorized for that persona' }, { status: 403 });
  }

  const record = await getResearchPersona(admin, targetPersonaId);
  const payload = record ?? { ...placeholderResearchPersona(targetPersonaId), isPlaceholder: true as const };
  return NextResponse.json({ ok: true, researchPersona: toClientResearchPersona(payload, isSelf) });
}

export async function PATCH(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    personaId?: string;
    displayName?: string;
    handle?: string;
    privacyMode?: string;
  };
  const targetPersonaId = body.personaId ?? persona.personaId;
  const isSelf = targetPersonaId === persona.personaId;

  if (!isSelf) {
    const stewardCheck = await resolveStewardAuthority(req);
    if ('error' in stewardCheck) return stewardCheck.error;
    const authorized = await isPersonaWithinAuthority(admin, stewardCheck.authority, targetPersonaId);
    if (!authorized) return NextResponse.json({ ok: false, error: 'Not authorized for that persona' }, { status: 403 });
  }

  if (!body.displayName?.trim()) return NextResponse.json({ ok: false, error: 'displayName is required' }, { status: 400 });
  if (!body.handle?.trim()) return NextResponse.json({ ok: false, error: 'handle is required' }, { status: 400 });
  if (!body.privacyMode || !PRIVACY_MODES.includes(body.privacyMode as ResearchPersonaPrivacyMode)) {
    return NextResponse.json({ ok: false, error: 'Valid privacyMode is required' }, { status: 400 });
  }

  const result = await upsertResearchPersona(admin, {
    personaId: targetPersonaId,
    displayName: body.displayName,
    handle: body.handle,
    privacyMode: body.privacyMode as ResearchPersonaPrivacyMode,
    actorPersonaId: persona.personaId,
    proposedOnly: !isSelf,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, researchPersona: toClientResearchPersona(result.persona, isSelf) });
}

/** A steward may act on a persona they do not own only when at least one of
 *  that persona's OWN grants sits inside the steward's own authority — the
 *  same domain+scope containment `/grants/[grantId]` enforces. */
async function isPersonaWithinAuthority(
  admin: NonNullable<ReturnType<typeof getSupabaseServer>>,
  authority: InvitationAuthority,
  targetPersonaId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('access_grants')
    .select('access_domain, allowed_experiments')
    .eq('persona_id', targetPersonaId)
    .in('status', ['active', 'suspended']);
  if (error || !data) return false;
  return data.some((g) => {
    const domain = String((g as Record<string, unknown>).access_domain);
    const scope = ((g as Record<string, unknown>).allowed_experiments as string[] | null) ?? null;
    return grantWithinAuthority(authority, domain, scope).ok;
  });
}
