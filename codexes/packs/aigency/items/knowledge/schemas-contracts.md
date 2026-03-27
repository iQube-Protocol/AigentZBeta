# Knowledge — Schemas & Contracts

Authoritative schemas, Zod validators, TypeScript contracts, and Solidity contracts for the AgentiQ / iQube Protocol stack.

---

## 1. x402 Payment Protocol — Zod Schemas

Source: `services/x402/schemas.ts`

### 1.1 Base Headers Schema

All x402 requests carry these HTTP headers:

```typescript
export const baseHeadersSchema = z.object({
  'x-402-intent': z.enum([
    'iqube.transfer',
    'iqube.grant',
    'iqube.deliver',
    'asset.claim',
    'asset.send'
  ]),
  'x-402-sender': z.string().min(3),
  'x-402-recipient': z.string().min(3),
  'x-402-asset': z.string().optional(),
  'x-402-amount': z.string().optional(),
  'x-402-delivery-mode': z.enum(['custody', 'claim', 'canonical']).optional(),
  'x-402-dvn-attest': z.string().optional(),  // DVN attestation signature
  'x-402-ref': z.string().optional(),
});
```

**Intent → Delivery Mode mapping**:

| Intent | Mode | Description |
|--------|------|-------------|
| `iqube.grant` | — | Grant capability access to a recipient |
| `iqube.deliver` | `canonical \| custody \| claim` | Deliver iQube content |
| `iqube.transfer` | — | Transfer iQube ownership |
| `asset.claim` | `claim` | Cross-chain asset claim redemption |
| `asset.send` | — | Send asset directly |

### 1.2 Grant Payload Schema

Used for `iqube.grant` intent:

```typescript
export const grantPayloadSchema = z.object({
  capability: z.object({
    iqube_ref: z.string().min(3),        // e.g. "iqube:base:0xabc..."
    scope: z.array(z.string()).min(1),   // e.g. ["read", "decrypt"]
    ttl: z.string().optional(),          // e.g. "24h"
    nonce: z.string().optional(),
  }),
  acl_delta_sig: z.string().optional(),  // ACL change signature
});
```

### 1.3 Deliver Payload Schema

Used for `iqube.deliver` intent:

```typescript
export const deliverPayloadSchema = z.object({
  meta: z.object({ cid: z.string(), hash: z.string() }).optional(),
  blak: z.object({ uri: z.string(), hash: z.string() }).optional(),
  license: z.string().optional(),
  settlement: z.any().optional(),
});
```

### 1.4 Transfer Payload Schema

Used for `iqube.transfer` intent:

```typescript
export const transferPayloadSchema = z.object({
  iqube_ref: z.string().min(3),
  actions: z.array(z.literal('transfer_ownership')).min(1),
  settlement: z.any().optional(),
  bridge: z.object({
    name: z.string(),
    nonce: z.number().optional()
  }).optional(),
  attestations: z.array(z.any()).optional(),
});
```

### 1.5 Custody Payload Schema

Used for `custody` delivery mode:

```typescript
export const custodyPayloadSchema = z.object({
  iqube_ref: z.string().min(3),
  capability: z.object({
    scope: z.array(z.string()).min(1),
    limits: z.object({
      rpm: z.number().optional(),
      tokens_per_day: z.number().optional()
    }).partial().optional(),
    ttl: z.string().optional(),
    aud: z.string().optional(),
    nonce: z.string().optional(),
  }).optional(),
  settlement: z.object({ asset: z.string(), amount: z.string() }).optional(),
  meta_anchor: z.object({ cid: z.string(), hash: z.string() }).partial().optional(),
});
```

### 1.6 Claim Payload Schema

Used for `asset.claim` intent (cross-chain redemption):

```typescript
export const claimPayloadSchema = z.object({
  claim_id: z.string().optional(),
  rights: z.object({ asset: z.string(), amount: z.string() }),
  redeem_to: z.object({ chain: z.string(), recipient: z.string() }),
  expiry: z.string().optional(),
  from_chain: z.string().optional(),
});
```

### 1.7 Intent Validator

```typescript
export function validateByIntent(intent: string, payload: any, headers?: Record<string, string>) {
  if (intent === 'iqube.grant')    return grantPayloadSchema.safeParse(payload);
  if (intent === 'iqube.deliver')  return deliverPayloadSchema.safeParse(payload);
  if (intent === 'iqube.transfer') return transferPayloadSchema.safeParse(payload);
  if (intent === 'asset.claim')    return claimPayloadSchema.safeParse(payload);
  const mode = headers?.['x-402-delivery-mode'];
  if (mode === 'custody')          return custodyPayloadSchema.safeParse(payload);
  return { success: false, error: new Error('Unknown intent') };
}
```

---

## 2. AigentQube TypeScript Interfaces

Source: `types/aigentQube.ts`

### 2.1 Core Types

```typescript
type AgentType = 'copilot' | 'franchise' | 'metavatar' | 'specialist';

type AgentCapabilityCategory =
  | 'chat' | 'content' | 'wallet' | 'tasks'
  | 'codex' | 'commerce' | 'analytics' | 'creative';
```

### 2.2 AigentQube Interface

```typescript
interface AigentQube {
  id: string;                        // e.g. "Copilot", "Kn0w1"
  label: string;
  description?: string;
  type: AgentType;
  appIds: string[];
  metavatarIds: string[];
  capabilities: AgentCapability[];
  policyBindings: PolicyBinding[];
  isActive: boolean;
  defaultMetavatarId?: string;
  systemPrompt?: string;
  modelPreference?: string;          // e.g. "claude-sonnet-4-6"
  temperature?: number;
}
```

### 2.3 AgentCapability Interface

```typescript
interface AgentCapability {
  id: string;
  category: AgentCapabilityCategory;
  label: string;
  description?: string;
  enabled: boolean;
  requiredIdentityState?: 'anon' | 'pseudo' | 'semi' | 'full';
}
```

### 2.4 PolicyBinding Interface

```typescript
interface PolicyBinding {
  policyId: string;
  policyType: 'access' | 'content' | 'payment' | 'privacy' | 'behaviour';
  policyName: string;
  enforced: boolean;
  parameters?: Record<string, any>;
}
```

### 2.5 Well-Known Agent & Metavatar IDs

```typescript
const AGENT_IDS = {
  COPILOT: 'Copilot',
  KN0W1: 'Kn0w1',
  MONEYPENNY: 'MoneyPenny',
  NAKAMOTO: 'Nakamoto',
} as const;

const METAVATAR_IDS = {
  METAKNYTS_KN0W1: 'metaknyts:kn0w1',
  METAKNYTS_MONEYPENNY: 'metaknyts:moneypenny',
  METAKNYTS_CODEX_SPIRIT: 'metaknyts:codex-spirit',
  QRIPTOPIAN_KN0W1: 'qriptopian:kn0w1',
  QRIPTOPIAN_MONEYPENNY: 'qriptopian:moneypenny',
  QRIPTOPIAN_COPILOT: 'qriptopian:copilot',
} as const;
```

---

## 3. Chain & Token TypeScript Types

Source: `types/chains.ts`

### 3.1 Chain Identifiers

```typescript
type ChainId = 'base' | 'optimism' | 'polygon' | 'arbitrum' | 'ethereum' | 'knyt' | 'bitcoin' | 'solana';
type Phase1ChainId = 'base' | 'optimism' | 'polygon' | 'knyt';
type TokenSymbol = 'QCT' | 'KNYT';
```

### 3.2 Phase 1 Chain Config (Testnet)

| Chain | Numeric ID | Testnet | Token |
|-------|-----------|---------|-------|
| Base | 84532 | Base Sepolia | QCT |
| Optimism | 11155420 | OP Sepolia | QCT |
| Polygon | 80002 | Polygon Amoy | QCT |
| KNYT Chain | — | KNYT Testnet | KNYT |

---

## 4. Solidity Contracts

Source: `contracts/`

### 4.1 QCT.sol — QriptoCENT Token

ERC-20 token with bridging and reserve mint capabilities.

```
Total supply cap: 1,000,000,000 (1B QCT)
Decimals: 18
Premine: 40% minted to deployer at deploy
```

**Key functions**:
- `bridgeMint(address to, uint256 amount)` — bridge operator only
- `reserveMint(address to, uint256 amount)` — reserve contract only
- `burn(uint256 amount)` — callable by holder

**Access control**: Ownable; `bridgeMintRole` and `reserveMintRole` separate.

### 4.2 QCTReserve.sol — USDC Reserve

USDC-backed mint mechanism for QCT.

```
Mint ratio: 1 USDC → 100 QCT
USDC backing: held in contract
```

**Key functions**:
- `deposit(uint256 usdcAmount)` → mints 100× QCT to caller
- `withdraw(uint256 qctAmount)` → burns QCT, returns USDC
- Fee parameters configurable by owner

### 4.3 ClaimManager.sol — Cross-Chain Claims

Handles cross-chain asset claim redemption, coordinated with `asset.claim` x402 intent.

**Key functions**:
- `issueClaim(address recipient, uint256 amount, bytes32 claimId)` — issue a cross-chain claim
- `redeemClaim(bytes32 claimId, bytes calldata proof)` — redeem with LayerZero/DVN proof
- Claims have expiry and are single-use

### 4.4 TokenQubeACL.sol — Capability Access Control

Manages capability grants for iQube access, with DVN attestation requirement.

```
DVN attestation: required for cross-chain capability grants
Capabilities: time-boxed (TTL), scope-limited
```

**Key functions**:
- `grantCapability(address grantee, bytes32 iQubeRef, string[] scopes, uint256 ttl)` — grant access
- `revokeCapability(address grantee, bytes32 iQubeRef)` — revoke access
- `transferCapability(address from, address to, bytes32 capabilityId)` — transfer
- `verifyDVNAttestation(bytes32 messageId, bytes calldata attestation)` — validate DVN sig

**Capability scope examples**: `read`, `decrypt`, `fork`, `use`, `transfer_ownership`
