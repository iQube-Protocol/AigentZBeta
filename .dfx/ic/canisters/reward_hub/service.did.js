export const idlFactory = ({ IDL }) => {
  const ApproveProposalRequest = IDL.Record({
    'signature' : IDL.Vec(IDL.Nat8),
    'comment' : IDL.Opt(IDL.Text),
    'approved' : IDL.Bool,
    'proposal_id' : IDL.Text,
    'approver_root_did' : IDL.Text,
  });
  const Approval = IDL.Record({
    'id' : IDL.Text,
    'signature' : IDL.Vec(IDL.Nat8),
    'created_at' : IDL.Nat64,
    'comment' : IDL.Text,
    'approved' : IDL.Bool,
    'proposal_id' : IDL.Text,
    'approver_root_did' : IDL.Text,
  });
  const ApprovalResponse = IDL.Record({
    'ok' : IDL.Bool,
    'data' : IDL.Opt(Approval),
    'error' : IDL.Opt(IDL.Text),
  });
  const CreateProposalRequest = IDL.Record({
    'period_end' : IDL.Nat64,
    'reputation_bucket' : IDL.Nat32,
    'proposer_root_did' : IDL.Text,
    'metadata' : IDL.Opt(IDL.Text),
    'period_start' : IDL.Nat64,
    'recipient_root_did' : IDL.Text,
    'tenant_id' : IDL.Text,
    'pokw_basis' : IDL.Nat64,
    'recipient_persona_id' : IDL.Text,
    'reputation_multiplier' : IDL.Float64,
    'amount' : IDL.Nat64,
    'token_type' : IDL.Text,
    'reason' : IDL.Text,
  });
  const RewardStatus = IDL.Variant({
    'Distributed' : IDL.Null,
    'Approved' : IDL.Null,
    'Rejected' : IDL.Null,
    'Proposed' : IDL.Null,
    'Cancelled' : IDL.Null,
  });
  const RewardProposal = IDL.Record({
    'id' : IDL.Text,
    'status' : RewardStatus,
    'updated_at' : IDL.Nat64,
    'period_end' : IDL.Nat64,
    'reputation_bucket' : IDL.Nat32,
    'proposer_root_did' : IDL.Text,
    'metadata' : IDL.Text,
    'period_start' : IDL.Nat64,
    'created_at' : IDL.Nat64,
    'recipient_root_did' : IDL.Text,
    'tenant_id' : IDL.Text,
    'pokw_basis' : IDL.Nat64,
    'recipient_persona_id' : IDL.Text,
    'reputation_multiplier' : IDL.Float64,
    'amount' : IDL.Nat64,
    'token_type' : IDL.Text,
    'reason' : IDL.Text,
  });
  const ProposalResponse = IDL.Record({
    'ok' : IDL.Bool,
    'data' : IDL.Opt(RewardProposal),
    'error' : IDL.Opt(IDL.Text),
  });
  const DistributeRewardRequest = IDL.Record({
    'dvn_message_id' : IDL.Opt(IDL.Text),
    'distributor_root_did' : IDL.Text,
    'chain_id' : IDL.Nat32,
    'proposal_id' : IDL.Text,
    'tx_hash' : IDL.Text,
  });
  const Distribution = IDL.Record({
    'id' : IDL.Text,
    'verified' : IDL.Bool,
    'dvn_message_id' : IDL.Text,
    'distributor_root_did' : IDL.Text,
    'distributed_at' : IDL.Nat64,
    'chain_id' : IDL.Nat32,
    'proposal_id' : IDL.Text,
    'tx_hash' : IDL.Text,
  });
  const DistributionResponse = IDL.Record({
    'ok' : IDL.Bool,
    'data' : IDL.Opt(Distribution),
    'error' : IDL.Opt(IDL.Text),
  });
  const ProposalsListResponse = IDL.Record({
    'ok' : IDL.Bool,
    'data' : IDL.Opt(IDL.Vec(RewardProposal)),
    'error' : IDL.Opt(IDL.Text),
  });
  return IDL.Service({
    'add_uber_admin' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'approve_proposal' : IDL.Func(
        [ApproveProposalRequest],
        [ApprovalResponse],
        [],
      ),
    'create_proposal' : IDL.Func(
        [CreateProposalRequest],
        [ProposalResponse],
        [],
      ),
    'distribute_reward' : IDL.Func(
        [DistributeRewardRequest],
        [DistributionResponse],
        [],
      ),
    'get_config' : IDL.Func(
        [],
        [IDL.Tuple(IDL.Nat32, IDL.Vec(IDL.Text))],
        ['query'],
      ),
    'get_distribution' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(Distribution)],
        ['query'],
      ),
    'get_proposal' : IDL.Func([IDL.Text], [ProposalResponse], ['query']),
    'get_proposal_approvals' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(Approval)],
        ['query'],
      ),
    'get_proposals_by_recipient' : IDL.Func(
        [IDL.Text],
        [ProposalsListResponse],
        ['query'],
      ),
    'get_proposals_by_status' : IDL.Func(
        [IDL.Text],
        [ProposalsListResponse],
        ['query'],
      ),
    'health' : IDL.Func([], [IDL.Text], ['query']),
    'set_required_approvals' : IDL.Func([IDL.Nat32], [IDL.Bool], []),
    'verify_distribution' : IDL.Func(
        [IDL.Text, IDL.Bool],
        [DistributionResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
