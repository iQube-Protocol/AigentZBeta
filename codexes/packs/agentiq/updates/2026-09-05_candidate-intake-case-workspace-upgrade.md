# Candidate Intake: from one-shot consult to a case-aware workspace (2026-09-05)

Upgrades `CandidateIntakePanel.tsx` per the operator's 8-section directive: "convert the
one-shot specialist consultation into a case-aware, conversational and operational
workflow." No parallel cartridge, chat runtime, response-card system, case service, or
assessment service was built — every domain action calls the real, existing
`app/api/moneypenny/factor/*` / `app/api/moneypenny/aegis/*` REST routes and
`services/factor/*` / `services/aegis/*` services directly.

## 1. Case-aware workspace

The panel is now a stateful Candidate Case workspace: no-case empty state; find/open-or-create
(the real backend behavior is create-or-resume, so both are the same one action); active case
summary (candidate identity, state badge); evidence checklist with counts; authority-chain
status (read-only + revoke); current Aegis assessment + findings; case activity timeline.

**One real gap closed to make this honest, not a guess:**
- `GET /api/moneypenny/factor/cases/[caseId]` now also resolves the case's *current* Aegis
  assessment + findings (reusing `getCurrentAssessment`/`listFindings` from
  `services/aegis/aegisAssessmentService.ts` — the SAME resolution `admissionPacket.ts`
  already does; `factor_cases.current_aegis_assessment_id` is not kept in sync anywhere, so a
  live query by `(subject_type, subject_ref)` is the one real source of truth).
- `factor_case_events` had a writer (`appendCaseEvent`) but no reader at all. Added
  `listCaseEvents()` to `services/factor/factorCaseService.ts` and
  `GET /api/moneypenny/factor/cases/[caseId]/events` — the missing read side of an existing
  table, not a new one.

No case-machine logic was recreated client-side: every "advance" button only offers a target
state the server's own `FORWARD_TRANSITIONS` table already allows for the current state
(mirrored as UI labels only); the server remains the sole enforcer.

## 2. Persistent follow-up conversation

Investigated first whether an existing chat-thread primitive fits (`SmartTriadCopilotLayer`'s
`SmartTriadMessage`) — it doesn't: no specialist-attribution field, its append logic isn't
exported/reusable outside that file, and it's bound to a different endpoint
(`/api/codex/chat`) than this panel's specialist-consult path (`/api/assistant/ask-agent`).
The panel keeps a small local `turns[]` array (append-only) rendered through the SAME
`SpecialistResponseCard` every other specialist response renders with (confirmed
safe-to-render-repeated from its Props signature) — not a second card system.

Composer is a real `<textarea>`: Enter submits, Shift+Enter inserts a newline (proven by test).
Submitting appends a user turn + specialist turn; only the composer clears, never prior turns.
Switching Factor/Aegis keeps the same `turns[]` array (both specialists' turns interleave in
one ordered thread). Retry re-issues the exact failed turn in place; "New conversation" clears
`turns[]` only (never the case).

## 3. Left-pane integration

`MoneyPennyNavigationContext` (`moneyPennyNavigation.tsx`) — already the shared context between
`MoneyPennyCopilotWorkspace` (left pane) and this panel (right pane, both children of
`MoneyPennyPanelTab`) — gained `activeCase`/`setActiveCase`. The panel writes it whenever a
case is opened/refreshed/closed; the workspace reads it read-only to fold a bounded
`candidateCase` snapshot into the copilot's `groundContext`.

Left-pane delegation to Factor/Aegis: a new sibling module,
`services/smarttriad/specialistDelegation.ts` — modeled on, but NOT forked from,
`services/smarttriad/mediaProviders.ts`'s provider abstraction (that system resolves MEDIA;
this resolves a plain-text specialist consult, so it doesn't force itself through the
media-shaped contract). Deterministic, pre-LLM trigger (mirrors the existing
`isMoneyPennyLearnVideoRequest` precedent) gated on `cartridge==='moneypenny' &&
activePanel==='candidate-intake' && candidateCase present`; calls `askSpecialist()` from
`services/agents/specialistRouter.ts` — the SAME engine `ask-agent` uses, never a second
LLM-calling path. Wired into `app/api/codex/chat/route.ts` right after the existing media
short-circuit. Two new quick-prompt chips ("Ask Factor about this case" / "Ask Aegis about this
case") are offered only when a case is active.

Right-pane capsule opening: `candidate-intake` was added to `ChipTargetId`/`LAYOUT_TAG_IDS`
(2-line addition mirroring the existing `service-orchestration`/`portfolio` entries) so the
delegation module's `[layout:candidate-intake|...]` tag opens the case capsule through the
SAME suggested-layout banner mechanism every other MoneyPenny panel already uses — zero new
plumbing needed there.

Both panes resolve to the same `caseId` because both read/write the ONE shared context value —
proven by a behavioral test.

## 4. Real operational actions

Create candidate case; add/update evidence; pause/resume case; advance case (state-machine-
driven labels); request independent Aegis assessment; begin assessment / send for review / fail
assessment; add findings; ratify assessment; and MoneyPenny's own admission decision
(admit / conditionally admit / reject) — every one calls its real REST endpoint. Generic
consultation (`/api/assistant/ask-agent`, via the case-context adapter) never calls any of
these — proven by a test that inspects every network call made during a consult turn.

## 5. Structural authority enforcement

- **Aegis self-assessment refusal**: `requestedByAgentRef` is ALWAYS the hardcoded constant
  `'aigent-factor'`, `subjectRef` is ALWAYS the caseId — never derived from free text, so they
  can never collide by construction from this UI. The refusal path (`self-assessment-refused`)
  is still wired end-to-end and proven by a test that forces the fake backend to return it,
  asserting a **Refused** card renders.
- **Factor cannot admit**: there is no admission-write action in Factor's API surface at all
  (`transitionCaseState` refuses those target states server-side). Client-side, a deterministic
  pattern match on the operator's own composer text (only when specialist === Factor) renders a
  **Refused** card with a typed "Refer to MoneyPenny" action — proven by a test; no network call
  is made for this turn.
- **Only MoneyPenny's admission-authority endpoint renders the final admission action**: the
  Admit/Conditionally-admit/Reject buttons live in this panel (MoneyPenny's own cartridge), not
  in the Factor or Aegis sections, and only appear once `case.state === 'admission_pending'`.
- **Critical failed finding blocks admissibility**: enforced server-side already
  (`ratifyAssessment`'s `critical-failure-blocks-admission` refusal); the UI surfaces a proactive
  warning banner when a critical fail exists, still lets the operator attempt ratify, and
  renders the server's refusal as a **Blocked** card — proven by a test.

## 6. Correct affordances

No inert controls: `Resume case` only renders when paused; `Ratify` only when
`review_required`; findings/begin-assessment controls only during `running`/`review_required`;
`Revoke chain` only when a chain exists; admission-decision buttons only when
`admission_pending`; the evidence "Add" button is disabled with no kind typed — proven by a
test asserting these controls are simply absent from the DOM, not merely disabled-and-inert.
Consequential actions (Ratify, Admit/Conditionally-admit/Reject) require an explicit
**Approval required** confirm step. Six-state vocabulary (Advisory guidance / Proposed action /
Approval required / Completed / Refused / Blocked) renders consistently via one `StatusBadge`
component. Every consult turn offers "Ask a follow-up."

**A real bug found and fixed while building this**: the confirm-then-execute flow originally
cleared its own "confirming" flag synchronously before the async action resolved — which would
have unmounted the very control that renders the action's Refused/Blocked outcome badge before
the operator ever saw it. Fixed: the confirm step now only dismisses on a *successful* outcome
(`runAction` returns a boolean the caller awaits); on failure the confirm UI — and its outcome
badge — stays visible.

## 7. Preserve generic specialist consultation

`/api/assistant/ask-agent` is untouched. `services/moneypenny/caseContextConsultation.ts` is a
thin adapter: it prefixes the operator's question with a bounded, labeled case-context block
(caseId, candidate, state, current assessment/decision) before the SAME ask-agent call, and the
panel tags every response from this path **Advisory guidance** — visually and structurally
distinct from the real domain actions in section 4. Factor/Aegis's constitutional framing
("Factor cannot assess/admit"; "Aegis cannot self-assess or decide admission") was already
encoded in `services/agents/specialistRouter.ts`'s templates for these two specialists before
this pass — not duplicated here.

## 8. Tests — behavioral, not source-string-only

`tests/moneypenny-candidate-intake-workspace.test.tsx` (new, 14 tests, `@testing-library/react`
against a fake REST backend mirroring the real contract's shapes) proves: an ordered
multi-turn thread; composer clears without deleting history; case context persists across
specialist switch; case-create and assessment-request call the exact canonical endpoints;
Aegis's self-assessment refusal renders as Refused; Factor's admission refusal renders as
Refused with a referral action and makes no network call; generic consultation makes zero
mutating calls; a critical-finding ratify attempt renders Blocked; refresh/reopen restores
canonical state; left/right panes share one caseId (via the real shared context); inert
controls are absent, not disabled; personaFetch is the only client transport used; Enter
submits / Shift+Enter does not. `tests/moneypenny-candidate-intake-panel.test.ts` (existing
wiring canary) was kept passing by adjusting two now-outdated string checks to the file's actual
(still-true) new wording, not by weakening them. `tests/moneypenny-copilot-workspace.test.ts`'s
`quickPrompts` wiring canary was updated to match the new (still-`MONEYPENNY_QUICK_PROMPTS`-
derived) computed-prompts pattern — this was the one real regression this pass introduced, and
it is fixed, not silenced.

## Verification

`npx tsc --noEmit`: 680 errors before and after — identical baseline, zero new errors anywhere
in a touched or new file (confirmed by direct diff of the error list). Full `npx vitest run`:
compared two full runs (before/after the one real fix above) — the ONLY file-level delta between
them is `moneypenny-copilot-workspace.test.ts`, now passing; every other failing file (16, none
importing anything this pass touched — verified directly) is identical across both runs,
unrelated pre-existing baseline drift (Journey Spine, Pulse, myCanvas, repo-weight budget,
resolution-records registry, canon-document resolution, corpus-scout, register-ceremony,
KNYTS-bridge parity, dev-merge-message-discipline — none touch MoneyPenny/Factor/Aegis/
SmartTriad/the chat route). New/updated test totals: 14 new behavioral tests + 1 fixed wiring
canary + 2 adjusted string-canary assertions.

**Not done / honestly out of scope for this pass:**
- No full authority-chain *establishment* wizard (requires a pre-existing `delegation_grants`
  row this panel cannot orchestrate safely without guessing at a target agent DID) — status
  display + revoke only.
- No live authenticated browser walkthrough was performed — this sandboxed session has no
  authenticated persona session, exactly as flagged in every prior pass on this workspace.
  Every claim above is backed by the automated test suite reading real, unmocked service/route
  code paths (mocking only the outer HTTP boundary), not by an interactive demonstration.
