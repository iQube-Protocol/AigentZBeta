import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Approval {
  'id' : string,
  'signature' : Uint8Array | number[],
  'created_at' : bigint,
  'comment' : string,
  'approved' : boolean,
  'proposal_id' : string,
  'approver_root_did' : string,
}
export interface ApprovalResponse {
  'ok' : boolean,
  'data' : [] | [Approval],
  'error' : [] | [string],
}
export interface ApproveProposalRequest {
  'signature' : Uint8Array | number[],
  'comment' : [] | [string],
  'approved' : boolean,
  'proposal_id' : string,
  'approver_root_did' : string,
}
export interface CreateProposalRequest {
  'period_end' : bigint,
  'reputation_bucket' : number,
  'proposer_root_did' : string,
  'metadata' : [] | [string],
  'period_start' : bigint,
  'recipient_root_did' : string,
  'tenant_id' : string,
  'pokw_basis' : bigint,
  'recipient_persona_id' : string,
  'reputation_multiplier' : number,
  'amount' : bigint,
  'token_type' : string,
  'reason' : string,
}
export interface DistributeRewardRequest {
  'dvn_message_id' : [] | [string],
  'distributor_root_did' : string,
  'chain_id' : number,
  'proposal_id' : string,
  'tx_hash' : string,
}
export interface Distribution {
  'id' : string,
  'verified' : boolean,
  'dvn_message_id' : string,
  'distributor_root_did' : string,
  'distributed_at' : bigint,
  'chain_id' : number,
  'proposal_id' : string,
  'tx_hash' : string,
}
export interface DistributionResponse {
  'ok' : boolean,
  'data' : [] | [Distribution],
  'error' : [] | [string],
}
export interface ProposalResponse {
  'ok' : boolean,
  'data' : [] | [RewardProposal],
  'error' : [] | [string],
}
export interface ProposalsListResponse {
  'ok' : boolean,
  'data' : [] | [Array<RewardProposal>],
  'error' : [] | [string],
}
export interface RewardProposal {
  'id' : string,
  'status' : RewardStatus,
  'updated_at' : bigint,
  'period_end' : bigint,
  'reputation_bucket' : number,
  'proposer_root_did' : string,
  'metadata' : string,
  'period_start' : bigint,
  'created_at' : bigint,
  'recipient_root_did' : string,
  'tenant_id' : string,
  'pokw_basis' : bigint,
  'recipient_persona_id' : string,
  'reputation_multiplier' : number,
  'amount' : bigint,
  'token_type' : string,
  'reason' : string,
}
export type RewardStatus = { 'Distributed' : null } |
  { 'Approved' : null } |
  { 'Rejected' : null } |
  { 'Proposed' : null } |
  { 'Cancelled' : null };
export interface _SERVICE {
  /**
   * Admin methods
   */
  'add_uber_admin' : ActorMethod<[string], boolean>,
  'approve_proposal' : ActorMethod<[ApproveProposalRequest], ApprovalResponse>,
  /**
   * Update methods
   */
  'create_proposal' : ActorMethod<[CreateProposalRequest], ProposalResponse>,
  'distribute_reward' : ActorMethod<
    [DistributeRewardRequest],
    DistributionResponse
  >,
  'get_config' : ActorMethod<[], [number, Array<string>]>,
  'get_distribution' : ActorMethod<[string], [] | [Distribution]>,
  'get_proposal' : ActorMethod<[string], ProposalResponse>,
  'get_proposal_approvals' : ActorMethod<[string], Array<Approval>>,
  'get_proposals_by_recipient' : ActorMethod<[string], ProposalsListResponse>,
  'get_proposals_by_status' : ActorMethod<[string], ProposalsListResponse>,
  /**
   * Query methods
   */
  'health' : ActorMethod<[], string>,
  'set_required_approvals' : ActorMethod<[number], boolean>,
  'verify_distribution' : ActorMethod<[string, boolean], DistributionResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
