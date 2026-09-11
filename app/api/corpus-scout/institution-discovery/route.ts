/**
 * /api/corpus-scout/institution-discovery — Constitutional Discovery
 * amendment §4/§5/§9 phase 3: Agent B (institution-targeted navigation) +
 * bounded Agent C (recursive resolution), triggered per ratified
 * Institutional Registry entry. Admin-gated, mirroring
 * `/api/corpus-scout/candidates`'s auth pattern exactly.
 *
 * POST { domain, pillarKey, institutionName } → `runDiscoveryForInstitution`
 * (`discoveryOrchestrator.ts`): resolves the seed URL (steward-provided, or
 * the curated canonical registry — never a search fallback), runs Agent B/C,
 * submits every resolved candidate through the SAME back half a manual URL
 * submission uses.
 *
 * For running every ratified institution in a domain in one call, see
 * `POST /api/corpus-scout/institution-discovery/domain`.
 *
 * Each candidate still lands as `pending_review` (or `needs_retrieval_fix`
 * if retrieval fails) — discovery finds candidates, it never auto-approves
 * them. A steward reviews every one exactly as they would a manually
 * submitted URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { runDiscoveryForInstitution } from '@/services/corpusScout/discoveryOrchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    pillarKey?: string;
    institutionName?: string;
  };
  const domain = body.domain?.trim();
  const pillarKey = body.pillarKey?.trim();
  const institutionName = body.institutionName?.trim();
  if (!domain || !pillarKey || !institutionName) {
    return NextResponse.json({ ok: false, error: 'domain, pillarKey, and institutionName are required' }, { status: 400 });
  }

  const result = await runDiscoveryForInstitution(admin, { domain, pillarKey, institutionName });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
