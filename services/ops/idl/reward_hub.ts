/**
 * RewardHub Canister IDL
 * 
 * TypeScript interface for the RewardHub canister.
 * Used for reward proposal, approval, and distribution tracking.
 */

import { IDL } from '@dfinity/candid';

export const idlFactory = ({ IDL: I = IDL }) => {
  const RewardStatus = I.Variant({
    Proposed: I.Null,
    Approved: I.Null,
    Rejected: I.Null,
    Distributed: I.Null,
    Cancelled: I.Null,
  });

  const RewardProposal = I.Record({
    id: I.Text,
    proposer_root_did: I.Text,
    recipient_root_did: I.Text,
    recipient_persona_id: I.Text,
    tenant_id: I.Text,
    amount: I.Nat64,
    token_type: I.Text,
    pokw_basis: I.Nat64,
    reputation_bucket: I.Nat32,
    reputation_multiplier: I.Float64,
    period_start: I.Nat64,
    period_end: I.Nat64,
    status: RewardStatus,
    reason: I.Text,
    metadata: I.Text,
    created_at: I.Nat64,
    updated_at: I.Nat64,
  });

  const Approval = I.Record({
    id: I.Text,
    proposal_id: I.Text,
    approver_root_did: I.Text,
    approved: I.Bool,
    comment: I.Text,
    signature: I.Vec(I.Nat8),
    created_at: I.Nat64,
  });

  const Distribution = I.Record({
    id: I.Text,
    proposal_id: I.Text,
    distributor_root_did: I.Text,
    tx_hash: I.Text,
    chain_id: I.Nat32,
    dvn_message_id: I.Text,
    verified: I.Bool,
    distributed_at: I.Nat64,
  });

  const CreateProposalRequest = I.Record({
    proposer_root_did: I.Text,
    recipient_root_did: I.Text,
    recipient_persona_id: I.Text,
    tenant_id: I.Text,
    amount: I.Nat64,
    token_type: I.Text,
    pokw_basis: I.Nat64,
    reputation_bucket: I.Nat32,
    reputation_multiplier: I.Float64,
    period_start: I.Nat64,
    period_end: I.Nat64,
    reason: I.Text,
    metadata: I.Opt(I.Text),
  });

  const ApproveProposalRequest = I.Record({
    proposal_id: I.Text,
    approver_root_did: I.Text,
    approved: I.Bool,
    comment: I.Opt(I.Text),
    signature: I.Vec(I.Nat8),
  });

  const DistributeRewardRequest = I.Record({
    proposal_id: I.Text,
    distributor_root_did: I.Text,
    tx_hash: I.Text,
    chain_id: I.Nat32,
    dvn_message_id: I.Opt(I.Text),
  });

  const ProposalResponse = I.Record({
    ok: I.Bool,
    data: I.Opt(RewardProposal),
    error: I.Opt(I.Text),
  });

  const ProposalsListResponse = I.Record({
    ok: I.Bool,
    data: I.Opt(I.Vec(RewardProposal)),
    error: I.Opt(I.Text),
  });

  const ApprovalResponse = I.Record({
    ok: I.Bool,
    data: I.Opt(Approval),
    error: I.Opt(I.Text),
  });

  const DistributionResponse = I.Record({
    ok: I.Bool,
    data: I.Opt(Distribution),
    error: I.Opt(I.Text),
  });

  return I.Service({
    // Query methods
    health: I.Func([], [I.Text], ['query']),
    get_proposal: I.Func([I.Text], [ProposalResponse], ['query']),
    get_proposals_by_status: I.Func([I.Text], [ProposalsListResponse], ['query']),
    get_proposals_by_recipient: I.Func([I.Text], [ProposalsListResponse], ['query']),
    get_proposal_approvals: I.Func([I.Text], [I.Vec(Approval)], ['query']),
    get_distribution: I.Func([I.Text], [I.Opt(Distribution)], ['query']),
    get_config: I.Func([], [I.Tuple(I.Nat32, I.Vec(I.Text))], ['query']),

    // Update methods
    create_proposal: I.Func([CreateProposalRequest], [ProposalResponse], []),
    approve_proposal: I.Func([ApproveProposalRequest], [ApprovalResponse], []),
    distribute_reward: I.Func([DistributeRewardRequest], [DistributionResponse], []),
    verify_distribution: I.Func([I.Text, I.Bool], [DistributionResponse], []),

    // Admin methods
    add_uber_admin: I.Func([I.Text], [I.Bool], []),
    set_required_approvals: I.Func([I.Nat32], [I.Bool], []),
  });
};

export type RewardHubService = {
  health: () => Promise<string>;
  get_proposal: (id: string) => Promise<{
    ok: boolean;
    data: any | null;
    error: string | null;
  }>;
  get_proposals_by_status: (status: string) => Promise<{
    ok: boolean;
    data: any[] | null;
    error: string | null;
  }>;
  get_proposals_by_recipient: (rootDid: string) => Promise<{
    ok: boolean;
    data: any[] | null;
    error: string | null;
  }>;
  get_proposal_approvals: (proposalId: string) => Promise<any[]>;
  get_distribution: (proposalId: string) => Promise<any | null>;
  get_config: () => Promise<[number, string[]]>;
  create_proposal: (request: any) => Promise<{
    ok: boolean;
    data: any | null;
    error: string | null;
  }>;
  approve_proposal: (request: any) => Promise<{
    ok: boolean;
    data: any | null;
    error: string | null;
  }>;
  distribute_reward: (request: any) => Promise<{
    ok: boolean;
    data: any | null;
    error: string | null;
  }>;
  verify_distribution: (id: string, verified: boolean) => Promise<{
    ok: boolean;
    data: any | null;
    error: string | null;
  }>;
  add_uber_admin: (rootDid: string) => Promise<boolean>;
  set_required_approvals: (count: number) => Promise<boolean>;
};

// Keep backward compatibility
export const rewardHubIDL = idlFactory;
