/**
 * RewardHub Canister
 * 
 * Manages reward proposals, approvals, and distribution tracking for the AgentiQ ecosystem.
 * 
 * DiDQube Identity Policy:
 * - All reward operations require Root DID verification (not KybeDID or Persona)
 * - Root DID = deep identity for regulated/admin contexts
 * - Multi-sig approval workflow for reward distributions
 * 
 * Integration Points:
 * - ReputationHub (RQH): Fetches reputation data for reward calculations
 * - DVN: Cross-chain verification of reward distributions
 * - QubeBase: Syncs with CRM reward records
 */

use candid::{CandidType, Deserialize};
use ic_cdk::{query, update, api::time};
use serde::Serialize;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Bound,
    DefaultMemoryImpl, StableBTreeMap, Storable,
};
use std::borrow::Cow;
use std::cell::RefCell;

// ============================================================================
// MEMORY MANAGEMENT
// ============================================================================

type Memory = VirtualMemory<DefaultMemoryImpl>;

const PROPOSALS_MEM_ID: MemoryId = MemoryId::new(0);
const APPROVALS_MEM_ID: MemoryId = MemoryId::new(1);
const DISTRIBUTIONS_MEM_ID: MemoryId = MemoryId::new(2);
const CONFIG_MEM_ID: MemoryId = MemoryId::new(3);

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    static PROPOSALS: RefCell<StableBTreeMap<String, RewardProposal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(PROPOSALS_MEM_ID))
        )
    );

    static APPROVALS: RefCell<StableBTreeMap<String, Approval, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(APPROVALS_MEM_ID))
        )
    );

    static DISTRIBUTIONS: RefCell<StableBTreeMap<String, Distribution, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(DISTRIBUTIONS_MEM_ID))
        )
    );

    static NEXT_ID: RefCell<u64> = RefCell::new(1);
    static REQUIRED_APPROVALS: RefCell<u32> = RefCell::new(1); // Multi-sig threshold
    static UBER_ADMINS: RefCell<Vec<String>> = RefCell::new(Vec::new());
}

// ============================================================================
// DATA TYPES
// ============================================================================

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub enum RewardStatus {
    Proposed,
    Approved,
    Rejected,
    Distributed,
    Cancelled,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct RewardProposal {
    pub id: String,
    pub proposer_root_did: String,      // Root DID of proposer (per DiDQube policy)
    pub recipient_root_did: String,     // Root DID of recipient
    pub recipient_persona_id: String,   // CRM persona ID for reference
    pub tenant_id: String,
    pub amount: u64,                    // Amount in smallest unit
    pub token_type: String,             // QCT, USDC, etc.
    pub pokw_basis: u64,                // PoKW score basis
    pub reputation_bucket: u32,         // Reputation bucket (0-5)
    pub reputation_multiplier: f64,     // Applied multiplier
    pub period_start: u64,              // Reward period start (timestamp)
    pub period_end: u64,                // Reward period end (timestamp)
    pub status: RewardStatus,
    pub reason: String,                 // Reason for reward
    pub metadata: String,               // JSON metadata
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct Approval {
    pub id: String,
    pub proposal_id: String,
    pub approver_root_did: String,      // Root DID of approver
    pub approved: bool,                 // true = approve, false = reject
    pub comment: String,
    pub signature: Vec<u8>,             // Cryptographic signature
    pub created_at: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct Distribution {
    pub id: String,
    pub proposal_id: String,
    pub distributor_root_did: String,   // Root DID of distributor
    pub tx_hash: String,                // Blockchain transaction hash
    pub chain_id: u32,                  // Target chain ID
    pub dvn_message_id: String,         // DVN verification message ID
    pub verified: bool,
    pub distributed_at: u64,
}

// Storable implementations for stable storage
impl Storable for RewardProposal {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for Approval {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for Distribution {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: Bound = Bound::Unbounded;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

#[derive(CandidType, Deserialize)]
pub struct CreateProposalRequest {
    pub proposer_root_did: String,
    pub recipient_root_did: String,
    pub recipient_persona_id: String,
    pub tenant_id: String,
    pub amount: u64,
    pub token_type: String,
    pub pokw_basis: u64,
    pub reputation_bucket: u32,
    pub reputation_multiplier: f64,
    pub period_start: u64,
    pub period_end: u64,
    pub reason: String,
    pub metadata: Option<String>,
}

#[derive(CandidType, Deserialize)]
pub struct ApproveProposalRequest {
    pub proposal_id: String,
    pub approver_root_did: String,
    pub approved: bool,
    pub comment: Option<String>,
    pub signature: Vec<u8>,
}

#[derive(CandidType, Deserialize)]
pub struct DistributeRewardRequest {
    pub proposal_id: String,
    pub distributor_root_did: String,
    pub tx_hash: String,
    pub chain_id: u32,
    pub dvn_message_id: Option<String>,
}

#[derive(CandidType, Deserialize)]
pub struct ProposalResponse {
    pub ok: bool,
    pub data: Option<RewardProposal>,
    pub error: Option<String>,
}

#[derive(CandidType, Deserialize)]
pub struct ProposalsListResponse {
    pub ok: bool,
    pub data: Option<Vec<RewardProposal>>,
    pub error: Option<String>,
}

#[derive(CandidType, Deserialize)]
pub struct ApprovalResponse {
    pub ok: bool,
    pub data: Option<Approval>,
    pub error: Option<String>,
}

#[derive(CandidType, Deserialize)]
pub struct DistributionResponse {
    pub ok: bool,
    pub data: Option<Distribution>,
    pub error: Option<String>,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn next_id() -> u64 {
    NEXT_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    })
}

fn is_uber_admin(root_did: &str) -> bool {
    UBER_ADMINS.with(|admins| {
        admins.borrow().contains(&root_did.to_string())
    })
}

fn get_required_approvals() -> u32 {
    REQUIRED_APPROVALS.with(|r| *r.borrow())
}

fn count_approvals(proposal_id: &str) -> (u32, u32) {
    // Returns (approve_count, reject_count)
    APPROVALS.with(|approvals| {
        let approvals = approvals.borrow();
        let mut approve_count = 0u32;
        let mut reject_count = 0u32;
        
        for (_, approval) in approvals.iter() {
            if approval.proposal_id == proposal_id {
                if approval.approved {
                    approve_count += 1;
                } else {
                    reject_count += 1;
                }
            }
        }
        
        (approve_count, reject_count)
    })
}

// ============================================================================
// QUERY METHODS
// ============================================================================

#[query]
fn health() -> String {
    "RewardHub canister is healthy".to_string()
}

#[query]
fn get_proposal(proposal_id: String) -> ProposalResponse {
    PROPOSALS.with(|proposals| {
        match proposals.borrow().get(&proposal_id) {
            Some(proposal) => ProposalResponse {
                ok: true,
                data: Some(proposal),
                error: None,
            },
            None => ProposalResponse {
                ok: false,
                data: None,
                error: Some("Proposal not found".to_string()),
            },
        }
    })
}

#[query]
fn get_proposals_by_status(status: String) -> ProposalsListResponse {
    let target_status = match status.as_str() {
        "proposed" => RewardStatus::Proposed,
        "approved" => RewardStatus::Approved,
        "rejected" => RewardStatus::Rejected,
        "distributed" => RewardStatus::Distributed,
        "cancelled" => RewardStatus::Cancelled,
        _ => return ProposalsListResponse {
            ok: false,
            data: None,
            error: Some("Invalid status".to_string()),
        },
    };

    PROPOSALS.with(|proposals| {
        let proposals = proposals.borrow();
        let filtered: Vec<RewardProposal> = proposals
            .iter()
            .filter(|(_, p)| matches!((&p.status, &target_status), 
                (RewardStatus::Proposed, RewardStatus::Proposed) |
                (RewardStatus::Approved, RewardStatus::Approved) |
                (RewardStatus::Rejected, RewardStatus::Rejected) |
                (RewardStatus::Distributed, RewardStatus::Distributed) |
                (RewardStatus::Cancelled, RewardStatus::Cancelled)
            ))
            .map(|(_, p)| p)
            .collect();

        ProposalsListResponse {
            ok: true,
            data: Some(filtered),
            error: None,
        }
    })
}

#[query]
fn get_proposals_by_recipient(recipient_root_did: String) -> ProposalsListResponse {
    PROPOSALS.with(|proposals| {
        let proposals = proposals.borrow();
        let filtered: Vec<RewardProposal> = proposals
            .iter()
            .filter(|(_, p)| p.recipient_root_did == recipient_root_did)
            .map(|(_, p)| p)
            .collect();

        ProposalsListResponse {
            ok: true,
            data: Some(filtered),
            error: None,
        }
    })
}

#[query]
fn get_proposal_approvals(proposal_id: String) -> Vec<Approval> {
    APPROVALS.with(|approvals| {
        approvals
            .borrow()
            .iter()
            .filter(|(_, a)| a.proposal_id == proposal_id)
            .map(|(_, a)| a)
            .collect()
    })
}

#[query]
fn get_distribution(proposal_id: String) -> Option<Distribution> {
    DISTRIBUTIONS.with(|distributions| {
        distributions
            .borrow()
            .iter()
            .find(|(_, d)| d.proposal_id == proposal_id)
            .map(|(_, d)| d)
    })
}

// ============================================================================
// UPDATE METHODS
// ============================================================================

#[update]
fn create_proposal(request: CreateProposalRequest) -> ProposalResponse {
    let now = time();
    let id = format!("rwh_{}", next_id());

    // Validate Root DID format (per DiDQube policy)
    if !request.proposer_root_did.starts_with("did:root:") && 
       !request.proposer_root_did.starts_with("did:") {
        return ProposalResponse {
            ok: false,
            data: None,
            error: Some("proposer_root_did must be a valid Root DID (did:root:...)".to_string()),
        };
    }

    let proposal = RewardProposal {
        id: id.clone(),
        proposer_root_did: request.proposer_root_did,
        recipient_root_did: request.recipient_root_did,
        recipient_persona_id: request.recipient_persona_id,
        tenant_id: request.tenant_id,
        amount: request.amount,
        token_type: request.token_type,
        pokw_basis: request.pokw_basis,
        reputation_bucket: request.reputation_bucket,
        reputation_multiplier: request.reputation_multiplier,
        period_start: request.period_start,
        period_end: request.period_end,
        status: RewardStatus::Proposed,
        reason: request.reason,
        metadata: request.metadata.unwrap_or_default(),
        created_at: now,
        updated_at: now,
    };

    PROPOSALS.with(|proposals| {
        proposals.borrow_mut().insert(id, proposal.clone());
    });

    ProposalResponse {
        ok: true,
        data: Some(proposal),
        error: None,
    }
}

#[update]
fn approve_proposal(request: ApproveProposalRequest) -> ApprovalResponse {
    let now = time();

    // Validate Root DID format
    if !request.approver_root_did.starts_with("did:root:") && 
       !request.approver_root_did.starts_with("did:") {
        return ApprovalResponse {
            ok: false,
            data: None,
            error: Some("approver_root_did must be a valid Root DID".to_string()),
        };
    }

    // Check proposal exists and is in Proposed status
    let proposal_exists = PROPOSALS.with(|proposals| {
        match proposals.borrow().get(&request.proposal_id) {
            Some(p) => matches!(p.status, RewardStatus::Proposed),
            None => false,
        }
    });

    if !proposal_exists {
        return ApprovalResponse {
            ok: false,
            data: None,
            error: Some("Proposal not found or not in Proposed status".to_string()),
        };
    }

    // Check if this approver already voted
    let already_voted = APPROVALS.with(|approvals| {
        approvals
            .borrow()
            .iter()
            .any(|(_, a)| a.proposal_id == request.proposal_id && 
                          a.approver_root_did == request.approver_root_did)
    });

    if already_voted {
        return ApprovalResponse {
            ok: false,
            data: None,
            error: Some("Approver has already voted on this proposal".to_string()),
        };
    }

    let approval_id = format!("appr_{}", next_id());
    let approval = Approval {
        id: approval_id.clone(),
        proposal_id: request.proposal_id.clone(),
        approver_root_did: request.approver_root_did,
        approved: request.approved,
        comment: request.comment.unwrap_or_default(),
        signature: request.signature,
        created_at: now,
    };

    APPROVALS.with(|approvals| {
        approvals.borrow_mut().insert(approval_id, approval.clone());
    });

    // Check if we've reached approval threshold
    let (approve_count, reject_count) = count_approvals(&request.proposal_id);
    let required = get_required_approvals();

    if approve_count >= required {
        // Update proposal status to Approved
        PROPOSALS.with(|proposals| {
            if let Some(mut p) = proposals.borrow().get(&request.proposal_id) {
                p.status = RewardStatus::Approved;
                p.updated_at = now;
                proposals.borrow_mut().insert(request.proposal_id.clone(), p);
            }
        });
    } else if reject_count >= required {
        // Update proposal status to Rejected
        PROPOSALS.with(|proposals| {
            if let Some(mut p) = proposals.borrow().get(&request.proposal_id) {
                p.status = RewardStatus::Rejected;
                p.updated_at = now;
                proposals.borrow_mut().insert(request.proposal_id.clone(), p);
            }
        });
    }

    ApprovalResponse {
        ok: true,
        data: Some(approval),
        error: None,
    }
}

#[update]
fn distribute_reward(request: DistributeRewardRequest) -> DistributionResponse {
    let now = time();

    // Validate Root DID format
    if !request.distributor_root_did.starts_with("did:root:") && 
       !request.distributor_root_did.starts_with("did:") {
        return DistributionResponse {
            ok: false,
            data: None,
            error: Some("distributor_root_did must be a valid Root DID".to_string()),
        };
    }

    // Check proposal exists and is Approved
    let proposal_approved = PROPOSALS.with(|proposals| {
        match proposals.borrow().get(&request.proposal_id) {
            Some(p) => matches!(p.status, RewardStatus::Approved),
            None => false,
        }
    });

    if !proposal_approved {
        return DistributionResponse {
            ok: false,
            data: None,
            error: Some("Proposal not found or not in Approved status".to_string()),
        };
    }

    // Check not already distributed
    let already_distributed = DISTRIBUTIONS.with(|distributions| {
        distributions
            .borrow()
            .iter()
            .any(|(_, d)| d.proposal_id == request.proposal_id)
    });

    if already_distributed {
        return DistributionResponse {
            ok: false,
            data: None,
            error: Some("Reward already distributed".to_string()),
        };
    }

    let distribution_id = format!("dist_{}", next_id());
    let distribution = Distribution {
        id: distribution_id.clone(),
        proposal_id: request.proposal_id.clone(),
        distributor_root_did: request.distributor_root_did,
        tx_hash: request.tx_hash,
        chain_id: request.chain_id,
        dvn_message_id: request.dvn_message_id.unwrap_or_default(),
        verified: false, // Will be verified by DVN callback
        distributed_at: now,
    };

    DISTRIBUTIONS.with(|distributions| {
        distributions.borrow_mut().insert(distribution_id, distribution.clone());
    });

    // Update proposal status to Distributed
    PROPOSALS.with(|proposals| {
        if let Some(mut p) = proposals.borrow().get(&request.proposal_id) {
            p.status = RewardStatus::Distributed;
            p.updated_at = now;
            proposals.borrow_mut().insert(request.proposal_id.clone(), p);
        }
    });

    DistributionResponse {
        ok: true,
        data: Some(distribution),
        error: None,
    }
}

#[update]
fn verify_distribution(distribution_id: String, verified: bool) -> DistributionResponse {
    let now = time();

    DISTRIBUTIONS.with(|distributions| {
        let mut distributions = distributions.borrow_mut();
        
        if let Some(mut dist) = distributions.get(&distribution_id) {
            dist.verified = verified;
            distributions.insert(distribution_id, dist.clone());
            
            DistributionResponse {
                ok: true,
                data: Some(dist),
                error: None,
            }
        } else {
            DistributionResponse {
                ok: false,
                data: None,
                error: Some("Distribution not found".to_string()),
            }
        }
    })
}

// ============================================================================
// ADMIN METHODS
// ============================================================================

#[update]
fn add_uber_admin(root_did: String) -> bool {
    // In production, this should be restricted to canister controllers
    UBER_ADMINS.with(|admins| {
        let mut admins = admins.borrow_mut();
        if !admins.contains(&root_did) {
            admins.push(root_did);
            true
        } else {
            false
        }
    })
}

#[update]
fn set_required_approvals(count: u32) -> bool {
    if count == 0 {
        return false;
    }
    REQUIRED_APPROVALS.with(|r| {
        *r.borrow_mut() = count;
    });
    true
}

#[query]
fn get_config() -> (u32, Vec<String>) {
    let required = REQUIRED_APPROVALS.with(|r| *r.borrow());
    let admins = UBER_ADMINS.with(|a| a.borrow().clone());
    (required, admins)
}

// ============================================================================
// CANDID EXPORT
// ============================================================================

ic_cdk::export_candid!();
