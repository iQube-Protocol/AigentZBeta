# Architecture Diagrams

All canonical Mermaid diagrams for the AgentiQ / iQube Protocol architecture.
Source: `docs/architecture/diagrams/` and `docs/architecture/AigentZ_Architecture.md`

---

## 1. C4 Context — System Overview

High-level view: users, the Aigent Z platform, and external blockchains/registries.

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

---

## 2. C4 Container — Internal Architecture

Detailed internal components across all four layers.

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
    S1["API Gateway (Next.js)<br/>OpenAPI, Auth, RLS claims"]
    S2["Payments / Wallet<br/>(x402 + Thirdweb)"]
    S3["Identity / Registry<br/>(ERC-8004 Identity)"]
    S4["CrossChain<br/>(LayerZero Messenger)"]
    S5["FIO Adapter"]
    S6["Chain Clients<br/>EVM Contract Client · ICP Canister Client · Bitcoin Client<br/>(dual-lock mint)"]
    S7["Webhooks & Indexers<br/>(reconciliation, schema discovery)"]
  end
  subgraph State
    DB["Supabase Postgres<br/>(RLS, row encryption)"]
    OBJ["Object Store<br/>(Supabase Storage / IPFS)"]
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

---

## 3. Data Model (ERD)

Entity-relationship diagram for the Supabase schema.

```mermaid
erDiagram
  users {
    uuid id PK
    text wallet_address
    text fio_handle
    timestamptz created_at
  }
  iqubes {
    uuid id PK
    text name
    uuid owner_user_id FK
    text metaQubeRef
    text blakQubeRef
    text blakSchemaRef
    text tokenQubeRef
    text chain
    text chain_tx
    text status
    timestamptz created_at
  }
  meta_index {
    uuid id PK
    text metaQubeId
    text chain
    text registry_txid
    text blakSchemaRef
    jsonb blakSchemaKeys
    jsonb attributes
    timestamptz seen_at
  }
  blak_schema {
    uuid id PK
    text blakSchemaRef
    text field_key
    text field_label
    text field_type
    boolean is_public
    text version
  }
  capability_tokens {
    uuid id PK
    uuid grantee_user_id FK
    text blakSchemaRef
    jsonb field_keys
    timestamptz expires_at
    text grant_proof
  }
  audit_trail {
    uuid id PK
    uuid user_id
    text action
    jsonb details
    timestamptz at
  }
  mem_session {
    uuid id PK
    uuid user_id FK
    uuid session_id
    jsonb chunks
    timestamptz created_at
  }
  mem_customer {
    uuid id PK
    uuid user_id FK
    jsonb timeline
    timestamptz updated_at
  }
  mem_behavioral {
    uuid id PK
    text subject_hash
    jsonb metrics
    timestamptz window_start
    timestamptz window_end
  }
  account_state {
    uuid id PK
    uuid user_id FK
    jsonb subscriptions
    jsonb features
    jsonb recent_activity
  }
  users ||--o{ iqubes : owns
  meta_index }o--|| iqubes : "references metaQubeRef"
  blak_schema }o--|| iqubes : "by blakSchemaRef"
  capability_tokens }o--|| blak_schema : "field access"
  capability_tokens }o--|| users : "granted to"
```

---

## 4. Token-Gated Auth & Entitlements

```mermaid
sequenceDiagram
  participant UI as External UI
  participant API as Aigent Z API
  participant DB as Supabase (RLS)
  participant TW as Thirdweb (EVM)

  UI->>API: GET /auth/nonce?address=0x..
  API-->>UI: { nonce }
  UI->>API: POST /auth/verify {address, signature, nonce}
  API->>DB: create session, set entitlements
  API-->>UI: { token, expiresAt }

  UI->>API: GET /entitlements (Bearer token)
  API->>DB: check RLS policies
  DB-->>API: scopes
  API-->>UI: { entitlements }

  UI->>API: GET /iqubes (Bearer token)
  API->>DB: SELECT * FROM iqubes WHERE owner_user_id = user_id
  DB-->>API: rows allowed by RLS
  API-->>UI: user iQubes
```

---

## 5. EVM Mint with LayerZero

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
  API->>DB: INSERT iqubes(metaQubeRef, blakQubeRef, blakSchemaRef, tokenQubeRef, chain, chain_tx, status:"minting")
  API-->>UI: { id, txHash, status:"minting" }
  EVM-->>API: event Confirmed(metaQubeId)
  API->>DB: UPDATE iqubes SET status:"active", metaQubeRef:metaQubeId
  API-->>UI: { id, status:"active" }
```

---

## 6. ICP/BTC Dual-Lock Mint

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
  API->>DB: INSERT iqubes(..., blakSchemaRef, chain:"icp-btc", chain_tx:btcTxId, status:"active")
  API-->>UI: { id, btcTxId, status:"active" }
```

---

## 7. ICP Mint via Chain-Key Bitcoin

```mermaid
sequenceDiagram
  participant UI as External UI
  participant API as Aigent Z API
  participant ICP as ICP Bridge
  participant DB as Supabase
  participant BTC as Bitcoin Network

  UI->>API: POST /icp/mint { owner, meta }
  API->>ICP: mint_iQube(owner, meta)
  ICP-->>API: { proofId, status: accepted }
  API->>DB: INSERT iqubes (metaQubeRef, owner, status='minting')
  rect rgb(245,245,245)
    Note over ICP,BTC: ICP canister performs mint using chain-key BTC and emits on-chain tx (Ordinals/Runes as needed)
  end
  ICP-->>API: webhook/progress { proofId, btcTxId, status: active }
  API->>DB: UPDATE iqubes SET status='active', chain_tx=btcTxId
  API-->>UI: { id, status: active, chain_tx }
```

---

## 8. LayerZero EVM↔EVM Exchange

```mermaid
sequenceDiagram
  participant API as Aigent Z API
  participant LZ as LayerZero OApp
  participant EVM1 as EVM Chain A
  participant EVM2 as EVM Chain B

  API->>LZ: sendMessage(dstChainId, payload=tokenQube intent)
  LZ->>EVM1: enqueue message
  LZ-->>EVM2: deliver to destination OApp
  EVM2-->>LZ: receipt/ack
  LZ-->>API: status=delivered, txHash
  API->>DB: UPDATE xchain_status
```

---

## 9. A2A Delegated Validation (ERC-8004)

```mermaid
sequenceDiagram
  participant Ext as External Agent
  participant API as Aigent Z API (A2A)
  participant REG as ERC-8004 Identity
  participant DB as Supabase (audit)

  Ext->>API: POST /a2a/delegate { capability, params, sig }
  API->>REG: verify agent identity on-chain
  REG-->>API: identity metadata
  API->>Ext: 202 Accepted (task id)
  Ext->>API: POST /a2a/submit-validation { result, evidenceUri, sig }
  API->>DB: INSERT audit_trail (validation event)
  API-->>Ext: 201 Created
```

---

## 10. BlakQube Schema Discovery (Indexer)

```mermaid
sequenceDiagram
  participant API as Aigent Z API
  participant IDX as MetaQube Indexer
  participant DB as Supabase
  IDX->>API: webhook: metaQube observed { metaQubeId, chain, blakSchemaRef, blakSchemaKeys }
  API->>DB: UPSERT meta_index(...)
  API-->>IDX: 204
  API->>DB: SELECT blakSchemaKeys WHERE metaQubeId=:id
  DB-->>API: ["email","plan","country"]
```

---

## 11. BlakQube Schema vs Values Read

```mermaid
sequenceDiagram
  participant UI as External UI
  participant API as Aigent Z API
  participant DB as Supabase
  UI->>API: GET /iqubes/{id}/blak/schema
  API->>DB: SELECT * FROM blak_schema WHERE blakSchemaRef=:ref
  DB-->>API: keys/labels/types
  API-->>UI: schema
  UI->>API: GET /iqubes/{id}/blak/values?fields=email,plan (with capability)
  API->>DB: validate capability token for fields
  DB-->>API: values for allowed fields only
  API-->>UI: values subset
```

---

## 12. Capability Grant / Key Share

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

---

## Notes

- Source files: `docs/architecture/diagrams/*.mmd`
- Architecture doc: `docs/architecture/AigentZ_Architecture.md`
- All diagrams use GitHub-flavored Mermaid syntax; render natively in the codex viewer with `enableInferenceRendering`
- C4 diagrams follow the C4 model (Context → Container → Component → Code)
- Sequence diagrams show API flows at the service boundary level
