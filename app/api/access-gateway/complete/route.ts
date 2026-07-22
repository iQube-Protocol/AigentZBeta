/**
 * POST /api/access-gateway/complete — the HUMAN consent act (PRD-PAG-001 §2.1
 * Phase 1, operator-ratified 2026-07-22).
 *
 * Called from the browser consent page by the SIGNED-IN human. Phase 1
 * federates the existing Supabase auth (PRD §0.7): the caller is resolved
 * through the spine (getActivePersona via resolvePersonaOrTimeout — honouring
 * the x-persona-id hint the consent page's persona selector sends, which the
 * spine ownership-verifies). This single authenticated click IS the consent:
 * it snapshots the T1/T2 claim set the human approved and mints the one-time
 * authorization code the relying party exchanges at /api/access-gateway/token.
 *
 * Principal–Delegate Separation (CFS-043 §2): only the human reaches this
 * route; there is NO agent-authenticate path. No delegation is formed here —
 * the human acts as themselves (agent_alias / agreement_id stay NULL on the
 * human row).
 *
 * T0 law: personaId is resolved server-side and NEVER serialised — the
 * session row and the response carry only personaPublicRef / the pairwise
 * subject ref / T1 display fields.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import { personaPublicRef } from '@/services/identity/personaReferences';
import {
  fetchDisplayLabel,
  getHumanHandshake,
  issueHumanAuthorizationCode,
  resolveHumanSubjectRef,
  resolvePassportStatusClaim,
} from '@/services/accessGateway/humanSession';
import { resolveGrantedClaims, type ConsentRecord, type SessionCartridgeFlags } from '@/services/accessGateway/sessionQube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  if (pr.status === 'unauthenticated') return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  const personaId = pr.persona.personaId; // T0 — never leaves this handler

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const handshakeCode = typeof body?.handshakeCode === 'string' ? body.handshakeCode.trim() : '';
  if (!handshakeCode) return NextResponse.json({ ok: false, error: 'handshakeCode required' }, { status: 400 });
  // Consent must be explicit — absence of approval issues nothing.
  const approved = body?.approve === true;

  const handshake = await getHumanHandshake(handshakeCode);
  if (!handshake) return NextResponse.json({ ok: false, error: 'handshake not found or unavailable' }, { status: 404 });
  if (handshake.status !== 'pending') {
    return NextResponse.json({ ok: false, error: `handshake is '${handshake.status}', not pending` }, { status: 409 });
  }
  if (handshake.expiresAt && new Date(handshake.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'handshake expired' }, { status: 410 });
  }
  if (!handshake.clientId) return NextResponse.json({ ok: false, error: 'handshake has no bound client' }, { status: 409 });

  // The pure consent gate: no approval → nothing is issued.
  const grantedClaims = resolveGrantedClaims(handshake.requestedClaims, approved);
  if (!grantedClaims) return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 403 });

  // Resolve the T1/T2 claim snapshot from EXISTING spine primitives — the
  // pairwise subject (persona_external_refs), the public ref, the persona's
  // display label, the server-resolved cartridge flags, the public-safe
  // passport status. Only claims the human granted are resolved at all.
  const subjectRef = await resolveHumanSubjectRef(personaId, handshake.clientId);
  const publicRef = personaPublicRef(personaId);
  const displayLabel = grantedClaims.includes('display_label') ? await fetchDisplayLabel(personaId) : null;
  const cartridgeFlags: SessionCartridgeFlags | null = grantedClaims.includes('cartridge_flags')
    ? {
        isAdmin: pr.persona.cartridgeFlags.isAdmin,
        isPartner: pr.persona.cartridgeFlags.isPartner,
        adminCartridges: pr.persona.cartridgeFlags.adminCartridges ?? [],
      }
    : null;
  const passportStatus = grantedClaims.includes('passport_status')
    ? await resolvePassportStatusClaim(personaId)
    : null;

  const consentRecord: ConsentRecord = {
    clientId: handshake.clientId,
    grantedClaims,
    subjectRef, // T2 — never the raw persona UUID
    approvedAt: new Date().toISOString(),
  };

  const issued = await issueHumanAuthorizationCode({
    handshakeCode,
    personaPublicRef: publicRef,
    subjectPairwiseRef: subjectRef,
    displayLabel,
    cartridgeFlags,
    passportStatus,
    grantedClaims,
    consentRecord,
  });
  if ('error' in issued) {
    return NextResponse.json({ ok: false, error: `could not issue authorization code: ${issued.error}` }, { status: 503 });
  }

  const redirect = new URL(issued.redirectUri);
  redirect.searchParams.set('code', issued.code);
  if (issued.oauthState) redirect.searchParams.set('state', issued.oauthState);

  return NextResponse.json({ ok: true, redirectTo: redirect.toString(), grantedClaims });
}
