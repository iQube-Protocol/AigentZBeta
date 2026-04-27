"use client";

import React, { useState, useEffect, useCallback } from "react";
import { User, Wallet, ChevronDown, ChevronUp, Info, Star, Globe, Link, Loader2 } from "lucide-react";
import { PersonaCreationForm } from "@/components/identity/PersonaCreationForm";
import { useSupabaseSessionPersonas } from "@/app/hooks/useSupabaseSessionPersonas";

async function emitPersonaCreatedReceipt(personaId: string): Promise<void> {
  try {
    await fetch('/api/runtime/orchestration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'z_delegated',
        persona_id: personaId,
        journey_stage: 'acolyte',
        active_cartridge: 'agentiq-os-cartridge',
        from_role: 'aigent-z',
        to_role: 'aigent-c',
        reason: `Developer persona created: ${personaId}`,
        receipt_eligible: true,
        metadata: {
          persona_created: true,
          root_did_stub: `did:iqube:${personaId}`,
          agent_root_did: 'did:iqube:aigent-c-os-root',
          cartridge: 'agentiq-os-cartridge',
        },
      }),
    });
  } catch {
    // non-fatal
  }
}

async function enrollDevCohort(personaId: string): Promise<void> {
  try {
    await fetch('/api/codex/agentiq-os/ecosystem-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_id: personaId,
        bridge_stage: 'open_onboarding',
      }),
    });
  } catch {
    // non-fatal
  }
}

interface DevPersonaTabProps {
  personaId?: string;
}

const BUCKET_LABELS: Record<number, string> = {
  0: "L1 Experimental",
  1: "L2 Verified Community",
  2: "L3 Production Candidate",
  3: "L4 Production Approved",
  4: "L5 Core Sovereign",
};

const WORLD_ID_LABELS: Record<string, string> = {
  unverified: "Unverified",
  verified_human: "Verified Human",
  agent_declared: "Agent Declared",
};

export function DevPersonaTab({ personaId }: DevPersonaTabProps) {
  const { sessionPersonas, isLoading, refreshPersonas } = useSupabaseSessionPersonas();
  const [showForm, setShowForm] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdDID, setCreatedDID] = useState<string | null>(null);
  const [showIdentityInfo, setShowIdentityInfo] = useState(false);
  const [walletPersonaId, setWalletPersonaId] = useState<string | null>(null);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimHandle, setClaimHandle] = useState('');
  const [claimKey, setClaimKey] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Sync with wallet persona selector: read initial value from localStorage and
  // update whenever the wallet switches personas (same-page event or cross-tab storage event)
  useEffect(() => {
    const stored = window.localStorage.getItem("currentPersonaId");
    if (stored) setWalletPersonaId(stored);

    const handleSwitch = (e: Event) => {
      const detail = (e as CustomEvent<{ personaId: string }>).detail;
      if (detail?.personaId) setWalletPersonaId(detail.personaId);
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "currentPersonaId" && e.newValue) setWalletPersonaId(e.newValue);
    };
    window.addEventListener("persona-switched", handleSwitch);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("persona-switched", handleSwitch);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const activePersonaId = createdId ?? walletPersonaId ?? personaId ?? null;
  const livePersona =
    sessionPersonas.find((p) => p.id === activePersonaId) ??
    (sessionPersonas.length > 0 ? sessionPersonas[0] : null);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30">
          <User className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Developer Persona</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Create and manage your bounded developer identity on AgentiQ OS.
          </p>
        </div>
      </div>

      {/* Identity model explainer */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/30">
        <button
          type="button"
          onClick={() => setShowIdentityInfo((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm text-slate-300 hover:text-slate-100"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-400" />
            <span className="font-medium">Identity Model — Root DiD and Bounded Personas</span>
          </div>
          {showIdentityInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showIdentityInfo && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-700/40 pt-3">
            <p className="text-sm text-slate-300">
              Per the <strong className="text-blue-300">Aigent DiDQube Identity Upgrade Note</strong>:
            </p>
            <div className="rounded-lg bg-slate-800/60 px-3 py-2 font-mono text-xs text-slate-300">
              Root DiD ← Enduring accountability anchor<br />
              &nbsp;&nbsp;└── Bounded persona (this cartridge)<br />
              &nbsp;&nbsp;└── Bounded persona (another context)<br />
            </div>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Your <strong className="text-slate-300">Root DiD</strong> is your durable identity — trust, receipts, and reputation always trace back here</li>
              <li>A <strong className="text-slate-300">bounded persona</strong> is your context-specific presentation — it can vary by cartridge, client, or mission</li>
              <li>Personas may be anonymous, pseudonymous, or identified depending on your disclosure policy</li>
              <li><em>Personas may vary. Accountability does not.</em></li>
            </ul>
          </div>
        )}
      </div>

      {/* Active persona — live from Supabase session */}
      {isLoading ? (
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-4">
          <p className="text-sm text-slate-400">Loading persona state…</p>
        </div>
      ) : livePersona ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Persona</p>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Display name</span>
              <span className="text-slate-200 font-medium">{livePersona.displayName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Persona ID</span>
              <code className="text-xs text-green-300 bg-green-500/10 px-2 py-0.5 rounded">
                {livePersona.id}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Root DiD</span>
              <code className="text-xs text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded break-all max-w-[220px]">
                {createdDID ?? `did:iqube:${livePersona.id}`}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cartridge scope</span>
              <code className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                agentiq-os-cartridge
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Identifiability</span>
              <span className="text-xs text-slate-300 capitalize">{livePersona.identifiability}</span>
            </div>
          </div>

          {/* Reputation */}
          <div className="border-t border-slate-700/40 pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reputation</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                  style={{ width: `${livePersona.reputationScore}%` }}
                />
              </div>
              <span className="text-xs text-slate-300 tabular-nums w-12 text-right">
                {livePersona.reputationScore} / 100
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs text-violet-300">
                {BUCKET_LABELS[livePersona.reputationBucket] ?? `Bucket ${livePersona.reputationBucket}`}
              </span>
            </div>
          </div>

          {/* World ID + badges */}
          <div className="border-t border-slate-700/40 pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">World ID: </span>
              <span className="text-xs text-slate-300">
                {WORLD_ID_LABELS[livePersona.worldIdStatus] ?? livePersona.worldIdStatus}
              </span>
            </div>
            {livePersona.badges && livePersona.badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {livePersona.badges.map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] text-blue-300"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activePersonaId ? (
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-4">
          <p className="text-sm text-slate-400">Persona ID: <code className="text-xs bg-slate-800 px-1 rounded">{activePersonaId}</code></p>
          <p className="text-xs text-slate-500 mt-1">Sign in to see full persona state.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-4">
          <p className="text-sm text-slate-400">No active developer persona detected for this session.</p>
          <p className="text-xs text-slate-500 mt-1">
            Create one below to enable bounded delegation and mission tracking.
          </p>
        </div>
      )}

      {/* Wallet state */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-slate-400" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SmartWallet</p>
        </div>
        {livePersona?.evmAddress ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">EVM address</span>
              <code className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-mono">
                {livePersona.evmAddress.slice(0, 6)}…{livePersona.evmAddress.slice(-4)}
              </code>
            </div>
            {livePersona.fioHandle && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Handle</span>
                <span className="text-xs text-slate-300">{livePersona.fioHandle}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            {livePersona ? "No EVM address linked to this persona." : "Create a persona to see wallet state."}
          </p>
        )}
      </div>

      {/* Action buttons — always visible */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setShowClaimForm(false); }}
          className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 transition-colors"
        >
          <User className="h-4 w-4" />
          {showForm ? "Hide" : "Create Developer Persona"}
        </button>
        <button
          type="button"
          onClick={() => { setShowClaimForm((v) => !v); setShowForm(false); setClaimError(null); setClaimSuccess(false); }}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
        >
          <Link className="h-4 w-4" />
          {showClaimForm ? "Hide" : "Claim existing persona"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4">
          <PersonaCreationForm
            onSuccess={(id) => {
              setCreatedId(id);
              setCreatedDID(`did:iqube:${id}`);
              setShowForm(false);
              void emitPersonaCreatedReceipt(id);
              void refreshPersonas();
              void enrollDevCohort(id);
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {showClaimForm && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-slate-200 mb-1">Claim by FIO Handle</h4>
            <p className="text-xs text-slate-500">
              Created a persona while signed out, or on another device? Enter your FIO handle and private key to link it to this account.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">FIO Handle</label>
              <input
                value={claimHandle}
                onChange={e => setClaimHandle(e.target.value)}
                placeholder="yourname@knyt"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Private Key</label>
              <input
                value={claimKey}
                onChange={e => setClaimKey(e.target.value)}
                type="password"
                placeholder="Your FIO private key"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition"
              />
            </div>
          </div>
          {claimError && <p className="text-xs text-red-400">{claimError}</p>}
          {claimSuccess && <p className="text-xs text-emerald-400">Persona claimed — it will appear in your wallet on next sign-in.</p>}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowClaimForm(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={claiming || !claimHandle || !claimKey}
              onClick={async () => {
                setClaiming(true); setClaimError(null); setClaimSuccess(false);
                try {
                  const token = typeof window !== 'undefined'
                    ? (() => {
                        for (let i = 0; i < window.localStorage.length; i++) {
                          const k = window.localStorage.key(i);
                          if (!k?.includes('auth-token')) continue;
                          const raw = window.localStorage.getItem(k);
                          if (!raw) continue;
                          const p = JSON.parse(raw) as { access_token?: string };
                          if (p?.access_token) return p.access_token;
                        }
                        return null;
                      })()
                    : null;
                  const res = await fetch('/api/identity/persona/claim', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ fioHandle: claimHandle, privateKey: claimKey }),
                  });
                  const data = await res.json() as { ok?: boolean; personaId?: string; error?: string };
                  if (!res.ok || !data.ok) {
                    setClaimError(data.error ?? 'Claim failed');
                  } else {
                    setClaimSuccess(true);
                    setClaimHandle(''); setClaimKey('');
                    if (data.personaId) setCreatedId(data.personaId);
                    void refreshPersonas();
                  }
                } catch (e: unknown) {
                  setClaimError(e instanceof Error ? e.message : 'Network error');
                } finally {
                  setClaiming(false);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {claiming ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Claim Persona
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
