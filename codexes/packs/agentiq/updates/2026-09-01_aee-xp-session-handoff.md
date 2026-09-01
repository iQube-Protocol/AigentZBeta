# AEE-XP-001 Session Handoff — 2026-09-01

**Purpose of this document:** a new agent picking up this work, in this same workspace, several
builds behind. Read this end-to-end before touching any code. It tells you exactly what's live,
what's mid-flight, what NOT to redo, and the one open decision waiting on the operator.

---

## 1. Where things stand RIGHT NOW

- **Working branch:** `review/irl-scoped-restoration-2026-08-27` (your session branch — same name,
  keep using it unless told otherwise).
- **Last known-good `dev` deploy:** commit `cfd0ac9c4` — **verified green** (Amplify build
  succeeded). This is the tip of dev as of this handoff and it carries ALL work described below.
- **A subsequent, unrelated commit (`2eddcdf`, an automated "codex content update" push — not
  from this workstream)** failed on a **pre-existing** VL-CT-001 venture-receipt Supabase gate
  timeout. Diagnostic query came back **both rows PASS** — the migrations are fine, that failure
  was a transient Supabase probe timeout, not a real gap. No DB action was needed; it does not
  affect anything below. If you see it referenced elsewhere, it's noise — move on.
- **First thing to do:** `git fetch origin dev && git log origin/dev --oneline -5` to confirm
  `cfd0ac9c4` (or a later green commit) is still the tip, then `git fetch origin
  review/irl-scoped-restoration-2026-08-27` and diff against it to confirm your local checkout
  matches. If dev has moved further since this doc was written, read the newer commits' messages
  first — they'll tell you what changed.

## 2. The governing spec

Everything here implements **AEE-XP-001** (and its amendment **AEE-XP-001A**, which made CTP a
required delivery), found at:
- `codexes/packs/agentiq/updates/2026-08-31_aee-xp-three-paper-execution-build-spec.md`
- `codexes/packs/agentiq/updates/2026-08-31_aee-xp-ctp-required-delivery-amendment.md`

Read these before making any AEE/CTP/DCIR/Journey-architecture decision — they are the actual
governing contract, not this handoff doc's summary of them.

## 3. What has been built and deployed, in order (do not redo any of this)

1. **Main Spine Phase 1** — added a Financial Sovereignty on-ramp to both the KNYTS Bridge
   (`services/journey/knytsBridgeCrossingJourney.ts`) and Constitutional Internet Bridge
   (`services/journey/constitutionalInternetBridgeJourney.ts`) journeys, plus XP-5 (wiring the
   real aigentMe companion identity into `JourneyCopilotHost`, live for all three journeys via
   `resolvePrimaryCompanionForJourney`).
2. **CTP Slice C** — repaired an authz bug in the USDC→Q¢ wallet conversion route (fail-closed on
   caller identity), built ONE atomic Postgres RPC (`convert_wallet_asset`) backing a new
   canonical `services/wallet/qctLedgerService.ts#convertWalletAsset`, then implemented
   `ctp.wallet.asset.convert` as a real CTP primitive
   (`services/ctp/primitives/walletAssetConvert.ts`) bound to it via `constitutionalRuntime`.
   Also delivered the CTP foundation itself (`services/ctp/constitutionalRuntime.ts`,
   `services/ctp/registry.ts`, `services/ctp/evidence.ts`,
   `supabase/migrations/20260930140000_ctp_transition_evidence.sql`) and the first migrated
   primitive, `ctp.exchange.artifact.confirm` (OCSGA). **Only two primitives exist in CTP today**
   — this is deliberate progressive migration (AEE-XP-001A §7), not incompleteness.
3. **Main Spine correction** — the operator corrected the FS segment's shape: it's a **dormant,
   conditional branch off CHOOSE** (canonical order `CHOOSE → DISCOVER → LEARN → EXPLORE →
   PREPARE → CROSS`), not a permanently-visible block of stages. New mechanism:
   `JourneyStageDefinition.activationBranch` (types/journey.ts) + `services/journey/
   journeyBranchActivation.ts` (`activateJourneyBranch`/`isJourneyBranchActivated`/
   `getJourneyBranchIntent`/`parseActivatedBranchesParam`/`serializeActivatedBranchesForJourney`).
   Both bridges' "Join Financial Services" / "Apply to join the Constitutional Financial Services
   Pilot" cards now call `activateJourneyBranch(...)`.
4. **XP-1 — first live AEE convergence loop.** The canonical loop is now real and wired:
   ```
   authoritative state -> AdaptiveInteractionContext -> AEE/NBE -> ExperienceProjection
     -> surface -> evidence/state change -> re-evaluation
   ```
   - `services/journey/resolveJourneyState.ts` gained a real `dependenciesMet` (was a stub) and a
     new `computeJourneyReachability` — DAG-correct, branch-aware "what's reachable next,"
     independent of the legacy linear READY heuristic.
   - `services/adaptive/journeyAeeOrchestrator.ts` (NEW) — `computeJourneyAeeOutcome` is the
     first live caller of `services/adaptive/*` (previously zero callers outside its own test).
     Binds `resolveJourneyState` + `assembleInteractionContext` + `buildAdaptiveInteractionContext`
     + `produceExperienceProjection`. **Pure read — never writes, never marks a stage complete.**
   - The legacy DB-backed NBE (`app/api/runtime/nbe/route.ts`) is now documented as a
     candidate/fallback source only, never an independent authority for AEE-adopted journeys.
   - Wired live into `app/api/journey/knyts-bridge/state/route.ts` AND
     `app/api/journey/constitutional-internet-bridge/state/route.ts` (CI parity — identical
     wiring, proven via `describe.each` over both journeys, not a CI-specific reimplementation).
5. **Immediate re-evaluation.** Activating a branch now triggers a same-interaction refetch — no
   reload/remount needed. `activateJourneyBranch` dispatches the SAME `journey:select-stage`
   event it always did, now carrying `trigger: 'branch-intent-change'`;
   `JourneyRunSurface.tsx`'s existing listener checks `shouldReEvaluateAeeProjection` and calls the
   same `refresh()` every other trigger already uses. No second event bus, no client-side
   recommendation engine.
6. **Build-incident repair (2026-09-01).** 15 consecutive Amplify deploys failed with
   `UnhandledSchemeError: node:crypto`. Root cause, fix, and the hard lesson are in section 5
   below — READ IT before adding any new import to a file a client component depends on.

## 4. The AEE control-plane wiring is DONE — do not re-litigate it

The operator's own words, verbatim, once CI parity landed: **"Once CI parity is deployed, stop
treating the control-plane wiring as the open issue."** Do not:
- add more Bridge-specific AEE plumbing unless an actual defect is found;
- build a second orchestrator, a second event bus, or a parallel recommendation engine;
- re-derive `AdaptiveInteractionContext`/`InteractionContext` assembly — it's done, reuse it.

## 5. THE CRITICAL LESSON — client-bundle safety (read before writing ANY import)

**The defect class:** webpack must statically resolve a module's ENTIRE import graph the moment a
`'use client'` component imports ANYTHING from that module — even an export the component never
calls. If that module (or anything it imports) touches Node-only APIs (`crypto`, `fs`, etc.),
the client bundle fails to compile.

**It happened twice in this workstream**, independently:
1. `services/journey/journeyCopilotResolver.ts` — client-safe `resolveJourneyCopilot` lived in the
   same file as the new server-only `resolvePrimaryCompanionForJourney` (which chains to
   `resolveAigentMeIdentity → getActivePersona → constitutionalContext.ts →
   personaSessionToken.ts → node:crypto`). `JourneyCopilotHost.tsx` (`'use client'`) imports from
   this file. Broke every build from the commit that introduced it onward.
2. `services/adaptive/journeyAeeOrchestrator.ts` — `JourneyRunSurface.tsx` (`'use client'`) needed
   only the trivial `shouldReEvaluateAeeProjection`/`JourneyReEvaluationTrigger`, but imported them
   from the orchestrator file, which transitively imports `journeySpineAdapter.ts` and
   `nativeProvider.ts` — **both import `crypto`** for hash-based id generation.

**The fix, both times:** split the file. Server-only/Node-touching code goes in its own file that
ONLY server routes import. The client-safe piece stays in the original file, with zero
dependencies added, ever.
- `services/journey/primaryCompanionResolver.ts` — holds `resolvePrimaryCompanionForJourney`.
- `services/adaptive/journeyReEvaluationTrigger.ts` — holds the trigger contract, **zero
  imports, by design**.

**Two new regression canaries guard this** (they check the SHARED FILE's own source for
server-only imports, not just the client component's — a direct-import check on the client
component is NOT sufficient, since the leak is transitive):
- `tests/journey-copilot-assigned-companion-wiring.test.ts` (describe: "journeyCopilotResolver.ts
  stays CLIENT-BUNDLE-SAFE")
- `tests/journey-branch-immediate-reevaluation.test.ts` (describe:
  "journeyReEvaluationTrigger.ts stays CLIENT-BUNDLE-SAFE")

**Before adding ANY new export to a file that `JourneyCopilotHost.tsx`, `JourneyRunSurface.tsx`,
or any other `'use client'` journey component imports from, ask: does this export's import chain
touch anything server-only (Supabase clients, `crypto`, `fs`, `next/server`'s `NextRequest`, etc.)?
If yes, it goes in a new, separate file.** `npx vitest run` will NOT catch this — it's a webpack
bundling failure, only visible via `next build` or an actual Amplify deploy. If you touch any of
these shared files, run a local `npm run build` before pushing (it takes ~5-6 min locally; no
Supabase credentials are configured in this sandbox, so the build will fail later at "Collecting
page data" with `supabaseUrl is required` — that's expected and NOT a regression, it just means
you got far enough to confirm the webpack compile itself succeeded).

## 6. Deploy workflow (unchanged, use it exactly as established)

```bash
# 1. Commit on your session branch, push it.
git add -A && git commit -F - <<'EOF'
<message>
EOF
git push -u origin review/irl-scoped-restoration-2026-08-27

# 2. Fetch dev, create a temp branch off it, cherry-pick your commit.
git fetch origin dev
git checkout -b deploy-tmp-<slug> origin/dev
git cherry-pick <your-commit-sha>
git diff origin/dev --stat   # confirm the diff is isolated to what you intended

# 3. Bump the deploy trigger, amend with a THE-SUBJECT-COMES-FIRST message
#    (Amplify's deploy list truncates at ~30 chars — branch name must NEVER
#    be the first thing in the message), push straight to dev.
echo "Deploy trigger $(date)" > .amplify-deploy
git add .amplify-deploy
git commit --amend -F - <<'EOF'
<what actually shipped> [merge review/irl-scoped-restoration-2026-08-27]

<body>
EOF
git push origin HEAD:dev

# 4. Clean up.
git checkout review/irl-scoped-restoration-2026-08-27
git branch -D deploy-tmp-<slug>
```

**Always use a HEREDOC (`-F -`) for commit messages, never inline `-m` with backticks or special
characters** — an inline message with backtick-quoted code (e.g. `` `aee` ``) gets shell-interpreted
as command substitution and silently corrupts the message body. This bit a commit message earlier
in this session (cosmetic only, but avoidable).

**`dev` gets automated "update agentiq codex — direct push" commits from an unrelated process
between your pushes** — this is normal, not a merge conflict, not your problem. Just confirm your
diff against `origin/dev` is isolated to what you intended before bumping the deploy trigger.

**Before every push:** `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"` must read
**678** (the tracked pre-existing baseline — not zero, this codebase has known pre-existing
errors; a new number above 678 means you introduced a regression). Full suite
(`npx vitest run`) baseline is **17 failed test files / 50 failed tests** (repo-weight budget,
one resolution-records doc-link gap, and one flaky `register-ceremony.test.ts` regex match —
all pre-existing, confirmed against the unmodified baseline via `git stash`). If your numbers
differ from these two baselines, investigate before pushing — don't assume it's pre-existing
without checking.

## 7. THE OPEN DECISION — do not resolve unilaterally, this is where you pick up

The operator asked for a **Financial Sovereignty stage-evidence contract** — making the live AEE
path adaptive from **authoritative evidence**, not just declared branch intent. A full
reconnaissance pass (3 parallel Explore-agent audits: CTP, DCIR, and the Experience-architecture
chain) produced a 18-row convergence matrix, delivered to the operator, **not yet acted on** — the
build incident interrupted it. Key findings, so you don't re-derive them:

- **No durable evidence source exists anywhere in the platform** (not FS-specific — confirmed
  platform-wide) for "a visitor meaningfully engaged with a Pill/Capsule/orientation page." DCIR
  observes real events but nothing promotes them to durable evidence, for any feature.
  `ExperienceIntentProjection.observedBehavior` is a real type, threaded through
  `assembleInteractionContext`/the AEE orchestrator as a pure pass-through, populated by **zero**
  code paths anywhere.
- **CTP is NOT migrated for FS agent registration/claim** — confirmed via source audit
  (`services/horizen/registerCeremony.ts` has zero CTP imports). The real, existing, durable
  evidence for "has this persona already registered/claimed an FS agent" is the LEGACY
  `activity_receipts` table (`horizen_agent_registered`, `agent_registry_binding_recorded`,
  `agent_control_proven`), readable via `listActivityReceiptsForPersona`. This is the ONE clean,
  zero-new-schema evidence source available today.
- **MoneyPenny service catalogue is already correctly wired** — `FinancialSovereigntyIntroStage`'s
  EXPLORE mode already projects `listFinancialServiceDefinitions()` (Advisor/Architect/Runtime
  Confidential/Runtime Constitutional). Nothing to fix there.
- **Standing must never gate DISCOVER/LEARN/EXPLORE** — repeated, explicit operator ruling across
  multiple journey files: Standing is a downstream outcome, never inflated by navigation/viewing.

**The specific open decision, put to the operator, awaiting their answer:**

> The acceptance criteria ask for INDEPENDENTLY satisfiable "valid DISCOVER evidence" and "valid
> DISCOVER + LEARN evidence" — but no direct engagement-evidence mechanism exists for those stages
> anywhere in the platform. Only real evidence available today is INHERITANCE (an already-registered
> FS agent's receipts satisfy DISCOVER+LEARN+EXPLORE+PREPARE together, not incrementally — matching
> "AEE may decide an experience is unnecessary because authoritative state is already satisfied;
> AEE may never manufacture the state that makes it unnecessary"). Two options:
> 1. Implement inheritance-only this pass (zero new schema); prove the incremental cases only on a
>    fixture, not the live FS stages.
> 2. Scope in a minimal direct-evidence mechanism (new `ActivityActionType` literals, reusing the
>    existing `activity_receipts` table — not a new table) so the incremental cases are live-provable.

**Do not decide this yourself. Do not add `fs_*` receipt types, DCIR persistence work, or any new
schema until the operator answers.** The full matrix (18 rows: Experience Qube, ExperienceIntentProjection,
Experience Matrix, Experience Guide, Pills, Capsules, mini-runtime, StudioArtifact, Runtime
consumption, aigentMe, DCIR, Activity Receipts, CTP, MoneyPenny catalogue, Agent registration/claim,
Passport, Standing, ExperienceHandoff — each with canonical owner / current implementation /
persistence / observation source / durable evidence source / Journey role / AEE role / CTP role /
DCIR role / actual gap / smallest reuse-first repair) is in this session's transcript, not yet
saved to a file. **Reconstruct it from source if the operator wants it re-derived** — every finding
above has an exact file/line citation behind it — or ask the operator to paste it back to you from
their side of the conversation if they have it.

## 8. Reference semantics for the FS stages (once the decision above is made)

- **DISCOVER** — meaningfully encountered FS's existence/role. Never satisfied by page render alone.
- **LEARN** — relevant understanding, never "opened a Capsule" = competence.
- **EXPLORE** — meaningful interaction with real MoneyPenny service projections (catalogue already
  correct — see §7), prefer interaction evidence over page visitation.
- **PREPARE** — real declared intent (`activatedBranches`, already live) + a server-verified agent
  candidate (relay the client's declared slug the same way `activatedBranches` is relayed, verify
  against `services/horizen/registrableAgents.ts#listRegistrableAgents()`) + inheritance fallback.
  **Never** reference Passport/delegation state as if it authorizes FS crossing.
- **CROSS** — not "learning completed." Satisfaction = the target FS Journey
  (`services/journey/horizenMoneyPennyJourney.ts`) independently resolving its OWN register/claim
  evidence as COMPLETE — read via the same `listActivityReceiptsForPersona` call, never the
  `ExperienceHandoff`'s own existence (it's explicitly non-authoritative — continuity/intent only).

## 9. How to reach THIS session for context you can't reconstruct from source

This handoff was written by a Claude Code Remote session that is likely still alive (it hit
usage-rate pressure, not a hard stop) but may go quiet without warning:

- **Session ID:** `session_01NQfGRfi4TgkQbnzUxbMKG9` (title "Leap 2", environment
  `env_01661dYGpwQehVpQncoW7Hjf`, origin `web_claude_ai`).
- **To look it up:** `mcp__Claude_Code_Remote__list_sessions` (filter for this id/title) or
  `mcp__Claude_Code_Remote__get_session` with `session_id: "session_01NQfGRfi4TgkQbnzUxbMKG9"` —
  this tells you its current `session_status` (RUNNING/idle/archived) before you try messaging it.
- **To ask it something directly:** `mcp__Claude_Code_Remote__send_message` (or your harness's
  equivalent cross-session message tool) addressed to that session ID. It resumes with full
  context of everything in this handoff plus everything NOT written down here — in particular,
  **the full 18-row FS evidence convergence matrix from §7 lives only in that session's
  transcript**, never saved to a file. If you need it verbatim rather than re-derived from
  source, this is the fastest path — ask it to paste the matrix back, or to answer a specific
  question about a row's citation.
- **If it doesn't respond** (rate cap reached, session ended, or archived): everything essential
  is already in this document and in the commit history it cites — you do not NEED a response to
  proceed. The matrix is fully reconstructable from source (every finding cites exact
  files/functions); re-run the same 3-way audit (CTP / DCIR / Experience-architecture chain) if
  you need it fresh rather than waiting.
- **The operator is the other source of the matrix** — it was delivered to them in full in that
  session's chat before this handoff was written. Asking them to paste it back is often faster
  than either of the above.

## 10. Quick orientation checklist for the new agent

1. `git fetch origin dev && git log origin/dev --oneline -10` — confirm `cfd0ac9c4` or later is
   green (ask the operator to confirm current Amplify status if unsure).
2. `git checkout review/irl-scoped-restoration-2026-08-27 && git pull` — get on the working branch.
3. Read `codexes/packs/agentiq/updates/2026-08-31_aee-xp-three-paper-execution-build-spec.md` and
   `..._aee-xp-ctp-required-delivery-amendment.md` (the actual governing spec).
4. Read `services/adaptive/journeyAeeOrchestrator.ts`'s header comment (states the canonical loop
   and who-owns-what) and `services/journey/resolveJourneyState.ts`'s `computeJourneyReachability`
   doc comment (states the focus rule).
5. Run `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"` — must read 678.
6. Run `npx vitest run tests/adaptive-fs-branch-acceptance.test.ts tests/journey-branch-immediate-reevaluation.test.ts tests/ci-bridge-state-aee-wiring.test.ts tests/knyts-bridge-state-aee-wiring.test.ts` —
   all should pass; this is the fastest way to confirm the AEE loop is intact in your checkout.
7. **Do not proceed to FS evidence implementation** until you've surfaced §7's open decision to the
   operator and gotten an answer.
