'use client';

/**
 * AgentCardSurface — a real display wrapper over MoneyPenny's live Agent
 * Card (PRD-GJR-001 §10, §22 Register row: "Agent Card is a JSON API route,
 * not a rendered component — needs a thin display wrapper").
 *
 * Faithful display only: renders exactly what the route returns, never
 * reshaping or relabeling its fields (Surface Reuse Principle, §5.2 — this
 * route is real, shipped, shared code; this component composes it, never
 * forks it). `horizen.tokenId: null` renders honestly as "not yet
 * registered" rather than a blank or fabricated value.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, ExternalLink, ChevronDown, Copy, Check } from 'lucide-react';

interface AgentCardData {
  name?: string;
  description?: string;
  url?: string;
  provider?: { organization?: string; role?: string };
  skills?: Array<{ id: string; name: string; description: string; tags?: string[] }>;
  metadata?: {
    passport_class?: string;
    runtime_agent_id?: string;
    horizen?: {
      network?: string;
      tokenId?: string | null;
      registryAlias?: string | null;
      status?: string;
    };
  };
  registry_entry?: { class?: string; status?: string; status_note?: string };
}

interface AgentCardSurfaceProps {
  route?: string;
}

export function AgentCardSurface({ route = '/api/agents/moneypenny/agent-card.json' }: AgentCardSurfaceProps) {
  const [card, setCard] = useState<AgentCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Raw card JSON — an expandable drawer (matches the aigentMe Activity
  // Receipts pattern, components/metame/cards/ActivityReceiptCard.tsx),
  // never a popup (operator note 2026-07-31).
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(route, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Agent Card request failed (${res.status})`);
        const json = (await res.json()) as AgentCardData;
        if (!cancelled) setCard(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the Agent Card');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading Agent Card…
      </div>
    );
  }
  if (error || !card) {
    return (
      <div className="rounded-md border border-rose-900/60 bg-rose-950/30 p-3 text-xs text-rose-300">
        {error ?? 'No Agent Card data'}
      </div>
    );
  }

  const horizen = card.metadata?.horizen;
  const registered = !!horizen?.tokenId;
  const cardJson = JSON.stringify(card, null, 2);
  const handleCopyJson = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cardJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore — clipboard permission edge case */
    }
  };

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-100">{card.name ?? 'Agent Card'}</p>
          <p className="mt-1 text-slate-400">{card.description}</p>
        </div>
        {card.url && (
          <a
            href={card.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-slate-500 hover:text-slate-300"
            title="Open raw Agent Card JSON"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Runtime agent</p>
          <p className="mt-0.5 text-slate-200">{card.metadata?.runtime_agent_id ?? '—'}</p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Network</p>
          <p className="mt-0.5 text-slate-200">{horizen?.network ?? '—'}</p>
        </div>
        <div className={`rounded border p-2 ${registered ? 'border-emerald-900/60 bg-emerald-950/20' : 'border-amber-900/60 bg-amber-950/20'}`}>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Horizen tokenId</p>
          <p className={`mt-0.5 ${registered ? 'text-emerald-300' : 'text-amber-300'}`}>
            {horizen?.tokenId ?? 'not yet registered'}
          </p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-0.5 text-slate-200">{horizen?.status ?? card.registry_entry?.status ?? '—'}</p>
        </div>
      </div>

      {card.registry_entry?.status_note && (
        <p className="mt-2 text-slate-500">{card.registry_entry.status_note}</p>
      )}

      {Array.isArray(card.skills) && card.skills.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Declared skills</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {card.skills.map((s) => (
              <span
                key={s.id}
                title={s.description}
                className="rounded-full border border-slate-800 bg-slate-900/40 px-2 py-0.5 text-slate-300"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Raw card JSON — an expandable drawer, never a popup (operator note
          2026-07-31), mirroring the aigentMe Activity Receipts pattern. */}
      <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/50">
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-slate-900/40 ${
            showJson ? 'border-b border-slate-800' : ''
          }`}
          aria-expanded={showJson}
        >
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
            <ChevronDown className={`h-3 w-3 transition-transform ${showJson ? 'rotate-180' : ''}`} />
            {showJson ? 'Hide card JSON' : 'Show card JSON'}
          </span>
          {showJson && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleCopyJson}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleCopyJson(e);
                }
              }}
              aria-label={copied ? 'Copied' : 'Copy card JSON'}
              title={copied ? 'Copied' : 'Copy JSON'}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800/60"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </span>
          )}
        </button>
        {showJson && (
          <pre className="max-h-72 overflow-auto p-3 font-mono text-[11px] leading-snug text-slate-300">
            {cardJson}
          </pre>
        )}
      </div>
    </div>
  );
}

export default AgentCardSurface;
