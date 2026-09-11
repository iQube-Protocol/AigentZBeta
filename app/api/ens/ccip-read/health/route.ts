/**
 * GET /api/ens/ccip-read/health
 *
 * Diagnostic endpoint for the self-hosted CCIP-Read gateway.
 *
 * Lets the operator verify, BEFORE spending gas on the resolver deploy,
 * that:
 *   1. The issuer address matches what the contract will expect.
 *   2. A test resolution against a sample subname returns the expected
 *      signed payload shape.
 *   3. The signature recovers to the issuer address (the same check the
 *      on-chain resolveWithProof will do).
 *
 * Public + CORS-enabled. Returns nothing private.
 *
 * Example:
 *   curl -s https://dev-beta.aigentz.me/api/ens/ccip-read/health?name=test.polity.eth | jq
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  type Address,
  type Hex,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  recoverAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getIssuerAddress, isProductionIssuer } from '@/services/identity/polityIssuer';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ENS_PARENT = (process.env.ENS_PARENT_NAME ?? 'polity.eth').toLowerCase();

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  const issuerAddress = getIssuerAddress();
  const name = (req.nextUrl.searchParams.get('name') ?? `test.${ENS_PARENT}`).toLowerCase();

  // Run the same sign path the production gateway runs, against a sample
  // fake (sender=0x000...01, result='hello').
  const fakeSender = '0x0000000000000000000000000000000000000001' as Address;
  const fakeRequest = '0x9061b923' as Hex; // resolve selector with no payload — diagnostic only
  const fakeResult = encodeAbiParameters([{ type: 'address' }], [fakeSender]);
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
  const messageHash = keccak256(
    encodePacked(
      ['bytes2', 'address', 'uint64', 'bytes32', 'bytes32'],
      ['0x1900', fakeSender, expiresAt, keccak256(fakeRequest), keccak256(fakeResult)],
    ),
  );

  const envKey = process.env.POLITY_ISSUER_PRIVATE_KEY;
  let key: Hex;
  if (envKey && envKey.startsWith('0x') && envKey.length === 66) {
    key = envKey as Hex;
  } else {
    key = keccak256(new TextEncoder().encode('polity-dev-issuer-v0')) as Hex;
  }
  const account = privateKeyToAccount(key);
  const sig = await account.sign({ hash: messageHash });
  const recovered = await recoverAddress({ hash: messageHash, signature: sig });

  const sigMatchesIssuer = recovered.toLowerCase() === issuerAddress.toLowerCase();

  // DB check — does the queried name exist in persona_ens_names?
  let dbResolution: { exists: boolean; kind: string | null; publicRef: string | null } = {
    exists: false,
    kind: null,
    publicRef: null,
  };
  try {
    const admin = getSupabaseServer();
    if (admin) {
      const { data: pRow } = await admin
        .from('persona_ens_names')
        .select('persona_public_ref')
        .eq('ens_full', name)
        .eq('status', 'live')
        .maybeSingle();
      if (pRow) {
        dbResolution = {
          exists: true,
          kind: 'persona',
          publicRef: pRow.persona_public_ref as string,
        };
      } else {
        const { data: lRow } = await admin
          .from('locker_ens_names')
          .select('ens_label')
          .eq('ens_full', name)
          .eq('status', 'live')
          .maybeSingle();
        if (lRow) dbResolution = { exists: true, kind: 'locker', publicRef: null };
      }
    }
  } catch {
    // Silent — health endpoint should not fail because DB lookup did.
  }

  return withCors(
    NextResponse.json({
      ok: true,
      issuer_address: issuerAddress,
      issuer_mode: isProductionIssuer() ? 'production' : 'dev',
      ens_parent: ENS_PARENT,
      gateway_url_pattern: 'https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json',
      tested_name: name,
      db_resolution: dbResolution,
      signing_roundtrip: {
        sig_matches_issuer: sigMatchesIssuer,
        sample_signature: sig,
        recovered_address: recovered,
        expires_at: expiresAt.toString(),
        message_hash: messageHash,
      },
      next_steps: sigMatchesIssuer
        ? [
            '✅ Signing works. Deploy the resolver:',
            'DEPLOYER_PRIVATE_KEY=0x... POLITY_ISSUER_PRIVATE_KEY=<same as server> npx tsx scripts/deploy-polity-resolver.ts',
            'Then set the deployed address as the resolver on polity.eth via sepolia.app.ens.domains',
          ]
        : [
            '⚠️  Signing roundtrip failed — recovered address does not match the configured issuer.',
            'Check that POLITY_ISSUER_PRIVATE_KEY env var is set correctly on the server.',
            'Verify the public address at GET /api/polity-passport/issuer matches the local computation.',
          ],
    }),
  );
}
