'use client';

/**
 * MobilityIESTab — Institutional Engagement Strategy.
 *
 * Generates an outreach email draft for the active mobility case and presents
 * two post-generation actions:
 *   1. Copy draft  — copies subject + body to clipboard (active)
 *   2. Send via Marketa — visible but disabled, "Coming soon"
 */

import React, { useCallback, useState } from 'react';
import {
  Building2, Loader2, RefreshCw, AlertTriangle, CheckCircle2,
  Copy, Send, Check, Shield,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) { return xs.filter(Boolean).join(' '); }

interface Draft { subject: string; body: string; cached: boolean; }

export function MobilityIESTab({ caseId }: { caseId: string }) {
  const [draft, setDraft]       = useState<Draft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true); setError(null);
    try {
      const res  = await personaFetch(`/api/mobility/cases/${caseId}/draft-outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_via_marketa: false }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Generation failed');
      setDraft({ subject: json.subject, body: json.body, cached: json.cached === true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  }, [caseId]);

  const copyDraft = useCallback(async () => {
    if (!draft) return;
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Clipboard copy failed — please select and copy the text manually.');
    }
  }, [draft]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-slate-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">Institutional Engagement Strategy</h2>
            <p className="text-xs text-slate-400">Generate an outreach draft for partner institutions</p>
          </div>
        </div>
        {draft && (
          <button
            onClick={generate}
            disabled={generating}
            className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
            title="Regenerate"
          >
            <RefreshCw className={cls('h-4 w-4', generating && 'animate-spin')} />
          </button>
        )}
      </div>

      {/* BlakQube notice */}
      <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
        <Shield className="h-4 w-4 text-violet-400 shrink-0" />
        <p className="text-xs text-violet-200/80">
          <span className="font-semibold">BlakQube</span> — identifying details are omitted from this draft.
          Disclosure occurs only via the aigentMe-authorised pathway upon partner engagement.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Generate CTA — shown when no draft yet */}
      {!draft && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 flex flex-col items-center gap-4 text-center">
          <Building2 className="h-10 w-10 text-slate-600" />
          <div>
            <p className="text-sm font-medium text-slate-200">No draft generated yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Click below to generate a tailored outreach email for institutional partners
              based on this case&apos;s profile and risk classification.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            {generating ? 'Generating…' : 'Generate outreach draft'}
          </button>
        </div>
      )}

      {/* Draft panel */}
      {draft && (
        <div className="space-y-4">
          {draft.cached && (
            <p className="text-[11px] text-slate-500 italic">
              Showing previously saved draft — click <RefreshCw className="inline h-3 w-3" /> to regenerate.
            </p>
          )}

          {/* Subject line */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Subject</label>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
              <p className="text-sm text-slate-100 select-all">{draft.subject}</p>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Body</label>
            <textarea
              readOnly
              value={draft.body}
              rows={18}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 resize-none focus:outline-none select-all"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {/* Copy draft — active */}
            <button
              onClick={copyDraft}
              className={cls(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                copied
                  ? 'bg-emerald-600/80 text-white cursor-default'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600',
              )}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy draft'}
            </button>

            {/* Send via Marketa — disabled, coming soon */}
            <div className="relative">
              <button
                disabled
                className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed opacity-60"
              >
                <Send className="h-4 w-4" />
                Send via Marketa
              </button>
              <span className="absolute -top-2 -right-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-black leading-none">
                SOON
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-600">
            Copy the draft and send manually via your preferred email client.
            Marketa integration will enable one-click sending in a future release.
          </p>
        </div>
      )}
    </div>
  );
}
