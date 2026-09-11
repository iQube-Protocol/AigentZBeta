/**
 * `proof_of_state_v2` — CAP-1 constitutional Proof-of-State binding.
 *
 * Mirrors `services/ops/idl/proof_of_state_v2.did`, copied from the canonical
 * iQubeBeta-Program source at commit
 * 7387fc1a1ecb58ffd7f81d15c9fe5b51d19b0d7c. The binding is deliberately
 * separate from the legacy `proof_of_state` interface: the v2 canister is a
 * new deployment and the legacy canister remains immutable historical state.
 */

export const idlFactory = ({ IDL }: any) => {
  const Side = IDL.Variant({ Left: IDL.Null, Right: IDL.Null });
  const ProofStep = IDL.Variant({
    Sibling: IDL.Record({ hash_hex: IDL.Text, side: Side }),
    Promoted: IDL.Null,
  });
  const BatchAnchorState = IDL.Variant({
    Anchored: IDL.Record({ confirmations: IDL.Nat32, txid: IDL.Text, block_height: IDL.Nat64 }),
    AnchorRequested: IDL.Record({ txid: IDL.Text }),
    Unanchored: IDL.Null,
  });
  const BatchV2 = IDL.Record({
    h_hexes: IDL.Vec(IDL.Text),
    anchor_state: BatchAnchorState,
    created_at_ns: IDL.Nat64,
    root_hex: IDL.Text,
  });
  const ReceiptV2 = IDL.Record({
    h_hex: IDL.Text,
    leaf_hex: IDL.Text,
    issued_at_ns: IDL.Nat64,
    inclusion_proof: IDL.Vec(ProofStep),
    batch_root_hex: IDL.Opt(IDL.Text),
  });
  const BatchResult = IDL.Variant({ Ok: BatchV2, Err: IDL.Text });
  const ReceiptResult = IDL.Variant({ Ok: ReceiptV2, Err: IDL.Text });
  const ConfirmationResult = IDL.Variant({ Ok: BatchAnchorState, Err: IDL.Text });
  const TextResult = IDL.Variant({ Ok: IDL.Text, Err: IDL.Text });
  const BoolResult = IDL.Variant({ Ok: IDL.Bool, Err: IDL.Text });

  return IDL.Service({
    batch_now: IDL.Func([], [BatchResult], []),
    get_batch: IDL.Func([IDL.Text], [IDL.Opt(BatchV2)], ['query']),
    get_config: IDL.Func([], [IDL.Opt(IDL.Tuple(IDL.Text, IDL.Text, IDL.Text, IDL.Nat32))], ['query']),
    get_pending_count: IDL.Func([], [IDL.Nat64], ['query']),
    get_receipt: IDL.Func([IDL.Text], [IDL.Opt(ReceiptV2)], ['query']),
    issue_receipt: IDL.Func([IDL.Text], [ReceiptResult], []),
    record_confirmation: IDL.Func([IDL.Text, IDL.Text, IDL.Nat64, IDL.Nat32], [ConfirmationResult], []),
    request_anchor: IDL.Func([IDL.Text], [TextResult], []),
    verify_receipt: IDL.Func([IDL.Text], [BoolResult], ['query']),
  });
};

export const init = ({ IDL }: any) => [
  IDL.Record({
    authorized_operator_principal: IDL.Principal,
    authorized_reconciler_principal: IDL.Principal,
    anchor_signer_principal: IDL.Principal,
    min_confirmations: IDL.Nat32,
  }),
];

export type Side = { Left: null } | { Right: null };
export type ProofStep =
  | { Sibling: { hash_hex: string; side: Side } }
  | { Promoted: null };
export type BatchAnchorState =
  | { Anchored: { confirmations: number; txid: string; block_height: bigint } }
  | { AnchorRequested: { txid: string } }
  | { Unanchored: null };
export interface BatchV2 {
  h_hexes: string[];
  anchor_state: BatchAnchorState;
  created_at_ns: bigint;
  root_hex: string;
}
export interface ReceiptV2 {
  h_hex: string;
  leaf_hex: string;
  issued_at_ns: bigint;
  inclusion_proof: ProofStep[];
  batch_root_hex: [] | [string];
}
export type Result<T> = { Ok: T } | { Err: string };

export interface ProofOfStateV2Service {
  batch_now: () => Promise<Result<BatchV2>>;
  get_batch: (rootHex: string) => Promise<[] | [BatchV2]>;
  get_config: () => Promise<[] | [[string, string, string, number]]>;
  get_pending_count: () => Promise<bigint>;
  get_receipt: (hHex: string) => Promise<[] | [ReceiptV2]>;
  issue_receipt: (hHex: string) => Promise<Result<ReceiptV2>>;
  record_confirmation: (
    rootHex: string,
    observedTxid: string,
    blockHeight: bigint,
    confirmations: number,
  ) => Promise<Result<BatchAnchorState>>;
  request_anchor: (rootHex: string) => Promise<Result<string>>;
  verify_receipt: (hHex: string) => Promise<Result<boolean>>;
}
