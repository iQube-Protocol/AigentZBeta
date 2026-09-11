# Factor + Aegis Bankr PRD — Phases 6-9 Delivery Report

**Status:** Phases 0-5 shipped and tested in a prior session (`9a11c7c`). This
report covers Phase 6 (backend + frontend, 3 of 5 host contexts wired),
Phase 7 verification, Phase 8 additional tests, and Phase 9 (rehearsal
script). Phase 10 (DevOn skill) and the final cross-phase summary are
addressed at the end.

No token launch, wallet provisioning against a live provider, or on-chain
action has occurred at any point in this work. Everything remains in
simulated/fake-transport mode — no live `BANKR_*_API_KEY` is configured in
this deployment (Phase 0's finding, unchanged through every phase since).

## Phase 6 — MoneyPenny/SmartTriad surfaces

### Backend (this session, shipped to `dev`)

Real HTTP routes under `app/api/moneypenny/factor/bankr/`:

| Route | Purpose |
|---|---|
| `POST /readiness` | issuer readiness + optional provider-wallet-binding provisioning |
| `POST /launches` | create a draft launch (operator-supplied fields only) |
| `GET /launches/[launchId]` | tenant-checked read |
| `POST /launches/[launchId]/action` | dispatch: `preflight \| request_aegis \| request_approval \| submit \| inspect_status \| fee_claims` |
| `POST /launches/[launchId]/approve` | the ONE route that may approve — deliberately separate from Factor's own action dispatch, mirroring `decide-admission`'s separation of authority |

These give `SpecialistResponseCard`'s typed `availableActions` (added in an
earlier Factor runtime-contract phase but rendered as inert pills) a real
backend to call.

### Frontend (this session, shipped to `dev`)

`services/factor/useBankrTokenLaunch.ts` — the one client controller for
every Bankr surface, calling only the real routes above via `personaFetch`
(never `bankrCapabilityHandlers.ts` directly, never Bankr's own API).
`approve()` is a separate function against the separate `/approve` route,
never folded into the action dispatcher.

Eight atomic surfaces under `components/moneypenny/bankr/` — readiness +
provider-wallet binding, an operator launch-spec form (every field starts
empty, nothing pre-filled), Bankr terms (with provenance + simulated
badge), Aegis review, human/MoneyPenny approval (visually and structurally
separate from Factor's own actions), deployment status (submitted vs.
confirmed visibly distinguished), and fee claims (honest "not known" note,
no invented amount) — composed into `BankrTokenLaunchCapsule` at
`compact | expanded | panel` depths (one controller instance, no remount
on depth toggle, mirroring `MarketConsoleCapsule`'s pattern) plus a modal
wrapper.

**3 of the PRD's 5 host contexts are wired**, each traced to its real mount
point:
1. MoneyPenny chat inline — `SpecialistResponseCard`'s action pills now
   call a real `onAction` handler; `SpecialistWorkspace` mounts an inline
   capsule per turn.
2. `FactorPanel`'s right-pane — a new "Bankr tokenization" mode at `panel`
   depth.
3. Modal, reached from MoneyPenny's Financial Services admin —
   `ServiceOrchestrationPanel`'s Bankr catalog row opens
   `BankrTokenLaunchModal` scoped to the selected agent.

**Not wired, honestly:** the SmartTriad rich-block "capsule" hosting
registry (`SmartTriadRichBlockRenderer.tsx`'s `LIVE_CAPSULE_COMPONENTS`).
That requires the backend to emit a `capsuleId`-bearing rich-block envelope
for Factor's Bankr responses, which doesn't exist yet — wiring it
client-side alone would misrepresent what's actually live.

10 new RTL tests; the full targeted suite (Bankr + FactorPanel/candidate-
intake, 83 tests) passes with no regressions; `tsc --noEmit` baseline holds
at 679, zero new errors.

### Two real gaps closed while wiring the caller

Reading `bankrCapabilityHandlers.ts` in order to call it from a route
surfaced two things that were real defects, not just missing routes:

1. **Cross-tenant read gap.** `preflightLaunch`, `submitApprovedLaunch`,
   `inspectDeploymentStatus`, and `inspectFeeClaims` all read
   `token_launches` with a raw `.eq('id', id)` select — no tenant_id check
   at all, unlike every other function in `tokenLaunchService.ts`. Fixed by
   exporting the existing tenant-checked read as `getTokenLaunch` and
   switching all four over. `inspectFeeClaims` gained a required
   `tenantId` parameter (was missing one entirely).
2. **Phase 8's drift check was declared but never called.**
   `checkBankrTermsDrift` existed and was re-exported with a comment saying
   "the caller ... must call and act on BEFORE reaching here" — but no
   caller existed. Wired it directly into `submitApprovedLaunch`: re-quote,
   compare against the frozen `bankr_terms_hash`, and on drift transition
   the launch to `revision_required` and refuse to submit. Also wired an
   optional authority-chain gate (`bankr-token-launch-submit`) following
   `factorCaseService.ts`'s existing optional-chain pattern (a launch with
   no chain bound is unaffected; a bound chain must actually grant the
   action).

## Phase 7 — receipts and registry (verification)

All 8 receipt action types the PRD names were already declared in Phase 4
(`ActivityActionType` union + 6 of them in `ANCHORABLE_ACTION_TYPES`).
Checking which were actually **emitted** found 3 more dormant ones — wired
this session:

- `bankr_provider_bound` — now emitted from `provisionProviderWalletBinding`
  on a genuinely new or reactivated binding (never on a routine idempotent
  refresh of an already-active one).
- `bankr_launch_preflighted` — now emitted from `preflightLaunch`.
- `aegis_token_assessment_ratified` — now emitted from
  `ratifyAssessment`, additive to the generic `aegis_assessment_ratified`,
  whenever the ratified assessment's `subject_type === 'token_launch'`.

`token_launch_proposed`, `token_launch_approved`, `token_launch_submitted`,
`token_launch_confirmed` were already emitted (Phase 4).

**`token_fees_claimed` remains unemitted** — by design, not oversight:
`inspectFeeClaims`'s own Phase 0 finding is that Bankr has no publicly
documented fee-claim endpoint, so there is nothing to claim yet.

**Gap found and NOT closed this session:** the PRD also says "Update the
Factor Agent Card and iQube Registry linkage only after a confirmed
on-chain deployment." No code path exists today that updates the Agent
Card or registry from a confirmed `token_launches` row — `confirmTokenLaunch`
writes the row but nothing downstream reads it into the Agent Card/registry.
This is flagged rather than guessed at: the registry subsystem
(`services/registry/*`) is large and unfamiliar enough that writing
speculative mutation code against it — for an event (a real on-chain
confirmation) that cannot occur in this deployment without live Bankr
credentials anyway — would be exactly the kind of unverifiable guess
CLAUDE.md's No-Guessing rule warns against. Left as an explicit backlog
item for whoever has live credentials to test against.

## Phase 8 — tests

Added `tests/bankr-governance-invariants.test.ts` covering PRD acceptance
criteria not exercised elsewhere:

- Bankr's write adapter (`createBankrProviderAdapter`) is imported/called
  from exactly one file outside its own definition (structural grep over
  `services/`, not a behavioral assumption) — "Factor cannot call the
  provider write adapter directly."
- `bankrCapabilityHandlers.ts` never calls `approveTokenLaunch` (a dead
  import of it was found and removed while writing this test) — "Factor
  cannot approve its own token."
- `requestAegisAssessment` never lets a caller name who assesses —
  `assessed_by_agent_ref` is always `'aigent-aegis'` regardless of input.
- A critical Aegis finding blocks approval specifically for the
  `token_launch` subject type (the generic case was already covered
  elsewhere).
- The fee recipient actually used at submission is structurally the one
  frozen at approval (`submitApprovedLaunch` takes no caller-suppliable
  `feeRecipient` at all).

Plus the tenant-isolation and drift/authority-chain tests added alongside
the Phase 6 backend routes (see that commit).

**Full-suite / typecheck baseline** (measured before any of this session's
changes, `dev` at `9a11c7c`): 622 test files, 10281 tests, 57 failing across
18 files — all pre-existing and unrelated to Bankr/Factor/Aegis (journey,
pulse, resolution-records, repo-weight, etc.). `tsc --noEmit`: 679 errors.

After this session's changes: same 18 files / same failure set (verified
by name, not just count) in the one full run taken; all targeted
Bankr/Factor/Aegis suites (13 files, 217 tests as of the last targeted run)
pass; `tsc --noEmit` still exactly 679 errors, zero in any touched file.

## Phase 9 — live rehearsal boundary

`scripts/bankr-live-rehearsal.mjs` — drives the real HTTP pipeline
(readiness → prepare → preflight → request Aegis → drive assessment to
ratified → request approval) against a deployed host using only the routes
this session shipped. It has no submit/approve/sign/broadcast/claim-fees
path and no `--yes`/`--force` bypass (there is nothing to bypass — it never
reaches a destructive action). It stops after printing the exact human
approval package (launch spec, Bankr terms + provenance, Aegis decision/
rationale, disclosures) and names the exact follow-up call (`.../approve`)
an operator must make separately to proceed.

**Not run against a live host this session** — running it requires a JWT
for a deployed environment, which this sandbox does not have. It is
provided as a runnable artifact for the operator/next session to execute,
not something this session verified end-to-end over the network (the same
logic IS verified end-to-end via `tests/bankr-api-routes.test.ts`'s
in-process route tests, using the identical route handlers).

## Phase 10 — DevOn skill

**Not started — flagging a genuine ambiguity rather than guessing.** This
repo already has an unrelated internal system also called "DevOn"
(`services/devCommandCenter/*`, an AI-assisted dev-workflow/IDE product —
see `tests/invariant-envelope-devon-wiring.test.ts`'s "IDE 2.0 → DevOn"
framing). It has no "skill" registration concept of its own. Separately,
this repo has no `.claude/skills/` directory at all yet (CLAUDE.md
references `.claude/skills/steward/SKILL.md` and `.../babysit/SKILL.md`
conditionally, "if they exist" — they don't, in this checkout).

So "a reusable DevOn skill" in the PRD could mean either: (a) a genuine
Claude Code skill (`.claude/skills/<name>/SKILL.md`) capturing the
bootstrap recipe, which would be the first skill of its kind in this repo,
or (b) something integrated with the existing `devCommandCenter` "DevOn"
system, which has no precedent for packaging a capability this way today.
Building either without confirming which is a guess this task's own rules
tell me not to make. Recommend the operator clarify before this phase is
attempted.

## What remains blocked / deferred

- Phase 6's SmartTriad rich-block capsule-hosting registry (2 of 5 host
  contexts) — needs a backend-emitted `capsuleId` envelope that doesn't
  exist yet; the other 3 host contexts are wired (see above).
- Agent Card / iQube Registry linkage on confirmation (Phase 7 gap, above).
- Phase 9's script has not been run against a live deployed host.
- Phase 10 — blocked on the DevOn ambiguity above.
- No live Bankr Partner/Token-Launch API credentials exist in this
  deployment at any point — every phase's "live" claim is actually
  "deterministic fake transport, honestly labeled `simulated: true`."

## Migrations applied (this session: none — all 5 predate this session)

`20260930200000_moneypenny_bankr_tokenization_capability.sql`,
`20260930210000_provider_wallet_bindings.sql`,
`20260930220000_token_launches.sql`,
`20260930230000_aegis_assessments_token_launch_subject.sql`,
`20260930240000_bankr_token_launch_receipt_action_types.sql` — all from
Phases 2-4, already applied per the prior session's report. No new
migration was needed this session (routes + drift/tenant/receipt wiring
were all application-layer).

## Provider capabilities actually verified

None live — `bankrConfig.ts` confirms no `BANKR_*` env var exists in this
deployment (checked again this session; unchanged). Every route/script in
this delivery runs against the deterministic fake transport.

## Factor manifest statuses changed, with evidence

No `status`/`handlerKind` field changed this session (the manifest's
`bankr_tokenization` entry stayed `status: "partial"`, `handlerKind:
"service"` from Phase 5). Only the `description` string was updated to
name the new HTTP routes, the drift/authority-chain enforcement now
present at submission, and the approve/action-dispatch separation —
evidence: `services/factor/factorCapabilityManifest.ts`'s `bankr_tokenization`
entry, and the routes/tests this report cites.
