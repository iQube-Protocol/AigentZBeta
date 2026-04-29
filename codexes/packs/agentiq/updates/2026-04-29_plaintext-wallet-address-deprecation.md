# Plaintext Wallet Address Deprecation — Step 1 of Wallet Alias Privacy Refactor

**Date:** 2026-04-29
**Status:** Live on `claude/confirm-aigentz-access-VnNTK` → dev
**Severity:** Privacy / identity sovereignty
**Sprint position:** Step 1 of 4 (this) → Step 2 cohort backlog → Step 3 wallet aliases → Step 4 UI migration

---

## Why

The migrations `20251215_add_persona_wallet_addresses.sql` and `20251216_add_persona_wallet_addresses.sql` introduced plaintext columns `evm_address`, `btc_address`, `sol_address` on the `personas` (and `persona`) tables. These columns directly contradict the four-layer identity sovereignty model documented in `IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md`.

Specifically, plaintext wallet addresses on a persona create a **linkage attack surface**: any party with database access (or read access to the persona detail API) can correlate one wallet address to one persona, and across personas owned by the same root identity, deanonymise an otherwise pseudonymous persona by association.

The architecture for solving this already exists. The Escrow ICP canister (`services/ops/idl/escrow.ts`) provides the primitives — `register_alias(commitment, mailbox, ttl)`, `compute_cohort`, `purge_expired` — used by the cohort/escrow scheme designed in `2026-04-27_cohort-escrow-root-did-reputation-backlog.md`. Wallet linkage should follow the same commitment-only pattern.

---

## What changed in this commit

### 1. API guard — `app/api/identity/persona/[id]/route.ts`
The PATCH route now rejects any request that includes `evm_address`, `btc_address`, or `sol_address` with a non-empty value. Returns HTTP 410 (Gone) with `error: 'plaintext_wallet_write_disabled'`.

Escape hatch (legacy admin sync only): set environment variable `ALLOW_LEGACY_PLAINTEXT_WALLET_WRITE=true`. Default OFF in all environments. Document and remove this hatch when the alias scheme is live.

### 2. UI — `app/components/wallet/PersonaEditModal.tsx`
- Wallet address fields are now read-only displays (no editing)
- An amber notice explains the change and points users to the External Wallet section in the Smart Wallet drawer
- The PATCH body no longer sends `evm_address`, `btc_address`, `sol_address`
- Unused address validators removed

### 3. Migration deprecation comments
- `supabase/migrations/20251215_add_persona_wallet_addresses.sql` — header marked DEPRECATED
- `supabase/migrations/20251216_add_persona_wallet_addresses.sql` — header marked DEPRECATED
- Columns remain for read compatibility until a follow-up migration drops them in step 4

### 4. Identity doc addendum — `AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md`
Added Section 15: kybe_DiD addendum. Clarifies that the human identity stack has **five layers** (kybe_DiD → Root DiD → Persona → FIO Handle → FIO PK) while the Aigent stack has four (Root DiDQube is the deepest). Forward-looking only — no kybe_DiD implementation yet.

---

## What this does NOT change yet

- The columns themselves still exist in the database (drop comes in step 4)
- Existing plaintext addresses are still readable and still sync to FIO via `addpubaddress` (this is itself a privacy concern — addressed in step 3 with stealth/OTA scheme)
- Admin agent-key flows (`/api/admin/register-agent-keys`, `/api/admin/register-multichain-keys`) still write `agent_keys.evm_address` — these are system-generated agent keys with a different threat model and are not in scope for this change
- The admin sync route `/api/admin/identity/sync-persona-evm-addresses` will fail under the new guard unless the legacy escape hatch is set; this is acceptable until step 3 replaces it with the alias scheme

---

## Sprint plan reference

| Step | Title | Status |
|------|-------|--------|
| **1** | **Plaintext wallet write deprecation (this)** | ✅ Live |
| 2 | Cohort/escrow primitives — see `2026-04-27_cohort-escrow-root-did-reputation-backlog.md` | Backlog |
| 3 | Wallet alias commitment scheme + DVN OTA service | Not started |
| 4 | UI migration (External Wallet drawer → alias flow) + drop deprecated columns | Not started |

---

## Files touched

| File | Change |
|------|--------|
| `app/api/identity/persona/[id]/route.ts` | Add PATCH guard, escape-hatch env var |
| `app/components/wallet/PersonaEditModal.tsx` | Read-only wallet display, drop fields from PATCH body, remove unused validators |
| `supabase/migrations/20251215_add_persona_wallet_addresses.sql` | Deprecation header |
| `supabase/migrations/20251216_add_persona_wallet_addresses.sql` | Deprecation header |
| `codexes/packs/agentiq/items/AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` | Section 15: kybe_DiD addendum |
| `codexes/packs/agentiq/updates/2026-04-29_plaintext-wallet-address-deprecation.md` | This doc |
| `codexes/packs/agentiq/collections.json` | Register this doc under `col_updates` |

---

## Verification

- PATCH `/api/identity/persona/{id}` with `{ "evm_address": "0x..." }` → HTTP 410, no DB write
- PATCH `/api/identity/persona/{id}` with `{ "display_name": "X" }` → still works
- PersonaEditModal save flow → no longer mutates wallet address columns
- Reading existing personas via GET still returns wallet address fields (backward compatible)
- With `ALLOW_LEGACY_PLAINTEXT_WALLET_WRITE=true`, writes proceed (admin sync escape hatch)
