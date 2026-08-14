'use client';

/**
 * ActivateClaudeChip — reusable "Activate Claude" capability chip
 * (2026-08-11).
 *
 * A CHIP, not a journey stage or a full rail card by itself: mountable
 * wherever a context-rich surface wants to offer a Claude connection — CI
 * Bridge PERSONIFY today; myCanvas / ExperienceQube / Articles / Stories are
 * ready-to-wire follow-ups, not built in this pass (no half-finished
 * implementations — those mount points are noted, not stubbed).
 *
 * States:
 *   - Not connected — CTA "Connect metaMe to Claude" (opens the MCP setup:
 *     add the same-origin Threshold gateway as a custom connector), plus
 *     "I've connected — continue" to record a self-reported connection.
 *   - Connected — CTA "Open Claude with <context>", a contextual handoff.
 *
 * Persistence is INJECTED, never owned here: `checkConnected` /
 * `recordConnected` are caller-supplied, so this chip has no idea which
 * table or campaign it's reading/writing — that stays the mounting
 * surface's concern (e.g. CI Bridge's own connect-agent route today).
 *
 * MCP semantics: connection is NOT delegation. "Connected agent ≠ delegated
 * agent" — "Context may cross before authority does." A base Threshold
 * crossing grants read/query scope only; nothing this chip does grants
 * mandate, Standing, or transaction rights.
 *
 * Embedding: claude.ai sends `x-frame-options: SAMEORIGIN` (verified
 * 2026-08-11, `curl -sI https://claude.ai`) — it can NEVER be framed, in any
 * context, same-origin or not. So there is no separate "unsupported
 * embedding" branch to render: every action below opens claude.ai in a new
 * tab/window unconditionally, by design, which also means the current page
 * (and its return context) is never navigated away from. Do not attempt to
 * iframe claude.ai, weaken CSP, or proxy/re-host it to force embedding.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';

export interface ActivateClaudeChipProps {
  /** Resolve whether THIS context already has a recorded connection. */
  checkConnected: () => Promise<boolean>;
  /** Record that the visitor says they've connected, for THIS context. */
  recordConnected: () => Promise<void>;
  /** Short phrase naming what the connection is for, e.g. "your Constitutional story" — used in the contextual handoff CTA. */
  context: string;
  className?: string;
}

function mcpUrl(): string {
  if (typeof window === 'undefined') return '/api/threshold/mcp';
  return `${window.location.origin}/api/threshold/mcp`;
}

export function ActivateClaudeChip({ checkConnected, recordConnected, context, className }: ActivateClaudeChipProps) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkConnected()
      .then((v) => {
        if (!cancelled) setConnected(v);
      })
      .catch(() => {
        /* soft-fail — still lets the visitor connect */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the URL is still selectable text */
    }
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      await recordConnected();
      setConnected(true);
    } finally {
      setSubmitting(false);
    }
  };

  const openClaude = () => {
    window.open('https://claude.ai/code', '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-slate-500 ${className ?? ''}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
      </div>
    );
  }

  if (connected) {
    return (
      <div className={`space-y-2 ${className ?? ''}`}>
        <div className="flex items-start gap-2 rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Connected — a context connection, not delegation. Claude has read/query access only.</p>
        </div>
        <button
          type="button"
          onClick={openClaude}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-indigo-400"
        >
          Open Claude with {context} <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <p className="text-xs text-slate-300">
        Add the metaMe Threshold gateway as a custom connector in Claude Desktop or claude.ai. You&rsquo;ll be asked
        to sign in and authorize a crossing — that authorization grants read/query access only. Connection is never
        delegation: it does not grant Claude authority to act, transact, or represent you.
      </p>
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
        <code className="flex-1 truncate text-[11px] text-slate-400">{mcpUrl()}</code>
        <button type="button" onClick={copyUrl} className="shrink-0 text-slate-400 hover:text-slate-200">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      {copied && <p className="text-[11px] text-emerald-400">Copied.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openClaude}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500"
        >
          Connect metaMe to Claude <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={confirm}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-indigo-400 disabled:opacity-40"
        >
          {submitting ? 'Recording…' : "I've connected — continue"}
        </button>
      </div>
    </div>
  );
}

export default ActivateClaudeChip;
