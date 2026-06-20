/**
 * POST /api/vsp/profiles/[profileId]/graph
 *
 * Builds the Standing Asset Graph from compiled + approved facts.
 * Graph structure: nodes (evidence items + capability claims) + edges (evidence → claim).
 * Saves to vsp_profiles.standing_graph.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { callAnthropicJson, callOpenAiJson } from '@/services/agents/_lib/llmDraftHelper';

export const dynamic = 'force-dynamic';

async function canAccess(
  personaId: string,
  profileId: string,
  isAdmin: boolean,
  supabase: ReturnType<typeof getSupabaseServer>,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data } = await supabase
    .from('vsp_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('owner_persona_id', personaId)
    .maybeSingle();
  return !!data;
}

const GRAPH_SYSTEM = `You are a capability graph builder for the Verified Standing Profile system.

Given a set of verified facts grouped by domain, build a Standing Asset Graph.

The graph identifies CAPABILITY CLAIMS supported by evidence nodes.

Output ONLY valid JSON with this exact structure:
{
  "capability_claims": [
    {
      "id": "claim_1",
      "label": "Demonstrated international entrepreneurial leadership",
      "category": "founder",
      "confidence_level": "high",
      "supporting_evidence_count": 3
    }
  ],
  "edges": [
    {
      "from_domain": "founder",
      "from_field": "companies_founded",
      "to_claim_id": "claim_1",
      "weight": 5,
      "rationale": "Multiple companies founded across two continents"
    }
  ]
}

RULES:
- Generate only claims directly supported by the provided facts.
- Do NOT invent or infer claims without factual support.
- weight is 1-5 (5 = very strong support).
- confidence_level is "high" (3+ facts), "medium" (2 facts), or "low" (1 fact).
- Each capability claim must have at least one supporting edge.
- Categories: founder, professional, academic, recognition, publications, media, speaking, extraordinary_ability, identity`;

export async function POST(req: NextRequest, { params }: { params: { profileId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    if (!(await canAccess(persona.personaId, params.profileId, isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    // Fetch approved/corrected facts
    const { data: facts, error: factsErr } = await supabase
      .from('vsp_facts')
      .select('domain, field, label, extracted_value, principal_value, confidence, status')
      .eq('profile_id', params.profileId)
      .in('status', ['approved', 'corrected']);

    if (factsErr) throw factsErr;
    if (!facts || facts.length === 0) {
      return NextResponse.json({ ok: false, error: 'No approved facts to build graph from' }, { status: 422 });
    }

    // Group facts by domain for the prompt
    const grouped: Record<string, unknown[]> = {};
    for (const f of facts) {
      if (!grouped[f.domain]) grouped[f.domain] = [];
      grouped[f.domain].push({
        field: f.field,
        label: f.label,
        value: f.status === 'corrected' && f.principal_value ? f.principal_value : f.extracted_value,
        confidence: f.confidence,
      });
    }

    const userPrompt = `Build a Standing Asset Graph from these verified facts:\n\n${JSON.stringify(grouped, null, 2)}`;

    let raw = await callAnthropicJson(GRAPH_SYSTEM, userPrompt, 3000);
    if (!raw) raw = await callOpenAiJson(GRAPH_SYSTEM, userPrompt, 3000);

    if (!raw) {
      return NextResponse.json({ ok: false, error: 'Graph generation failed' }, { status: 502 });
    }

    let graph: unknown;
    try {
      graph = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: 'Failed to parse graph response' }, { status: 502 });
    }

    const builtAt = new Date().toISOString();
    const standing_graph = { built_at: builtAt, ...((graph as object) ?? {}) };

    await supabase
      .from('vsp_profiles')
      .update({ standing_graph })
      .eq('id', params.profileId);

    return NextResponse.json({ ok: true, graph: standing_graph });
  } catch (err) {
    console.error('[vsp/graph POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
