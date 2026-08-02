/**
 * GET /api/wallet/principal/address-reconciliation
 *
 * Which addresses claim to be the operator's principal wallet, and whether
 * they agree.
 *
 * ── Why this exists (operator, 2026-08-02) ─────────────────────────────────
 *
 *   > "The most important candidate is SIGNER_MISMATCH, because the signing
 *   >  key comes from the encrypted evm_key envelope while the server
 *   >  validates against personas.evm_address."
 *
 * A signature is produced from ONE source and validated against ANOTHER:
 *
 *   produced from   evm_key.encryptedPrivateKey   (decrypted in the browser)
 *   validated against  resolvePersonaWalletAddress → personas.evm_address,
 *                      falling back to evm_key.address, then wallet_aliases
 *
 * Three places, one fact — `inv.engineering.036`'s shape. While they agree
 * nothing is wrong; the moment one is written without the others, every
 * signature the operator makes is correct and every verification refuses it.
 * The refusal that results says "recovers to X, expected Y" and names neither
 * SOURCE, so it reads as a broken signer rather than a split record.
 *
 * This route reports every source and the resolver's own answer, so a
 * divergence identifies itself.
 *
 * ── What it does NOT do ────────────────────────────────────────────────────
 *
 * It never decrypts anything and never asks for a password. The fourth
 * comparison the operator listed — "derived address from decrypted key" — can
 * only happen in the browser, where the key is unsealed; the panel adds it
 * there. A server route that could derive it would be a server that could
 * hold the key.
 *
 * Owner self-view: the spine resolves the caller and the route never accepts a
 * personaId from the query string. It returns the CALLER'S OWN addresses only
 * — the same exposure class as /api/wallet/persona.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolvePersonaWalletAddress } from '@/services/identity/personaAddressResolver';
import { listPendingSigningRequestsForOperator } from '@/services/signing/signingRequestStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalise(v: unknown): string | null {
  return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) ? v.toLowerCase() : null;
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, refusal: 'NOT_AUTHENTICATED', detail: 'No active persona could be resolved for this caller.' },
      { status: 401 },
    );
  }

  const sb = getSupabaseServer();
  if (!sb) {
    return NextResponse.json(
      { ok: false, refusal: 'UNAVAILABLE', detail: 'The persona store could not be reached, so nothing was compared.' },
      { status: 503 },
    );
  }

  const { data: row, error } = await sb
    .from('personas')
    .select('evm_address, evm_key')
    .eq('id', persona.personaId)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, refusal: 'UNAVAILABLE', detail: `The persona record could not be read (${error.message}).` },
      { status: 503 },
    );
  }

  const evmKey = (row?.evm_key ?? null) as { address?: unknown } | null;
  const sources = {
    // What the mandate verifier compares against, via the resolver's own
    // precedence — this is the value SIGNER_MISMATCH calls "expected".
    resolverAnswer: normalise(await resolvePersonaWalletAddress(persona.personaId, 'base')),
    // The flat column the resolver prefers.
    personasEvmAddress: normalise(row?.evm_address),
    // The address recorded ALONGSIDE the encrypted key that actually signs.
    // If this disagrees with the column, the signature will be correct and
    // the verification will refuse it.
    evmKeyAddress: normalise(evmKey?.address),
  };

  // What the live mandates expect, so a stale request prepared before a
  // re-provision is visible as such rather than as a broken signer.
  let pendingExpects: { requestId: string; walletRef: string; expired: boolean }[] = [];
  try {
    const now = Date.now();
    pendingExpects = (await listPendingSigningRequestsForOperator(persona.personaId))
      .filter((r) => r.walletRef === 'principal')
      .map((r) => ({
        requestId: r.id,
        walletRef: r.walletRef,
        expired: new Date(r.expiresAt).getTime() <= now,
      }));
  } catch {
    // An unreadable request list is not an empty one; it just is not part of
    // this comparison.
    pendingExpects = [];
  }

  const present = Object.entries(sources).filter(([, v]) => v !== null) as [string, string][];
  const distinct = [...new Set(present.map(([, v]) => v))];
  const agree = distinct.length <= 1;

  return NextResponse.json(
    {
      ok: true,
      agree,
      /*
       * The verdict in words, because a caller reading three matching hex
       * strings still has to decide what that means. Absent sources are
       * reported as absent — a null is "not recorded here", never "disagrees".
       */
      verdict: agree
        ? present.length === 0
          ? 'NO_ADDRESS_RECORDED — no source holds a principal address for this persona.'
          : 'ADDRESSES_AGREE — every recorded source names the same principal address, so a valid ' +
            'signature from the configured signer will verify.'
        : `SOURCES_DIVERGE — ${present.length} sources hold ${distinct.length} different addresses. ` +
          'A signature produced from the encrypted key will be REFUSED by the verifier whenever ' +
          'evmKeyAddress and the resolverAnswer differ, and the refusal will name neither source.',
      sources,
      /*
       * Which source the mandate verifier will actually use. Named explicitly
       * so the answer does not have to be inferred from the resolver's
       * precedence rules.
       */
      verifierComparesAgainst: 'resolverAnswer',
      signatureIsProducedFrom: 'evm_key.encryptedPrivateKey (decrypted in the browser)',
      pendingPrincipalRequests: pendingExpects,
      /*
       * The one comparison this route cannot make. Stated rather than omitted:
       * a reconciliation that silently covers three of four checks would read
       * as complete.
       */
      notCheckedHere:
        'The address DERIVED from the decrypted key is not compared here — deriving it requires the ' +
        'wallet password, which never reaches a server. Unlock the wallet in the Principal Wallet ' +
        'surface to compare that fourth value locally.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
