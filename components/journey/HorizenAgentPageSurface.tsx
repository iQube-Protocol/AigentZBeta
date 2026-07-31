'use client';

/**
 * HorizenAgentPageSurface — Horizen's own human-readable agent registry page,
 * embedded as an external functional surface (operator-supplied URL pattern,
 * confirmed live 2026-07-31): `https://agent-registry.horizenlabs.io/agent/
 * {agentIdentifier}?network={network}` (example: `.../agent/0xZkSignalAgent
 * ?network=sepolia`).
 *
 * Reuses the existing IframeTab mechanism (already used for metame.com) —
 * never a second embed component. The URL is NEVER accepted as client input:
 * it is read from the selected agent's own served Agent Card
 * (`metadata.horizen.humanReadableUrl`, itself computed server-side in
 * services/horizen/registrationClient.ts from a CONFIRMED Horizen reread —
 * see services/horizen/agentPageUrl.ts), then re-validated against the
 * allowlist here before ever reaching an <iframe src>. Renders the honest
 * "awaiting Horizen" blocked state — never a guessed URL — until the
 * selected agent's binding actually resolves an agentIdentifier.
 *
 * Used by BOTH the Register stage (identity-focused: "the agent exists in
 * Horizen") and the Verify stage (transparency-focused: "Pulse/P&L state is
 * active") — same page, different framing, per operator ruling 2026-07-31.
 * If Horizen later supplies a dedicated Pulse/P&L monitoring URL, only the
 * `mode: 'verify'` branch's URL source needs to change — the allowlist and
 * embed mechanism stay the same.
 */

import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import { IframeTab } from '@/app/triad/components/codex/tabs/IframeTab';
import { isHorizenAgentPageUrl } from '@/services/horizen/agentPageUrl';
import { PILOT_AGENTS } from './RegisterAgentPanel';

interface HorizenAgentPageSurfaceProps {
  agentSlug?: string;
  mode?: 'register' | 'verify';
}

interface AgentCardHorizen {
  network?: string;
  tokenId?: string | null;
  agentIdentifier?: string | null;
  humanReadableUrl?: string | null;
  status?: string;
}

export function HorizenAgentPageSurface({ agentSlug = 'moneypenny', mode = 'register' }: HorizenAgentPageSurfaceProps) {
  const [horizen, setHorizen] = useState<AgentCardHorizen | null>(null);
  const [loading, setLoading] = useState(true);
  const agent = PILOT_AGENTS.find((a) => a.slug === agentSlug) ?? PILOT_AGENTS[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHorizen(null);
    (async () => {
      try {
        const res = await fetch(agent.agentCardPath, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setHorizen((json?.metadata?.horizen as AgentCardHorizen) ?? null);
      } catch {
        // Soft-fail — renders the honest awaiting state below.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent.agentCardPath]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking {agent.displayName}&apos;s Horizen registration…
      </div>
    );
  }

  const candidateUrl = horizen?.humanReadableUrl ?? null;
  const resolved = candidateUrl != null && isHorizenAgentPageUrl(candidateUrl);

  if (!resolved) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
        <div>
          <p className="text-slate-300">Awaiting Horizen registration for {agent.displayName}</p>
          <p className="mt-1">
            Horizen&apos;s agent registry page resolves once the Register stage&apos;s status check confirms an
            on-chain identifier — this never renders a guessed URL ahead of that confirmation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <ExternalLink className="h-3.5 w-3.5" />
        {mode === 'verify'
          ? `Horizen's agent page for ${agent.displayName} — inspecting Pulse/P&L transparency state.`
          : `Horizen's agent page for ${agent.displayName} — confirming registered identity.`}
      </div>
      <IframeTab src={candidateUrl} title={`Horizen — ${agent.displayName}`} />
    </div>
  );
}

export default HorizenAgentPageSurface;
