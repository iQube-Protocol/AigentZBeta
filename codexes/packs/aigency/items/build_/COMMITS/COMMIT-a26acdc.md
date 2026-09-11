# Commit Brief: `a26acdc` — add factor authority chains and moneypenny sole admission authority

| Field | Value |
|-------|-------|
| SHA | [`a26acdc`](https://github.com/iQube-Protocol/AigentZBeta/commit/a26acdc735e0b6f9988a53dd275bfdf823e7b6ea) |
| Author | Claude |
| Date | 2026-09-04T17:08:49Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add factor authority chains and moneypenny sole admission authority

authorityChain.ts (PRD 2.1/9.15-17): establishDirectChain now REQUIRES an
existing active delegation_grants row (via readActiveGrantForAgent) and
records only the chain-mode overlay delegation_grants cannot express
(chain_mode, mediator_agent_ref, subdelegation_permitted) rather than
duplicating allowed_actions/allowed_surfaces. establishMediatedChain
refuses without explicit subdelegationPermitted=true — a moneypenny
session alone is never sufficient authority to delegate to factor.

admissionAuthority.ts: decideAdmission is the ONLY function permitted to
write admitted/conditionally_admitted/rejected. Requires a ratified aegis
assessment supporting the outcome; idempotent by key; moneypenny may
still reject an admissible candidate (its own prerogative) but can never
admit one aegis did not find admissible.

admissionPacket.ts: read-only packet assembly; unavailable readiness legs
report verified:false with an explicit reason, never fabricated as passing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

authorityChain.ts (PRD 2.1/9.15-17): establishDirectChain now REQUIRES an
existing active delegation_grants row (via readActiveGrantForAgent) and
records only the chain-mode overlay delegation_grants cannot express
(chain_mode, mediator_agent_ref, subdelegation_permitted) rather than
duplicating allowed_actions/allowed_surfaces. establishMediatedChain
refuses without explicit subdelegationPermitted=true — a moneypenny
session alone is never sufficient authority to delegate to factor.

admissionAuthority.ts: decideAdmission is the ONLY function permitted to
write admitted/conditionally_admitted/rejected. Requires a ratified aegis
assessment supporting the outcome; idempotent by key; moneypenny may
still reject an admissible candidate (its own prerogative) but can never
admit one aegis did not find admissible.

admissionPacket.ts: read-only packet assembly; unavailable readiness legs
report verified:false with an explicit reason, never fabricated as passing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `services/factor/admissionPacket.ts` |
| Added | `services/factor/authorityChain.ts` |
| Added | `services/moneypenny/admissionAuthority.ts` |

## Stats

 3 files changed, 437 insertions(+)
