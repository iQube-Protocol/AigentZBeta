'use client';

/**
 * ConstitutionalAgentFieldEntrySurface — PERSONIFY's SUPPORTING-tools
 * surface (evolved from ACT's primary surface, 2026-08-11).
 *
 * Repositioned, not rebuilt: PERSONIFY's primary surface is now
 * ConstitutionalInternetBridgePersonifyMyCanvas ("Tell your Constitutional
 * story"); this component's two original sibling paths are preserved
 * exactly, just framed as OPTIONAL supporting tools underneath it, neither
 * of which is delegation:
 *
 *   (A) Connect an agent you already use — deep-links to the REAL, already-
 *       working metaMe Threshold MCP endpoint (a standard OAuth 2.1 + PKCE
 *       + Dynamic Client Registration crossing that Claude Desktop's /
 *       claude.ai's own "add custom connector" flow speaks directly — see
 *       app/api/threshold/mcp/route.ts, app/threshold/authorize/page.tsx).
 *       A base crossing grants ONLY read/query scope
 *       (CONSTITUTIONAL_ROOT_CAPABILITIES) — never delegation, mandate,
 *       Standing, or transaction rights. Completing this path here is a
 *       SELF-REPORT ("I've connected — continue"), not a verified check —
 *       see the connect-agent route's own header for why.
 *   (B) Meet aigentMe — the pre-existing ConstitutionalAgentDispositionSurface
 *       ceremony (unchanged), now PAIRED with the real, focused aigentMe/
 *       metaMe surface (the same embed pattern KNYTS' own Delegate stage
 *       uses — utils/codex-nav.ts's focused/focusedNavDepth contract) so
 *       aigentMe can actually help shape the person's story instead of the
 *       ceremony floating in an otherwise-empty viewport. The person
 *       remains the author.
 *
 * Governing rule, stated explicitly in the UI: "Context may cross before
 * authority does." Neither path requires the other; either alone completes
 * PERSONIFY's `agentRelationshipStarted` evidence (an OR, not a checklist —
 * unchanged by this evolution).
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Loader2, Sparkles } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { buildCodexUrl } from '@/utils/codex-nav';
import { ConstitutionalAgentDispositionSurface } from '@/components/journey/ConstitutionalAgentDispositionSurface';
import { CI_BRIDGE_THRESHOLD_MCP_URL } from '@/services/journey/constitutionalInternetBridgeJourney';

type Path = 'choose' | 'connect' | 'aigentme';

interface Props {
  personaId?: string;
}

function ConnectAnAgentPath({ onConnected }: { onConnected: () => void }) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    personaFetch('/api/journey/constitutional-internet-bridge/act/connect-agent', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => { if (!cancelled) setConnected(Boolean(json?.connected)); })
      .catch(() => { /* soft-fail — still lets the visitor connect */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(CI_BRIDGE_THRESHOLD_MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — the URL is still selectable text */ }
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      const res = await personaFetch('/api/journey/constitutional-internet-bridge/act/connect-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'claude' }),
      });
      if (res.ok) {
        setConnected(true);
        onConnected();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</div>;
  }

  if (connected) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>You told us you connected an agent. This is a context connection, not delegation — your agent has read/query access only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-300">
        Add the metaMe Threshold gateway as a custom connector in Claude Desktop or claude.ai. You&rsquo;ll be asked
        to sign in and authorize a crossing &mdash; that authorization grants read/query access only (your
        Passport status, journeys, and services). It does not grant your agent authority to act, transact, or
        represent you.
      </p>
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
        <code className="flex-1 truncate text-[11px] text-slate-400">{CI_BRIDGE_THRESHOLD_MCP_URL}</code>
        <button type="button" onClick={copyUrl} className="shrink-0 text-slate-400 hover:text-slate-200">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      {copied && <p className="text-[11px] text-emerald-400">Copied.</p>}
      <button
        type="button"
        disabled={submitting}
        onClick={confirm}
        className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-indigo-400 disabled:opacity-40"
      >
        {submitting ? 'Recording…' : "I've connected — continue"}
      </button>
    </div>
  );
}

/** The real, focused aigentMe/metaMe surface — reuses the shared
 *  Focused/Full contract (utils/codex-nav.ts) exactly like KNYTS' own
 *  Delegate stage, so aigentMe actually helps shape the story rather than
 *  the disposition ceremony above floating in an empty viewport. */
function MeetAigentMeEmbed({ personaId }: { personaId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const src = buildCodexUrl('metame-codex', {
    tab: 'aigent-me',
    personaId,
    shell: 'embed',
    suppressCopilot: true,
    focused: !expanded,
    focusedNavDepth: expanded ? undefined : 1,
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-end">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-none border-none cursor-pointer p-0"
        >
          {expanded ? 'Focus view' : 'Explore metaMe ↗'}
        </button>
      </div>
      <iframe
        src={src}
        title="Meet aigentMe"
        className="h-[26rem] w-full rounded-md border border-slate-800 bg-slate-950"
      />
    </div>
  );
}

export function ConstitutionalAgentFieldEntrySurface({ personaId }: Props) {
  const [path, setPath] = useState<Path>('choose');

  if (path === 'aigentme') {
    return (
      <div className="space-y-3">
        <ConstitutionalAgentDispositionSurface />
        <MeetAigentMeEmbed personaId={personaId} />
      </div>
    );
  }

  if (path === 'connect') {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
        <ConnectAnAgentPath onConnected={() => {}} />
        <button
          type="button"
          onClick={() => setPath('choose')}
          className="mt-3 text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 space-y-3">
      <p className="text-xs text-slate-300">
        Optional supporting tools — not required to tell your story above. Bring an agent you already use into
        the field, or let aigentMe help you shape your Article or Story. <span className="text-slate-400">Connection is
        never delegation</span> — either way, nothing here grants constitutional authority.
      </p>
      <button
        type="button"
        onClick={() => setPath('connect')}
        className="w-full rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-left transition-colors hover:border-indigo-700/60 hover:bg-indigo-950/20"
      >
        <p className="text-sm font-medium text-slate-100">Connect an agent you already use</p>
        <p className="mt-0.5 text-xs text-slate-500">Bring Claude (or another MCP-capable agent) into the field with read/query access only.</p>
      </button>
      <button
        type="button"
        onClick={() => setPath('aigentme')}
        className="w-full rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-left transition-colors hover:border-indigo-700/60 hover:bg-indigo-950/20"
      >
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-100"><Sparkles className="h-3.5 w-3.5 text-indigo-300" /> Meet aigentMe</p>
        <p className="mt-0.5 text-xs text-slate-500">Let aigentMe help shape your Constitutional story. You remain the author.</p>
      </button>
    </div>
  );
}

export default ConstitutionalAgentFieldEntrySurface;
