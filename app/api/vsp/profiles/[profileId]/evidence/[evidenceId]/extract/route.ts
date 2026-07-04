/**
 * POST /api/vsp/profiles/[profileId]/evidence/[evidenceId]/extract
 *
 * LLM-powered fact extraction from evidence document.
 * Sets extraction_status → extracting, calls LLM, inserts vsp_facts, updates evidence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { extractFactsFromText } from '@/services/standing/extractFacts';

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
      const facts = await extractFactsFromText(evidence.content_text);

      const toInsert = facts.map((f) => ({
        profile_id: params.profileId,
        evidence_id: params.evidenceId,
        domain: f.domain,
        field: f.field,
        label: f.label,
        extracted_value: f.value,
        confidence: ['DOCUMENT_VERIFIED', 'PRINCIPAL_VERIFIED', 'AGENT_VERIFIED', 'UNKNOWN'].includes(f.confidence)
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
