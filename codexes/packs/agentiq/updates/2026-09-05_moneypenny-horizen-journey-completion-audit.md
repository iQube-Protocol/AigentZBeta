# MoneyPenny × Horizen: journey completion & UI hardening audit (2026-09-05)

Bounded pass across four requested areas. **No scientific/constitutional logic, authority rules, or
journey infrastructure were added or altered** — this is an audit plus two small, verified fixes.

## 1. Financial Intelligence modal — collapsible Evidence

**Already implemented, not a gap.** The "Evidence (N)" section visible in the screenshots is
`components/journey/StageReceiptsDrawer.tsx` — it already:
- renders the canonical `Evidence{(N)}` label with a live count;
- toggles via a `ChevronDown`/`ChevronRight` icon reflecting expanded/collapsed state;
- defaults to **collapsed** (`useState(false)`) and fetches lazily only on first expand;
- collapses via CSS conditional render (`{open && (...)}`), never destroying the underlying data —
  reopening re-shows the same canonical evidence without refetching unless the scope changed.

The one real gap found: the toggle `<button>` had no `aria-expanded` attribute (its sibling
disclosure, `AgentCardSurface.tsx`'s "Show/Hide card JSON" toggle, already has one). **Fixed** —
`aria-expanded={open}` added to `StageReceiptsDrawer.tsx`'s toggle button, matching the existing
sibling pattern rather than inventing a new one.

No other Evidence-shaped disclosure in this journey was found using a different, one-off pattern —
`AgentCardSurface.tsx`'s "Show/Hide card JSON" and `RegisterAgentPanel.tsx`'s two `<details>` blocks
("What the chain says" / "What Horizen answered") are the only other disclosures nearby, and neither
needed the fix above.

**Note on the task's framing**: no component titled "Constitutional Agreement — Financial
Intelligence" was found that also shows an Agent Card + Evidence together — the Agent Card is a
Register-stage-only surface (`AgentCardSurface.tsx`, mounted by `RegisterAgentPanel.tsx`), while
"Constitutional Service Agreement" (`AgreementRatifyPanel.tsx`, the Ratify stage) shares the same
underlying Domain-3 "Financial Intelligence" agreement terms but has no Agent Card of its own. The
screenshots match the **Register** stage precisely (Agent Card fields, wallet-quarantine warning,
six-step registration stepper are all unambiguously `RegisterAgentPanel.tsx`) — worth flagging in
case "Financial Intelligence modal" was meant to point somewhere else.

## 2. DVN receipts — consequential MoneyPenny acts

Audited every stage's consequential act against its receipt path. **No real gaps found** — the two
candidates that looked like gaps on a first pass both turned out to already be covered generically:

| Stage | Consequential act | Receipt type | Write path | Verdict |
|---|---|---|---|---|
| Register | Principal signs mandate | `principal_registration_mandate_signed` | `services/horizen/registerCeremony.ts:391-398` | ✅ |
| Register | Agent wallet signs tx | `agent_registry_transaction_signed` | `registerCeremony.ts:507-514` | ✅ |
| Register | Broadcast to Horizen | `horizen_registration_submitted` | `registerCeremony.ts:515-527` | ✅ |
| Register | Horizen confirms | `horizen_agent_registered`/`horizen_registration_confirmed`/`agent_registry_binding_recorded` | `services/horizen/registrationConfirmationDeps.ts` | ✅ |
| Claim | Wallet-control challenge signed | `agent_control_proven` | `app/api/journey/moneypenny-horizen/claim/prove-control/route.ts` | ✅ |
| Orient | Orientation acknowledged | `orientation_ritual_completed` | `app/api/journey/moneypenny-horizen/orient/acknowledge/route.ts:152-155` | ✅ |
| Passport | Passport issued | `passport_issued` (canonical) | `services/passport/issuanceService.ts` | ✅ — `agent_delegate_passport_issued` is a **deliberately retired alias**, documented in `horizenMoneyPennyJourney.ts` as "written by NOTHING... retained only so any historical row bearing it still surfaces." Not a bug. |
| Activate | Registry activation | `agent_registry_activated` | `services/journey/agentRegistryActivation.ts` | ✅ (derived, not an operator click, by design) |
| Activate | Factory ingestion | `capability_registered`/`standing_accrued` | `app/api/journey/moneypenny-horizen/ingest/route.ts` | ✅ |
| Delegate | Bounded delegation approved | `agent_delegated` | `app/api/codex/chat/agentiq-os/delegation/route.ts:747` | ✅ — this is the shared AgentiQ OS delegation route, reused generically for the Horizen journey's Delegate stage (not a Horizen-specific route; confirmed a real write site exists, resolving my initial concern that it might be missing). |
| Operate | Principal disposition on agent focus | `aigentme_activated` (first call) + disposition record | `app/api/journey/moneypenny-horizen/aigentme/disposition/route.ts` → `services/journey/experienceQubeDispositionService.ts` | ✅ — already agent-selectable (`agentSlug` param), not hardcoded to MoneyPenny/Nakamoto. |
| Ratify | Agreement form/accept/authorize | `agreement_formed`/`agreement_authorized` | `services/constitutional/constitutionalAgreement.ts` | ✅ — `AgreementRatifyPanel.tsx` already surfaces a `receiptWarning` if the receipt fails to persist, so this failure mode is not silent. |

**DVN receipt viewer**: `components/metame/cards/ActivityReceiptCard.tsx` is already the one shared
render component `StageReceiptsDrawer` uses — it is already exposed from every stage that declares
`receiptTypes`/canonical evidence (Register, Claim, Orient, Passport, Activate, Delegate, Ratify all
mount `StageReceiptsDrawer`). No second receipt-viewing surface needed to be wired in — it was
already present everywhere a consequential act occurs.

**No code changes were needed for this section** — the audit closed with everything already
receipted through the existing infrastructure, generically, with fail-closed semantics already
observed (`StageReceiptsDrawer`'s "No agent-tagged receipt exists for this fact yet — that is an
audit gap, never evidence the fact did not happen" — exact existing copy, never weakened).

## 3. Factor — journey readiness by stage

Verified via source-level tracing (see new test file below) rather than a live rehearsal (see
"Not done" below for why).

| Stage | Factor readiness | Evidence |
|---|---|---|
| Register | **Not yet completed for Factor** — `pending_registration`. The generic ceremony machinery (dropdown, Agent Card, wallet-gate, ladder, ceremony routes) is agent-parameterized and already includes Factor (`resolveRegistrableAgent('factor')`, `listRegistrableAgents()`), but the actual on-chain registration (principal signs mandate → agent wallet signs → broadcast → confirm) has not been carried out. This is the governed, external, wallet-signing act the task asks me to stop at. | `services/horizen/registrableAgents.ts:168-176`; `RegisterAgentPanel.tsx:140-146,1000-1015` |
| Claim | Structurally ready — `claim/prove-control/route.ts` resolves the agent generically, no Nakamoto-only branch found | grep of `app/api/journey/moneypenny-horizen/` for hardcoded `aigent-nakamoto`/`'nakamoto'` found only one file (see below), and it's a default, not a gate |
| Orient | Structurally ready — same generic `resolveRegistrableAgent` pattern | `orient/acknowledge/route.ts` |
| Passport | Structurally ready — canonical `passport_issued` pipeline is subject-agnostic | `services/passport/issuanceService.ts` |
| Activate | Structurally ready — `agentRegistryActivation.ts` derives from receipts, generically | — |
| Delegate | Structurally ready — the shared AgentiQ OS delegation route is agent-generic | `app/api/codex/chat/agentiq-os/delegation/route.ts` |
| Operate | Structurally ready — `aigentme/disposition/route.ts` already accepts `agentSlug`, defaults only when omitted | route file itself |

**The one hardcoded Nakamoto reference found** in the entire `moneypenny-horizen` route tree:
`app/api/journey/moneypenny-horizen/verify/pulse-trace/route.ts`'s `DEFAULT_TRACE_AGENT_SLUG =
'nakamoto'` — a default used only when no `agentSlug` is supplied, never an exclusivity check. Not a
blocker for Factor.

**Cross-agent receipt isolation verified**: `state/route.ts`'s receipt read is
`findAgentReceiptRefs(agent.runtimeAgentId, ...)` — scoped to whichever agent was resolved from the
request, never a fixed `'aigent-nakamoto'`/`'aigent-moneypenny'` literal. Factor's own receipts
(`aigent-factor`) can never leak into or be leaked from Nakamoto's.

**Tests added** (`tests/horizen-factor-journey-parity.test.ts`, source-scan style matching this
repo's convention): pins that the state route, the Operate/disposition route, and the Register
dropdown all resolve/list agents generically (no Factor-specific fork, no Nakamoto-exclusive gate).
Also extended `tests/horizen-registrable-agents.test.ts` with a direct Factor-vs-Nakamoto shape-parity
assertion.

**Not done**: an actual end-to-end rehearsal (Factor's Register ceremony: sign the mandate, approve
the agent's key invocation, broadcast, confirm tokenId) requires an authenticated browser session
with a real principal wallet — this sandboxed session has neither test credentials nor wallet
signing capability. Per the task's own instruction, I am stopping precisely at this first governed,
external act rather than fabricating or guessing at its outcome. Everything upstream of it (the
generic machinery every other agent already uses) is verified ready.

## 4. Register-page UI regression

**Root cause not conclusively identified** — reported honestly rather than guessed at, per this
repo's own rule against blind z-index/pixel fixes.

What was checked and ruled out:
- `RegisterAgentPanel.tsx` has **zero** occurrences of `absolute`, `sticky`, negative margins,
  `overflow-hidden`, or `translate` — its wallet-gate box, ladder box, and Agent Card are all plain
  block-flow siblings inside one `flex flex-col gap-3` container.
- `JourneyRunSurface.tsx`'s only `absolute`-positioned elements near the Register content are: (a)
  the header's "Evidence N/M" popover (`line 960`) — a deliberate, correctly `relative`-anchored
  click-to-open dropdown, not a layout bug; and (b) carousel scroll-arrow buttons and the stage
  timeline's tick/connector marks, both confined to the header area above the scrollable content,
  not overlapping the Register stage's body.
- The one already-known height-collapse defect class in this file (a `flex flex-col` ancestor
  missing `min-h-0`/`flex-1`, fixed once already at `JourneyRunSurface.tsx:1437-1454` for a different
  embed) does not recur in the Register content path — the surfaces wrapper only gets that
  treatment when a stage has exactly one surface, and Register declares two, so `RegisterAgentPanel`
  renders as a bare, unstyled block — consistent with plain document flow, not a collapsed-height
  scenario.

Given this, the described overlap (Evidence text visually merging with the wallet-quarantine
warning) could not be reproduced or attributed to a specific rule from static analysis alone — doing
so would require live DOM/computed-style inspection, which this sandboxed session cannot perform (no
authenticated browser session against `dev-beta.aigentz.me`). **No speculative fix was applied.**

**For the operator**: if this is still reproducing, the fastest path to a real fix is a live
DevTools inspection of the two "colliding" elements (Right-click → Inspect on both the Evidence
header/rows and the wallet-quarantine box) to read their computed `height`/`position`/`transform` —
that will show definitively whether one is truly collapsing to a computed height near 0 while its
children still paint at natural size (the pattern already fixed once elsewhere in this file), versus
a genuine z-index/absolute overlay, versus a screenshot/rendering artifact. Happy to apply the fix
immediately once that's known.

## Files changed

- `components/journey/StageReceiptsDrawer.tsx` — added `aria-expanded={open}` to the Evidence toggle
  button (accessibility fix, requirement 1).
- `tests/horizen-registrable-agents.test.ts` — added Factor-vs-Nakamoto shape-parity assertions.
- `tests/horizen-factor-journey-parity.test.ts` (new) — source-scan canary proving Factor traverses
  the same generic, agent-parameterized journey machinery as every other registrable agent.

## Tests / typecheck

`tests/horizen-registrable-agents.test.ts`, `tests/horizen-factor-journey-parity.test.ts`,
`tests/horizen-agent-page-surface-wiring.test.ts`, `tests/journey-ratify-stage.test.ts`,
`tests/register-ceremony.test.ts`, `tests/cfs-055-coherence-canaries.test.ts`,
`tests/assistant-receipts-agent-scoping.test.ts`, `tests/journey-branch-immediate-reevaluation.test.ts`,
`tests/assistant-receipts-action-type-allowlist-parity.test.ts`,
`tests/register-stage-receipt-agent-isolation.test.ts` — all pass except 2 pre-existing failures in
`register-ceremony.test.ts`, confirmed via `git stash` to predate this change (unrelated to
`StageReceiptsDrawer`).

## Not done this pass

- No live browser rehearsal against `dev-beta.aigentz.me` (no test credentials/wallet in this
  sandboxed session).
- No fix applied for the Register-page layout regression (root cause not confirmed — see §4).
- No deploy — this is an audit-plus-small-fix pass; nothing here needs a build to verify, and the
  one genuine open item (the layout regression) needs live inspection before a real fix, not a
  deploy.

## Genuine remaining blockers requiring operator action

1. **Register-page layout regression**: needs a live DevTools inspection (see §4) to identify the
   actual CSS rule before a real fix can be written — I will not guess at this with z-index/pixel
   hacks per this repo's own rule.
2. **Factor's actual Register ceremony**: needs an operator with wallet-signing access to actually
   sign the mandate/approve the key invocation/broadcast — the code path is verified ready, but
   only a human with a real principal wallet can carry out that governed act.
