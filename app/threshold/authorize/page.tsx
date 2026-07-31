/**
 * /threshold/authorize — the human crossing page (PRD-THR-001 §6, Increment 2b).
 *
 * This is the OAuth authorization endpoint the Threshold Companion sends the
 * PERSON to. The human signs in, sees exactly what the crossing asks, and — with
 * one explicit click — authorizes a bounded, revocable delegation to their agent.
 * That click drives the real constitutional acts server-side (form → agent-accept
 * → HUMAN-authorize) and returns the OAuth code to the Companion. The agent never
 * reaches this page; only the human authorizes (Principal–Delegate Separation).
 */

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { personaFetch } from '@/utils/personaSpine';

interface Crossing {
  initiatingService: string;
  serviceTitle: string;
  requestedScope: string[];
}

function AuthorizeInner() {
  const params = useSearchParams();
  const [handshakeCode, setHandshakeCode] = useState<string | null>(null);
  const [crossing, setCrossing] = useState<Crossing | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redirectUri = params.get('redirect_uri') ?? '';
  const state = params.get('state') ?? '';

  // 1. Initialise the OAuth crossing (validate client + bind PKCE) and check auth.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/threshold/oauth/authorize-init', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            client_id: params.get('client_id'),
            redirect_uri: params.get('redirect_uri'),
            code_challenge: params.get('code_challenge'),
            code_challenge_method: params.get('code_challenge_method'),
            state: params.get('state'),
            scope: params.get('scope'),
            service: params.get('service'),
          }),
        });
        const body = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(body.error_description || body.error || 'This crossing link is invalid or expired.');
          return;
        }
        setHandshakeCode(body.handshakeCode);
        setCrossing(body.crossing);
      } catch {
        if (alive) setError('Could not reach the Threshold gateway.');
      }
      // Am I signed in? (spine — persona-aware)
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
  }, [params]);

  const authorize = useCallback(async () => {
    if (!handshakeCode) return;
    setBusy(true);
    setError(null);
    try {
      const res = await personaFetch('/api/threshold/oauth/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handshakeCode }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirectTo) {
        setError(body.error || 'Authorization failed.');
        setBusy(false);
        return;
      }
      window.location.href = body.redirectTo as string;
    } catch {
      setError('Authorization failed.');
      setBusy(false);
    }
  }, [handshakeCode]);

  const deny = useCallback(() => {
    // Open-redirect guard (security review Finding 5): only redirect back if the
    // crossing was validated server-side. `handshakeCode` is set ONLY after
    // authorize-init confirmed redirect_uri is registered for this client, so an
    // attacker-supplied redirect_uri (that fails validation) never navigates.
    if (!redirectUri || !handshakeCode) return;
    let u: URL;
    try {
      u = new URL(redirectUri);
    } catch {
      return;
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
    u.searchParams.set('error', 'access_denied');
    if (state) u.searchParams.set('state', state);
    window.location.href = u.toString();
  }, [redirectUri, state, handshakeCode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/40 shadow-lg shadow-black/30 backdrop-blur p-6">
        <div className="text-xs uppercase tracking-widest text-slate-400">metaMe Threshold</div>
        <h1 className="mt-1 text-xl font-semibold">Cross the Threshold</h1>
        <p className="mt-1 text-sm text-slate-400">
          Your agent is asking to cross into metaMe on your behalf. You — and only you — authorize this.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
        )}

        {crossing && (
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-sm text-slate-300">
              Destination: <span className="font-medium text-slate-100">{crossing.serviceTitle}</span>
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">Requested permissions</div>
            {crossing.requestedScope.length === 0 ? (
              <div className="mt-1 text-sm text-slate-400">Sign-in only — no additional capability requested.</div>
            ) : (
              <ul className="mt-2 space-y-1">
                {crossing.requestedScope.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> {s}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 text-xs text-slate-500">
              Bounded &amp; revocable. Your agent may not move funds, publish, disclose your identity, or delegate onward.
            </div>
          </div>
        )}

        {signedIn === false && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            Sign in to metaMe in this browser, then reload this page to authorize the crossing.
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={authorize}
            disabled={!handshakeCode || busy || signedIn !== true}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Authorizing…' : 'Authorize crossing'}
          </button>
          <button
            onClick={deny}
            disabled={busy}
            className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-300 transition-all duration-300 hover:border-slate-700 disabled:opacity-40"
          >
            Deny
          </button>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          Authorizing forms a Constitutional Agreement you own and can revoke at any time. Your agent receives a scoped
          session bound to that agreement — never your identity.
        </p>
      </div>
    </div>
  );
}

export default function ThresholdAuthorizePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <AuthorizeInner />
    </Suspense>
  );
}
