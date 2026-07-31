# Commit Brief: `a35a6ee` — build CRP-003a Increment 1 (N1): the Constitutional Agreement primitive

| Field | Value |
|-------|-------|
| SHA | [`a35a6ee`](https://github.com/iQube-Protocol/AigentZBeta/commit/a35a6ee6aab634940440396155494d3170e50f84) |
| Author | Claude |
| Date | 2026-07-17T00:23:50Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
build CRP-003a Increment 1 (N1): the Constitutional Agreement primitive

The one load-bearing greenfield of the Constitutional Financial Services
Programme (CFI-002, WS2, canonical-service-pattern step 3): an attributable,
machine-readable record binding operator/capability/agent/authority/
constraints/verification/settlement before delegated execution.

- services/constitutional/constitutionalAgreement.ts — Agreement as a
  ConstitutionalObject (kind 'agreement', T2-safe by construction);
  form -> accept -> authorize lifecycle; the 409 gate
  requireAuthorizedAgreement (fail-closed) refusing delegated execution
  without an authorized agreement. Composes existing seams (capability_registry
  id, PolicyEnvelope shape, optional x402 settlement terms).
- services/constitutional/agreementProviders.ts — swappable acceptance-proof
  adapter seam: local (functional default) + x409/Consenti (env-gated, honest
  failure when unconfigured). DVN is the constitutional anchor of record.
- app/api/constitutional/agreement/route.ts — spine-auth form/accept/authorize/
  gate; no personaId stored (operator = one-way ownerCommitment).
- agreement_formed + agreement_authorized added to ActivityActionType and
  ANCHORABLE_ACTION_TYPES (the one permitted DVN change).
- migration 20260719000000 — constitutional_agreements table + full
  activity_receipts CHECK rebuild (latest action-type migration).
- types/constitutionalObject.ts — additive object kind 'agreement'.

Verified: 23/23 pure-logic drill (lifecycle legality, 409 gate open-set,
acceptance commitment determinism + tamper/wrong-ref rejection, ownerCommitment
one-wayness, object T2-safety + leak canary); pure modules parse-clean under
Node strip-types; no exhaustive ActivityActionType Record to break.

Domain 3 (read-only) scope; x409 live wire + gate-into-execution are Increment 2.
Operator: run migration 20260719000000.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The one load-bearing greenfield of the Constitutional Financial Services
Programme (CFI-002, WS2, canonical-service-pattern step 3): an attributable,
machine-readable record binding operator/capability/agent/authority/
constraints/verification/settlement before delegated execution.

- services/constitutional/constitutionalAgreement.ts — Agreement as a
  ConstitutionalObject (kind 'agreement', T2-safe by construction);
  form -> accept -> authorize lifecycle; the 409 gate
  requireAuthorizedAgreement (fail-closed) refusing delegated execution
  without an authorized agreement. Composes existing seams (capability_registry
  id, PolicyEnvelope shape, optional x402 settlement terms).
- services/constitutional/agreementProviders.ts — swappable acceptance-proof
  adapter seam: local (functional default) + x409/Consenti (env-gated, honest
  failure when unconfigured). DVN is the constitutional anchor of record.
- app/api/constitutional/agreement/route.ts — spine-auth form/accept/authorize/
  gate; no personaId stored (operator = one-way ownerCommitment).
- agreement_formed + agreement_authorized added to ActivityActionType and
  ANCHORABLE_ACTION_TYPES (the one permitted DVN change).
- migration 20260719000000 — constitutional_agreements table + full
  activity_receipts CHECK rebuild (latest action-type migration).
- types/constitutionalObject.ts — additive object kind 'agreement'.

Verified: 23/23 pure-logic drill (lifecycle legality, 409 gate open-set,
acceptance commitment determinism + tamper/wrong-ref rejection, ownerCommitment
one-wayness, object T2-safety + leak canary); pure modules parse-clean under
Node strip-types; no exhaustive ActivityActionType Record to break.

Domain 3 (read-only) scope; x409 live wire + gate-into-execution are Increment 2.
Operator: run migration 20260719000000.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/constitutional/agreement/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-17_crp-003a-n1-constitutional-agreement.md` |
| Modified | `codexes/packs/irl/foundation/CHRYSALIS_WORKSTREAM_TRACKER.md` |
| Modified | `codexes/packs/irl/foundation/CRP-003a_constitutional-financial-services-programme.md` |
| Added | `services/constitutional/agreementProviders.ts` |
| Added | `services/constitutional/constitutionalAgreement.ts` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `supabase/migrations/20260719000000_constitutional_agreements.sql` |
| Modified | `types/constitutionalObject.ts` |

## Stats

 11 files changed, 1102 insertions(+), 7 deletions(-)
