/**
 * /api/corpus-scout/institution-discovery/domain — Constitutional Discovery
 * amendment §4/§5/§9 phase 3, domain-wide entry point: run Agent B/C across
 * EVERY ratified institution in a domain in one call. This is the "just run
 * it for financial-services" action — no per-institution clicking, and no
 * manual URL entry for any institution the curated canonical registry
 * already resolves (`ensureInstitutionSeedUrl`, applied per institution by
 * `runDiscoveryForDomain`).
 *
 * POST { domain } → `runDiscoveryForDomain` (`discoveryOrchestrator.ts`),
 * admin-gated identically to the single-institution route.
 *
 * Runs institutions sequentially (bounded pages/candidates per institution
 * already; sequential keeps total outbound request volume predictable
 * rather than bursting many external sites at once). A domain with many
 * ratified institutions can take longer than a typical request — maxDuration
 * is raised accordingly. No background queue is introduced in this pass;
 * that infrastructure is out of scope until it's actually needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { runDiscoveryForDomain } from '@/services/corpusScout/discoveryOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { domain?: string };
  const domain = body.domain?.trim();
  if (!domain) return NextResponse.json({ ok: false, error: 'domain is required' }, { status: 400 });

  const result = await runDiscoveryForDomain(admin, domain);
  return NextResponse.json(result);
}
