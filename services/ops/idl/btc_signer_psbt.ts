import { IDL } from '@dfinity/candid';

export const idlFactory = ({ IDL: I = IDL }) => {
  const BitcoinAddress = I.Record({
    address: I.Text,
    public_key: I.Vec(I.Nat8),
    derivation_path: I.Vec(I.Vec(I.Nat8)),
  });
  const UTXO = I.Record({
    txid: I.Text,
    vout: I.Nat32,
    amount: I.Nat64,
    script_pubkey: I.Vec(I.Nat8),
  });
  const TransactionInput = I.Record({
    utxo: UTXO,
    sequence: I.Nat32,
  });
  const TransactionOutput = I.Record({
    address: I.Text,
    amount: I.Nat64,
  });
  const UnsignedTransaction = I.Record({
    inputs: I.Vec(TransactionInput),
    outputs: I.Vec(TransactionOutput),
    locktime: I.Nat32,
  });
  const SignedTransaction = I.Record({
    txid: I.Text,
    raw_tx: I.Text,
    size: I.Nat32,
    fee: I.Nat64,
  });
  return I.Service({
    get_btc_address: I.Func([I.Vec(I.Vec(I.Nat8))], [I.Variant({ Ok: BitcoinAddress, Err: I.Text })], []),
    create_anchor_transaction: I.Func([I.Text, I.Vec(UTXO), I.Nat64], [I.Variant({ Ok: UnsignedTransaction, Err: I.Text })], []),
    sign_transaction: I.Func([UnsignedTransaction, I.Vec(I.Vec(I.Nat8))], [I.Variant({ Ok: SignedTransaction, Err: I.Text })], []),
    broadcast_transaction: I.Func([I.Text], [I.Variant({ Ok: I.Text, Err: I.Text })], []),
    get_transaction: I.Func([I.Text], [I.Opt(SignedTransaction)], ['query']),
    get_address_info: I.Func([I.Text], [I.Opt(BitcoinAddress)], ['query']),
    get_all_addresses: I.Func([], [I.Vec(BitcoinAddress)], ['query']),
  });
};

export type _SERVICE = Record<string, any>;
