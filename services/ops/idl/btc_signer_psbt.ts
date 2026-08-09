/**
 * `btc_signer_psbt` — Constitutional Anchor v2 binding.
 *
 * ─── GENERATED FROM THE WASM, NOT HAND-WRITTEN ──────────────────────────────
 *
 * The previous binding disagreed with the canister MATERIALLY (independent
 * review, 2026-08-08): it declared `create_anchor_transaction` with the wrong
 * argument order, carried a `TransactionOutput` shape the canister no longer
 * uses, and was missing `create_and_broadcast_anchor` entirely. A consumer
 * binding that disagrees with its canister does not fail loudly — it encodes
 * arguments the callee reads as different values, which is how a fee rate can
 * arrive where a data hash was meant.
 *
 * This file mirrors `services/ops/idl/btc_signer_psbt.did`, which is a byte-
 * copy of the DID extracted from the built wasm with `candid-extractor`.
 * `tests/candid-binding-parity.test.ts` fails the build if the three ever
 * diverge again.
 *
 * ─── THE SIGNING SURFACE IS CLOSED ──────────────────────────────────────────
 *
 * `sign_transaction`, `broadcast_transaction` and `create_anchor_transaction`
 * are NOT here because they are no longer exported. They were public update
 * methods, which let any principal drive the canister's threshold key. The one
 * update method that remains is authorized to the configured proof_of_state
 * principal.
 */

export const idlFactory = ({ IDL }: any) => {
  const BitcoinAddress = IDL.Record({
    public_key: IDL.Vec(IDL.Nat8),
    derivation_path: IDL.Vec(IDL.Vec(IDL.Nat8)),
    address: IDL.Text,
  });
  const SignedTransaction = IDL.Record({
    fee: IDL.Nat64,
    size: IDL.Nat32,
    txid: IDL.Text,
    raw_tx: IDL.Text,
  });
  const Result = IDL.Variant({ Ok: IDL.Text, Err: IDL.Text });
  return IDL.Service({
    create_and_broadcast_anchor: IDL.Func([IDL.Text, IDL.Nat64], [Result], []),
    get_address_info: IDL.Func([IDL.Text], [IDL.Opt(BitcoinAddress)], ['query']),
    get_all_addresses: IDL.Func([], [IDL.Vec(BitcoinAddress)], ['query']),
    get_config: IDL.Func([], [IDL.Opt(IDL.Tuple(IDL.Text, IDL.Text, IDL.Text))], ['query']),
    get_transaction: IDL.Func([IDL.Text], [IDL.Opt(SignedTransaction)], ['query']),
  });
};

/** Init argument — every field required; the canister traps on a bad config. */
export const init = ({ IDL }: any) => [
  IDL.Record({
    ecdsa_key_name: IDL.Text,
    network: IDL.Text,
    authorized_pos_principal: IDL.Principal,
  }),
];

export interface BtcSignerService {
  /** Authorized to the configured proof_of_state principal only. */
  create_and_broadcast_anchor: (rootHex: string, feeRate: bigint) => Promise<{ Ok: string } | { Err: string }>;
  get_address_info: (address: string) => Promise<[] | [{ address: string; public_key: number[]; derivation_path: number[][] }]>;
  get_all_addresses: () => Promise<Array<{ address: string; public_key: number[]; derivation_path: number[][] }>>;
  /** [network, ecdsaKeyName, authorizedPosPrincipal] — public deployment facts. */
  get_config: () => Promise<[] | [[string, string, string]]>;
  get_transaction: (txid: string) => Promise<[] | [{ txid: string; raw_tx: string; size: number; fee: bigint }]>;
}
