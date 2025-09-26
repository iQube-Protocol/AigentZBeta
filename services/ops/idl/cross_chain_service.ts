import { IDL } from '@dfinity/candid';

export const idlFactory = ({ IDL: I = IDL }) => {
  const DVNMessage = I.Record({
    id: I.Text,
    source_chain: I.Nat32,
    destination_chain: I.Nat32,
    payload: I.Vec(I.Nat8),
    nonce: I.Nat64,
    sender: I.Text,
    timestamp: I.Nat64,
  });
  const Attestation = I.Record({
    validator: I.Text,
    signature: I.Vec(I.Nat8),
    timestamp: I.Nat64,
  });
  return I.Service({
    get_pending_messages: I.Func([], [I.Vec(DVNMessage)], ['query']),
    get_ready_messages: I.Func([], [I.Vec(DVNMessage)], ['query']),
    submit_dvn_message: I.Func([I.Nat32, I.Nat32, I.Vec(I.Nat8), I.Text], [I.Text], []),
    get_dvn_message: I.Func([I.Text], [I.Opt(DVNMessage)], ['query']),
    get_message_attestations: I.Func([I.Text], [I.Vec(Attestation)], ['query']),
    submit_attestation: I.Func([I.Text, I.Text, I.Vec(I.Nat8)], [I.Variant({ Ok: I.Text, Err: I.Text })], []),
    monitor_evm_transaction: I.Func([I.Nat32, I.Text, I.Text], [I.Variant({ Ok: I.Text, Err: I.Text })], []),
    verify_layerzero_message: I.Func([I.Nat32, I.Text, I.Text], [I.Variant({ Ok: I.Bool, Err: I.Text })], []),
  });
};

export type _SERVICE = {
  get_pending_messages: () => Promise<Array<any>>;
  get_ready_messages: () => Promise<Array<any>>;
};
