import { IDL } from '@dfinity/candid';

export const fbcIDL = ({ IDL: I = IDL }) => {
  const Bytes = I.Vec(I.Nat8);
  const CohortFlag = I.Record({
    epoch: I.Nat32,
    cohort_id: Bytes,
    rule: I.Text,
    severity: I.Nat8,
    evidence_ptr: I.Text,
    status: I.Text
  });
  return I.Service({
    append_cohort_flag: I.Func([CohortFlag], [I.Text], []),
    update_flag_status: I.Func([I.Text, I.Text], [], []),
    get_cohort_flags: I.Func([Bytes], [I.Vec(CohortFlag)], ['query'])
  });
};

export type FBCIDL = ReturnType<typeof fbcIDL>;
