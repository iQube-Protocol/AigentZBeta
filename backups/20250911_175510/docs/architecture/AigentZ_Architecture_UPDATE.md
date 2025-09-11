
# Aigent Z Beta — Architecture (Updated for Direct Chain Writes & BlakQube Key Visibility)
_Last updated: 2025-09-09_

This update makes two major changes:
1. **Direct chain writes from the API**: the Services layer now includes **Chain Clients** that submit on-chain transactions (EVM contracts, LayerZero messages, ICP canister calls, and Bitcoin tx via the ICP pathway) directly from the backend.
2. **Global metaQube visibility + blakQube keys**: the application maintains a full index of **all metaQubes** (templates and instances) and can see **blakQube keys (metadata/handles)** for discovery and policy, while never storing or exposing **blakQube values** unless a user grants a explicit capability token.

## C4-Context
```mermaid

flowchart LR
  subgraph Users
    U[End User]
    Admin[Operator/Admin]
  end

  subgraph ExternalUI["External UI<br/>(provided by product owner)"]
    UI[Web App / Chat UI]
  end

  U --> UI
  Admin --> UI

  subgraph AigentZ["Aigent Z Beta Platform"]
    direction TB
    OG["Orchestration Layer<br/>Agent Runner · MCP Client · A2A Adapter"]
    CTX["Context Layer<br/>iQube Resolver · Policy Engine · Memory Manager"]
    SRV["Services Layer<br/>API Gateway · Identity/Payments · CrossChain(LayerZero) · ERC-8004 · FIO · Chain Clients"]
    ST["State Layer<br/>Supabase(Postgres+RLS) · Object Store · Audit/Telemetry"]
  end

  UI --> SRV
  SRV --> ST
  OG --> CTX
  CTX --> ST
  OG --> SRV

  subgraph Chains["Blockchains & Registries"]
    direction TB
    EVM["EVM Chains<br/>(ERC-8004, payments, token-gates)"]
    LZ["LayerZero OApp/OFT"]
    FIO["FIO Protocol (handles)"]
    REG["iQube Registry<br/>(metaQubes index)"]
    ICP["ICP / Bitcoin<br/>(dual-lock mint)"]
  end

  SRV --- EVM
  SRV --- FIO
  SRV --- LZ
  SRV --- REG
  SRV --- ICP

  SRV -- "read + write (tx submit, query)" --- EVM
  SRV -- "read + write (deliver/receive)" --- LZ
  SRV -- "read + write (canister calls, BTC via ICP)" --- ICP

```

## C4-Container
```mermaid

flowchart TB
  subgraph Orchestration
    OR1["Agent Runner<br/>(session loop, tools)"]
    OR2["MCP Client<br/>(MCP servers)"]
    OR3["A2A Adapter<br/>(capability discovery, signed delegation)"]
  end

  subgraph Context
    CX1["iQube Resolver<br/>(meta / blak / token refs)"]
    CX2["Policy Engine<br/>(token-gates, consent, scopes)"]
    CX3["Memory Manager<br/>(mem_session, mem_customer, mem_behavioral, account_state)"]
    CX4["Vector / RAG Index<br/>(per-user namespace)"]
  end

  subgraph Services
    S1["API Gateway (FastAPI/Flask)<br/>OpenAPI, Auth, RLS claims"]
    S2["Payments / Wallet<br/>(Thirdweb)"]
    S3["Identity / Registry<br/>(ERC-8004 Identity)"]
    S4["CrossChain<br/>(LayerZero Messenger)"]
    S5["FIO Adapter"]
    S6["Chain Clients<br/>EVM Contract Client · ICP Canister Client · Bitcoin Client<br/>(dual-lock mint)"]
    S7["Webhooks & Jobs<br/>(reconciliation, indexers)"]
  end

  subgraph State
    DB["Supabase Postgres<br/>(RLS, row encryption)"]
    OBJ["Object Store<br/>(e.g., Supabase Storage)"]
    LOG["Audit & Telemetry<br/>(OTel / Sentry)"]
  end

  UI[External UI] --> S1
  S1 <--> OR1
  OR1 <--> CX1
  OR1 <--> CX3
  CX1 <--> DB
  CX3 <--> DB
  CX4 <--> DB
  S1 --> DB
  S2 <--> S1
  S3 <--> S1
  S4 <--> S1
  S5 <--> S1
  S6 <--> S1
  S7 <--> DB

  S6 --> EVM[EVM Chains]
  S4 <--> LZ[LayerZero]
  S6 <--> ICP[ICP Canisters / BTC]
  S3 --> EVM

```

## Data Model changes (ERD)
- New columns on `iqubes`: `blakKeyRef`, `chain`, `chain_tx`.
- New tables: `blak_keys` (public key metadata only), `capability_tokens` (time-boxed decrypt/share grants).
- `meta_index` now includes `blakKeyRef` so the app can discover keys (not values) for all metaQubes.

```mermaid

classDiagram
  class users {
    uuid id PK
    text wallet_address
    text fio_handle
    timestamptz created_at
  }
  class agents {
    uuid id PK
    text name
    uuid owner_user_id FK
  }
  class iqubes {
    uuid id PK
    text name
    uuid owner_user_id FK
    text metaQubeRef
    text blakQubeRef
    text blakKeyRef
    text tokenQubeRef
    text chain
    text chain_tx
    text status
    timestamptz created_at
  }
  class meta_index {
    uuid id PK
    text metaQubeId
    text chain
    text registry_txid
    text blakKeyRef
    jsonb attributes
    timestamptz seen_at
  }
  class blak_keys {
    uuid id PK
    text blakKeyRef
    text key_type
    jsonb key_metadata
    timestamptz created_at
  }
  class capability_tokens {
    uuid id PK
    uuid grantee_user_id FK
    text blakKeyRef
    text scope
    timestamptz expires_at
    text grant_proof
  }
  class access_grants {
    uuid id PK
    uuid user_id FK
    text scope
    timestamptz expires_at
  }
  class payments {
    uuid id PK
    uuid user_id FK
    text status
    text tx_hash
    text chain_id
    numeric amount
  }
  class audit_trail {
    uuid id PK
    uuid user_id
    text action
    jsonb details
    timestamptz at
  }
  class mem_session {
    uuid id PK
    uuid user_id FK
    uuid session_id
    jsonb chunks
    timestamptz created_at
  }
  class mem_customer {
    uuid id PK
    uuid user_id FK
    jsonb timeline
    timestamptz updated_at
  }
  class mem_behavioral {
    uuid id PK
    text subject_hash
    jsonb metrics
    timestamptz window_start
    timestamptz window_end
  }
  class account_state {
    uuid id PK
    uuid user_id FK
    jsonb subscriptions
    jsonb features
    jsonb recent_activity
  }

  users --> agents : owns
  users --> iqubes : owns
  users --> access_grants : has
  users --> payments : makes
  users --> mem_session : writes
  users --> mem_customer : owns
  users --> account_state : owns
  meta_index --> iqubes : references metaQubeRef
  blak_keys --> iqubes : by blakKeyRef
  capability_tokens --> blak_keys : grants access
  capability_tokens --> users : to user

```

## Key sequences

### EVM mint with optional LayerZero to designated chain
```mermaid

sequenceDiagram
  participant UI as External UI
  participant API as Aigent Z API
  participant EVM as EVM Contract Client
  participant LZ as LayerZero
  participant DB as Supabase

  UI->>API: POST /iqubes/mint {chain:"evm", dstChainId, metadataUri, type:"instance"}
  API->>EVM: call Registry.mint(metadataUri)
  EVM-->>API: txHash
  alt designated chain
    API->>LZ: sendMessage(dstChainId, payload=attachTokenQube(txHash))
    LZ-->>API: delivered {lzTx}
  end
  API->>DB: INSERT iqubes(metaQubeRef, blakKeyRef, tokenQubeRef, chain, chain_tx, status="minting")
  API-->>UI: { id, txHash, status:"minting" }
  EVM-->>API: event Confirmed(metaQubeId)
  API->>DB: UPDATE iqubes SET status="active", metaQubeRef=metaQubeId
  API-->>UI: { id, status:"active" }

```

### ICP/Bitcoin dual-lock mint (21 Sats)
```mermaid

sequenceDiagram
  participant UI as External UI
  participant API as Aigent Z API
  participant ICP as ICP Canister Client
  participant BTC as Bitcoin Client
  participant DB as Supabase

  UI->>API: POST /iqubes/mint {chain:"icp-btc", meta, dualLock:true}
  API->>ICP: canister.mint(meta)
  ICP-->>API: { icpProofId }
  API->>BTC: createLockTx(meta, icpProofId)
  BTC-->>API: { btcTxId }
  API->>DB: INSERT iqubes(..., chain="icp-btc", chain_tx=btcTxId, status="active")
  API-->>UI: { id, btcTxId, status:"active" }

```

### Share a blakQube key (capability token)
```mermaid

sequenceDiagram
  participant Owner as Data Owner
  participant API as Aigent Z API
  participant DB as Supabase
  participant Grantee as Another User/App

  Owner->>API: POST /capabilities/grant { blakKeyRef, scope, expiresAt }
  API->>DB: INSERT capability_tokens(grantee, blakKeyRef, scope, expiresAt, grant_proof)
  API-->>Owner: 201 Created {capId}
  Grantee->>API: GET /iqubes/{id}/blak/keys (with token)
  API->>DB: validate capability token + RLS
  DB-->>API: key metadata (no values)
  API-->>Grantee: keys list

```

## Security & Privacy
- **Values never stored**: blakQube payloads are not persisted in app DB; only pointers and **public key metadata** live in `blak_keys` / `meta_index`.
- **Capability tokens**: decrypt rights are granted via signed, time-boxed tokens recorded in `capability_tokens`; RLS + signature verification required on read.
- **Managed key material**: server-side signing keys (for registry writes, relays, or canister identities) must be held in HSM/KMS; user-affecting txs use user signatures or a relayer with explicit consent.
- **Audit**: all on-chain write attempts and capability grants are recorded in `audit_trail` with purpose strings.
