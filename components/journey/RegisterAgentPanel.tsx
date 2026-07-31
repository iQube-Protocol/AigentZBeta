'use client';

/**
 * RegisterAgentPanel — the Register stage's real surface (agent-selectable
 * Register stage, 2026-07-31). Replaces the bare `AgentCardSurface` (which
 * only ever displayed MoneyPenny's card) with a panel that lets the operator
 * choose WHICH agent to register in Horizen's ERC-8004 registry, then drives
 * the real 3-step server flow (services/horizen/registrationClient.ts):
 * prepare (build the unsigned tx, sign nothing) -> operator review -> an
 * explicit confirm -> broadcast (signs locally + submits) -> status (single
 * check per call; this panel re-polls on an interval until confirmed).
 *
 * "MoneyPenny is the demo agent; Aigent Nakamoto is the dry-run agent" —
 * operator ruling 2026-07-31. The dropdown lists both
 * (services/horizen/registrableAgents.ts), plus — stubbed, honestly — the
 * operator's own sponsored agents from the existing, real
 * /api/persona/sponsored-agents route. A sponsored agent has no
 * registry_assets/Agent Card/owner-key prerequisites yet, so it lists but
 * stays disabled with a note, rather than fabricating registrability. This
 * is the seam a future agent becomes real Horizen-registrable through: add
 * it to registrableAgents.ts, give it a registry_assets row + Agent Card
 * route, and it stops being disabled here — no UI change required.
 *
 * Every route this panel calls resolves getActivePersona server-side — MUST
 * use personaFetch, never raw fetch (CLAUDE.md Identity & Access Spine rule),
 * mirroring PulseTransparencyToggle.tsx's own convention.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, ShieldAlert } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { AgentCardSurface } from './AgentCardSurface';

interface RegistrableAgentOption {
  slug: string;
  displayName: string;
  agentCardPath: string;
}

/**
 * Mirrors services/horizen/registrableAgents.ts's REGISTRABLE_AGENTS.
 * Duplicated as a small client-safe literal (not imported) because that
 * module also exports server-only env-var-name plumbing
 * (ownerPrivateKeyEnvVar) that has no reason to reach the browser bundle —
 * the slugs/labels/paths themselves are the only part a client needs, and
 * they are covered by tests/horizen-registrable-agents.test.ts on the server
 * side, so a drift here would fail loudly (a 400 UNKNOWN_AGENT from
 * register/prepare), never silently.
 */
const PILOT_AGENTS: RegistrableAgentOption[] = [
  { slug: 'moneypenny', displayName: 'Aigent MoneyPenny', agentCardPath: '/api/agents/moneypenny/agent-card.json' },
  { slug: 'nakamoto', displayName: 'Aigent Nakamoto', agentCardPath: '/api/agents/nakamoto/agent-card.json' },
];

interface SponsoredAgent {
  agentRootId: string;
  displayName: string;
  agentCardUrl: string | null;
}

interface UnsignedTx {
  to?: string;
  data?: string;
  value?: string | number;
  chainId?: string | number;
}

type FlowState =
  | { step: 'idle' }
  | { step: 'preparing' }
  | { step: 'review'; unsignedTx: UnsignedTx; agentCardUrl: string; network: string }
  | { step: 'broadcasting'; unsignedTx: UnsignedTx; network: string }
  | { step: 'polling'; txHash: string; ownerWalletAddress: string; network: string; attempts: number }
  | { step: 'confirmed'; tokenId: string }
  | { step: 'error'; message: string };

const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 8000;

export function RegisterAgentPanel(_props: { personaId?: string }) {
  const [agentSlug, setAgentSlug] = useState<string>(PILOT_AGENTS[0].slug);
  const [sponsoredAgents, setSponsoredAgents] = useState<SponsoredAgent[]>([]);
  const [cardVersion, setCardVersion] = useState(0);
  const [flow, setFlow] = useState<FlowState>({ step: 'idle' });
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stub: the operator's own sponsored agents, real data from the existing
  // spine-gated route — never fabricated. None of these are Horizen-
  // registrable yet (no registry_assets/Agent Card prerequisite), so they
  // render disabled with an honest note rather than a working option.
  useEffect(() => {
    (async () => {
      try {
        const res = await personaFetch('/api/persona/sponsored-agents', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json?.agents)) {
          setSponsoredAgents(
            json.agents.map((a: { agentRootId: string; displayName: string; agentCardUrl: string | null }) => ({
              agentRootId: a.agentRootId,
              displayName: a.displayName,
              agentCardUrl: a.agentCardUrl,
            })),
          );
        }
      } catch {
        // Soft-fail — the pilot-agent dropdown still works without this.
      }
    })();
  }, []);

  useEffect(() => () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []);

  const selectedAgent = PILOT_AGENTS.find((a) => a.slug === agentSlug) ?? PILOT_AGENTS[0];

  const prepare = useCallback(async () => {
    setFlow({ step: 'preparing' });
    try {
      const res = await personaFetch('/api/journey/moneypenny-horizen/register/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentSlug }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error ?? `Register/prepare failed (${res.status})`);
      }
      setFlow({ step: 'review', unsignedTx: json.unsignedTx, agentCardUrl: json.agentCardUrl, network: json.network });
    } catch (err) {
      setFlow({ step: 'error', message: err instanceof Error ? err.message : 'Could not prepare registration' });
    }
  }, [agentSlug]);

  const pollStatus = useCallback(
    async (txHash: string, ownerWalletAddress: string, network: string, attempts: number) => {
      try {
        const res = await personaFetch('/api/journey/moneypenny-horizen/register/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentSlug, txHash, ownerWalletAddress, network }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json?.error ?? `Register/status failed (${res.status})`);
        }
        if (json.confirmed) {
          setFlow({ step: 'confirmed', tokenId: json.tokenId });
          setCardVersion((v) => v + 1);
          return;
        }
      } catch (err) {
        setFlow({ step: 'error', message: err instanceof Error ? err.message : 'Could not check registration status' });
        return;
      }
      if (attempts + 1 >= MAX_POLL_ATTEMPTS) {
        setFlow({ step: 'error', message: 'Horizen has not confirmed registration yet — check back later, or try "Check status" again.' });
        return;
      }
      setFlow({ step: 'polling', txHash, ownerWalletAddress, network, attempts: attempts + 1 });
      pollTimerRef.current = setTimeout(() => void pollStatus(txHash, ownerWalletAddress, network, attempts + 1), POLL_INTERVAL_MS);
    },
    [agentSlug],
  );

  const broadcast = useCallback(
    async (unsignedTx: UnsignedTx, network: string) => {
      setFlow({ step: 'broadcasting', unsignedTx, network });
      try {
        const res = await personaFetch('/api/journey/moneypenny-horizen/register/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentSlug, confirm: true, unsignedTx }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json?.error ?? `Register/broadcast failed (${res.status})`);
        }
        setFlow({ step: 'polling', txHash: json.txHash, ownerWalletAddress: json.ownerWalletAddress, network: json.network, attempts: 0 });
        void pollStatus(json.txHash, json.ownerWalletAddress, json.network, 0);
      } catch (err) {
        setFlow({ step: 'error', message: err instanceof Error ? err.message : 'Could not broadcast registration' });
      }
    },
    [agentSlug, pollStatus],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
        <label className="text-[10px] uppercase tracking-wide text-slate-500" htmlFor="register-agent-select">
          Agent to register
        </label>
        <select
          id="register-agent-select"
          value={agentSlug}
          onChange={(e) => {
            setAgentSlug(e.target.value);
            setFlow({ step: 'idle' });
          }}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200"
        >
          <optgroup label="Pilot agents">
            {PILOT_AGENTS.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.displayName}
              </option>
            ))}
          </optgroup>
          {sponsoredAgents.length > 0 && (
            <optgroup label="Your sponsored agents (Horizen registration not yet available)">
              {sponsoredAgents.map((a) => (
                <option key={a.agentRootId} value={a.agentRootId} disabled>
                  {a.displayName}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <AgentCardSurface key={`${agentSlug}-${cardVersion}`} route={selectedAgent.agentCardPath} />

      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
        {flow.step === 'idle' && (
          <button
            onClick={() => void prepare()}
            className="flex items-center gap-1.5 rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-900/40"
          >
            Register {selectedAgent.displayName} in Horizen <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}

        {flow.step === 'preparing' && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Building the registration transaction…
          </div>
        )}

        {flow.step === 'review' && (
          <div className="text-xs">
            <p className="flex items-center gap-1.5 font-medium text-amber-200">
              <ShieldAlert className="h-3.5 w-3.5" /> Review before broadcasting
            </p>
            <p className="mt-1 text-slate-400">
              This signs and submits a real, gas-spending, irreversible transaction on {flow.network}. It cannot be
              undone once broadcast.
            </p>
            <div className="mt-2 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[11px] text-slate-300">
              <p>to: {flow.unsignedTx.to}</p>
              <p className="truncate">data: {flow.unsignedTx.data}</p>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => void broadcast(flow.unsignedTx, flow.network)}
                className="rounded-md border border-rose-800/60 bg-rose-950/30 px-3 py-1.5 font-medium text-rose-200 hover:bg-rose-900/40"
              >
                Confirm &amp; broadcast
              </button>
              <button
                onClick={() => setFlow({ step: 'idle' })}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800/60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {flow.step === 'broadcasting' && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing and submitting to Horizen…
          </div>
        )}

        {flow.step === 'polling' && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Waiting for Horizen to confirm ({flow.attempts}/{MAX_POLL_ATTEMPTS})…
          </div>
        )}

        {flow.step === 'confirmed' && (
          <div className="flex items-start gap-2 text-xs text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              {selectedAgent.displayName} is registered — Horizen tokenId <span className="font-mono">{flow.tokenId}</span>.
              The Verify stage can now authorize Pulse/P&amp;L transparency.
            </p>
          </div>
        )}

        {flow.step === 'error' && (
          <div className="flex items-start gap-2 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              {/* Some refusals (e.g. UNSIGNED_TX_UNAVAILABLE) embed the raw MCP
                  arguments + response so the exact call/response is visible —
                  never a bare "not found" — rendered as a scrollable, wrapped
                  block rather than a single unreadable paragraph. */}
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-rose-900/40 bg-rose-950/20 p-2 font-mono text-[11px] leading-snug text-rose-200">
                {flow.message}
              </pre>
              <button
                onClick={() => setFlow({ step: 'idle' })}
                className="mt-2 rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800/60"
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RegisterAgentPanel;
