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
import { Award, Check, Copy, Gavel, Loader2, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
// PERSONA-AWARE TRANSPORT (prerequisite fix, 2026-07-27). These routes resolve
// the caller through `getActivePersona` — they are SPINE endpoints — so the
// transport must carry persona selection, not merely a Bearer.
//
// `authedFetchHeaders` + raw `fetch` attaches the token (so it never 401s) but
// carries NO persona, leaving the spine to resolve a FALLBACK persona for an
// operator who owns several. Today the routes' own `isAdmin` gate bounds the
// damage; that bound disappears the moment participation becomes
// participant-facing, where a partner operator would read someone ELSE's grants
// — silently and plausibly. CLAUDE.md names this pattern forbidden; the canary
// it names (`tests/persona-spine-fetch.test.ts`) did not exist until this pass.
import { personaFetch } from '@/utils/personaSpine';

/**
 * A domain as the SERVER says this caller may steward it (two-tier authority,
 * 2026-07-28). `roles` are already narrowed to what the caller may confer and
 * `assignableScopes` to the projects they may name — the surface renders the
 * server's answer rather than deriving a second one, so it can never offer a
 * control the issue route would refuse.
 */
interface DomainDef {
  id: string;
  label: string;
  roles: string[];
  assignableScopes: AssignableScope[];
  scopeRequired: boolean;
}
interface AssignableScope { id: string; label: string }
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
  allowedExperiments: string[] | null;
  codeFingerprint: string;
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
  allowedExperiments: string[] | null;
}
interface AppCounts { total: number; pending: number; agentAssisted: number }

/**
 * `initialDomain` — the access domain the tab opens on (default 'passport').
 * The Venture Lab's Partner Programmes surface mounts this with 'venture-lab'
 * so partner-pilot invitations open on the right domain; the mechanism and
 * store stay ONE system (no parallel invitation surface).
 */
export function StewardParticipationTab({ initialDomain }: { initialDomain?: string } = {}) {
  const [domains, setDomains] = useState<DomainDef[]>([]);
  const [tier, setTier] = useState<'platform' | 'delegated' | null>(null);
  interface PendingResult { id: string; experiment: string; provider: string; model: string; contentHash: string; submitterRef: string | null; createdAt: string }
  const [pendingResults, setPendingResults] = useState<PendingResult[]>([]);
  const [resultBusy, setResultBusy] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [applications, setApplications] = useState<AppCounts | null>(null);
  const [activeDomain, setActiveDomain] = useState<string>(initialDomain ?? 'passport');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-invitation form
  const [formRole, setFormRole] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formRecipient, setFormRecipient] = useState('');
  const [formMaxUses, setFormMaxUses] = useState(1);
  const [formExpiresDays, setFormExpiresDays] = useState(30);
  const [formOpenPeerChannel, setFormOpenPeerChannel] = useState(false);
  // Per-invitation experiment scoping (research-lab domain). Empty = all.
  const [formExperiments, setFormExperiments] = useState<string[]>([]);
  const [formOtherExperiment, setFormOtherExperiment] = useState("");
  const [issuing, setIssuing] = useState(false);
  // The one-time issued code — shown until dismissed, never recoverable after.
  const [issued, setIssued] = useState<{ code: string; inviteUrl: string; allowedExperiments: string[] | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState<string | null>(null);
  const [reissueBusy, setReissueBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/steward/participation', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Failed to load participation data');
        return;
      }
      setDomains(data.domains ?? []);
      setTier(data.authority?.tier ?? null);
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
      const res = await personaFetch("/api/steward/participation/results", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data?.ok) setPendingResults(data.pending ?? []);
    } catch { /* non-fatal */ }
  }, []);

  const decideResult = useCallback(async (resultId: string, action: "approve" | "reject") => {
    setResultBusy(resultId);
    try {
      await personaFetch("/api/steward/participation/results", {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
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
    // The server returns only the domains this caller may steward. If the tab
    // opened on one they cannot (a delegated venture steward defaulting to
    // 'passport'), snap to the first they can rather than render an empty
    // workspace that looks like "there is nothing here".
    if (domains.length > 0 && !domains.some((d) => d.id === activeDomain)) {
      setActiveDomain(domains[0].id);
    }
  }, [domains, activeDomain]);

  useEffect(() => {
    // Keep the role select valid when switching domains.
    if (domain && !domain.roles.includes(formRole)) setFormRole(domain.roles[0] ?? '');
  }, [domain, formRole]);

  // Scope selection is offered wherever the domain HAS a project catalogue —
  // Research Lab experiments and Venture Lab pilot programmes are the same
  // mechanism with two catalogues, so the UI branches on the data, never on a
  // hardcoded domain id (which is how the RL-only version stayed RL-only).
  const assignableScopes = domain?.assignableScopes ?? [];
  const scopesOffered = assignableScopes.length > 0;
  const scopeNoun = activeDomain === 'venture-lab' ? 'Pilot programmes' : 'Experiments';

  const issueInvitation = useCallback(async () => {
    if (!domain || !formRole) return;
    setIssuing(true);
    setError(null);
    try {
      const res = await personaFetch('/api/steward/participation/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain.id,
          role: formRole,
          label: formLabel || undefined,
          intendedRecipient: formRecipient || undefined,
          maxUses: formMaxUses,
          expiresInDays: formExpiresDays || undefined,
          openPeerChannel: formOpenPeerChannel,
          allowedExperiments: (domain?.assignableScopes.length ?? 0) > 0
            ? [...formExperiments, ...(formOtherExperiment.trim() ? [formOtherExperiment.trim()] : [])]
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Invitation issue failed');
        return;
      }
      setIssued({
        code: data.code,
        inviteUrl: data.inviteUrl,
        allowedExperiments: data.invitation?.allowedExperiments ?? null,
      });
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
  }, [domain, formRole, formLabel, formRecipient, formMaxUses, formExpiresDays, formOpenPeerChannel, formExperiments, formOtherExperiment, load]);

  const revokeInvitation = useCallback(async (invitationId: string) => {
    setRevokeBusy(invitationId);
    try {
      await personaFetch('/api/steward/participation/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, action: 'revoke' }),
      });
      await load();
    } finally {
      setRevokeBusy(null);
    }
  }, [load]);

  // Reissue — the secure recovery path for a lost bearer code. The raw code is
  // never stored (hashed at rest, shown once), so it cannot be re-shown; instead
  // mint a FRESH invitation with the same scoping, surface its one-time code, and
  // revoke the old one so only the new code claims. Expiry is preserved as the
  // remaining days on the original (min 1); no remaining expiry → no expiry.
  const reissueInvitation = useCallback(async (inv: InvitationRow) => {
    setReissueBusy(inv.id);
    setError(null);
    try {
      const remainingDays = inv.expiresAt
        ? Math.max(1, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / 86_400_000))
        : undefined;
      const res = await personaFetch('/api/steward/participation/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: inv.accessDomain,
          role: inv.role,
          label: inv.label || undefined,
          intendedRecipient: inv.intendedRecipient || undefined,
          maxUses: inv.maxUses,
          expiresInDays: remainingDays,
          // Reissue preserves the original scoping exactly — a reissue must
          // never widen an invitation (the same containment the issue route
          // enforces server-side).
          allowedExperiments: inv.allowedExperiments ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Reissue failed');
        return;
      }
      setIssued({
        code: data.code,
        inviteUrl: data.inviteUrl,
        allowedExperiments: data.invitation?.allowedExperiments ?? null,
      });
      // Revoke the old invitation so only the freshly-issued code can claim.
      await personaFetch('/api/steward/participation/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: inv.id, action: 'revoke' }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reissue failed');
    } finally {
      setReissueBusy(null);
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

  // NOT A STEWARD — an honest closed state, not a raw 403 string.
  //
  // This surface is reachable from hosts whose own gate is broader than this
  // workspace's (the Partner group's Tier 2 Collaborate view mounts it for any
  // venture-lab participant). The server refuses correctly; what was wrong was
  // showing the invitation-issuing workspace and then an error. A caller who
  // cannot act is told so plainly instead (MS-9, in the only form available to
  // a component that cannot un-mount itself).
  if (tier === null || domains.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        <p className="flex items-center gap-1.5 font-medium text-slate-200">
          <Gavel className="h-3.5 w-3.5" /> Steward workspace
        </p>
        <p className="mt-1 leading-snug">
          Issuing and revoking invitations needs steward authority in this domain. Your
          participation here does not carry it — a steward can grant it, and it will appear
          in this workspace when they do.
        </p>
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
        {tier === 'delegated' && (
          <p className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-[10px] leading-snug text-slate-400">
            <span className="text-slate-200">Delegated authority.</span> You steward the
            domains above and may invite people into the programmes you administer. Granting
            steward authority itself stays a platform act.
          </p>
        )}
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
            <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={formOpenPeerChannel}
                onChange={(e) => setFormOpenPeerChannel(e.target.checked)}
                className="mt-0.5 accent-indigo-500"
              />
              <span>
                Open a <span className="text-indigo-300">QubeTalk channel with me</span> when they join
                <span className="block text-[10px] text-slate-500">A peer channel opens automatically the moment they claim — you can message and share materials with them right away (Locker → Peer Exchange).</span>
              </span>
            </label>
          </div>

          {/* Project scoping — offered wherever the domain has a catalogue:
              Research Lab experiments, Venture Lab pilot programmes. No
              selection = the whole catalogue, UNLESS the caller's own authority
              is scoped, in which case the server requires a selection (an
              unrestricted invitation from a restricted steward would widen). */}
          {scopesOffered && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[11px] text-slate-400">
                  {scopeNoun} this invitation grants{' '}
                  <span className="text-slate-500">
                    {domain?.scopeRequired ? '(selection required)' : '(none = all)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormExperiments((prev) =>
                      prev.length === assignableScopes.length
                        ? []
                        : assignableScopes.map((exp) => exp.id),
                    )
                  }
                  className="text-[11px] font-medium text-violet-300 hover:text-violet-200"
                >
                  {formExperiments.length === assignableScopes.length && assignableScopes.length > 0
                    ? 'Clear all'
                    : 'Select all'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {assignableScopes.map((exp) => {
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
              {scopesOffered && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="uppercase tracking-wide text-slate-500">Scoped to:</span>
                  {issued.allowedExperiments && issued.allowedExperiments.length > 0 ? (
                    issued.allowedExperiments.map((x) => (
                      <span key={x} className="rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-indigo-300">{x}</span>
                    ))
                  ) : (
                    <span className="text-amber-300">ALL of {scopeNoun.toLowerCase()} (no restriction was saved — select above before issuing to scope it)</span>
                  )}
                </div>
              )}
              <button onClick={() => setIssued(null)} className="mt-1 text-[10px] text-slate-400 hover:text-slate-200">Dismiss</button>
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
                <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
                  <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 shrink-0">{inv.role}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">
                    {inv.label || 'Untitled invitation'}
                    {inv.intendedRecipient && <span className="text-slate-500"> → {inv.intendedRecipient}</span>}
                  </span>
                  {/* Non-secret fingerprint — identifies the invitation without
                      exposing the claimable bearer code (never stored). Copyable
                      so the steward can correlate against records. */}
                  <button
                    onClick={() => copy(`fp-${inv.id}`, inv.codeFingerprint)}
                    title={`Code fingerprint (first 12 hex of the code hash) — non-secret identifier, not the claimable code. Invitation id: ${inv.id}`}
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 hover:text-slate-200 shrink-0"
                  >
                    {copied === `fp-${inv.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {inv.codeFingerprint}…
                  </button>
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
                  {/* Reissue — mint a fresh code with the same scoping when the
                      original code was lost (it can never be re-shown). Available
                      while the invitation is still claimable (active). */}
                  {inv.status === 'active' && (
                    <button
                      title="Reissue — mint a fresh one-time code with the same scoping and revoke this one (the original code cannot be re-shown)"
                      onClick={() => void reissueInvitation(inv)}
                      disabled={reissueBusy === inv.id || revokeBusy === inv.id}
                      className="p-0.5 shrink-0"
                    >
                      {reissueBusy === inv.id
                        ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                        : <RefreshCw className="h-3 w-3 text-slate-400 hover:text-violet-300" />}
                    </button>
                  )}
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
                  {scopesOffered && (
                    <div className="basis-full flex flex-wrap items-center gap-1 pt-0.5 text-[10px] text-slate-500">
                      <span className="uppercase tracking-wide">{scopeNoun}:</span>
                      {inv.allowedExperiments && inv.allowedExperiments.length > 0 ? (
                        inv.allowedExperiments.map((x) => (
                          <span key={x} className="rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-indigo-300">{x}</span>
                        ))
                      ) : (
                        <span className="text-slate-400">all (unrestricted)</span>
                      )}
                    </div>
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
                <div key={g.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
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
                  {scopesOffered && (
                    <div className="basis-full flex flex-wrap items-center gap-1 pt-0.5 text-[10px] text-slate-500">
                      <span className="uppercase tracking-wide">Assigned:</span>
                      {g.allowedExperiments && g.allowedExperiments.length > 0 ? (
                        g.allowedExperiments.map((x) => (
                          <span key={x} className="rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-indigo-300">{x}</span>
                        ))
                      ) : (
                        <span className="text-slate-400">all (unrestricted)</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Result publications — participant results awaiting public approval
            (mirrors the myCanvas publish-approval pattern). Cross-domain, shown
            on the research-lab workspace where results originate. */}
        {/* Result publications approval is estate-wide and its route is
            platform-admin gated — MS-9: do not render it to a delegated
            steward who could never act on it. */}
        {activeDomain === 'research-lab' && tier === 'platform' && (
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
