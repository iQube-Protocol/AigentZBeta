import { IDL } from '@dfinity/candid';

export const rqhIDL = ({ IDL: I = IDL }) => {
  const ReputationBucket = I.Record({
    id: I.Text,
    partition_id: I.Text,
    bucket: I.Nat32,
    skill_category: I.Text,
    score: I.Float64,
    evidence_count: I.Nat32,
    last_updated: I.Nat64,
    created_at: I.Nat64,
  });

  const ReputationEvidence = I.Record({
    id: I.Text,
    bucket_id: I.Text,
    evidence_type: I.Text,
    evidence_data: I.Text,
    weight: I.Float64,
    verified: I.Bool,
    created_at: I.Nat64,
  });

  const CreateReputationRequest = I.Record({
    partition_id: I.Text,
    skill_category: I.Text,
    initial_score: I.Opt(I.Float64),
  });

  const AddEvidenceRequest = I.Record({
    bucket_id: I.Text,
    evidence_type: I.Text,
    evidence_data: I.Text,
    weight: I.Float64,
  });

  const ReputationResponse = I.Record({
    ok: I.Bool,
    data: I.Opt(ReputationBucket),
    error: I.Opt(I.Text),
  });

  const EvidenceResponse = I.Record({
    ok: I.Bool,
    data: I.Opt(I.Vec(ReputationEvidence)),
    error: I.Opt(I.Text),
  });

  return I.Service({
    // Query methods
    get_reputation_bucket: I.Func([I.Text], [ReputationResponse], ['query']),
    get_reputation_evidence: I.Func([I.Text], [EvidenceResponse], ['query']),
    get_partition_reputation: I.Func([I.Text], [I.Vec(ReputationBucket)], ['query']),
    health: I.Func([], [I.Text], ['query']),
    
    // Update methods
    create_reputation_bucket: I.Func([CreateReputationRequest], [ReputationResponse], []),
    add_reputation_evidence: I.Func([AddEvidenceRequest], [ReputationResponse], []),
  });
};

export type RQHIDL = ReturnType<typeof rqhIDL>;
