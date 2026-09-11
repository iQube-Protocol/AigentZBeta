# Horizen registration observer reconciliation — closing the gap Aigent Nakamoto's live registration exposed

**Status:** shipped, 2026-08-03. Directly unblocks the pilot: Aigent Nakamoto's Base Sepolia
registration (tx `0xedda5f7388434fd979311b4573d1058ad33219058290ef8ea10b429b64b5dde6`, tokenId
`8798`) is real and confirmed — this fix makes every surface agree that it happened.

---

## What the pilot reported

The Register stage's own confirmation banner ("Aigent Nakamoto is registered — Horizen tokenId
8798") was visibly correct, and three other things were visibly wrong at the same time:

1. The Register progress strip still showed "Transaction broadcast to Horizen" as current, then
   on the next poll flipped to "The last attempt lapsed — start again" — a CONFIRMED registration
   reporting itself as never having happened.
2. The Verify stage (`PulseTransparencyToggle`) said "Aigent Nakamoto does not have a Horizen
   tokenId yet," even though the master Journey stepper had already advanced past Register to
   Verify.
3. Claim's "Prove wallet control" answered `no registry_assets row for "aigentqube-moneypenny"` —
   while the operator was claiming **Nakamoto**.

## Root cause — two independent writes, not one

A confirmed registration makes **two separate Supabase writes** from
`checkAgentRegistrationStatus`: `createRegistrationReceipt` (always attempted) and
`updateRegistryAssetBinding` (a second, independent write into
`registry_assets.metadata.external_registry_bindings[0]`). Nothing makes them atomic, and
`updateRegistryAssetBinding` had **three silent-return points** (`!admin`, `!row`,
`bindings.length === 0`) plus a discarded `.update()` error — so a failure there produced no
signal anywhere.

Nakamoto's registration proved this isn't theoretical: the receipt was written, the
`registry_assets` projection was not. Every surface reading the projection alone
(`PulseTransparencyToggle`, the Register ladder via the agent-card fetch, `AgentCardSurface`,
Claim's own gate) reported her unregistered, while the master Journey stepper —
`/api/journey/moneypenny-horizen/state`, which derives Register-complete from
`hasReceipt('horizen_agent_registered')` — correctly saw the receipt and advanced to Verify. Two
correct readers of two different sources, disagreeing because the sources disagreed.

Separately, and independently: Claim's surface (`MarketaEligibilityView`) never sent `agentSlug`
at all — its props were declared and unused (`_props`) — so both its requests to
`claim/prove-control` fell back to the server's `DEFAULT_REGISTRABLE_AGENT_SLUG` (MoneyPenny),
regardless of which agent Register/Verify had just acted on.

## The fixes

### 1. The receipt now carries the structured result, not just the transaction

`services/horizen/registrationClient.ts`'s `createRegistrationReceipt` deps callback is enriched
with `tokenId`, `registryAddress`, `ownerAddress`, `confirmationSource`, `blockNumber`, `logIndex`
— all values already computed by the confirmation logic, never re-derived or guessed.
`agentIdRecovery.ts`'s `decodeAgentIdFromReceipt` now also returns the minting log's
`blockNumber`/`logIndex`. The `horizen_agent_registered` receipt's `actionInput.registration`
block carries all of this (`app/api/journey/moneypenny-horizen/register/status/route.ts`).

### 2. One resilient reader, shared by every consumer

`services/horizen/agentRegistrationBinding.ts` (new) — `resolveHorizenRegistrationBinding(admin,
agent)`. Reads the `registry_assets` projection first (the fast, intended source once the write
lands); falls back to the confirmation receipt's structured block **only** when the projection
carries no tokenId; reports `fromReceiptFallback: true` so a stuck write stays diagnosable rather
than silently working around itself forever.

Wired into the three places that previously each read `registry_assets` directly
(inv.engineering.036/037 — one authoritative projection, not three copies):
- `app/api/agents/moneypenny/agent-card.json/route.ts`
- `app/api/agents/nakamoto/agent-card.json/route.ts`
- `app/api/journey/moneypenny-horizen/claim/prove-control/route.ts`

Because `PulseTransparencyToggle` and the Register ladder both read the served Agent Card (never
`registry_assets` directly), fixing the two Agent Card routes fixes both of them with no client
changes.

### 3. The silent write failure is silent no longer

`updateRegistryAssetBinding` (`register/status/route.ts`) now logs a distinct `[HORIZEN BINDING]`
error at every branch that previously returned quietly: no admin client, the read itself
erroring, no row, no binding array, and the `.update()` call's own error (previously discarded
entirely). It still does not retry and does not fail the request — the receipt fallback above is
what keeps readers correct while this is being fixed; this change's job is only to stop hiding
that the write happened or didn't.

### 4. The terminal rung is done, not current

`services/horizen/registerCeremonyProgress.ts`: the ladder's `i === at ? 'current' : ...` rule
rendered even a **confirmed** registration's own last rung ("Registered — tokenId issued") as
still in flight (violet ●) forever, because `REGISTERED` is the ladder's own last index. Fixed:
when `stageId === 'REGISTERED'`, every rung — including the last — renders `'done'`.

### 5. Claim reads the selected agent, never a default

`MarketaEligibilityView` now requires `agentSlug` (no more `_props`), sends it as a query param on
its GET refresh and in its POST body — mirroring the exact fix `PulseTransparencyToggle` got on
2026-08-02 for the identical bug shape. `PilotJourneyTab.tsx`'s `resolveSurfaceProps` passes
`agentSlug: selectedAgentSlug` into it, never a literal.

## What was deliberately NOT done

- **No retry mechanism for the stuck `updateRegistryAssetBinding` write.** The receipt fallback
  makes the read side correct regardless; adding a write-retry is separate work with its own
  idempotency questions, out of scope for unblocking the pilot today.
- **No general cross-stage "one subject-scoped Journey projection" rewrite.** The receipt fallback
  achieves the practical outcome (every surface converges on the same fact) without a larger
  refactor of how each stage reads its state.
- **No `STATE_CONFLICT` rendering system.** Only one genuine conflict source exists today
  (registry_assets vs. receipt for tokenId), and it's resolved by precedence (projection wins when
  present) rather than surfaced as an unresolved conflict — there is nothing for an operator to
  adjudicate here, unlike a case where two independently-asserted facts disagree.
- **No changes to the Horizen confirmation heuristic** (`horizenConfirmed`) — untouched by this
  fix, per the standing rule from the previous fix in this same file.

## Verification

- `tests/horizen-agent-registration-binding.test.ts` — **new**, 6 tests: projection-wins,
  receipt-fallback, cross-agent-attribution refusal, unstructured-receipt refusal, no-persona
  graceful return, no-row graceful return.
- `tests/claim-prove-control-route.test.ts` — 5 new tests: agent selection honored (never
  defaults), the receipt fallback unblocks Claim end-to-end, a genuinely unregistered agent still
  refuses `MISSING_TOKEN_ID` (the fallback never fabricates a positive).
- `tests/register-ceremony.test.ts` — 5 new tests: the confirmed-registration ladder renders all
  rungs done; the Horizen confirmation heuristic assertions from the prior fix still hold
  unchanged.
- `tests/horizen-agent-page-surface-wiring.test.ts` — 3 new tests: Claim's agent-selection wiring,
  mirroring the existing Verify-stage wiring canaries.
- Full relevant suite: **292 tests across 11 files, all passing.**
- `npm run type-check:research` — briefly widened to cover `services/horizen/**`,
  `components/journey/**`, and the two Agent Card routes to verify this change introduces no new
  errors; confirmed and **reverted** (see finding below). Baseline unmoved at 10 in the scope this
  repo actually gates on.

### Findings flagged, not fixed here

- Widening the scoped typecheck surfaced that `components/journey/PulseTransparencyToggle.tsx`
  and (now) `MarketaEligibilityView.tsx` are not structurally assignable to
  `PilotJourneyTab.tsx`'s `JOURNEY_COMPONENTS: Record<string, React.ComponentType<Record<string,
  unknown>>>` map — both components declare specific required props, which TypeScript correctly
  flags as incompatible with the generic `Record<string, unknown>` props type the map promises.
  This is **pre-existing** (PulseTransparencyToggle has required `agentSlug` since 2026-08-02,
  long before today) and invisible until now only because neither file was ever in scope for the
  one working typecheck config. It's a real type-soundness gap in `JOURNEY_COMPONENTS`'s typing,
  not a runtime bug — React doesn't enforce this at runtime. Worth a dedicated fix to the map's
  typing (a discriminated union or a per-component cast at the call site), not bundled into a
  pilot-unblocking change.
- Also re-surfaced (already flagged in the prior update doc, still unfixed):
  `services/horizen/client.ts:82` calling a `fetchWithRetry` that doesn't exist on
  `corpusScout/retrieval`; `services/horizen/agentBinding.ts:676`'s `OwnershipFreshnessTier`
  mismatch; `services/identity/walletAliasService.ts`'s three unsound `DidPersonaRecord` casts.

## Files

| File | Change |
|---|---|
| `services/horizen/agentRegistrationBinding.ts` | NEW — the one resilient binding reader |
| `services/horizen/agentIdRecovery.ts` | decode result carries `blockNumber`/`logIndex` |
| `services/horizen/registrationClient.ts` | receipt callback enriched with structured registration fields |
| `services/horizen/registerCeremonyProgress.ts` | terminal rung renders `done`, not `current` |
| `app/api/journey/moneypenny-horizen/register/status/route.ts` | `updateRegistryAssetBinding` errors are logged, never swallowed; receipt `actionInput.registration` enriched |
| `app/api/journey/moneypenny-horizen/claim/prove-control/route.ts` | reads via the shared resolver, not raw `registry_assets` |
| `app/api/agents/moneypenny/agent-card.json/route.ts` | reads via the shared resolver |
| `app/api/agents/nakamoto/agent-card.json/route.ts` | reads via the shared resolver |
| `components/journey/MarketaEligibilityView.tsx` | requires and sends `agentSlug` |
| `app/triad/components/codex/tabs/PilotJourneyTab.tsx` | passes `agentSlug: selectedAgentSlug` into `MarketaEligibilityView` |
| `tests/horizen-agent-registration-binding.test.ts` | NEW |
| `tests/claim-prove-control-route.test.ts`, `tests/register-ceremony.test.ts`, `tests/horizen-agent-page-surface-wiring.test.ts` | new canaries |

## Still open

- The Bitcent wallet-wiring gap and the Track 2 Stage 2 machine-recommendation engine are being
  worked in parallel background sessions — not part of this change.
