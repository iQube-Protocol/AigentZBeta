import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AddEvidenceRequest {
  'weight' : number,
  'evidence_data' : string,
  'evidence_type' : string,
  'bucket_id' : string,
}
export interface CreateReputationRequest {
  'skill_category' : string,
  'initial_score' : [] | [number],
  'partition_id' : string,
}
export interface EvidenceResponse {
  'ok' : boolean,
  'data' : [] | [Array<ReputationEvidence>],
  'error' : [] | [string],
}
export interface ReputationBucket {
  'id' : string,
  'skill_category' : string,
  'partition_id' : string,
  'last_updated' : bigint,
  'created_at' : bigint,
  'score' : number,
  'evidence_count' : number,
  'bucket' : number,
}
export interface ReputationEvidence {
  'id' : string,
  'weight' : number,
  'evidence_data' : string,
  'evidence_type' : string,
  'verified' : boolean,
  'bucket_id' : string,
  'created_at' : bigint,
}
export interface ReputationResponse {
  'ok' : boolean,
  'data' : [] | [ReputationBucket],
  'error' : [] | [string],
}
export interface _SERVICE {
  'add_reputation_evidence' : ActorMethod<
    [AddEvidenceRequest],
    ReputationResponse
  >,
  /**
   * Update methods
   */
  'create_reputation_bucket' : ActorMethod<
    [CreateReputationRequest],
    ReputationResponse
  >,
  'get_partition_reputation' : ActorMethod<[string], Array<ReputationBucket>>,
  /**
   * Query methods
   */
  'get_reputation_bucket' : ActorMethod<[string], ReputationResponse>,
  'get_reputation_evidence' : ActorMethod<[string], EvidenceResponse>,
  'health' : ActorMethod<[], string>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
