/**
 * /access-gateway/authorize — the "Continue with Polity Passport" consent page
 * (PRD-PAG-001 §2.1 Phase 1, operator-ratified 2026-07-22).
 *
 * This is the human-channel authorization endpoint a relying party sends the
 * PERSON to. Phase 1 federates the EXISTING Supabase auth (PRD §0.7): the human
 * must already be signed in to metaMe in this browser; if not, the page points
 * them at sign-in — it never re-implements authentication. The human sees the
 * requesting app + requested claims, selects the persona they act as (the
 * operating-context act, §1), and approves or denies. Approval is the ONLY
 * path to issuance (Principal–Delegate Separation — no agent ever reaches this
 * page), and it drives the server-side consent act which returns the OAuth
 * code to the relying party. Same-device redirect only (QR is later-phase).
 *
 * Persona listing reuses the existing owner self-view surface
 * (GET /api/wallet/personas via personaFetch — the sovereign wallet exposure
 * class, PRD §0.3). The selected personaId travels ONLY as the spine's
 * ownership-verified x-persona-id hint (personaFetch personaIdHint) — it is
 * never sent to the relying party.
 */

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { personaFetch } from '@/utils/personaSpine';

interface GatewayRequest {
  clientId: string;
  clientName: string | null;
  requestedClaims: string[];
}

interface PersonaOption {
  id: string;
  displayName: string;
  avatarUri: string | null;
}

const CLAIM_LABELS: Record<string, string> = {
  sub: 'A private subject reference unique to this app (never your identity)',
  persona_public_ref: 'Your Polity public reference',
  display_label: 'Your persona display name',
  cartridge_flags: 'Your cartridge roles (admin / partner flags)',
  passport_status: 'Your Polity Passport status (class, grade, validity)',
};

function AuthorizeInner() {
  const params = useSearchParams();
  const [handshakeCode, setHandshakeCode] = useState<string | null>(null);
  const [gatewayRequest, setGatewayRequest] = useState<GatewayRequest | null>(null);
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redirectUri = params.get('redirect_uri') ?? '';
  const state = params.get('state') ?? '';

  // 1. Initialise the crossing (validate client + bind PKCE) and check auth.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/access-gateway/authorize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            client_id: params.get('client_id'),
            redirect_uri: params.get('redirect_uri'),
            code_challenge: params.get('code_challenge'),
            code_challenge_method: params.get('code_challenge_method'),
            state: params.get('state'),
            claims: params.get('claims') ?? params.get('scope'),
          }),
        });
        const body = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(body.error_description || body.error || 'This sign-in link is invalid or expired.');
          return;
        }
        setHandshakeCode(body.handshakeCode);
        setGatewayRequest(body.request);
      } catch {
        if (alive) setError('Could not reach the Polity Access Gateway.');
      }
      // Am I signed in? (spine — persona-aware)
      try {
        const who = await personaFetch('/api/wallet/active-persona', { cache: 'no-store' });
        if (alive) setSignedIn(who.ok);
      } catch {
        if (alive) setSignedIn(false);
      }
      // Owner self-view persona list for the operating-context selector.
      try {
        const res = await personaFetch('/api/wallet/personas', { cache: 'no-store' });
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{ id?: string; displayName?: string; avatarUri?: string | null }>;
        if (!alive || !Array.isArray(rows)) return;
        const options = rows
          .filter((r): r is { id: string; displayName?: string; avatarUri?: string | null } => typeof r?.id === 'string')
          .map((r) => ({ id: r.id, displayName: r.displayName || 'Unnamed persona', avatarUri: r.avatarUri ?? null }));
        setPersonas(options);
        if (options.length > 0) setSelectedPersonaId((prev) => prev ?? options[0].id);
      } catch {
        // selector degrades to the spine's active-persona default
      }
    })();
    return () => {
      alive = false;
    };
  }, [params]);

  const approve = useCallback(async () => {
    if (!handshakeCode) return;
    setBusy(true);
    setError(null);
    try {
      const res = await personaFetch('/api/access-gateway/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handshakeCode, approve: true }),
        ...(selectedPersonaId ? { personaIdHint: selectedPersonaId } : {}),
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
  }, [handshakeCode, selectedPersonaId]);

  const deny = useCallback(() => {
    // Open-redirect guard (mirrors the Threshold authorize page, security
    // review Finding 5): only redirect back if the crossing was validated
    // server-side — handshakeCode is set ONLY after the redirect_uri passed
    // the registered-client allowlist.
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

  const appName = gatewayRequest?.clientName || gatewayRequest?.clientId || 'This app';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/40 shadow-lg shadow-black/30 backdrop-blur p-6">
        <div className="text-xs uppercase tracking-widest text-slate-400">Polity Access Gateway</div>
        <h1 className="mt-1 text-xl font-semibold">Continue with Polity Passport</h1>
        <p className="mt-1 text-sm text-slate-400">
          {appName} is asking to sign you in with your Polity Passport. You — and only you — approve this.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
        )}

        {gatewayRequest && (
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-sm text-slate-300">
              Requesting app: <span className="font-medium text-slate-100">{appName}</span>
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">It will receive</div>
            <ul className="mt-2 space-y-1">
              {gatewayRequest.requestedClaims.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-slate-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" /> {CLAIM_LABELS[c] ?? c}
                </li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-slate-500">
              It never receives your password, your private identifiers, or your wallet contents.
            </div>
          </div>
        )}

        {signedIn === false && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            Sign in to metaMe in this browser, then reload this page to continue.
          </div>
        )}

        {signedIn && personas.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Continue as</div>
            <div className="mt-2 space-y-1.5">
              {personas.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-all duration-300 ${
                    selectedPersonaId === p.id
                      ? 'border-purple-500/60 bg-purple-500/10'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="persona"
                    className="accent-purple-500"
                    checked={selectedPersonaId === p.id}
                    onChange={() => setSelectedPersonaId(p.id)}
                  />
                  {p.avatarUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUri} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-400">
                      {p.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm text-slate-200">{p.displayName}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={approve}
            disabled={!handshakeCode || busy || signedIn !== true}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Signing in…' : 'Approve & continue'}
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
          The app receives a short-lived session carrying only the items listed above, referenced by an app-specific
          identifier. You can revoke it at any time. Your Passport and personas stay in your Smart Wallet.
        </p>
      </div>
    </div>
  );
}

export default function AccessGatewayAuthorizePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <AuthorizeInner />
    </Suspense>
  );
}
