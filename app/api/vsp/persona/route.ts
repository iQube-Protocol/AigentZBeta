/**
 * GET /api/vsp/persona
 *
 * Returns the active persona's primary VSP profile summary for spine
 * consumers — Polity Passport credential view, aigentMe, metaMe surface.
 *
 * This is the canonical T1 surface for VSP persona integration.
 * It does NOT modify getActivePersona (spine is read-only per CLAUDE.md).
 *
 * Returns:
 *  - primaryProfile: { id, label, compiled_at, fact_count, domains[], kybe_did_public_ref }
 *  - profileCount: total active profiles for the persona
 *  - hasCompiledVsp: boolean — quick gate for UI surfaces
 *
 * T0 discipline: owner_persona_id never serialised.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();

    // Fetch active profiles for this persona (most recently compiled first)
    const { data: profiles, error } = await supabase
      .from('vsp_profiles')
      .select('id, label, profile_type, status, compiled_at, vsp_content, standing_graph, kybe_did_public_ref, persona_public_ref, created_at')
      .eq('owner_persona_id', persona.personaId)
      .eq('status', 'active')
      .order('compiled_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    const active = profiles ?? [];

    // Primary profile — first compiled, or most recently created
    const compiled = active.filter(p => p.compiled_at);
    const primary = compiled[0] ?? active[0] ?? null;

    let primarySummary = null;
    if (primary) {
      const content = primary.vsp_content as Record<string, unknown> | null;
      const domains = content?.domains ? Object.keys(content.domains as object) : [];
      const factCount = domains.reduce((sum: number, domain: string) => {
        const domainFacts = (content?.domains as Record<string, unknown[]>)[domain];
        return sum + (Array.isArray(domainFacts) ? domainFacts.length : 0);
      }, 0);

      const graph = primary.standing_graph as { capability_claims?: unknown[] } | null;

      primarySummary = {
        id: primary.id,
        label: primary.label,
        profileType: primary.profile_type,
        compiledAt: primary.compiled_at,
        factCount,
        domains,
        capabilityClaimCount: graph?.capability_claims?.length ?? 0,
        anchoredToPassport: !!primary.kybe_did_public_ref,
        kybeDidPublicRef: primary.kybe_did_public_ref ?? null,
      };
    }

    return NextResponse.json({
      ok: true,
      primaryProfile: primarySummary,
      profileCount: active.length,
      hasCompiledVsp: compiled.length > 0,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[vsp/persona GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
