"use client";

/**
 * AgentBenchTab — the Founder Office Agent Bench (2026-08-05 canonical
 * Threshold Cohort Activation + Agent Bench plan, §5; extended 2026-08-05
 * per the "Agent Bench — Canonical Agent Lifecycle Brief"). A read-only
 * projection over Marketa's candidate model, EVERY registrable agent
 * (services/horizen/registrableAgents.ts — e.g. Aigent Nakamoto, who has no
 * Marketa candidate row and predates Marketa's discovery pipeline), the
 * extended Access & Invitations mechanism, the Horizen registration
 * resolver, the admission journey's fact reader, the receipt-based
 * Pulse/P&L reader, and the registry's publication/trust state — joined by
 * GET /api/marketa/activation/agent-bench. It owns none of that state;
 * every action either calls an EXISTING write path (the Phase A Admission
 * Package generator) or deep-links to the surface that owns the next step
 * (Passport Review Queue, the Factory record, Financial Services) — never a
 * parallel control (CLAUDE.md "Extend, Don't Duplicate").
 *
 * Organized around what the founder DOES (Discover / Invite / Sponsor /
 * Admit / Deploy / Operate), not around which table a row lives in — §5's
 * governing framing. These are FILTERED VIEWS over one persistent set of
 * rows, never destructive hand-offs: a row is never removed once it
 * advances, it simply reports whichever single `lifecycleState` its real
 * facts currently support and appears under a different tab as those facts
 * change (operator brief, 2026-08-05, acceptance criteria #3/#6).
 *
 * Every row also carries `runtimeMemberships` — a COLLECTION, never a
 * single scalar — because an agent may apply to, qualify for, or operate in
 * more than one runtime (only "Financial Services" has a real backing
 * today; a second runtime is a new array entry, not a redesign).
 *
 * Only Discover has a live action in this pass (Prepare & Send Admission
 * Package); Sponsor stays read-only because Operator Activation is the one
 * non-delegable constitutional act and happens outside this app today, via
 * the Package's own delivery channel (§3, §6 Phase D). Spine discipline:
 * `personaFetch` only. House style: translucent slate, no white hairlines.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Search, Send, HandCoins, ShieldCheck, Rocket, Activity,
  Loader2, RefreshCw, ExternalLink, CheckCircle2, XCircle, MinusCircle, Copy,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { buildCodexUrl } from '@/utils/codex-nav';

type BenchLifecycleState = 'candidate' | 'invited' | 'in-admission' | 'service-ready' | 'engaged';
type BenchRowSource = 'marketa' | 'registrable-agent';
type RuntimeMembershipStatus = 'not-applied' | 'applying' | 'pending-review' | 'approved' | 'active' | 'suspended' | 'revoked';

interface AdmissionFacts {
  sponsorshipRecorded?: boolean;
  delegatePassportIssued?: boolean;
  delegationActive?: boolean;
  factoryPresent?: boolean;
}

interface RuntimeMembership {
  runtimeId: string;
  runtimeLabel: string;
  status: RuntimeMembershipStatus;
  eligibility: { satisfied: string[]; outstanding: string[] };
  approvedAt?: string;
  activatedAt?: string;
}

interface AgreementRow {
  id: string;
  status: string;
  selectedAgentRef: string | null;
  displayLabel: string;
}

interface AgentBenchRow {
  candidateId: string;
  name: string;
  source: BenchRowSource;
  registryProvider: string | null;
  registryNetwork: string | null;
  onChainAgentId: string | null;
  capabilities: string[];
  /** Null when there is no Marketa candidate scoring for this row (e.g. a registrable-agent-only row) — never fabricated. */
  overallPriorityScore: number | null;
  lifecycleState: BenchLifecycleState;
  admission: AdmissionFacts | null;
  registry: { publicationStatus: string; trustBand: string } | null;
  pulseAuthorized: boolean;
  pnlEnabled: boolean;
  runtimeMemberships: RuntimeMembership[];
  agreements: AgreementRow[];
}

interface BenchData {
  counts: Record<string, number>;
  rows: Record<BenchLifecycleState, AgentBenchRow[]>;
}

type BenchAction = 'discover' | 'invite' | 'sponsor' | 'admit' | 'deploy' | 'operate';

const ACTIONS: {
  id: BenchAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  lifecycle: BenchLifecycleState;
  blurb: string;
}[] = [
  { id: 'discover', label: 'Discover', icon: Search, lifecycle: 'candidate',
    blurb: 'Marketa-qualified candidates — no Admission Package generated yet.' },
  { id: 'invite', label: 'Invite', icon: Send, lifecycle: 'invited',
    blurb: 'Admission Package delivered — tracked as one funnel step until package sub-status (sent/opened/accepted) is persisted.' },
  { id: 'sponsor', label: 'Sponsor', icon: HandCoins, lifecycle: 'invited',
    blurb: 'The sponsorship decision itself. Operator Activation is the sole act that originates authority — it happens via the Package’s own delivery channel, not a button here.' },
  { id: 'admit', label: 'Admit', icon: ShieldCheck, lifecycle: 'in-admission',
    blurb: 'Sponsorship accepted — the admission journey is running. Deep-links to the Passport Review Queue and the Factory record; never duplicates their controls.' },
  { id: 'deploy', label: 'Deploy', icon: Rocket, lifecycle: 'service-ready',
    blurb: 'Approved for at least one runtime — the computed constitutional + technical checklist holds for it.' },
  { id: 'operate', label: 'Operate', icon: Activity, lifecycle: 'engaged',
    blurb: 'Active in at least one runtime — role, scope, and receipts shown per runtime membership.' },
];

const RUNTIME_STATUS_STYLE: Record<RuntimeMembershipStatus, string> = {
  'not-applied': 'border-slate-600 bg-slate-800/60 text-slate-500',
  applying: 'border-slate-600 bg-slate-800/60 text-slate-400',
  'pending-review': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  approved: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  suspended: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  revoked: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

async function fetchBench(): Promise<BenchData | { error: string }> {
  const res = await personaFetch('/api/marketa/activation/agent-bench', { cache: 'no-store' });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !data || data.ok !== true) {
    return { error: (data && typeof data.error === 'string' && data.error) || `HTTP ${res.status}` };
  }
  return { counts: data.counts as Record<string, number>, rows: data.rows as Record<BenchLifecycleState, AgentBenchRow[]> };
}

async function generatePackage(candidateId: string): Promise<{ ok: boolean; error?: string; journeyLink?: string }> {
  const res = await personaFetch(`/api/marketa/activation/candidates/${candidateId}/admission-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !data || data.ok !== true) {
    return { ok: false, error: (data && typeof data.error === 'string' && data.error) || `HTTP ${res.status}` };
  }
  const pkg = data.package as Record<string, unknown> | undefined;
  const operatorFacing = pkg?.operatorFacing as Record<string, unknown> | undefined;
  const journeyLink = typeof operatorFacing?.journeyLink === 'string' ? operatorFacing.journeyLink : undefined;
  return { ok: true, journeyLink };
}

function ExternalRefLine({ row }: { row: AgentBenchRow }) {
  if (!row.registryProvider || !row.onChainAgentId) {
    return <span className="text-slate-600 italic">no external registry link</span>;
  }
  return (
    <span className="font-mono text-slate-500">
      {row.registryProvider}
      {row.registryNetwork ? `:${row.registryNetwork}` : ''}:{row.onChainAgentId}
    </span>
  );
}

function FactChip({ label, value }: { label: string; value: boolean | undefined }) {
  const Icon = value === true ? CheckCircle2 : value === false ? XCircle : MinusCircle;
  const cls = value === true
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    : value === false
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
      : 'border-slate-600 bg-slate-800/60 text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

/** One badge per runtime membership — the multi-runtime model rendered as a
 *  strip, never collapsed into a single pass/fail flag (operator brief). */
function RuntimeMembershipBadges({ memberships }: { memberships: RuntimeMembership[] }) {
  if (memberships.length === 0) {
    return <span className="text-[10px] text-slate-600 italic">no runtime memberships tracked for this agent</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {memberships.map((m) => (
        <span
          key={m.runtimeId}
          title={
            m.eligibility.outstanding.length > 0
              ? `Outstanding: ${m.eligibility.outstanding.join('; ')}`
              : 'All eligibility conditions satisfied'
          }
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${RUNTIME_STATUS_STYLE[m.status]}`}
        >
          {m.runtimeLabel}: {m.status}
        </span>
      ))}
    </div>
  );
}

/** Always-visible persistent facts — identity, source, capabilities,
 *  registry/trust band, Pulse/P&L, runtime memberships. Shown the same
 *  regardless of which action tab is active, per the card-structure spec:
 *  the tab-specific section below carries only the NEXT governed act. */
function PersistentCardHeader({ row }: { row: AgentBenchRow }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-1.5">
          <div className="text-sm text-slate-200 font-medium">{row.name}</div>
          <span className="rounded border border-slate-700 bg-slate-800/40 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
            {row.source === 'registrable-agent' ? 'registrable agent' : 'via Marketa'}
          </span>
        </div>
        <div className="text-[11px] mt-0.5"><ExternalRefLine row={row} /></div>
        {row.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {row.capabilities.map((c) => (
              <span key={c} className="rounded bg-slate-800/60 border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">{c}</span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {row.registry && (
            <span className="rounded-full border border-slate-600 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400">
              {row.registry.publicationStatus} · {row.registry.trustBand}
            </span>
          )}
          <FactChip label="Pulse" value={row.pulseAuthorized} />
          <FactChip label="P&L" value={row.pnlEnabled} />
        </div>
        <div className="mt-1.5">
          <RuntimeMembershipBadges memberships={row.runtimeMemberships} />
        </div>
      </div>
      <div className="shrink-0 text-right text-[11px] text-slate-500">
        Priority <span className="text-slate-300 font-mono">{row.overallPriorityScore ?? '—'}</span>
      </div>
    </div>
  );
}

function RowCard({ row, action, personaId, onPrepared }: {
  row: AgentBenchRow;
  action: BenchAction;
  personaId?: string;
  onPrepared: (candidateId: string, journeyLink?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [lastJourneyLink, setLastJourneyLink] = useState<string | undefined>(undefined);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  const handlePrepare = async () => {
    setBusy(true);
    setPrepareError(null);
    const result = await generatePackage(row.candidateId);
    setBusy(false);
    if (!result.ok) {
      setPrepareError(result.error ?? 'failed');
      return;
    }
    setLastJourneyLink(result.journeyLink);
    onPrepared(row.candidateId, result.journeyLink);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
      <PersistentCardHeader row={row} />

      {action === 'discover' && row.source !== 'marketa' && (
        <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-500 italic">
          Registrable, but not a Marketa discovery record — the Admission Package generator is Marketa-candidate-scoped.
          This agent's admission proceeds via its own Journey, never a second admission process.
        </div>
      )}

      {action === 'discover' && row.source === 'marketa' && (
        <div className="pt-1 border-t border-slate-800 space-y-1.5">
          <button
            disabled={busy}
            onClick={handlePrepare}
            className="flex items-center gap-1.5 rounded bg-violet-600/80 hover:bg-violet-600 text-white text-xs px-3 py-1.5 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Prepare &amp; Send Admission Package
          </button>
          {prepareError && <div className="text-[11px] text-rose-400">{prepareError}</div>}
          {lastJourneyLink && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Journey link (share with the agent/operator):</span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(lastJourneyLink);
                  setCopyState('copied');
                  setTimeout(() => setCopyState('idle'), 1500);
                }}
                className="flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:text-slate-200"
              >
                <Copy className="h-3 w-3" /> {copyState === 'copied' ? 'copied' : 'copy'}
              </button>
            </div>
          )}
        </div>
      )}

      {(action === 'invite' || action === 'sponsor') && (
        <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-500 italic">
          Package delivered — awaiting the operator's sponsorship decision (Approve / Decline / Request More Information).
          This decision happens via the Package's own delivery channel, not in this console.
        </div>
      )}

      {action === 'admit' && (
        <div className="pt-1 border-t border-slate-800 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <FactChip label="Sponsorship recorded" value={row.admission?.sponsorshipRecorded} />
            <FactChip label="Delegate Passport issued" value={row.admission?.delegatePassportIssued} />
            <FactChip label="Delegation active" value={row.admission?.delegationActive} />
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <a
              href={buildCodexUrl('polity-passport-bureau', { tab: 'steward', personaId })}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-violet-300 hover:text-violet-200"
            >
              <ExternalLink className="h-3 w-3" /> Passport Review Queue
            </a>
            <a
              href={buildCodexUrl('agentiq', { tab: 'factory-intake', personaId })}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-violet-300 hover:text-violet-200"
            >
              <ExternalLink className="h-3 w-3" /> Factory record
            </a>
          </div>
        </div>
      )}

      {action === 'deploy' && (
        <div className="pt-1 border-t border-slate-800 space-y-1.5">
          {row.runtimeMemberships
            .filter((m) => m.status === 'approved')
            .map((m) => (
              <div key={m.runtimeId} className="text-[11px] text-slate-400">
                <span className="text-slate-300">{m.runtimeLabel}</span> is approved — every eligibility condition holds.
              </div>
            ))}
          {row.runtimeMemberships.some((m) => m.eligibility.outstanding.length > 0) && (
            <ul className="text-[10px] text-slate-500 list-disc list-inside">
              {row.runtimeMemberships.flatMap((m) => m.eligibility.outstanding.map((u) => `${m.runtimeLabel}: ${u}`)).map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          )}
          <a
            href={buildCodexUrl('venture-lab', { tab: 'financial-services', personaId })}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200"
          >
            <ExternalLink className="h-3 w-3" /> Financial Services selector
          </a>
        </div>
      )}

      {action === 'operate' && (
        <div className="pt-1 border-t border-slate-800 space-y-1">
          {row.agreements.length === 0 && <div className="text-[11px] text-slate-500 italic">No agreements on record.</div>}
          {row.agreements.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">{a.displayLabel}</span>
              <span className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-slate-400">{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentBenchTab({ personaId }: { personaId?: string }) {
  const [data, setData] = useState<BenchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<BenchAction>('discover');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const result = await fetchBench();
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

  const activeAction = ACTIONS.find((a) => a.id === action)!;
  const activeRows = data?.rows[activeAction.lifecycle] ?? [];

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Agent Bench</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              The founder's operating console over Marketa candidates, every registrable agent, Access &amp;
              Invitations, the admission journey's facts, the Horizen registration resolver, and the registry's
              publication/trust state — organized around what you do, not which table a row lives in. It owns none of
              that state; every action either calls an existing write path or deep-links to the surface that does.
            </p>
          </div>
          <button onClick={load} className="shrink-0 flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-300">
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            const count = data?.rows[a.lifecycle].length;
            return (
              <button
                key={a.id}
                onClick={() => setAction(a.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                  action === a.id
                    ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {a.label}
                {typeof count === 'number' && <span className="text-slate-500">({count})</span>}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2 italic">{activeAction.blurb}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-800/60 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</div>
      )}

      {!data && !error && (
        <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> loading…</div>
      )}

      {data && (
        <div className="space-y-2">
          {activeRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-4 text-center text-xs text-slate-500">
              No agents in {activeAction.label} right now.
            </div>
          )}
          {activeRows.map((row) => (
            <RowCard key={row.candidateId} row={row} action={action} personaId={personaId} onPrepared={() => load()} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentBenchTab;
