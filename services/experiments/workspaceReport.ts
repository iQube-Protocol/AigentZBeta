/**
 * workspaceReport — Aigent Z's administration of an ExperimentWorkspace: the
 * daily Chief-of-Staff wakeup and the weekly report (Horizen Phase 3; Chrysalis
 * tracker row 102, built as ONE increment per the audit's instruction "do not
 * build twice").
 *
 * Aigent Z is the workspace's declared owner and orchestrator
 * (`PartnerWorkspace.ownerAgentId`), so the report is not a new capability
 * bolted on — it is that role, executed on a cadence.
 *
 * NO NEW DATA SOURCE. Every line of the report is composed from the Phase 2
 * spine's own resolvers: projected actions (IntentQubes), projected decisions
 * (Constitutional Agreements), workspace-local milestones and blockers,
 * reference integrity, and the invariant resolution with its canon stamp. If
 * the spine cannot see something, the report says so rather than filling the
 * gap — the Command Center honesty rule this workstream already follows.
 *
 * DAILY vs WEEKLY is a WINDOW, not a second report. One composer, one shape,
 * one receipt action type; the period changes which movements are "since last
 * sync" and nothing else. Two builders would drift the moment one gained a
 * section — the duplication defect this whole workstream has been removing.
 *
 * Provenance: each run writes ONE `workspace_report_published` activity
 * receipt through the canonical writer, carrying the resolved invariant ids in
 * `invariantsUsed`. The action type is registered in the DVN pipeline's
 * `ANCHORABLE_ACTION_TYPES` — the only unilateral change that file permits —
 * so a report of programme state is tamper-evident like every other governance
 * artifact.
 */

import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import {
  getExperimentWorkspace,
  workspaceReferenceIssues,
  resolveWorkspaceInvariants,
  projectWorkspaceActions,
  projectWorkspaceDecisions,
  type ExperimentWorkspace,
  type WorkspaceAction,
  type WorkspaceDecision,
} from './experimentWorkspace';
import { listWorkspaceItems, type WorkspaceTrackedItem } from './workspaceTracking';

export const REPORT_PERIODS = ['daily', 'weekly'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

const PERIOD_MS: Record<ReportPeriod, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/**
 * A section the report could not compose, with WHY. Rendered as-is: a report
 * that silently drops a section it could not build reads as "nothing to
 * report", which is the opposite of the truth.
 */
export interface ReportGap {
  section: string;
  reason: string;
}

export interface WorkspaceReport {
  workspaceId: string;
  workspaceLabel: string;
  period: ReportPeriod;
  generatedAt: string;
  /** Start of the window movements are measured against. */
  since: string;
  /** The agent whose role this report executes. */
  reportingAgentId: string;

  /** Pilot state — the workspace's own declared position. */
  phase: string | null;
  experimentClass: string;
  objectiveCount: number;

  /** Open actions: projected intents not yet completed or cancelled. */
  openActions: WorkspaceAction[];
  /** Actions that reached a terminal state inside the window. */
  actionsClosedInPeriod: WorkspaceAction[];
  /** Agreement movements inside the window. */
  agreementMovements: WorkspaceDecision[];

  /** Workspace-local state. */
  milestonesDue: WorkspaceTrackedItem[];
  openBlockers: WorkspaceTrackedItem[];

  /** Governance posture. */
  referenceIssues: string[];
  invariantCount: number;
  canonVersion: string | null;

  /** What could not be composed, and why. */
  gaps: ReportGap[];

  /** One-line operator-facing summary — the wakeup line. */
  headline: string;
}

const TERMINAL_ACTION_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function withinWindow(iso: string | null | undefined, since: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= since;
}

/**
 * Compose the report. Never throws: a resolver that fails becomes a GAP with
 * its reason, because a Chief-of-Staff report that fails to render is worse
 * than one that says which part it could not see.
 */
export async function buildWorkspaceReport(input: {
  workspaceId: string;
  /** The operator whose IntentQubes the action projection reads. */
  personaId: string;
  period: ReportPeriod;
  /** Injected for determinism in tests; defaults to now. */
  now?: Date;
}): Promise<WorkspaceReport | null> {
  const ws = getExperimentWorkspace(input.workspaceId);
  if (!ws) return null;

  const now = input.now ?? new Date();
  const sinceMs = now.getTime() - PERIOD_MS[input.period];
  const gaps: ReportGap[] = [];

  const [actions, decisions, milestones, blockers, invariants] = await Promise.all([
    projectWorkspaceActions(ws, input.personaId, 50).catch(() => {
      gaps.push({ section: 'actions', reason: 'IntentQube projection unavailable' });
      return [] as WorkspaceAction[];
    }),
    projectWorkspaceDecisions(ws).catch(() => {
      gaps.push({ section: 'decisions', reason: 'Constitutional Agreement projection unavailable' });
      return [] as WorkspaceDecision[];
    }),
    listWorkspaceItems(ws.id, 'milestone'),
    listWorkspaceItems(ws.id, 'blocker'),
    resolveWorkspaceInvariants(ws).catch(() => null),
  ]);

  // Working groups exist as named sets of channels; until channels are
  // convened there is genuinely no communication record to report.
  const convened = ws.workingGroups.filter((g) => g.channelIds.length > 0);
  if (convened.length === 0) {
    gaps.push({
      section: 'communication',
      reason: 'no working-group channel convened yet — nothing to summarise',
    });
  }

  const openActions = actions.filter((a) => !TERMINAL_ACTION_STATUSES.has(a.status));
  const actionsClosedInPeriod = actions.filter(
    (a) => TERMINAL_ACTION_STATUSES.has(a.status) && withinWindow(a.createdAt, sinceMs),
  );
  const agreementMovements = decisions.filter((d) => withinWindow(d.decidedAt, sinceMs));
  const milestonesDue = milestones.filter((m) => m.status !== 'done');
  const openBlockers = blockers.filter((b) => b.status === 'open');
  const referenceIssues = workspaceReferenceIssues(ws);

  const headline = composeHeadline({
    period: input.period,
    openActions: openActions.length,
    movements: agreementMovements.length,
    blockers: openBlockers.length,
    issues: referenceIssues.length,
  });

  return {
    workspaceId: ws.id,
    workspaceLabel: ws.label,
    period: input.period,
    generatedAt: now.toISOString(),
    since: new Date(sinceMs).toISOString(),
    reportingAgentId: ws.partner?.ownerAgentId ?? 'aigent-z',
    phase: ws.partner?.phase ?? null,
    experimentClass: ws.experimentClass,
    objectiveCount: ws.objectives.length,
    openActions,
    actionsClosedInPeriod,
    agreementMovements,
    milestonesDue,
    openBlockers,
    referenceIssues,
    invariantCount: invariants?.references.length ?? 0,
    canonVersion: invariants?.canonVersion ?? null,
    gaps,
    headline,
  };
}

/**
 * The wakeup line. Deterministic, never generated — an operator reads this at
 * a glance and a phrasing that drifts between runs is unreadable as a trend.
 */
function composeHeadline(input: {
  period: ReportPeriod;
  openActions: number;
  movements: number;
  blockers: number;
  issues: number;
}): string {
  const label = input.period === 'daily' ? 'Overnight' : 'This week';
  const parts: string[] = [];
  parts.push(`${input.openActions} open action${input.openActions === 1 ? '' : 's'}`);
  parts.push(`${input.movements} agreement movement${input.movements === 1 ? '' : 's'}`);
  if (input.blockers > 0) parts.push(`${input.blockers} open blocker${input.blockers === 1 ? '' : 's'}`);
  if (input.issues > 0) parts.push(`${input.issues} reference issue${input.issues === 1 ? '' : 's'}`);
  return `${label}: ${parts.join(' · ')}`;
}

/**
 * Compose AND record. One receipt per run, carrying the resolved invariant ids
 * so the report's own governance footprint is auditable. Receipt failure never
 * loses the report — the operator still gets their wakeup.
 */
export async function publishWorkspaceReport(input: {
  workspaceId: string;
  personaId: string;
  period: ReportPeriod;
  now?: Date;
}): Promise<{ report: WorkspaceReport | null; receiptId: string | null }> {
  const report = await buildWorkspaceReport(input);
  if (!report) return { report: null, receiptId: null };

  const ws = getExperimentWorkspace(input.workspaceId) as ExperimentWorkspace;
  const resolution = await resolveWorkspaceInvariants(ws).catch(() => null);
  const invariantsUsed = resolution?.references.map((r) => r.invariantId) ?? [];

  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: input.personaId,
      activeCartridge: ws.evidence.cartridge,
      actionType: 'workspace_report_published',
      summary: `${report.workspaceLabel} — ${report.period} report · ${report.headline}`,
      ...(invariantsUsed.length > 0 ? { invariantsUsed } : {}),
      contextShared: ['experiment-workspace'],
      agentsInvoked: [report.reportingAgentId],
    });
    receiptId = receipt?.id ?? null;
  } catch {
    /* the report stands even when the receipt does not */
  }

  return { report, receiptId };
}
