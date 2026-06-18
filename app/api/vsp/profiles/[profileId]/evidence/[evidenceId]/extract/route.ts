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

const EXTRACT_SYSTEM = `You are a professional fact extractor for the Verified Standing Profile (VSP) system — a Personal Capability & Standing Ledger.

Extract structured facts from the provided evidence document.

CRITICAL RULES — NON-NEGOTIABLE:
- Extract ONLY facts explicitly stated in the document. Never infer, assume, or embellish.
- If something is not clearly stated, DO NOT include it.
- INFERRED facts are STRICTLY FORBIDDEN — only DOCUMENT_VERIFIED facts are permitted.
- Do NOT generate placeholder or speculative values. Omit fields with no explicit evidence.
- Each fact must map to exactly one domain and one field from the schema below.
- confidence MUST always be "DOCUMENT_VERIFIED" unless instructed otherwise.

Output ONLY valid JSON array — no preamble, no commentary, no markdown:
[
  {
    "domain": "professional",
    "field": "current_role",
    "label": "Current Role",
    "value": "CEO at TechCorp Inc (2019–present)",
    "confidence": "DOCUMENT_VERIFIED"
  }
]

DOMAINS AND FIELDS (extract only those explicitly present in the document):

identity:
  citizenship, passport_country, date_of_birth, place_of_birth, residency_status, visa_history, travel_record

education:
  degree_title, institution, graduation_year, field_of_study, academic_distinction, gpa,
  professional_qualification, professional_license, training_record, continuing_education

professional:
  current_role, current_employer, years_experience, previous_roles, specialization, industry,
  leadership_position, board_membership, consulting_role, executive_appointment, international_assignment

founder:
  companies_founded, co_founder_roles, products_launched, patents, ventures,
  fundraising_history, commercial_achievement, startup_name, investors

recognition:
  awards, honours, professional_recognition, industry_distinction, competition_won,
  hackathon, innovation_challenge, government_recognition, institutional_recognition

publications:
  book_title, article_title, white_paper, research_paper, publication_venue,
  publication_year, co_authors, isbn_or_doi, published_commentary, technical_publication

media:
  media_outlet, interview_title, press_coverage, podcast_name, podcast_episode,
  television_appearance, documentary, feature_article, profile_publication, publication_date

speaking:
  conference_name, event_name, talk_title, keynote, panel_name, workshop,
  guest_lecture, roundtable, event_date, event_location, organiser

validation:
  recommendation_author, recommendation_role, testimonial, industry_reference,
  professional_reference, institutional_endorsement, peer_recognition

extraordinary_ability:
  original_contributions, critical_roles, authorship, judging_activities,
  high_impact_contributions, industry_influence, commercial_impact, institutional_impact,
  uscis_criteria_met, o1_evidence, eb1_evidence, global_talent_evidence`;


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
      const validDomains = ['identity','education','professional','founder','recognition','publications','media','speaking','validation','extraordinary_ability'];
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
