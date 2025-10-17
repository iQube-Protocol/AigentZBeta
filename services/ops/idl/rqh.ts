import { IDL } from '@dfinity/candid';

export const idlFactory = ({ IDL }: { IDL: any }) => {
  const ReputationBucket = IDL.Record({
    id: IDL.Text,
    partition_id: IDL.Text,
    bucket: IDL.Nat32,
    skill_category: IDL.Text,
    score: IDL.Float64,
    evidence_count: IDL.Nat32,
    last_updated: IDL.Nat64,
    created_at: IDL.Nat64,
  });

  const ReputationEvidence = IDL.Record({
    id: IDL.Text,
    bucket_id: IDL.Text,
    evidence_type: IDL.Text,
    evidence_data: IDL.Text,
    weight: IDL.Float64,
    verified: IDL.Bool,
    created_at: IDL.Nat64,
  });

  const CreateReputationRequest = IDL.Record({
    partition_id: IDL.Text,
    skill_category: IDL.Text,
    initial_score: IDL.Opt(IDL.Float64),
  });

  const AddEvidenceRequest = IDL.Record({
    bucket_id: IDL.Text,
    evidence_type: IDL.Text,
    evidence_data: IDL.Text,
    weight: IDL.Float64,
  });

  const ReputationResponse = IDL.Record({
    ok: IDL.Bool,
    data: IDL.Opt(ReputationBucket),
    error: IDL.Opt(IDL.Text),
  });

  const EvidenceResponse = IDL.Record({
    ok: IDL.Bool,
    data: IDL.Opt(IDL.Vec(ReputationEvidence)),
    error: IDL.Opt(IDL.Text),
  });

  return IDL.Service({
    // Query methods
    get_reputation_bucket: IDL.Func([IDL.Text], [ReputationResponse], ['query']),
    get_reputation_evidence: IDL.Func([IDL.Text], [EvidenceResponse], ['query']),
    get_partition_reputation: IDL.Func([IDL.Text], [IDL.Vec(ReputationBucket)], ['query']),
    health: IDL.Func([], [IDL.Text], ['query']),
    
    // Update methods
    create_reputation_bucket: IDL.Func([CreateReputationRequest], [ReputationResponse], []),
    add_reputation_evidence: IDL.Func([AddEvidenceRequest], [ReputationResponse], []),
  });
};

// Keep backward compatibility
export const rqhIDL = idlFactory;
export type RQHIDL = ReturnType<typeof idlFactory>;
