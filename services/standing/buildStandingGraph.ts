/**
 * buildStandingGraph — shared Standing Asset Graph builder.
 *
 * Reads a profile's approved/corrected vsp_facts, asks the LLM to derive
 * capability claims + supporting edges, and persists the result to
 * vsp_profiles.standing_graph. Used by BOTH the VSP graph route (manual
 * cartridge flow) and the Standing Core wizard orchestrator so the two
 * surfaces stay at parity (extend, don't duplicate).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { stripJsonFences } from '@/services/agents/_lib/llmDraftHelper';
import { callSovereign } from '@/services/constitutional/modelRouter';

export const STANDING_GRAPH_SYSTEM = `You are a capability graph builder for the Verified Standing Profile system.

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

export type BuildStandingGraphResult =
  | { ok: true; graph: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export async function buildStandingGraph(
  supabase: SupabaseClient,
  profileId: string,
): Promise<BuildStandingGraphResult> {
  const { data: facts, error: factsErr } = await supabase
    .from('vsp_facts')
    .select('domain, field, label, extracted_value, principal_value, confidence, status')
    .eq('profile_id', profileId)
    .in('status', ['approved', 'corrected']);

  if (factsErr) return { ok: false, status: 500, error: factsErr.message };
  if (!facts || facts.length === 0) {
    return { ok: false, status: 422, error: 'No approved facts to build graph from' };
  }

  const grouped: Record<string, unknown[]> = {};
  for (const f of facts) {
    (grouped[f.domain] ??= []).push({
      field: f.field,
      label: f.label,
      value: f.status === 'corrected' && f.principal_value ? f.principal_value : f.extracted_value,
      confidence: f.confidence,
    });
  }

  const userPrompt = `Build a Standing Asset Graph from these verified facts:\n\n${JSON.stringify(grouped, null, 2)}`;

  // Invariant-aware, sovereign inference (CFS-015 Phase 2): 'analysis' routes to
  // the consequence stage (the same claude-sonnet-4-6 used here) via the
  // ModelQube route, with the sovereign fallback ladder down to the open-weight
  // floor on frontier outage. Fence stripping preserved.
  const result = await callSovereign('analysis', STANDING_GRAPH_SYSTEM, userPrompt, 3000).catch(() => null);
  const raw = result?.text ? stripJsonFences(result.text) : null;
  if (!raw) return { ok: false, status: 502, error: 'Graph generation failed' };

  let graph: unknown;
  try {
    graph = JSON.parse(raw);
  } catch {
    return { ok: false, status: 502, error: 'Failed to parse graph response' };
  }

  const standing_graph = { built_at: new Date().toISOString(), ...((graph as object) ?? {}) };
  await supabase.from('vsp_profiles').update({ standing_graph }).eq('id', profileId);
  return { ok: true, graph: standing_graph };
}
