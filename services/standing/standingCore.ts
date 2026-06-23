/**
 * standingCore — the Standing Core wizard backend.
 *
 * Standing Core is the citizen's attestation surface: they declare who they
 * are, what they know, what they've done, their interests, intentions, the
 * experiences that matter, and what they want to accomplish. Those answers are
 * written as PRINCIPAL_VERIFIED, self-attested vsp_facts under a dedicated
 * "Standing Core" profile, from which the Standing Asset Graph (capability
 * graph) is derived.
 *
 * This is the guided counterpart to the manual evidence-intake flow in the
 * Standing cartridge — both write the same vsp_* substrate, so the cartridge
 * and aigentMe stay at parity.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface StandingCoreAnswers {
  whoYouAre?: string;
  whatYouKnow?: string;
  whatYouveDone?: string;
  interests?: string;
  intentions?: string;
  experiencesThatMatter?: string;
  accomplish?: string;
}

/** The 7 Standing Core questions mapped to vsp_fact (domain, field, label).
 *  Domains are restricted to the base CHECK set (identity/professional/founder). */
export const STANDING_CORE_FIELDS: Array<{
  key: keyof StandingCoreAnswers;
  domain: 'identity' | 'professional' | 'founder';
  field: string;
  label: string;
  question: string;
}> = [
  { key: 'whoYouAre',             domain: 'identity',     field: 'self_description',       label: 'Who you are',                 question: 'Who are you?' },
  { key: 'whatYouKnow',           domain: 'professional', field: 'knowledge',              label: 'What you know',               question: 'What do you know?' },
  { key: 'whatYouveDone',         domain: 'professional', field: 'track_record',           label: 'What you have done',          question: 'What have you done?' },
  { key: 'interests',             domain: 'identity',     field: 'interests',              label: 'Your interests',              question: 'What are your interests?' },
  { key: 'intentions',           domain: 'founder',      field: 'intent',                 label: 'Your intentions',             question: 'What are your intentions?' },
  { key: 'experiencesThatMatter', domain: 'professional', field: 'formative_experiences',  label: 'Experiences that matter',     question: 'What experiences matter to you?' },
  { key: 'accomplish',            domain: 'founder',      field: 'aspirations',            label: 'What you want to accomplish', question: 'What would you like to accomplish?' },
];

const CORE_PROFILE_LABEL = 'Standing Core';
const CORE_EVIDENCE_LABEL = 'Standing Core self-attestation';

/** Find (or create) the persona's Standing Core profile. */
export async function ensureCoreProfile(
  supabase: SupabaseClient,
  personaId: string,
): Promise<string> {
  // Reuse the EARLIEST existing Standing Core profile. We intentionally avoid
  // .maybeSingle() here: if a duplicate "Standing Core" ever exists (e.g. a
  // manually-created profile plus an auto-created one), maybeSingle() errors on
  // >1 rows and the caller would then create yet another duplicate. order +
  // limit(1) always converges on one profile and never spawns more.
  const { data: existingRows } = await supabase
    .from('vsp_profiles')
    .select('id')
    .eq('owner_persona_id', personaId)
    .eq('label', CORE_PROFILE_LABEL)
    .order('created_at', { ascending: true })
    .limit(1);
  if (existingRows && existingRows.length > 0) return existingRows[0].id as string;

  const { data: created, error } = await supabase
    .from('vsp_profiles')
    .insert({ owner_persona_id: personaId, label: CORE_PROFILE_LABEL, profile_type: 'general' })
    .select('id')
    .single();
  if (error) throw error;
  return created!.id as string;
}

export interface SaveStandingCoreResult {
  profileId: string;
  factCount: number;
}

/**
 * Persist the wizard answers as self-attested facts. Idempotent: re-running
 * replaces the self-attestation fact set (it never touches facts extracted from
 * other, document-backed evidence).
 */
export async function saveStandingCore(
  supabase: SupabaseClient,
  personaId: string,
  answers: StandingCoreAnswers,
): Promise<SaveStandingCoreResult> {
  const profileId = await ensureCoreProfile(supabase, personaId);

  // Ensure the self-attestation evidence record.
  const { data: existingEv } = await supabase
    .from('vsp_evidence')
    .select('id')
    .eq('profile_id', profileId)
    .eq('label', CORE_EVIDENCE_LABEL)
    .maybeSingle();

  const answered = STANDING_CORE_FIELDS
    .map((f) => ({ ...f, value: (answers[f.key] ?? '').trim() }))
    .filter((f) => f.value.length > 0);

  const contentText = answered.map((f) => `${f.question}\n${f.value}`).join('\n\n');
  const nowIso = new Date().toISOString();

  let evidenceId: string;
  if (existingEv?.id) {
    evidenceId = existingEv.id as string;
    // Replace prior self-attested facts for this evidence.
    await supabase.from('vsp_facts').delete().eq('evidence_id', evidenceId);
    await supabase
      .from('vsp_evidence')
      .update({
        content_text: contentText,
        extraction_status: 'extracted',
        extracted_fact_count: answered.length,
        extracted_at: nowIso,
      })
      .eq('id', evidenceId);
  } else {
    const { data: ev, error: evErr } = await supabase
      .from('vsp_evidence')
      .insert({
        profile_id: profileId,
        source_type: 'other',
        label: CORE_EVIDENCE_LABEL,
        content_text: contentText,
        extraction_status: 'extracted',
        extracted_fact_count: answered.length,
        extracted_at: nowIso,
      })
      .select('id')
      .single();
    if (evErr) throw evErr;
    evidenceId = ev!.id as string;
  }

  if (answered.length > 0) {
    const rows = answered.map((f) => ({
      profile_id: profileId,
      evidence_id: evidenceId,
      domain: f.domain,
      field: f.field,
      label: f.label,
      extracted_value: f.value,
      confidence: 'PRINCIPAL_VERIFIED',
      status: 'approved',
      approved_at: nowIso,
    }));
    const { error: insErr } = await supabase.from('vsp_facts').insert(rows);
    if (insErr) throw insErr;
  }

  return { profileId, factCount: answered.length };
}

export interface StandingCoreSnapshot {
  hasProfile: boolean;
  profileId: string | null;
  answers: StandingCoreAnswers;
  graphBuiltAt: string | null;
  capabilityClaimCount: number;
}

/** Read back the persona's Standing Core answers (from self-attested facts). */
export async function readStandingCore(
  supabase: SupabaseClient,
  personaId: string,
): Promise<StandingCoreSnapshot> {
  const { data: profile } = await supabase
    .from('vsp_profiles')
    .select('id, standing_graph')
    .eq('owner_persona_id', personaId)
    .eq('label', CORE_PROFILE_LABEL)
    .maybeSingle();

  if (!profile?.id) {
    return { hasProfile: false, profileId: null, answers: {}, graphBuiltAt: null, capabilityClaimCount: 0 };
  }

  const { data: facts } = await supabase
    .from('vsp_facts')
    .select('field, extracted_value, principal_value, status')
    .eq('profile_id', profile.id);

  const byField = new Map<string, string>();
  for (const f of facts ?? []) {
    const v = f.status === 'corrected' && f.principal_value ? f.principal_value : f.extracted_value;
    if (typeof v === 'string') byField.set(f.field as string, v);
  }

  const answers: StandingCoreAnswers = {};
  for (const f of STANDING_CORE_FIELDS) {
    const v = byField.get(f.field);
    if (v) answers[f.key] = v;
  }

  const graph = (profile.standing_graph ?? null) as { built_at?: string; capability_claims?: unknown[] } | null;
  return {
    hasProfile: true,
    profileId: profile.id as string,
    answers,
    graphBuiltAt: graph?.built_at ?? null,
    capabilityClaimCount: Array.isArray(graph?.capability_claims) ? graph!.capability_claims!.length : 0,
  };
}
