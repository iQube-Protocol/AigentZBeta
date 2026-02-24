# Phase 2 – Canonical Mints for metaKnyts Digital Scrolls

**Status:** BACKLOG  
**Priority:** High (implement after Phase 1 custodial mints are stable)  
**Approach:** Option A – Per-issue key wrapping, self-custody ready

---

## 1. Overview

Phase 2 extends the existing custodial minting system into full **canonical mints**, where:

- A **canonical Digital Scroll** is a user-owned cryptographic object:
  - A content identifier (Autonomys CID)
  - A per-issue wrapped key that only the user can decrypt
  - Qube metadata (metaQube / BlakQube / userTokenQube references)

- Users can:
  - **Export** their canonical issues
  - **Store them in cold storage**
  - **Re-host/mirror them** (e.g., on their own Autonomys node)
  - **Still stream via KNYTMall** if they choose

| Phase | Mode | Key Holder | User Can Export? |
|-------|------|------------|------------------|
| Phase 1 | Custodial | Platform | No |
| Phase 2 | Canonical | User (wrapped) | Yes |

---

## 2. Goals

1. **Support two mint types:**
   - `custodial` (existing)
   - `canonical` (new, self-custody capable)

2. **Introduce per-issue keys via wrapping:**
   - A user-specific key wrapper or DID-based key system encodes rights to decrypt

3. **Provide an exportable "canonical bundle":**
   - Small JSON/CBOR object containing CID + wrapped key + Qube references
   - Designed to be storable in wallets, cold storage, etc.

4. **Retain full compatibility with existing:**
   - `MasterContentQube` model
   - Autonomys encrypted payloads
   - KNYTMall & Codex ownership logic

---

## 3. Prerequisites (from Phase 1)

- [x] `user_issue_qubes` exists with `custody_mode` field
- [x] Streaming endpoint decrypts server-side using master key from `token_qube_id`
- [x] Autonomys Auto-Drive is the storage layer
- [ ] User crypto identity system (wallet public key, DID, or per-user keypair)

---

## 4. Data Model Changes

### 4.1 `user_issue_qubes` Additions

Extend with:

```sql
-- Already exists from Phase 1:
custody_mode VARCHAR(20) DEFAULT 'custodial' -- 'custodial' | 'canonical'

-- Add for Phase 2:
canonical_bundle_id UUID REFERENCES canonical_bundles(id) -- Only set for canonical issues
```

### 4.2 New Table: `canonical_bundles`

```sql
CREATE TABLE canonical_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES user_issue_qubes(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  
  -- Content reference
  cid TEXT NOT NULL,                    -- Autonomys CID for encrypted master payload
  mime_type VARCHAR(100) NOT NULL,
  
  -- Key wrapping
  wrapped_key TEXT NOT NULL,            -- Base64 - symmetric key wrapped with user's public key
  encryption_alg VARCHAR(50) NOT NULL,  -- e.g., 'AES-256-GCM'
  key_wrap_alg VARCHAR(100) NOT NULL,   -- e.g., 'X25519-XSalsa20-Poly1305'
  
  -- iQube references
  meta_qube_id UUID REFERENCES iq_meta_qubes(id),
  blak_qube_id UUID REFERENCES iq_blak_qubes(id),
  user_token_qube_id UUID,              -- Reference to user-specific tokenQube
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(issue_id)
);

CREATE INDEX idx_canonical_bundles_owner ON canonical_bundles(owner_id);
CREATE INDEX idx_canonical_bundles_episode ON canonical_bundles(episode_number);
```

### 4.3 New iQube Type: `userTokenQube`

Extend `iq_token_qubes` or create separate table:

```sql
-- Option A: Add kind column to existing table
ALTER TABLE iq_token_qubes ADD COLUMN kind VARCHAR(20) DEFAULT 'project';
-- kind: 'project' (Phase 1) | 'user' (Phase 2 canonical)

-- Option B: New table for user-specific token qubes
CREATE TABLE iq_user_token_qubes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  issue_id UUID REFERENCES user_issue_qubes(id),
  episode_number INTEGER NOT NULL,
  
  wrapped_key TEXT NOT NULL,
  key_wrap_alg VARCHAR(100) NOT NULL,
  permissions JSONB DEFAULT '{"canonical_issue_decrypt": true}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Canonical Mint Flow

### 5.1 API Extension

```typescript
// POST /api/mint/episode
interface MintRequest {
  episodeNumber: number;
  masterType: 'episode_still' | 'episode_motion';
  custodyMode?: 'custodial' | 'canonical';  // NEW - defaults to 'custodial'
}
```

### 5.2 Canonical Mint Behaviour

```
1. Auth, validation, fetch master_content_qubes
2. Verify KNYT payment (canonical may have premium pricing)
3. Random cover selection (same as custodial)
4. Create user_issue_qubes row with custody_mode = 'canonical'

5. CANONICAL-SPECIFIC:
   a. Get user's public key (from wallet/DID/persona)
   b. Generate fresh per-issue symmetric key
   c. Wrap per-issue key with user's public key → wrapped_key
   d. Create userTokenQube record
   e. Create canonical_bundles record with:
      - CID from master_content_qubes
      - wrapped_key
      - All Qube references
   f. Update user_issue_qubes.canonical_bundle_id

6. Return response with custodyMode: 'canonical'
```

### 5.3 Key Wrapping Strategy (Option A - Recommended)

```typescript
// Per-issue key generation + wrapping
async function createCanonicalBundle(
  issueId: string,
  masterContent: MasterContentQube,
  userPublicKey: Uint8Array
): Promise<CanonicalBundle> {
  // 1. Get the master symmetric key from tokenQube
  const masterKey = await unwrapMasterKey(masterContent.token_qube_id);
  
  // 2. Generate a per-issue key (or reuse master key for v1)
  const issueKey = masterKey; // v1: reuse master key
  // const issueKey = crypto.randomBytes(32); // v2: fresh per-issue key
  
  // 3. Wrap with user's public key
  const wrappedKey = await wrapKeyForUser(issueKey, userPublicKey);
  
  // 4. Create bundle
  return {
    cid: masterContent.auto_drive_cid,
    mimeType: masterContent.mime_type,
    wrappedKey: wrappedKey.toString('base64'),
    encryptionAlg: masterContent.encryption_alg,
    keyWrapAlg: 'X25519-XSalsa20-Poly1305',
  };
}
```

---

## 6. Export & Import

### 6.1 Export Endpoint

```typescript
// GET /api/content/issue/[issueId]/exportCanonicalBundle

interface CanonicalBundleExport {
  version: 'knyt-canonical-1';
  issueId: string;
  episodeNumber: number;
  cid: string;                    // autonomys://...
  mimeType: string;
  encryptionAlg: string;
  keyWrapAlg: string;
  wrappedKey: string;             // Base64
  metaQubeId: string;
  blakQubeId: string;
  userTokenQubeId: string;
  editionSerial: number;
  coverAssetId: string;
  timestamp: string;              // ISO 8601
}
```

**Behaviour:**
1. Auth, verify `owner_id` matches current user
2. Verify `custody_mode === 'canonical'`
3. Fetch `canonical_bundles` by `issueId`
4. Return JSON bundle for download/storage

### 6.2 Import (Future)

Not mandatory for Phase 2 initial release, but bundle format supports:
- "Import Canonical Issue" flow
- Validation of signatures/content
- Re-import into new environment (user's own Autonomys node)
- Client-side decryption using user's private key

---

## 7. UX Changes

### 7.1 KNYTMall Mint UI

```
┌─────────────────────────────────────────────────┐
│  Mint Digital Scroll - Episode 5                │
├─────────────────────────────────────────────────┤
│                                                 │
│  ○ Custodial Scroll          50 KNYT           │
│    Stream anytime via KNYTMall                  │
│                                                 │
│  ● Canonical Scroll          100 KNYT          │
│    Full ownership + export rights               │
│    Store in cold storage, self-host             │
│                                                 │
│  [Mint Now]                                     │
└─────────────────────────────────────────────────┘
```

### 7.2 Issue Detail (Canonical)

```
┌─────────────────────────────────────────────────┐
│  Episode 5 - Nightfall Variant #3               │
│  ⭐ CANONICAL SCROLL                            │
├─────────────────────────────────────────────────┤
│  [Read Now]  [Watch Motion]  [Export Bundle]    │
└─────────────────────────────────────────────────┘
```

### 7.3 Codex Integration

- Badge: "Owned (Canonical)" vs "Owned (Custodial)"
- Canonical owners see: "This Scroll is yours in the property sense"

---

## 8. Upgrade Path: Custodial → Canonical

Future feature allowing existing custodial owners to upgrade:

```typescript
// POST /api/mint/upgradeToCanonical
interface UpgradeRequest {
  issueId: string;
  // Payment proof for upgrade fee
}

// Behaviour:
// 1. Verify ownership of custodial issue
// 2. Charge upgrade fee in KNYT
// 3. Create canonical_bundle + userTokenQube
// 4. Update custody_mode to 'canonical'
// 5. Keep same edition_serial, cover, etc.
```

---

## 9. Security Considerations

| Aspect | Custodial | Canonical |
|--------|-----------|-----------|
| Key storage | Server (project master key) | User (wrapped with their public key) |
| Decryption | Server-side only | Server OR client-side |
| Export | Not allowed | Allowed (bundle JSON) |
| Revocation | Platform can revoke | Cannot revoke (user holds key) |
| Streaming | Always via platform | Via platform OR self-hosted |

**Critical:**
- Export bundle contains `wrappedKey`, NOT raw symmetric key
- Raw keys never stored unwrapped in DB for canonical issues
- User must have their private key to unwrap

---

## 10. Implementation Checklist

### Database
- [ ] Add `canonical_bundle_id` to `user_issue_qubes`
- [ ] Create `canonical_bundles` table
- [ ] Create `iq_user_token_qubes` table (or extend existing)

### Backend Services
- [ ] `keyWrappingService.ts` - Wrap/unwrap keys with user public keys
- [ ] Extend `mintService.ts` for canonical mode
- [ ] Create `/api/content/issue/[issueId]/exportCanonicalBundle` endpoint

### Frontend
- [ ] Add custody mode selection to mint UI
- [ ] Add "Export Bundle" button for canonical issues
- [ ] Update Codex badges for canonical ownership

### Integration
- [ ] User public key retrieval (from wallet/DID/persona)
- [ ] Bundle download UX (JSON file or QR code)

---

## 11. Dependencies

- **DIDQube / Identity System:** Need user public keys for key wrapping
- **Wallet Integration:** For user keypair access
- **Phase 1 Complete:** Custodial minting must be stable first

---

## 12. Timeline Estimate

| Task | Effort |
|------|--------|
| Data model changes | 1 day |
| Key wrapping service | 2 days |
| Canonical mint flow | 2 days |
| Export endpoint | 1 day |
| UI changes | 2 days |
| Testing | 2 days |
| **Total** | **~10 days** |

---

## 13. Open Questions

1. **Key wrapping algorithm:** X25519-XSalsa20-Poly1305 (NaCl box) vs RSA-OAEP?
2. **User key source:** Wallet-derived vs DIDQube vs separate keypair?
3. **Pricing:** How much premium for canonical vs custodial?
4. **Upgrade fee:** Allow custodial → canonical upgrades? At what cost?

---

*Last updated: December 2024*  
*Author: Cascade AI*  
*Status: BACKLOG - Implement after Phase 1 custodial mints are stable*
