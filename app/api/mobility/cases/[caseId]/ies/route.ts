/**
 * GET/POST/PATCH /api/mobility/cases/[caseId]/ies
 *
 * Institutional Engagement Strategy (IES) — generate, retrieve, and approve.
 *
 * GET    — returns current ies_content + ies_status
 * POST   — generates IES from approved SRB + case profile; requires srb_status='approved'
 * PATCH  — { action: 'approve' } — authorizes IES, enabling per-institution outreach drafts
 *
 * T0 discipline: caseId validated server-side only.
 * Uses callAnthropicJson → callOpenAiJson fallback (no SDK dependency).
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

export async function GET(req: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    const { data } = await supabase
      .from('mobility_cases')
      .select('ies_content, ies_status, ies_approved_at, srb_status')
      .eq('id', params.caseId)
      .single();

    return NextResponse.json({
      ok: true,
      ies: data?.ies_content ?? null,
      status: data?.ies_status ?? 'not_generated',
      approved_at: data?.ies_approved_at ?? null,
      srb_status: data?.srb_status ?? 'not_generated',
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const { data: row } = await supabase
      .from('mobility_cases')
      .select(
        'srb_status, srb_content, household_profile, capability_profile, continuity_profile, ' +
        'standing_profile, mobility_profile, capability_score, continuity_score, recovery_velocity_class, ' +
        'housing_risk_level, education_risk_level, business_continuity_risk',
      )
      .eq('id', params.caseId)
      .single();

    if (!row) return NextResponse.json({ ok: false, error: 'Case not found' }, { status: 404 });

    if (row.srb_status !== 'approved') {
      return NextResponse.json({
        ok: false,
        error: 'SRB must be approved before generating IES',
      }, { status: 422 });
    }

    const caseContext = {
      capability_score: row.capability_score,
      continuity_score: row.continuity_score,
      recovery_velocity_class: row.recovery_velocity_class,
      household: row.household_profile,
      capability: row.capability_profile,
      continuity: row.continuity_profile,
      standing: row.standing_profile,
      mobility: row.mobility_profile,
      risks: {
        housing: row.housing_risk_level,
        education: row.education_risk_level,
        business: row.business_continuity_risk,
      },
    };

    const system = `You are aigentMe — institutional engagement strategist and confidentiality guardian for a BlakQube-classified PSC-001 mobility case (founder-family repatriation, United States → London, UK).

Generate an Institutional Engagement Strategy (IES) governed by the Progressive Disclosure & Engagement Protocol (PDEP) and Adaptive Disclosure Tempo Framework (ADTF).

PDEP DOCTRINE — MANDATORY:
The objective of initial engagement is pathway discovery, NOT identity disclosure.
Information is disclosed only when: necessary, proportional, authorized, and the engagement has reached the appropriate stage.
Identity is an asset in capability-preservation cases. It must not be disclosed merely because communication has begun.

ADTF ENGAGEMENT TEMPO:
- Standard: full staged sequence (A → B → C → D). Use for flexible timelines.
- Accelerated (DEFAULT for founder/family repatriation): combine Stage 0+1 using Package AB. Preserves anonymity while providing rich context. Use when housing/educational/relocation deadlines apply.
- Emergency: combine Stage 0+1+2 using Package ABC. Requires enhanced authorization.

DISCLOSURE PACKAGES:
- Package A (Context): case type, capability profile, continuity profile, objectives. NO identifying info.
- Package B (Case): household composition, citizenship status, destination region, timeline constraints, continuity requirements. NO names, NO documents, NO addresses.
- Package AB (Strategic Context — Accelerated default): combines A+B. Rich context, full anonymity.
- Package C (Identity): names, contact info, approved identifiers, supporting docs. Requires pathway validation + authorization.
- Package D (Execution): only info required for a specific service delivery. Proportional.

ENGAGEMENT STAGES:
- Stage 0: Anonymous Context Discovery — determine if pathway exists. No PII.
- Stage 1: Pseudonymous Case Disclosure — additional context, identity protected.
- Stage 2: Authorized Identity Disclosure — identity disclosed only after pathway validation + principal approval.
- Stage 3: Operational Disclosure — execution-specific info only.

Output ONLY valid JSON:

{
  "engagement_tempo": "accelerated",
  "institutions": [
    {
      "id": "kebab-case-unique-id",
      "name": "Full Institution Name",
      "category": "A",
      "phase": 1,
      "engagement_stage": 0,
      "recommended_package": "AB",
      "context_authority": 9,
      "referral_authority": 8,
      "capability_preservation": 9,
      "continuity_preservation": 7,
      "execution_impact": 6,
      "rationale": "2-3 sentence strategic rationale for engaging this institution",
      "recommended_action": "Specific action to take",
      "expected_response": "What a useful response from this institution looks like",
      "escalation_criteria": "Conditions that would justify advancing to the next disclosure stage",
      "disclosure_level": "CAPABILITY_ONLY"
    }
  ],
  "phases": [
    { "phase": 1, "label": "Context Establishment", "objective": "...", "institution_ids": ["..."] },
    { "phase": 2, "label": "Pathway Activation", "objective": "...", "institution_ids": ["..."] },
    { "phase": 3, "label": "Operational Execution", "objective": "...", "institution_ids": ["..."] }
  ],
  "strategic_note": "Overall strategic guidance paragraph for the operator"
}

Rules:
- Generate 12-18 UK-relevant institutions (consular, financial, schools admissions, housing, professional bodies, founder networks, community/benevolent societies, legal, NHS, utilities)
- Score each 1-10 on: context_authority, referral_authority, capability_preservation, continuity_preservation, execution_impact
- Category A = highest strategic value (3-5 institutions), B = important (5-8), C = supporting (4-6)
- Phase 1: Context Establishment — legitimacy, referrals, context. Phase 2: Pathway Activation — housing, schools, banking. Phase 3: Execution — movers, utilities, telecoms
- For a compressed-timeline founder repatriation case: set engagement_tempo = "accelerated"
- Phase 1 institutions: engagement_stage=0, recommended_package="AB" (anonymous rich context)
- Phase 2 institutions: engagement_stage=1, recommended_package="AB" or "B"
- Phase 3 institutions: engagement_stage=2 or 3, recommended_package="C" or "D"
- disclosure_level (legacy compat): FULL = Package C/D tier; CAPABILITY_ONLY = Package AB/B tier; SUMMARY_ONLY = Package A tier
- Prioritize institutions with referral authority over those with only execution capability
- Subject email address must NEVER appear in any outreach — this is a unique identifier`;

    const user = `Generate the IES for this case:\n\n${JSON.stringify(caseContext, null, 2)}`;

    let raw = await callAnthropicJson(system, user, 4000);
    if (!raw) raw = await callOpenAiJson(system, user, 4000);

    let ies: Record<string, unknown> | null = null;
    if (raw) {
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        ies = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      } catch {
        raw = null;
      }
    }

    if (!raw || !ies) {
      // Minimal fallback structure — operator can regenerate
      ies = {
        institutions: [],
        phases: [
          { phase: 1, label: 'Context Establishment', objective: 'Establish institutional understanding and legitimacy.', institution_ids: [] },
          { phase: 2, label: 'Pathway Activation', objective: 'Translate context into housing, education, and economic pathways.', institution_ids: [] },
          { phase: 3, label: 'Operational Execution', objective: 'Execute relocation logistics.', institution_ids: [] },
        ],
        strategic_note: 'IES generation encountered an issue — please regenerate. Ensure your LLM API keys are configured.',
      };
    }

    await supabase
      .from('mobility_cases')
      .update({ ies_content: ies, ies_status: 'draft' })
      .eq('id', params.caseId);

    return NextResponse.json({ ok: true, ies, status: 'draft' });
  } catch (err) {
    console.error('[ies/generate]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    const body = await req.json().catch(() => ({})) as { action?: string };
    if (body.action !== 'approve') {
      return NextResponse.json({ ok: false, error: 'action must be "approve"' }, { status: 400 });
    }
    await supabase
      .from('mobility_cases')
      .update({ ies_status: 'approved', ies_approved_at: new Date().toISOString() })
      .eq('id', params.caseId);

    return NextResponse.json({ ok: true, status: 'approved' });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
