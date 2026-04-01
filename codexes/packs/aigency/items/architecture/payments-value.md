# Payments & Value Architecture

## x402: HTTP Header-Based Payment Protocol

**x402** is a payment protocol expressed through HTTP headers. Every request that involves value transfer (asset.send, iqube.transfer, asset.claim, etc.) includes x-402-* headers.

### **Protocol Anatomy**

#### **Base Headers (Required)**

```
x-402-intent: iqube.transfer | iqube.grant | iqube.deliver | asset.claim | asset.send
x-402-sender: FIO handle or DID (e.g., "alice@qripto" or "did:iq:persona:...")
x-402-recipient: FIO handle or DID
```

#### **Asset & Amount Headers (Optional but Typical)**

```
x-402-asset: QCT.QCENT | KNYT | Qc | QOYN | USDC | ETH
x-402-amount: "100"  (string, no decimals in header)
x-402-delivery-mode: custody | claim | canonical
```

#### **Advanced Headers**

```
x-402-ref: unique reference ID for idempotency
x-402-dvn-attest: attestation from decentralized verifier network
x-402-consent-alias-bind: true  (bind FIO alias to Root DID)
x-402-dev-skip-sig: true  (dev-only, skip signature verification)
```

### **Payload Schemas by Intent**

Each intent has a specific payload schema (validated by `validateByIntent()`):

#### **1. iqube.transfer** — Transfer ownership of iQube

```json
{
  "iqube_ref": "episode-123",
  "actions": ["transfer_ownership"],
  "settlement": {
    "asset": "QCT.QCENT",
    "amount": "100"
  },
  "bridge": {
    "name": "layer-zero",
    "nonce": 1
  }
}
```

#### **2. iqube.grant** — Grant capability / access

```json
{
  "capability": {
    "iqube_ref": "episode-123",
    "scope": ["read", "execute", "derive"],
    "ttl": "P30D",
    "nonce": "unique-nonce-abc123"
  },
  "acl_delta_sig": "signature-of-acl-change"
}
```

#### **3. iqube.deliver** — Deliver content + metadata

```json
{
  "meta": {
    "cid": "ipfs-cid",
    "hash": "sha256-hash"
  },
  "blak": {
    "uri": "autonomys-uri",
    "hash": "content-hash"
  },
  "license": "CC-BY-4.0"
}
```

#### **4. asset.send** — Simple asset transfer

```json
{
  "asset": "QCT.QCENT",
  "amount": "100",
  "settlement": { /* ... */ }
}
```

#### **5. asset.claim** — Claim a right/entitlement

```json
{
  "claim_id": "claim-abc123",
  "rights": {
    "asset": "KNYT",
    "amount": "50"
  },
  "redeem_to": {
    "chain": "ethereum",
    "recipient": "0xalice..."
  },
  "expiry": "2025-04-01T00:00:00Z"
}
```

### **Validation & Signing**

**Schema Validation** (`/services/x402/schemas.ts`):
```typescript
import { z } from 'zod';

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
  'x-402-dvn-attest': z.string().optional(),
  'x-402-ref': z.string().optional(),
});

export function validateByIntent(intent: string, payload: any) {
  if (intent === 'iqube.grant') return grantPayloadSchema.safeParse(payload);
  if (intent === 'iqube.deliver') return deliverPayloadSchema.safeParse(payload);
  if (intent === 'iqube.transfer') return transferPayloadSchema.safeParse(payload);
  if (intent === 'asset.claim') return claimPayloadSchema.safeParse(payload);
  return { success: false, error: new Error('Unknown intent') };
}
```

**Signature Verification** (`/services/x402/signing.ts`):
```typescript
export async function verifyX402Signature(
  headers: Record<string, string>,
  payload: any
): Promise<boolean> {
  // 1. Reconstruct canonical request (headers + payload)
  // 2. Get sender's public key from identity resolver
  // 3. Verify signature over canonical request
  // 4. Return true/false
}
```

---

## Token Types & Value Flow

### **Supported Assets**

```typescript
export type WalletAsset = 
  | 'Qc'          // Micro-cent, smallest unit
  | 'QOYN'        // Loyalty token
  | 'QCT'         // Main economic token (Qripto Token)
  | 'KNYT'        // Knowledge/content token
  | string;       // Custom or future tokens
```

### **Asset Chains**

Each asset lives on one or more chains:

| Asset | Bitcoin | Ethereum | Optimism | Polygon | Arbitrum | Base | Solana | ICP |
|-------|---------|----------|----------|---------|----------|------|--------|-----|
| QCT | Runes | ERC-20 | ERC-20 | ERC-20 | ERC-20 | ERC-20 | SPL | — |
| KNYT | — | ERC-20 | ERC-20 | ERC-20 | — | ERC-20 | SPL | Canister |
| Qc | — | Native | Native | Native | Native | Native | Lamports | Cycles |
| QOYN | — | ERC-20 | ERC-20 | — | — | — | SPL | — |

### **QCT (Qripto Token) — Main Economic Token**

**Contracts**:
- **Bitcoin**: `Runes` protocol (metaprotocol on Bitcoin)
- **EVM (Ethereum, Optimism, Arbitrum, Base, Polygon)**: ERC-20 (`QCT.sol`)
- **Solana**: SPL Token
- **ICP**: ICRC-2 Standard

**Smart Contracts** (`/contracts/`):

```solidity
// QCT.sol — ERC-20 implementation
contract QCT is ERC20 {
  constructor(uint256 initialSupply) {
    _mint(msg.sender, initialSupply);
  }
}

// QCTReserve.sol — Treasury & reserve management
contract QCTReserve {
  mapping(address => uint256) public reserves;
  
  function claim(
    bytes calldata signature,
    uint256 amount,
    string calldata chain,
    address recipient
  ) external {
    // Verify signature
    // Check reserves
    // Mint/transfer on destination chain
  }
}

// TokenQubeACL.sol — Access control for TokenQubes
contract TokenQubeACL {
  mapping(bytes32 => mapping(address => bool)) public acl;
  
  function grantAccess(bytes32 qubeId, address account) external onlyOwner {
    acl[qubeId][account] = true;
  }
  
  function revokeAccess(bytes32 qubeId, address account) external onlyOwner {
    acl[qubeId][account] = false;
  }
}
```

### **KNYT (Knowledge Token)**

Purpose: Represent knowledge artifacts and content entitlements. 1 KNYT = 1 unit of knowledge/content.

**Distribution**:
- Earned by content creators when episodes/articles are published
- Purchased by users for content access
- Staked for reputation rewards
- Exchangeable for other assets

### **Qc (Micro-cent)**

Purpose: Smallest unit, used for micropayments and fractional content.

**Uses**:
- Panel-level payments in episodes
- Tip/reward to creators
- Faucet airdrops
- Micro-transactions

---

## Wallet Architecture

### **SmartWalletQube** — Unified Wallet State

Every persona has one `SmartWalletQube` (or derives it on-demand):

```typescript
export interface SmartWalletQube {
  id: string;
  personaId: string;
  
  // Cross-chain balances
  balances: WalletBalance[];
  
  // What user owns (entitlements)
  entitlements: EntitlementQube[];
  
  // Pending & claimed rewards
  rewards: {
    pending: RewardClaim[];
    claimed: RewardClaim[];
    history: RewardTransaction[];
  };
  
  // Tasks & Quests
  tasks: WalletTask[];
  quests: WalletQuest[];
  
  // DeFi positions
  defiPositions: DefiPosition[];
}

export interface WalletBalance {
  asset: WalletAsset;       // 'QCT', 'KNYT', 'Qc', etc.
  chain: ChainId;           // 'ethereum', 'optimism', 'polygon', etc.
  amount: string;           // "1000000" (no decimals)
  symbol: string;           // 'QCT', 'KNYT'
  decimals: number;
  updatedAt: string;
}
```

### **Multi-Chain Balance Aggregation**

```
GET /api/wallet/[persona-id]
  ↓
Query balances across chains:
  - Ethereum: call balanceOf() on QCT contract → 100 QCT
  - Optimism: call balanceOf() on QCT contract → 50 QCT
  - Polygon: call balanceOf() on QCT contract → 25 QCT
  - Solana: call getTokenAccountBalance() → 75 QCT
  - Bitcoin: call getRunes() API → 10 QCT
  ↓
Aggregate:
  SmartWalletQube.balances = [
    { asset: 'QCT', chain: 'ethereum', amount: '100000000' },
    { asset: 'QCT', chain: 'optimism', amount: '50000000' },
    ...
  ]
  ↓
Total QCT across all chains: 260 QCT (in UI, summed for display)
```

---

## Custody & Escrow

### **Delivery Modes**

```typescript
type DeliveryMode = 'custody' | 'claim' | 'canonical';
```

#### **1. Custody** — Off-chain escrow (temporary)

**Use case**: Content purchase where immediate settlement is not desired or possible.

```
1. User sends x402 request with delivery_mode: 'custody'
2. shouldEscrow() returns true
3. Smart contract deploys custody:
   - Assets held by smart contract
   - Recipient gains claim capability
   - Escrow expires after TTL
4. On content delivery:
   - executeCustodyGrant() releases assets OR
   - Custody times out → refund to sender
```

#### **2. Claim** — Deferred settlement

**Use case**: User wins a reward, claim is created immediately, settlement deferred.

```
1. User earns reward from quest
2. Create x402_settlements:
   - status: 'pending'
   - claim_id: 'claim-abc123'
3. Settlement created in claims table with expiry
4. User can claim later:
   - POST /api/x402/claims/{claim-id}
   - Verify expiry, authorization
   - Execute settlement on destination chain
```

#### **3. Canonical** — Immediate settlement

**Use case**: Instant payment, content delivery, or trusted parties.

```
1. User sends x402 request (no delivery_mode or 'canonical')
2. Immediately resolve sender + recipient
3. Verify signature
4. Execute settlement atomically:
   - Transfer asset from sender → recipient
   - Grant entitlement (SmartWalletQube.entitlements += content)
   - Create settlement record (state: 'delivered')
5. Content immediately accessible
```

---

## Payment Flow Examples

### **Example 1: Buy Episode with QCT**

```
User: alice@qripto
Content: episode-123 (price: 100 QCT)
Creator: metaknyts@store

1. Frontend resolves identities:
   - alice@qripto → did:iq:persona:alice-...
   - metaknyts@store → did:iq:persona:metaknyts-...

2. Construct x402 request:
   POST /api/x402/send
   Headers:
     x-402-intent: asset.send
     x-402-sender: alice@qripto
     x-402-recipient: metaknyts@store
     x-402-asset: QCT.QCENT
     x-402-amount: 100
     x-402-delivery-mode: canonical
   Payload:
     {
       "asset": "QCT.QCENT",
       "amount": "100",
       "settlement": { "reference": "episode-123" }
     }

3. Backend:
   - Validate schema
   - Verify signature
   - Resolve sender → did:iq:persona:alice-...
   - Resolve recipient → did:iq:persona:metaknyts-...
   - Check alice's balance on primary chain (e.g., Optimism)
   - Transfer 100 QCT from alice → metaknyts on Optimism
   - Grant entitlement:
     * Add to alice's SmartWalletQube.entitlements
     * Set status: 'active', expiryModel: 'permanent'
   - Create x402_settlements record (state: 'delivered')

4. Frontend:
   - Display "Episode purchased!"
   - Update wallet balance
   - Unlock content
```

### **Example 2: Claim Reward**

```
User: bob@qripto
Earned: 50 KNYT from quest completion

1. Backend creates claim:
   POST /api/x402/claims (internal)
   x402_settlements:
     {
       intent: 'asset.claim',
       resolved_sender_did: 'did:iq:system:rewards',
       resolved_recipient_did: 'did:iq:persona:bob-...',
       asset: 'KNYT',
       amount: '50',
       claim_id: 'claim-bob-quest-123',
       status: 'pending',
       delivery_mode: 'claim',
       expiry: '2025-04-01T00:00:00Z'
     }

2. User UI shows: "50 KNYT claim pending"

3. User claims:
   POST /api/x402/claims/claim-bob-quest-123
   Payload:
     {
       "redeem_to": {
         "chain": "polygon",
         "recipient": "bob-polygon-address"
       }
     }

4. Backend:
   - Verify claim not expired
   - Verify user owns claim
   - Execute settlement on Polygon
   - Mint 50 KNYT to recipient address
   - Update x402_settlements (state: 'claimed')

5. Bob's wallet shows +50 KNYT on Polygon
```

---

## Treasury & Reserve Management

### **QCT Reserve System** (`QCTReserve.sol`)

A decentralized reserve contract manages QCT across chains:

```solidity
contract QCTReserve {
  // Total reserves per chain
  mapping(string => uint256) public chainReserves;
  
  // Custody tracking
  mapping(bytes32 => CustodyRecord) public custodies;
  
  struct CustodyRecord {
    address beneficiary;
    uint256 amount;
    uint256 releaseTime;
    bool released;
  }
  
  // Claim tracking
  mapping(bytes32 => ClaimRecord) public claims;
  
  struct ClaimRecord {
    address claimer;
    uint256 amount;
    uint256 expiryTime;
    bool claimed;
  }
  
  function depositReserve(uint256 amount, string calldata chain) external {
    // Receive QCT, add to chain reserve
  }
  
  function claim(
    bytes calldata signature,
    uint256 amount,
    string calldata chain,
    address recipient
  ) external {
    // Verify signature from authority
    // Deduct from reserve
    // Mint on destination chain
  }
}
```

### **Airdrop & Faucet**

```
GET /api/a2a/faucet/airdrop
  ↓
Check eligibility:
  - Not claimed in last 24h
  - Identity verified (reputation > 0)
  - Not blacklisted
  ↓
Mint 10 Qc or 1 KNYT to persona's primary address
  ↓
Log in x402_settlements for audit
```

---

## Summary: Value is Transactional & Traceable

| Layer | Tech | Purpose |
|-------|------|---------|
| **Protocol** | x402 HTTP headers | Express intent & assets |
| **Assets** | QCT, KNYT, Qc, QOYN | Fungible value units |
| **Settlement** | Smart contracts + Supabase | Execute on-chain & off-chain |
| **Custody** | Smart contracts | Escrow, release on conditions |
| **Claims** | Settlement records | Deferred entitlements |
| **Entitlements** | SmartWalletQube | User access rights |

Every transaction is identity-aware (x-402-sender/recipient resolved to DID), cryptographically signed, and recorded in Supabase for audit trails.
```


