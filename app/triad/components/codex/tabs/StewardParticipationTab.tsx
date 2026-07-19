"use client";

/**
 * StewardParticipationTab — the Passport Steward's "Access & Invitations"
 * workspace (Constitutional Access Service; operator + Aletheon, 2026-07-18).
 *
 * One mechanism, five access domains (Passport, Research Lab, Venture Lab,
 * metaMe Studio, Developer Studio) as a left side-menu — the third tier the
 * Steward tab needed. Per domain: issue bounded bearer invitations (code
 * shown ONCE; only its hash is stored), see issued invitations with claim
 * state, revoke, and read the canonical access-grant record. The passport
 * domain also surfaces the participant-initiated application queue counts
 * (with the agent-assisted subset) — the Review Queue tab remains that
 * path's decision surface; this workspace does not replace it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Award, Check, Copy, Gavel, Loader2, Plus, ShieldCheck, X } from 'lucide-react';
import { authedFetchHeaders } from '@/utils/supabaseBrowser';

interface DomainDef { id: string; label: string; roles: string[] }
interface AssignableExperiment { id: string; label: string }
interface InvitationRow {
  id: string;
  accessDomain: string;
  role: string;
  label: string | null;
  intendedRecipient: string | null;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  status: string;
  createdAt: string;
}
interface GrantRow {
  id: string;
  accessDomain: string;
  role: string;
  source: string;
  status: string;
  grantedAt: string;
  expiresAt: string | null;
  receiptId: string | null;
  holderRef: string;
}
interface AppCounts { total: number; pending: number; agentAssisted: number }

export function StewardParticipationTab() {
  const [domains, setDomains] = useState<DomainDef[]>([]);
  const [assignableExperiments, setAssignableExperiments] = useState<AssignableExperiment[]>([]);
  interface PendingResult { id: string; experiment: string; provider: string; model: string; contentHash: string; submitterRef: string | null; createdAt: string }
  const [pendingResults, setPendingResults] = useState<PendingResult[]>([]);
  const [resultBusy, setResultBusy] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [applications, setApplications] = useState<AppCounts | null>(null);
  const [activeDomain, setActiveDomain] = useState<string>('passport');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-invitation form
  const [formRole, setFormRole] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formRecipient, setFormRecipient] = useState('');
  const [formMaxUses, setFormMaxUses] = useState(1);
  const [formExpiresDays, setFormExpiresDays] = useState(30);
  // Per-invitation experiment scoping (research-lab domain). Empty = all.
  const [formExperiments, setFormExperiments] = useState<string[]>([]);
  const [formOtherExperiment, setFormOtherExperiment] = useState("");
  const [issuing, setIssuing] = useState(false);
  // The one-time issued code — shown until dismissed, never recoverable after.
  const [issued, setIssued] = useState<{ code: string; inviteUrl: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authedFetchHeaders({ Accept: 'application/json' });
      const res = await fetch('/api/steward/participation', { cache: 'no-store', headers: headers ?? undefined });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Failed to load participation data');
        return;
      }
      setDomains(data.domains ?? []);
      setAssignableExperiments(data.assignableExperiments ?? []);
      setInvitations(data.invitations ?? []);
      setGrants(data.grants ?? []);
      setApplications(data.applications ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadResults = useCallback(async () => {
    try {
      const headers = await authedFetchHeaders({ Accept: "application/json" });
      const res = await fetch("/api/steward/participation/results", { cache: "no-store", headers: headers ?? undefined });
      const data = await res.json();
      if (res.ok && data?.ok) setPendingResults(data.pending ?? []);
    } catch { /* non-fatal */ }
  }, []);

  const decideResult = useCallback(async (resultId: string, action: "approve" | "reject") => {
    setResultBusy(resultId);
    try {
      const headers = await authedFetchHeaders({ "Content-Type": "application/json" });
      await fetch("/api/steward/participation/results", {
        method: "PATCH",
        headers: headers ?? undefined,
        body: JSON.stringify({ resultId, action }),
      });
      await loadResults();
    } finally {
      setResultBusy(null);
    }
  }, [loadResults]);

  useEffect(() => {
    void load();
    void loadResults();
  }, [load, loadResults]);

  const domain = domains.find((d) => d.id === activeDomain);

  useEffect(() => {
    // Keep the role select valid when switching domains.
    if (domain && !domain.roles.includes(formRole)) setFormRole(domain.roles[0] ?? '');
  }, [domain, formRole]);

  const issueInvitation = useCallback(async () => {
    if (!domain || !formRole) return;
    setIssuing(true);
    setError(null);
    try {
      const headers = await authedFetchHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/steward/participation/invitations', {
        method: 'POST',
        headers: headers ?? undefined,
        body: JSON.stringify({
          domain: domain.id,
          role: formRole,
          label: formLabel || undefined,
          intendedRecipient: formRecipient || undefined,
          maxUses: formMaxUses,
          expiresInDays: formExpiresDays || undefined,
          allowedExperiments:
            domain?.id === 'research-lab'
              ? [...formExperiments, ...(formOtherExperiment.trim() ? [formOtherExperiment.trim()] : [])]
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Invitation issue failed');
        return;
      }
      setIssued({ code: data.code, inviteUrl: data.inviteUrl });
      setFormLabel('');
      setFormRecipient('');
      setFormExperiments([]);
      setFormOtherExperiment('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invitation issue failed');
    } finally {
      setIssuing(false);
    }
  }, [domain, formRole, formLabel, formRecipient, formMaxUses, formExpiresDays, load]);

  const revokeInvitation = useCallback(async (invitationId: string) => {
    setRevokeBusy(invitationId);
    try {
      const headers = await authedFetchHeaders({ 'Content-Type': 'application/json' });
      await fetch('/api/steward/participation/invitations', {
        method: 'PATCH',
        headers: headers ?? undefined,
        body: JSON.stringify({ invitationId, action: 'revoke' }),
      });
      await load();
    } finally {
      setRevokeBusy(null);
    }
  }, [load]);

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading participation workspace…
      </div>
    );
  }

  const domainInvitations = invitations.filter((i) => i.accessDomain === activeDomain);
  const domainGrants = grants.filter((g) => g.accessDomain === activeDomain);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Domain side-menu (third tier) */}
      <div className="w-52 flex-shrink-0 border-r border-slate-800 bg-slate-900/40 overflow-y-auto p-2.5">
        <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <Gavel className="h-3.5 w-3.5" /> Access domains
        </h3>
        <div className="space-y-1">
          {domains.map((d) => {
            const pending = invitations.filter((i) => i.accessDomain === d.id && i.status === 'active').length;
            return (
              <button
                key={d.id}
                onClick={() => setActiveDomain(d.id)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                  activeDomain === d.id ? 'bg-violet-500/20 text-violet-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className="truncate">{d.label}</span>
                {pending > 0 && (
                  <span className="ml-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 text-[9px] text-violet-300">{pending}</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] leading-snug text-slate-500">
          One mechanism, every permissioned area. Invitations are steward-initiated;
          applications stay participant-initiated (Review Queue). Both converge into
          the same access-grant record.
        </p>
      </div>

      {/* Domain workspace */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && <p className="text-xs text-amber-300">{error}</p>}
        <div>
          <h2 className="text-base font-semibold text-slate-100">{domain?.label ?? activeDomain}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {domainInvitations.filter((i) => i.status === 'active').length} active invitation(s) ·{' '}
            {domainGrants.filter((g) => g.status === 'active').length} active grant(s)
          </p>
        </div>

        {/* Passport domain: the application path summary */}
        {activeDomain === 'passport' && applications && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
            <span className="font-semibold text-slate-200">Applications (participant-initiated):</span>{' '}
            {applications.pending} pending of {applications.total} total ·{' '}
            <span className="text-amber-300">{applications.agentAssisted} agent-assisted</span> — review and decide in the{' '}
            <span className="text-violet-300">Review Queue</span> tab. Agents can prepare applications; issuing and
            claiming remain human constitutional acts.
          </div>
        )}

        {/* Issue invitation */}
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
            <Plus className="h-4 w-4 text-violet-300" /> Issue invitation
          </h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="text-[11px] text-slate-400">
              Role
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
              >
                {(domain?.roles ?? []).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-slate-400">
              Label (what this invitation is for)
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. Phase 1 Independent Review — Austin"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
              />
            </label>
            <label className="text-[11px] text-slate-400">
              Intended recipient (optional — named invitation)
              <input
                value={formRecipient}
                onChange={(e) => setFormRecipient(e.target.value)}
                placeholder="email / handle (informational)"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
              />
            </label>
            <div className="flex gap-2">
              <label className="flex-1 text-[11px] text-slate-400">
                Max uses
                <input
                  type="number" min={1}
                  value={formMaxUses}
                  onChange={(e) => setFormMaxUses(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
                />
              </label>
              <label className="flex-1 text-[11px] text-slate-400">
                Expires (days)
                <input
                  type="number" min={0}
                  value={formExpiresDays}
                  onChange={(e) => setFormExpiresDays(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
                />
              </label>
            </div>
          </div>

          {/* Experiment scoping — research-lab only. No selection = all
              experiments; select a subset to restrict the reviewer. Acceptance
              tests, reports, and plates always stay admin-only. */}
          {activeDomain === 'research-lab' && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <div className="text-[11px] text-slate-400 mb-1.5">
                Experiments this invitation grants <span className="text-slate-500">(none = all)</span>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {assignableExperiments.map((exp) => {
                  const checked = formExperiments.includes(exp.id);
                  return (
                    <label key={exp.id} className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setFormExperiments((prev) =>
                            checked ? prev.filter((e) => e !== exp.id) : [...prev, exp.id],
                          )
                        }
                        className="h-3 w-3 accent-violet-500"
                      />
                      <span className="truncate">{exp.label}</span>
                    </label>
                  );
                })}
              </div>
              <input
                value={formOtherExperiment}
                onChange={(e) => setFormOtherExperiment(e.target.value)}
                placeholder="Other (free text — e.g. a custom protocol id)"
                className="mt-1.5 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500"
              />
            </div>
          )}

          <button
            onClick={issueInvitation}
            disabled={issuing || !formRole}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {issuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Issue bearer invitation
          </button>

          {issued && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 space-y-1.5 text-[11px]">
              <p className="text-emerald-200 font-medium">
                Invitation issued — copy the code/link NOW. It is shown once; only its hash is stored.
              </p>
              <div className="flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate font-mono text-emerald-300">{issued.code}</code>
                <button onClick={() => copy('code', issued.code)} className="p-0.5">
                  {copied === 'code' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400 hover:text-white" />}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate font-mono text-sky-300">{issued.inviteUrl}</code>
                <button onClick={() => copy('url', issued.inviteUrl)} className="p-0.5">
                  {copied === 'url' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400 hover:text-white" />}
                </button>
              </div>
              <button onClick={() => setIssued(null)} className="text-[10px] text-slate-400 hover:text-slate-200">Dismiss</button>
            </div>
          )}
        </div>

        {/* Invitations */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
          <h3 className="text-sm font-semibold text-slate-200">Invitations</h3>
          {domainInvitations.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No invitations issued for this domain yet.</p>
          ) : (
            <div className="space-y-1">
              {domainInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
                  <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 shrink-0">{inv.role}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">
                    {inv.label || 'Untitled invitation'}
                    {inv.intendedRecipient && <span className="text-slate-500"> → {inv.intendedRecipient}</span>}
                  </span>
                  <span className="text-slate-500 shrink-0">{inv.uses}/{inv.maxUses} used</span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                      inv.status === 'active'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : inv.status === 'exhausted'
                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                          : 'border-slate-600 text-slate-400'
                    }`}
                  >
                    {inv.status}
                  </span>
                  {inv.status === 'active' && (
                    <button
                      title="Revoke this invitation"
                      onClick={() => void revokeInvitation(inv.id)}
                      disabled={revokeBusy === inv.id}
                      className="p-0.5 shrink-0"
                    >
                      {revokeBusy === inv.id
                        ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                        : <X className="h-3 w-3 text-slate-400 hover:text-red-400" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Access grants — the canonical record */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
            <Award className="h-4 w-4 text-emerald-300" /> Access grants
          </h3>
          {domainGrants.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No grants in this domain yet.</p>
          ) : (
            <div className="space-y-1">
              {domainGrants.map((g) => (
                <div key={g.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
                  <code className="font-mono text-cyan-300/80 shrink-0" title="Holder — T2-safe commitment reference">{g.holderRef}</code>
                  <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 shrink-0">{g.role}</span>
                  <span className="text-slate-500 shrink-0">via {g.source}</span>
                  <span className="min-w-0 flex-1" />
                  {g.receiptId && (
                    <span className="flex items-center gap-1 text-emerald-400 shrink-0" title={`Receipt ${g.receiptId}`}>
                      <ShieldCheck className="h-3 w-3" /> receipted
                    </span>
                  )}
                  <span className={`shrink-0 ${g.status === 'active' ? 'text-emerald-300' : 'text-slate-500'}`}>{g.status}</span>
                  <span className="text-slate-500 shrink-0">{new Date(g.grantedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Result publications — participant results awaiting public approval
            (mirrors the myCanvas publish-approval pattern). Cross-domain, shown
            on the research-lab workspace where results originate. */}
        {activeDomain === 'research-lab' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
              <ShieldCheck className="h-4 w-4 text-amber-300" /> Result publications — pending approval ({pendingResults.length})
            </h3>
            {pendingResults.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No results awaiting approval. Participants save results privately; when they request public publication,
                the submission appears here for approval before it joins the published canon.
              </p>
            ) : (
              <div className="space-y-1">
                {pendingResults.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
                    <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 shrink-0">{r.experiment}</span>
                    <span className="text-slate-400 shrink-0">{r.provider}/{r.model}</span>
                    {r.submitterRef && <code className="font-mono text-cyan-300/70 shrink-0" title="Submitter — T2-safe commitment">{r.submitterRef}</code>}
                    <span className="min-w-0 flex-1 truncate font-mono text-slate-500">sha256 {r.contentHash.slice(0, 16)}…</span>
                    <button
                      onClick={() => void decideResult(r.id, 'approve')}
                      disabled={resultBusy === r.id}
                      className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20 shrink-0"
                    >
                      {resultBusy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
                    </button>
                    <button
                      onClick={() => void decideResult(r.id, 'reject')}
                      disabled={resultBusy === r.id}
                      className="rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-400 hover:text-rose-300 shrink-0"
                    >
                      Reject
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StewardParticipationTab;
