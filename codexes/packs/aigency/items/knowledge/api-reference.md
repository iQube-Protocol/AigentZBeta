# API Reference: Complete Route Catalog

## Index by Domain

- **Identity & Personas** — `/api/identity/*`
- **Payments & x402** — `/api/x402/*`, `/api/a2a/*`
- **Wallet & Assets** — `/api/wallet/*`, `/api/qct/*`
- **Content & Registry** — `/api/content/*`, `/api/registry/*`, `/api/codex/*`
- **AI & Chat** — `/api/copilotkit/*`, `/api/codex/chat`
- **CRM & Engagement** — `/api/crm/*`, `/api/analytics/*`, `/api/engagement/*`
- **Blockchain Ops** — `/api/ops/*`
- **Admin & System** — `/api/admin/*`, `/api/system/*`
- **Auxiliary** — `/api/health/*`, `/api/menu/*`, `/api/drawer/*`

---

## Identity & Personas

### `GET /api/identity/persona`
**Purpose**: Fetch persona(s)

**Query Parameters**:
- `id` (optional): Fetch specific persona by UUID
- `fio_handle` (optional): Check if FIO handle exists

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "root_did": "did:iq:persona:...",
    "fio_handle": "alice@qripto",
    "fio_domain": "qripto",
    "display_name": "Alice",
    "avatar_uri": "https://...",
    "reputation_score": 75,
    "reputation_bucket": 3,
    "badges": ["early_adopter", "creator"],
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-03-27T12:34:56Z"
  }
}
```

---

### `POST /api/identity/persona`
**Purpose**: Create or update persona

**Request Body**:
```json
{
  "auth_profile_id": "uuid",
  "display_name": "Alice",
  "avatar_uri": "https://...",
  "fio_handle": "alice",
  "fio_domain": "qripto",
  "status": "active"
}
```

**Response**: Same as GET

---

### `POST /api/identity/persona/create-with-fio`
**Purpose**: Create persona + register FIO handle (combined)

**Request Body**:
```json
{
  "username": "alice",
  "domain": "qripto",
  "password": "secure_password",
  "display_name": "Alice Wonderland",
  "tenant_id": "uuid"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "persona": { /* full PersonaQube */ },
    "fio_registration": {
      "handle": "alice@qripto",
      "public_key": "...",
      "tx_id": "...",
      "registered_at": "2025-03-27T...",
      "expires_at": "2026-03-27T..."
    }
  }
}
```

---

### `GET /api/identity/fio/lookup?handle={handle}`
**Purpose**: Resolve FIO handle → addresses

**Response**:
```json
{
  "ok": true,
  "data": {
    "handle": "alice@qripto",
    "public_key": "...",
    "addresses": {
      "bitcoin": "1A1z7agoat...",
      "ethereum": "0xalice...",
      "solana": "Alic...",
      "icp": "principal..."
    }
  }
}
```

---

### `POST /api/identity/fio/register`
**Purpose**: Register new FIO handle

**Request Body**:
```json
{
  "username": "alice",
  "domain": "qripto",
  "public_key": "...",
  "chain_mappings": {
    "bitcoin": "1A1z7agoat...",
    "ethereum": "0xalice..."
  }
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "handle": "alice@qripto",
    "tx_id": "...",
    "registered_at": "2025-03-27T..."
  }
}
```

---

### `GET /api/identity/resolve?subject={subject}`
**Purpose**: Resolve any identity (FIO, DID, address) → canonical DID

**Response**:
```json
{
  "ok": true,
  "data": {
    "canonical_did": "did:iq:persona:...",
    "display_name": "Alice",
    "verified_aliases": [
      { "type": "fio", "value": "alice@qripto" },
      { "type": "evm", "value": "0xalice..." }
    ]
  }
}
```

---

### `GET /api/identity/reputation/{persona-id}`
**Purpose**: Get reputation history

**Response**:
```json
{
  "ok": true,
  "data": {
    "score": 75,
    "bucket": 3,
    "badges": ["early_adopter"],
    "history": [
      { "delta": 10, "reason": "quest_completed", "at": "2025-03-27T..." }
    ]
  }
}
```

---

## Payments & x402

### `POST /api/x402/send`
**Purpose**: Execute payment (primary x402 endpoint)

**Headers**:
```
x-402-intent: asset.send
x-402-sender: alice@qripto
x-402-recipient: metaknyts@store
x-402-asset: QCT.QCENT
x-402-amount: 100
x-402-delivery-mode: canonical
x-402-ref: unique-ref-for-idempotency
```

**Request Body**:
```json
{
  "asset": "QCT.QCENT",
  "amount": "100",
  "settlement": {
    "reference": "episode-123"
  }
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "settlement_id": "uuid",
    "message_id": "uuid",
    "state": "delivered",
    "resolved_sender": "did:iq:persona:alice-...",
    "resolved_recipient": "did:iq:persona:metaknyts-...",
    "asset": "QCT.QCENT",
    "amount": "100"
  }
}
```

---

### `POST /api/x402/custody`
**Purpose**: Grant escrow (custody) for deferred delivery

**Headers**:
```
x-402-intent: iqube.grant
x-402-sender

---

### `POST /api/x402/custody`
**Purpose**: Grant escrow (custody) for deferred delivery

**Headers**:
```
x-402-intent: iqube.grant
x-402-sender: alice@qripto
x-402-recipient: metaknyts@store
x-402-delivery-mode: custody
```

**Request Body**:
```json
{
  "capability": {
    "iqube_ref": "episode-123",
    "scope": ["read", "execute"],
    "ttl": "P30D"
  },
  "settlement": {
    "asset": "QCT.QCENT",
    "amount": "100"
  }
}
```

**Response**: Settlement record with state `escrow`

---

### `POST /api/x402/claims/{claim-id}`
**Purpose**: Claim deferred settlement

**Request Body**:
```json
{
  "redeem_to": {
    "chain": "polygon",
    "recipient": "0xalice..."
  }
}
```

**Response**: Settlement moved to `claimed` state

---

### `GET /api/x402/{id}`
**Purpose**: Query settlement status

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "settlement-uuid",
    "message_id": "msg-uuid",
    "intent": "asset.send",
    "state": "delivered",
    "asset": "QCT.QCENT",
    "amount": "100",
    "delivery_mode": "canonical",
    "created_at": "2025-03-27T...",
    "updated_at": "2025-03-27T..."
  }
}
```

---

### `POST /api/a2a/signer/request-tx-sign`
**Purpose**: Request agent to sign transaction

**Request Body**:
```json
{
  "agentId": "agent-treasury-1",
  "txn": {
    "to": "0xrecipient",
    "value": "1000000000000000000",
    "data": "0x...",
    "gas": 21000
  },
  "chain": "optimism"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "tx_hash": "0x...",
    "from": "0xagent...",
    "signed_at": "2025-03-27T..."
  }
}
```

---

## Wallet & Assets

### `GET /api/wallet/{persona-id}`
**Purpose**: Get full wallet state (SmartWalletQube)

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "persona_id": "uuid",
    "balances": [
      {
        "asset": "QCT",
        "chain": "optimism",
        "amount": "1000000000",
        "symbol": "QCT",
        "decimals": 18
      },
      {
        "asset": "KNYT",
        "chain": "solana",
        "amount": "5000000000",
        "symbol": "KNYT",
        "decimals": 9
      }
    ],
    "entitlements": [
      {
        "id": "uuid",
        "content_id": "episode-123",
        "content_type": "episode",
        "status": "active",
        "acquired_via": "purchase",
        "acquired_at": "2025-03-27T...",
        "expires_at": null
      }
    ],
    "rewards": {
      "pending": [
        {
          "id": "reward-uuid",
          "asset": "KNYT",
          "amount": "50",
          "reason": "episode_completed",
          "expires_at": "2025-04-27T..."
        }
      ],
      "claimed": []
    },
    "tasks": [
      {
        "id": "task-uuid",
        "title": "Watch Episode 1",
        "status": "todo",
        "reward": { "asset": "Qc", "amount": "10" }
      }
    ]
  }
}
```

---

### `GET /api/wallet/qct`
**Purpose**: QCT balances across all chains

**Response**:
```json
{
  "ok": true,
  "data": {
    "total_qct": "2000000000",
    "by_chain": {
      "ethereum": "500000000",
      "optimism": "800000000",
      "polygon": "300000000",
      "bitcoin": "400000000"
    }
  }
}
```

---

### `GET /api/wallet/knyt`
**Purpose**: KNYT balances

**Response**: Similar structure to QCT

---

### `GET /api/wallet/notifications`
**Purpose**: Wallet alerts and updates

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "notif-uuid",
      "type": "reward_claimed",
      "message": "You claimed 50 KNYT",
      "created_at": "2025-03-27T..."
    }
  ]
}
```

---

## Content & Registry

### `GET /api/content/episode/{id}`
**Purpose**: Fetch episode with metadata, relations, rewards

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "episode-123",
    "type": "SmartContentQube",
    "title": "Episode 1: Intro",
    "description": "...",
    "modality": "watch",
    "pricing_model": "payPerEpisode",
    "price": {
      "currency": "QCT",
      "amount": "100"
    },
    "content_uri": "https://...",
    "relations": [
      {
        "type": "sequence",
        "target_id": "episode-124",
        "direction": "next"
      },
      {
        "type": "prerequisite",
        "target_id": "episode-122"
      }
    ],
    "rewards": [
      {
        "trigger": "episodeComplete",
        "asset": "KNYT",
        "amount": "10"
      }
    ],
    "layout": {
      "card_shape": "landscape",
      "responsive": { "mobile": "full", "desktop": "2-col" }
    }
  }
}
```

---

### `GET /api/content/article/{id}`
**Purpose**: Fetch article (similar structure to episode)

---

### `GET /api/content/issues`
**Purpose**: List all issues

**Query Parameters**:
- `limit` (default 20)
- `offset` (default 0)

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "issue-uuid",
      "title": "Issue #1",
      "published_at": "2025-03-27T...",
      "cover_image": "https://..."
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

---

### `GET /api/content/library`
**Purpose**: Get user's content library (purchased/earned)

**Response**:
```json
{
  "ok": true,
  "data": {
    "owned": [
      {
        "id": "episode-123",
        "title": "Episode 1",
        "acquired_at": "2025-03-27T...",
        "expiry": null
      }
    ],
    "count": 42
  }
}
```

---

### `GET /api/registry/iqube`
**Purpose**: List iQubes in registry

**Query Parameters**:
- `type` (DataQube, ContentQube, DesignQube, etc.)
- `search` (full-text search)
- `limit`, `offset`

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "name": "Episode Archive",
      "description": "...",
      "type": "ContentQube",
      "created_at": "2025-03-27T..."
    }
  ]
}
```

---

### `GET /api/registry/iqube/{id}`
**Purpose**: Fetch iQube template details

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "name": "Episode Template",
    "type": "ContentQube",
    "description": "...",
    "business_model": "Buy",
    "price": 100,
    "accuracy_score": 95,
    "risk_score": 5
  }
}
```

---

### `POST /api/registry/library`
**Purpose**: Add/remove from user library

**Request Body**:
```json
{
  "iqube_id": "uuid",
  "action": "add" | "remove"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "status": "added" | "removed"
  }
}
```

---

## AI & Chat

### `POST /api/copilotkit/[[...path]]`
**Purpose**: CopilotKit protocol handler

**Request**: CopilotKit message format

**Response**: Streamed LLM response via Server-Sent Events

---

### `POST /api/codex/chat`
**Purpose**: Codex-specific chat (metaKnyts, Qriptopian)

**Request Body**:
```json
{
  "message": "What is metaKnyts?",
  "userId": "persona-uuid",
  "domain": "metaKnyts",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response** (streaming):
```
data: {"delta":"The"}
data: {"delta":" metaKnyts"}
data: {"delta":" universe"}
...
data: [DONE]
```

---

### `POST /api/mcp/experience-qube`
**Purpose**: MCP tool to create/edit experience

**Request Body**:
```json
{
  "tool": "createExperience",
  "params": {
    "title": "Blockchain Basics",
    "description": "...",
    "format": "episode"
  }
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": "experience-uuid",
    "title": "Blockchain Basics"
  }
}
```

---

## CRM & Engagement

### `GET /api/crm/personas`
**Purpose**: List personas in tenant

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "display_name": "Alice",
      "reputation_bucket": 3,
      "contributions_count": 5
    }
  ]
}
```

---

### `GET /api/crm/contributions`
**Purpose**: List user contributions

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "type": "article",
      "title": "My Article",
      "created_at": "2025-03-27T...",
      "status": "published"
    }
  ]
}
```

---

### `POST /api/crm/rewards/distribute`
**Purpose**: Distribute rewards to creators

**Request Body**:
```json
{
  "distributions": [
    {
      "persona_id": "uuid",
      "asset": "KNYT",
      "amount": "100",
      "reason": "content_creation"
    }
  ]
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "processed": 1,
    "failed": 0
  }
}
```

---

### `POST /api/engagement/track`
**Purpose**: Track user engagement event

**Request Body**:
```json
{
  "event": "episode_completed",
  "content_id": "episode-123",
  "persona_id": "uuid",
  "duration_ms": 3600000
}
```

**Response**:
```json
{
  "ok": true
}
```

---

### `GET /api/analytics/dashboard`
**Purpose**: User analytics

**Response**:
```json
{
  "ok": true,
  "data": {
    "total_views": 1000,
    "unique_users": 500,
    "engagement_rate": 0.65,
    "top_content": [...]
  }
}
```

---

## Blockchain Ops

### `GET /api/ops/ethereum/balance?address={address}`
**Purpose**: ETH/token balance on Ethereum

**Response**:
```json
{
  "ok": true,
  "data": {
    "address": "0x...",
    "eth": "1.5",
    "tokens": {
      "QCT": "1000",
      "USDC": "5000"
    }
  }
}
```

---

### `GET /api/ops/optimism/gas`
**Purpose**: OP gas price

**Response**:
```json
{
  "ok": true,
  "data": {
    "safe_gas_price": "0.5",
    "standard_gas_price": "0.7",
    "fast_gas_price": "1.0"
  }
}
```

---

### `GET /api/ops/btc/runes?address={address}`
**Purpose**: Bitcoin Runes balance

**Response**:
```json
{
  "ok": true,
  "data": {
    "address": "1A1z...",
    "runes": [
      {
        "name": "QCT",
        "balance": "1000"
      }
    ]
  }
}
```

---

### `GET /api/ops/solana/spl?address={address}`
**Purpose**: Solana SPL token balances

**Response**:
```json
{
  "ok": true,
  "data": {
    "address": "Alic...",
    "tokens": {
      "KNYT": "5000000000"
    }
  }
}
```

---

### `GET /api/ops/icp/balance?principal={principal}`
**Purpose**: ICP balance

**Response**:
```json
{
  "ok": true,
  "data": {
    "principal": "...",
    "balance_e8s": "100000000"
  }
}
```

---

## Admin & System

### `POST /api/admin/fund-agents`
**Purpose**: Fund agent wallets

**Request Body**:
```json
{
  "agents": [
    {
      "agent_id": "agent-uuid",
      "amount": "1000",
      "asset": "QCT",
      "chain": "optimism"
    }
  ]
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "funded": 1,
    "failed": 0
  }
}
```

---

### `POST /api/admin/register-agent-keys`
**Purpose**: Register agent public keys

**Request Body**:
```json
{
  "agents": [
    {
      "agent_id": "uuid",
      "public_key": "0x...",
      "chain": "optimism"
    }
  ]
}
```

**Response**: Confirmation

---

### `GET /api/system/status`
**Purpose**: System health check

**Response**:
```json
{
  "ok": true,
  "data": {
    "status": "healthy",
    "supabase": "ok",
    "ethereum_rpc": "ok",
    "fio": "ok"
  }
}
```

---

### `GET /api/health/database`
**Purpose**: Database connection health

**Response**:
```json
{
  "ok": true,
  "latency_ms": 45
}
```

---

## Summary by HTTP Method

| Method | Count | Examples |
|--------|-------|----------|
| GET | 80+ | Fetch persona, wallet, content, registry, health checks |
| POST | 100+ | Create persona, execute x402, track engagement, admin ops |
| PUT | 20+ | Update persona, content, CRM records |
| DELETE | 10+ | Remove entitlements, library items |

**Total Routes**: 400+

All routes return `{ ok: boolean, data?: T, error?: string }` format.
```

