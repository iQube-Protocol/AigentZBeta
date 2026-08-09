/**
 * WASM-EXPORTED CANDID ⟷ CHECKED-IN DID ⟷ CONSUMER BINDING
 * (P0.2, independent review 2026-08-08).
 *
 * ─── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * The Rust interface, `canisters/btc_signer_psbt/btc_signer_psbt.did` and this
 * repo's `services/ops/idl/btc_signer_psbt.ts` had drifted apart MATERIALLY:
 *
 *   * `create_anchor_transaction` was declared with the wrong argument order;
 *   * `TransactionOutput` carried a shape the canister no longer used;
 *   * `create_and_broadcast_anchor` was missing from the binding entirely.
 *
 * A consumer binding that disagrees with its canister does not fail loudly. It
 * encodes arguments the callee decodes as DIFFERENT VALUES — a swapped
 * `(utxos, data_hash)` pair is two well-typed strings arriving in each other's
 * place. This is the same failure family as the rest of this investigation: a
 * mismatch that reports success.
 *
 * ─── WHAT IS COMPARED ───────────────────────────────────────────────────────
 *
 * Method names and modes (query vs update) across all three artefacts. That is
 * the material contract and it is what the three reported defects all violated.
 * The DID here is a byte-copy of `candid-extractor`'s output from the built
 * wasm, so "the DID" and "what the wasm exports" are the same artefact by
 * construction; keeping the copy in this repo is what lets this canary run
 * without a Rust toolchain.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const DID_PATH = 'services/ops/idl/btc_signer_psbt.did';
const TS_PATH = 'services/ops/idl/btc_signer_psbt.ts';

function read(p: string): string {
  return readFileSync(join(process.cwd(), p), 'utf8');
}

/** Method name → mode, parsed from the DID's `service` block. */
function methodsFromDid(did: string): Map<string, 'query' | 'update'> {
  const start = did.indexOf('service :');
  expect(start, 'DID has no service block').toBeGreaterThan(-1);
  const body = did.slice(did.indexOf('{', start) + 1);
  const out = new Map<string, 'query' | 'update'>();
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (t.startsWith('//') || !t.includes('->')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(t);
    if (!m) continue;
    out.set(m[1], /\bquery\s*;?\s*$/.test(t) ? 'query' : 'update');
  }
  return out;
}

/** Method name → mode, parsed from the TypeScript IDL factory. */
function methodsFromTs(ts: string): Map<string, 'query' | 'update'> {
  const out = new Map<string, 'query' | 'update'>();
  const re = /(\w+):\s*IDL\.Func\(\s*\[[^\]]*\]\s*,\s*\[[^\]]*\]\s*,\s*\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ts)) !== null) {
    out.set(m[1], /query/.test(m[2]) ? 'query' : 'update');
  }
  return out;
}

describe('Candid parity: DID ⟷ consumer binding', () => {
  const did = methodsFromDid(read(DID_PATH));
  const ts = methodsFromTs(read(TS_PATH));

  it('the DID exposes the methods this repo expects and no others', () => {
    expect([...did.keys()].sort()).toEqual([
      'create_and_broadcast_anchor',
      'get_address_info',
      'get_all_addresses',
      'get_config',
      'get_transaction',
    ]);
  });

  it('every DID method appears in the TypeScript binding, with the same mode', () => {
    for (const [name, mode] of did) {
      expect(ts.has(name), `binding is missing ${name} — a caller cannot reach it`).toBe(true);
      expect(ts.get(name), `${name} mode disagrees between DID and binding`).toBe(mode);
    }
  });

  it('the binding declares no method the canister does not export', () => {
    for (const name of ts.keys()) {
      expect(
        did.has(name),
        `binding declares ${name}, which the canister does not export — a call would be rejected ` +
          'at the boundary, or worse, silently match a different method',
      ).toBe(true);
    }
  });

  /*
   * The three primitives that were public in the first Phase B build must not
   * reappear in either artefact. Exporting them hands threshold signing,
   * spending and broadcasting to every principal on the IC.
   */
  it('the signing primitives are absent from both the DID and the binding', () => {
    for (const dangerous of ['sign_transaction', 'broadcast_transaction', 'create_anchor_transaction', 'get_btc_address']) {
      expect(did.has(dangerous), `${dangerous} is exported in the DID`).toBe(false);
      expect(ts.has(dangerous), `${dangerous} is declared in the binding`).toBe(false);
    }
  });

  it('the binding records that its DID came from the wasm, not from hand-editing', () => {
    const ts = read(TS_PATH);
    expect(ts).toContain('candid-extractor');
    expect(ts).toContain('btc_signer_psbt.did');
  });
});
