/**
 * Polity Passport CCIP-Read gateway — EIP-3668 implementation.
 *
 * Self-hosted ENS subname resolution. Bypasses Namestone/JustaName entirely
 * by speaking the standard ENS CCIP-Read protocol directly.
 *
 * URL pattern: `/api/ens/ccip-read/{sender}/{data}.json` (per EIP-3668)
 *   sender = resolver contract address (0x...)
 *   data   = ABI-encoded resolve(bytes name, bytes data) call
 *
 * Protocol:
 *   1. ENS client (viem.getEnsAddress, ethers.resolveName, app.ens.domains)
 *      calls resolver.resolve(name, recordCall) on Sepolia.
 *   2. Resolver contract reverts with OffchainLookup pointing at this URL.
 *   3. Client GETs this URL.
 *   4. We decode the wrapped call (name + inner record query), look up the
 *      record in our DB (persona_ens_names), sign the answer with the
 *      Polity issuer key, return signed payload.
 *   5. Client calls resolver.resolveWithProof(response, extraData) which
 *      verifies the signature against the trusted issuer address.
 *
 * What the resolver contract must do:
 *   - Implement IExtendedResolver (resolve(bytes name, bytes data))
 *   - Revert with OffchainLookup(address, string[], bytes, bytes4, bytes)
 *     pointing at `/api/ens/ccip-read/{sender}/{data}.json`
 *   - Implement resolveWithProof(bytes response, bytes extraData) that
 *     decodes (result, expires, sig) and verifies the sig is from the
 *     polity issuer address (POLITY_ISSUER_PRIVATE_KEY's public address).
 *
 * The contract source lives at `contracts/PolityOffchainResolver.sol`
 * with deployment instructions in `scripts/deploy-polity-resolver.ts`.
 *
 * EIP-3668 reference: https://eips.ethereum.org/EIPS/eip-3668
 * ENS offchain-resolver reference: github.com/ensdomains/offchain-resolver
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  type Address,
  type Hex,
  decodeAbiParameters,
  encodeAbiParameters,
  keccak256,
  concat,
  toHex,
  toBytes,
  pad,
  encodePacked,
  hexToString,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ sender: string; data: string }>;
}

// ─── Function selectors we support ────────────────────────────────────────
// resolve(bytes,bytes) selector: 0x9061b923 — EIP-2544 wildcard resolver
const RESOLVE_SELECTOR = '0x9061b923';
// addr(bytes32) selector: 0x3b3b57de
const ADDR_SELECTOR = '0x3b3b57de';
// addr(bytes32,uint256) selector: 0xf1cb7e06
const ADDR_COIN_SELECTOR = '0xf1cb7e06';
// text(bytes32,string) selector: 0x59d1d43c
const TEXT_SELECTOR = '0x59d1d43c';

// ─── Polity issuer key — signs every CCIP-Read response ────────────────────
function getIssuerAccount() {
  const envKey = process.env.POLITY_ISSUER_PRIVATE_KEY;
  let key: Hex;
  if (envKey && envKey.startsWith('0x') && envKey.length === 66) {
    key = envKey as Hex;
  } else {
    key = keccak256(toBytes('polity-dev-issuer-v0')) as Hex;
  }
  return privateKeyToAccount(key);
}

// ─── DNS-encoded name decoder ─────────────────────────────────────────────
// CCIP-Read passes the queried name in DNS-encoding format.
// e.g. "first-citizen.polity.eth" → 0x0d66697273742d63697469... (length-prefixed labels)
function decodeDnsName(dnsHex: Hex): string {
  const bytes = toBytes(dnsHex);
  const labels: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    const len = bytes[i];
    if (len === 0) break;
    const label = new TextDecoder().decode(bytes.slice(i + 1, i + 1 + len));
    labels.push(label);
    i += 1 + len;
  }
  return labels.join('.');
}

// ─── Database lookup ──────────────────────────────────────────────────────
async function resolveSubname(name: string): Promise<{
  addr: Address | null;
  textRecords: Record<string, string>;
}> {
  const admin = getSupabaseServer();
  if (!admin) return { addr: null, textRecords: {} };

  const lower = name.toLowerCase();
  const ENS_PARENT = (process.env.ENS_PARENT_NAME ?? 'polity.eth').toLowerCase();

  // Look up persona ENS first.
  const { data: pRow } = await admin
    .from('persona_ens_names')
    .select('persona_public_ref, ens_label, ens_parent, namestone_response, minted_at')
    .eq('ens_full', lower)
    .eq('status', 'live')
    .maybeSingle();

  if (pRow) {
    // Derive a deterministic synthetic address from the public_ref
    // (mirrors the address we store in namestone-mode).
    const synth = (`0x${pRow.persona_public_ref.padEnd(40, '0').slice(0, 40)}`) as Address;
    return {
      addr: synth,
      textRecords: {
        'polity.public_ref': pRow.persona_public_ref as string,
        'polity.kind': 'persona',
        'polity.parent': pRow.ens_parent as string,
        'polity.minted_at': pRow.minted_at as string,
        avatar: 'https://dev-beta.aigentz.me/icons/polity-persona.svg',
        description: `Polity-bound persona — registered ${pRow.minted_at}.`,
      },
    };
  }

  // Locker ENS fallback.
  const { data: lRow } = await admin
    .from('locker_ens_names')
    .select('ens_label, ens_parent, minted_at')
    .eq('ens_full', lower)
    .eq('status', 'live')
    .maybeSingle();

  if (lRow) {
    return {
      addr: null,
      textRecords: {
        'polity.kind': 'locker',
        'polity.parent': lRow.ens_parent as string,
        'polity.minted_at': lRow.minted_at as string,
      },
    };
  }

  // Root parent — e.g. polity.eth itself.
  if (lower === ENS_PARENT) {
    return {
      addr: null,
      textRecords: {
        'polity.kind': 'parent',
        description: 'Polity Passport Bureau — irrevocable proof of personhood.',
        url: 'https://dev-beta.aigentz.me/triad/embed/codex/polity-passport-bureau-cartridge',
      },
    };
  }

  return { addr: null, textRecords: {} };
}

// ─── Inner record query decoding ──────────────────────────────────────────
interface InnerQuery {
  kind: 'addr' | 'addrCoin' | 'text' | 'unsupported';
  node?: Hex;
  coinType?: bigint;
  textKey?: string;
}

function decodeInnerQuery(innerHex: Hex): InnerQuery {
  if (innerHex.length < 10) return { kind: 'unsupported' };
  const selector = innerHex.slice(0, 10).toLowerCase();
  const args = (`0x${innerHex.slice(10)}`) as Hex;

  if (selector === ADDR_SELECTOR) {
    const [node] = decodeAbiParameters([{ type: 'bytes32' }], args) as [Hex];
    return { kind: 'addr', node };
  }
  if (selector === ADDR_COIN_SELECTOR) {
    const [node, coinType] = decodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint256' }],
      args,
    ) as [Hex, bigint];
    return { kind: 'addrCoin', node, coinType };
  }
  if (selector === TEXT_SELECTOR) {
    const [node, key] = decodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'string' }],
      args,
    ) as [Hex, string];
    return { kind: 'text', node, textKey: key };
  }
  return { kind: 'unsupported' };
}

// ─── Response encoder ─────────────────────────────────────────────────────
function encodeAddrResult(addr: Address | null): Hex {
  const zero = '0x0000000000000000000000000000000000000000' as Address;
  return encodeAbiParameters([{ type: 'address' }], [addr ?? zero]);
}

function encodeAddrCoinResult(addr: Address | null, _coinType: bigint): Hex {
  const zero = '0x0000000000000000000000000000000000000000' as Address;
  // Per ENSIP-9: bytes-encoded address for the coin type. For EVM (60) it's
  // 20 bytes; we emit the synthetic addr for any coin type we own.
  const raw = (addr ?? zero) as `0x${string}`;
  return encodeAbiParameters([{ type: 'bytes' }], [raw]);
}

function encodeTextResult(value: string): Hex {
  return encodeAbiParameters([{ type: 'string' }], [value]);
}

// ─── Signing per ENS offchain-resolver pattern ────────────────────────────
// hash = keccak256(0x1900 || resolver_addr || expires(uint64) || keccak256(request) || keccak256(result))
async function signResult(
  resolver: Address,
  request: Hex,
  result: Hex,
  expiresAt: bigint,
): Promise<Hex> {
  const account = getIssuerAccount();
  const requestHash = keccak256(request);
  const resultHash = keccak256(result);
  const messageHash = keccak256(
    encodePacked(
      ['bytes2', 'address', 'uint64', 'bytes32', 'bytes32'],
      ['0x1900', resolver, expiresAt, requestHash, resultHash],
    ),
  );
  return account.sign({ hash: messageHash });
}

// ─── Main handler ─────────────────────────────────────────────────────────
function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  return handleQuery(req, params);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  return handleQuery(req, params);
}

async function handleQuery(_req: NextRequest, params: RouteParams['params']) {
  try {
    const { sender, data } = await params;
    let dataHex = data;
    // Strip .json suffix if present (CCIP-Read URL convention varies)
    if (dataHex.endsWith('.json')) dataHex = dataHex.slice(0, -5);
    if (!dataHex.startsWith('0x')) dataHex = `0x${dataHex}`;
    const senderAddr = (sender.startsWith('0x') ? sender : `0x${sender}`) as Address;
    const callData = dataHex as Hex;

    // Expect callData to be a resolve(bytes name, bytes data) call.
    if (!callData.toLowerCase().startsWith(RESOLVE_SELECTOR)) {
      return withCors(
        NextResponse.json(
          { message: 'Unsupported selector — expected resolve(bytes,bytes)' },
          { status: 400 },
        ),
      );
    }

    const args = (`0x${callData.slice(10)}`) as Hex;
    const [nameBytes, innerCall] = decodeAbiParameters(
      [{ type: 'bytes' }, { type: 'bytes' }],
      args,
    ) as [Hex, Hex];

    const name = decodeDnsName(nameBytes);
    const inner = decodeInnerQuery(innerCall);

    // Resolve from DB
    const { addr, textRecords } = await resolveSubname(name);

    // Encode result by inner query kind
    let result: Hex;
    if (inner.kind === 'addr') {
      result = encodeAddrResult(addr);
    } else if (inner.kind === 'addrCoin') {
      result = encodeAddrCoinResult(addr, inner.coinType ?? 60n);
    } else if (inner.kind === 'text' && inner.textKey) {
      result = encodeTextResult(textRecords[inner.textKey] ?? '');
    } else {
      // Unsupported — return empty bytes
      result = '0x' as Hex;
    }

    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 60 * 60); // 1 hour
    const sig = await signResult(senderAddr, callData, result, expiresAt);

    // Per ENS offchain-resolver: return abi.encode(result, expires, sig)
    const encoded = encodeAbiParameters(
      [{ type: 'bytes' }, { type: 'uint64' }, { type: 'bytes' }],
      [result, expiresAt, sig],
    );

    return withCors(
      NextResponse.json({
        data: encoded,
      }),
    );
  } catch (e) {
    return withCors(
      NextResponse.json(
        { message: e instanceof Error ? e.message : 'CCIP-Read gateway failed' },
        { status: 500 },
      ),
    );
  }
}
