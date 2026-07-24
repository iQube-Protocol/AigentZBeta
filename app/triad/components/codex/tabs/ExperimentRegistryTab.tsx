"use client";

/**
 * ExperimentRegistryTab — the Experiment / Constitutional / Invariant
 * Registry + Research Backlog admin CRUD surface (CFS-051, Strand 1 build
 * 2026-07-24).
 *
 * Operator framing: "this should be able to be updated in the front end...
 * admin gated but stubbed for opening up to cohorts or token gated access."
 * This is the real, working admin surface for the four registers created by
 * migration 20260820000000 and served by /api/research/registry
 * (services/research/registryStore.ts, gated by
 * services/research/registryAccess.ts::canManageRegistry — today platform
 * admin, a documented, swappable follow-on point for cohort/token-gated
 * public proposal access, not built here).
 *
 * Four sections share ONE shape: list + create form + per-item status
 * transition + append-only review-history note. Spine discipline:
 * `personaFetch` only (CLAUDE.md PARAMOUNT). House style: translucent slate
 * (`bg-slate-900/40`, `border-slate-800`) — no white hairlines.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlaskConical, Scale, BookMarked, ListTodo, Plus, ChevronDown, ChevronRight,
  Loader2, RefreshCw, MessageSquarePlus,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import type {
  CandidateExperiment,
  CandidatePrinciple,
  CandidateInvariant,
  BacklogItem,
  RegistryKind,
  RegistryReviewEntry,
} from '@/types/researchRegistry';
import {
  CANDIDATE_EXPERIMENT_STATUSES,
  CANDIDATE_PRINCIPLE_STATUSES,
  CANDIDATE_INVARIANT_STATUSES,
  BACKLOG_STATUSES,
} from '@/types/researchRegistry';

type Section = 'experiment' | 'principle' | 'invariant' | 'backlog';

const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'experiment', label: 'Candidate Experiments', icon: FlaskConical },
  { id: 'principle', label: 'Candidate Principles', icon: Scale },
  { id: 'invariant', label: 'Candidate Invariants', icon: BookMarked },
  { id: 'backlog', label: 'Research Backlog', icon: ListTodo },
];

const STATUS_OPTIONS: Record<Section, readonly string[]> = {
  experiment: CANDIDATE_EXPERIMENT_STATUSES,
  principle: CANDIDATE_PRINCIPLE_STATUSES,
  invariant: CANDIDATE_INVARIANT_STATUSES,
  backlog: BACKLOG_STATUSES,
};

function statusChipClass(status: string): string {
  if (['ratified', 'canonized', 'published', 'promoted', 'done'].includes(status)) {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  }
  if (['rejected', 'archived'].includes(status)) {
    return 'border-rose-500/40 bg-rose-500/10 text-rose-300';
  }
  if (['under-review', 'proposed-for-canonization', 'scoped', 'in-progress', 'running'].includes(status)) {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  }
  return 'border-slate-600 bg-slate-800/60 text-slate-400'; // proposed / candidate / backlog
}

interface RegistryData {
  experiments: CandidateExperiment[];
  principles: CandidatePrinciple[];
  invariants: CandidateInvariant[];
  backlog: BacklogItem[];
}

async function fetchRegistry(): Promise<RegistryData | { error: string }> {
  const res = await personaFetch('/api/research/registry', { cache: 'no-store' });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !data || data.ok !== true) {
    return { error: (data && typeof data.error === 'string' && data.error) || `HTTP ${res.status}` };
  }
  return {
    experiments: (data.experiments as CandidateExperiment[]) ?? [],
    principles: (data.principles as CandidatePrinciple[]) ?? [],
    invariants: (data.invariants as CandidateInvariant[]) ?? [],
    backlog: (data.backlog as BacklogItem[]) ?? [],
  };
}

async function postAction(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await personaFetch('/api/research/registry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !data || data.ok !== true) {
    return { ok: false, error: (data && typeof data.error === 'string' && data.error) || `HTTP ${res.status}` };
  }
  return { ok: true };
}

function ReviewHistoryList({ history }: { history: RegistryReviewEntry[] }) {
  if (history.length === 0) return <p className="text-[11px] text-slate-500 italic">No review notes yet.</p>;
  return (
    <ul className="space-y-1.5">
      {history
        .slice()
        .reverse()
        .map((h, i) => (
          <li key={i} className="text-[11px] text-slate-400 border-l-2 border-slate-700 pl-2">
            <span className="font-mono text-slate-500">{h.reviewerRef.slice(0, 10)}…</span>{' '}
            <span className="text-slate-300 font-semibold">{h.disposition}</span>{' '}
            <span className="text-slate-500">{new Date(h.date).toLocaleString()}</span>
            <div className="text-slate-400">{h.note}</div>
          </li>
        ))}
    </ul>
  );
}

function ReviewNoteForm({ onSubmit }: { onSubmit: (note: string, disposition: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [disposition, setDisposition] = useState('note-only');
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <select
        value={disposition}
        onChange={(e) => setDisposition(e.target.value)}
        className="rounded border border-slate-700 bg-slate-900/60 text-[11px] text-slate-300 px-1.5 py-1"
      >
        {['note-only', 'approve', 'needs-revision', 'reject'].map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Review note…"
        className="flex-1 min-w-[160px] rounded border border-slate-700 bg-slate-900/60 text-[11px] text-slate-200 px-2 py-1 placeholder:text-slate-600"
      />
      <button
        disabled={busy || !note.trim()}
        onClick={async () => {
          setBusy(true);
          await onSubmit(note, disposition);
          setNote('');
          setBusy(false);
        }}
        className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/60 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700/60 disabled:opacity-40"
      >
        <MessageSquarePlus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

interface ItemCardProps {
  id: string;
  headline: string;
  subline?: string | null;
  status: string;
  section: Section;
  dependsOn: string[];
  sourceNote?: string | null;
  charterRef?: string | null;
  reviewHistory: RegistryReviewEntry[];
  onStatusChange: (status: string) => Promise<void>;
  onAddReview: (note: string, disposition: string) => Promise<void>;
}

function ItemCard(p: ItemCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-start gap-1.5 text-left flex-1">
          {open ? <ChevronDown className="h-3.5 w-3.5 mt-0.5 text-slate-500 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-slate-500 shrink-0" />}
          <div>
            <div className="text-sm text-slate-200 font-medium">{p.headline}</div>
            {p.subline && <div className="text-xs text-slate-500 mt-0.5">{p.subline}</div>}
          </div>
        </button>
        <select
          value={p.status}
          onChange={(e) => p.onStatusChange(e.target.value)}
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] border ${statusChipClass(p.status)}`}
        >
          {STATUS_OPTIONS[p.section].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {open && (
        <div className="mt-2.5 space-y-2 pl-5 border-t border-slate-800 pt-2.5">
          {p.charterRef && (
            <div className="text-[11px] text-slate-500">
              Charter: <span className="text-slate-300 font-mono">{p.charterRef}</span>
            </div>
          )}
          {p.sourceNote && <div className="text-[11px] text-slate-500 italic">{p.sourceNote}</div>}
          {p.dependsOn.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {p.dependsOn.map((d) => (
                <span key={d} className="rounded bg-slate-800/60 border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">{d}</span>
              ))}
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Review history</div>
            <ReviewHistoryList history={p.reviewHistory} />
            <ReviewNoteForm onSubmit={p.onAddReview} />
          </div>
        </div>
      )}
    </div>
  );
}

/** A minimal, honest create form: one text field per required column, a few
 *  optional ones behind "more fields". Kept intentionally plain — this is a
 *  working admin CRUD surface, not a design showpiece. */
function CreateForm({ section, onCreate }: { section: Section; onCreate: (fields: Record<string, unknown>) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const primaryFieldsBySection: Record<Section, { key: string; label: string; area?: boolean }[]> = {
    experiment: [
      { key: 'title', label: 'Title' },
      { key: 'hypothesis', label: 'Hypothesis', area: true },
      { key: 'family', label: 'Family' },
      { key: 'charterRef', label: 'Charter ref (repo path, if real)' },
      { key: 'sourceNote', label: 'Source note (honest provenance)' },
    ],
    principle: [
      { key: 'statement', label: 'Statement', area: true },
      { key: 'rationale', label: 'Rationale', area: true },
      { key: 'charterRef', label: 'Charter ref (repo path, if real)' },
      { key: 'sourceNote', label: 'Source note' },
    ],
    invariant: [
      { key: 'statement', label: 'Statement', area: true },
      { key: 'namespace', label: 'Namespace' },
      { key: 'rationale', label: 'Rationale', area: true },
      { key: 'sourceNote', label: 'Source note' },
    ],
    backlog: [
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description', area: true },
      { key: 'sourceNote', label: 'Source note' },
    ],
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-300 w-full justify-center"
      >
        <Plus className="h-3.5 w-3.5" /> New {section}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
      {primaryFieldsBySection[section].map((f) =>
        f.area ? (
          <textarea
            key={f.key}
            placeholder={f.label}
            value={fields[f.key] ?? ''}
            onChange={set(f.key)}
            rows={2}
            className="w-full rounded border border-slate-700 bg-slate-900/60 text-xs text-slate-200 px-2 py-1.5 placeholder:text-slate-600"
          />
        ) : (
          <input
            key={f.key}
            placeholder={f.label}
            value={fields[f.key] ?? ''}
            onChange={set(f.key)}
            className="w-full rounded border border-slate-700 bg-slate-900/60 text-xs text-slate-200 px-2 py-1.5 placeholder:text-slate-600"
          />
        ),
      )}
      <div className="flex items-center gap-2">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onCreate(fields);
            setFields({});
            setExpanded(false);
            setBusy(false);
          }}
          className="rounded bg-violet-600/80 hover:bg-violet-600 text-white text-xs px-3 py-1.5 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create'}
        </button>
        <button onClick={() => setExpanded(false)} className="text-xs text-slate-500 hover:text-slate-400">Cancel</button>
      </div>
    </div>
  );
}

export function ExperimentRegistryTab() {
  const [data, setData] = useState<RegistryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('experiment');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const result = await fetchRegistry();
    if ('error' in result) setError(result.error);
    else {
      setError(null);
      setData(result);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kindFor = (s: Section): RegistryKind => s;

  const handleCreate = async (fields: Record<string, unknown>) => {
    await postAction({ action: 'create', kind: kindFor(section), fields });
    await load();
  };
  const handleStatusChange = async (id: string, status: string) => {
    await postAction({ action: 'transition-status', kind: kindFor(section), id, status });
    await load();
  };
  const handleAddReview = async (id: string, note: string, disposition: string) => {
    await postAction({ action: 'add-review', kind: kindFor(section), id, note, disposition });
    await load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Experiment / Constitutional / Invariant Registry</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Candidate research threads, candidate constitutional principles, candidate structural invariants, and
              the research backlog — status, dependencies, and review history. Admin-only today (CFS-051); a
              swappable gate (<code className="text-slate-400">canManageRegistry</code>) is the widening point for
              cohort/token-gated public proposal access.
            </p>
          </div>
          <button onClick={load} className="shrink-0 flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-300">
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const count =
              s.id === 'experiment' ? data?.experiments.length
              : s.id === 'principle' ? data?.principles.length
              : s.id === 'invariant' ? data?.invariants.length
              : data?.backlog.length;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                  section === s.id
                    ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {s.label}
                {typeof count === 'number' && <span className="text-slate-500">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-800/60 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</div>
      )}

      {!data && !error && (
        <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> loading…</div>
      )}

      {data && (
        <div className="space-y-2">
          <CreateForm section={section} onCreate={handleCreate} />

          {section === 'experiment' &&
            data.experiments.map((e) => (
              <ItemCard
                key={e.id}
                id={e.id}
                headline={e.title}
                subline={`${e.family ?? '—'}${e.layer ? ` · Layer ${e.layer}` : ''}${e.seriesId ? ` · ${e.seriesId}` : ''} — ${e.hypothesis}`}
                status={e.status}
                section="experiment"
                dependsOn={e.dependsOn}
                sourceNote={e.sourceNote}
                charterRef={e.charterRef}
                reviewHistory={e.reviewHistory}
                onStatusChange={(s) => handleStatusChange(e.id, s)}
                onAddReview={(n, d) => handleAddReview(e.id, n, d)}
              />
            ))}

          {section === 'principle' &&
            data.principles.map((pr) => (
              <ItemCard
                key={pr.id}
                id={pr.id}
                headline={pr.statement}
                subline={pr.rationale ?? undefined}
                status={pr.status}
                section="principle"
                dependsOn={pr.dependsOn}
                sourceNote={pr.sourceNote}
                charterRef={pr.charterRef}
                reviewHistory={pr.reviewHistory}
                onStatusChange={(s) => handleStatusChange(pr.id, s)}
                onAddReview={(n, d) => handleAddReview(pr.id, n, d)}
              />
            ))}

          {section === 'invariant' &&
            data.invariants.map((inv) => (
              <ItemCard
                key={inv.id}
                id={inv.id}
                headline={inv.statement}
                subline={`${inv.namespace ?? 'namespace unset'}${inv.promotedInvariantId ? ` → promoted as ${inv.promotedInvariantId}` : ''}`}
                status={inv.status}
                section="invariant"
                dependsOn={inv.dependsOn}
                sourceNote={inv.sourceNote}
                reviewHistory={inv.reviewHistory}
                onStatusChange={(s) => handleStatusChange(inv.id, s)}
                onAddReview={(n, d) => handleAddReview(inv.id, n, d)}
              />
            ))}

          {section === 'backlog' &&
            data.backlog.map((b) => (
              <ItemCard
                key={b.id}
                id={b.id}
                headline={`[${b.priority}] ${b.title}`}
                subline={b.description ?? undefined}
                status={b.status}
                section="backlog"
                dependsOn={[...b.linkedExperimentIds, ...b.linkedHypothesisIds]}
                sourceNote={b.sourceNote}
                reviewHistory={b.reviewHistory}
                onStatusChange={(s) => handleStatusChange(b.id, s)}
                onAddReview={(n, d) => handleAddReview(b.id, n, d)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default ExperimentRegistryTab;
