/**
 * POST /api/standing/core-wizard/linkedin — import a LinkedIn profile into
 * Standing Core.
 *
 * Honest integration: there is no LinkedIn OAuth/scrape service in the platform
 * yet (the Nakamoto CRM only tracks a `linkedin_connected` flag and a planned
 * channel adapter). So this ingests the profile the operator provides — a URL +
 * the pasted profile text — as a `linkedin` VSP evidence record on the Standing
 * Core profile, runs the SAME fact-extraction the Standing cartridge uses, and
 * returns suggested wizard answers mapped from the extracted facts. When a real
 * LinkedIn fetch lands, only the text-acquisition step changes.
 *
 * Body: { url?: string; profileText: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { ensureCoreProfile, type StandingCoreAnswers } from '@/services/standing/standingCore';
import { extractFactsFromText, type ExtractedFact } from '@/services/standing/extractFacts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LINKEDIN_EVIDENCE_LABEL = 'LinkedIn profile';

/** Group extracted facts into suggested Standing Core answer text. */
function mapFactsToAnswers(facts: ExtractedFact[]): StandingCoreAnswers {
  const pick = (domains: string[], fields?: string[]) =>
    facts
      .filter((f) => domains.includes(f.domain) && (!fields || fields.includes(f.field)))
      .map((f) => f.value)
      .filter(Boolean);

  const role = pick(['professional'], ['current_role', 'current_employer']);
  const know = pick(['professional'], ['specialization', 'industry', 'years_experience']).concat(
    pick(['education'], ['degree_title', 'field_of_study', 'professional_qualification']),
  );
  const done = pick(['professional'], ['previous_roles', 'leadership_position', 'board_membership', 'executive_appointment']).concat(
    pick(['founder']),
  );
  const experiences = pick(['recognition']).concat(pick(['publications']), pick(['speaking']), pick(['media']));

  const join = (xs: string[]) => Array.from(new Set(xs)).join('\n');
  const answers: StandingCoreAnswers = {};
  if (role.length) answers.whoYouAre = join(role);
  if (know.length) answers.whatYouKnow = join(know);
  if (done.length) answers.whatYouveDone = join(done);
  if (experiences.length) answers.experiencesThatMatter = join(experiences);
  return answers;
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { url?: string; profileText?: string };
  const profileText = (body.profileText ?? '').trim();
  const url = (body.url ?? '').trim();
  if (!profileText) {
    return NextResponse.json(
      { ok: false, error: 'Paste your LinkedIn profile text to import (an automatic fetch is not yet wired).' },
      { status: 400 },
    );
  }

  try {
    const profileId = await ensureCoreProfile(admin, persona.personaId);
    const contentText = url ? `LinkedIn: ${url}\n\n${profileText}` : profileText;
    const nowIso = new Date().toISOString();

    // Upsert the LinkedIn evidence record (idempotent by label).
    const { data: existing } = await admin
      .from('vsp_evidence')
      .select('id')
      .eq('profile_id', profileId)
      .eq('label', LINKEDIN_EVIDENCE_LABEL)
      .maybeSingle();

    let evidenceId: string;
    if (existing?.id) {
      evidenceId = existing.id as string;
      await admin.from('vsp_facts').delete().eq('evidence_id', evidenceId);
      await admin
        .from('vsp_evidence')
        .update({ content_text: contentText, extraction_status: 'extracting', extracted_at: nowIso })
        .eq('id', evidenceId);
    } else {
      const { data: ev, error: evErr } = await admin
        .from('vsp_evidence')
        .insert({
          profile_id: profileId,
          source_type: 'linkedin',
          label: LINKEDIN_EVIDENCE_LABEL,
          content_text: contentText,
          extraction_status: 'extracting',
        })
        .select('id')
        .single();
      if (evErr) throw evErr;
      evidenceId = ev!.id as string;
    }

    const facts = await extractFactsFromText(contentText);
    if (facts.length > 0) {
      await admin.from('vsp_facts').insert(
        facts.map((f) => ({
          profile_id: profileId,
          evidence_id: evidenceId,
          domain: f.domain,
          field: f.field,
          label: f.label,
          extracted_value: f.value,
          confidence: 'DOCUMENT_VERIFIED',
          status: 'approved',
          approved_at: nowIso,
        })),
      );
    }
    await admin
      .from('vsp_evidence')
      .update({ extraction_status: 'extracted', extracted_fact_count: facts.length, extracted_at: nowIso })
      .eq('id', evidenceId);

    return NextResponse.json({
      ok: true,
      profileId,
      factsExtracted: facts.length,
      suggested: mapFactsToAnswers(facts),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'LinkedIn import failed' },
      { status: 500 },
    );
  }
}
