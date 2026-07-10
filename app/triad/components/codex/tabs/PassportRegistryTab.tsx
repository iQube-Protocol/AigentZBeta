'use client';

/**
 * PassportRegistryTab — public listing of issued Polity Passports (Stage 5)
 * with per-persona claim flow.
 *
 * Surfaces the public projection from /api/polity-passport/registry. This
 * tab is mirrored on both the Bureau cartridge and the iQube Registry
 * cartridge ("Passports" tab) — same component, two homes, per the
 * subTabs-mirror pattern. Everything shown is public-safe: commitment refs,
 * never raw identity (T0 rule lives server-side in the projection).
 *
 * Class filter chips are portaled into the SubHeaderSlotContext so they
 * render in the tier-3 sub-menu row (left side) of the cartridge chrome.
 */

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { BookOpenCheck, RefreshCw, Loader2, AlertCircle, ShieldCheck, Bot, Wallet, Link2, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { SubHeaderSlotContext } from '../SubHeaderSlot';
import { PassportClaimModal } from './PassportClaimModal';
import { personaFetch } from '@/utils/personaSpine';
import { useSupabaseSessionPersonas } from '@/app/hooks/useSupabaseSessionPersonas';

const WorldIdButton = dynamic(
  () => import('@/components/passport/WorldIdButton').then((m) => ({ default: m.WorldIdButton })),
  { ssr: false, loading: () => <span className="text-[10px] text-sky-400">Loading…</span> },
);
interface WorldIdProofBundle {
  proof: string;
  merkle_root: string;
  nullifier_hash: string;
  verification_level: 'orb' | 'device';
}

interface PublicPassport {
  passportId: string;
  passportClass: string;
  passportGrade: string | null;
  passportStatus: string | null;
  kybeDidPublicRef: string | null;
  issuedAt: string | null;
  citizenPassportIrrevocable?: boolean;
  revoked?: boolean;
}

interface OwnPassport {
  passportId: string;
  passportClass: string;
  passportGrade: string | null;
  claimedAt: string | null;
  claimable: boolean;
}

interface SponsoredAgent {
  agentRootId: string;
  displayName: string;
  didUri?: string;
  agentCardUrl: string;
  agentClass: string;
  isAigentMe?: boolean;
  boundPassportId: string | null;
  sponsorPassportId: string;
  passport: {
    passportId: string;
    passportClass: string;
    passportGrade: string | null;
    passportStatus: string | null;
    claimedAt: string | null;
  } | null;
}

interface SponsorshipCapacity {
  base: number;
  earned: number;
  used: number;
  remaining: number;
}

const CLASS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'citizen', label: 'Citizens' },
  { value: 'agent_participant', label: 'Agents' },
  { value: 'robot_participant', label: 'Robots' },
  { value: 'organization_participant', label: 'Organizations' },
];

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function PassportRegistryTab({ personaId }: { personaId?: string }) {
  const [passports, setPassports] = useState<PublicPassport[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subHeaderSlotEl = useContext(SubHeaderSlotContext);

  const [ownPassports, setOwnPassports] = useState<OwnPassport[]>([]);
  const [sponsoredAgents, setSponsoredAgents] = useState<SponsoredAgent[]>([]);
  const [capacity, setCapacity] = useState<SponsorshipCapacity | null>(null);
  const [sponsoredOpen, setSponsoredOpen] = useState(true);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [claimTarget, setClaimTarget] = useState<{ passportId: string; passportClass: string } | null>(null);
  // The agent_root_did currently holding the active delegation for this persona
  // (one active delegation at a time). Used to show "Delegation active" instead
  // of "Set up Delegation" on the matching agent row.
  const { sessionPersonas } = useSupabaseSessionPersonas();
  const [activeDelegationDid, setActiveDelegationDid] = useState<string | null>(null);
  const [worldIdBusy, setWorldIdBusy] = useState<string | null>(null);
  const [worldIdError, setWorldIdError] = useState<Record<string, string | null>>({});

  // World ID upgrade — receives a real proof bundle from <WorldIdButton>
  // (or a dev-worldid-orb fallback when NEXT_PUBLIC_WORLD_ID_APP_ID is
  // unset). Forwards to verify-worldid; refreshes the row on success.
  const handleWorldIdProof = useCallback(
    async (passportId: string, proof: WorldIdProofBundle) => {
      setWorldIdBusy(passportId);
      setWorldIdError((e) => ({ ...e, [passportId]: null }));
      try {
        const res = await personaFetch('/api/polity-passport/verify-worldid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passportId, proof }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setWorldIdError((e) => ({ ...e, [passportId]: data?.error ?? 'Verification failed' }));
          return;
        }
        void loadOwn();
      } catch (e) {
        setWorldIdError((err) => ({
          ...err,
          [passportId]: e instanceof Error ? e.message : 'Network error',
        }));
      } finally {
        setWorldIdBusy(null);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = classFilter ? `?class=${encodeURIComponent(classFilter)}` : '';
      const res = await fetch(`/api/polity-passport/registry${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Registry load failed');
      setPassports(json.passports ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registry load failed');
    } finally {
      setLoading(false);
    }
  }, [classFilter]);

  const loadOwn = useCallback(async () => {
    try {
      const [walletRes, agentsRes] = await Promise.all([
        personaFetch('/api/polity-passport/wallet', { cache: 'no-store' }),
        personaFetch('/api/persona/sponsored-agents', { cache: 'no-store' }),
      ]);
      if (walletRes.ok) {
        const json = await walletRes.json();
        if (json.ok) setOwnPassports(json.passportQubes ?? []);
      }
      if (agentsRes.ok) {
        const json = await agentsRes.json();
        if (json.ok) {
          setSponsoredAgents(json.agents ?? []);
          setCapacity(json.capacity ?? null);
        }
      }
    } catch {
      // Silent — user may not be authenticated
    }
  }, []);

  // Promote an existing sponsored delegate to be the citizen's aigentMe —
  // carries that agent's card + bound passport into the aigentMe role.
  const promoteToAigentMe = useCallback(
    async (agentRootId: string) => {
      setPromotingId(agentRootId);
      setPromoteError(null);
      try {
        const res = await personaFetch('/api/agents/aigentme', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentRootId }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setPromoteError(data?.error ?? 'Could not assign aigentMe');
          return;
        }
        await loadOwn();
      } catch (e) {
        setPromoteError(e instanceof Error ? e.message : 'Could not assign aigentMe');
      } finally {
        setPromotingId(null);
      }
    },
    [loadOwn],
  );

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadOwn(); }, [loadOwn]);

  // Resolve the active delegation so agent rows reflect "already delegated".
  const loadActiveDelegation = useCallback(async () => {
    try {
      const pid =
        personaId ||
        (typeof window !== 'undefined' && window.localStorage.getItem('currentPersonaId')) ||
        sessionPersonas[0]?.id ||
        '';
      if (!pid) return;
      const res = await fetch(
        `/api/codex/chat/agentiq-os/delegation?persona_id=${encodeURIComponent(pid)}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      setActiveDelegationDid(data?.active && data?.agent_root_did ? String(data.agent_root_did) : null);
    } catch {
      setActiveDelegationDid(null);
    }
  }, [personaId, sessionPersonas]);
  useEffect(() => { void loadActiveDelegation(); }, [loadActiveDelegation]);

  const ownMap = new Map(ownPassports.map((p) => [p.passportId, p]));
  const hasAigentMe = sponsoredAgents.some((a) => a.isAigentMe);
  const citizenPassport = ownPassports.find((p) => p.passportClass === 'citizen');

  const filterChips = (
    <div className="flex gap-1 flex-wrap items-center">
      {CLASS_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => setClassFilter(f.value)}
          className={cls(
            'rounded-full px-2.5 py-0.5 text-[11px] transition-all duration-300',
            classFilter === f.value
              ? 'bg-violet-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      {subHeaderSlotEl ? createPortal(filterChips, subHeaderSlotEl) : filterChips}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpenCheck className="h-6 w-6 text-violet-400" />
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Polity Passport Registry</h2>
            <p className="text-sm text-slate-400">
              Public record of issued passports. Identity appears as commitments only.
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* My Citizen Passport & Sponsored Delegates — claim + delegation flow */}
      {(citizenPassport || sponsoredAgents.length > 0) && (
        <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-4 space-y-3">
          <button
            type="button"
            onClick={() => setSponsoredOpen((p) => !p)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-400" />
              <span className="text-sm font-semibold text-slate-200">My Citizen Passport &amp; Sponsored Delegates</span>
              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                {sponsoredAgents.length}
              </span>
            </div>
            {sponsoredOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
          {sponsoredOpen && (
            <div className="space-y-2">
              {/* Sponsoring credential — the citizen's own passport */}
              {citizenPassport && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium text-slate-100">My Citizen Passport</span>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        {citizenPassport.passportGrade ?? 'citizen'}
                      </span>
                    </div>
                    {citizenPassport.claimedAt ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        <Wallet className="h-3 w-3" /> In Wallet
                      </span>
                    ) : citizenPassport.claimable ? (
                      <button
                        onClick={() => setClaimTarget({ passportId: citizenPassport.passportId, passportClass: 'citizen' })}
                        className="flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-xs text-violet-300 hover:bg-violet-500/25 animate-pulse"
                      >
                        <Wallet className="h-3 w-3" /> Claim
                      </button>
                    ) : null}
                  </div>
                  <p className="font-mono text-[10px] text-slate-500 break-all">{citizenPassport.passportId}</p>
                  <p className="text-[11px] text-slate-400">
                    The credential that sponsors your delegates below.
                    {capacity && (
                      <>
                        {' '}Sponsorship capacity: <span className="text-slate-200">{capacity.used}</span> of{' '}
                        <span className="text-slate-200">{capacity.base + capacity.earned}</span> used
                        {capacity.remaining <= 0
                          ? ' — exhausted.'
                          : ` — ${capacity.remaining} remaining.`}
                      </>
                    )}
                  </p>
                </div>
              )}

              {promoteError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 p-2 text-xs text-rose-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{promoteError}</span>
                </div>
              )}
              {sponsoredAgents.map((agent) => {
                const hasPassport = !!agent.passport;
                const isClaimed = !!agent.passport?.claimedAt;
                const passportStatus = agent.passport?.passportStatus;
                const isDelegated =
                  !!activeDelegationDid &&
                  (activeDelegationDid === agent.didUri || activeDelegationDid === agent.agentRootId);
                return (
                  <div
                    key={agent.agentRootId}
                    className={cls(
                      'rounded-lg border p-3 space-y-2',
                      isClaimed
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : hasPassport
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-slate-700 bg-slate-900/60',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-violet-400" />
                        <span className="text-sm font-medium text-slate-100">{agent.displayName}</span>
                        {agent.isAigentMe && (
                          <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            <Star className="h-2.5 w-2.5" /> aigentMe
                          </span>
                        )}
                        <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                          {agent.agentClass}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isClaimed && (
                          <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                            <ShieldCheck className="h-3 w-3" /> Passport Claimed
                          </span>
                        )}
                        {hasPassport && !isClaimed && (
                          <button
                            onClick={() =>
                              setClaimTarget({
                                passportId: agent.passport!.passportId,
                                passportClass: agent.passport!.passportClass,
                              })
                            }
                            className="flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-xs text-violet-300 hover:bg-violet-500/25 transition-colors animate-pulse"
                          >
                            <Wallet className="h-3 w-3" /> Claim Passport
                          </button>
                        )}
                        {!hasPassport && (
                          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                            Awaiting issuance
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                      <span className="font-mono">{agent.agentCardUrl}</span>
                      {hasPassport && (
                        <span>
                          Passport: <span className="text-slate-300">{passportStatus}</span>
                        </span>
                      )}
                    </div>
                    {/* Assign this delegate (and its passport) to the aigentMe role —
                        only when the user hasn't designated an aigentMe yet. */}
                    {!agent.isAigentMe && !hasAigentMe && (
                      <button
                        onClick={() => void promoteToAigentMe(agent.agentRootId)}
                        disabled={promotingId === agent.agentRootId}
                        className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                      >
                        {promotingId === agent.agentRootId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Star className="h-3 w-3" />
                        )}
                        Assign as my aigentMe
                      </button>
                    )}
                    {isClaimed && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() =>
                            setClaimTarget({
                              passportId: agent.passport!.passportId,
                              passportClass: agent.passport!.passportClass,
                            })
                          }
                          className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
                        >
                          <Wallet className="h-3 w-3" /> View Credential
                        </button>
                        {isDelegated ? (
                          <a
                            href="#delegation"
                            onClick={(e) => {
                              e.preventDefault();
                              window.dispatchEvent(new CustomEvent('codex:navigate-tab', { detail: { tab: 'delegation' } }));
                              const tabButtons = document.querySelectorAll('[data-tab-slug="passport-bureau-delegation"]');
                              if (tabButtons.length > 0) (tabButtons[0] as HTMLElement).click();
                            }}
                            title="This agent holds your active delegation — open the Delegation tab to manage or revoke"
                            className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
                          >
                            <ShieldCheck className="h-3 w-3" /> Delegation active
                          </a>
                        ) : (
                          <a
                            href="#delegation"
                            onClick={(e) => {
                              e.preventDefault();
                              window.dispatchEvent(new CustomEvent('codex:navigate-tab', { detail: { tab: 'delegation' } }));
                              const tabButtons = document.querySelectorAll('[data-tab-slug="passport-bureau-delegation"]');
                              if (tabButtons.length > 0) (tabButtons[0] as HTMLElement).click();
                            }}
                            className="flex items-center gap-1 rounded bg-violet-600/20 border border-violet-500/30 px-2.5 py-1 text-xs text-violet-300 hover:bg-violet-600/30"
                          >
                            <Link2 className="h-3 w-3" /> Set up Delegation
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && passports.length === 0 && !error && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          No passports issued yet.
        </div>
      )}

      <div className="space-y-2">
        {passports.map((p) => {
          const isCitizen = p.passportClass === 'citizen';
          const own = ownMap.get(p.passportId);
          return (
            <div
              key={p.passportId}
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {isCitizen ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Bot className="h-5 w-5 text-sky-400" />
                )}
                <div>
                  <p className="font-mono text-sm text-slate-200">{p.passportId}</p>
                  <p className="text-xs text-slate-500">
                    {p.passportGrade ?? p.passportClass}
                    {p.kybeDidPublicRef && ` · kybe:${p.kybeDidPublicRef}`}
                    {p.issuedAt && ` · ${new Date(p.issuedAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isCitizen && p.citizenPassportIrrevocable && (
                  <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-400">
                    irrevocable
                  </span>
                )}
                {own?.claimedAt ? (
                  <button
                    onClick={() => setClaimTarget({ passportId: p.passportId, passportClass: p.passportClass })}
                    className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                  >
                    <Wallet className="h-3 w-3" />
                    In Wallet
                  </button>
                ) : own?.claimable ? (
                  <button
                    onClick={() => setClaimTarget({ passportId: p.passportId, passportClass: p.passportClass })}
                    className="flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-xs text-violet-300 hover:bg-violet-500/25 transition-colors animate-pulse"
                  >
                    <Wallet className="h-3 w-3" />
                    Claim
                  </button>
                ) : null}
                {/* World ID upgrade — appears next to claimed citizen
                    passports that aren't yet verified_citizen. Operator
                    request 2026-06-13: surface the upgrade loop here so
                    it's discoverable post-claim, not only in the wallet. */}
                {own?.claimedAt && p.passportClass === 'citizen' && own.passportGrade === 'verified_citizen' && (
                  <span
                    className="flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/40 px-2.5 py-0.5 text-xs text-sky-300"
                    title="Verified human via World ID"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    World ID
                  </span>
                )}
                {own?.claimedAt && p.passportClass === 'citizen' && own.passportGrade !== 'verified_citizen' && (
                  <WorldIdButton
                    onProof={(proof) => handleWorldIdProof(p.passportId, proof)}
                    busy={worldIdBusy === p.passportId}
                    signal={p.passportId}
                  />
                )}
                <span
                  className={cls(
                    'rounded-full px-2 py-0.5 text-xs',
                    p.passportStatus === 'active' || p.passportStatus === 'approved'
                      ? 'bg-emerald-900 text-emerald-300'
                      : p.passportStatus === 'revoked' || p.passportStatus === 'delisted'
                        ? 'bg-rose-900 text-rose-300'
                        : 'bg-slate-800 text-slate-400',
                  )}
                >
                  {p.passportStatus}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <PassportClaimModal
        open={!!claimTarget}
        onClose={() => setClaimTarget(null)}
        passportId={claimTarget?.passportId ?? ''}
        passportClass={claimTarget?.passportClass ?? ''}
        onClaimed={() => void loadOwn()}
      />
    </div>
  );
}
