'use client';

/**
 * MobilityIESTab — Institutional Engagement Strategy
 * Scored institution table with phase grouping and inline outreach drafting.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Target, AlertTriangle, Loader2, CheckCircle2, RefreshCw, Copy, X, Shield } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

type DisclosurePackage = 'A' | 'B' | 'AB' | 'C' | 'D';

interface Institution {
  id: string;
  name: string;
  category: string;
  phase: number;
  context_authority: number;
  referral_authority: number;
  capability_preservation: number;
  continuity_preservation: number;
  execution_impact: number;
  rationale: string;
  recommended_action: string;
  expected_response?: string;
  escalation_criteria?: string;
  // PDEP fields
  engagement_stage?: number;
  recommended_package?: DisclosurePackage;
  // legacy compat
  disclosure_level?: 'FULL' | 'CAPABILITY_ONLY' | 'SUMMARY_ONLY';
}

interface Phase {
  phase: number;
  label: string;
  objective: string;
  institution_ids: string[];
}

interface IESContent {
  institutions: Institution[];
  phases: Phase[];
  strategic_note: string;
  engagement_tempo?: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20"><CheckCircle2 className="h-3 w-3" />Authorized</span>;
  }
  if (status === 'draft') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">Draft</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-500/20">Not Generated</span>;
}

function CategoryBadge({ cat }: { cat: string }) {
  const colors = { A: 'bg-violet-500/10 text-violet-400 ring-violet-500/20', B: 'bg-sky-500/10 text-sky-400 ring-sky-500/20', C: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' } as Record<string, string>;
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${colors[cat] ?? colors.C}`}>{cat}</span>;
}

function PackageBadge({ pkg, stage }: { pkg?: DisclosurePackage; stage?: number }) {
  const label = pkg ?? '—';
  const anonymous = pkg === 'A' || pkg === 'B' || pkg === 'AB';
  const cls = anonymous
    ? 'bg-violet-500/10 text-violet-400 ring-violet-500/20'
    : pkg === 'C' ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
    : pkg === 'D' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
    : 'bg-slate-500/10 text-slate-400 ring-slate-500/20';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${cls}`} title={`Package ${label}${stage !== undefined ? ` · Stage ${stage}` : ''}`}>
      {label}{stage !== undefined ? <span className="opacity-60">·S{stage}</span> : null}
    </span>
  );
}

function DisclosureBadge({ level }: { level?: string }) {
  if (level === 'FULL') return <span className="rounded px-1.5 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">FULL</span>;
  if (level === 'CAPABILITY_ONLY') return <span className="rounded px-1.5 py-0.5 text-[10px] bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">CAPABILITY</span>;
  return <span className="rounded px-1.5 py-0.5 text-[10px] bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20">SUMMARY</span>;
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 8 ? 'bg-emerald-500/15 text-emerald-400' : score >= 6 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-500/15 text-slate-400';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${color}`}>{score}</span>;
}

interface OutreachModalProps {
  institution: Institution;
  caseId: string;
  onClose: () => void;
}

function OutreachModal({ institution, caseId, onClose }: OutreachModalProps) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientRole, setRecipientRole] = useState('');
  const [draft, setDraft] = useState<{ subject: string; body: string; anonymous?: boolean; disclosure_package?: string; engagement_stage?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pkg = institution.recommended_package;
  const anonymous = pkg === 'A' || pkg === 'B' || pkg === 'AB';

  const generate = useCallback(async () => {
    // For anonymous packages, recipient role is optional (not used in salutation)
    if (!anonymous && (!recipientName.trim() || !recipientRole.trim())) {
      setError('Recipient name and role are required for identity-stage outreach');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await personaFetch(`/api/mobility/cases/${caseId}/ies/draft-outreach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institution_id: institution.id, recipient_name: recipientName, recipient_role: recipientRole }),
      });
      const json = await res.json();
      if (json.ok) setDraft({ subject: json.subject, body: json.body, anonymous: json.anonymous, disclosure_package: json.disclosure_package, engagement_stage: json.engagement_stage });
      else setError(json.error ?? 'Draft failed');
    } catch (e) { setError(e instanceof Error ? e.message : 'Draft failed'); }
    finally { setLoading(false); }
  }, [anonymous, caseId, institution.id, recipientName, recipientRole]);

  const copy = useCallback(async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [draft]);

  const inputCls = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Draft Outreach — {institution.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <PackageBadge pkg={institution.recommended_package} stage={institution.engagement_stage} />
              {institution.recommended_package && (institution.recommended_package === 'A' || institution.recommended_package === 'B' || institution.recommended_package === 'AB') && (
                <span className="text-[10px] text-violet-400">Anonymous — identity protected</span>
              )}
              <span className="text-[10px] text-slate-500">aigentMe · PDEP governed</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!draft ? (
            <>
              <p className="text-xs text-slate-400">{institution.recommended_action}</p>
              {anonymous && (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                  <p className="text-xs text-violet-300">Package {institution.recommended_package ?? 'AB'} — Stage {institution.engagement_stage ?? 0} outreach is fully anonymous. The email will not include any names, addresses, or personal identifiers. Recipient fields are optional and used only for routing context.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Recipient name {anonymous ? '(optional)' : '*'}</label>
                  <input className={inputCls} value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="e.g. James Whitfield" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Recipient role / title {anonymous ? '(optional)' : '*'}</label>
                  <input className={inputCls} value={recipientRole} onChange={e => setRecipientRole(e.target.value)} placeholder="e.g. Senior Consular Officer" />
                </div>
              </div>
              {error && <p className="text-xs text-rose-400">{error}</p>}
              <button onClick={generate} disabled={loading} className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                {loading ? 'aigentMe is drafting…' : 'Generate Outreach Draft'}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              {draft.anonymous && (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                  <p className="text-xs text-violet-300">Package {draft.disclosure_package} · Stage {draft.engagement_stage} — identity protected. This email contains no names, addresses, or personal identifiers.</p>
                </div>
              )}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 space-y-1">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">Subject</p>
                <p className="text-sm text-slate-200 font-medium">{draft.subject}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 max-h-72 overflow-y-auto">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-2">Body</p>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{draft.body}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={copy} className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600 transition-colors">
                  <Copy className="h-4 w-4" />{copied ? 'Copied!' : 'Copy to clipboard'}
                </button>
                <button disabled title="Send via Marketa — coming soon" className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-500 cursor-not-allowed ring-1 ring-slate-700">
                  Send via Marketa <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold text-amber-400 uppercase tracking-wide">SOON</span>
                </button>
                <button onClick={() => setDraft(null)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Redraft</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MobilityIESTab({ caseId, onOpenSRB }: { caseId: string; onOpenSRB?: () => void }) {
  const [ies, setIes] = useState<IESContent | null>(null);
  const [status, setStatus] = useState<string>('not_generated');
  const [srbStatus, setSrbStatus] = useState<string>('not_generated');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outreachTarget, setOutreachTarget] = useState<Institution | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [iesRes, srbRes] = await Promise.all([
        personaFetch(`/api/mobility/cases/${caseId}/ies`, { cache: 'no-store' }),
        personaFetch(`/api/mobility/cases/${caseId}/srb`, { cache: 'no-store' }),
      ]);
      const [iesJson, srbJson] = await Promise.all([iesRes.json(), srbRes.json()]);
      if (iesJson.ok) { setIes(iesJson.ies); setStatus(iesJson.status ?? 'not_generated'); }
      if (srbJson.ok) setSrbStatus(srbJson.status ?? 'not_generated');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const generate = useCallback(async () => {
    setGenerating(true); setError(null);
    try {
      const res = await personaFetch(`/api/mobility/cases/${caseId}/ies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const json = await res.json();
      if (json.ok) { setIes(json.ies); setStatus(json.status); }
      else setError(json.error ?? 'Generation failed');
    } catch (e) { setError(e instanceof Error ? e.message : 'Generation failed'); }
    finally { setGenerating(false); }
  }, [caseId]);

  const approve = useCallback(async () => {
    setApproving(true); setError(null);
    try {
      const res = await personaFetch(`/api/mobility/cases/${caseId}/ies`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const json = await res.json();
      if (json.ok) setStatus(json.status);
      else setError(json.error ?? 'Approval failed');
    } catch (e) { setError(e instanceof Error ? e.message : 'Approval failed'); }
    finally { setApproving(false); }
  }, [caseId]);

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

  const phaseMap = new Map<number, Phase>();
  ies?.phases?.forEach(p => phaseMap.set(p.phase, p));
  const institutionsByPhase = new Map<number, Institution[]>();
  ies?.institutions?.forEach(inst => {
    const arr = institutionsByPhase.get(inst.phase) ?? [];
    arr.push(inst);
    institutionsByPhase.set(inst.phase, arr);
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-sky-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">Institutional Engagement Strategy</h2>
            <p className="text-xs text-slate-400">PSC-001 · PDEP governed · BlakQube disclosure control
              {ies?.engagement_tempo && <span className="ml-2 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-400 ring-1 ring-sky-500/20 capitalize">{ies.engagement_tempo} tempo</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* SRB gate */}
      {srbStatus !== 'approved' && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">The Strategic Repatriation Brief must be authorized before generating the IES.</p>
          </div>
          {onOpenSRB && (
            <button onClick={onOpenSRB} className="shrink-0 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors">
              Go to SRB →
            </button>
          )}
        </div>
      )}

      {/* Not generated */}
      {status === 'not_generated' && !generating && srbStatus === 'approved' && (
        <div className="rounded-xl border border-slate-700 border-dashed bg-slate-900/40 p-8 text-center space-y-4">
          <Target className="h-10 w-10 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Generate Institutional Engagement Strategy</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">aigentMe will map 12-18 UK institutions across 3 strategic phases, scored on 5 criteria. Each institution receives a recommended action and appropriate disclosure level.</p>
          </div>
          <button onClick={generate} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500 transition-colors">
            <Target className="h-4 w-4" />Generate IES
          </button>
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-8 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400 mx-auto" />
          <p className="text-sm text-sky-300 font-medium">aigentMe is mapping the institutional landscape…</p>
          <p className="text-xs text-slate-400">Scoring 12-18 UK institutions across 5 criteria. This takes 20-40 seconds.</p>
        </div>
      )}

      {/* IES table */}
      {(status === 'draft' || status === 'approved') && ies && (
        <div className="space-y-6">
          {[1, 2, 3].map(phaseNum => {
            const phase = phaseMap.get(phaseNum);
            const institutions = institutionsByPhase.get(phaseNum) ?? [];
            if (!institutions.length) return null;
            return (
              <div key={phaseNum} className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/10 text-xs font-bold text-sky-400 ring-1 ring-sky-500/20 shrink-0 mt-0.5">{phaseNum}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">{phase?.label ?? `Phase ${phaseNum}`}</h3>
                    {phase?.objective && <p className="text-xs text-slate-400">{phase.objective}</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/40">
                        <th className="px-3 py-2 text-left text-[10px] text-slate-500 font-medium">Institution</th>
                        <th className="px-2 py-2 text-center text-[10px] text-slate-500 font-medium">Cat</th>
                        <th className="px-2 py-2 text-center text-[10px] text-slate-500 font-medium" title="Context Authority">Ctx</th>
                        <th className="px-2 py-2 text-center text-[10px] text-slate-500 font-medium" title="Referral Authority">Ref</th>
                        <th className="px-2 py-2 text-center text-[10px] text-slate-500 font-medium" title="Capability Preservation">Cap</th>
                        <th className="px-2 py-2 text-center text-[10px] text-slate-500 font-medium" title="Continuity Preservation">Con</th>
                        <th className="px-2 py-2 text-center text-[10px] text-slate-500 font-medium" title="Execution Impact">Exe</th>
                        <th className="px-2 py-2 text-center text-[10px] text-slate-500 font-medium">Package</th>
                        <th className="px-3 py-2 text-right text-[10px] text-slate-500 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {institutions.map(inst => (
                        <tr key={inst.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-3 py-2.5">
                            <p className="text-slate-200 font-medium leading-tight">{inst.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{inst.recommended_action}</p>
                          </td>
                          <td className="px-2 py-2.5 text-center"><CategoryBadge cat={inst.category} /></td>
                          <td className="px-2 py-2.5 text-center"><ScorePill score={inst.context_authority} /></td>
                          <td className="px-2 py-2.5 text-center"><ScorePill score={inst.referral_authority} /></td>
                          <td className="px-2 py-2.5 text-center"><ScorePill score={inst.capability_preservation} /></td>
                          <td className="px-2 py-2.5 text-center"><ScorePill score={inst.continuity_preservation} /></td>
                          <td className="px-2 py-2.5 text-center"><ScorePill score={inst.execution_impact} /></td>
                          <td className="px-2 py-2.5 text-center"><PackageBadge pkg={inst.recommended_package} stage={inst.engagement_stage} /></td>
                          <td className="px-3 py-2.5 text-right">
                            {status === 'approved' && (
                              <button
                                onClick={() => setOutreachTarget(inst)}
                                className="rounded-lg bg-sky-600/10 px-2.5 py-1 text-[10px] font-medium text-sky-400 hover:bg-sky-600/20 transition-colors whitespace-nowrap"
                              >
                                Draft Outreach
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Strategic note */}
          {ies.strategic_note && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-sky-400" />
                <p className="text-xs font-semibold text-slate-300">Strategic Note — aigentMe</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{ies.strategic_note}</p>
            </div>
          )}
        </div>
      )}

      {/* Authorize IES */}
      {status === 'draft' && ies && (
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sky-300">Authorize IES</p>
            <p className="text-xs text-slate-400">Once authorized, outreach drafts can be generated for each institution per their disclosure level.</p>
          </div>
          <button onClick={approve} disabled={approving} className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors whitespace-nowrap">
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Authorize IES
          </button>
        </div>
      )}

      {/* Outreach modal */}
      {outreachTarget && (
        <OutreachModal institution={outreachTarget} caseId={caseId} onClose={() => setOutreachTarget(null)} />
      )}
    </div>
  );
}
