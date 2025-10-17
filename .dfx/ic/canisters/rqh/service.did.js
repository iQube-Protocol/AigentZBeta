export const idlFactory = ({ IDL }) => {
  const AddEvidenceRequest = IDL.Record({
    'weight' : IDL.Float64,
    'evidence_data' : IDL.Text,
    'evidence_type' : IDL.Text,
    'bucket_id' : IDL.Text,
  });
  const ReputationBucket = IDL.Record({
    'id' : IDL.Text,
    'skill_category' : IDL.Text,
    'partition_id' : IDL.Text,
    'last_updated' : IDL.Nat64,
    'created_at' : IDL.Nat64,
    'score' : IDL.Float64,
    'evidence_count' : IDL.Nat32,
    'bucket' : IDL.Nat32,
  });
  const ReputationResponse = IDL.Record({
    'ok' : IDL.Bool,
    'data' : IDL.Opt(ReputationBucket),
    'error' : IDL.Opt(IDL.Text),
  });
  const CreateReputationRequest = IDL.Record({
    'skill_category' : IDL.Text,
    'initial_score' : IDL.Opt(IDL.Float64),
    'partition_id' : IDL.Text,
  });
  const ReputationEvidence = IDL.Record({
    'id' : IDL.Text,
    'weight' : IDL.Float64,
    'evidence_data' : IDL.Text,
    'evidence_type' : IDL.Text,
    'verified' : IDL.Bool,
    'bucket_id' : IDL.Text,
    'created_at' : IDL.Nat64,
  });
  const EvidenceResponse = IDL.Record({
    'ok' : IDL.Bool,
    'data' : IDL.Opt(IDL.Vec(ReputationEvidence)),
    'error' : IDL.Opt(IDL.Text),
  });
  return IDL.Service({
    'add_reputation_evidence' : IDL.Func(
        [AddEvidenceRequest],
        [ReputationResponse],
        [],
      ),
    'create_reputation_bucket' : IDL.Func(
        [CreateReputationRequest],
        [ReputationResponse],
        [],
      ),
    'get_partition_reputation' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(ReputationBucket)],
        ['query'],
      ),
    'get_reputation_bucket' : IDL.Func(
        [IDL.Text],
        [ReputationResponse],
        ['query'],
      ),
    'get_reputation_evidence' : IDL.Func(
        [IDL.Text],
        [EvidenceResponse],
        ['query'],
      ),
    'health' : IDL.Func([], [IDL.Text], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
