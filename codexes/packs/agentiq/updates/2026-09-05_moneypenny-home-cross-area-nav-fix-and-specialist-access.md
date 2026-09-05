# MoneyPenny Home: fixing cross-area navigation, adding specialist access, renaming Factor (2026-09-05)

Operator report: every MoneyPenny Home capability card — the three primary cards and every
nested card inside Understand, Design, Markets, Operate and Monitor — appeared non-functional.
Root cause traced and fixed at the actual navigation layer; specialist access added to Home per
Cartridge spec C-03; Factor's canonical display name corrected to "Aigent Factor".

## Root cause

`MoneyPennyPanelTab.tsx`'s cross-area `navigate()` looked up a **hardcoded cartridge id**
(`MONEYPENNY_CODEX_ID = 'moneypenny-codex'`) in the global `CartridgePresenceRegistry` via
`tryOpenInMountedCartridge`. That registry is keyed by whatever `codexId` the ANCESTOR
`CodexPanelDynamic` instance actually registered itself as (`useCartridgePresence({cartridgeId:
codexId, ...})`). For the standalone `/triad/embed/codex/moneypenny` mount, `codexId` really is
`'moneypenny-codex'`, so the lookup happened to succeed. For every other host — `metame-codex`
(aigentMe's own MoneyPenny group, reached via the FS Bridge / `/bridge/fs`) foremost — the
registered id is the OUTER mounted codex's own id, never `'moneypenny-codex'`, so the lookup
always missed, `tryOpenInMountedCartridge` returned `false`, and the click silently did nothing.

Since from Home nearly every capability item (the three primary cards, Strategy Lab, Risk &
Limits, Market Console, Trading Intents, Runtime, Automation, Service Orchestration, Candidate
Intake, Portfolio/Performance) targets a DIFFERENT area, this defect affected almost every
clickable item under metaMe/FS-Bridge hosting — matching the reported "all cards non-functional."
Two items (Market Research, Learn/Explain) deliberately target `overview` (Home itself — "just ask
MoneyPenny"), so their apparent inertness is by design, not this bug.

**Confirmed by a real render+click test before any fix** (not guessed): the identical click
reliably switched tabs when the registered id was `'moneypenny-codex'` and reliably did NOT when
it was `'metame-codex'` — isolating the defect to the id-lookup mechanism itself, not
`MoneyPennyOverviewPanel`'s buttons (proven separately, and passing, before the fix).

No test previously exercised this: every existing MoneyPenny navigation test
(`moneypenny-experience-coherence-navigation.test.ts`, `moneypenny-capability-navigation.test.ts`,
`moneypenny-copilot-workspace.test.ts`) is a source-string canary — none rendered the component and
clicked a button.

## The fix

**`app/components/codex/CodexHostNavigationContext.tsx`** (new) — the mounted host's OWN
`setActiveTab` function, provided directly by `CodexPanelDynamic` during its own render (not
inside a `useEffect`, so no child-before-parent ordering race — see below), consumed via
`useCodexHostNavigation()`. A descendant no longer needs to know or guess what cartridge id it's
nested under; it just calls `setActiveTab(slug)` on whichever host it's actually inside. Works
identically for the standalone cartridge and any embedding host by construction — no per-host
branch.

`CodexPanelDynamic.tsx` now wraps its render tree in `CodexHostNavigationProvider`, alongside the
existing `CopilotHostProvider` (the same established pattern — see that file's own header).

`MoneyPennyPanelTab.tsx`'s cross-area `navigate()` and the legacy-deep-link self-heal effect now
try `hostNav.setActiveTab(targetArea)` first; `tryOpenInMountedCartridge` (the old id-keyed lookup)
remains only as a defensive fallback for a hypothetical mount outside any `CodexPanelDynamic` tree
— never the primary path. Bonus: since `hostNav` is available synchronously on this component's
own first render, the self-heal effect's `setTimeout(0)` deferral (a 2026-09-03 workaround for an
effect-ordering race between this component and `CodexPanelDynamic`'s own registration effect) is
now structurally unnecessary on the `hostNav` path — it remains only around the legacy fallback,
where that race can still occur.

**A failed navigation is now visible, never silent.** `MoneyPennyPanelTab` tracks
`navigationError` in the shared navigation context; when neither `hostNav` nor the registry
fallback can switch the host's tab, `MoneyPennyCopilotWorkspace` renders a dismissible rose banner
naming the unreachable area — mirroring the existing amber "MoneyPenny suggests" banner's own
pattern.

## Specialist access (Cartridge spec C-03: "Home | ... specialist access")

New collapsed "Specialists" section on Home, below the three primary cards: **Aigent Factor**,
**Aegis**, **Aigent Nakamoto**, **Aigent Know1** — sourced from `REGISTRABLE_AGENTS`
(`services/horizen/registrableAgents.ts`, the same canonical descriptor the Service Orchestration
console itself already reads `displayName` from), not a new hand-maintained label map.
`MONEYPENNY_SPECIALIST_CARDS` (`moneypennyCapabilities.ts`) is the one source of truth.

**Typed navigation intent** — `moneyPennyNavigation.tsx`'s `navigate()` now additionally accepts
`{ panel, specialistId?, activeCaseId? }` (a bare `MoneyPennyPanelKey` string still works
unchanged — purely additive). Factor/Aegis navigate to `candidate-intake`; Nakamoto/Know1 navigate
to `service-orchestration` (the console already shown in the operator's own screenshots) — each
carrying which specialist to pre-select via the SAME one-shot sessionStorage idiom
`writePendingPanel`/`readAndClearPendingPanel` already established
(`writePendingSpecialist`/`readAndClearPendingSpecialist`, `peekPendingSpecialist`/
`clearPendingSpecialist` for a reader that must not consume a value meant for the other
destination panel).

`CandidateIntakePanel.tsx` reads it once, on its own mount, to default `specialist` state (factor
vs aegis). `ServiceOrchestrationPanel.tsx` reads it once its agent catalog has loaded, matching by
`slug` (never a second hand-maintained agentId map), and calls the SAME `selectAgent()` the console
already exposes. Neither panel gained a parallel state authority — this is the existing
`activeCase`-sharing pattern (`moneyPennyNavigation.tsx`) extended, not forked.

## Aigent Factor rename

Bare "Factor" is a common English word and read as generic UI copy wherever it stood alone —
unlike "Nakamoto"/"Kn0w1"/"MoneyPenny", which need no disambiguating prefix. `REGISTRABLE_AGENTS
.factor.displayName` (`services/horizen/registrableAgents.ts`) is now `'Aigent Factor'` — the one
source of truth every projection below reads from or was updated to match:

- **Agent Card** (`app/api/agents/factor/agent-card.json/route.ts`) — `name`/`registry_entry.holder`.
- **Service Orchestration console** — reads `agent.displayName` from the API already; zero code
  change needed there (confirmed: it was already correctly wired, the defect was purely upstream).
- **aigentQube legibility source** (`services/iqube/legibility/sources/aigentQubeSource.ts`) —
  was the one entry NOT already using the `"Aigent X"` form its own siblings use.
- **Specialist response labels** — both `SPECIALIST_LABELS` copies
  (`services/agents/specialistRouter.ts`, `services/orchestration/specialistRecommender.ts` — a
  pre-existing hand-duplicated pair, kept in sync here) and
  `services/smarttriad/specialistDelegation.ts`'s case-consult label.
- **Candidate Intake UI copy** (`CandidateIntakePanel.tsx`) — card title, tab label, composer
  placeholder, refusal-card copy.

Aegis is unchanged (no ambiguity issue; not renamed per instruction, absent a canonical ruling).
`FactorCaseState`/`FactorCaseRow`/etc. type identifiers are code, not display copy — untouched.

## Not touched

EXP-P1/Track2 scientific thresholds, the remediation profile, namespace boundaries, Crystal
membership rules, exception-isolation semantics — unrelated to this pass. No second navigation
system was introduced: `MoneyPennyNavigationContext` remains the one owner of "which panel is
active"; `CartridgePresenceRegistry`/`tryOpenInMountedCartridge` remain the cross-frame,
cross-cartridge seam for callers outside a cartridge's own render tree (the wallet, inter-cartridge
back-links) — this fix only replaces the ONE call site that was using that cross-frame seam for an
IN-TREE relationship it was never suited for.

## Tests

`tests/moneypenny-home-nav-diagnostic.test.tsx` (16 tests, 3 skipped for `panel === null` items) —
proves every Home card, primary and nested, reaches `MoneyPennyNavigationContext.navigate()` with
the exact right target; isolates step 1 of the reported event path before looking further
downstream.

`tests/moneypenny-home-cross-area-navigation.test.tsx` (33 tests, new) — the real fix verification.
Wraps `MoneyPennyPanelTab` in the REAL `CodexHostNavigationProvider` (never a mock of the fix) under
BOTH `'moneypenny-codex'` and `'metame-codex'` host ids (documented as the two that actually differ
at this layer — the FS Bridge and metaMe both register `'metame-codex'`, so there is nothing left
for a third harness to exercise differently) and proves: every non-null-panel Home item actually
renders its destination component in both hosts; all four specialist cards land on the right panel
with the right specialist pre-selected (Factor/Aegis tab selection verified after actually opening a
candidate case through the empty-state form — the tabs don't exist before that); specialist
selection is consumed exactly once and leaves no stale sessionStorage value; legacy `?tab=` deep
links still self-heal in both hosts; same-area carousel navigation is untouched; a genuinely
unreachable cross-area target (no host context, no registry fallback match) renders the visible,
dismissible error banner rather than doing nothing.

`tests/moneypenny-cross-area-integration-diagnostic.test.tsx` (6 tests, existing, header rewritten)
— kept as the dated historical record of the original root-cause reproduction; its "silently
no-ops" block now only exercises the legacy fallback path (no `CodexHostNavigationProvider`
ancestor), which can't occur via the real component registry — no longer the current regression
suite for this area (that's the new file above).

Fixed one real, legitimate breakage from the rename: `tests/moneypenny-candidate-intake-workspace
.test.tsx` (7 occurrences) and `tests/provision-platform-agent-route.test.ts` (1 assertion) pinned
the old "Factor"-only copy/value — updated to "Aigent Factor", not weakened. Confirmed via targeted
grep that no other test asserts `registrableAgents.ts`'s literal `'Factor'` value; the other
`'Factor'` occurrences found across the test suite are unrelated fixture strings passed to generic
wallet-provisioning functions that accept any caller-supplied name.

## Verification

Targeted: 26 `moneypenny*` test files, 453 tests passing (3 intentionally skipped) + the 3 files
above (55 tests, 3 skipped) + 9 unrelated Factor/Aegis/specialist-adjacent files (194 tests) — all
green.

Full regression (`npx vitest run`, 608 files / 10,097 tests): 15 files / 61 tests failing — the
SAME pre-existing, unrelated baseline this branch has carried throughout this session (Journey
Spine, Pulse, myCanvas, repo-weight, resolution-records, canon-document resolution, corpus-scout,
register-ceremony, KNYTS-bridge parity, dev-merge-message-discipline), confirmed by direct grep
that none of them import anything this pass touched.

`npx tsc --noEmit`: 1104 errors, identical to this branch's established baseline (confirmed by
stashing this diff and re-running) — zero new errors in any touched or new file.

**Not done this pass:** an authenticated browser walkthrough (no test credentials exist in this
sandboxed session, per this repo's own recorded pattern); merging to `dev` / confirming Amplify
deployment (not requested for this specific fix).
