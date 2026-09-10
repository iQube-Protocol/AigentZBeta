'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { personaFetch } from '@/utils/personaSpine';

type SafePersona = { personaPublicRef: string; displayLabel: string; fioHandle: string | null };
type Crossing = {
  source: SafePersona;
  target: SafePersona;
  connectedAgent: string;
  requestedScope: string[];
  switchRequiresReauthorization: true;
};

function SwitchPersonaInner() {
  const [code, setCode] = useState('');
  const [crossing, setCrossing] = useState<Crossing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handshakeCode = new URLSearchParams(window.location.hash.slice(1)).get('code') ?? '';
    setCode(handshakeCode);
    if (!handshakeCode) {
      setError('This persona switch link is incomplete.');
      return;
    }
    void personaFetch('/api/threshold/persona-switch/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handshakeCode, action: 'inspect' }),
    }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) setError(body.error || 'This persona switch is unavailable.');
      else setCrossing(body.crossing);
    }).catch(() => setError('Could not reach the Threshold gateway.'));
  }, []);

  const authorize = useCallback(async () => {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
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
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-black/30">
        <div className="text-xs uppercase tracking-widest text-slate-400">metaMe Threshold</div>
        <h1 className="mt-1 text-xl font-semibold">Authorize a fresh persona crossing</h1>
        <p className="mt-2 text-sm text-slate-400">This replaces the current agent session. It does not merge personas or carry service authority across.</p>
        {error && <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
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
          <button onClick={authorize} disabled={!crossing || busy} className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-40">
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
