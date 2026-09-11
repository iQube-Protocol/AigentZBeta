/**
 * GET /api/polity-passport/issuer
 *
 * Public — returns the polity issuer's EVM address so verifiers can
 * confirm AgentKit attestations and ProveKit proofs against the
 * correct public key. The corresponding private key
 * (POLITY_ISSUER_PRIVATE_KEY) stays server-only.
 *
 * This is the public-key anchor for the cryptographic attestation
 * system. Any external party (immigration counsel, partner agent,
 * judge) can fetch this address and use it with EIP-191 verify to
 * confirm any token signed by the polity bureau.
 */

import { NextResponse } from 'next/server';
import { getIssuerAddress, isProductionIssuer } from '@/services/identity/polityIssuer';

export const dynamic = 'force-dynamic';

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'public, max-age=300');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  return withCors(
    NextResponse.json({
      issuer_address: getIssuerAddress(),
      issuer_mode: isProductionIssuer() ? 'production' : 'dev',
      signature_scheme: 'eip-191',
      verification_instructions:
        'Tokens are <base64url(payload)>.<eip191_signature>. To verify: split on the last "." — recover the issuer address with viem.verifyMessage({ address: <this issuer_address>, message: <base64url-encoded-payload>, signature: <signature> }).',
      tokens_issued_by_this_address: [
        '/api/access/delegation/agentkit-attest (AgentKit delegation attestation)',
        '/api/polity-passport/attest/[type] (ProveKit proof of <circuit>)',
      ],
    }),
  );
}
