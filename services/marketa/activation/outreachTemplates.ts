/**
 * Outreach template library (golden path #5).
 *
 * Operator-curated outreach templates live in
 * marketa.marketa_outreach_templates, keyed by strategic lane ('any' =
 * catch-all). Rendering is pure placeholder substitution against the
 * candidate, so templates are unit-testable and the built-in default
 * (the original hard-coded buildDraft copy) is just one more template.
 *
 * Placeholders available to template authors:
 *   {{operator}}             operator name, falling back to candidate name
 *   {{candidate_name}}       candidate agent name
 *   {{primary_lane}}         first strategic lane, humanized
 *   {{capabilities_bullets}} up to 5 capabilities as "- x" lines
 *   {{legal_line}}           "- Legal track: x" line, or empty
 *   {{mobility_line}}        "- Mobility fit: x" line, or empty
 *   {{angle_note}}           "Operator note / angle: x" paragraph, or empty
 * Unknown {{placeholders}} render as empty; runs of 3+ newlines collapse.
 */

import type { CandidateAgent } from './types';

export interface OutreachTemplate {
  id: string;
  name: string;
  strategicLane: string; // a StrategicLane value, or 'any'
  subjectTemplate: string;
  bodyTemplate: string;
  cta: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const asStr = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

export function dbToOutreachTemplate(row: Record<string, unknown>): OutreachTemplate {
  return {
    id: asStr(row.id),
    name: asStr(row.name),
    strategicLane: asStr(row.strategic_lane, 'any') || 'any',
    subjectTemplate: asStr(row.subject_template),
    bodyTemplate: asStr(row.body_template),
    cta: asStr(row.cta),
    enabled: row.enabled !== false,
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
  };
}

export function outreachTemplateInputToDb(raw: unknown): Record<string, unknown> {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const name = asStr(body.name).trim();
  const subjectTemplate = asStr(body.subjectTemplate ?? body.subject_template).trim();
  const bodyTemplate = asStr(body.bodyTemplate ?? body.body_template).trim();
  if (!name) throw new Error('Template name is required');
  if (!subjectTemplate || !bodyTemplate) throw new Error('Template subject and body are required');
  return {
    name,
    strategic_lane: asStr(body.strategicLane ?? body.strategic_lane).trim() || 'any',
    subject_template: subjectTemplate,
    body_template: bodyTemplate,
    cta: asStr(body.cta).trim(),
    enabled: body.enabled !== false,
  };
}

/** The original hard-coded outreach copy, expressed as a template. */
export const BUILT_IN_OUTREACH_TEMPLATE: Pick<
  OutreachTemplate,
  'name' | 'strategicLane' | 'subjectTemplate' | 'bodyTemplate' | 'cta'
> = {
  name: 'Built-in default',
  strategicLane: 'any',
  subjectTemplate: 'Explore Polity Participant activation for {{operator}}',
  bodyTemplate: `Hi {{operator}},

I’m Marketa, the Polity liaison for metaMe and Aigent Z. I’m reviewing trusted agent participants that can strengthen founder-operator workflows and generate clean, policy-aligned value.

{{candidate_name}} appears relevant to {{primary_lane}}.
{{legal_line}}
{{mobility_line}}

Why this may be a fit:
{{capabilities_bullets}}

{{angle_note}}

If you’re open to it, the next step is a human-approved review of your Agent Card / MCP / OpenAPI surface and a possible Participant Passport application path. This is not an approval or revenue promise; it is an invitation to explore fit under Polity trust, consent, auditability, and clean-revenue rules.

Best,
Marketa`,
  cta: 'Review Agent Card / integration surface and confirm interest in Participant Passport pathway',
};

const humanize = (value: string) => value.replace(/_/g, ' ');

function buildPlaceholderValues(candidate: CandidateAgent, angle: string): Record<string, string> {
  const operator =
    [candidate.operatorName, candidate.name].find((value) => value && value.trim().length > 0) ?? '';
  return {
    operator,
    candidate_name: candidate.name,
    primary_lane:
      humanize(candidate.strategicLanes[0] ?? '') || 'trusted participant activation',
    capabilities_bullets:
      candidate.capabilities
        .slice(0, 5)
        .map((capability) => `- ${capability}`)
        .join('\n') ||
      '- Your declared capabilities appear aligned with trusted participant activation.',
    legal_line:
      candidate.legalTrack !== 'none' ? `- Legal track: ${humanize(candidate.legalTrack)}` : '',
    mobility_line:
      candidate.topBottomRelevance.mobilityReferenceTag !== 'none'
        ? `- Mobility fit: ${humanize(candidate.topBottomRelevance.mobilityReferenceTag)}`
        : '',
    angle_note: angle ? `Operator note / angle: ${angle}` : '',
  };
}

function substitute(template: string, values: Record<string, string>): string {
  return template
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => values[key] ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderOutreachTemplate(
  template: Pick<OutreachTemplate, 'subjectTemplate' | 'bodyTemplate' | 'cta'>,
  candidate: CandidateAgent,
  angle: string,
): { channel: 'email'; subject: string; body: string; cta: string } {
  const values = buildPlaceholderValues(candidate, angle);
  return {
    channel: 'email',
    subject: substitute(template.subjectTemplate, values),
    body: substitute(template.bodyTemplate, values),
    cta: template.cta,
  };
}

/**
 * Pick the best enabled template for a candidate: first template whose lane
 * matches one of the candidate's strategic lanes, else the first 'any'
 * template, else null (caller falls back to BUILT_IN_OUTREACH_TEMPLATE).
 */
export function pickOutreachTemplate(
  templates: OutreachTemplate[],
  candidateLanes: string[],
): OutreachTemplate | null {
  const enabled = templates.filter((template) => template.enabled);
  return (
    enabled.find((template) => candidateLanes.includes(template.strategicLane)) ??
    enabled.find((template) => template.strategicLane === 'any') ??
    null
  );
}
