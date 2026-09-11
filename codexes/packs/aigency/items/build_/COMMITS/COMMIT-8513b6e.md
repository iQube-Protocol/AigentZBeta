# Commit Brief: `8513b6e` — Correct A4 source-rebuild claim; run CI on PRs into dev

| Field | Value |
|-------|-------|
| SHA | [`8513b6e`](https://github.com/iQube-Protocol/AigentZBeta/commit/8513b6e3f3e3706c710663e1a007fe5e36eb5431) |
| Author | Claude |
| Date | 2026-08-08T12:14:51Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Correct A4 source-rebuild claim; run CI on PRs into dev

Two fixes to PR #92's CAP-1 v2 integration, found during independent review:

1. moduleHashVerifiedAgainstSource was recorded as matching for both
   proof_of_state_v2 and btc_signer_psbt. Independently re-attempting the
   documented rebuild (dfx build, local and --network ic context, from the
   exact pinned commit 7387fc1a1ecb58ffd7f81d15c9fe5b51d19b0d7c) with two
   different rustc versions -- this sandbox's default 1.94.1 and 1.89.0,
   the version this repo's own CI pins in icp-ci.yml -- produced two more
   DIFFERENT module hashes, and neither matches the deployed module. For
   btc_signer_psbt (type=custom, no dfx post-processing, and already
   pinning codegen-units=1 + lto=true) this rules out both dfx-pipeline
   variance and codegen-unit nondeterminism, leaving an unpinned Rust
   toolchain in iQubeBeta-Program as the most likely cause -- the repo has
   no rust-toolchain.toml, so the exact compiler used for whatever
   produced the original claim is not recorded anywhere and the claim
   cannot be independently reproduced as recorded.

   deploymentArtifactHashVerified (the live on-chain module_hash) WAS
   independently re-confirmed by live network query against both
   cz7nu-zyaaa-aaaao-qqavq-cai and c66la-uaaaa-aaaao-qqava-cai and stands.

   Set moduleHashVerifiedAgainstSource back to null for both entries with
   observedCaveats documenting exactly what was tried and why it's
   inconclusive, per this file's own standing rule: an unverified strong
   claim is worse than a gap. activationProvenanceBlockers() now correctly
   lists both canisters again; updated the three tests that asserted A4 was
   fully closed to assert the true, partially-closed state instead, and
   added a RED/GREEN check confirming the new assertions actually fail
   against the original (uncorrected) values.

2. Neither ci.yml (build check) nor lint.yml (typecheck + test:ci, the
   suite that runs these exact canaries) triggers on PRs into dev -- only
   main/staging/develop. dev is this project's actual integration base, so
   every PR into it, including this one, has been running with no CI
   coverage at all. Added dev to both workflows' branch triggers.

A4's deployment-artifact sub-claim, PoS-v2 H-keyed issuance, the
three-leaf Merkle construction, and the H1/H3 inclusion proofs all remain
independently verified and unchanged. CAP-1 remains
blocked_external_substrate. POS_LEG_SUBMISSION_ENABLED is untouched
(false). No DVN pipeline logic touched.
```

## Body

Two fixes to PR #92's CAP-1 v2 integration, found during independent review:

1. moduleHashVerifiedAgainstSource was recorded as matching for both
   proof_of_state_v2 and btc_signer_psbt. Independently re-attempting the
   documented rebuild (dfx build, local and --network ic context, from the
   exact pinned commit 7387fc1a1ecb58ffd7f81d15c9fe5b51d19b0d7c) with two
   different rustc versions -- this sandbox's default 1.94.1 and 1.89.0,
   the version this repo's own CI pins in icp-ci.yml -- produced two more
   DIFFERENT module hashes, and neither matches the deployed module. For
   btc_signer_psbt (type=custom, no dfx post-processing, and already
   pinning codegen-units=1 + lto=true) this rules out both dfx-pipeline
   variance and codegen-unit nondeterminism, leaving an unpinned Rust
   toolchain in iQubeBeta-Program as the most likely cause -- the repo has
   no rust-toolchain.toml, so the exact compiler used for whatever
   produced the original claim is not recorded anywhere and the claim
   cannot be independently reproduced as recorded.

   deploymentArtifactHashVerified (the live on-chain module_hash) WAS
   independently re-confirmed by live network query against both
   cz7nu-zyaaa-aaaao-qqavq-cai and c66la-uaaaa-aaaao-qqava-cai and stands.

   Set moduleHashVerifiedAgainstSource back to null for both entries with
   observedCaveats documenting exactly what was tried and why it's
   inconclusive, per this file's own standing rule: an unverified strong
   claim is worse than a gap. activationProvenanceBlockers() now correctly
   lists both canisters again; updated the three tests that asserted A4 was
   fully closed to assert the true, partially-closed state instead, and
   added a RED/GREEN check confirming the new assertions actually fail
   against the original (uncorrected) values.

2. Neither ci.yml (build check) nor lint.yml (typecheck + test:ci, the
   suite that runs these exact canaries) triggers on PRs into dev -- only
   main/staging/develop. dev is this project's actual integration base, so
   every PR into it, including this one, has been running with no CI
   coverage at all. Added dev to both workflows' branch triggers.

A4's deployment-artifact sub-claim, PoS-v2 H-keyed issuance, the
three-leaf Merkle construction, and the H1/H3 inclusion proofs all remain
independently verified and unchanged. CAP-1 remains
blocked_external_substrate. POS_LEG_SUBMISSION_ENABLED is untouched
(false). No DVN pipeline logic touched.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.github/workflows/ci.yml` |
| Modified | `.github/workflows/lint.yml` |
| Modified | `services/ops/canisterSourceManifest.ts` |
| Modified | `tests/bitcoin-anchor-activation.test.ts` |
| Modified | `tests/canister-source-manifest.test.ts` |

## Stats

 5 files changed, 56 insertions(+), 17 deletions(-)
