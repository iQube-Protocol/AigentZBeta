'use client';

/**
 * MobilitySRBTab — Strategic Repatriation Brief.
 *
 * Generates, displays, and authorizes the SRB — the first external-facing
 * advocacy artifact produced by the HMS Cartridge. The SRB communicates
 * capability, continuity, and future contribution potential to institutions
 * before individual service requests are evaluated.
 *
 * Lifecycle: not_generated → draft → approved
 * Classification: BlakQube by default. No release without principal authorization.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Shield, FileText, Loader2, RefreshCw, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) { return xs.filter(Boolean).join(' '); }

const SRB_SECTIONS = [
  { key: 'executive_summary',  label: 'Executive Summary' },
  { key: 'household_overview', label: 'Household Overview' },
  { key: 'capability_profile', label: 'Capability Profile' },
  { key: 'continuity_profile', label: 'Continuity Profile' },
  { key: 'standing_profile',   label: 'Standing Profile' },
  { key: 'current_challenge',  label: 'Current Challenge' },
  { key: 'desired_outcome',    label: 'Desired Outcome' },
  { key: 'requested_guidance', label: 'Requested Guidance' },
] as const;

type SRBContent = Record<typeof SRB_SECTIONS[number]['key'], string>;

interface Props {
  caseId: string;
}

export function MobilitySRBTab({ caseId }: Props) {
  const [srb, setSrb]               = useState<SRBContent | null>(null);
  const [status, setStatus]         = useState<string>('not_generated');
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [sectionsCount, setSectionsCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['executive_summary']));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await personaFetch(`/api/mobility/cases/${caseId}/srb`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to load SRB');
      setSrb(json.srb);
      setStatus(json.status ?? 'not_generated');
      setApprovedAt(json.approved_at ?? null);
      setSectionsCount(json.sections_complete ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const generate = useCallback(async () => {
    setGenerating(true); setError(null);
    try {
      const res  = await personaFetch(`/api/mobility/cases/${caseId}/srb`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) {
        if (Array.isArray(json.missing_fields) && json.missing_fields.length > 0) {
          setMissingFields(json.missing_fields as string[]);
        }
        throw new Error(json.error ?? 'Generation failed');
      }
      setMissingFields([]);
      setSrb(json.srb);
      setStatus('draft');
      // Open all sections after generation
      setOpenSections(new Set(SRB_SECTIONS.map(s => s.key)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  }, [caseId]);

  const approve = useCallback(async () => {
    setApproving(true); setError(null);
    try {
      const res  = await personaFetch(`/api/mobility/cases/${caseId}/srb`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Approval failed');
      setStatus('approved');
      setApprovedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setApproving(false);
    }
  }, [caseId]);

  const toggleSection = (key: string) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
    </div>
  );

  const statusColor = status === 'approved' ? 'emerald' : status === 'draft' ? 'amber' : 'slate';
  const statusLabel = status === 'approved' ? 'Approved' : status === 'draft' ? 'Draft' : 'Not generated';
  const canGenerate = sectionsCount >= 8;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-slate-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">Strategic Repatriation Brief</h2>
            <p className="text-xs text-slate-400">PSC-001 · Advocacy artifact for institutional engagement</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cls(
            'text-[10px] px-2 py-0.5 rounded-full border font-medium',
            `bg-${statusColor}-500/10 text-${statusColor}-300 border-${statusColor}-500/20`,
          )}>
            {statusLabel}
          </span>
          {srb && (
            <button onClick={generate} disabled={generating} className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40">
              <RefreshCw className={cls('h-4 w-4', generating && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>

      {/* BlakQube classification notice */}
      <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
        <Shield className="h-4 w-4 text-violet-400 shrink-0" />
        <p className="text-xs text-violet-200/80">
          <span className="font-semibold">BlakQube</span> — this brief is classified. No release without principal
          authorization. aigentMe is the sole authorized disclosure broker.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Class A missing fields gate */}
      {missingFields.length > 0 && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-rose-300">Class A fields required before SRB generation</p>
          <ul className="space-y-1">
            {missingFields.map(f => (
              <li key={f} className="flex items-center gap-2 text-xs text-rose-200">
                <span className="text-rose-500 font-bold">✗</span> {f}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-rose-300/60 pt-1">
            Return to intake and complete these fields. The SRB will only use explicitly entered data — it will never infer or substitute missing information.
          </p>
        </div>
      )}

      {/* MAF incomplete warning */}
      {!canGenerate && status === 'not_generated' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200">
            MAF intake requires at least 8 sections to generate the SRB — currently {sectionsCount}/8 complete.
            Complete more intake sections to unlock generation.
          </p>
        </div>
      )}

      {/* Not-generated CTA */}
      {status === 'not_generated' && canGenerate && !generating && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 flex flex-col items-center gap-4 text-center">
          <FileText className="h-10 w-10 text-slate-600" />
          <div>
            <p className="text-sm font-medium text-slate-200">No brief generated yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Generate your Strategic Repatriation Brief — a curated advocacy document
              that gives institutions the context they need before evaluating individual requests.
            </p>
          </div>
          <button
            onClick={generate}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Generate Strategic Repatriation Brief
          </button>
        </div>
      )}

      {/* Generating spinner */}
      {generating && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-8 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm text-slate-300">aigentMe is drafting your brief…</p>
          <p className="text-xs text-slate-500">This may take 15–30 seconds</p>
        </div>
      )}

      {/* SRB sections */}
      {srb && !generating && (
        <div className="space-y-2">
          {SRB_SECTIONS.map(({ key, label }) => {
            const isOpen = openSections.has(key);
            const content = srb[key] ?? '';
            return (
              <div key={key} className="rounded-xl border border-slate-700 bg-slate-900/50 overflow-hidden">
                <button
                  onClick={() => toggleSection(key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-200">{label}</span>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                  }
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{content}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Approval footer */}
      {srb && !generating && status === 'draft' && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-200">Principal Authorization Required</p>
            <p className="text-xs text-amber-300/70 mt-0.5">
              Review the brief above and authorize it for disclosure when satisfied.
              No SRB may be released to institutions without this step.
            </p>
          </div>
          <button
            onClick={approve}
            disabled={approving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shrink-0"
          >
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Authorize for Disclosure
          </button>
        </div>
      )}

      {/* Approved state */}
      {status === 'approved' && approvedAt && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-200">Authorized for Disclosure</p>
            <p className="text-xs text-emerald-300/70">
              Approved {new Date(approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
              The Institutional Engagement Strategy can now be generated.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-emerald-400 ml-auto shrink-0" />
        </div>
      )}
    </div>
  );
}
