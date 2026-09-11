# Commit Brief: `1722b0a` — factor/aegis phase 2: close tenant/principal isolation gap, register specialists, add API routes

| Field | Value |
|-------|-------|
| SHA | [`1722b0a`](https://github.com/iQube-Protocol/AigentZBeta/commit/1722b0a3bcb6245c7bce3d784b45574f71d0f1ad) |
| Author | Claude |
| Date | 2026-09-04T23:27:07Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
factor/aegis phase 2: close tenant/principal isolation gap, register specialists, add API routes

Verified the factor_aegis_constitution_reconciled migration is genuinely
applied on dev (schema/triggers/constraints/indexes match the file exactly,
despite a version-timestamp mismatch in list_migrations). Closed the Phase 1
§8 cross-tenant/cross-principal isolation gap for real (not just tested):
transitionCaseState/pauseCase/resumeCase/upsertEvidenceItem/listEvidenceForCase/
decideAdmission now require and enforce tenantId; revokeChain/validateChainForAction
enforce principal scope. Registered Factor and Aegis as specialistRouter
specialists with honest advisory-only template responses. Added 12 API routes
under /api/moneypenny/factor and /api/moneypenny/aegis covering case lifecycle,
evidence, authority chains, assessment lifecycle, findings, ratification, and
MoneyPenny's admission decision — no specialist UI, per operator scope.

registrableAgents.ts registration and Horizen Journey Spine connection are
investigated and explicitly NOT done: Factor has no existing agent_keys wallet,
registry_assets row, fio handle, or agent-card/health routes, so writing a
RegistrableAgentConfig entry would require inventing identity substrate
(violates CLAUDE.md's No-Guessing rule) or unilaterally minting a new custodied
wallet (a sensitive action needing operator sign-off). Documented in full with
the exact provisioning steps needed if the operator wants Factor onboarded as
a first-class runtime agent.

37 -> 48 Factor/Aegis tests passing (8 new isolation tests, 11 new route tests).
tsc baseline unchanged at 680 errors (pre-existing, none from this pass).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Verified the factor_aegis_constitution_reconciled migration is genuinely
applied on dev (schema/triggers/constraints/indexes match the file exactly,
despite a version-timestamp mismatch in list_migrations). Closed the Phase 1
§8 cross-tenant/cross-principal isolation gap for real (not just tested):
transitionCaseState/pauseCase/resumeCase/upsertEvidenceItem/listEvidenceForCase/
decideAdmission now require and enforce tenantId; revokeChain/validateChainForAction
enforce principal scope. Registered Factor and Aegis as specialistRouter
specialists with honest advisory-only template responses. Added 12 API routes
under /api/moneypenny/factor and /api/moneypenny/aegis covering case lifecycle,
evidence, authority chains, assessment lifecycle, findings, ratification, and
MoneyPenny's admission decision — no specialist UI, per operator scope.

registrableAgents.ts registration and Horizen Journey Spine connection are
investigated and explicitly NOT done: Factor has no existing agent_keys wallet,
registry_assets row, fio handle, or agent-card/health routes, so writing a
RegistrableAgentConfig entry would require inventing identity substrate
(violates CLAUDE.md's No-Guessing rule) or unilaterally minting a new custodied
wallet (a sensitive action needing operator sign-off). Documented in full with
the exact provisioning steps needed if the operator wants Factor onboarded as
a first-class runtime agent.

37 -> 48 Factor/Aegis tests passing (8 new isolation tests, 11 new route tests).
tsc baseline unchanged at 680 errors (pre-existing, none from this pass).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/moneypenny/aegis/assessments/[assessmentId]/findings/route.ts` |
| Added | `app/api/moneypenny/aegis/assessments/[assessmentId]/ratify/route.ts` |
| Added | `app/api/moneypenny/aegis/assessments/[assessmentId]/route.ts` |
| Added | `app/api/moneypenny/aegis/assessments/[assessmentId]/transition/route.ts` |
| Added | `app/api/moneypenny/aegis/assessments/route.ts` |
| Added | `app/api/moneypenny/factor/_lib/respondError.ts` |
| Added | `app/api/moneypenny/factor/authority-chains/[chainId]/revoke/route.ts` |
| Added | `app/api/moneypenny/factor/authority-chains/route.ts` |
| Added | `app/api/moneypenny/factor/cases/[caseId]/decide-admission/route.ts` |
| Added | `app/api/moneypenny/factor/cases/[caseId]/evidence/route.ts` |
| Added | `app/api/moneypenny/factor/cases/[caseId]/route.ts` |
| Added | `app/api/moneypenny/factor/cases/[caseId]/transition/route.ts` |
| Added | `app/api/moneypenny/factor/cases/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-09-04_factor-aegis-0.1-phase2-registration-and-api.md` |
| Modified | `services/agents/specialistRouter.ts` |
| Modified | `services/factor/authorityChain.ts` |
| Modified | `services/factor/factorCaseService.ts` |
| Modified | `services/moneypenny/admissionAuthority.ts` |
| Modified | `services/orchestration/specialistRecommender.ts` |
| Added | `tests/factor-aegis-api-routes.test.ts` |
| Modified | `tests/factor-authority-and-admission.test.ts` |
| Modified | `tests/factor-case-service.test.ts` |

## Stats

 23 files changed, 1544 insertions(+), 32 deletions(-)
