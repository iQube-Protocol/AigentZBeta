/**
 * /api/steward/participation/research-persona — the persistent Research
 * Persona/handle (IRL Stewardship, item 3). NOT personhood — composes with,
 * never replaces, the Person-Persona-iQube protocol.
 *
 * GET  ?personaId=<id> | ?grantId=<id>   → the record (or honest placeholder)
 *                          for that persona. Omit both for the caller's OWN.
 *                          A caller may always read their own; reading
 *                          someone else's requires steward authority over at
 *                          least one of that persona's grants.
 *
 *                          `grantId` is the STEWARD-FACING address — the
 *                          steward UI only ever sees a grantId (never a raw
 *                          personaId; the grant view's `holderRef` is a
 *                          one-way commitment, per the Identity & Access
 *                          Spine's T0 rule). Passing `grantId` resolves the
 *                          target persona server-side via
 *                          `getGrantPersonaIds` and is scope-checked against
 *                          THAT grant directly, never a persona-wide scan.
 * PATCH { personaId? | grantId?, displayName, handle, privacyMode }
 *                        → create/confirm/edit. Neither id, or personaId
 *                          equal to the caller's own = the participant's own
 *                          confirm/edit action (`proposedOnly: false`).
 *                          `grantId` (or a personaId that is not the
 *                          caller's own) = a steward PROPOSING a handle
 *                          pre-confirmation (`proposedOnly: true`) —
 *                          requires the same steward containment as GET.
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
import { getGrantPersonaIds } from '@/services/passport/participationAccess';
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

/** Resolve the request's target personaId from either a `grantId` (the
 *  steward-facing address — never a raw personaId reaches the client) or a
 *  `personaId` (the owner's own, from their own session). Also resolves
 *  and checks steward containment when the target is not the caller. */
async function resolveTarget(
  req: NextRequest,
  admin: NonNullable<ReturnType<typeof getSupabaseServer>>,
  callerPersonaId: string,
  params: { grantId?: string | null; personaId?: string | null },
): Promise<{ ok: true; targetPersonaId: string; isSelf: boolean } | { ok: false; error: NextResponse }> {
  if (params.grantId) {
    const stewardCheck = await resolveStewardAuthority(req);
    if (!stewardCheck.ok) return { ok: false, error: stewardCheck.response };
    const { data: grantRow, error: grantErr } = await admin
      .from('access_grants')
      .select('access_domain, allowed_experiments')
      .eq('id', params.grantId)
      .maybeSingle();
    if (grantErr || !grantRow) {
      return { ok: false, error: NextResponse.json({ ok: false, error: 'Grant not found' }, { status: 404 }) };
    }
    const domain = String((grantRow as Record<string, unknown>).access_domain);
    const scope = ((grantRow as Record<string, unknown>).allowed_experiments as string[] | null) ?? null;
    const containment = grantWithinAuthority(stewardCheck.authority, domain, scope);
    if (!containment.ok) {
      return { ok: false, error: NextResponse.json({ ok: false, error: containment.error }, { status: 403 }) };
    }
    const ids = await getGrantPersonaIds(admin, [params.grantId]);
    const targetPersonaId = ids[params.grantId];
    if (!targetPersonaId) {
      return { ok: false, error: NextResponse.json({ ok: false, error: 'Grant not found' }, { status: 404 }) };
    }
    return { ok: true, targetPersonaId, isSelf: targetPersonaId === callerPersonaId };
  }

  const targetPersonaId = params.personaId ?? callerPersonaId;
  const isSelf = targetPersonaId === callerPersonaId;
  if (!isSelf) {
    const stewardCheck = await resolveStewardAuthority(req);
    if (!stewardCheck.ok) return { ok: false, error: stewardCheck.response };
    const authorized = await isPersonaWithinAuthority(admin, stewardCheck.authority, targetPersonaId);
    if (!authorized) {
      return { ok: false, error: NextResponse.json({ ok: false, error: 'Not authorized for that persona' }, { status: 403 }) };
    }
  }
  return { ok: true, targetPersonaId, isSelf };
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const url = new URL(req.url);
  const resolved = await resolveTarget(req, admin, persona.personaId, {
    grantId: url.searchParams.get('grantId'),
    personaId: url.searchParams.get('personaId'),
  });
  if (!resolved.ok) return resolved.error;
  const { targetPersonaId, isSelf } = resolved;

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
    grantId?: string;
    displayName?: string;
    handle?: string;
    privacyMode?: string;
  };
  const resolved = await resolveTarget(req, admin, persona.personaId, {
    grantId: body.grantId,
    personaId: body.personaId,
  });
  if (!resolved.ok) return resolved.error;
  const { targetPersonaId, isSelf } = resolved;

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
