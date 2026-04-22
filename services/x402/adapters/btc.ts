// BTC adapter — custody flows via btc_signer_psbt ICP canister
// Anchors iQube refs to Bitcoin via OP_RETURN (threshold ECDSA, no custodian private key in this process)

import { getActor } from '@/services/ops/icAgent';
import { idlFactory as btcSignerIdl } from '@/services/ops/idl/btc_signer_psbt';
import { createHash } from 'crypto';

export type BtcCustodyPlan = {
  network: 'mainnet'|'testnet'|'signet'|'regtest';
  custodianKeyRef?: string; // KMS ref or xprv ref
  recipient?: string;       // optional btc address for reference
  meta?: Record<string, unknown>;
};

export type BtcExecResult = {
  ok: boolean;
  executed: boolean;
  txId?: string;
  psbtBase64?: string;
  reason?: string;
  plan?: unknown;
};

export function loadBtcConfig() {
  const enabled = (process.env.BTC_CUSTODY_ENABLED || 'false').toLowerCase() === 'true';
  const network = (process.env.BTC_NETWORK || 'testnet') as 'mainnet'|'testnet'|'signet'|'regtest';
  const custodianKeyRef = process.env.BTC_CUSTODIAN_KEY_REF; // do not expose private key
  const canisterId = process.env.BTC_SIGNER_PSBT_CANISTER_ID;
  return { enabled, network, custodianKeyRef, canisterId };
}

// ICP BTC signer uses Vec(Vec(Nat8)) derivation paths — each segment is raw UTF-8 bytes
function toDerivationPath(iqubeRef: string): Uint8Array[] {
  return [new TextEncoder().encode(iqubeRef)];
}

function blockstreamBase(network: string): string {
  return network === 'mainnet'
    ? 'https://blockstream.info/api'
    : 'https://blockstream.info/testnet/api';
}

interface RawUtxo { txid: string; vout: number; value: number }

async function fetchUtxosWithScript(
  address: string,
  network: string,
): Promise<Array<{ txid: string; vout: number; amount: bigint; script_pubkey: Uint8Array }>> {
  const base = blockstreamBase(network);
  const res = await fetch(`${base}/address/${address}/utxo`);
  if (!res.ok) throw new Error(`UTXO fetch failed: ${res.status}`);
  const utxos = (await res.json()) as RawUtxo[];

  return Promise.all(
    utxos.map(async (u) => {
      try {
        const txRes = await fetch(`${base}/tx/${u.txid}`);
        const tx = (await txRes.json()) as { vout: Array<{ scriptpubkey: string }> };
        const scriptHex = tx.vout[u.vout]?.scriptpubkey ?? '';
        const scriptBytes = (scriptHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16));
        return { txid: u.txid, vout: u.vout, amount: BigInt(u.value), script_pubkey: new Uint8Array(scriptBytes) };
      } catch {
        return { txid: u.txid, vout: u.vout, amount: BigInt(u.value), script_pubkey: new Uint8Array(0) };
      }
    }),
  );
}

async function fetchFeeRate(network: string): Promise<bigint> {
  try {
    const base = blockstreamBase(network);
    const res = await fetch(`${base}/fee-estimates`);
    if (!res.ok) return BigInt(10);
    const fees = (await res.json()) as Record<string, number>;
    // Use 6-block confirmation target, fallback to 1-block, fallback to 10 sat/vB
    return BigInt(Math.ceil(fees['6'] ?? fees['1'] ?? 10));
  } catch {
    return BigInt(10);
  }
}

export async function planBtcCustody(input: {
  iqubeRef: string;
  limits?: unknown;
  ttlSec?: number;
}): Promise<BtcExecResult> {
  const cfg = loadBtcConfig();

  if (!cfg.enabled) {
    return { ok: true, executed: false, reason: 'btc custody disabled', plan: { network: cfg.network } };
  }
  if (!cfg.canisterId) {
    return {
      ok: true,
      executed: false,
      reason: 'BTC_SIGNER_PSBT_CANISTER_ID not configured',
      plan: { network: cfg.network },
    };
  }

  try {
    const actor = await getActor<Record<string, (...args: unknown[]) => Promise<unknown>>>(
      cfg.canisterId,
      btcSignerIdl,
    );
    const derivPath = toDerivationPath(input.iqubeRef);

    // 1. Resolve the custody BTC address for this iQube ref
    const addrResult = (await actor.get_btc_address(derivPath)) as { Ok?: { address: string }; Err?: string };
    if (!addrResult.Ok) {
      return { ok: false, executed: false, reason: addrResult.Err ?? 'get_btc_address failed' };
    }
    const custodyAddress = addrResult.Ok.address;

    // 2. Fetch UTXOs — if unfunded, return plan with custody address (caller funds it)
    const utxos = await fetchUtxosWithScript(custodyAddress, cfg.network);
    if (utxos.length === 0) {
      return {
        ok: true,
        executed: false,
        reason: 'custody address unfunded — send BTC to activate',
        plan: { network: cfg.network, custodyAddress, iqubeRef: input.iqubeRef },
      };
    }

    // 3. Build anchor tx — SHA-256 of iqubeRef embedded as OP_RETURN data_hash
    const dataHash = createHash('sha256').update(input.iqubeRef).digest('hex');
    const feeRate = await fetchFeeRate(cfg.network);
    const txResult = (await actor.create_anchor_transaction(dataHash, utxos, feeRate)) as {
      Ok?: object;
      Err?: string;
    };
    if (!txResult.Ok) {
      return { ok: false, executed: false, reason: txResult.Err ?? 'create_anchor_transaction failed' };
    }

    // 4. Sign via ICP threshold ECDSA (no private key leaves the canister)
    const signResult = (await actor.sign_transaction(txResult.Ok, derivPath)) as {
      Ok?: { txid: string; raw_tx: string };
      Err?: string;
    };
    if (!signResult.Ok) {
      return { ok: false, executed: false, reason: signResult.Err ?? 'sign_transaction failed' };
    }
    const { txid, raw_tx } = signResult.Ok;

    // 5. Broadcast to Bitcoin network
    const broadcastResult = (await actor.broadcast_transaction(raw_tx)) as { Ok?: string; Err?: string };
    if (broadcastResult.Err) {
      return { ok: false, executed: false, reason: broadcastResult.Err, plan: { txid } };
    }

    return {
      ok: true,
      executed: true,
      txId: txid,
      plan: { network: cfg.network, custodyAddress, iqubeRef: input.iqubeRef, dataHash },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'btc custody error';
    console.error('[BTC custody]', msg);
    return { ok: false, executed: false, reason: msg };
  }
}
