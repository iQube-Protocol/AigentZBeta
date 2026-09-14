# Use Case Zero Demo Seed Runner — Build-Order Item 11

**Date:** 14 September 2026
**Status:** Implemented, tested, committed locally. NOT run live — Supabase is
down platform-wide as of this build, and this worktree carries no live
credentials of any kind regardless.
**Base:** `claude/amplify-build-handoff-doc-prubcy` @ `77b7f99ee` (build-order
items 5–10b, all merged).
**Scope:** The first REAL seeded end-to-end demo transaction proving the
whole causal chain — Factor selection → Aegis admission → disclosure
authorization → party bindings → frozen envelope → Vela projection →
underwriting quote → receipt → telemetry — for the three-party scenario
`party-a` = ArkAgent, `party-b` = Aigent Nakamoto, `party-c` = Aigent Kn0w1.
Persona resolution is a DEPENDENCY-INJECTED parameter throughout, per the
operator's own explicit instruction for this exact situation (Supabase down):
never hardcoded, never fabricated, fails closed if missing.

## 1. Why this exists (operator's own framing)

Supabase being down right now must not block getting the ENTIRE deterministic
chain ready. Once Supabase returns, resolving the three real personaIds and
running one script is meant to be the only remaining step.

## 2. Correction of the brief's own paraphrase (read before assuming otherwise)

The brief described `composeUnderwritingAdmissionEvidence` as one of "the REAL
pure compose functions" in this chain. Reading
`services/vela/velaUnderwritingAdmissionEvidence.ts` in full shows this is not
accurate: that function is `async`, takes a live Supabase admin client as its
first parameter, and performs a real read against `aegis_assessments`/
`aegis_findings` before it can honestly resolve ADMITTED/REFUSED/UNRESOLVED.
It cannot be called with zero I/O, and this build item never short-circuits it
into fabricating an ADMITTED result.

**Resolution:** `composeUseCaseZeroDemoChain` (the genuinely pure half) accepts
the ALREADY-RESOLVED `AegisAdmissionEvidence` as an injected parameter — the
same "accept the dependency this worktree cannot itself produce, fail closed
if missing" discipline applied to a fourth dependency, consistently with the
three personaIds. The real `composeUnderwritingAdmissionEvidence` is invoked
exactly once, at the CLI entry point (`main()`) / by any caller wiring the
chain together — never inside the pure compose function, and never
second-guessed: `composeUnderwritingEnvelope`'s own FROZEN/BLOCKED gate is
what decides the outcome from the injected evidence, reused verbatim.

## 3. What was built

### 3.1 `scripts/seedUseCaseZeroDemo.ts` (new)

- `assertUseCaseZeroDemoPersonas(personas)` — fails closed (throws a named,
  actionable error) on any missing/empty persona field.
- `buildUseCaseZeroDemoFactorSelection(personas)` — pure; calls the real,
  unmodified `proposeFactorSelection` with candidate slug `'nakamoto'` (the
  closest real fit for an execution/strategy role among
  `REGISTRABLE_AGENTS`).
- `buildUseCaseZeroDemoDisclosureScope()` — the exact asymmetric scope the
  brief specifies: `{COMPUTE_WITH: party-a}`, `{COMPUTE_WITH: party-b}`,
  `{DISCLOSE_TO: party-b→party-a}`, `{DISCLOSE_TO: party-a→party-c}`.
- `composeUseCaseZeroDemoChain(params)` — PURE (no I/O at all): builds the
  Factor selection, the disclosure authorization, three party-binding INPUTS
  (not yet recorded), and calls the real, unmodified
  `composeUnderwritingEnvelope` to resolve FROZEN/BLOCKED from the injected
  admission evidence. Also returns the two real party inputs
  (`party-a`/`party-b` only — Kn0w1/`party-c` never appears in `parties[]`,
  since the scope only grants it `COMPUTE_WITH` — it never does — the scope
  only grants it `DISCLOSE_TO`, i.e. it is a disclosure recipient, not a
  computation participant) verified against the real WASM guest's own
  `evaluateCombinedInputs` rule (`services/vela/wasm/projector/app/app.go`):
  `totalSpend<=spendLimit` and `totalExposure+totalSpend<=riskLimit` for
  EVERY contributing party. Demo values (`currentExposure:0,
  proposedSpend:400, privateSpendLimit:1000, privateRiskLimit:1000` for both
  contributing parties) verified to resolve ACCEPTABLE by that exact rule.
- `persistUseCaseZeroDemoChain(composed, params)` — the effectful,
  IDEMPOTENT half. Gates every write on the SAME read-only projection this
  codebase already has for "what already happened for this requestRef":
  `getConstitutionalRiskFlowState` for the Factor selection / admission /
  disclosure / freeze steps, and `resolvePartyBindingForViewer` (the
  anti-enumeration binding resolver from build-order item 10b) for the three
  party bindings. Never re-submits to Vela once the envelope is already
  frozen. Calls `recordFactorSelection`, `recordUnderwritingAdmissionEvidence`,
  `recordUnderwritingDisclosureAuthorization`, `recordUnderwritingPartyBinding`
  ×3, and `submitFrozenUnderwritingEnvelope` — the exact set of real,
  unmodified record/persist functions named in this build item's brief, in
  the correct order.
- `resolveUseCaseZeroDemoPersonaIds()` — query-only persona resolver.
  Nakamoto/Kn0w1 resolve by `fio_handle` (`REGISTRABLE_AGENTS`'
  `nakamoto@aigent`/`kn0w1@aigent`), mirroring the exact query shape
  `services/identity/resolveIframePersona.ts`'s own fio_handle branch already
  uses (no standalone exported "resolve by fio_handle" helper exists to
  import instead). ArkAgent resolves by `display_name = 'ArkAgent'` — a
  repo-wide grep of every `supabase/migrations/*.sql` found no
  `CREATE TABLE personas` or `ALTER TABLE personas ADD COLUMN slug`
  anywhere, so the `personas.slug = 'arkagent'` clause in
  `20260804000200_mark_arkagent_aigentme_active.sql` appears to reference a
  column that does not exist — a STATIC-ANALYSIS finding only (no live
  schema query was possible), stated explicitly rather than guessed.
- CLI entry point:
  `tsx scripts/seedUseCaseZeroDemo.ts --arkagent=<id> --nakamoto=<id> --kn0w1=<id> [--evm-key=<hex> --p521-key=<hex>] [--vela-env=local|early_access]`.
  `--evm-key`/`--p521-key` are required only when the envelope actually
  freezes (Aegis has ratified Nakamoto admissible) — constructed via the
  EXACT SAME `VelaClientAdapter` + `resolveVelaDeployment` CLI convention
  `scripts/vela-slice2e-live-composition.ts` already established, rather than
  inventing a new one or silently defaulting to a fake in-memory transport
  for what is meant to be a real demo submission.

### 3.2 `app/(shell)/moneypenny/components/constitutionalRiskFlow/__fixtures__/useCaseZeroDemoFixture.ts` (new)

Non-live, in-memory fixture data for browser QA. Reuses
`composeUseCaseZeroDemoChain`'s own output for select/authorize/freeze (never
hand-typed a second copy), reuses the REAL, exported
`createUnderwritingProvider().quoteForVerdict('ACCEPTABLE')` for the quote's
nine fields, and reuses the REAL `redactConstitutionalRiskFlowStateForParty`
for all three participant views. Every personaId/receipt id/on-chain request
id in this file is an explicit, clearly-fake placeholder string — never
presented as real.

### 3.3 `app/(shell)/moneypenny/dev-fixtures/use-case-zero/` (new)

`page.tsx` — a SERVER component that calls Next's `notFound()` whenever
`process.env.NODE_ENV === 'production'`, so the route does not exist at all
in a production build/runtime, regardless of URL. `UseCaseZeroDemoFixtureViewer.tsx`
— the client renderer, built from the SAME shared `riskFlowSurfaceKit.tsx`
primitives `ConstitutionalRiskFlowPanel.tsx` uses (that panel itself is
protected/unmodified). Every render carries an amber "DEMO / LOCAL FIXTURE"
banner.

### 3.4 Copilot navigation wiring

- `MoneyPennyCopilotWorkspace.tsx`: added
  `{ id: 'mpy-constitutional-risk-flow', label: 'View constitutional risk flow', prompt: 'Can you show me the constitutional risk flow for an underwriting request?' }`
  to `MONEYPENNY_QUICK_PROMPTS` — the prompt text is deliberately phrased to
  contain the literal "constitutional risk flow", so the chat route's own
  keyword sweep lights the suggestion deterministically, the same design
  every existing quick prompt already relies on.
- `app/api/codex/chat/route.ts`: exported `inferSuggestedLayouts` (additive,
  no logic change) so a test can prove the round-trip directly.
- No new specialist-delegation chip scripts were built — out of scope, per
  the brief's own explicit descoping (matching item 10a's own precedent).

## 4. Design decisions left to my judgment (confirm or correct)

1. `USE_CASE_ZERO_DEMO_APPLICATION_ID = 'demo-use-case-zero-application'` —
   no canonical demo/test Vela `applicationId` convention exists anywhere in
   this codebase's non-test source; mirrors `velaFactorProvider.ts`'s own
   "named, self-describing default string" choice
   (`'factor-confidential-workloads'`).
2. `flowOwnerPersonaId` for all three party bindings is ArkAgent's own
   persona — ArkAgent is the principal/initiator of this scenario.
3. Candidate slug for the execution/strategy role is `'nakamoto'` — the
   closest real fit among the four `REGISTRABLE_AGENTS` entries.
4. `authorizedByAgentRef` on the disclosure authorization is
   `'aigent-moneypenny'` — matches every existing test in this repo that
   constructs one for this same role.
5. The fixture-activation mechanism is a dedicated dev-only Next.js route
   gated by `NODE_ENV`, never a URL param alone — see §3.3.

## 5. Verification

- 245 tests pass across every directly-related suite (this item's own 12 new
  tests in `tests/seed-use-case-zero-demo.test.ts` + 3 in
  `tests/moneypenny-constitutional-risk-flow-quick-prompt.test.ts`, plus
  every existing Vela/underwriting/MoneyPenny-copilot suite, unmodified and
  still passing).
- `git diff` against base `77b7f99ee` confirms zero changes to every
  protected file this build item named
  (`velaUnderwritingChainProjection.ts`, `velaUnderwritingCompositionGate.ts`,
  `velaMultiPartyProjection.ts`, `velaPartyNamespace.ts`,
  `activityReceiptDvnPipeline.ts`, `factorSelectionArtifact.ts`,
  `velaUnderwritingAdmissionEvidence.ts`,
  `velaUnderwritingDisclosureAuthorization.ts`,
  `velaUnderwritingPartyBinding.ts`, `velaUnderwritingPartyView.ts`,
  `velaUnderwritingProjection.ts`, `velaUnderwritingRiskTelemetry.ts`,
  `constitutional-risk-flow/route.ts`, `ConstitutionalRiskFlowPanel.tsx`,
  `riskFlowSurfaceKit.tsx`).
- `npx tsc --noEmit` shows no NEW errors in any file touched by this item
  (the one pre-existing error inside `app/api/codex/chat/route.ts` at a
  different line, `domain === 'aigentMe'`, is verified present identically
  in the base commit).
- No live Supabase call, no live Vela submission, no live persona resolution
  was attempted from this worktree — Supabase is down platform-wide and no
  credentials exist here regardless. Every claim above is proven by pure
  computation and mocked-dependency unit tests only.

## 6. Running it once Supabase is back

```bash
# from a clone with real Supabase credentials configured:
npx tsx scripts/seedUseCaseZeroDemo.ts \
  --arkagent=<ArkAgent's real personaId> \
  --nakamoto=<Aigent Nakamoto's real personaId> \
  --kn0w1=<Aigent Kn0w1's real personaId> \
  --evm-key=<hex> --p521-key=<hex>
```

Resolve the three personaIds first (once Supabase is reachable) with:

```ts
import { resolveUseCaseZeroDemoPersonaIds } from './scripts/seedUseCaseZeroDemo';
console.log(await resolveUseCaseZeroDemoPersonaIds());
```
