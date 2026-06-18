/**
 * POST /api/vsp/profiles/[profileId]/generate
 *
 * Generates a reusable output document from the compiled VSP.
 * Output types: biography, executive_biography, speaker_bio, cv,
 *               founder_profile, investor_profile, media_profile,
 *               linkedin_summary, board_biography, capability_assessment
 *
 * Reads compiled vsp_content — profile must be compiled first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { callAnthropicJson, callOpenAiJson } from '@/services/agents/_lib/llmDraftHelper';

export const dynamic = 'force-dynamic';

const OUTPUT_TYPES = [
  'biography',
  'executive_biography',
  'speaker_bio',
  'cv',
  'founder_profile',
  'investor_profile',
  'media_profile',
  'linkedin_summary',
  'board_biography',
  'capability_assessment',
  'mobility_profile_summary',
] as const;

type OutputType = typeof OUTPUT_TYPES[number];

const OUTPUT_INSTRUCTIONS: Record<OutputType, string> = {
  biography: 'Write a professional third-person biography (300-500 words). Cover education, career arc, key achievements, recognition, and current role.',
  executive_biography: 'Write a formal executive biography (400-600 words) suitable for board packs and investor materials. Emphasise leadership track record, strategic roles, and measurable impact.',
  speaker_bio: 'Write a conference speaker biography (150-250 words). Lead with the subject\'s field of expertise, key speaking topics, notable publications or research, and recent talks.',
  cv: 'Draft a structured CV summary. Output JSON with sections: contact_placeholder, summary, education (array), professional_experience (array), publications (array), speaking (array), awards (array), skills (array). Each entry has title, org, date_range, highlights array.',
  founder_profile: 'Write a founder profile (300-400 words) covering ventures built, problems solved, funding raised, exits, and entrepreneurial philosophy. Third person.',
  investor_profile: 'Write an investor profile (250-350 words) covering investment thesis, sectors, portfolio highlights, and advisory roles. Third person.',
  media_profile: 'Write a media profile (200-300 words) for journalists and PR. Cover the subject\'s expertise, media appearances, publications, and contact context. Third person.',
  linkedin_summary: 'Write a first-person LinkedIn summary (200-300 words). Conversational, achievement-forward, ends with a clear professional focus or call to action.',
  board_biography: 'Write a formal board biography (250-350 words) for corporate governance filings. Cover qualifications, board experience, key expertise areas, and current board seats.',
  capability_assessment: 'Write a structured capability assessment. Output JSON: { overall_standing: string, domains: [{ domain, assessment, evidence_strength: "strong"|"moderate"|"limited", key_facts: string[] }], standout_qualifications: string[] }.',
  mobility_profile_summary: 'Write a mobility profile summary (200-300 words) covering the subject\'s international experience, residency/visa history, professional standing in destination markets, and language/cultural assets. For use in HMS Strategic Repatriation Brief inputs.',
};

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

    const body = (await req.json().catch(() => ({}))) as {
      output_type?: string;
      context?: string; // optional operator context (e.g. target role, company name)
    };

    if (!body.output_type || !OUTPUT_TYPES.includes(body.output_type as OutputType)) {
      return NextResponse.json(
        { ok: false, error: `output_type must be one of: ${OUTPUT_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const { data: profile, error: profErr } = await supabase
      .from('vsp_profiles')
      .select('id, label, vsp_content, standing_graph')
      .eq('id', params.profileId)
      .single();

    if (profErr || !profile) {
      return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.vsp_content) {
      return NextResponse.json({ ok: false, error: 'Profile has not been compiled yet' }, { status: 422 });
    }

    const outputType = body.output_type as OutputType;
    const instruction = OUTPUT_INSTRUCTIONS[outputType];

    const isJsonOutput = ['cv', 'capability_assessment'].includes(outputType);

    const systemPrompt = `You are a professional profile writer for the Verified Standing Profile system.

You are generating a "${outputType.replace(/_/g, ' ')}" from verified standing data.

INSTRUCTION: ${instruction}

RULES:
- Use ONLY the facts provided in the VSP data below. Do not invent or infer.
- Do not name specific countries or institutions not mentioned in the VSP.
- Do not fabricate employment dates, salary ranges, or unverified achievements.
- Write in a professional, authoritative register appropriate to the output type.
${isJsonOutput ? '- Output ONLY valid JSON — no preamble, no markdown, no commentary.' : '- Output only the text of the document — no headers about the output type, no preamble.'}`;

    const vspSummary = JSON.stringify(profile.vsp_content, null, 2);
    const graphSummary = profile.standing_graph
      ? `\n\nSTANDING ASSET GRAPH:\n${JSON.stringify(profile.standing_graph, null, 2)}`
      : '';
    const contextNote = body.context ? `\n\nOPERATOR CONTEXT: ${body.context}` : '';

    const userPrompt = `Profile Label: ${profile.label}\n\nVSP DATA:\n${vspSummary}${graphSummary}${contextNote}`;

    let raw = await callAnthropicJson(systemPrompt, userPrompt, 4000);
    if (!raw) raw = await callOpenAiJson(systemPrompt, userPrompt, 4000);

    if (!raw) {
      return NextResponse.json({ ok: false, error: 'Generation failed' }, { status: 502 });
    }

    if (isJsonOutput) {
      try {
        const parsed = JSON.parse(raw);
        return NextResponse.json({ ok: true, output_type: outputType, output: parsed });
      } catch {
        // Return as text if JSON parse fails
        return NextResponse.json({ ok: true, output_type: outputType, output: raw });
      }
    }

    return NextResponse.json({ ok: true, output_type: outputType, output: raw });
  } catch (err) {
    console.error('[vsp/generate POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
