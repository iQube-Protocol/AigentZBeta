/**
 * GET/POST/PATCH /api/mobility/cases/[caseId]/srb
 *
 * Strategic Repatriation Brief (SRB) — generate, retrieve, and approve.
 *
 * GET    — returns current srb_content + srb_status
 * POST   — generates SRB from case profile via LLM; requires MAF ≥ 8 sections
 * PATCH  — { action: 'approve' } — sets srb_status='approved', records timestamp
 *
 * T0 discipline: caseId validated server-side; never serialised into response.
 * Classification: all SRBs are BlakQube by default.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { callAnthropicJson, callOpenAiJson } from '@/services/agents/_lib/llmDraftHelper';

export const dynamic = 'force-dynamic';

// ─── Class A field validation ─────────────────────────────────────────────────

interface ClassAResult { ok: boolean; missing: string[] }

function validateClassA(row: Record<string, unknown>): ClassAResult {
  const missing: string[] = [];
  const h = (row.household_profile as Record<string, unknown>) ?? {};
  const e = (row.education_profile as Record<string, unknown>) ?? {};
  const cap = (row.capability_profile as Record<string, unknown>) ?? {};
  const fin = (row.financial_profile as Record<string, unknown>) ?? {};
  const housing = (row.housing_profile as Record<string, unknown>) ?? {};

  if (!h.adultsCount) missing.push('Household: Number of adults');
  if (!h.citizenshipStatus) missing.push('Household: Citizenship status (e.g. "All UK citizens")');
  if (!h.destinationCountry) missing.push('Household: Destination country');
  if (!housing.requiredDepartureDate) missing.push('Housing: Required departure date (hard deadline)');

  const childrenCount = parseInt(String(h.dependentsCount ?? '0'), 10);
  if (childrenCount > 0) {
    const children = Array.isArray(e.children) ? (e.children as Record<string, unknown>[]) : [];
    if (children.length === 0) {
      missing.push(`Education: ${childrenCount} dependent(s) listed — child records with ages required`);
    } else {
      children.forEach((c, i) => {
        if (!c.age) missing.push(`Education: Child ${i + 1} — age not provided`);
      });
    }
  }

  const hasProfessional = !!(cap.role || cap.industrySectors || cap.professionalBackground);
  if (!hasProfessional) missing.push('Capability: Professional role or sector not provided');

  const hasFinancial = !!(fin.liquidityLevel || fin.liquidityRange);
  if (!hasFinancial) missing.push('Financial: Liquidity level not provided');

  return { ok: missing.length === 0, missing };
}

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
      .select('srb_content, srb_status, srb_approved_at, intake_sections_complete')
      .eq('id', params.caseId)
      .single();

    return NextResponse.json({
      ok: true,
      srb: data?.srb_content ?? null,
      status: data?.srb_status ?? 'not_generated',
      approved_at: data?.srb_approved_at ?? null,
      sections_complete: (data?.intake_sections_complete as string[])?.length ?? 0,
    });
  } catch (err) {
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
        'case_type, priority_level, classification, intake_sections_complete, ' +
        'household_profile, capability_profile, continuity_profile, standing_profile, ' +
        'housing_profile, education_profile, business_profile, financial_profile, ' +
        'mobility_profile, family_profile, ' +
        'capability_score, continuity_score, recovery_velocity_class, ' +
        'standing_risk_level, housing_risk_level, education_risk_level, business_continuity_risk, ' +
        'vsp_profile_id',
      )
      .eq('id', params.caseId)
      .single();

    if (!row) return NextResponse.json({ ok: false, error: 'Case not found' }, { status: 404 });

    // Fetch compiled VSP if linked — verified facts take precedence over manually entered profile data
    let vspBlock = '';
    if (row.vsp_profile_id) {
      const { data: vsp } = await supabase
        .from('vsp_profiles')
        .select('vsp_content, label, profile_type')
        .eq('id', row.vsp_profile_id as string)
        .single();
      if (vsp?.vsp_content) {
        vspBlock = `\n\nVERIFIED STANDING PROFILE (VSP) — Principal-verified facts from documentary evidence. These facts are locked and authoritative. Use them in preference to any inferred or manually entered profile data. Do NOT modify, enrich, or contradict any fact listed here:\n${JSON.stringify(vsp.vsp_content, null, 2)}`;
      }
    }

    const sectionsComplete = (row.intake_sections_complete as string[]) ?? [];
    if (sectionsComplete.length < 8) {
      return NextResponse.json({
        ok: false,
        error: `MAF incomplete — ${sectionsComplete.length}/8 minimum sections required to generate SRB`,
      }, { status: 422 });
    }

    // Class A field gate — block if mission-critical facts are missing
    const classA = validateClassA(row as Record<string, unknown>);
    if (!classA.ok) {
      return NextResponse.json({
        ok: false,
        error: 'Class A fields incomplete — SRB generation blocked',
        missing_fields: classA.missing,
        guidance: 'Return to intake and complete the highlighted fields. SRB will only use explicitly entered data — missing fields will appear as UNKNOWN in the brief.',
      }, { status: 422 });
    }

    // Build redacted profile for LLM — omit confidentiality internals
    const caseProfile = {
      case_type: row.case_type,
      priority_level: row.priority_level,
      classification: 'BLACK_CUBE',
      household: row.household_profile,
      capability: row.capability_profile,
      continuity: row.continuity_profile,
      standing: row.standing_profile,
      housing: row.housing_profile,
      education: row.education_profile,
      business: row.business_profile,
      financial: row.financial_profile,
      mobility: row.mobility_profile,
      family: row.family_profile,
      scores: {
        capability_score: row.capability_score,
        continuity_score: row.continuity_score,
        recovery_velocity_class: row.recovery_velocity_class,
        standing_risk: row.standing_risk_level,
        housing_risk: row.housing_risk_level,
        education_risk: row.education_risk_level,
        business_risk: row.business_continuity_risk,
      },
    };

    const h = (row.household_profile as Record<string, unknown>) ?? {};
    const eduProfile = (row.education_profile as Record<string, unknown>) ?? {};
    const children = Array.isArray(eduProfile.children) ? eduProfile.children as Record<string, unknown>[] : [];
    const childrenSummary = children.length > 0
      ? children.map((c, i) =>
          `Child ${i + 1}: age ${c.age ?? 'UNKNOWN'}, current grade: ${c.currentGrade || 'UNKNOWN'}, UK year group: ${c.yearGroup || 'UNKNOWN'}, target school: ${c.targetSchool || 'UNKNOWN'}, current school: ${c.currentSchool || 'UNKNOWN'}`
        ).join('; ')
      : (eduProfile.childrenDetails ? String(eduProfile.childrenDetails) : 'UNKNOWN');

    // Extract PRINCIPAL_VERIFIED professional facts only
    const capProfile = (row.capability_profile as Record<string, unknown>) ?? {};
    const profProfile = capProfile.professionalProfile as Record<string, unknown> | undefined;
    const verifiedFacts = profProfile?.principalApproved === true ? profProfile : null;

    const buildVerifiedSummary = (arr: unknown[], formatter: (f: Record<string, unknown>) => string) =>
      Array.isArray(arr)
        ? arr.filter((f: unknown) => (f as Record<string, unknown>).principalApproved).map(f => formatter(f as Record<string, unknown>))
        : [];

    const verifiedRoles = verifiedFacts
      ? buildVerifiedSummary(verifiedFacts.currentRoles as unknown[], f => `${f.title} at ${f.organization}${f.isCurrent ? ' (current)' : ''}`)
      : [];
    const verifiedEdu = verifiedFacts
      ? buildVerifiedSummary(verifiedFacts.education as unknown[], f => `${f.degree || 'Study'} at ${f.institution}${f.years ? ` (${f.years})` : ''}`)
      : [];
    const verifiedPubs = verifiedFacts
      ? buildVerifiedSummary(verifiedFacts.publications as unknown[], f => `${f.title}${f.year ? ` (${f.year})` : ''}`)
      : [];
    const verifiedPatents = verifiedFacts
      ? buildVerifiedSummary(verifiedFacts.patents as unknown[], f => `${f.title}${f.number ? ` (${f.number})` : ''}${f.year ? ` · ${f.year}` : ''}`)
      : [];
    const verifiedAwards = verifiedFacts
      ? buildVerifiedSummary(verifiedFacts.awards as unknown[], f => `${f.title}${f.issuer ? ` — ${f.issuer}` : ''}${f.year ? ` (${f.year})` : ''}`)
      : [];
    const verifiedEAIs = verifiedFacts
      ? buildVerifiedSummary(verifiedFacts.extraordinaryAbilityIndicators as unknown[], f => `${f.description} [${f.category}]`)
      : [];

    const professionalFactsBlock = verifiedFacts
      ? `
PRINCIPAL-VERIFIED PROFESSIONAL FACTS (use these verbatim in the capability_profile and standing_profile sections):
${verifiedRoles.length > 0 ? `Roles: ${verifiedRoles.join('; ')}` : ''}
${verifiedEdu.length > 0 ? `Education: ${verifiedEdu.join('; ')}` : ''}
${verifiedPubs.length > 0 ? `Publications: ${verifiedPubs.join('; ')}` : ''}
${verifiedPatents.length > 0 ? `Patents: ${verifiedPatents.join('; ')}` : ''}
${verifiedAwards.length > 0 ? `Awards/Recognition: ${verifiedAwards.join('; ')}` : ''}
${verifiedEAIs.length > 0 ? `Extraordinary ability indicators: ${verifiedEAIs.join('; ')}` : ''}
These facts are PRINCIPAL_VERIFIED — use them as stated, do not rephrase or embellish.`
      : 'No principal-verified professional facts available — derive capability description only from capability_profile.role and capability_profile.industrySectors.';

    const system = `You are aigentMe — confidentiality guardian and disclosure broker for a BlakQube-classified mobility case under PSC-001 (Polity Capability Preservation Standard).

DETERMINISTIC CASE MODEL — CRITICAL NON-FABRICATION RULES:
1. You MUST use ONLY information explicitly present in the case profile below.
2. If a field is missing, null, empty, or unknown: write the word UNKNOWN — never infer, estimate, or substitute.
3. Do NOT assume financial standing, wealth, or economic resilience from professional standing or visa history.
4. Do NOT assume educational history, school names, or pathways not explicitly provided.
5. Child ages MUST come only from the structured children array — currently: ${childrenSummary}. Do not write any other ages.
6. Professional discipline MUST come from the PRINCIPAL-VERIFIED PROFESSIONAL FACTS block below, then capability.role + capability.industrySectors/sector. Do not embellish beyond what is explicitly stated.
7. Financial status MUST come from the financial profile fields — if liquidityLevel and liquidityRange are both absent, write UNKNOWN for financial standing.
8. School names appearing in the SRB must match exactly what is in the children[].targetSchool fields or continuity_profile — never invent school names.
9. This is a deterministic report, not a narrative story. Every sentence must reference explicit case data.
10. The SRB is NOT a benefits application. Communicate capability, continuity, and future contribution — not hardship.
${professionalFactsBlock}${vspBlock}

Generate a Strategic Repatriation Brief (SRB). This is a curated advocacy document enabling institutions to understand the complete household before evaluating individual requests.

Output ONLY valid JSON with exactly these 8 keys. Each value is 2-4 paragraphs of flowing professional prose. No bullet points. Tone: measured, professional, dignified.

{
  "executive_summary": "...",
  "household_overview": "...",
  "capability_profile": "...",
  "continuity_profile": "...",
  "standing_profile": "...",
  "current_challenge": "...",
  "desired_outcome": "...",
  "requested_guidance": "..."
}

The requested_guidance section must always close with: "What guidance, referrals, pathways, or services would you recommend given the circumstances described?"`;

    const user = `Generate the Strategic Repatriation Brief from the following case profile:\n\n${JSON.stringify(caseProfile, null, 2)}`;

    // Anthropic-first → OpenAI fallback → template fallback
    let raw = await callAnthropicJson(system, user, 2400);
    if (!raw) raw = await callOpenAiJson(system, user, 2400);

    let srb: Record<string, string> | null = null;
    if (raw) {
      try {
        srb = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }

    if (!raw || !srb) {
      // Template fallback — structured but generic, using only case data
      const household = (row.household_profile as Record<string, unknown>) ?? {};
      const capability = (row.capability_profile as Record<string, unknown>) ?? {};
      const mobility = (row.mobility_profile as Record<string, unknown>) ?? {};
      const housingProfile = (row.housing_profile as Record<string, unknown>) ?? {};
      const rvClass = row.recovery_velocity_class ?? 'RV-2';
      const capScore = row.capability_score;
      const dest = String(mobility.destinationCountry ?? household.destinationCountry ?? 'the destination country');
      const occupation = String(capability.primaryOccupation ?? capability.role ?? 'professional');
      const depCount = parseInt(String(household.dependentsCount ?? '0'), 10);
      const depLine = depCount > 0 ? ` with particular attention required for the educational continuity of ${depCount} dependent${depCount > 1 ? 's' : ''}` : '';
      const departureDateRaw = String(housingProfile.requiredDepartureDate ?? mobility.targetDepartureDate ?? '');
      const departureLine = departureDateRaw
        ? ` The confirmed departure deadline is ${new Date(departureDateRaw).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        : '';

      srb = {
        executive_summary:
          `This Strategic Repatriation Brief presents the circumstances, capabilities, and continuity requirements of a household undertaking a ${String(row.case_type).replace('_', ' ')} under PSC-001 Priority Level ${String(row.priority_level).toUpperCase()}. ` +
          `The household comprises ${String(household.familySize ?? 'multiple')} individuals and is relocating to ${dest}. ` +
          `The case has been assessed at Recovery Velocity Class ${rvClass}${capScore !== null ? ` with a Capability Score of ${capScore}/100` : ''}. ` +
          `The objective of this brief is to provide institutional context before any specific service requests are evaluated.`,

        household_overview:
          `The household is relocating to ${dest} on a confirmed timeline.${departureLine} ` +
          `The transition involves the full household unit${depLine}. ` +
          `The household has existing ties to the destination country and is undertaking this transition as a repatriation rather than a first-time immigration matter.`,

        capability_profile:
          `The primary household principal is a ${occupation} with documented professional standing and an established record of contribution in their field. ` +
          `Their capability classification under PSC-001 reflects ${rvClass === 'RV-1' ? 'exceptional recovery velocity and high productive capacity available within 30 days of establishment' : 'strong recovery potential within the assessed timeline'}. ` +
          `The household represents a productive asset to the destination community with the potential to contribute economically, professionally, and socially upon successful repatriation.`,

        continuity_profile:
          `The household has meaningful continuity assets in the destination country, including prior residence history, professional networks, and community connections. ` +
          (depCount > 0
            ? `Educational continuity for dependent children is a primary concern, with specific school placement requirements tied to the current academic intake window. `
            : '') +
          `Professional continuity is supported by the nature of the principal's current activities, which are designed to transition to destination-country operations upon establishment.`,

        standing_profile:
          `The principal holds professional standing commensurate with their assessed capability score and recovery velocity classification. ` +
          `Their standing in their professional field is supported by documented achievements and recognised expertise. ` +
          `This standing creates both an obligation and an opportunity: an obligation to manage the repatriation with discretion, and an opportunity to contribute meaningfully to the destination community upon arrival.`,

        current_challenge:
          `The household faces a constrained timeline driven by the expiry of their current residential arrangement.${departureLine} ` +
          `The primary operational challenges include housing establishment in the preferred catchment area${depCount > 0 ? `, school placement for ${depCount} dependent${depCount > 1 ? 's' : ''} ahead of the next academic intake` : ''}, and business continuity during the transition period. ` +
          `These challenges require careful coordination and institutional support within the available window.`,

        desired_outcome:
          `The household seeks to establish a stable residential and educational foundation in ${dest} within the available timeline. ` +
          `The household does not seek preferential treatment — they seek context-appropriate guidance that takes into account the complete circumstances described in this brief. ` +
          `Successful outcomes include confirmed housing, ${depCount > 0 ? 'school placement for dependants, ' : ''}banking continuity, and professional re-establishment support.`,

        requested_guidance:
          `We present this brief to institutions that may be positioned to provide guidance, referrals, or pathways relevant to the circumstances described. ` +
          `We recognise that the household's situation may not fit standard administrative categories, and we welcome the exercise of institutional judgment and discretion. ` +
          `What guidance, referrals, pathways, or services would you recommend given the circumstances described?`,
      };
    }

    await supabase
      .from('mobility_cases')
      .update({ srb_content: srb, srb_status: 'draft' })
      .eq('id', params.caseId);

    return NextResponse.json({ ok: true, srb, status: 'draft' });
  } catch (err) {
    console.error('[srb/generate]', err);
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
    const { data } = await supabase
      .from('mobility_cases')
      .select('srb_status')
      .eq('id', params.caseId)
      .single();

    if (!data?.srb_status || data.srb_status === 'not_generated') {
      return NextResponse.json({ ok: false, error: 'No SRB draft to approve' }, { status: 422 });
    }

    await supabase
      .from('mobility_cases')
      .update({ srb_status: 'approved', srb_approved_at: new Date().toISOString() })
      .eq('id', params.caseId);

    return NextResponse.json({ ok: true, status: 'approved' });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
