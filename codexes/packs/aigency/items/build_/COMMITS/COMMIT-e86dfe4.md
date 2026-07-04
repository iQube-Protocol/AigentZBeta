# Commit Brief: `e86dfe4` — sprint 5 — delegation tab in passport + agentkit attestation bridge

| Field | Value |
|-------|-------|
| SHA | [`e86dfe4`](https://github.com/iQube-Protocol/AigentZBeta/commit/e86dfe4a059d8813ab25e19d6e3da65872e63f15) |
| Author | Claude |
| Date | 2026-06-13T17:41:06Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
sprint 5 — delegation tab in passport + agentkit attestation bridge

shipped (per 2026-06-13 hackathon plan §sprint 5):

architecture contract: agentkit operates WITHIN the bounded-delegation
framework — it does not replace it. our framework remains the source of
truth (who delegates to whom, with what scope, for how long). agentkit
attaches a cryptographic attestation on top that downstream verifiers
can use to confirm 'this delegation came from a verified human' without
learning who. when sponsor is NOT world id verified, grant remains
valid — attestation just doesn't carry the verified_human flag.

- supabase/migrations/20260613400000_delegation_agentkit_attestations.sql
  - delegation_agentkit_attestations table: attestation_token (opaque),
    attestation_ref (T1 receipt), verified_human bool, mode (stub|live),
    expires_at, revoked_at. T0 discipline: sponsor_persona_id
    server-internal; sponsor_passport_id + nullifier T1-safe.
  - RLS: sponsors read own attestations; verifiers verify
    cryptographically via the token, not via the row.

- services/delegation/agentKitBridge.ts — issueAgentKitAttestation +
  verifyAgentKitAttestation. stub mode emits a JWT-shape token (base64
  payload + 'agentkit-stub' + hmac signature) keyed off AGENTKIT_STUB_KEY
  so the verify endpoint can recompute deterministically. live mode
  (TBD on canonical SDK shape) currently throws — install the agentkit
  sdk + configure AGENTKIT_API_KEY + AGENTKIT_ATTEST_URL when ready.

- POST /api/access/delegation/agentkit-attest — issue an attestation:
  1. spine-auth; caller must own the sponsor passport (citizen-only).
  2. fetches world_id_nullifier_hash + world_id_verified_at from
     polity_passport_records.
  3. resolves the agent's did_uri from agent_root_identity.
  4. calls issueAgentKitAttestation; persists the receipt; returns
     token + ref + verified_human flag.
- GET /api/access/delegation/agentkit-attest?token=<...> — public
  verification endpoint (verifiers may not have spine auth). returns
  decoded payload when token signature checks; 401 otherwise.

- delegation tab mounted as a first-class passport tab in:
  - POLITY_PASSPORT_BUREAU_CARTRIDGE (new 'delegation' tabGroup, order 3)
  - AGENTIQ_CARTRIDGE (agentiq-passport-delegation, order 3)
  - AGENTIQ_OS_CARTRIDGE (agentiq-os-passport-delegation, order 3)
  reuses BoundedDelegationTab unchanged — no fork.

- scripts/create-env-production.js — adds AGENTKIT_API_KEY,
  AGENTKIT_POLICY_ID, AGENTKIT_ATTEST_URL, AGENTKIT_STUB_KEY to the
  allowlist.

operator step: run migration 20260613400000_delegation_agentkit_attestations.sql
in supabase sql editor. attestation flow works in stub mode today —
real agentkit slot lands behind env vars.
```

## Body

shipped (per 2026-06-13 hackathon plan §sprint 5):

architecture contract: agentkit operates WITHIN the bounded-delegation
framework — it does not replace it. our framework remains the source of
truth (who delegates to whom, with what scope, for how long). agentkit
attaches a cryptographic attestation on top that downstream verifiers
can use to confirm 'this delegation came from a verified human' without
learning who. when sponsor is NOT world id verified, grant remains
valid — attestation just doesn't carry the verified_human flag.

- supabase/migrations/20260613400000_delegation_agentkit_attestations.sql
  - delegation_agentkit_attestations table: attestation_token (opaque),
    attestation_ref (T1 receipt), verified_human bool, mode (stub|live),
    expires_at, revoked_at. T0 discipline: sponsor_persona_id
    server-internal; sponsor_passport_id + nullifier T1-safe.
  - RLS: sponsors read own attestations; verifiers verify
    cryptographically via the token, not via the row.

- services/delegation/agentKitBridge.ts — issueAgentKitAttestation +
  verifyAgentKitAttestation. stub mode emits a JWT-shape token (base64
  payload + 'agentkit-stub' + hmac signature) keyed off AGENTKIT_STUB_KEY
  so the verify endpoint can recompute deterministically. live mode
  (TBD on canonical SDK shape) currently throws — install the agentkit
  sdk + configure AGENTKIT_API_KEY + AGENTKIT_ATTEST_URL when ready.

- POST /api/access/delegation/agentkit-attest — issue an attestation:
  1. spine-auth; caller must own the sponsor passport (citizen-only).
  2. fetches world_id_nullifier_hash + world_id_verified_at from
     polity_passport_records.
  3. resolves the agent's did_uri from agent_root_identity.
  4. calls issueAgentKitAttestation; persists the receipt; returns
     token + ref + verified_human flag.
- GET /api/access/delegation/agentkit-attest?token=<...> — public
  verification endpoint (verifiers may not have spine auth). returns
  decoded payload when token signature checks; 401 otherwise.

- delegation tab mounted as a first-class passport tab in:
  - POLITY_PASSPORT_BUREAU_CARTRIDGE (new 'delegation' tabGroup, order 3)
  - AGENTIQ_CARTRIDGE (agentiq-passport-delegation, order 3)
  - AGENTIQ_OS_CARTRIDGE (agentiq-os-passport-delegation, order 3)
  reuses BoundedDelegationTab unchanged — no fork.

- scripts/create-env-production.js — adds AGENTKIT_API_KEY,
  AGENTKIT_POLICY_ID, AGENTKIT_ATTEST_URL, AGENTKIT_STUB_KEY to the
  allowlist.

operator step: run migration 20260613400000_delegation_agentkit_attestations.sql
in supabase sql editor. attestation flow works in stub mode today —
real agentkit slot lands behind env vars.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/access/delegation/agentkit-attest/route.ts` |
| Modified | `data/codex-configs.ts` |
| Modified | `scripts/create-env-production.js` |
| Added | `services/delegation/agentKitBridge.ts` |
| Added | `supabase/migrations/20260613400000_delegation_agentkit_attestations.sql` |

## Stats

 5 files changed, 475 insertions(+), 1 deletion(-)
