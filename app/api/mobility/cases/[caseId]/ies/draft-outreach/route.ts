/**
 * POST /api/mobility/cases/[caseId]/ies/draft-outreach
 *
 * Generates a recipient-specific outreach email for a given institution
 * from the approved IES, governed by the PDEP (Progressive Disclosure &
 * Engagement Protocol) and ADTF (Adaptive Disclosure Tempo Framework).
 *
 * Disclosure packages follow PDEP doctrine:
 *   Package A  — context only, fully anonymous
 *   Package B  — case context, no identifying info
 *   Package AB — accelerated tempo default (A+B combined), fully anonymous
 *   Package C  — identity package, requires authorization
 *   Package D  — execution package, proportional to service
 *
 * Subject email address NEVER included — it is a T0 unique identifier.
 * Marketa email routing: send_via_marketa uses the system Marketa inbox
 * with case-level forward_email for response routing.
 *
 * Routing evolution:
 *   send_via_marketa: true  → stubbed (fast-follow backlog)
 *   send_via_marketa: false → returns { subject, body } for manual copy-send
 *   Future: route_via_aigentme: true → aigentMe acts as delegated Chief of Staff,
 *     sends from the system inbox, monitors responses, proposes next best actions
 *     per PDEP stage escalation criteria. Flip from Marketa → aigentMe when
 *     aigentMe gains send/receive authority as the principal's CoS agent.
 *
 * T0 discipline: caseId server-side only; no raw IDs in email body.
 */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { callAnthropicJson, callOpenAiJson } from '@/services/agents/_lib/llmDraftHelper';

/** Commitment ref for HMS email routing — same as locker-ref route. T2-safe. */
function hmsCustomId(caseId: string, institutionId: string): string {
  const ref = createHash('sha256')
    .update('hms:locker:' + caseId)
    .digest('hex')
    .slice(0, 16);
  return `hms:${ref}:${institutionId}`;
}

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

type DisclosurePackage = 'A' | 'B' | 'AB' | 'C' | 'D';

interface Institution {
  id: string;
  name: string;
  category: string;
  rationale: string;
  recommended_action: string;
  expected_response?: string;
  escalation_criteria?: string;
  // PDEP fields
  engagement_stage?: number;
  recommended_package?: DisclosurePackage;
  // legacy compat
  disclosure_level?: 'FULL' | 'CAPABILITY_ONLY' | 'SUMMARY_ONLY';
}

interface SRBContent {
  executive_summary?: string;
  household_overview?: string;
  capability_profile?: string;
  continuity_profile?: string;
  standing_profile?: string;
  current_challenge?: string;
  desired_outcome?: string;
  requested_guidance?: string;
}

/**
 * Resolve effective disclosure package.
 * Prefer PDEP recommended_package; fall back to legacy disclosure_level mapping.
 */
function resolvePackage(institution: Institution): DisclosurePackage {
  if (institution.recommended_package) return institution.recommended_package;
  // Legacy mapping
  if (institution.disclosure_level === 'FULL') return 'C';
  if (institution.disclosure_level === 'CAPABILITY_ONLY') return 'AB';
  return 'A'; // SUMMARY_ONLY → Package A
}

/**
 * Build the disclosure content based on PDEP package.
 * Packages A, B, AB: fully anonymous — SRB prose only (no names, no addresses, no identifiers).
 * Package C: adds identity context marker (operator supplies names separately before sending).
 * Package D: minimal execution-specific context.
 */
function buildDisclosurePackage(srb: SRBContent, pkg: DisclosurePackage): string {
  const sec = (label: string, value?: string) =>
    value ? `## ${label}\n\n${value}` : null;

  switch (pkg) {
    case 'A':
      return [
        sec('Case Context', srb.executive_summary),
        sec('Desired Outcome', srb.desired_outcome),
        sec('Requested Guidance', srb.requested_guidance),
      ].filter(Boolean).join('\n\n');

    case 'B':
      return [
        sec('Case Context', srb.executive_summary),
        sec('Continuity Profile', srb.continuity_profile),
        sec('Current Challenge', srb.current_challenge),
        sec('Desired Outcome', srb.desired_outcome),
        sec('Requested Guidance', srb.requested_guidance),
      ].filter(Boolean).join('\n\n');

    case 'AB':
      return [
        sec('Case Context', srb.executive_summary),
        sec('Capability Profile', srb.capability_profile),
        sec('Continuity Profile', srb.continuity_profile),
        sec('Current Challenge', srb.current_challenge),
        sec('Desired Outcome', srb.desired_outcome),
        sec('Requested Guidance', srb.requested_guidance),
      ].filter(Boolean).join('\n\n');

    case 'C':
      return [
        sec('Case Context', srb.executive_summary),
        sec('Household Overview', srb.household_overview),
        sec('Capability Profile', srb.capability_profile),
        sec('Continuity Profile', srb.continuity_profile),
        sec('Standing Profile', srb.standing_profile),
        sec('Current Challenge', srb.current_challenge),
        sec('Desired Outcome', srb.desired_outcome),
        sec('Requested Guidance', srb.requested_guidance),
      ].filter(Boolean).join('\n\n');

    case 'D':
      return [
        sec('Service Context', srb.desired_outcome),
        sec('Requested Guidance', srb.requested_guidance),
      ].filter(Boolean).join('\n\n');
  }
}

/** Whether this package preserves anonymity (no identity disclosed) */
function isAnonymousPackage(pkg: DisclosurePackage): boolean {
  return pkg === 'A' || pkg === 'B' || pkg === 'AB';
}

export async function POST(
  req: NextRequest,
  { params }: { params: { caseId: string } },
) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({})) as {
      institution_id?: string;
      recipient_name?: string;
      recipient_role?: string;
      send_via_marketa?: boolean;
    };

    // Marketa send path — fast-follow backlog
    // Future: this path will flip to aigentMe as delegated CoS agent
    if (body.send_via_marketa === true) {
      return NextResponse.json({
        ok: false,
        stubbed: true,
        error: 'Marketa send path not yet active — copy draft and send manually',
        routing_note: 'Future: aigentMe will send, monitor responses, and propose next-stage actions as delegated Chief of Staff',
      });
    }

    if (!body.institution_id) {
      return NextResponse.json({ ok: false, error: 'institution_id required' }, { status: 400 });
    }

    const { data: row } = await supabase
      .from('mobility_cases')
      .select('ies_content, ies_status, srb_content, srb_status')
      .eq('id', params.caseId)
      .single();

    if (!row) return NextResponse.json({ ok: false, error: 'Case not found' }, { status: 404 });

    if (row.ies_status !== 'approved') {
      return NextResponse.json({ ok: false, error: 'IES must be approved before drafting outreach' }, { status: 422 });
    }

    const iesContent = row.ies_content as { institutions?: Institution[]; engagement_tempo?: string } | null;
    const institution = iesContent?.institutions?.find((i: Institution) => i.id === body.institution_id);
    if (!institution) {
      return NextResponse.json({ ok: false, error: 'Institution not found in IES' }, { status: 404 });
    }

    const srb = (row.srb_content ?? {}) as SRBContent;
    const pkg = resolvePackage(institution);
    const anonymous = isAnonymousPackage(pkg);
    const engagementTempo = iesContent?.engagement_tempo ?? 'accelerated';
    const engagementStage = institution.engagement_stage ?? 0;

    const disclosurePackage = buildDisclosurePackage(srb, pkg);

    // For anonymous packages: recipient name is not used in salutation
    const recipientRole = body.recipient_name?.trim()
      ? `${body.recipient_name.trim()}${body.recipient_role?.trim() ? `, ${body.recipient_role.trim()}` : ''}`
      : (body.recipient_role?.trim() || 'the relevant officer');

    const anonymityInstruction = anonymous
      ? `CRITICAL ANONYMITY RULES (Package ${pkg} — Stage ${engagementStage}):
- Do NOT include any names, personal identifiers, addresses, or contact details of the household
- Do NOT reference any specific individuals — use "a household", "a family", "a British founder-led household"
- Do NOT include any email addresses, phone numbers, or personal identifiers
- The objective of this email is pathway discovery, NOT identity disclosure
- This is Stage ${engagementStage} engagement — the household's identity is an asset that remains protected`
      : `Package ${pkg} (Stage ${engagementStage}): Identity context may be included where authorized and necessary.
- Still omit raw IDs, case numbers, or T0 identifiers
- Subject email address must NEVER appear — it is a unique identifier`;

    const system = `You are aigentMe — confidentiality guardian and disclosure broker for a BlakQube-classified PSC-001 mobility case, operating under the Progressive Disclosure & Engagement Protocol (PDEP).

Draft a professional outreach email to ${anonymous ? recipientRole : recipientRole} at ${institution.name}.

${anonymityInstruction}

The email must:
- Open with a brief, context-setting sentence appropriate to Stage ${engagementStage} engagement
- Communicate the household's circumstances using ONLY the disclosure package content provided below
- Communicate the recommended action: ${institution.recommended_action}
- Close with the guidance request from the disclosure package
- Maintain a measured, dignified tone — professional but not subservient
- Never include raw IDs, case numbers, or any T0 identifiers
- Omit any details not present in the disclosure package below

Engagement tempo: ${engagementTempo}. Package: ${pkg}.

Output ONLY valid JSON: { "subject": "...", "body": "..." }`;

    const user = `Recipient: ${anonymous ? recipientRole : recipientRole} at ${institution.name}
Institution category: ${institution.category}
Strategic rationale: ${institution.rationale}
${institution.expected_response ? `Expected response: ${institution.expected_response}` : ''}

Disclosure package (${pkg} — Stage ${engagementStage}):\n\n${disclosurePackage}`;

    let raw = await callAnthropicJson(system, user, 1500);
    if (!raw) raw = await callOpenAiJson(system, user, 1500);

    let subject: string;
    let emailBody: string;

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { subject?: string; body?: string };
        subject = parsed.subject ?? `Human Mobility Services — Engagement Inquiry`;
        emailBody = parsed.body ?? raw;
      } catch {
        subject = `Human Mobility Services — Engagement Inquiry`;
        emailBody = raw;
      }
    } else {
      // Template fallback — Stage 0/1 anonymous by default
      subject = `Human Mobility Services — ${anonymous ? 'Pathway Enquiry' : 'Engagement Inquiry'} (${institution.category})`;
      emailBody = anonymous
        ? [
            `Dear ${recipientRole},`,
            '',
            `We are writing to you in your capacity at ${institution.name} to enquire about available pathways and guidance.`,
            '',
            disclosurePackage.split('\n\n').slice(0, 3).join('\n\n'),
            '',
            `We would welcome your guidance on: ${institution.recommended_action}`,
            '',
            srb.requested_guidance || 'What guidance, referrals, pathways, or services would you recommend given the circumstances described?',
            '',
            'Yours sincerely,',
            'Human Mobility Services — aigentMe Case Team',
          ].join('\n')
        : [
            `Dear ${recipientRole},`,
            '',
            `We are writing to you in your capacity at ${institution.name}.`,
            '',
            disclosurePackage.split('\n\n').slice(0, 3).join('\n\n'),
            '',
            `We would welcome your guidance on: ${institution.recommended_action}`,
            '',
            srb.requested_guidance || 'What guidance, referrals, pathways, or services would you recommend given the circumstances described?',
            '',
            'Yours sincerely,',
            'Human Mobility Services — aigentMe Case Team',
          ].join('\n');
    }

    // Routing metadata for Marketa send path and manual copy-send
    const customId = hmsCustomId(params.caseId, institution.id);
    const systemReplyTo = process.env.MARKETA_OUTREACH_REPLY_TO ?? null;

    return NextResponse.json({
      ok: true,
      subject,
      body: emailBody,
      institution_name: institution.name,
      disclosure_package: pkg,
      engagement_stage: engagementStage,
      engagement_tempo: engagementTempo,
      anonymous,
      // Routing: include in email headers when sending (CustomID for reply attribution)
      custom_id: customId,
      reply_to: systemReplyTo,
      routing_note: systemReplyTo
        ? `Set Reply-To: ${systemReplyTo} and CustomID: ${customId} when sending. Responses will be ingested via /api/mobility/inbound-reply and attributed to this institution.`
        : 'Set MARKETA_OUTREACH_REPLY_TO env var to enable automatic response ingestion.',
    });
  } catch (err) {
    console.error('[ies/draft-outreach]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
