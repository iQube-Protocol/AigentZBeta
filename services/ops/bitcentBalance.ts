/**
 * Bitcent (B¢) live premine balance — resolved from PRIMARY chain data, never
 * from a Rune-aware indexer (none was found reachable during earlier
 * sessions — see app/api/ops/bitcent/testnet/route.ts's history comment —
 * and the platform's bounded-fallback Bitcoin explorer's testnet Rune
 * endpoint does not index Runes on testnet at all, per
 * codexes/packs/agentiq/updates/2026-07-30_bitcent-testnet-etch-broadcast.md).
 *
 * The method mirrors scripts/verify-bitcent-etch.js's philosophy (decode the
 * Runestone from the raw transaction with the SAME runelib encoder that
 * built it) and extends it one step further: scripts/deploy-qct-bitcoin.js
 * etches with an empty edicts array and no explicit Pointer, so the ENTIRE
 * premine is allocated, by protocol default, to the first non-OP_RETURN
 * output of the etching transaction itself (Runes protocol Tag.Pointer:
 * "If the Pointer field is absent, unallocated runes are transferred to the
 * first non-OP_RETURN output"). That output is therefore where the whole
 * B¢ premine balance lives, unless and until it is spent. Determining
 * "has this specific output been spent" is a PLAIN Esplora capability
 * (services/ops/btcExplorer.ts's fetchBtcOutspendWithFallback) — it needs no
 * Rune awareness at all. So the common case (premine output never moved) is
 * fully resolvable today, honestly, from primary sources:
 *
 *   1. Fetch the etch transaction's raw hex (bounded blockstream/mempool
 *      fallback, same as the rest of this codebase's Bitcoin reads).
 *   2. Decode its Runestone with runelib — get the real on-chain rune name,
 *      divisibility, and premine amount (not the ratified record's stated
 *      intent — the ACTUAL encoded values).
 *   3. Locate the premine-holding output (explicit Pointer field if set,
 *      otherwise the first non-OP_RETURN output).
 *   4. Check whether that output has since been spent.
 *      - Unspent -> the full premine balance still sits there: report it.
 *      - Spent -> the balance has moved by an edict in the spending
 *        transaction; tracing where it went DOES require a Rune-aware
 *        indexer, which is not yet wired in. Report unresolved, honestly,
 *        rather than guessing or reporting zero.
 *
 * Never fabricates a balance. `resolved: false` always carries a `reason`.
 */

import { Transaction, script as bscript, opcodes } from 'bitcoinjs-lib';
import { Runestone } from 'runelib';
import {
  fetchBtcOutspendWithFallback,
  fetchBtcRawTxHexWithFallback,
  type BtcExplorerSource,
} from './btcExplorer';

export interface BitcentBalanceResult {
  resolved: boolean;
  /** Display-unit balance (raw on-chain amount already divided by
   * 10^divisibility). Only meaningful when resolved === true. */
  amount: number | null;
  runeName: string | null;
  divisibility: number | null;
  /** Which output of the etch transaction the premine — and therefore this
   * balance, while unspent — lives at. */
  outputIndex: number | null;
  source: BtcExplorerSource | null;
  checkedAt: string;
  /** Always set when resolved === false. Never a guess dressed as a number. */
  reason: string | null;
}

function unresolved(
  reason: string,
  partial: Partial<Pick<BitcentBalanceResult, 'runeName' | 'divisibility' | 'outputIndex' | 'source'>> = {},
): BitcentBalanceResult {
  return {
    resolved: false,
    amount: null,
    runeName: partial.runeName ?? null,
    divisibility: partial.divisibility ?? null,
    outputIndex: partial.outputIndex ?? null,
    source: partial.source ?? null,
    checkedAt: new Date().toISOString(),
    reason,
  };
}

/** The output that unallocated runes default to when no edict/Pointer
 * claims them: the first output whose script is not OP_RETURN. */
function firstNonOpReturnOutputIndex(tx: Transaction): number | null {
  for (let i = 0; i < tx.outs.length; i++) {
    const decompiled = bscript.decompile(tx.outs[i].script);
    if (!decompiled || decompiled[0] !== opcodes.OP_RETURN) return i;
  }
  return null;
}

/**
 * Resolves the CURRENT live Bitcent (B¢) balance at the ratified premine
 * custodian output. `alreadyVerifiedValidEtch` must come from the ratified
 * `scripts/bitcent-issuance-record.json`'s `etchBroadcast.verification.verdict
 * === 'VALID_ETCH'` — this function does not re-derive cenotaph status
 * itself (that determination, and its primary-evidence method, already
 * happened once via scripts/verify-bitcent-etch.js and is the ratified
 * record's job to carry, not this read path's to repeat).
 */
export async function resolveBitcentPremineBalance(params: {
  txid: string;
  alreadyVerifiedValidEtch: boolean;
}): Promise<BitcentBalanceResult> {
  if (!params.alreadyVerifiedValidEtch) {
    return unresolved('the etch has not been verified as a valid, non-cenotaph Runestone');
  }

  const rawTx = await fetchBtcRawTxHexWithFallback(params.txid);
  if (!rawTx.hex) {
    return unresolved(rawTx.error ?? 'raw transaction unavailable from either explorer');
  }

  let tx: Transaction;
  let stoneOpt: ReturnType<typeof Runestone.decipher>;
  try {
    tx = Transaction.fromHex(rawTx.hex);
    stoneOpt = Runestone.decipher(rawTx.hex);
  } catch (e: any) {
    return unresolved(`could not decode the etch transaction: ${e?.message ?? String(e)}`, { source: rawTx.source });
  }

  if (!stoneOpt.isSome()) {
    return unresolved('no Runestone present in the etch transaction', { source: rawTx.source });
  }
  const stone = stoneOpt.value();
  if (!stone.etching.isSome()) {
    return unresolved('the transaction carries a Runestone but no etching', { source: rawTx.source });
  }
  const etching = stone.etching.value();
  const runeName = etching.rune.isSome() ? etching.rune.value().name : null;
  const divisibility = etching.divisibility.isSome() ? etching.divisibility.value() : 0;
  const rawPremine = etching.premine.isSome() ? etching.premine.value() : null;
  if (rawPremine == null) {
    return unresolved('the etching carries no premine', { runeName, divisibility, source: rawTx.source });
  }

  const pointerVout = stone.pointer.isSome() ? stone.pointer.value() : null;
  const outputIndex = pointerVout != null ? pointerVout : firstNonOpReturnOutputIndex(tx);
  if (outputIndex == null) {
    return unresolved('could not determine which output holds the premine (no non-OP_RETURN output found)', {
      runeName,
      divisibility,
      source: rawTx.source,
    });
  }

  const outspend = await fetchBtcOutspendWithFallback(params.txid, outputIndex);
  if (outspend.spent == null) {
    return unresolved(outspend.error ?? 'could not determine whether the premine output has been spent', {
      runeName,
      divisibility,
      outputIndex,
      source: outspend.source ?? rawTx.source,
    });
  }
  if (outspend.spent) {
    return unresolved(
      'the premine output has moved since the etch — tracing a Rune transfer requires a Rune-aware indexer, not yet wired in',
      { runeName, divisibility, outputIndex, source: outspend.source },
    );
  }

  return {
    resolved: true,
    amount: rawPremine / Math.pow(10, divisibility),
    runeName,
    divisibility,
    outputIndex,
    source: outspend.source,
    checkedAt: outspend.checkedAt,
    reason: null,
  };
}
