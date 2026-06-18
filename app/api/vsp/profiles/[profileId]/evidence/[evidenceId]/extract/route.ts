/**
 * POST /api/vsp/profiles/[profileId]/evidence/[evidenceId]/extract
 *
 * LLM-powered fact extraction from evidence document.
 * Sets extraction_status → extracting, calls LLM, inserts vsp_facts, updates evidence.
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

interface ExtractedFact {
  domain: string;
  field: string;
  label: string;
  value: string;
  confidence: string;
}

const EXTRACT_SYSTEM = `You are a professional fact extractor for the Verified Standing Profile system.

Extract structured facts from the provided evidence document.

CRITICAL RULES:
- Extract ONLY facts explicitly stated in the document. Never infer or assume.
- If something is not clearly stated, DO NOT include it.
- Do NOT generate UNKNOWN facts — omit fields with no evidence.
- INFERRED facts are FORBIDDEN — only DOCUMENT_VERIFIED facts.
- Each fact must map to exactly one domain and field.

Output ONLY valid JSON array:
[
  {
    "domain": "professional",
    "field": "currentRole",
    "label": "Current Role",
    "value": "CEO at TechCorp Inc (2019–present)",
    "confidence": "DOCUMENT_VERIFIED"
  }
]

Domains and fields to extract (extract only those present in document):

identity: citizenship, passport_country, date_of_birth, place_of_birth, residency_status
education: degree_title, institution, graduation_year, field_of_study, academic_distinction, gpa
professional: current_role, current_employer, years_experience, previous_roles, specialization, industry
founder: companies_founded, co_founder_roles, board_positions, products_launched, patents, innovations
recognition: awards, media_coverage, publications, books, speaking_engagements, professional_memberships
validation: recommendation_letters, expert_testimonials, industry_references, institutional_endorsements
extraordinary_ability: original_contributions, critical_roles, authorship, judging_roles, commercial_impact, uscis_criteria_met`;

export async function POST(
  req: NextRequest,
  { params }: { params: { profileId: string; evidenceId: string } },
) {
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

    // Fetch the evidence item
    const { data: evidence, error: evErr } = await supabase
      .from('vsp_evidence')
      .select('id, content_text, extraction_status')
      .eq('id', params.evidenceId)
      .eq('profile_id', params.profileId)
      .single();

    if (evErr || !evidence) {
      return NextResponse.json({ ok: false, error: 'Evidence not found' }, { status: 404 });
    }

    if (!evidence.content_text?.trim()) {
      return NextResponse.json({ ok: false, error: 'Evidence has no content to extract from' }, { status: 422 });
    }

    // Set to extracting
    await supabase
      .from('vsp_evidence')
      .update({ extraction_status: 'extracting' })
      .eq('id', params.evidenceId);

    try {
      const userPrompt = `Extract facts from the following evidence document:\n\n${evidence.content_text}`;
      let raw = await callAnthropicJson(EXTRACT_SYSTEM, userPrompt, 2000);
      if (!raw) raw = await callOpenAiJson(EXTRACT_SYSTEM, userPrompt, 2000);

      if (!raw) {
        await supabase
          .from('vsp_evidence')
          .update({ extraction_status: 'failed' })
          .eq('id', params.evidenceId);
        return NextResponse.json({ ok: false, error: 'LLM extraction failed' }, { status: 502 });
      }

      let facts: ExtractedFact[] = [];
      try {
        facts = JSON.parse(raw);
        if (!Array.isArray(facts)) facts = [];
      } catch {
        await supabase
          .from('vsp_evidence')
          .update({ extraction_status: 'failed' })
          .eq('id', params.evidenceId);
        return NextResponse.json({ ok: false, error: 'Failed to parse LLM response' }, { status: 502 });
      }

      // Insert facts
      const validDomains = ['identity','education','professional','founder','recognition','validation','extraordinary_ability'];
      const toInsert = facts
        .filter(f => f.domain && f.field && f.label && f.value && validDomains.includes(f.domain))
        .map(f => ({
          profile_id: params.profileId,
          evidence_id: params.evidenceId,
          domain: f.domain,
          field: f.field,
          label: f.label,
          extracted_value: f.value,
          confidence: ['DOCUMENT_VERIFIED','PRINCIPAL_VERIFIED','AGENT_VERIFIED','UNKNOWN'].includes(f.confidence)
            ? f.confidence
            : 'DOCUMENT_VERIFIED',
          status: 'pending',
        }));

      if (toInsert.length > 0) {
        await supabase.from('vsp_facts').insert(toInsert);
      }

      await supabase
        .from('vsp_evidence')
        .update({
          extraction_status: 'extracted',
          extracted_fact_count: toInsert.length,
          extracted_at: new Date().toISOString(),
        })
        .eq('id', params.evidenceId);

      return NextResponse.json({ ok: true, facts_extracted: toInsert.length });
    } catch (innerErr) {
      await supabase
        .from('vsp_evidence')
        .update({ extraction_status: 'failed' })
        .eq('id', params.evidenceId);
      throw innerErr;
    }
  } catch (err) {
    console.error('[vsp/evidence/extract POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
