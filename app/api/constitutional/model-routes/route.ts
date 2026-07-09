/**
 * GET /api/constitutional/model-routes — the routing-transparency instrument
 * for the Chrysalis Phase 2 invariant-aware Model Router (CFS-015 Strand One +
 * Strand Two Phase Two). READ-ONLY: it reflects the current routing decision for
 * every reasoning stage and the ModelQube registry that governs it. It NEVER
 * mutates a route and NEVER exposes a secret.
 *
 * Routing transparency IS sovereignty (inv.sovereignty.102 — the operator
 * chooses): the operator must SEE how each stage is routed, by which ModelQube,
 * under which governing invariants, and where the open-weight sovereign floor
 * sits. This route composes the router's own `describeRoutes()` and the
 * ModelQube registry — it imports the callable diagnostics fns, it never forks
 * routing logic.
 *
 * Admin-gated (resolvePersonaOrTimeout + cartridgeFlags.isAdmin), mirroring
 * /api/dev-command-center/devtools: 503 on identity-spine timeout, 401 when
 * unauthenticated, 403 for a non-admin persona.
 *
 * T2-SAFE: only provider ids, model ids, tiers, standing, and invariant ids are
 * serialised. NO API keys, NO env values, NO secrets — env-name-identical to the
 * router but the router's private inputs never leave the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import { describeRoutes } from '@/services/constitutional/modelRouter';
import {
  CONSTITUTIONAL_MODEL_QUBES,
  MODEL_ROUTING_INVARIANTS,
} from '@/services/constitutional/modelQube';
import { sovereignNodeConfig } from '@/services/constitutional/sovereignNode';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  }
  if (pr.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!pr.persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Per-stage routing decision — straight from the router's own diagnostics.
  // T2-safe: StageRoute carries only provider/model/source/invariants/floor.
  const stages = describeRoutes().map((r) => ({
    stage: r.stage,
    provider: r.provider,
    model: r.model,
    source: r.source,
    sovereignFloor: r.sovereignFloor ?? false,
    governingInvariants: r.governingInvariants ?? [],
  }));

  // The ModelQube registry that governs routing — the constitutional objects
  // over which the invariant-aware policy ranks. T2-safe projection only: no
  // authority internals, no ownership secrets — id, provider/model, tier,
  // standing band, sovereign-floor flag, per-stage fitness.
  const registry = CONSTITUTIONAL_MODEL_QUBES.map((q) => ({
    id: q.identity.id,
    ref: q.identity.ref,
    displayLabel: q.identity.displayLabel,
    provider: q.payload.provider,
    model: q.payload.model,
    tier: q.payload.tier,
    standing: q.standing.standing,
    standingBand: q.standing.band,
    sovereignFloor: q.payload.sovereignFloor,
    stubbed: q.payload.stubbed === true,
    stubReason: q.payload.stubReason ?? null,
    stageFitness: q.payload.stageFitness,
  }));

  // Apex sovereignty status (CFS-018): the self-hosted node seam. T2-safe —
  // only whether an apex node is configured + its model/tier, NEVER the base URL
  // or key (those are the router's private inputs). `configured: false` today
  // (stub, no node deployed) means the sovereign floor is the third-party
  // open-weight API (venice); `true` means it is our own decentralised infra.
  const node = sovereignNodeConfig();
  const sovereignNode = {
    configured: node !== null,
    tier: 'self-hosted' as const,
    model: node?.model ?? null,
    floor: node !== null ? ('self-hosted' as const) : ('open-weight' as const),
  };

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    readOnly: true,
    // The invariants cited on every ModelQube-sourced route — the constitutional
    // basis of the routing decision (routing is constitutional data, not a literal).
    routingInvariants: [...MODEL_ROUTING_INVARIANTS],
    sovereignNode,
    stages,
    registry,
  });
}
