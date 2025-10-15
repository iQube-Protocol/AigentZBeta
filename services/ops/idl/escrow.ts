import { IDL } from '@dfinity/candid';

export const escrowIDL = ({ IDL: I = IDL }) => {
  const Bytes = I.Vec(I.Nat8);
  const MailboxMsg = I.Record({ msg_type: I.Text, payload: Bytes, timestamp: I.Nat64 });
  return I.Service({
    register_alias: I.Func([Bytes, Bytes, I.Nat32], [], []),
    pull: I.Func([Bytes], [I.Vec(MailboxMsg)], ['query']),
    compute_cohort: I.Func([I.Nat32], [I.Vec(Bytes)], ['query']),
    purge_expired: I.Func([], [], [])
  });
};

export type EscrowIDL = ReturnType<typeof escrowIDL>;
