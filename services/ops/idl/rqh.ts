import { IDL } from '@dfinity/candid';

export const rqhIDL = ({ IDL: I = IDL }) => {
  const Bytes = I.Vec(I.Nat8);
  const BucketProof = I.Record({ bucket: I.Nat8, ts: I.Nat64, sig: Bytes });
  return I.Service({
    present_bucket: I.Func([Bytes], [BucketProof], ['query']),
    present_score: I.Func([Bytes], [I.Record({ score: I.Nat16, ts: I.Nat64, sig: Bytes })], ['query']),
    cron_ingest_mailbox: I.Func([], [], []),
    update_partition: I.Func([Bytes, I.Text], [], [])
  });
};

export type RQHIDL = ReturnType<typeof rqhIDL>;
