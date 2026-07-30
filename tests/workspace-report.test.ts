/**
 * Workspace report canaries — Aigent Z's workspace administration (Horizen
 * Phase 3; Chrysalis tracker row 102, built as ONE increment).
 *
 * What these guard:
 *
 *  1. ONE COMPOSER, TWO WINDOWS. Daily and weekly differ only in the window
 *     movements are measured against. Two builders would drift the moment one
 *     gained a section — the duplication defect this workstream exists to end,
 *     and the reason the audit said "do not build twice".
 *  2. NO NEW DATA SOURCE. Every line composes from the Phase 2 spine's own
 *     resolvers. A direct table read here would make the report a second view
 *     of programme state that can disagree with the workspace surface.
 *  3. GAPS ARE REPORTED, NOT DROPPED. A section the composer could not build
 *     appears as a gap with its reason. Silently omitting it reads as "nothing
 *     to report", which is the opposite of the truth.
 *  4. THE ACTION TYPE IS DECLARED IN ALL THREE PLACES. The 2026-07-15 and
 *     2026-07-26 receipt-drift incidents were both a type landing in some
 *     places and not others; builds do not fail on it and receipt writes are
 *     wrapped in empty catches, so the loss is silent.
 *  5. READING NEVER WRITES. GET composes; POST publishes and requires admin.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { REPORT_PERIODS, buildWorkspaceReport } from '../services/experiments/workspaceReport';
import { PARTNER_WORKSPACES } from '../services/venture/partnerWorkspace';

const REPORT_PATH = 'services/experiments/workspaceReport.ts';
const ROUTE_PATH = 'app/api/venture/workspace/[workspaceId]/report/route.ts';
const PIPELINE_PATH = 'services/dvn/activityReceiptDvnPipeline.ts';
const SERVICE_PATH = 'services/receipts/activityReceiptService.ts';
const MIGRATION_PATH = 'supabase/migrations/20260824000100_receipt_action_type_workspace_report.sql';

const WORKSPACE_ID = PARTNER_WORKSPACES[0].id;

describe('one composer, two windows', () => {
  it('daily and weekly are the same shape with different windows', async () => {
    const now = new Date('2026-07-27T09:00:00.000Z');
    const [daily, weekly] = await Promise.all([
      buildWorkspaceReport({ workspaceId: WORKSPACE_ID, personaId: 'p', period: 'daily', now }),
      buildWorkspaceReport({ workspaceId: WORKSPACE_ID, personaId: 'p', period: 'weekly', now }),
    ]);
    expect(daily).not.toBeNull();
    expect(weekly).not.toBeNull();
    // Same keys — one shape.
    expect(Object.keys(daily!).sort()).toEqual(Object.keys(weekly!).sort());
    // Different windows, and the weekly window is the wider one.
    expect(Date.parse(weekly!.since)).toBeLessThan(Date.parse(daily!.since));
    expect(daily!.generatedAt).toBe(weekly!.generatedAt);
    expect(REPORT_PERIODS).toContain(daily!.period);
  });

  it('exposes exactly one build entry point and one publish entry point', () => {
    const src = stripComments(readSource(REPORT_PATH));
    const builders = src.match(/export async function build\w*Report/g) ?? [];
    const publishers = src.match(/export async function publish\w*Report/g) ?? [];
    expect(builders, 'more than one report builder — the "do not build twice" defect').toHaveLength(1);
    expect(publishers).toHaveLength(1);
    // A period-branched body is the same defect wearing a different shape.
    expect(
      /period === 'weekly'\s*\?\s*build|if \(input\.period === 'weekly'\) return/.test(src),
      'the composer branches into a separate weekly report',
    ).toBe(false);
  });

  it('returns null for an unknown workspace rather than an empty report', async () => {
    expect(
      await buildWorkspaceReport({ workspaceId: 'no-such-workspace', personaId: 'p', period: 'daily' }),
    ).toBeNull();
  });
});

describe('composed from the spine, never from a second source', () => {
  it('reads only the spine resolvers and the workspace-local store', () => {
    const src = stripComments(readSource(REPORT_PATH));
    for (const resolver of [
      'projectWorkspaceActions',
      'projectWorkspaceDecisions',
      'resolveWorkspaceInvariants',
      'workspaceReferenceIssues',
      'listWorkspaceItems',
    ]) {
      expect(src, `report does not compose from ${resolver}`).toContain(resolver);
    }
    // No direct database access — that would be the parallel view.
    expect(src).not.toMatch(/getSupabaseServer|\.from\(/);
  });

  it('reports what it could not compose, with a reason', async () => {
    const report = await buildWorkspaceReport({
      workspaceId: WORKSPACE_ID,
      personaId: 'p',
      period: 'daily',
    });
    expect(report).not.toBeNull();
    // No working-group channel is convened yet, so the communication section
    // is a declared gap — not an omission.
    const communication = report!.gaps.find((g) => g.section === 'communication');
    expect(communication, 'the un-composable communication section was dropped silently').toBeTruthy();
    expect(communication!.reason.length).toBeGreaterThan(15);
    // The headline is deterministic — an operator reads it as a trend.
    expect(report!.headline).toMatch(/^Overnight: /);
  });

  it('names the workspace owner as the reporting agent, from the registry', async () => {
    const report = await buildWorkspaceReport({
      workspaceId: WORKSPACE_ID,
      personaId: 'p',
      period: 'weekly',
    });
    expect(report!.reportingAgentId).toBe(PARTNER_WORKSPACES[0].ownerAgentId);
    expect(report!.workspaceLabel).toContain(PARTNER_WORKSPACES[0].partnerName);
  });
});

describe('the receipt action type is declared everywhere it must be', () => {
  const ACTION = 'workspace_report_published';

  it('is in the TypeScript union, the DVN anchorable set, and the CHECK constraint', () => {
    expect(stripComments(readSource(SERVICE_PATH))).toContain(`'${ACTION}'`);
    expect(stripComments(readSource(PIPELINE_PATH))).toContain(`'${ACTION}'`);
    expect(readSource(MIGRATION_PATH)).toContain(`'${ACTION}'`);
  });

  it('the migration rebuilds the constraint wholesale rather than appending', () => {
    const sql = readSource(MIGRATION_PATH);
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check/);
    expect(sql).toMatch(/ADD CONSTRAINT activity_receipts_action_type_check/);
    // A wholesale rebuild must still carry the pre-existing types.
    for (const kept of ['intent_queued', 'venture_blueprint_handoff', 'plan_cancelled']) {
      expect(sql, `${kept} was dropped from the rebuilt constraint`).toContain(`'${kept}'`);
    }
  });

  it('the DVN change is an action-type addition only', () => {
    // The one unilateral change that file permits. If a diff ever touches the
    // state machine or canister call, this canary is the reminder that it
    // needs operator approval first.
    const src = stripComments(readSource(PIPELINE_PATH));
    expect(src).toMatch(/ANCHORABLE_ACTION_TYPES = new Set<string>\(\[/);
    expect(src).toMatch(/dvn_pending/);
    expect(src).toMatch(/dvn_failed/);
  });
});

describe('reading never writes', () => {
  it('GET composes, POST publishes and requires admin', () => {
    const src = stripComments(readSource(ROUTE_PATH));
    const get = src.slice(src.indexOf('export async function GET'), src.indexOf('export async function POST'));
    const post = src.slice(src.indexOf('export async function POST'));
    expect(get).toContain('buildWorkspaceReport');
    expect(get, 'GET publishes a receipt').not.toContain('publishWorkspaceReport');
    expect(post).toContain('publishWorkspaceReport');
    expect(post).toMatch(/!auth\.isAdmin/);
    expect(post).toMatch(/status: 403/);
  });

  it('a scheduled run resolves the platform-state-reporter role first, never guessing a persona', () => {
    // A cron has no session. The established convention (finalize-receipts,
    // ingest-polity-commentary) is an ADMIN_OPS_TOKEN bearer — but a receipt
    // still needs an attributed persona. Primary authority is the
    // platform-state-reporter role (resolved from WORKFLOW_AUTHORITATIVE_
    // PERSONAS, operator ruling 2026-07-30: Aigent Z, not MoneyPenny, is the
    // report producer). WORKSPACE_REPORT_PERSONA_ID survives only as a
    // deprecated compatibility override with no independent authority.
    const src = stripComments(readSource(ROUTE_PATH));
    expect(src).toMatch(/ADMIN_OPS_TOKEN/);
    expect(src).toMatch(/resolveAuthoritativePersonaForRole\(\s*['"]platform-state-reporter['"]\s*\)/);
    expect(src).toMatch(/WORKSPACE_REPORT_PERSONA_ID/);
    // Unset (and resolver failure) → refuse, naming the failure. Never a
    // silently guessed persona.
    expect(src).toMatch(/if \(!attributedPersona\)/);
    expect(src).toMatch(/status: 500/);
    expect(src, 'the ops path falls back to a resolved persona').not.toMatch(
      /attributedPersona \?\?|attributedPersona \|\|/,
    );

    // The workflow must call the route the surface reads — not a second path.
    const wf = readSource('.github/workflows/workspace-report.yml');
    expect(wf).toMatch(/\/api\/venture\/workspace\/horizen-pilot-series-001\/report\?period=/);
    expect(wf).toMatch(/ADMIN_OPS_TOKEN/);
    expect(wf).toMatch(/cron: '0 7 \* \* \*'/);
    expect(wf).toMatch(/cron: '30 7 \* \* 1'/);
  });

  it('membership is resolved through the shared self-view resolver', () => {
    const src = stripComments(readSource(ROUTE_PATH));
    expect(src).toMatch(/getActivePersona\(req\)/);
    expect(src).toMatch(/resolveParticipationSelfView/);
    // One gate function, used by both verbs — not two divergent copies.
    expect((src.match(/async function authorize/g) ?? []).length).toBe(1);
  });
});
