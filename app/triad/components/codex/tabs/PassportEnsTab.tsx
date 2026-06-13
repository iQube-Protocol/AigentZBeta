'use client';

/**
 * PassportEnsTab — ENS subname management for Polity Passport holders (Sprint 7 UI).
 *
 * Personas can mint gasless L2 ENS subnames (via Namestone) under the
 * Polity parent name (e.g. alice.polity.eth). The subname resolves to a
 * public commitment ref — never the persona_id (T0 rule).
 *
 * Backend: /api/identity/persona/[id]/ens (GET + POST)
 * Service: services/identity/namestoneClient.ts
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  Sparkles,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { useActivePersona } from '@/app/hooks/useActivePersona';

interface EnsAssignment {
  ensName: string;
  ensLabel: string;
  ensParent: string;
  mode: 'stub' | 'live';
  mintedAt: string | null;
}

interface ResolveResult {
  found: boolean;
  ensName: string;
  resolveAddress: string | null;
}

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function PassportEnsTab() {
  const { surface: persona } = useActivePersona();
  const personaId = persona?.personaId;

  const [assignment, setAssignment] = useState<EnsAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [mintBusy, setMintBusy] = useState(false);

  const [lookupName, setLookupName] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<ResolveResult | null>(null);

  const loadAssignment = useCallback(async () => {
    if (!personaId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/identity/persona/${personaId}/ens`, {
        cache: 'no-store',
      });
      if (res.status === 404) {
        setAssignment(null);
        return;
      }
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load ENS assignment');
      setAssignment(json.ens ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    void loadAssignment();
  }, [loadAssignment]);

  const handleMint = useCallback(async () => {
    if (!personaId || !label.trim()) return;
    setMintBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await personaFetch(`/api/identity/persona/${personaId}/ens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Mint failed');
      setAssignment(json.ens ?? null);
      setNotice(`ENS subname minted: ${json.ens?.ensName ?? label}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mint failed');
    } finally {
      setMintBusy(false);
    }
  }, [personaId, label]);

  const handleLookup = useCallback(async () => {
    if (!lookupName.trim()) return;
    setLookupBusy(true);
    setLookupResult(null);
    try {
      const res = await fetch(
        `/api/identity/resolve-ens/${encodeURIComponent(lookupName.trim())}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      setLookupResult({
        found: json.ok && !!json.resolveAddress,
        ensName: lookupName.trim(),
        resolveAddress: json.resolveAddress ?? null,
      });
    } catch {
      setLookupResult({ found: false, ensName: lookupName.trim(), resolveAddress: null });
    } finally {
      setLookupBusy(false);
    }
  }, [lookupName]);

  const labelValid = /^[a-z][a-z0-9-]{2,40}$/.test(label.trim().toLowerCase());

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Globe className="h-7 w-7 text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-100">ENS Identity</h2>
          <p className="text-sm text-slate-400">
            Mint a gasless ENS subname for your persona — discoverable, privacy-preserving.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : assignment ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">ENS Subname Active</span>
            {assignment.mode === 'stub' && (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300">
                stub mode
              </span>
            )}
          </div>
          <code className="block text-lg font-mono text-emerald-200">{assignment.ensName}</code>
          <div className="text-xs text-slate-400 space-y-0.5">
            <p>Label: <span className="font-mono text-slate-300">{assignment.ensLabel}</span></p>
            <p>Parent: <span className="font-mono text-slate-300">{assignment.ensParent}</span></p>
            {assignment.mintedAt && (
              <p>Minted: {new Date(assignment.mintedAt).toLocaleString()}</p>
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            Resolves to a public commitment ref — never your persona_id (T0 rule).
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="text-sm font-semibold text-slate-100">Mint Your ENS Subname</span>
          </div>
          <p className="text-sm text-slate-400">
            Choose a label for your Polity ENS identity. This creates a gasless L2 subname
            under the Polity parent domain — discoverable on ENS but privacy-preserving.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-label"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 pr-24"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                .polity.eth
              </span>
            </div>
            <button
              onClick={handleMint}
              disabled={mintBusy || !labelValid || !personaId}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {mintBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              Mint
            </button>
          </div>
          {label && !labelValid && (
            <p className="text-[10px] text-amber-400">
              Label must be 3–41 lowercase characters, start with a letter, and contain only a-z, 0-9, and hyphens.
            </p>
          )}
          {label && labelValid && (
            <p className="text-xs text-slate-500">
              Preview: <code className="text-violet-300 font-mono">{label}.polity.eth</code>
            </p>
          )}
        </div>
      )}

      {/* Public ENS lookup */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-sky-400" />
          <span className="text-sm font-semibold text-slate-100">Resolve ENS Name</span>
        </div>
        <p className="text-xs text-slate-400">
          Look up any Polity ENS subname to see if it resolves to a public commitment.
        </p>
        <div className="flex gap-2">
          <input
            value={lookupName}
            onChange={(e) => setLookupName(e.target.value)}
            placeholder="alice.polity.eth"
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <button
            onClick={handleLookup}
            disabled={lookupBusy || !lookupName.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {lookupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Resolve
          </button>
        </div>
        {lookupResult && (
          <div className={cls(
            'rounded-lg border p-3 text-xs',
            lookupResult.found
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
              : 'border-slate-700 bg-slate-800/40 text-slate-400',
          )}>
            {lookupResult.found ? (
              <>
                <p className="font-semibold">{lookupResult.ensName} resolves</p>
                <p className="font-mono text-[10px] mt-0.5">
                  Public ref: {lookupResult.resolveAddress}
                </p>
              </>
            ) : (
              <p>{lookupResult.ensName} — not found or not registered</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
