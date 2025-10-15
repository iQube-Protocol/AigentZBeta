import { IDL } from '@dfinity/candid';

export const dbcIDL = ({ IDL: I = IDL }) => {
  const Bytes = I.Vec(I.Nat8);
  return I.Service({
    submit_dispute: I.Func([I.Text, I.Text], [I.Text], []),
    issue_exoneration: I.Func([Bytes, I.Text, I.Text], [], []),
    get_dispute_status: I.Func([I.Text], [I.Opt(I.Record({ status: I.Text, resolution: I.Text }))], ['query'])
  });
};

export type DBCIDL = ReturnType<typeof dbcIDL>;
