# Phase 2 — WIP vs Canonical (iQube Mint) Plan

**Status:** backlog · queued for Phase 2 build after admin panel WIP-flow ships
**Owner:** TBD
**Pack:** agentiq/updates

This document captures the architecture for converting gated content (PDFs, video, image masters) from **Phase 1 Supabase-hosted entitlement-gated assets** to **Phase 2 fully-encrypted iQubes**. It locks in the specifics of how WIP vs canonical works, how mint operations compose, and how access models differ — so the design is preserved when build begins.

---

## Phase 1 (current state)

- Gated content uploaded to Supabase Storage. URL stored as the `auto_drive_cid` value on `master_content_qubes` rows (interim overload — column holds either a real Auto-Drive CID *or* a Supabase URL, distinguished by `startsWith('http')`).
- Access gated by entitlement check at the server-side proxy (`/api/content/pdf-page-by-master/[masterId]`), which validates the persona's ownership against `user_entitlements`/`store_skus` SKU expansion before streaming page bytes.
- WIP files can be replaced/overwritten via the admin panel "Replace file" affordance (Supabase items only — same `base_path + filename` overwrite so the URL stays stable and no DB pointer needs updating).
- Promote-to-Auto-Drive is a manual admin action that uploads the Supabase WIP to Auto-Drive and swaps the pointer. **In Phase 1 this is a plain upload (encryption optional); in Phase 2 it becomes the iQube mint.**

## Phase 2 transition

Replace the entitlement-gated proxy model with a fully encrypted, on-chain-token-gated model. Storage layer is **encrypted at rest** even when hosted on Supabase or Auto-Drive; decryption requires possession of a tokenQube.

### Schema disambiguation (required before Phase 2 build)

The current overload of `auto_drive_cid` (URL or CID) blurs WIP vs canonical state. Phase 2 schema:

```sql
ALTER TABLE master_content_qubes
  ADD COLUMN wip_storage_url TEXT,                -- Supabase WIP path; nullable; mutable
  ADD COLUMN mint_status TEXT NOT NULL DEFAULT 'wip', -- 'wip' | 'minted'
  ADD CONSTRAINT mint_status_check CHECK (mint_status IN ('wip','minted'));
-- auto_drive_cid stays as the canonical Autonomys CID column;
-- after this migration it is set ONLY when mint_status='minted'
-- and is never a URL.
```

Backfill: rows where `auto_drive_cid LIKE 'http%'` → move value to `wip_storage_url`, null `auto_drive_cid`, set `mint_status='wip'`. Rows with real CIDs → leave `auto_drive_cid`, null `wip_storage_url`, set `mint_status='minted'`.

### Mint = iQube atomic operation

In Phase 2, "Promote to Auto-Drive" becomes "Mint as iQube". A single atomic operation:

1. Generate content key (AES-256, asset-keyed — see Update Semantics below).
2. Encrypt the blob with the content key → ciphertext (this **is** the blakQube payload).
3. Upload ciphertext to Autonomys → receive immutable CID.
4. Generate tokenQube:
   - Wrap content key with persona's master key.
   - Mint NFT on-chain (Base for alpha; eventually one of the 7 ref chains based on persona's chain preference).
   - **On-chain artifact holds a *pointer* to the wrapped key blob** (the wrapped-key bytes themselves never go on-chain). The wrapped-key blob lives on IPFS or Auto-Drive alongside the metaQube; the on-chain NFT commits to the blob's hash + URI. This keeps mint cost predictable across chains regardless of key/envelope size.
5. Generate metaQube (non-sensitive descriptor: title, type, license, author, etc.) → upload to IPFS or Auto-Drive (configurable per-cartridge/per-cohort).
6. Atomically record on `master_content_qubes`:
   - `auto_drive_cid` = Autonomys CID
   - `token_qube_id` = tokenQube row id
   - `meta_qube_id` = metaQube row id
   - `blak_qube_id` = blakQube row id
   - `mint_status` = `'minted'`
   - Null out `wip_storage_url`

### Update semantics — asset-keyed (not version-keyed)

When a *minted* iQube's underlying file is updated:

- The content key **does not change** across versions.
- The new file is encrypted with the same content key → new ciphertext → new Autonomys CID.
- `auto_drive_cid` is updated to the new CID. The old CID remains permanently on Autonomys (immutable) but is no longer the active pointer.
- **Existing tokenQubes remain valid** — they unwrap the same content key, which decrypts the new ciphertext.
- All current holders retain access without re-issuance.

The alternative — version-keyed (new key per version) — would invalidate every holder's tokenQube on every update. Rejected as a default. Reserved for explicit "republish-as-new-asset" admin actions where the new version is a different iQube with its own mint.

### Access models (both must be supported, can coexist on the same platform)

The platform must implement **both** of these from day one of Phase 2 — one for **streaming/access**, one for **ownership/sovereignty**. They share the same encryption-key layer; the difference is purely in token issuance and on-chain semantics.

#### A. Pool / access-token — STREAMING / ACCESS

- **Intent:** access to the asset (read, watch, listen). Holder doesn't own the asset itself; they hold a license to consume it.
- One ciphertext on Autonomys, one content key.
- N tokenQubes minted, each wraps the same content key.
- Tokens are transferable, revocable, and can be issued per-cohort or per-subscription.
- Use cases: shared editions, "subscribe to read", per-cohort licenses, KS-backer rewards, time-limited campaign drops.
- **Delivery options:**
  - **Deferred minting:** at access time, the platform mints a fresh access-tokenQube to the requesting persona on demand (lazy issuance). Cheap for the platform until access is actually requested.
  - **Bulk pre-mint:** a fixed pool of N access tokens minted up front and distributed.

#### B. Canonical NFT — OWNERSHIP / SOVEREIGNTY

- **Intent:** ownership of a non-fungible edition. Each holder holds a unique on-chain asset they can sell, lend, transfer, or use as collateral.
- Same one ciphertext on Autonomys, same one content key.
- Each holder gets a unique tokenQube — itself a non-fungible NFT on the native chain.
- Each tokenQube wraps the same content key (so all holders decrypt the same encrypted asset), but each token is a unique on-chain artifact with sovereign transfer semantics.
- Use cases: collector editions, 1-of-N rare drops, founder NFTs, signed editions.
- **Delivery:** canonical pre-mint at iQube creation time (no deferred option — sovereignty implies the on-chain edition exists from t=0).

#### Mixing models on the same asset

A single platform mint can publish both surfaces against the same encrypted payload — e.g., 100 canonical NFTs (Model B, sovereign owners) + a public access-pool tokenQube (Model A, anyone with a subscription can stream). Operator picks the model(s) at mint time.

### Storage layout summary

| Component | Storage | Mutable? | Notes |
|---|---|---|---|
| Encrypted payload (blakQube) | Autonomys (canonical) or Supabase (WIP) | Encrypted bytes immutable per CID; pointer can change on update | Same encryption applies to WIP if iQube model is bound |
| tokenQube on-chain artifact | Native chain NFT (Base for alpha; 7 ref chains eventually) | Transferable, revocable per token | Holds **a pointer (URI + content hash) to the wrapped-key blob** — never the wrapped-key bytes themselves |
| Wrapped-key blob | IPFS or Auto-Drive sidecar (alongside metaQube) | Immutable per content-addressed hash | Wrapped content key in cleartext-but-encrypted-with-master-key form; only resolvable by the holding persona |
| metaQube | IPFS or Auto-Drive (configurable) | Updated only on metadata change | Non-sensitive descriptor |
| Registry row | Supabase `master_content_qubes` | Pointer-mutable (CID + status) | Operational state, not the source of truth on-chain |

### Access-control boundaries (Phase 2)

- WIP/Supabase content: gated by entitlement check at the proxy (Phase 1 model carries forward for unminted content).
- Canonical/iQube content: gated by tokenQube ownership proof — client presents a signed message proving control of the on-chain token; server validates the proof + on-chain ownership and only then unwraps the key path or streams a server-rendered preview (page-image) of the decrypted content.
- The proxy route (`/api/content/pdf-page-by-master/[masterId]`) switches its decryption logic based on `mint_status`:
  - `wip` → entitlement check + Supabase fetch + (optional Phase 1.5 encryption)
  - `minted` → tokenQube proof check + Autonomys fetch + decrypt with unwrapped key

Both modes return the same output (server-rendered page WebP). The browser never sees ciphertext, never sees CID/URL, never sees the content key.

### Operator UX — admin panel evolution

| Phase | WIP action | Canonical action |
|---|---|---|
| 1 (now) | "Replace file" — overwrite Supabase blob at same path | "Upload to Auto-Drive" — manual one-shot promotion (no encryption) |
| 1.5 (optional) | Add server-side encryption of WIP Supabase blobs (still entitlement-gated) | Same |
| 2 | "Replace file" — overwrite encrypted blob; key unchanged | "Mint as iQube" — atomic content-key + Auto-Drive + tokenQube + metaQube |
| 2 | After mint: WIP path nulled; row immutable except via "Issue new tokenQube" or "Republish as new asset" | "Issue new tokenQube" (pool model: add holder) / "Mint NFT to holder" (canonical model) |

### Minting cost considerations

- **Wrapped key never goes on-chain** (locked-in design). The on-chain NFT only holds a pointer (URI + content hash) to the wrapped-key blob stored alongside the metaQube on IPFS/Auto-Drive. Mint cost is therefore independent of envelope/key size, predictable across all 7 ref chains.
- Cross-chain: tokenQube minting must be batched per chain. Allow the operator to pre-select the target chain at mint time; default to the persona's preferred chain for the cartridge (Base for alpha).
- **Deferred-mint optimisation (Model A only):** for streaming/access pools, defer the per-holder NFT mint until first access is requested. The platform pays gas only for tokens that actually get used. Not applicable to Model B (sovereignty NFTs are pre-minted by definition).

### What this preserves vs Phase 1

- Same `master_content_qubes` table — no migration of existing rows beyond the schema disambiguation above.
- Same proxy route — extended with a tokenQube-proof branch.
- Same admin panel — the "Promote" button becomes "Mint" with additional fields (chain, access model, edition count for canonical NFTs).
- Same SmartContentItem types in client code — `pdf_master_id` resolution unchanged; client never needed to know the storage layer.

### Locked-in design decisions (confirmed)

1. **Update semantics: asset-keyed** (one content key per asset, stable across versions). Updates re-encrypt with the same key → new ciphertext + new CID + same tokenQubes. Existing holders' rights persist. Version-keyed rejected.
2. **Mint = atomic operation** combining Auto-Drive upload + tokenQube creation + metaQube creation. "Promote to Auto-Drive" admin action becomes "Mint as iQube".
3. **Both access models supported from day one of Phase 2** — Pool/access-token (streaming) AND Canonical NFT (ownership/sovereignty). Pool can use deferred minting; canonical is always pre-minted.
4. **tokenQube on-chain artifact holds a pointer to the wrapped-key blob, never the bytes.** Wrapped-key blob lives on IPFS/Auto-Drive alongside the metaQube.
5. **Phase 2 schema disambiguation:** `wip_storage_url` (nullable, mutable) + `auto_drive_cid` (nullable, set only on mint, never a URL) + `mint_status` enum (`wip` | `minted`). `auto_drive_cid` overload retired.

### Open questions for Phase 2 kickoff

1. Cross-chain mint UX: do we mint on one chain at promote time and bridge later, or mint on all 7 ref chains atomically? (Suggest: mint on persona's primary chain only at promotion; bridging is a separate operation.)
2. Multi-recipient envelope encryption (Pool model): single wrapped key per token vs envelope-per-recipient? (Suggest: per-token wrap, simpler revocation.)
3. metaQube updates: how often, who can update, do we version metaQubes alongside content versions? (Suggest: metaQube is mostly stable; bump only on title/license changes.)
4. Republish as new asset (creates new content key + new metaQube + new tokenQube) — UX flow and how it relates to the original iQube's holders.
5. Deferred-mint trigger (Pool model): mint at first access request, or at entitlement grant time (purchase/cohort assignment)? Latter is simpler for revocation, former is cheapest in gas.

---

## Reference

- Phase 1 gated-content rules: `CLAUDE.md` § Gated Content — Confidential Exposure Rules (PARAMOUNT)
- Existing schema: `scripts/create-codex-content-tables.sql` (master_content_qubes, iq_token_qubes, iq_meta_qubes, iq_blak_qubes)
- Phase 1 proxy: `app/api/content/pdf-page-by-master/[masterId]/route.ts`
- Token gating workstream: `codexes/packs/agentiq/updates/2026-05-02_iqube-encryption-of-gated-content-backlog.md` (predecessor doc)
