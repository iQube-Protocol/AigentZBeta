"use client";

/**
 * CorpusScoutTab — the human review workspace for Corpus Scout (PRD-ICA-001
 * §9). Steward-facing, admin-gated surface over `/api/corpus-scout/*`:
 *
 *   - Submit a DIRECT document URL for retrieval + inspection (Level 4
 *     discovery only, §2). A failed verification is shown honestly with its
 *     failure class — never hidden (§12).
 *   - Review the candidate queue: verification block (mime/size/sha256/pages/
 *     extraction), content preview, HEURISTIC structural tags (§8 — advisory,
 *     never a decision), and the reviewer actions (§9).
 *   - Lane coverage (§12) so one source lane cannot silently dominate.
 *   - Exact-duplicate groups (byte-identical mirrors/re-submissions only).
 *   - Constitutional substrate + Agent B/C institution-targeted discovery
 *     (Constitutional Discovery amendment, mounted via `DomainConstitutionPanel`
 *     above) — "Run discovery" on a ratified institution submits resolved
 *     candidates through this SAME review workspace, never a side channel.
 *
 * Spine discipline: every call goes through `personaFetch` (CLAUDE.md
 * PARAMOUNT) — never raw fetch, never authedFetchHeaders.
 * House style: translucent slate (`bg-slate-900/40`, `border-slate-800`).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, Copy, FileSearch,
  Loader2, Plus, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import {
  PROVENANCE_CLASSES,
  REVIEW_WORKFLOW_STATUSES,
  type CandidateSourceRow,
  type ProvenanceClass,
  type ReviewWorkflowStatus,
} from '@/services/corpusScout/types';
import {
  assessLaneCoverage,
  findDuplicateCandidates,
  type DuplicateGroup,
  type LaneCoverageRow,
} from '@/services/corpusScout/intelligence';
import { DomainConstitutionPanel } from '@/components/corpusScout/DomainConstitutionPanel';

const DEFAULT_CAMPAIGN_DOMAIN = 'financial-services';
const PREVIEW_CHARS = 1500;

/** Domains with a ratified Constitutional Coverage Model (Constitutional
 *  Discovery amendment) — prepopulated so a steward never has to type the
 *  name of an already-chartered domain. "Custom…" reveals a free-text input
 *  for a domain not yet chartered (e.g. medicine, media). */
const KNOWN_DOMAINS = ['financial-services'] as const;
const CUSTOM_DOMAIN_OPTION = '__custom__';

type ReviewDecision =
  | 'approve_exp_p1'
  | 'approve_general_finance'
  | 'approve_reference_only'
  | 'reject_out_of_domain'
  | 'reject_low_substance'
  | 'reject_provenance'
  | 'reject_access_or_license'
  | 'mark_duplicate';

const APPROVE_DECISIONS: Array<{ decision: ReviewDecision; label: string }> = [
  { decision: 'approve_exp_p1', label: 'Approve for EXP-P1' },
  { decision: 'approve_general_finance', label: 'Approve — general finance' },
  { decision: 'approve_reference_only', label: 'Approve — reference only' },
];

const REJECT_DECISIONS: Array<{ decision: ReviewDecision; label: string }> = [
  { decision: 'reject_out_of_domain', label: 'Reject — out of domain' },
  { decision: 'reject_low_substance', label: 'Reject — low substance' },
  { decision: 'reject_provenance', label: 'Reject — provenance' },
  { decision: 'reject_access_or_license', label: 'Reject — access / license' },
];

function statusChipClass(status: ReviewWorkflowStatus): string {
  if (status.startsWith('approved_')) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  if (status === 'pending_review') return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  if (status === 'needs_retrieval_fix') return 'border-rose-500/40 bg-rose-500/10 text-rose-300';
  if (status === 'duplicate' || status === 'superseded') return 'border-sky-500/40 bg-sky-500/10 text-sky-300';
  return 'border-slate-600 bg-slate-800/60 text-slate-400'; // rejected_*
}

function formatBytes(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

interface IngestionInfo { ok: boolean; error?: string; evidenceRowId?: string }

export function CorpusScoutTab() {
  const [candidates, setCandidates] = useState<CandidateSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewWorkflowStatus>('all');
  // Gap Detection (Constitutional Discovery amendment §6) — the ratified
  // Coverage Model pillar keys for the current campaign domain, fed into
  // assessLaneCoverage()'s requiredLanes so the lane-coverage table can show
  // what's still missing, not just what exists.
  const [ratifiedPillarKeys, setRatifiedPillarKeys] = useState<string[]>([]);

  // Submit form
  const [formUrl, setFormUrl] = useState('');
  const [formDomain, setFormDomain] = useState(DEFAULT_CAMPAIGN_DOMAIN);
  const [customDomainMode, setCustomDomainMode] = useState(false);
  const [formSubDomain, setFormSubDomain] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<CandidateSourceRow | null>(null);

  // Per-candidate review panel state
  const [openReview, setOpenReview] = useState<string | null>(null);
  const [openPreview, setOpenPreview] = useState<string | null>(null);
  const [reviewProvClass, setReviewProvClass] = useState<'' | ProvenanceClass>('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDupOf, setReviewDupOf] = useState('');
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [ingestions, setIngestions] = useState<Record<string, IngestionInfo>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await personaFetch('/api/corpus-scout/candidates', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setLoadError(data?.error || `Failed to load candidates (HTTP ${res.status})`);
        return;
      }
      setCandidates(data.candidates ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const laneCoverage: LaneCoverageRow[] = useMemo(
    () => assessLaneCoverage(candidates, ratifiedPillarKeys),
    [candidates, ratifiedPillarKeys],
  );
  const laneCoverageByPillar = useMemo(
    () => Object.fromEntries(laneCoverage.map((row) => [row.lane, { total: row.total, approved: row.approved }])),
    [laneCoverage],
  );
  const duplicateGroups: DuplicateGroup[] = useMemo(() => findDuplicateCandidates(candidates), [candidates]);
  const visible = useMemo(
    () => (statusFilter === 'all' ? candidates : candidates.filter((c) => c.reviewWorkflowStatus === statusFilter)),
    [candidates, statusFilter],
  );

  const submit = useCallback(async () => {
    if (!formUrl.trim() || !formDomain.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    setLastSubmitted(null);
    try {
      const res = await personaFetch('/api/corpus-scout/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formUrl.trim(),
          campaignDomain: formDomain.trim(),
          campaignSubDomain: formSubDomain.trim() || undefined,
          title: formTitle.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setSubmitError(data?.error || `Submission failed (HTTP ${res.status})`);
        return;
      }
      setLastSubmitted(data.candidate ?? null);
      setFormUrl('');
      setFormTitle('');
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }, [formUrl, formDomain, formSubDomain, formTitle, load]);

  const toggleReview = useCallback((c: CandidateSourceRow) => {
    setOpenReview((prev) => {
      if (prev === c.sourceId) return null;
      setReviewProvClass(c.provenanceClass ?? '');
      setReviewNotes(c.humanReviewNotes ?? '');
      setReviewDupOf(c.duplicateOfSourceId ?? '');
      return c.sourceId;
    });
  }, []);

  const decide = useCallback(async (sourceId: string, decision: ReviewDecision) => {
    setReviewBusy(sourceId);
    setReviewErrors((prev) => ({ ...prev, [sourceId]: '' }));
    try {
      const res = await personaFetch(`/api/corpus-scout/candidates/${encodeURIComponent(sourceId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          notes: reviewNotes.trim() || undefined,
          provenanceClass: reviewProvClass || undefined,
          duplicateOfSourceId: decision === 'mark_duplicate' ? reviewDupOf.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setReviewErrors((prev) => ({ ...prev, [sourceId]: data?.error || `Review failed (HTTP ${res.status})` }));
        return;
      }
      if (data.ingestion) {
        setIngestions((prev) => ({ ...prev, [sourceId]: data.ingestion as IngestionInfo }));
      }
      if (data.candidate) {
        setCandidates((prev) => prev.map((c) => (c.sourceId === sourceId ? (data.candidate as CandidateSourceRow) : c)));
      }
      setOpenReview(null);
    } catch (e) {
      setReviewErrors((prev) => ({ ...prev, [sourceId]: e instanceof Error ? e.message : 'Review failed' }));
    } finally {
      setReviewBusy(null);
    }
  }, [reviewNotes, reviewProvClass, reviewDupOf]);

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Corpus Scout review workspace…
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <FileSearch className="h-4 w-4 text-violet-300" /> Corpus Scout — human review workspace
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          PRD-ICA-001 §9 — no source enters an approved corpus without a human decision here. Approval hands the
          source to the Discovery Engine (Stage 1 add-evidence); everything else stays in the provenance store.
        </p>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {loadError}
          <button onClick={() => void load()} className="ml-auto text-rose-200 underline">Retry</button>
        </div>
      )}

      {/* Constitutional Discovery amendment (§2) — the substrate Agent 0 produces
          ahead of acquisition: Domain Definition, Constitutional Coverage Model,
          Constitutional Dependency Registry, Institutional Registry. Upstream of
          the submission form below, not a replacement for it. */}
      <DomainConstitutionPanel
        domain={formDomain}
        onRatifiedPillarsChange={setRatifiedPillarKeys}
        laneCoverageByPillar={laneCoverageByPillar}
        onDiscoveryComplete={() => void load()}
      />

      {/* Submit a candidate URL */}
      <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
          <Plus className="h-4 w-4 text-violet-300" /> Submit a document URL for verification
        </h3>
        <p className="text-[10px] text-slate-500">
          Direct document URLs only (Level 4 discovery, §2) — the pipeline retrieves the bytes, sniffs the real type,
          hashes, and inspects for substantive content. A failed verification is recorded and shown, never dropped.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="text-[11px] text-slate-400 md:col-span-2">
            Document URL
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://…/report.pdf"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            Campaign domain
            {customDomainMode ? (
              <input
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
                placeholder="e.g. medicine, media"
                autoFocus
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
              />
            ) : (
              <select
                value={KNOWN_DOMAINS.includes(formDomain as (typeof KNOWN_DOMAINS)[number]) ? formDomain : CUSTOM_DOMAIN_OPTION}
                onChange={(e) => {
                  if (e.target.value === CUSTOM_DOMAIN_OPTION) {
                    setCustomDomainMode(true);
                    setFormDomain('');
                  } else {
                    setFormDomain(e.target.value);
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
              >
                {KNOWN_DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
                <option value={CUSTOM_DOMAIN_OPTION}>Custom…</option>
              </select>
            )}
          </label>
          <label className="text-[11px] text-slate-400">
            Source lane / sub-domain (optional)
            <input
              value={formSubDomain}
              onChange={(e) => setFormSubDomain(e.target.value)}
              placeholder="e.g. actuarial-science, failure-studies"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </label>
          <label className="text-[11px] text-slate-400 md:col-span-2">
            Title (optional — derived from the URL when omitted)
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
            />
          </label>
        </div>
        <button
          onClick={() => void submit()}
          disabled={submitting || !formUrl.trim() || !formDomain.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Retrieve &amp; inspect
        </button>
        {submitError && <p className="text-xs text-rose-300">{submitError}</p>}
        {lastSubmitted && (
          <div className={`rounded-lg border p-2.5 text-[11px] ${
            lastSubmitted.reviewWorkflowStatus === 'pending_review'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
          }`}>
            <span className="font-medium">{lastSubmitted.sourceId}</span> recorded as{' '}
            <span className="font-mono">{lastSubmitted.reviewWorkflowStatus}</span>
            {lastSubmitted.extractionWarnings.length > 0 && (
              <span className="mt-1 block text-amber-300">
                {lastSubmitted.extractionWarnings.join(' · ')}
              </span>
            )}
            {lastSubmitted.duplicateOfSourceId && (
              <span className="mt-1 block text-sky-300">
                Same URL already recorded as {lastSubmitted.duplicateOfSourceId} — review as a possible duplicate.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Lane coverage (§12) */}
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <h3 className="text-sm font-semibold text-slate-200">Source-lane coverage</h3>
        {laneCoverage.length === 0 ? (
          <p className="text-xs italic text-slate-500">No candidates yet — coverage appears as sources are submitted.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-3">Lane</th>
                  <th className="py-1 pr-3">Total</th>
                  <th className="py-1 pr-3">Pending</th>
                  <th className="py-1 pr-3">Approved</th>
                  <th className="py-1 pr-3">Closed</th>
                  <th className="py-1">Constitutional gap</th>
                </tr>
              </thead>
              <tbody>
                {laneCoverage.map((row) => {
                  const isGap = row.required && row.total === 0;
                  return (
                    <tr
                      key={row.lane}
                      className={`border-t border-slate-800 text-slate-300 ${isGap ? 'bg-rose-500/10' : ''}`}
                    >
                      <td className="py-1 pr-3">
                        {row.lane}
                        {row.required && (
                          <span className="ml-1.5 rounded border border-violet-500/30 bg-violet-500/10 px-1 py-0.5 text-[9px] text-violet-300">
                            ratified pillar
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-3">{row.total}</td>
                      <td className="py-1 pr-3 text-amber-300">{row.pending}</td>
                      <td className="py-1 pr-3 text-emerald-300">{row.approved}</td>
                      <td className="py-1 pr-3 text-slate-500">{row.closed}</td>
                      <td className="py-1">
                        {isGap ? (
                          <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                            no sources yet
                          </span>
                        ) : row.required ? (
                          <span className="text-[10px] text-emerald-400">covered</span>
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-slate-500">
          §12 coverage control — watch that no single lane (e.g. regulatory sources) silently dominates the corpus.
          Gap Detection (Constitutional Discovery amendment §6): rows flagged “ratified pillar” with zero sources are
          constitutional gaps — a ratified Coverage Model pillar with no institutional source yet.
        </p>
      </div>

      {/* Exact-duplicate groups */}
      {duplicateGroups.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <h3 className="text-sm font-semibold text-slate-200">Possible exact duplicates</h3>
          <p className="text-[10px] text-slate-500">
            Byte/string-identical matches only (mirrors and re-submissions) — paraphrases and revised editions are NOT
            detected; that judgment stays with you. Use “Mark duplicate” on the non-canonical copy.
          </p>
          {duplicateGroups.map((g) => (
            <div key={`${g.matchType}:${g.key}`} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
              <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">{g.matchType}</span>
              {g.sourceIds.map((sid) => (
                <code key={sid} className="font-mono text-slate-300">{sid}</code>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Filter + candidate list */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-slate-400">
          Review status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | ReviewWorkflowStatus)}
            className="ml-2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
          >
            <option value="all">All ({candidates.length})</option>
            {REVIEW_WORKFLOW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s} ({candidates.filter((c) => c.reviewWorkflowStatus === s).length})
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs italic text-slate-500">No candidate sources match this filter.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((c) => {
            const ingestion = ingestions[c.sourceId];
            const reviewOpen = openReview === c.sourceId;
            const previewOpen = openPreview === c.sourceId;
            const busy = reviewBusy === c.sourceId;
            const approveBlocked = !reviewProvClass;
            return (
              <div key={c.sourceId} className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                {/* Summary line */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{c.title || c.sourceId}</span>
                  {c.campaignSubDomain && (
                    <span className="shrink-0 rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">{c.campaignSubDomain}</span>
                  )}
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${statusChipClass(c.reviewWorkflowStatus)}`}>
                    {c.reviewWorkflowStatus}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  <code className="font-mono">{c.sourceId}</code>
                  {c.issuer && <span>issuer: {c.issuer}</span>}
                  {c.publicationDate && <span>published: {c.publicationDate}</span>}
                  <span>domain: {c.campaignDomain}</span>
                  <span>submitted: {new Date(c.createdAt).toLocaleDateString()}</span>
                  {c.provenanceClass && <span className="text-violet-300">provenance: {c.provenanceClass}</span>}
                  {c.duplicateOfSourceId && <span className="text-sky-300">duplicate of {c.duplicateOfSourceId}</span>}
                </div>

                {/* Verification block (§9) */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300">
                  <span>{c.mimeType ?? 'mime unknown'}</span>
                  <span>{formatBytes(c.fileSizeBytes)}</span>
                  {c.pageCount != null && <span>{c.pageCount} pages</span>}
                  <span className={c.extractionStatus === 'ok' ? 'text-emerald-300' : c.extractionStatus === 'failed' ? 'text-rose-300' : 'text-amber-300'}>
                    extraction: {c.extractionStatus}
                  </span>
                  {c.artifactHash ? (
                    <button
                      onClick={() => copy(`hash-${c.sourceId}`, c.artifactHash!)}
                      title={`sha256 ${c.artifactHash}`}
                      className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      {copied === `hash-${c.sourceId}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      sha256 {c.artifactHash.slice(0, 12)}…
                    </button>
                  ) : (
                    <span className="text-rose-300">no byte hash — never verified</span>
                  )}
                </div>
                {c.extractionWarnings.length > 0 && (
                  <ul className="space-y-0.5 text-[10px] text-amber-300">
                    {c.extractionWarnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
                  </ul>
                )}

                {/* Structural tags — heuristic, advisory only (§8) */}
                {c.structuralTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="uppercase tracking-wide text-slate-500" title="Keyword-heuristic tags — advisory only, never a review decision (PRD-ICA-001 §8)">
                      structural signals (heuristic):
                    </span>
                    {c.structuralTags.map((t) => (
                      <span key={t} className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-violet-300">{t}</span>
                    ))}
                  </div>
                )}

                {/* Ingestion proof — the no-double-ingest receipt */}
                {c.evidenceRowId && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> Ingested — evidence row <code className="font-mono">{c.evidenceRowId}</code>
                  </div>
                )}
                {ingestion && !ingestion.ok && (
                  <p className="text-[11px] text-rose-300">Ingestion failed after approval: {ingestion.error}</p>
                )}

                {/* Preview + review toggles */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setOpenPreview(previewOpen ? null : c.sourceId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white"
                  >
                    {previewOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Content preview
                    {c.normalizedText && (
                      <span className="ml-1 font-mono text-slate-500">
                        ({Math.min(c.normalizedText.length, PREVIEW_CHARS).toLocaleString()} of {c.normalizedText.length.toLocaleString()} chars
                        {c.pageCount ? ` · ${c.pageCount}p` : ''})
                      </span>
                    )}
                  </button>
                  {!c.evidenceRowId && (
                    <button
                      onClick={() => toggleReview(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-300 hover:bg-violet-500/20"
                    >
                      {reviewOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Review
                    </button>
                  )}
                  <a
                    href={c.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-[10px] text-sky-400 hover:text-sky-300"
                    title={c.canonicalUrl}
                  >
                    {c.canonicalUrl}
                  </a>
                </div>

                {previewOpen && (
                  <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] leading-relaxed text-slate-300">
                    {c.normalizedText
                      ? c.normalizedText.slice(0, PREVIEW_CHARS) + (c.normalizedText.length > PREVIEW_CHARS ? ' …' : '')
                      : '(no extracted text — this source failed retrieval or extraction)'}
                  </pre>
                )}

                {reviewOpen && (
                  <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <label className="text-[11px] text-slate-400">
                        Provenance class <span className="text-rose-400">(required on any approval)</span>
                        <select
                          value={reviewProvClass}
                          onChange={(e) => setReviewProvClass(e.target.value as '' | ProvenanceClass)}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
                        >
                          <option value="">— select —</option>
                          {PROVENANCE_CLASSES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-400">
                        Duplicate of (source id — required for “Mark duplicate”)
                        <input
                          value={reviewDupOf}
                          onChange={(e) => setReviewDupOf(e.target.value)}
                          placeholder="SRC-…"
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                      </label>
                    </div>
                    <label className="block text-[11px] text-slate-400">
                      Review notes (optional)
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
                      />
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {APPROVE_DECISIONS.map(({ decision, label }) => (
                        <button
                          key={decision}
                          onClick={() => void decide(c.sourceId, decision)}
                          disabled={busy || approveBlocked}
                          title={approveBlocked ? 'Select a provenance class first — required on any approval (PRD-ICA-001 §0.3)' : undefined}
                          className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
                        </button>
                      ))}
                      {REJECT_DECISIONS.map(({ decision, label }) => (
                        <button
                          key={decision}
                          onClick={() => void decide(c.sourceId, decision)}
                          disabled={busy}
                          className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-400 hover:text-rose-300 disabled:opacity-40"
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={() => void decide(c.sourceId, 'mark_duplicate')}
                        disabled={busy || !reviewDupOf.trim()}
                        title={!reviewDupOf.trim() ? 'Enter the canonical source id this duplicates' : undefined}
                        className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/20 disabled:opacity-40"
                      >
                        Mark duplicate
                      </button>
                    </div>
                    {reviewErrors[c.sourceId] && <p className="text-[11px] text-rose-300">{reviewErrors[c.sourceId]}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CorpusScoutTab;
