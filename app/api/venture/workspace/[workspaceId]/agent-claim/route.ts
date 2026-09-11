/**
 * POST /api/venture/workspace/[workspaceId]/agent-claim
 *
 * The Slice-E route the pure model in `services/horizen/agentBinding.ts` and
 * the orchestration in `services/horizen/operatorClaim.ts` were built for:
 * the actual operator-claim ceremony that produces an `agent_identity_bindings`
 * row (previously only exercisable from unit tests — no route called
 * `bindAgentIdentity` before this one).
 *
 * Two phases, one route, selected by `phase` in the body:
 *
 *   `phase: "message"`  — server returns the exact claim message to present
 *                          for wallet signing. No write.
 *   `phase: "complete"` — caller presents the signature over that exact
 *                          message; the binding is verified, persisted, and
 *                          an attributable receipt is written (enqueuing the
 *                          existing DVN anchor — never modifying the pipeline).
 *
 * ── GATE ─────────────────────────────────────────────────────────────────
 *
 * Same workspace-membership gate as the sibling evidence-chain route
 * (spine auth + `satisfiesWorkspaceScope` over the caller's OWN grants), PLUS
 * `isAdmin` — this writes a consequential constitutional record (an identity
 * binding + delegation attribution), not a read, so it is held to the
 * stricter of the two gates already established in this route family rather
 * than inventing a third policy (CLAUDE.md: never weaken a gate; when in
 * doubt, use the stricter existing one).
 *
 * ── WHAT THIS ROUTE DOES NOT DO ─────────────────────────────────────────
 *
 * It does not register a new ERC-8004 identity on Base Sepolia — `tokenId`
 * must already exist from a real Horizen registration. See
 * `services/horizen/operatorClaim.ts`'s header and the 2026-07-30 update doc
 * for exactly what remains blocked (network egress in this environment, and
 * the on-chain registration ABI not being part of this repository) and why.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getExperimentWorkspace } from '@/services/experiments/experimentWorkspace';
import { resolveParticipationSelfView } from '@/services/passport/participationSelfView';
import {
  satisfiesWorkspaceScope,
  type ParticipationGrantSignal,
} from '@/services/passport/participationTabGate';
import { buildOperatorClaimMessage, performOperatorAgentClaim } from '@/services/horizen/operatorClaim';
import type { HorizenNetwork } from '@/services/horizen/identity';

export const dynamic = 'force-dynamic';

interface MessagePhaseBody {
  phase: 'message';
  network: HorizenNetwork;
  tokenId: string;
  ownerWallet: string;
  passportId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

interface CompletePhaseBody {
  phase: 'complete';
  agentRootDid: string;
  claimExpectation: Parameters<typeof performOperatorAgentClaim>[0]['claimExpectation'];
  message: string;
  signature: string;
  delegationGrantId: string;
  claimedRelationship: boolean;
  acceptedResponsibility: boolean;
  scopeDefined: boolean;
  delegationActive: boolean;
  runtimeAdmissionEligible?: boolean;
  passportId: string;
}

type Body = MessagePhaseBody | CompletePhaseBody;

async function gate(req: NextRequest, workspaceId: string) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 }) };
  }

  const ws = getExperimentWorkspace(workspaceId);
  if (!ws) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: 'Workspace not found' }, { status: 404 }) };
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 }) };
  }

  const isAdmin = persona.cartridgeFlags?.isAdmin === true;
  if (!isAdmin) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: 'Admin required' }, { status: 403 }) };
  }

  const selfView = await resolveParticipationSelfView(req, admin, {
    personaId: persona.personaId,
    authProfileId: persona.authProfileId,
  }).catch(() => ({ grants: [], passportIssued: false, delegationActive: false }));

  const grants: ParticipationGrantSignal[] = selfView.grants.map((g) => ({
    accessDomain: g.accessDomain,
    role: g.role,
    allowedScopes: g.allowedScopes,
  }));
  const isMember = satisfiesWorkspaceScope({ loaded: true, grants }, ws.participation.domain, ws.id, isAdmin);
  if (!isMember) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: 'Workspace membership required — your access grant is not scoped to this pilot' },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, personaId: persona.personaId };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const gated = await gate(req, workspaceId);
  if (!gated.ok) return gated.res;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.phase === 'message') {
    const result = buildOperatorClaimMessage({
      runtime: 'metaMe',
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      origin: req.nextUrl.origin,
      network: body.network,
      tokenId: body.tokenId,
      ownerWallet: body.ownerWallet,
      personaId: gated.personaId,
      passportId: body.passportId,
      nonce: body.nonce,
      issuedAt: body.issuedAt,
      expiresAt: body.expiresAt,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: `Could not normalize agent identity: ${result.reason}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: result.message, claimExpectation: result.claimExpectation });
  }

  if (body.phase === 'complete') {
    const result = await performOperatorAgentClaim({
      agentRootDid: body.agentRootDid,
      claimExpectation: body.claimExpectation,
      message: body.message,
      signature: body.signature,
      delegationGrantId: body.delegationGrantId,
      claimedRelationship: body.claimedRelationship,
      acceptedResponsibility: body.acceptedResponsibility,
      scopeDefined: body.scopeDefined,
      delegationActive: body.delegationActive,
      runtimeAdmissionEligible: body.runtimeAdmissionEligible,
      now: new Date().toISOString(),
      personaId: gated.personaId,
      passportId: body.passportId,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      bindingId: result.binding.bindingId,
      status: result.binding.status,
      receiptId: result.receiptId,
    });
  }

  return NextResponse.json({ ok: false, error: "phase must be 'message' or 'complete'" }, { status: 400 });
}
