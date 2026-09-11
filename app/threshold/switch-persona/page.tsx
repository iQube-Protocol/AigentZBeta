'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { personaFetch } from '@/utils/personaSpine';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';

type SafePersona = { personaPublicRef: string; displayLabel: string; fioHandle: string | null };
type Crossing = {
  source: SafePersona;
  target: SafePersona;
  connectedAgent: string;
  requestedScope: string[];
  switchRequiresReauthorization: true;
};

/**
 * Persona re-cross remains a Threshold authorization over the canonical wallet
 * persona spine. If the browser is signed out, the SAME Passport connector used
 * by SmartWallet establishes application-world identity/persona state first.
 * This page never stores its own persona choice and never mutates the existing
 * MCP session; authorization still creates a fresh target-persona crossing.
 */
function SwitchPersonaInner() {
  const [code, setCode] = useState('');
  const [crossing, setCrossing] = useState<Crossing | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resolveCanonicalPersonaState = useCallback(async () => {
    try {
      const who = await personaFetch('/api/wallet/active-persona', { cache: 'no-store' });
      setSignedIn(who.ok);
      return who.ok;
    } catch {
      setSignedIn(false);
      return false;
    }
  }, []);

  const inspect = useCallback(async (handshakeCode: string) => {
    if (!handshakeCode) return;
    try {
      const res = await personaFetch('/api/threshold/persona-switch/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handshakeCode, action: 'inspect' }),
      });
      const body = await res.json();
      if (!res.ok) {
        // When there is no application persona session yet, authentication is
        // offered below; do not turn that expected state into a dead-end error.
        if (res.status !== 401) setError(body.error || 'This persona switch is unavailable.');
        return;
      }
      setError(null);
      setCrossing(body.crossing);
    } catch {
      setError('Could not reach the Threshold gateway.');
    }
  }, []);

  useEffect(() => {
    const handshakeCode = new URLSearchParams(window.location.hash.slice(1)).get('code') ?? '';
    setCode(handshakeCode);
    if (!handshakeCode) {
      setError('This persona switch link is incomplete.');
      return;
    }
    void (async () => {
      const authenticated = await resolveCanonicalPersonaState();
      if (authenticated) await inspect(handshakeCode);
    })();
  }, [inspect, resolveCanonicalPersonaState]);

  const handlePassportConnected = useCallback(async () => {
    if (!(await resolveCanonicalPersonaState())) return;
    await inspect(code);
  }, [code, inspect, resolveCanonicalPersonaState]);

  const authorize = useCallback(async () => {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      // Re-resolve the shared spine immediately before authorization. The
      // server remains authoritative for ownership of the requested target.
      if (!(await resolveCanonicalPersonaState())) {
        throw new Error('Authenticate before authorizing this persona crossing.');
      }
      const res = await personaFetch('/api/threshold/persona-switch/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handshakeCode: code, action: 'authorize' }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirectTo) throw new Error(body.error || 'Authorization failed.');
      window.location.href = body.redirectTo;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authorization failed.');
      setBusy(false);
    }
  }, [code, resolveCanonicalPersonaState]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-black/30">
        <div className="text-xs uppercase tracking-widest text-slate-400">metaMe Threshold</div>
        <h1 className="mt-1 text-xl font-semibold">Authorize a fresh persona crossing</h1>
        <p className="mt-2 text-sm text-slate-400">This replaces the current agent session. It does not merge personas or carry service authority across.</p>
        {error && <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        {signedIn === false && code && (
          <div className="mt-5 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3">
            <div className="mb-3 text-xs text-slate-400">
              Authenticate through the existing metaMe Passport/persona spine. The persona you choose here is the same active persona seen by SmartWallet and other application surfaces.
            </div>
            <PassportConnectPanel
              world="application"
              audience="metame-threshold-persona-recross"
              embedded
              onConnected={() => { void handlePassportConnected(); }}
            />
          </div>
        )}

        {crossing && (
          <div className="mt-5 space-y-3 rounded-xl border border-slate-800 p-4 text-sm">
            <div>From: <span className="font-medium">{crossing.source.displayLabel}</span></div>
            <div>To: <span className="font-medium">{crossing.target.displayLabel}</span></div>
            <div>Connected agent: <span className="font-mono text-xs">{crossing.connectedAgent}</span></div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Fresh constitutional-root scope</div>
              <ul className="mt-2 space-y-1">{crossing.requestedScope.map((scope) => <li key={scope}>• {scope}</li>)}</ul>
            </div>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={authorize} disabled={!crossing || busy || signedIn !== true} className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-40">
            {busy ? 'Authorizing…' : 'Authorize fresh crossing'}
          </button>
          <button onClick={() => window.history.back()} disabled={busy} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Deny</button>
        </div>
      </div>
    </div>
  );
}

export default function SwitchPersonaPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><SwitchPersonaInner /></Suspense>;
}
