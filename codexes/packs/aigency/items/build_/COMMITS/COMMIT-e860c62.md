# Commit Brief: `e860c62` — Fix AigentQube-presence/Factory-ingestion conflation + wire P&L service registered evidence

| Field | Value |
|-------|-------|
| SHA | [`e860c62`](https://github.com/iQube-Protocol/AigentZBeta/commit/e860c628dba82c839df9dd33fefc6e05a18688c4) |
| Author | Claude |
| Date | 2026-08-09T12:29:35Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix AigentQube-presence/Factory-ingestion conflation + wire P&L service registered evidence

Ingest and Standing could render COMPLETE before Claim/Orient/Passport/
Delegate/Operate ever happened: factoryIngested evidence was OR'd with
admission.factoryPresent (mere AigentQube/registry-row existence), and
resolveJourneyState lets established completion evidence outrank an unmet
prerequisite. Once the AigentQube entrance gate started writing the same
registry_assets row Deploy read as its own evidence, the two facts
collapsed. factoryIngested is now the capability_registered receipt only,
everywhere it's computed (stages.deploy, axes, canonicalStages, the
Standing seed award); the seed award additionally requires aigentMe/Operate
to be canonically active as a second, independent gate. Adds generic,
agent-N regression coverage and a source-scan canary superseding the
2026-08-03 "registry presence is the receipt" test this corrects.

Adds two ops routes for the non-destructive forensic correction this
implies for any agent whose Standing was seeded before genuine ingestion:
a read-only inspector and a corrective action that re-verifies the defect
signature before invalidating the registry_standing_seeded settled fact
(via the existing governed-correction-supersedes event) and removing
deploy/standing from the persisted canonical-stage ratchet — never deleting
or mutating the original standing_accrued receipt.

Also fixes findAgentReceiptRefs' per-action-type coverage: a single global
row limit across every requested action type let one type's old receipt
be crowded out by unrelated newer receipts of other types, which is how
an already-dvn_recorded fact could disappear from the journey observer
purely because unrelated receipt volume grew.

Separately, wires pnl_service_registered into the journey observer's
canonical receipt set and a dedicated pnlEvidence projection (state route
-> JourneyRunSurface -> PilotJourneyTab -> PulseTransparencyToggle),
replacing a structurally dead read (evidencePresent never carries
Pulse/P&L fields, since they're deliberately excluded from Ratify's
completionEvidence) and fixing P&L service's registered/verified
precedence to be receipt-first, corroborated but never regressed by a
later live partner reread.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

Ingest and Standing could render COMPLETE before Claim/Orient/Passport/
Delegate/Operate ever happened: factoryIngested evidence was OR'd with
admission.factoryPresent (mere AigentQube/registry-row existence), and
resolveJourneyState lets established completion evidence outrank an unmet
prerequisite. Once the AigentQube entrance gate started writing the same
registry_assets row Deploy read as its own evidence, the two facts
collapsed. factoryIngested is now the capability_registered receipt only,
everywhere it's computed (stages.deploy, axes, canonicalStages, the
Standing seed award); the seed award additionally requires aigentMe/Operate
to be canonically active as a second, independent gate. Adds generic,
agent-N regression coverage and a source-scan canary superseding the
2026-08-03 "registry presence is the receipt" test this corrects.

Adds two ops routes for the non-destructive forensic correction this
implies for any agent whose Standing was seeded before genuine ingestion:
a read-only inspector and a corrective action that re-verifies the defect
signature before invalidating the registry_standing_seeded settled fact
(via the existing governed-correction-supersedes event) and removing
deploy/standing from the persisted canonical-stage ratchet — never deleting
or mutating the original standing_accrued receipt.

Also fixes findAgentReceiptRefs' per-action-type coverage: a single global
row limit across every requested action type let one type's old receipt
be crowded out by unrelated newer receipts of other types, which is how
an already-dvn_recorded fact could disappear from the journey observer
purely because unrelated receipt volume grew.

Separately, wires pnl_service_registered into the journey observer's
canonical receipt set and a dedicated pnlEvidence projection (state route
-> JourneyRunSurface -> PilotJourneyTab -> PulseTransparencyToggle),
replacing a structurally dead read (evidencePresent never carries
Pulse/P&L fields, since they're deliberately excluded from Ratify's
completionEvidence) and fixing P&L service's registered/verified
precedence to be receipt-first, corroborated but never regressed by a
later live partner reread.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Added | `app/api/ops/dvn/agent-receipts/route.ts` |
| Added | `app/api/ops/journey/agent-forensics/route.ts` |
| Added | `app/api/ops/journey/correct-premature-standing-seed/route.ts` |
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/journey/PulseTransparencyToggle.tsx` |
| Modified | `services/horizen/agentPreflight.ts` |
| Modified | `services/journey/agentAdmissionState.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `tests/find-agent-receipt-refs-coverage.test.ts` |
| Modified | `tests/journey-admission-spine.test.ts` |
| Added | `tests/journey-sequencing-factory-ingestion.test.ts` |
| Added | `tests/pnl-evidence-wiring.test.ts` |

## Stats

 15 files changed, 1244 insertions(+), 65 deletions(-)
