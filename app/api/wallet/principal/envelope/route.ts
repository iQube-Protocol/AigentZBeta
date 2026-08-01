/**
 * GET /api/wallet/principal/envelope
 *
 * The caller's OWN encrypted principal-wallet envelope, so the browser can
 * unlock it locally and sign a control proof. Ciphertext only — the password
 * that opens it never leaves the browser and never reaches this server.
 *
 * ── Why this exists rather than reusing a persona lookup ───────────────────
 *
 * `/api/wallet/personas` already selects `evm_key` and returns it for EVERY
 * persona the caller owns — the broad exposure the operator's audit ruling
 * named ("Do not expose `personas.evm_key` directly through a persona lookup
 * endpoint", CLAUDE.md). Reusing it for the retry-proof ceremony would spread
 * that exposure rather than contain it.
 *
 * This route is deliberately narrower on every axis: it takes NO persona
 * parameter (the spine resolves the caller's active persona), returns exactly
 * ONE envelope, and returns nothing else about the persona. That is the owner
 * self-view exception at its minimum useful width.
 *
 * FLAGGED, NOT FIXED: `/api/wallet/personas`'s wider exposure is still there.
 * Narrowing it touches the unlock path every existing wallet depends on, which
 * is not a change to make inside a repair of something else.
 *
 * ── Why the ciphertext may cross at all ────────────────────────────────────
 *
 * It must: the platform cannot decrypt it (it has never held the password) and
 * the browser cannot sign without it. The envelope is AES-256-GCM ciphertext
 * whose key is derived by PBKDF2 from a password the server has never seen, so
 * what crosses is inert without something the server does not have. The rule
 * that matters — never send the password, the plaintext key, or a decrypted
 * envelope — is unaffected and is enforced in the other direction by
 * `screenProvisioningPayload`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, refusal: 'NOT_AUTHENTICATED', detail: 'No active persona could be resolved for this caller.' },
      { status: 401 },
    );
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data, error } = await sb.from('personas').select('evm_key').eq('id', persona.personaId).maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, refusal: 'UNAVAILABLE', detail: `The wallet envelope could not be read (${error.message}).` },
      { status: 503 },
    );
  }

  const env = (data?.evm_key ?? null) as { address?: unknown; encryptedPrivateKey?: unknown } | null;
  const boundAddress = typeof env?.address === 'string' ? env.address : null;
  const encryptedEnvelope = env?.encryptedPrivateKey ?? null;

  if (!encryptedEnvelope || !boundAddress) {
    return NextResponse.json(
      {
        ok: false,
        refusal: 'NO_CONFIGURED_SIGNER',
        detail:
          'This persona has no encrypted principal wallet on file. There is nothing to unlock — provision a ' +
          'principal wallet first.',
      },
      { status: 409 },
    );
  }

  // Exactly two fields. Not the persona, not the row, not anything adjacent.
  return NextResponse.json(
    { ok: true, boundAddress, encryptedEnvelope },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
