/**
 * GET /api/dev-command-center/devtools — the DevTools instrument cluster
 * (CFS-020 CDE). ONE aggregator that composes the existing admin diagnostics
 * (env presence, canister health, receipts/DVN pipeline state) — it imports the
 * callable probe fns from _lib/diagnostics; it never forks probe logic.
 *
 * Admin-gated (getActivePersona + cartridgeFlags.isAdmin). Env VALUES and T0
 * identifiers never appear — env is presence-only, receipts are T2-safe fields.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolvePersonaOrTimeout, PERSONA_TIMEOUT_MESSAGE } from '@/app/api/dev-command-center/_lib/persona';
import {
  computeEnvPresence,
  summariseEnv,
  getCanisterSummary,
  getReceiptPipelineState,
  getDvnTelemetry,
  buildEscalationLog,
  DVN_RETRY_ROUTE,
} from '@/app/api/dev-command-center/_lib/diagnostics';
import { recentServerCalls, recordServerCall, SERVER_CALL_BUFFER_CAP } from '@/services/devCommandCenter/requestTelemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const t0 = Date.now();
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  }
  if (pr.status === 'unauthenticated') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const persona = pr.persona;
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const envPresence = computeEnvPresence();
  const [canisters, pipeline, dvn] = await Promise.all([
    getCanisterSummary(),
    getReceiptPipelineState(persona.personaId, 50),
    getDvnTelemetry(),
  ]);
  const escalationLog = buildEscalationLog(pipeline);

  recordServerCall({ method: 'GET', path: '/api/dev-command-center/devtools', status: 200, ms: Date.now() - t0 });

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    environment: {
      ...summariseEnv(envPresence),
      // presence booleans only — never values
      vars: envPresence,
    },
    canisters,
    receipts: {
      total: pipeline.total,
      byStatus: pipeline.byStatus,
      recent: pipeline.recent.slice(0, 25),
      // The DVN escalation contract (CLAUDE.md): dvn_failed rows are gaps in
      // the provenance trail and are retried via the retry route.
      retryRoute: DVN_RETRY_ROUTE,
    },
    // Platform telemetry — the server↔canister↔DVN "Network" view F12 can't reach.
    platformTelemetry: {
      dvn,
      requestBuffer: {
        // HONEST LIMIT: this compute instance only — resets on cold start.
        instanceOnly: true,
        cap: SERVER_CALL_BUFFER_CAP,
        calls: recentServerCalls(50),
      },
    },
    // DB-durable escalation log — NOT a raw server log tail (CloudWatch is a follow-on).
    escalationLog,
  });
}
