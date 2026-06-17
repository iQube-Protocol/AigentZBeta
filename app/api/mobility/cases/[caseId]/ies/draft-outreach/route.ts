/**
 * POST /api/mobility/cases/[caseId]/ies/draft-outreach
 *
 * Generates a recipient-specific outreach email for a given institution
 * from the approved IES. Disclosure package is filtered to the institution's
 * assigned level (FULL | CAPABILITY_ONLY | SUMMARY_ONLY).
 *
 * send_via_marketa: true  → stubbed (fast-follow backlog)
 * send_via_marketa: false → returns { subject, body } for manual copy-send
 *
 * T0 discipline: caseId server-side only; no raw IDs in email body.
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

interface Institution {
  id: string;
  name: string;
  category: string;
  rationale: string;
  recommended_action: string;
  disclosure_level: 'FULL' | 'CAPABILITY_ONLY' | 'SUMMARY_ONLY';
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

function buildDisclosurePackage(srb: SRBContent, level: string): string {
  if (level === 'FULL') {
    return Object.entries(srb)
      .map(([k, v]) => `## ${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n\n${v}`)
      .join('\n\n');
  }
  if (level === 'CAPABILITY_ONLY') {
    return [
      srb.executive_summary && `## Executive Summary\n\n${srb.executive_summary}`,
      srb.capability_profile && `## Capability Profile\n\n${srb.capability_profile}`,
      srb.standing_profile && `## Standing Profile\n\n${srb.standing_profile}`,
      srb.desired_outcome && `## Desired Outcome\n\n${srb.desired_outcome}`,
      srb.requested_guidance && `## Requested Guidance\n\n${srb.requested_guidance}`,
    ].filter(Boolean).join('\n\n');
  }
  // SUMMARY_ONLY
  return [
    srb.executive_summary && `## Executive Summary\n\n${srb.executive_summary}`,
    srb.desired_outcome && `## Desired Outcome\n\n${srb.desired_outcome}`,
    srb.requested_guidance && `## Requested Guidance\n\n${srb.requested_guidance}`,
  ].filter(Boolean).join('\n\n');
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

    // Marketa send path is stubbed — fast-follow backlog
    if (body.send_via_marketa === true) {
      return NextResponse.json({
        ok: false,
        stubbed: true,
        error: 'Marketa send path not yet active — copy draft and send manually',
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

    const iesContent = row.ies_content as { institutions?: Institution[] } | null;
    const institution = iesContent?.institutions?.find((i: Institution) => i.id === body.institution_id);
    if (!institution) {
      return NextResponse.json({ ok: false, error: 'Institution not found in IES' }, { status: 404 });
    }

    const srb = (row.srb_content ?? {}) as SRBContent;
    const disclosurePackage = buildDisclosurePackage(srb, institution.disclosure_level);
    const recipientName = body.recipient_name?.trim() || 'the relevant officer';
    const recipientRole = body.recipient_role?.trim() || 'institutional representative';

    const system = `You are aigentMe — confidentiality guardian and disclosure broker for a BlakQube-classified PSC-001 mobility case.

Draft a professional outreach email to ${recipientName} (${recipientRole}) at ${institution.name}.

The email must:
- Open with a brief context-setting sentence that does not identify specific individuals
- Reference the SRB content provided at the appropriate disclosure level (${institution.disclosure_level})
- Communicate the recommended action: ${institution.recommended_action}
- Close with the requested guidance question from the SRB
- Maintain a measured, dignified tone — professional but not subservient
- Never include raw IDs, case numbers, or any T0 identifiers
- Omit any details not present in the disclosure package below

Output ONLY valid JSON: { "subject": "...", "body": "..." }`;

    const user = `Recipient: ${recipientName}, ${recipientRole} at ${institution.name}\nInstitution category: ${institution.category}\nStrategic rationale: ${institution.rationale}\n\nDisclosure package (${institution.disclosure_level}):\n\n${disclosurePackage}`;

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
      // Template fallback
      subject = `Human Mobility Services — Engagement Inquiry (${institution.category})`;
      emailBody = [
        `Dear ${recipientName},`,
        '',
        `We are writing to you in your capacity as ${recipientRole} at ${institution.name}.`,
        '',
        disclosurePackage.split('\n\n').slice(0, 3).join('\n\n'),
        '',
        `We would welcome your guidance on: ${institution.recommended_action}`,
        '',
        'What guidance, referrals, pathways, or services would you recommend given the circumstances described?',
        '',
        'Yours sincerely,',
        'Human Mobility Services — PSC-001 Case Team',
      ].join('\n');
    }

    return NextResponse.json({
      ok: true,
      subject,
      body: emailBody,
      institution_name: institution.name,
      disclosure_level: institution.disclosure_level,
    });
  } catch (err) {
    console.error('[ies/draft-outreach]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
