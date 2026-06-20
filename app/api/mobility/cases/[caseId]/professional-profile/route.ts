/**
 * GET/PATCH /api/mobility/cases/[caseId]/professional-profile
 * POST      /api/mobility/cases/[caseId]/professional-profile/extract
 *
 * Professional Profile — source-derived structured facts with principal approval.
 *
 * Doctrine (Deterministic Case Model):
 *   Source layer     → sourceDocuments[] (LinkedIn URL, CV paste, patent record, etc.)
 *   Extraction layer → SOURCE_DERIVED facts (LLM-extracted, not yet verified)
 *   Validation layer → principal reviews and approves each fact
 *   Locked profile   → PRINCIPAL_VERIFIED facts used in SRB and IES
 *
 * LLM extraction produces candidate facts only — they are never used directly.
 * Facts become operational only when principalApproved = true.
 *
 * T0 discipline: caseId server-side only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { callAnthropicJson, callOpenAiJson } from '@/services/agents/_lib/llmDraftHelper';

export const dynamic = 'force-dynamic';

async function canAccess(
  personaId: string,
  caseId: string,
  isAdmin: boolean,
  supabase: ReturnType<typeof getSupabaseServer>,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data } = await supabase
    .from('mobility_cases')
    .select('id')
    .eq('id', caseId)
    .eq('owner_persona_id', personaId)
    .maybeSingle();
  return !!data;
}

/** GET — return current professional_profile from capability_profile.professionalProfile */
export async function GET(req: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    const { data } = await supabase
      .from('mobility_cases')
      .select('capability_profile')
      .eq('id', params.caseId)
      .single();

    const cap = (data?.capability_profile as Record<string, unknown>) ?? {};
    return NextResponse.json({ ok: true, professionalProfile: cap.professionalProfile ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

/** PATCH — save updated professionalProfile back into capability_profile */
export async function PATCH(req: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({})) as { professionalProfile?: unknown };
    if (!body.professionalProfile) return NextResponse.json({ ok: false, error: 'professionalProfile required' }, { status: 400 });

    // Merge into capability_profile JSONB
    const { data: current } = await supabase
      .from('mobility_cases')
      .select('capability_profile')
      .eq('id', params.caseId)
      .single();

    const existing = (current?.capability_profile as Record<string, unknown>) ?? {};
    const updated = { ...existing, professionalProfile: body.professionalProfile };

    const { error } = await supabase
      .from('mobility_cases')
      .update({ capability_profile: updated })
      .eq('id', params.caseId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

/** POST — extract structured facts from source text (SOURCE_DERIVED confidence) */
export async function POST(req: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({})) as {
      source_type?: string;
      source_url?: string;
      source_text?: string;
    };

    if (!body.source_text?.trim()) {
      return NextResponse.json({ ok: false, error: 'source_text required' }, { status: 400 });
    }

    const system = `You are a deterministic fact extractor for a professional profile system.

Extract ONLY explicitly stated facts from the source text provided. Do NOT infer, estimate, or embellish.

Rules:
- Extract only what is explicitly written in the source text
- If a fact is ambiguous, do not include it
- Do not add years of experience unless explicitly stated as a number
- Do not categorise someone as "fintech executive" unless that exact phrase appears
- Do not infer financial status from professional status

Output ONLY valid JSON in this exact shape:
{
  "currentRoles": [{ "organization": "...", "title": "...", "isCurrent": true }],
  "education": [{ "institution": "...", "degree": "", "field": "", "years": "" }],
  "publications": [{ "title": "...", "type": "book|article|report", "year": "" }],
  "patents": [{ "number": "", "title": "...", "year": "" }],
  "awards": [{ "title": "...", "issuer": "", "year": "" }],
  "licenses": [{ "title": "...", "issuer": "", "year": "" }],
  "extraordinaryAbilityIndicators": [{ "description": "...", "category": "patent|publication|award|visa|leadership|recognition" }]
}

All arrays may be empty []. All string values may be "" if not stated. Never fabricate.`;

    const user = `Source type: ${body.source_type ?? 'unknown'}\nSource URL: ${body.source_url ?? 'not provided'}\n\nSource text:\n${body.source_text}`;

    let raw = await callAnthropicJson(system, user, 1200);
    if (!raw) raw = await callOpenAiJson(system, user, 1200);

    if (!raw) {
      return NextResponse.json({ ok: false, error: 'Extraction failed — no LLM response' }, { status: 503 });
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: 'Extraction parse error' }, { status: 500 });
    }

    // Stamp all extracted items as SOURCE_DERIVED, not yet approved
    const stamp = (arr: unknown[], idPrefix: string) =>
      (Array.isArray(arr) ? arr : []).map((item, i) => ({
        ...(item as Record<string, unknown>),
        factId: `${idPrefix}_${Date.now()}_${i}`,
        source: body.source_type ?? 'unknown',
        sourceUrl: body.source_url ?? '',
        confidence: 'SOURCE_DERIVED' as const,
        principalApproved: false,
      }));

    const candidate = {
      currentRoles: stamp(extracted.currentRoles as unknown[], 'role'),
      education: stamp(extracted.education as unknown[], 'edu'),
      publications: stamp(extracted.publications as unknown[], 'pub'),
      patents: stamp(extracted.patents as unknown[], 'pat'),
      awards: stamp(extracted.awards as unknown[], 'award'),
      licenses: stamp(extracted.licenses as unknown[], 'lic'),
      extraordinaryAbilityIndicators: stamp(extracted.extraordinaryAbilityIndicators as unknown[], 'eai'),
    };

    return NextResponse.json({ ok: true, candidate, source_type: body.source_type, source_url: body.source_url });
  } catch (err) {
    console.error('[professional-profile/extract]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
