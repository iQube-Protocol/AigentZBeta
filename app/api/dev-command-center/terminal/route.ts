/**
 * POST /api/dev-command-center/terminal — the Constitutional Terminal (CFS-020
 * CDE). Executes ONLY the strict, read-only whitelist defined in
 * services/devCommandCenter/terminalCommands.ts. This is a command surface, NOT
 * a shell: there is no eval, no child_process, no shell, and no dynamic
 * dispatch beyond the whitelist switch below. Arbitrary execution stays human
 * under CFS-016 D1 — anything outside the set returns the exact constitutional
 * refusal line.
 *
 * Admin-gated exactly like /api/research/lifecycle (getActivePersona +
 * cartridgeFlags.isAdmin). Responses are plain-text lines (string[]). Env
 * VALUES and T0 identifiers NEVER appear in output; receipt listings are
 * filtered to T2-safe fields.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  parseTerminalCommand,
  helpLines,
  renderEnvCheck,
} from '@/services/devCommandCenter/terminalCommands';
import {
  computeEnvPresence,
  summariseEnv,
  getCanisterSummary,
  getReceiptPipelineState,
} from '@/app/api/dev-command-center/_lib/diagnostics';
import {
  ghTree,
  ghFile,
  ghRecentCommits,
  ghListBranches,
  githubConfigured,
  GITHUB_MISSING_ENV,
  GITHUB_REPO,
} from '@/app/api/dev-command-center/_lib/github';
import { getDVNStatus } from '@/services/ops/dvnService';
import { listResearchObjects } from '@/services/research/lifecycle';
import { buildEscalationLog } from '@/app/api/dev-command-center/_lib/diagnostics';
import {
  recentServerCalls,
  recordServerCall,
  SERVER_CALL_BUFFER_CAP,
} from '@/services/devCommandCenter/requestTelemetry';

export const dynamic = 'force-dynamic';

const CAT_MAX_LINES = 200;

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { command?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const command = typeof body.command === 'string' ? body.command : '';

  const parsed = parseTerminalCommand(command);
  if (!parsed.ok) {
    // The refusal / usage line is normal terminal output, not an HTTP error.
    return NextResponse.json({ ok: true, lines: [parsed.error] });
  }

  const p = parsed.parsed;
  // Best-effort telemetry: record that a whitelisted command executed (path
  // template + method + status only — never the command line or its args).
  recordServerCall({ method: 'POST', path: '/api/dev-command-center/terminal', status: 200, ms: Date.now() - t0 });
  try {
    switch (p.command) {
      case 'help':
        return NextResponse.json({ ok: true, lines: helpLines() });

      case 'env-check':
        return NextResponse.json({ ok: true, lines: renderEnvCheck(computeEnvPresence()) });

      case 'status': {
        const env = summariseEnv(computeEnvPresence());
        const [canisters, pipeline] = await Promise.all([
          getCanisterSummary(),
          getReceiptPipelineState(persona.personaId, 25),
        ]);
        const canOk = canisters.items.filter((i) => i.ok).length;
        const lines = [
          'Constitutional Development Environment — platform status',
          '',
          `  env         ${env.present}/${env.total} tracked vars present${env.missing.length ? ` (missing: ${env.missing.join(', ')})` : ''}`,
          `  canisters   ${canOk}/${canisters.items.length} configured${canisters.ok ? '' : ' — some not configured'}`,
          `  receipts    ${pipeline.total} recent · recorded ${pipeline.byStatus.dvn_recorded} · pending ${pipeline.byStatus.dvn_pending} · failed ${pipeline.byStatus.dvn_failed} · local ${pipeline.byStatus.local}`,
        ];
        if (pipeline.byStatus.dvn_failed > 0) {
          lines.push('');
          lines.push(`  ⚠ ${pipeline.byStatus.dvn_failed} receipt(s) in dvn_failed — retry via /api/assistant/receipts/[receiptId]/retry-dvn`);
        }
        return NextResponse.json({ ok: true, lines });
      }

      case 'canisters': {
        const canisters = await getCanisterSummary();
        const lines = ['ICP canister health (configuration + id):', ''];
        for (const i of canisters.items) {
          lines.push(`  ${i.ok ? '[✓]' : '[·]'}  ${i.name}  —  ${i.details}`);
        }
        lines.push('');
        lines.push('Live cycle balances: /api/ops/canisters/cycles-status (controller identity required).');
        return NextResponse.json({ ok: true, lines });
      }

      case 'receipts': {
        const pipeline = await getReceiptPipelineState(persona.personaId, p.count ?? 10);
        if (pipeline.recent.length === 0) {
          return NextResponse.json({ ok: true, lines: ['no activity receipts for this persona yet'] });
        }
        const lines = [`last ${pipeline.recent.length} activity receipts (T2-safe fields):`, ''];
        for (const r of pipeline.recent) {
          lines.push(`  ${r.createdAt.slice(0, 19).replace('T', ' ')}  ${r.status.padEnd(12)}  ${r.actionType}  ${r.id.slice(0, 8)}…`);
        }
        return NextResponse.json({ ok: true, lines });
      }

      case 'session': {
        const client = getSupabaseServer();
        if (!client) return NextResponse.json({ ok: true, lines: ['session store unavailable (Supabase not configured)'] });
        // Same read path as GET /api/dev-command-center/sessions — caller-owned,
        // latest first. persona_id (T0) is the filter key, never returned.
        const { data, error } = await client
          .from('dev_loop_sessions')
          .select('session_id, stage, updated_at')
          .eq('persona_id', persona.personaId)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (error) return NextResponse.json({ ok: true, lines: [`session read failed: ${error.message}`] });
        const row = data?.[0];
        if (!row) return NextResponse.json({ ok: true, lines: ['no dev-loop session yet — start one from the capsule strip'] });
        return NextResponse.json({
          ok: true,
          lines: [
            'current dev-loop session:',
            '',
            `  stage      ${row.stage}`,
            `  session    ${String(row.session_id).slice(0, 16)}…`,
            `  updated    ${String(row.updated_at).slice(0, 19).replace('T', ' ')}`,
          ],
        });
      }

      case 'dvn': {
        const sub = p.dvnSub ?? 'status';
        if (sub === 'failed') {
          const pipeline = await getReceiptPipelineState(persona.personaId, 50);
          const log = buildEscalationLog(pipeline);
          if (log.entries.length === 0) {
            return NextResponse.json({ ok: true, lines: ['no dvn_failed receipts in the recent window — provenance trail intact'] });
          }
          const lines = [`dvn failed — ${log.entries.length} receipt(s) in dvn_failed (newest first):`, ''];
          for (const e of log.entries) {
            lines.push(`  ${e.createdAt.slice(0, 19).replace('T', ' ')}  ${e.actionType}  ${e.id.slice(0, 8)}…`);
          }
          lines.push('');
          lines.push(`retry a failed receipt via ${log.retryRoute}`);
          return NextResponse.json({ ok: true, lines });
        }
        // status | pending — both read the same live DVN canister snapshot.
        const dvn = await getDVNStatus();
        const lines = [
          `DVN pipeline (${sub}):`,
          '',
          `  reachable      ${dvn.ok ? 'yes' : 'no'}`,
          `  pending+ready  ${dvn.pendingMessages}`,
          `  validators     ${dvn.validatorsOnline ?? 0} online`,
          `  detail         ${dvn.details || '—'}`,
        ];
        return NextResponse.json({ ok: true, lines });
      }

      case 'logs': {
        const pipeline = await getReceiptPipelineState(persona.personaId, Math.max(p.count ?? 15, 15));
        const log = buildEscalationLog(pipeline);
        if (log.entries.length === 0) {
          return NextResponse.json({
            ok: true,
            lines: [
              'platform escalation log (DB-durable) — no dvn_failed receipts in the recent window.',
              'Not a raw server log tail; a CloudWatch tail is a follow-on gated on the AWS SDK.',
            ],
          });
        }
        const shown = log.entries.slice(0, p.count ?? 15);
        const lines = [`platform escalation log (DB-durable) — ${shown.length} dvn_failed receipt(s), newest first:`, ''];
        for (const e of shown) {
          lines.push(`  ${e.createdAt.slice(0, 19).replace('T', ' ')}  [dvn_failed]  ${e.actionType}  ${e.id.slice(0, 8)}…`);
        }
        lines.push('');
        lines.push(`retry via ${log.retryRoute} · CloudWatch tail is a follow-on (AWS SDK not a dependency).`);
        return NextResponse.json({ ok: true, lines });
      }

      case 'net': {
        const calls = recentServerCalls(p.count ?? 15);
        if (calls.length === 0) {
          return NextResponse.json({
            ok: true,
            lines: [
              'no server calls recorded on this compute instance yet.',
              `(best-effort ring buffer, cap ${SERVER_CALL_BUFFER_CAP} — THIS compute instance only, resets on cold start)`,
            ],
          });
        }
        const lines = [
          `recent server API calls — ${calls.length} (this compute instance only, resets on cold start):`,
          '',
        ];
        for (const c of calls) {
          lines.push(`  ${c.at.slice(11, 19)}  ${c.method.padEnd(4)}  ${String(c.status).padEnd(3)}  ${String(c.ms).padStart(5)}ms  ${c.path}`);
        }
        return NextResponse.json({ ok: true, lines });
      }

      case 'experiments': {
        const research = await listResearchObjects();
        if (!research.ok) {
          return NextResponse.json({ ok: true, lines: [`experiments unavailable: ${research.error ?? 'unknown error'}`] });
        }
        if (research.objects.length === 0) {
          return NextResponse.json({ ok: true, lines: ['no research objects in the durable lab record yet'] });
        }
        const byState = new Map<string, number>();
        for (const o of research.objects) {
          byState.set(o.lifecycleState, (byState.get(o.lifecycleState) ?? 0) + 1);
        }
        const lines = [`research objects — ${research.objects.length} total by lifecycle state:`, ''];
        for (const [state, n] of byState) lines.push(`  ${String(n).padStart(3)}  ${state}`);
        lines.push('');
        lines.push('recent (newest last):');
        for (const o of research.objects.slice(-Math.min(research.objects.length, 15))) {
          lines.push(`  ${o.updatedAt.slice(0, 19).replace('T', ' ')}  ${o.lifecycleState.padEnd(16)}  ${o.objectKind}  ${o.objectId.slice(0, 8)}…`);
        }
        return NextResponse.json({ ok: true, lines });
      }

      case 'repo': {
        if (!githubConfigured()) {
          return NextResponse.json({
            ok: true,
            lines: [`${GITHUB_MISSING_ENV} is not configured on this server.`, 'Add it to the Amplify environment to enable read-only repo access.'],
          });
        }
        if (p.sub === 'branches') {
          const r = await ghListBranches(50);
          if (!r.ok || !r.data) return NextResponse.json({ ok: true, lines: [`repo branches failed: ${r.error}`] });
          return NextResponse.json({
            ok: true,
            lines: [`branches of ${GITHUB_REPO}:`, '', ...r.data.map((b) => `  ${b.commitSha}  ${b.name}`)],
          });
        }
        if (p.sub === 'log') {
          const r = await ghRecentCommits(p.count ?? 15);
          if (!r.ok || !r.data) return NextResponse.json({ ok: true, lines: [`repo log failed: ${r.error}`] });
          return NextResponse.json({
            ok: true,
            lines: [`recent commits on dev (${GITHUB_REPO}):`, '', ...r.data.map((c) => `  ${c.sha}  ${c.date}  ${c.author}  ${c.message}`)],
          });
        }
        if (p.sub === 'ls') {
          const r = await ghTree(p.path ?? '');
          if (!r.ok || !r.data) return NextResponse.json({ ok: true, lines: [`repo ls failed: ${r.error}`] });
          return NextResponse.json({
            ok: true,
            lines: [`${p.path || '/'} (dev):`, '', ...r.data.map((e) => `  ${e.type === 'dir' ? 'd' : '-'}  ${e.name}`)],
          });
        }
        // p.sub === 'cat'
        const r = await ghFile(p.path ?? '');
        if (!r.ok || !r.data) return NextResponse.json({ ok: true, lines: [`repo cat failed: ${r.error}`] });
        if (r.data.note) return NextResponse.json({ ok: true, lines: [`${r.data.path}: ${r.data.note}`] });
        const allLines = r.data.text.split('\n');
        const shown = allLines.slice(0, CAT_MAX_LINES);
        const lines = [`${r.data.path} (dev):`, '', ...shown];
        if (allLines.length > CAT_MAX_LINES) {
          lines.push('');
          lines.push(`…[truncated — showing first ${CAT_MAX_LINES} of ${allLines.length} lines]`);
        }
        return NextResponse.json({ ok: true, lines });
      }
    }
  } catch (err) {
    return NextResponse.json({
      ok: true,
      lines: [`command failed: ${err instanceof Error ? err.message : String(err)}`],
    });
  }
}
