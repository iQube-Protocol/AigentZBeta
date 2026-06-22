/**
 * extractFacts — shared LLM fact-extraction for the Verified Standing Profile.
 *
 * Pulls DOCUMENT_VERIFIED facts out of an evidence document. Used by the VSP
 * evidence extract route (manual cartridge flow) AND the Standing Core wizard's
 * LinkedIn import, so both surfaces extract identically (extend, don't
 * duplicate).
 */

import { callAnthropicJson, callOpenAiJson } from '@/services/agents/_lib/llmDraftHelper';

export interface ExtractedFact {
  domain: string;
  field: string;
  label: string;
  value: string;
  confidence: string;
}

export const VALID_FACT_DOMAINS = [
  'identity', 'education', 'professional', 'founder', 'recognition',
  'publications', 'media', 'speaking', 'validation', 'extraordinary_ability',
];

export const EXTRACT_SYSTEM = `You are a professional fact extractor for the Verified Standing Profile (VSP) system — a Personal Capability & Standing Ledger.

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

/** Extract + validate facts from raw evidence text. Returns [] on failure. */
export async function extractFactsFromText(content: string): Promise<ExtractedFact[]> {
  if (!content?.trim()) return [];
  const userPrompt = `Extract facts from the following evidence document:\n\n${content}`;
  let raw = await callAnthropicJson(EXTRACT_SYSTEM, userPrompt, 2000);
  if (!raw) raw = await callOpenAiJson(EXTRACT_SYSTEM, userPrompt, 2000);
  if (!raw) return [];
  let facts: ExtractedFact[] = [];
  try {
    facts = JSON.parse(raw);
    if (!Array.isArray(facts)) return [];
  } catch {
    return [];
  }
  return facts.filter(
    (f) => f.domain && f.field && f.label && f.value && VALID_FACT_DOMAINS.includes(f.domain),
  );
}
