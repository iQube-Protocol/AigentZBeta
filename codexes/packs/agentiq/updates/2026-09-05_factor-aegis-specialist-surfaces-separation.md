# Separating Aigent Factor and Aegis into first-class specialist surfaces (2026-09-05)

Operator directive: the combined "Candidate Intake" destination conflated two constitutionally
distinct agents, made Aegis appear subordinate to intake, required a candidate identifier before
any consultation was possible, and gave Aegis no way to assess anything broader than a Factor case.

## What changed

- **Activity submenu** now reads: Runtime | Automation | Service Orchestration | **Aigent Factor** |
  **Aegis** | Portfolio/Performance | Relationships — replacing the single combined "Candidate
  Intake" item. `moneypennyCapabilities.ts`'s Operate group carries two new items (`factor`, `aegis`),
  each pointing at its own `MoneyPennyPanelKey`.
- **`CandidateIntakePanel.tsx` is deleted.** Its case-lifecycle logic (state machine, evidence,
  authority chain, admission decision, activity timeline) moved into `FactorPanel.tsx`; its
  assessment logic (findings, ratify) moved into `AegisPanel.tsx`. Neither panel requires a
  case/assessment to be open by default — both open on a direct consultation.
- **`SpecialistWorkspace`** (`app/(shell)/moneypenny/components/specialistWorkspace/`) is the one
  reusable specialist-conversation primitive extracted from the old panel's conversation section —
  used by FactorPanel, AegisPanel, and Home's specialist-card modal (`SpecialistConsultModal`). It
  is also reused unmodified for the Nakamoto/Know1 direct-consult modals. No FactorChat/AegisChat
  fork exists.
- **Persisted, append-only threads** (`services/moneypenny/specialistThreadStore.ts`) keyed by
  personaId + specialistId + an optional bounded scope id (a Factor caseId or Aegis assessmentId, or
  `null` for a direct consult) — a Factor thread never appears under Aegis, and a direct consult
  never mixes with a case-grounded one for the same specialist.
- **Home's four specialist cards** (Aigent Factor, Aegis, Aigent Nakamoto, Aigent Know1) now open a
  direct-consultation **modal** (`SpecialistConsultModal`) instead of navigating away from Home. Each
  modal's "Expand to full panel" hands off to the real panel and preserves the conversation (same
  thread key on both sides).
- **Cross-agent handoffs** carry only a bounded reference, never a copied thread:
  `writePendingCaseId`/`readAndClearPendingCaseId` (`moneyPennyNavigation.tsx`) is the one-shot
  carrier Aigent Factor's "Request an independent Aegis assessment" button uses to hand a `caseId`
  to Aegis's panel, which then fetches that case's own evidence fresh from the real REST route
  (never a fabricated case, never a copied private conversation).
- **Aegis supports non-Factor subjects.** `AegisPanel`'s "Assess an external agent/system/provider/
  model" path posts `subjectType: 'agent'` with a free-text `subjectRef` and no `caseId` — it never
  fabricates a Factor case for a direct external assessment.
- **Admission decision stays MoneyPenny's alone**, rendered only in `FactorPanel` (on the linked
  case) — `AegisPanel` never renders it, and Aegis's own ratify action sets only the assessment's own
  `decision`.
- **Naming**: `REGISTRABLE_AGENTS.factor.displayName` ("Aigent Factor") was already the canonical
  source of truth from an earlier same-day pass; this work's new surfaces read it, never a local
  literal. Aegis stays "Aegis" (no ratified source requires "Aigent Aegis").

## Not touched

Factor/Aegis's server-side services (`services/factor/factorCaseService.ts`,
`services/aegis/aegisAssessmentService.ts`, `services/moneypenny/admissionAuthority.ts`) — the
self-assessment refusal, the admission-authority boundary, and the case state machine are all
enforced exactly as before; this pass only changes which UI surface renders them.

## Tests

- `tests/moneypenny-candidate-intake-panel.test.ts` — rewritten as a canary over
  `SpecialistWorkspace`/`FactorPanel`/`AegisPanel` (replaces the old combined-panel canary).
- `tests/moneypenny-candidate-intake-workspace.test.tsx` — rewritten as behavioral coverage for both
  panels against a fake REST backend: case lifecycle, direct consult, structural refusals (Factor
  admission, Aegis self-assessment), the Factor→Aegis handoff preserving `caseId`, a direct external
  assessment never creating a Factor case, thread separation, and Enter/Shift+Enter composer
  semantics.
- `tests/moneypenny-home-cross-area-navigation.test.tsx` and
  `tests/moneypenny-home-nav-diagnostic.test.tsx` — updated for the modal-based specialist cards
  (the Operate group's own plain Factor/Aegis nested cards are covered separately, scoped to avoid
  the now-duplicate "Aigent Factor"/"Aegis" label between the two sections).

## Verification

Targeted: `moneypenny-*`, `factor-*`, `aegis-*`, `agents-factor-aegis*`, `ask-agent-factor-aegis*`
suites — all green (2 pre-existing, unrelated failures in `moneypenny-home-nav-diagnostic.test.tsx`
confirmed via `git stash` to predate this change).

Full regression (`npx vitest run`): 18 files / 64 tests failing — confirmed via `git stash` to be the
same pre-existing baseline this branch already carried (Journey Spine, Pulse, myCanvas, repo-weight,
resolution-records, canon-document resolution, register-ceremony, KNYTS-bridge parity,
dev-merge-message-discipline, companion-observer, passport-first-connection, phase-a-baseline).

`npx tsc --noEmit`: 679 errors with this change vs. 685 on the same tree without it (net fewer, from
deleting `CandidateIntakePanel.tsx`) — zero new errors in any touched or new file, confirmed by
grepping the touched-file paths in both runs.

**Not done this pass**: an authenticated browser walkthrough (no test credentials in this sandboxed
session); merging to `dev` / deploying (not requested for this task, which asked for a checklist —
see below — rather than an actual deploy in this reply).

## Authenticated browser checklist (for the operator to run against dev-beta)

1. MoneyPenny → Activity: confirm the submenu reads Runtime | Automation | Service Orchestration |
   Aigent Factor | Aegis | Portfolio/Performance | Relationships.
2. Open "Aigent Factor" directly — confirm it opens on a direct-consult empty state (no candidate
   identifier required), with the suggested prompt visible.
3. Click "Start candidate intake" — confirm the existing case-open form appears, and opening/
   resuming a case works exactly as before.
4. From an open Factor case, click "Request an independent Aegis assessment" — confirm it lands on
   Aegis's panel with a "Referral from Aigent Factor" card showing the same caseId, and "Accept a
   referral" creates the assessment scoped to that case.
5. Open "Aegis" directly — confirm "Assess an external agent/system/provider/model" creates an
   assessment with no Factor case involved.
6. From MoneyPenny Home, click each of the four Specialists cards (Aigent Factor, Aegis, Aigent
   Nakamoto, Aigent Know1) — confirm each opens a modal that accepts a question immediately, and
   "Expand to full panel" lands on the right destination with the same conversation visible.
7. Confirm MoneyPenny's admission-decision buttons (Admit/Conditionally admit/Reject) appear only in
   Aigent Factor's panel, only when the case is in "Admission pending".
