/**
 * Shared "Connect Claude" self-report persistence (2026-09-11).
 *
 * Moved out of MyCanvasTab.tsx so the Constitutional Internet Bridge and
 * KNYTs Bridge Choose surfaces can mount the same `ConnectClaudeExperience`
 * without duplicating this wiring. Per the existing `act/connect-agent`
 * route's own doc comment, this is a SELF-REPORT, not a verified Threshold
 * OAuth crossing — same fidelity as the CI Bridge's other ACT self-reports.
 *
 * Deliberately still recorded against the CI Bridge campaign for every
 * mount point (MyCanvas, CI Bridge, KNYTs Bridge) — reusing the existing
 * `act/connect-agent` route unmodified, never a second connect-agent
 * backend, per the operator instruction not to alter MCP auth or backend
 * behavior for this pass.
 */

import { personaFetch } from '@/utils/personaSpine';

const CI_CONNECT_AGENT_ROUTE = '/api/journey/constitutional-internet-bridge/act/connect-agent';

export async function checkClaudeAgentConnected(): Promise<boolean> {
  const res = await personaFetch(CI_CONNECT_AGENT_ROUTE, { cache: 'no-store' });
  const json = await res.json().catch(() => null);
  return Boolean(json?.connected);
}

export async function recordClaudeAgentConnected(): Promise<void> {
  await personaFetch(CI_CONNECT_AGENT_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent: 'claude' }),
  });
}
