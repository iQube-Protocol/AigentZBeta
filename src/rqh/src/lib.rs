use candid::{CandidType, Deserialize};
use ic_cdk::api::time;
use ic_cdk_macros::*;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, Storable, storable::Bound};
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;
type IdCell = ic_stable_structures::Cell<u64, Memory>;

// Reputation bucket structure matching Supabase schema
#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct ReputationBucket {
    pub id: String,
    pub partition_id: String,
    pub bucket: u32,
    pub skill_category: String,
    pub score: f64,
    pub evidence_count: u32,
    pub last_updated: u64,
    pub created_at: u64,
}

impl Storable for ReputationBucket {
    const BOUND: Bound = Bound::Bounded {
        max_size: 1024, // 1KB max per reputation entry
        is_fixed_size: false,
    };

    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
}

// Reputation evidence structure
#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct ReputationEvidence {
    pub id: String,
    pub bucket_id: String,
    pub evidence_type: String,
    pub evidence_data: String,
    pub weight: f64,
    pub verified: bool,
    pub created_at: u64,
}

impl Storable for ReputationEvidence {
    const BOUND: Bound = Bound::Bounded {
        max_size: 2048, // 2KB max per evidence entry
        is_fixed_size: false,
    };

    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
}

// API response structures
#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct CreateReputationRequest {
    pub partition_id: String,
    pub skill_category: String,
    pub initial_score: Option<f64>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct AddEvidenceRequest {
    pub bucket_id: String,
    pub evidence_type: String,
    pub evidence_data: String,
    pub weight: f64,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct ReputationResponse {
    pub ok: bool,
    pub data: Option<ReputationBucket>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct EvidenceResponse {
    pub ok: bool,
    pub data: Option<Vec<ReputationEvidence>>,
    pub error: Option<String>,
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    static ID_COUNTER: RefCell<IdCell> = RefCell::new(
        IdCell::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))), 0)
            .expect("Cannot create a counter")
    );

    static REPUTATION_STORAGE: RefCell<StableBTreeMap<String, ReputationBucket, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
        )
    );

    static EVIDENCE_STORAGE: RefCell<StableBTreeMap<String, ReputationEvidence, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))),
        )
    );
}

fn next_id() -> u64 {
    ID_COUNTER.with(|counter| {
        let current_value = *counter.borrow().get();
        let _ = counter.borrow_mut().set(current_value + 1);
        current_value + 1
    })
}

// Get reputation bucket by partition ID
#[query]
fn get_reputation_bucket(partition_id: String) -> ReputationResponse {
    REPUTATION_STORAGE.with(|storage| {
        let storage = storage.borrow();
        
        // Find bucket by partition_id
        for (_, bucket) in storage.iter() {
            if bucket.partition_id == partition_id {
                return ReputationResponse {
                    ok: true,
                    data: Some(bucket),
                    error: None,
                };
            }
        }
        
        ReputationResponse {
            ok: false,
            data: None,
            error: Some("No reputation bucket found for this partition ID".to_string()),
        }
    })
}

// Create new reputation bucket
#[update]
fn create_reputation_bucket(request: CreateReputationRequest) -> ReputationResponse {
    let now = time();
    let id = format!("rqh_{}", next_id());
    
    let bucket = ReputationBucket {
        id: id.clone(),
        partition_id: request.partition_id,
        bucket: calculate_initial_bucket(request.initial_score.unwrap_or(0.0)),
        skill_category: request.skill_category,
        score: request.initial_score.unwrap_or(0.0),
        evidence_count: 0,
        last_updated: now,
        created_at: now,
    };
    
    REPUTATION_STORAGE.with(|storage| {
        storage.borrow_mut().insert(id, bucket.clone());
    });
    
    ReputationResponse {
        ok: true,
        data: Some(bucket),
        error: None,
    }
}

// Add evidence to reputation bucket
#[update]
fn add_reputation_evidence(request: AddEvidenceRequest) -> ReputationResponse {
    let now = time();
    let evidence_id = format!("evidence_{}", next_id());
    
    // Create evidence entry
    let evidence = ReputationEvidence {
        id: evidence_id.clone(),
        bucket_id: request.bucket_id.clone(),
        evidence_type: request.evidence_type,
        evidence_data: request.evidence_data,
        weight: request.weight,
        verified: true, // Auto-verified for MVP (TODO: Add verification workflow)
        created_at: now,
    };
    
    // Store evidence
    EVIDENCE_STORAGE.with(|storage| {
        storage.borrow_mut().insert(evidence_id, evidence);
    });
    
    // Update reputation bucket
    let result = REPUTATION_STORAGE.with(|storage| {
        let mut storage = storage.borrow_mut();
        if let Some(mut bucket) = storage.get(&request.bucket_id) {
            bucket.evidence_count += 1;
            bucket.last_updated = now;
            
            // Recalculate score based on evidence
            bucket.score = calculate_reputation_score(&request.bucket_id);
            bucket.bucket = calculate_bucket_from_score(bucket.score);
            
            storage.insert(request.bucket_id, bucket.clone());
            
            Some(bucket)
        } else {
            None
        }
    });
    
    match result {
        Some(bucket) => ReputationResponse {
            ok: true,
            data: Some(bucket),
            error: None,
        },
        None => ReputationResponse {
            ok: false,
            data: None,
            error: Some("Reputation bucket not found".to_string()),
        },
    }
}

// Get evidence for a reputation bucket
#[query]
fn get_reputation_evidence(bucket_id: String) -> EvidenceResponse {
    EVIDENCE_STORAGE.with(|storage| {
        let storage = storage.borrow();
        let mut evidence_list = Vec::new();
        
        for (_, evidence) in storage.iter() {
            if evidence.bucket_id == bucket_id {
                evidence_list.push(evidence);
            }
        }
        
        EvidenceResponse {
            ok: true,
            data: Some(evidence_list),
            error: None,
        }
    })
}

// Get all reputation buckets for a partition
#[query]
fn get_partition_reputation(partition_id: String) -> Vec<ReputationBucket> {
    REPUTATION_STORAGE.with(|storage| {
        let storage = storage.borrow();
        let mut buckets = Vec::new();
        
        for (_, bucket) in storage.iter() {
            if bucket.partition_id == partition_id {
                buckets.push(bucket);
            }
        }
        
        buckets
    })
}

// Calculate initial bucket based on score
fn calculate_initial_bucket(score: f64) -> u32 {
    match score {
        s if s >= 80.0 => 4, // Excellent
        s if s >= 60.0 => 3, // Good
        s if s >= 40.0 => 2, // Fair
        s if s >= 20.0 => 1, // Poor
        _ => 0,              // No reputation
    }
}

// Calculate bucket from score
fn calculate_bucket_from_score(score: f64) -> u32 {
    calculate_initial_bucket(score)
}

// Calculate reputation score based on evidence
fn calculate_reputation_score(bucket_id: &str) -> f64 {
    EVIDENCE_STORAGE.with(|storage| {
        let storage = storage.borrow();
        let mut total_weight = 0.0;
        let mut weighted_score = 0.0;
        
        for (_, evidence) in storage.iter() {
            if evidence.bucket_id == bucket_id && evidence.verified {
                total_weight += evidence.weight;
                // Simple scoring: positive evidence adds to score
                weighted_score += evidence.weight * 10.0; // Scale factor
            }
        }
        
        if total_weight > 0.0 {
            (weighted_score / total_weight).min(100.0).max(0.0)
        } else {
            0.0
        }
    })
}

// Health check
#[query]
fn health() -> String {
    format!(
        "ReputationQube (RQH) Canister - Healthy. Buckets: {}, Evidence: {}",
        REPUTATION_STORAGE.with(|s| s.borrow().len()),
        EVIDENCE_STORAGE.with(|s| s.borrow().len())
    )
}

// Export Candid interface
ic_cdk::export_candid!();
