/**
 * /threshold/enter-service — the incremental service crossing page (Increment 4b).
 *
 * The human authorizes an ADDITIONAL, capability-specific delegation (e.g. entering
 * IRL) that upgrades their agent's existing session. Only the human authorizes;
 * the agent prepared the request via request_service_capabilities.
 */

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { personaFetch } from '@/utils/personaSpine';

interface Upgrade {
  service: string;
  serviceTitle: string;
  requestedScope: string[];
  status: string;
}

function EnterServiceInner() {
  const params = useSearchParams();
  // The handshake code arrives in the URL FRAGMENT (security review Finding 3) so
  // it never reaches a server log or a Referer header. Read it client-side; fall
  // back to the query param for backward compatibility with older links.
  const [code, setCode] = useState('');
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    const fromHash = new URLSearchParams(hash).get('code');
    setCode(fromHash || params.get('code') || '');
  }, [params]);
  const [upgrade, setUpgrade] = useState<Upgrade | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return; // wait until the fragment-borne code is resolved
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/threshold/service/complete?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
        const body = await res.json();
        if (!alive) return;
        if (!res.ok || !body.ok) setError(body.error || 'This service-entry link is invalid or expired.');
        else setUpgrade(body);
      } catch {
        if (alive) setError('Could not reach the Threshold gateway.');
      }
      try {
        const who = await personaFetch('/api/wallet/active-persona', { cache: 'no-store' });
        if (alive) setSignedIn(who.ok);
      } catch {
        if (alive) setSignedIn(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code]);

  const authorize = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await personaFetch('/api/threshold/service/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handshakeCode: code }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(body.error || 'Authorization failed.');
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError('Authorization failed.');
      setBusy(false);
    }
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/40 shadow-lg shadow-black/30 backdrop-blur p-6">
        <div className="text-xs uppercase tracking-widest text-slate-400">metaMe Threshold</div>
        <h1 className="mt-1 text-xl font-semibold">Enter {upgrade?.serviceTitle ?? 'a service'}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Your agent is asking to enter this service on your behalf. This grants one more bounded, revocable authority to
          your existing session — you authorize it.
        </p>

        {error && <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        {done ? (
          <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Your request has been authorized. Welcome to {upgrade?.serviceTitle ?? 'the service'}, an institution of the Polity.
            Your agent has been granted the authority required to participate on your behalf, within the scope you approved.
            Return to your agent — its session now holds this authority.
          </div>
        ) : (
          <>
            {upgrade && (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">You are authorizing</div>
                <ul className="mt-2 space-y-1">
                  {upgrade.requestedScope.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm text-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> {s}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-xs text-slate-500">
                  Bounded &amp; revocable. Your agent still cannot move funds, publish, disclose your identity, or delegate
                  onward.
                </div>
              </div>
            )}

            {signedIn === false && (
              <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                Sign in to metaMe in this browser, then reload to authorize.
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={authorize}
                disabled={!upgrade || busy || signedIn !== true}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Authorizing…' : `Authorize ${upgrade?.serviceTitle ?? 'entry'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function EnterServicePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <EnterServiceInner />
    </Suspense>
  );
}
