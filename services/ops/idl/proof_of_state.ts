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
  return I.Service({
    get_pending_count: I.Func([], [I.Nat64], ['query']),
    get_batches: I.Func([], [I.Vec(MerkleBatch)], ['query']),
  });
};

export type _SERVICE = {
  get_pending_count: () => Promise<bigint>;
  get_batches: () => Promise<Array<{
    root: string;
    receipts: Array<{ id: string; data_hash: string; timestamp: bigint; merkle_proof: string[] }>;
    created_at: bigint;
    btc_anchor_txid: [] | [string];
    btc_block_height: [] | [bigint];
  }>>;
};
