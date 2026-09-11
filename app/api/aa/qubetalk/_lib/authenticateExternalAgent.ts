/**
 * AA-API external-agent authentication for the QubeTalk machine-to-machine lane.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * Two things were wrong with what it replaces, and the second one was live.
 *
 * 1. DUPLICATION. `authenticateExternalAgent` was copy-pasted verbatim into
 *    `app/api/aa/qubetalk/route.ts` and `app/api/aa/qubetalk/channels/route.ts`.
 *    Two copies of one authentication decision is the parallel-implementation
 *    defect (inv.engineering.037): fixing one and missing the other is the
 *    normal outcome, and that is precisely how a backdoor survives a fix.
 *
 * 2. A HARDCODED BACKDOOR CREDENTIAL. Both copies accepted the literal string
 *    `'demo-external-key'` as a valid API key, commented "For development" but
 *    with nothing confining it to development. Any caller sending
 *
 *        X-API-Key: demo-external-key
 *        X-Agent-ID: anything
 *
 *    could list channels and read the full message history of ANY tenant it
 *    cared to name, and post messages into any channel — in production. This is
 *    the 2026-07-28 anonymous QubeTalk read leak reachable through a second
 *    door: the front door was closed by `requireChannelAccess`, while this one
 *    stood open behind a string committed to the repository.
 *
 * ── What this does now ──────────────────────────────────────────────────────
 *
 * Accepts ONLY a key configured in the environment. When no key is configured
 * the lane is CLOSED — an unconfigured deployment authenticates nobody rather
 * than authenticating everybody, which is the direction a default must fail.
 *
 * ── What this deliberately does NOT do (flagged, not silently accepted) ──────
 *
 * The key is a single shared platform-wide secret, so any holder may name any
 * `tenant_id`. Scoping a key to a tenant needs the external-agent registry the
 * original code's comment promised ("in production, this would validate against
 * external agent registry") and that does not exist in this codebase. Inventing
 * one here would be a guess. The narrower change — removing the credential that
 * every reader of the repo already possesses — is the one that closes the leak.
 */

import type { NextRequest } from 'next/server';

export interface ExternalAgentAuth {
  success: boolean;
  agentId?: string;
  error?: string;
}

/** Keys accepted for the AA-API QubeTalk lane. Environment only — never literals. */
function configuredApiKeys(): string[] {
  return [process.env.AA_API_KEY, process.env.EXTERNAL_AGENT_API_KEY]
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter((k) => k.length > 0);
}

export function authenticateExternalAgent(request: NextRequest): ExternalAgentAuth {
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  const agentId = request.headers.get('x-agent-id');

  if (!apiKey && !authHeader) {
    return { success: false, error: 'Missing API key or authorization header' };
  }
  if (!agentId) {
    return { success: false, error: 'Missing agent ID header' };
  }

  const accepted = configuredApiKeys();
  if (accepted.length === 0) {
    // Fail CLOSED. With no key provisioned there is no way to distinguish a
    // legitimate agent from anyone else, so the honest answer is "nobody".
    return { success: false, error: 'External agent lane is not configured' };
  }

  const presented = (apiKey || authHeader?.replace(/^Bearer\s+/i, '') || '').trim();
  if (!presented || !accepted.includes(presented)) {
    return { success: false, error: 'Invalid API key' };
  }

  return { success: true, agentId: agentId.trim() };
}
