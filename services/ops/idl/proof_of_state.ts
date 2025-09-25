import { IDL } from '@dfinity/candid';

// IDL aligned with iQubeBeta-Program sdk-js index.ts
export const idlFactory = ({ IDL: I = IDL }) => {
  const Receipt = I.Record({
    id: I.Text,
    data_hash: I.Text,
    timestamp: I.Nat64,
    merkle_proof: I.Vec(I.Text),
  });
  const MerkleBatch = I.Record({
    root: I.Text,
    receipts: I.Vec(Receipt),
    created_at: I.Nat64,
    btc_anchor_txid: I.Opt(I.Text),
    btc_block_height: I.Opt(I.Nat64),
  });
  const BurnState = I.Record({
    receipt_id: I.Text,
    message_id: I.Text,
    burned: I.Bool,
    timestamp: I.Nat64,
  });
  return I.Service({
    issue_receipt: I.Func([I.Text], [I.Text], []),
    batch: I.Func([], [I.Text], []),
    batch_now: I.Func([], [I.Text], []),
    anchor: I.Func([], [I.Text], []),
    fast_anchor: I.Func([], [I.Text], []),
    get_receipt: I.Func([I.Text], [I.Opt(Receipt)], ['query']),
    get_batches: I.Func([], [I.Vec(MerkleBatch)], ['query']),
    get_pending_count: I.Func([], [I.Nat64], ['query']),
    get_last_anchor: I.Func([], [I.Opt(I.Text)], ['query']),
    get_anchor_status: I.Func([], [I.Text], ['query']),
    set_burn_state: I.Func([I.Text, I.Text, I.Bool], [I.Text], []),
    get_burn_state: I.Func([I.Text], [I.Opt(BurnState)], ['query']),
  });
};

export type _SERVICE = {
  issue_receipt: (data_hash: string) => Promise<string>;
  batch: () => Promise<string>;
  batch_now: () => Promise<string>;
  anchor: () => Promise<string>;
  fast_anchor: () => Promise<string>;
  get_receipt: (receipt_id: string) => Promise<[] | [{
    id: string;
    data_hash: string;
    timestamp: bigint;
    merkle_proof: string[];
  }]>;
  get_batches: () => Promise<Array<{
    root: string;
    receipts: Array<{ id: string; data_hash: string; timestamp: bigint; merkle_proof: string[] }>;
    created_at: bigint;
    btc_anchor_txid: [] | [string];
    btc_block_height: [] | [bigint];
  }>>;
  get_pending_count: () => Promise<bigint>;
  get_last_anchor: () => Promise<[] | [string]>;
  get_anchor_status: () => Promise<string>;
  set_burn_state: (receipt_id: string, message_id: string, burned: boolean) => Promise<string>;
  get_burn_state: (receipt_id: string) => Promise<[] | [{
    receipt_id: string;
    message_id: string;
    burned: boolean;
    timestamp: bigint;
  }]>;
};
