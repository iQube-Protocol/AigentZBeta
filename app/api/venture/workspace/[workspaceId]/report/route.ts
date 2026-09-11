/**
 * GET  /api/venture/workspace/[workspaceId]/report?period=daily|weekly
 * POST /api/venture/workspace/[workspaceId]/report
 *
 * Aigent Z's administration of an ExperimentWorkspace (Horizen Phase 3;
 * Chrysalis tracker row 102). GET composes and returns the report; POST
 * composes AND records the `workspace_report_published` receipt — the shape a
 * scheduled Routine calls.
 *
 * The GET/POST split is the safety boundary, not a convenience: reading the
 * report must never write provenance, and a scheduled run must always do both.
 *
 * Authorisation is the workspace's Tier 2 membership rule, resolved through the
 * same self-view resolver the sibling route and the client gate use — one
 * membership answer, three consumers. Publishing (POST) additionally requires
 * platform admin: the report is a governance artifact and its receipt carries
 * the workspace's name, so a member may READ programme state without being able
 * to mint a record of it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveParticipationSelfView } from '@/services/passport/participationSelfView';
import { getExperimentWorkspace } from '@/services/experiments/experimentWorkspace';
import { resolveAuthoritativePersonaForRole } from '@/services/workflows/identityEnvelope';
import {
  buildWorkspaceReport,
  publishWorkspaceReport,
  REPORT_PERIODS,
  type ReportPeriod,
} from '@/services/experiments/workspaceReport';

export const dynamic = 'force-dynamic';

function readPeriod(req: NextRequest): ReportPeriod {
  const raw = new URL(req.url).searchParams.get('period');
  return (REPORT_PERIODS as readonly string[]).includes(raw ?? '')
    ? (raw as ReportPeriod)
    : 'daily';
}

/**
 * Shared gate: the ops token (scheduled runs) OR an authenticated caller who
 * is an admin or a workspace member.
 *
 * The ops-token branch mirrors the established scheduled-job convention
 * (`/api/access/finalize-receipts`, `/api/admin/kb/ingest-polity-commentary`):
 * a cron has no session and no persona, so it authenticates with
 * `ADMIN_OPS_TOKEN`. The receipt's attributed persona is resolved through
 * `resolveAuthoritativePersonaForRole('platform-state-reporter')` — the
 * `WORKFLOW_AUTHORITATIVE_PERSONAS` registry, not a guess (operator ruling,
 * 2026-07-30: Aigent Z composes and issues the platform-state report; see
 * codexes/packs/agentiq/updates/2026-07-30_platform-state-reporter-role-resolver.md).
 *
 * `WORKSPACE_REPORT_PERSONA_ID` is kept ONLY as a deprecated compatibility
 * override, used solely if the role resolver throws (e.g. a deployment that
 * has not yet configured `WORKFLOW_AUTHORITATIVE_PERSONAS`). It carries no
 * independent authority of its own and should be retired once every
 * deployment relies on the role resolver.
 */
async function authorize(req: NextRequest, workspaceId: string) {
  const opsToken = process.env.ADMIN_OPS_TOKEN;
  if (opsToken) {
    const header = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (presented === opsToken) {
      let attributedPersona: string | undefined;
      try {
        attributedPersona = resolveAuthoritativePersonaForRole('platform-state-reporter');
      } catch (resolverError) {
        // Deprecated compatibility fallback only — see comment above.
        attributedPersona = process.env.WORKSPACE_REPORT_PERSONA_ID;
        if (!attributedPersona) {
          return {
            error: NextResponse.json(
              {
                ok: false,
                error:
                  `Could not resolve the platform-state-reporter persona (${
                    resolverError instanceof Error ? resolverError.message : String(resolverError)
                  }), and the deprecated WORKSPACE_REPORT_PERSONA_ID compatibility override is not set either — a scheduled report has no caller, and its receipt must be attributed to a configured persona rather than a guessed one`,
              },
              { status: 500 },
            ),
          };
        }
      }
      if (!getExperimentWorkspace(workspaceId)) {
        return { error: NextResponse.json({ ok: false, error: 'Workspace not found' }, { status: 404 }) };
      }
      return { personaId: attributedPersona, isAdmin: true };
    }
  }

  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return { error: NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 }) };
  }
  const ws = getExperimentWorkspace(workspaceId);
  if (!ws) {
    return { error: NextResponse.json({ ok: false, error: 'Workspace not found' }, { status: 404 }) };
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return { error: NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 }) };
  }
  const isAdmin = persona.cartridgeFlags?.isAdmin === true;
  const selfView = await resolveParticipationSelfView(req, admin, {
    personaId: persona.personaId,
    authProfileId: persona.authProfileId,
  }).catch(() => ({ grants: [], passportIssued: false, delegationActive: false }));
  const isMember = selfView.grants.some((g) => g.accessDomain === ws.participation.domain);
  if (!isAdmin && !isMember) {
    return {
      error: NextResponse.json({ ok: false, error: 'Workspace membership required' }, { status: 403 }),
    };
  }
  return { personaId: persona.personaId, isAdmin };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const auth = await authorize(req, workspaceId);
  if ('error' in auth) return auth.error;

  const report = await buildWorkspaceReport({
    workspaceId,
    personaId: auth.personaId,
    period: readPeriod(req),
  });
  return NextResponse.json({ ok: true, report }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const auth = await authorize(req, workspaceId);
  if ('error' in auth) return auth.error;
  if (!auth.isAdmin) {
    return NextResponse.json(
      { ok: false, error: 'Publishing a workspace report requires platform admin' },
      { status: 403 },
    );
  }

  const { report, receiptId } = await publishWorkspaceReport({
    workspaceId,
    personaId: auth.personaId,
    period: readPeriod(req),
  });
  return NextResponse.json({ ok: true, report, receiptId }, { headers: { 'Cache-Control': 'no-store' } });
}
