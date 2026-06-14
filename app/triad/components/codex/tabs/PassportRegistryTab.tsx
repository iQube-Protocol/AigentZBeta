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
import { BookOpenCheck, RefreshCw, Loader2, AlertCircle, ShieldCheck, Bot, Wallet, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { SubHeaderSlotContext } from '../SubHeaderSlot';
import { PassportClaimModal } from './PassportClaimModal';
import { personaFetch } from '@/utils/personaSpine';

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
  agentCardUrl: string;
  agentClass: string;
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

export function PassportRegistryTab() {
  const [passports, setPassports] = useState<PublicPassport[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subHeaderSlotEl = useContext(SubHeaderSlotContext);

  const [ownPassports, setOwnPassports] = useState<OwnPassport[]>([]);
  const [sponsoredAgents, setSponsoredAgents] = useState<SponsoredAgent[]>([]);
  const [sponsoredOpen, setSponsoredOpen] = useState(true);
  const [claimTarget, setClaimTarget] = useState<{ passportId: string; passportClass: string } | null>(null);
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
        if (json.ok) setSponsoredAgents(json.agents ?? []);
      }
    } catch {
      // Silent — user may not be authenticated
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadOwn(); }, [loadOwn]);

  const ownMap = new Map(ownPassports.map((p) => [p.passportId, p]));

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

      {/* My Sponsored Agents — passport claim + delegation flow */}
      {sponsoredAgents.length > 0 && (
        <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-4 space-y-3">
          <button
            type="button"
            onClick={() => setSponsoredOpen((p) => !p)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-400" />
              <span className="text-sm font-semibold text-slate-200">My Sponsored Agents</span>
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
              {sponsoredAgents.map((agent) => {
                const hasPassport = !!agent.passport;
                const isClaimed = !!agent.passport?.claimedAt;
                const passportStatus = agent.passport?.passportStatus;
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
                        <a
                          href="#delegation"
                          onClick={(e) => {
                            e.preventDefault();
                            const tabButtons = document.querySelectorAll('[data-tab-slug="passport-bureau-delegation"]');
                            if (tabButtons.length > 0) {
                              (tabButtons[0] as HTMLElement).click();
                            }
                          }}
                          className="flex items-center gap-1 rounded bg-violet-600/20 border border-violet-500/30 px-2.5 py-1 text-xs text-violet-300 hover:bg-violet-600/30"
                        >
                          <Link2 className="h-3 w-3" /> Set up Delegation
                        </a>
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
