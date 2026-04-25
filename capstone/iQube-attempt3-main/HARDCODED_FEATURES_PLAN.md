# Hardcoded & Placeholder Features — Implementation Plan

This document lists every feature in the iQube frontend that is currently **UI-only** (stored as metadata labels but not enforced) and outlines how to make each one real.

---

## 1. Access Policy ("Only Me" / "Specific Addresses" / "Open with Conditions")

**Current state:** Stored as a string in IPFS metadata (`accessPolicy: "only-me"`). Nothing enforces it. Anyone with the IPFS hash can read the public metadata.

**How to make it real:**

- **Option A — Smart contract enforcement:** Add an `accessControl` mapping on-chain. `mintQube` stores allowed addresses. Add a `requestAccess(tokenId)` function that checks if `msg.sender` is in the allowed list before returning the wrapped key or granting a "viewer" role. This is the strongest approach but requires a contract upgrade/redeployment.

- **Option B — Server-side gatekeeper:** Build a backend endpoint (`GET /api/iqubes/:tokenId/key`) that:
  1. Verifies the caller's wallet signature (EIP-712 or personal_sign)
  2. Checks the access policy stored in Supabase
  3. If `only-me`: only returns the wrapped key to the minter/owner
  4. If `specific`: checks if caller is in the `allowed_addresses` list
  5. If `requirements`: checks whatever conditions you define
  6. Returns the wrapped key only if authorized

  This keeps the contract simple and moves access logic to the server.

**Recommended:** Option B for the capstone. It's faster to build and doesn't require redeploying the contract. The server becomes the gatekeeper for wrapped keys.

**Effort:** ~8 hours (backend endpoint + frontend changes to call it instead of reading Supabase directly)

---

## 2. Business Model (Free / Buy / Subscribe / Rent / License / Donate)

**Current state:** Stored as a string in IPFS metadata. No payments happen.

**How to make it real:**

- Add a `purchaseAccess(tokenId)` payable function to the smart contract that:
  1. Reads a `price` mapping set at mint time
  2. Requires `msg.value >= price`
  3. Transfers funds to the owner
  4. Grants the buyer access (adds them to the allowed list)

- For **Subscribe** and **Rent**: These need time-based access. Options:
  - Store `accessExpiry[tokenId][address]` on-chain and check `block.timestamp`
  - Or handle it server-side with Supabase: store `expires_at` per user and check before returning keys

- For **Donate**: Same as Free but with an optional payment field in the UI

**Effort:** ~12 hours for Buy (contract + frontend). Subscribe/Rent add ~8 more hours.

---

## 3. Visibility (Private / Semi-Private / Public)

**Current state:** Stored as a string. The Registry page filters by `visibility === "public"`, but all iQubes are technically discoverable in Supabase if someone queries directly.

**How to make it real:**

- **Supabase Row-Level Security (RLS):**
  - `public` iQubes: readable by anyone (anon key)
  - `semi-private` iQubes: readable only by `owner_address` and addresses in `allowed_addresses`
  - `private` iQubes: readable only by `owner_address`

- Add RLS policies on the `iqubes` table:
  ```sql
  -- Public: anyone can read
  CREATE POLICY "public_read" ON iqubes FOR SELECT
    USING (visibility = 'public');

  -- Owner can always read their own
  CREATE POLICY "owner_read" ON iqubes FOR SELECT
    USING (owner_address = auth.jwt()->>'wallet_address');
  ```

- This requires **Supabase Auth** integration — users would need to authenticate with their wallet (sign a message → get a JWT). Currently we use the anon key which has no user identity.

**Effort:** ~6 hours (Supabase Auth + RLS policies + frontend auth flow)

---

## 4. Risk Score

**Current state:** Auto-calculated client-side from `sensitivity * 0.5 + (10 - verifiability) * 0.5`. The `verifiability` and `accuracy` values are hardcoded to `5`.

**How to make it real:**

- Let the user set **verifiability** (how easy is it to verify this data is authentic?) and **accuracy** (how reliable is this data?) in the wizard — Step 5 or a new step
- Or compute them from the data: e.g., if the iQube links to a verified API endpoint, verifiability is high
- The risk score itself doesn't need on-chain enforcement — it's informational. But it should reflect real inputs, not hardcoded 5s.

**Effort:** ~2 hours (add sliders/inputs to wizard, wire to calculation)

---

## 5. Permissions (canView / canUse / canEdit / canDecrypt / canFork)

**Current state:** Set in `WizardState` but never stored anywhere — not in IPFS metadata, not in Supabase, not on-chain. Completely unused.

**How to make it real:**

- **Step 1:** Store in IPFS metadata and Supabase alongside the other fields
- **Step 2:** Enforce in the gatekeeper server:
  - `canView`: Can see that the iQube exists in the registry
  - `canDecrypt`: Can retrieve the wrapped key and decrypt BlakQube
  - `canUse`: Can call the iQube's API/tool (for ToolQubes/AgentQubes)
  - `canEdit`: Can update the iQube metadata (would need an `updateMetadata` contract function)
  - `canFork`: Can create a derivative iQube based on this one

**Effort:** ~4 hours to store. ~12+ hours to enforce all five permissions server-side.

---

## 6. Allowed Addresses (for "Specific Addresses" access policy)

**Current state:** User types comma-separated addresses in Step 4. Stored in `WizardState.allowedAddresses` but **never saved** — not in IPFS metadata, not in Supabase, not on-chain.

**How to make it real:**

- Store in IPFS metadata as an `allowedAddresses` attribute
- Store in Supabase in a separate `iqube_access_list` table: `(token_id, address, granted_by, granted_at)`
- Gatekeeper server checks this table before returning wrapped keys

**Effort:** ~3 hours

---

## 7. Price Field

**Current state:** User enters a price in Step 4. Stored in `WizardState.price` but only saved to Supabase as a string — no payment logic.

**How to make it real:**

- See Business Model section (#2 above) — the price needs to be stored on-chain in the `purchaseAccess` flow
- Display the price in the Registry so buyers know the cost
- Currently stored in Supabase `iqubes.price` as a string — good for display, but payments need smart contract support

**Effort:** Included in Business Model estimate above

---

## Priority Order for Implementation

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Allowed Addresses (store + enforce) | 3 hrs | Unlocks "share with specific wallets" |
| 2 | Visibility (Supabase RLS) | 6 hrs | Real privacy for private iQubes |
| 3 | Access Policy (server gatekeeper) | 8 hrs | Core security model |
| 4 | Permissions (store first) | 4 hrs | Foundation for granular control |
| 5 | Risk Score (real inputs) | 2 hrs | Better risk assessment |
| 6 | Business Model (Buy) | 12 hrs | Enables marketplace payments |
| 7 | Business Model (Subscribe/Rent) | 8 hrs | Advanced payment models |

---

## Supabase Tables Needed

You currently have: `iqube_wrapped_keys`

You now also need (added with this update): `iqubes`

Still needed for full enforcement:
- `iqube_access_list` — (token_id, address, permission_level, granted_by, expires_at)
- Supabase Auth integration for RLS
