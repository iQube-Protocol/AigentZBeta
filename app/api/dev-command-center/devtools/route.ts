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
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  computeEnvPresence,
  summariseEnv,
  getCanisterSummary,
  getReceiptPipelineState,
} from '@/app/api/dev-command-center/_lib/diagnostics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const envPresence = computeEnvPresence();
  const [canisters, pipeline] = await Promise.all([
    getCanisterSummary(),
    getReceiptPipelineState(persona.personaId, 25),
  ]);

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
      recent: pipeline.recent,
      // The DVN escalation contract (CLAUDE.md): dvn_failed rows are gaps in
      // the provenance trail and are retried via the retry route.
      retryRoute: '/api/assistant/receipts/[receiptId]/retry-dvn',
    },
  });
}
