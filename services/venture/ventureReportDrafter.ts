/**
 * ventureReportDrafter — Gate D artifact generation for the AigentMe
 * "Venture Report Brief" deliberation flow.
 *
 * Composes a plain-text doc draft (same output contract as
 * services/agents/draftGoogleDoc.ts) from the operator-approved brief
 * spec plus the SAME live venture data already shown in the Venture
 * Progress cockpit (buildVentureProgress) — no parallel evidence
 * source, no ventureId concept invented. This mirrors the platform's
 * existing personaId-scoped "venture" model rather than the
 * disconnected, ventureId-keyed assembleVentureReportEvidence bundle,
 * which has no caller that resolves a real ventureId for a persona.
 */

import type { VentureReportBriefSpec } from '@/types/deliberativeArtifact';
import type { VentureProgressShape } from '@/services/orchestration/ventureProgressBuilder';

export interface VentureReportDraftOutput {
  title: string;
  bodyText: string;
  shareSuggestions: Array<{ email: string; role: 'reader' | 'commenter' | 'writer' }>;
  rationale: string;
  source: 'template';
}

const PURPOSE_LABELS: Record<NonNullable<VentureReportBriefSpec['purpose']>, string> = {
  internal: 'Internal Review',
  partner: 'Partner Update',
  investor: 'Investor Update',
  product: 'Product Update',
  full: 'Full Venture Report',
  custom: 'Venture Report',
};

const SCOPE_LABELS: Record<string, string> = {
  product: 'Product',
  bridges: 'Bridges',
  pilots: 'Pilots',
  partnerships: 'Partnerships',
  research: 'Research',
  commercial: 'Commercial',
};

function formatPeriod(spec: VentureReportBriefSpec): string {
  if (spec.periodStart === 'current') return 'Current state (as of today)';
  if (spec.periodStart && spec.periodEnd) return `${spec.periodStart} through ${spec.periodEnd}`;
  if (spec.periodStart) return `Since ${spec.periodStart}`;
  return 'Current state';
}

function titleFor(spec: VentureReportBriefSpec, ventureName: string | null): string {
  const purposeLabel = spec.purpose === 'custom' && spec.customPurpose
    ? spec.customPurpose
    : PURPOSE_LABELS[spec.purpose ?? 'full'];
  const subject = ventureName || 'Venture';
  return `${subject} — ${purposeLabel}`;
}

/**
 * Build the report body from the approved brief spec + live venture
 * progress data. Plain text only (matches the create-artifact / Google
 * Doc contract — no Markdown, no HTML).
 */
export function draftVentureReport(input: {
  briefSpec: VentureReportBriefSpec;
  progress: VentureProgressShape;
}): VentureReportDraftOutput {
  const { briefSpec: spec, progress } = input;
  const scope = spec.scope && spec.scope.length > 0 ? spec.scope : Object.keys(SCOPE_LABELS);
  const wantsScope = (s: string) => scope.includes(s);
  const includeExperimental = spec.includeExperimental !== false;

  const lines: string[] = [];
  const title = titleFor(spec, progress.ventureName);

  lines.push(title);
  lines.push('');
  lines.push(
    `Reporting period: ${formatPeriod(spec)}    Disclosure: ${spec.disclosure ?? 'internal'}    Scope: ${scope.map((s) => SCOPE_LABELS[s] ?? s).join(', ')}`,
  );
  lines.push('');

  // Executive summary — always included.
  lines.push('EXECUTIVE SUMMARY');
  lines.push('');
  const stageLine = `Current stage: ${progress.currentStage || 'not set'}.`;
  const goalLine = progress.primaryGoal ? ` Primary goal: ${progress.primaryGoal}.` : '';
  lines.push(`${stageLine}${goalLine}`);
  if (progress.linkedCartridges.length > 0) {
    lines.push(`Active cartridges: ${progress.linkedCartridges.join(', ')}.`);
  }
  if (spec.desiredOutcome) {
    lines.push('');
    lines.push(`Purpose of this report: ${spec.desiredOutcome}`);
  }
  lines.push('');

  // Thesis — product scope.
  if (wantsScope('product') && progress.thesisSummary && (progress.thesisSummary.mission || progress.thesisSummary.problem)) {
    lines.push('THESIS');
    lines.push('');
    if (progress.thesisSummary.mission) lines.push(`Mission: ${progress.thesisSummary.mission}`);
    if (progress.thesisSummary.problem) lines.push(`Problem: ${progress.thesisSummary.problem}`);
    lines.push('');
  }

  // KPIs / commercial.
  if (wantsScope('commercial')) {
    lines.push('KEY PERFORMANCE INDICATORS');
    lines.push('');
    lines.push(
      `Operational goals: ${progress.operationalGoalsCount}. Commercial goals: ${progress.commercialGoalsCount}.`,
    );
    if (typeof progress.nvaTotal === 'number') {
      lines.push(`Net Value Acceleration to date: ${progress.nvaTotal}.`);
    }
    if (typeof progress.standingGovScore === 'number') {
      lines.push(`Standing governance score: ${progress.standingGovScore}.`);
    }
    if (progress.activeKpis && progress.activeKpis.length > 0) {
      lines.push('');
      for (const kpi of progress.activeKpis.slice(0, 10)) {
        lines.push(`• ${kpi.name}: ${kpi.current ?? 'n/a'}${kpi.unit ? ` ${kpi.unit}` : ''} (target: ${kpi.target})`);
      }
    }
    lines.push('');
  }

  // Research / signals + operating objectives.
  if (wantsScope('research') && (progress.signalSummary || (progress.operatingObjectives && progress.operatingObjectives.length > 0))) {
    lines.push('SIGNALS & OPERATING OBJECTIVES');
    lines.push('');
    if (progress.signalSummary) {
      const s = progress.signalSummary;
      lines.push(
        `Overall confidence: ${s.confidence ?? 'n/a'} (opportunity ${s.opportunityConfidence ?? 'n/a'}, demand ${s.demandConfidence ?? 'n/a'}, capability ${s.capabilityConfidence ?? 'n/a'}) across ${s.count} signal(s).`,
      );
    }
    if (progress.operatingObjectives) {
      for (const obj of progress.operatingObjectives.slice(0, 10)) {
        lines.push(`• ${obj.label} — ${obj.status}`);
      }
    }
    lines.push('');
  }

  // Recent activity — partnerships / bridges / pilots.
  if ((wantsScope('partnerships') || wantsScope('bridges') || wantsScope('pilots')) && progress.recentActivity.length > 0) {
    lines.push('RECENT ACTIVITY');
    lines.push('');
    for (const item of progress.recentActivity.slice(0, 12)) {
      lines.push(`• ${item.intentName} (${item.cartridge}) — ${item.status}, ${item.createdAt}`);
    }
    lines.push('');
  }

  // Verified work — Standing signals.
  if (progress.standingSignals && progress.standingSignals.length > 0) {
    lines.push('VERIFIED WORK');
    lines.push('');
    for (const sig of progress.standingSignals.slice(0, 10)) {
      lines.push(`• ${sig.summary}`);
    }
    lines.push('');
  }

  // Blockers — only when the brief asked to include experimental/at-risk work.
  if (includeExperimental && progress.blockersCount > 0) {
    lines.push('BLOCKERS');
    lines.push('');
    lines.push(`${progress.blockersCount} item(s) currently blocked or at risk.`);
    lines.push('');
  }

  // Recommended next actions.
  if (progress.recommendedActions.length > 0) {
    lines.push('RECOMMENDED NEXT ACTIONS');
    lines.push('');
    for (const action of progress.recommendedActions.slice(0, 8)) {
      lines.push(`• ${action.label}${action.rationale ? ` — ${action.rationale}` : ''}`);
    }
    lines.push('');
  }

  if (progress.notShared.length > 0) {
    lines.push(`Not included in this ${spec.disclosure ?? 'internal'}-disclosure report: ${progress.notShared.join(', ')}.`);
  }

  return {
    title,
    bodyText: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    shareSuggestions: [],
    rationale: `Composed from live venture progress (${progress.using.join(', ')}) per the approved ${spec.purpose ?? 'full'} brief.`,
    source: 'template',
  };
}
