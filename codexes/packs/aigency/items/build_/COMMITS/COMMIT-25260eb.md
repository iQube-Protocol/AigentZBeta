# Commit Brief: `25260eb` — sprint 2 — world id strong verification for citizen passports

| Field | Value |
|-------|-------|
| SHA | [`25260eb`](https://github.com/iQube-Protocol/AigentZBeta/commit/25260ebb5ed51e788c9529fa711b4f71e4748cc1) |
| Author | Claude |
| Date | 2026-06-13T16:39:27Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
sprint 2 — world id strong verification for citizen passports

shipped (per 2026-06-13 hackathon plan §sprint 2):

- services/passport/personhoodProof.ts — adds verifyWorldIdProof against
  the worldcoin cloud verifier (developer.worldcoin.org/api/v2/verify).
  dev fallback accepts 'dev-worldid-{orb,device}' tokens so the flow is
  testable when WORLD_ID_APP_ID is unset. WorldIdProofPayload type
  carries the four IDKit fields (proof, merkle_root, nullifier_hash,
  verification_level).

- supabase/migrations/20260613100000_passport_world_id_verification.sql
  — adds world_id_nullifier_hash, world_id_verification_level,
  world_id_verified_at to polity_passport_records. unique index on
  nullifier_hash enforces 'one human, one verified passport' across
  rows: re-using the same nullifier on a second passport fails 23505.

- POST /api/polity-passport/verify-worldid — spine-authenticated route.
  verifies caller owns the passport (persona_id match), runs
  verifyWorldIdProof, stamps the row, flips passport_grade to
  'verified_citizen'. handles three failure shapes distinctly: 23505
  unique violation → 'this world id already used'; missing column →
  503 naming the migration file; everything else → 500.

- SmartWalletDrawer PassportQube cards — new 'Upgrade with World ID'
  button on citizen passports without verified grade. on success
  optimistically flips grade in-place and renders the 'World ID
  Verified' sky-tinted badge inline with status/grade. error message
  surfaces under the button. non-verified passports remain first-class
  (PRD §6.1 contract preserved — verified is additive, never
  demoting).

  client-side world id flow: dynamically imports @worldcoin/idkit when
  available; otherwise falls back to a dev-worldid-orb token (server
  accepts it when WORLD_ID_APP_ID unset). production wiring of
  IDKitWidget for the real modal flow lands in a follow-up component
  (noted inline).

- scripts/create-env-production.js — adds WORLD_ID_APP_ID,
  WORLD_ID_ACTION_ID, NEXT_PUBLIC_WORLD_ID_APP_ID,
  NEXT_PUBLIC_WORLD_ID_ACTION_ID to the allowlist.

t0 discipline: nullifier_hash is a ZK-derived public commitment — T1-safe,
travels to the credential envelope and the wallet ui. persona_id never
serialises in any world id response.

operator steps to enable real world id verification:
1. dev.worldcoin.org → create app → register action 'polity-passport-verify'
2. set WORLD_ID_APP_ID, WORLD_ID_ACTION_ID,
   NEXT_PUBLIC_WORLD_ID_APP_ID, NEXT_PUBLIC_WORLD_ID_ACTION_ID in amplify
3. install @worldcoin/idkit
4. run the migration in supabase sql editor
```

## Body

shipped (per 2026-06-13 hackathon plan §sprint 2):

- services/passport/personhoodProof.ts — adds verifyWorldIdProof against
  the worldcoin cloud verifier (developer.worldcoin.org/api/v2/verify).
  dev fallback accepts 'dev-worldid-{orb,device}' tokens so the flow is
  testable when WORLD_ID_APP_ID is unset. WorldIdProofPayload type
  carries the four IDKit fields (proof, merkle_root, nullifier_hash,
  verification_level).

- supabase/migrations/20260613100000_passport_world_id_verification.sql
  — adds world_id_nullifier_hash, world_id_verification_level,
  world_id_verified_at to polity_passport_records. unique index on
  nullifier_hash enforces 'one human, one verified passport' across
  rows: re-using the same nullifier on a second passport fails 23505.

- POST /api/polity-passport/verify-worldid — spine-authenticated route.
  verifies caller owns the passport (persona_id match), runs
  verifyWorldIdProof, stamps the row, flips passport_grade to
  'verified_citizen'. handles three failure shapes distinctly: 23505
  unique violation → 'this world id already used'; missing column →
  503 naming the migration file; everything else → 500.

- SmartWalletDrawer PassportQube cards — new 'Upgrade with World ID'
  button on citizen passports without verified grade. on success
  optimistically flips grade in-place and renders the 'World ID
  Verified' sky-tinted badge inline with status/grade. error message
  surfaces under the button. non-verified passports remain first-class
  (PRD §6.1 contract preserved — verified is additive, never
  demoting).

  client-side world id flow: dynamically imports @worldcoin/idkit when
  available; otherwise falls back to a dev-worldid-orb token (server
  accepts it when WORLD_ID_APP_ID unset). production wiring of
  IDKitWidget for the real modal flow lands in a follow-up component
  (noted inline).

- scripts/create-env-production.js — adds WORLD_ID_APP_ID,
  WORLD_ID_ACTION_ID, NEXT_PUBLIC_WORLD_ID_APP_ID,
  NEXT_PUBLIC_WORLD_ID_ACTION_ID to the allowlist.

t0 discipline: nullifier_hash is a ZK-derived public commitment — T1-safe,
travels to the credential envelope and the wallet ui. persona_id never
serialises in any world id response.

operator steps to enable real world id verification:
1. dev.worldcoin.org → create app → register action 'polity-passport-verify'
2. set WORLD_ID_APP_ID, WORLD_ID_ACTION_ID,
   NEXT_PUBLIC_WORLD_ID_APP_ID, NEXT_PUBLIC_WORLD_ID_ACTION_ID in amplify
3. install @worldcoin/idkit
4. run the migration in supabase sql editor

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/polity-passport/verify-worldid/route.ts` |
| Modified | `app/components/content/SmartWalletDrawer.tsx` |
| Modified | `scripts/create-env-production.js` |
| Modified | `services/passport/personhoodProof.ts` |
| Added | `supabase/migrations/20260613100000_passport_world_id_verification.sql` |

## Stats

 5 files changed, 423 insertions(+), 8 deletions(-)
