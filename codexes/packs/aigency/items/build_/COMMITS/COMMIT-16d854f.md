# Commit Brief: `16d854f` — sprint 6 — partial provekit zk for personhood + delegation authority

| Field | Value |
|-------|-------|
| SHA | [`16d854f`](https://github.com/iQube-Protocol/AigentZBeta/commit/16d854f482367b5166247f00565c00dfa8b3c38a) |
| Author | Claude |
| Date | 2026-06-13T17:43:19Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
sprint 6 — partial provekit zk for personhood + delegation authority

shipped (per 2026-06-13 hackathon plan §sprint 6 operator-cut):

in-demo circuits (zk-verified):
  - proof_of_personhood: citizen has active+claimed passport, no PII
  - proof_of_delegation_authority: agent persona delegated by active
    citizen, neither identity revealed

phase B circuits (shaped placeholders, returns notYetImplemented=true):
  - proof_of_passport_standing
  - proof_of_document_possession
  - proof_of_mobility_authorization

- services/proof/provekit/index.ts — generateProveKitProof +
  verifyProveKitProof. typed overloads per circuit. stub mode emits
  deterministic 'provekit:<circuit>:stub:<hash>.<sig>' tokens that the
  verifier can recompute end-to-end. live mode (TBD on canonical SDK
  shape) throws until @provekit packages install + env set.

- POST /api/polity-passport/attest/[type] — spine-auth. for personhood:
  fetches passport, validates citizen + active + claimed + ownership;
  threads world_id_nullifier_hash through to the proof input. for
  delegation_authority: validates sponsor owns the citizen passport,
  then issues. for phase B types: returns shaped placeholder so the
  end-to-end demo path completes.

- POST /api/polity-passport/verify/[type] — public CORS-enabled. for
  in-demo circuits: recomputes signature, returns commitmentRef on
  success. for phase B: returns ok:true valid:false notYetImplemented:
  true so the verifier surface shows the shape but signals 'this
  circuit ships post-submission'.

- scripts/create-env-production.js — adds PROVEKIT_API_KEY,
  PROVEKIT_CIRCUIT_REGISTRY to allowlist.

T0 discipline: persona_id never serialises in proof input; passport_id,
nullifier_hash (T1-safe), grant_id (T1-safe), agent did_uri (public)
are the only inputs to circuit generation.
```

## Body

shipped (per 2026-06-13 hackathon plan §sprint 6 operator-cut):

in-demo circuits (zk-verified):
  - proof_of_personhood: citizen has active+claimed passport, no PII
  - proof_of_delegation_authority: agent persona delegated by active
    citizen, neither identity revealed

phase B circuits (shaped placeholders, returns notYetImplemented=true):
  - proof_of_passport_standing
  - proof_of_document_possession
  - proof_of_mobility_authorization

- services/proof/provekit/index.ts — generateProveKitProof +
  verifyProveKitProof. typed overloads per circuit. stub mode emits
  deterministic 'provekit:<circuit>:stub:<hash>.<sig>' tokens that the
  verifier can recompute end-to-end. live mode (TBD on canonical SDK
  shape) throws until @provekit packages install + env set.

- POST /api/polity-passport/attest/[type] — spine-auth. for personhood:
  fetches passport, validates citizen + active + claimed + ownership;
  threads world_id_nullifier_hash through to the proof input. for
  delegation_authority: validates sponsor owns the citizen passport,
  then issues. for phase B types: returns shaped placeholder so the
  end-to-end demo path completes.

- POST /api/polity-passport/verify/[type] — public CORS-enabled. for
  in-demo circuits: recomputes signature, returns commitmentRef on
  success. for phase B: returns ok:true valid:false notYetImplemented:
  true so the verifier surface shows the shape but signals 'this
  circuit ships post-submission'.

- scripts/create-env-production.js — adds PROVEKIT_API_KEY,
  PROVEKIT_CIRCUIT_REGISTRY to allowlist.

T0 discipline: persona_id never serialises in proof input; passport_id,
nullifier_hash (T1-safe), grant_id (T1-safe), agent did_uri (public)
are the only inputs to circuit generation.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/polity-passport/attest/[type]/route.ts` |
| Added | `app/api/polity-passport/verify/[type]/route.ts` |
| Modified | `scripts/create-env-production.js` |
| Added | `services/proof/provekit/index.ts` |

## Stats

 4 files changed, 466 insertions(+)
