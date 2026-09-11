/**
 * /threshold/authorize — the human crossing page (PRD-THR-001 §6, Increment 2b).
 *
 * OAuth is only a projection of the canonical Passport/persona spine. Signed-out
 * operators authenticate here through the SAME PassportConnectPanel used by the
 * SmartWallet. That ceremony proves control, resolves the principal server-side,
 * requires explicit persona choice, and establishes the same application-world
 * persona session. Threshold never creates or persists a parallel identity/persona
 * selection of its own.
 *
 * The OAuth handshake remains alive on this page while authentication runs, so the
 * server-bound PKCE challenge, state, client and redirect URI are never rebuilt from
 * a second browser tab or copied through an ad-hoc auth continuation.
 */

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { personaFetch } from '@/utils/personaSpine';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';

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

  const resolveCanonicalPersonaState = useCallback(async () => {
    try {
      // This is the same wallet/persona-spine projection consumed by native
      // surfaces. Success means the Passport ceremony established a canonical
      // application-world persona session; OAuth never trusts a local selection.
      const who = await personaFetch('/api/wallet/active-persona', { cache: 'no-store' });
      setSignedIn(who.ok);
      return who.ok;
    } catch {
      setSignedIn(false);
      return false;
    }
  }, []);

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
      if (alive) await resolveCanonicalPersonaState();
    })();
    return () => {
      alive = false;
    };
  }, [params, resolveCanonicalPersonaState]);

  const authorize = useCallback(async () => {
    if (!handshakeCode) return;
    setBusy(true);
    setError(null);
    try {
      // Re-resolve immediately before the constitutional act. The selected
      // persona is therefore whatever the canonical wallet/persona spine says
      // NOW, not a stale OAuth-local field.
      if (!(await resolveCanonicalPersonaState())) {
        setError('Authenticate and select a persona before authorizing this crossing.');
        setBusy(false);
        return;
      }
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
  }, [handshakeCode, resolveCanonicalPersonaState]);

  const deny = useCallback(() => {
    // Open-redirect guard: only redirect back if authorize-init already
    // validated this redirect URI for the client.
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
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/40 shadow-lg shadow-black/30 backdrop-blur p-6">
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

        {signedIn === false && handshakeCode && (
          <div className="mt-5 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3">
            <div className="mb-3 text-xs text-slate-400">
              Authenticate with your existing metaMe Passport and choose the persona for this crossing. This is the same Passport/persona spine used by SmartWallet.
            </div>
            <PassportConnectPanel
              world="application"
              audience="metame-threshold-oauth"
              embedded
              onConnected={() => { void resolveCanonicalPersonaState(); }}
            />
          </div>
        )}

        {signedIn === true && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Passport authenticated. The active persona will be resolved from the canonical persona spine when you authorize.
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
