/**
 * GET /api/venture/workspace/[workspaceId]/evidence-chain
 *
 * The joined evidence chain for a workspace's partner-side reference agents —
 * the object the operator's Slice-B ruling names as *"the actual differentiator
 * to demonstrate to Horizen"*:
 *
 *   Horizen agent identity + Horizen proof/validation + DVN ingestion receipt
 *     + passport-backed delegation
 *       → Attributable constitutional evidence
 *
 * ── THE GATE IS THE EXISTING ONE, NOT A NEW ONE ────────────────────────────
 *
 * Authorisation is byte-for-byte the sibling route's
 * (`app/api/venture/workspace/[workspaceId]/route.ts`): spine authentication,
 * then `satisfiesWorkspaceScope` over the caller's OWN grants resolved through
 * `resolveParticipationSelfView`. Domain membership alone is not enough — the
 * grant must be SCOPED to this workspace (Amendment G cohort isolation). A
 * bespoke check here would be a second gate for one decision, free to drift
 * from the first; that is the defect class this codebase fails builds over.
 *
 * ── WHAT IT RETURNS, AND WHAT IT REFUSES TO ────────────────────────────────
 *
 * Only `EvidenceChainView`s: statuses, three-valued link states, four
 * timestamps, Horizen's public chain identifiers, and BOOLEAN presence of the
 * four T2 commitments. No Agent Card body, no evidence prose, no stored text of
 * unbounded size — two 413 incidents on 2026-07-28 came from routes returning
 * unbounded stored text, and this shape cannot grow with the data. No metaMe
 * identifier of any tier crosses the boundary, not even a commitment.
 *
 * ── FAILURES ARE REPORTED, NOT SWALLOWED ───────────────────────────────────
 *
 * A partner read that fails yields an `unreadable` row naming the agent and the
 * reason, NOT a missing row. A silently-dropped agent reads to the operator as
 * "there is no evidence", which is the same manufactured factual claim
 * `binding_unresolvable` exists to prevent one layer down.
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
import { getPartnerWorkspace } from '@/services/venture/partnerWorkspace';
import { correlateAgent } from '@/services/horizen/correlate';
import { resolveBinding } from '@/services/horizen/agentBinding';
import { buildHorizenEvidence } from '@/services/horizen/evidence';
import {
  projectEvidenceChain,
  type EvidenceChainView,
  type ReceiptAnchor,
} from '@/services/horizen/evidenceChain';
import { readAgentIdentityBindings } from '@/services/delegation/delegationGrantStore';
import { readReceiptAnchorStatus } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

/** Hard ceiling on partner reads per request. Each agent costs four upstream
 *  HTTP calls; the registry holds one today, and this keeps a future list from
 *  turning one page load into an unbounded fan-out. */
const MAX_AGENTS_PER_REQUEST = 5;

type ChainRow =
  | { ok: true; registryAlias: string; network: string; label: string; chain: EvidenceChainView }
  | { ok: false; registryAlias: string; network: string; label: string; reason: string; detail: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const ws = getExperimentWorkspace(workspaceId);
  if (!ws) return NextResponse.json({ ok: false, error: 'Workspace not found' }, { status: 404 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const isAdmin = persona.cartridgeFlags?.isAdmin === true;

  const selfView = await resolveParticipationSelfView(req, admin, {
    personaId: persona.personaId,
    authProfileId: persona.authProfileId,
  }).catch(() => ({ grants: [], passportIssued: false, delegationActive: false }));

  const grants: ParticipationGrantSignal[] = selfView.grants.map((g) => ({
    accessDomain: g.accessDomain,
    role: g.role,
    allowedScopes: g.allowedScopes,
  }));
  const isMember = satisfiesWorkspaceScope(
    { loaded: true, grants },
    ws.participation.domain,
    ws.id,
    isAdmin,
  );
  if (!isMember) {
    return NextResponse.json(
      { ok: false, error: 'Workspace membership required — your access grant is not scoped to this pilot' },
      { status: 403 },
    );
  }

  // The reference agents are DATA on the partner registry (single authoritative
  // list). A workspace that ingests no external agent evidence declares none,
  // and gets an honest empty answer rather than an invented one.
  const partner = getPartnerWorkspace(ws.id);
  const agents = (partner?.referenceAgents ?? []).slice(0, MAX_AGENTS_PER_REQUEST);
  if (agents.length === 0) {
    return NextResponse.json(
      { ok: true, workspaceId: ws.id, chains: [] as ChainRow[] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const now = new Date().toISOString();

  const chains: ChainRow[] = await Promise.all(
    agents.map(async (agent): Promise<ChainRow> => {
      const base = { registryAlias: agent.registryAlias, network: agent.network, label: agent.label };

      const correlated = await correlateAgent(agent.registryAlias, agent.network).catch((e) => ({
        ok: false as const,
        reason: 'transport',
        detail: e instanceof Error ? e.message : String(e),
      }));
      if (!correlated.ok) {
        return { ok: false, ...base, reason: correlated.reason, detail: correlated.detail };
      }
      const record = correlated.record;

      // `readAgentIdentityBindings` returns null when it could not read and []
      // when it read and found none. Passing the result STRAIGHT through is
      // what keeps `binding_unresolvable` and `unbound` distinguishable — a
      // `?? []` here would silently convert every outage into the factual
      // claim that the agent is unattributed.
      const bindings = await readAgentIdentityBindings(record.identity.network, record.identity.tokenId);
      const binding = resolveBinding({ identity: record.identity, bindings, at: now });

      const receiptId = binding.binding?.constitutionalAct.receiptId ?? null;
      let receiptAnchor: ReceiptAnchor = { kind: 'none' };
      if (receiptId) {
        const status = await readReceiptAnchorStatus(receiptId);
        receiptAnchor =
          status === undefined
            ? { kind: 'unreadable', detail: 'the ingestion receipt exists but its anchoring state could not be read' }
            : status === null
              ? { kind: 'none' }
              : { kind: 'read', receiptStatus: status };
      }

      const evidence = buildHorizenEvidence(record, now, {
        binding,
        ingestedAt: now,
        // The receipt's own creation time is not carried on the binding; the
        // anchoring STATE above is what the chain reports, and asserting a
        // timestamp we do not hold would be an invention.
        receiptCreatedAt: null,
      });

      return { ok: true, ...base, chain: projectEvidenceChain({ evidence, binding, receiptAnchor }) };
    }),
  );

  return NextResponse.json(
    { ok: true, workspaceId: ws.id, chains },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
