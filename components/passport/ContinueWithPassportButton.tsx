/**
 * ContinueWithPassportButton — the "Continue with Polity Passport" entry point
 * (PRD-PAG-001 §2.1 Phase 1, operator-ratified 2026-07-22).
 *
 * Self-contained client component a first-party surface mounts to start the
 * human crossing: it generates a PKCE S256 pair (WebCrypto), stashes the
 * verifier + state in sessionStorage for the host app's callback handler, and
 * navigates to the consent page (/access-gateway/authorize) with the
 * authorization request. The host app's redirect_uri callback then exchanges
 * `code` + the stored verifier at POST /api/access-gateway/token.
 *
 * NOT wired into any existing login page — integrating live login surfaces is
 * a separate, deliberate pass. The relying party must be registered first via
 * the shared Threshold DCR (/api/threshold/oauth/register).
 */

'use client';

import { useCallback, useState } from 'react';

export const PAG_PKCE_VERIFIER_KEY = 'pag_pkce_verifier';
export const PAG_OAUTH_STATE_KEY = 'pag_oauth_state';

function randomUrlSafe(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function s256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface ContinueWithPassportButtonProps {
  /** Registered OAuth client id (shared Threshold DCR registry). */
  clientId: string;
  /** Redirect URI registered for the client — receives ?code=&state=. */
  redirectUri: string;
  /** Claims to request (Phase-1 vocabulary; unknown claims are dropped
   *  server-side). Defaults to the minimal subject-only session. */
  claims?: string[];
  label?: string;
  className?: string;
}

export default function ContinueWithPassportButton({
  clientId,
  redirectUri,
  claims,
  label = 'Continue with Polity Passport',
  className,
}: ContinueWithPassportButtonProps) {
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const verifier = randomUrlSafe(48);
      const state = randomUrlSafe(16);
      sessionStorage.setItem(PAG_PKCE_VERIFIER_KEY, verifier);
      sessionStorage.setItem(PAG_OAUTH_STATE_KEY, state);
      const challenge = await s256Challenge(verifier);
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
      });
      if (claims && claims.length > 0) params.set('claims', claims.join(' '));
      window.location.href = `/access-gateway/authorize?${params.toString()}`;
    } catch {
      setBusy(false);
    }
  }, [busy, clientId, redirectUri, claims]);

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm font-medium text-slate-100 shadow-lg shadow-black/30 transition-all duration-300 hover:border-slate-700 hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-40'
      }
    >
      <span className="h-2 w-2 rounded-full bg-purple-500" aria-hidden />
      {busy ? 'Opening…' : label}
    </button>
  );
}
