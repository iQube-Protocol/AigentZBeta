# SPEC-COS-001 Phase 1 — the substrate-state resolver + progressive surface activation

**Date:** 2026-07-25 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Spec:** `codexes/packs/irl/foundation/SPEC-COS-001_constitutional-onboarding-specification.md` (RATIFIED operator-directed 2026-07-25; Phase 1 recorded in its §12)

---

## 0. What this pass did

SPEC-COS-001 states the platform's one onboarding substrate:

```
Claude → MCP → Passport → Delegation → Agent Me → Experience Qubes → Journey recommendation
```

…and its load-bearing invariant: **no specialist journey may define its own Passport, delegation, or identity-establishment step.**

Phase 1 builds the **smallest honest slice** of that: a service that resolves *where a caller currently stands on the substrate*, a pure function expressing *which surfaces may therefore be active*, a spine-gated read-only route, and a canary. It builds **no UI, no MCP gateway, no specialist journey, and no database migration.**

Most of the substrate is already shipped — inside metaMe Threshold (PRD-THR-001) and the CFS-043 guided-onboarding primitives. Re-implementing any of it would have been the exact CS-001 duplicate-capability defect the spec's own §1 invariant forbids. This pass therefore **composes**, and the canary makes that checkable rather than merely claimed.

---

## 1. Files

### Built

| File | Role |
|---|---|
| `services/onboarding/substrateState.ts` | The resolver. Pure core + thin I/O shell. |
| `app/api/onboarding/substrate-state/route.ts` | `GET` only, spine-gated, T1-safe, `personaFetch`-compatible. |
| `tests/onboarding-substrate.test.ts` | 22-assertion canary, peer of `tests/threshold-gateway.test.ts`. |

### Refactored (moved, not copied)

| File | Change |
|---|---|
| `services/passport/participationSelfView.ts` | **New** — the extracted body of `GET /api/participation/my-access`. |
| `app/api/participation/my-access/route.ts` | Now calls the extracted reader. **Response shape byte-identical.** |
| `tests/source-of-truth-parity.test.ts` | Comment-only: registers the new parity canary in the index, as `inv.engineering.036/037` enforcement requires. |

---

## 2. The pure core

```ts
resolveSubstrateLayers(observation) → SubstrateLayer[]   // PURE
activeSurfaces(layers)              → SubstrateSurfaceId[] // PURE — §4's doctrine
nextAction(layers, deepLinks)       → SubstrateNextAction | null // PURE
recommendJourney(archetype)         → ConstitutionalJourney | null // PURE
```

Each layer carries four things — status, **how it was resolved**, the evidence, and whether it is optional:

| Status | Meaning |
|---|---|
| `crossed` | The caller has crossed this layer. |
| `available` | Reachable now. |
| `blocked` | A required upstream layer is not crossed. |
| `not-applicable` | Absent for this arrival channel (§2.3 — layer 1 on a direct arrival is *absent, not replaced*). |

| Resolution | Meaning |
|---|---|
| `observed` | Read from real platform state. |
| `declared` | Asserted by the caller/channel; not observed. |
| `derived` | Inferred from another observed layer — and labelled as such. |
| `not-resolvable-today` | No platform state exists. **Never claimed crossed.** |

### Progressive surface activation, as a law

`SUBSTRATE_SURFACES` is a single table of `{ surface, revealedBy: layer }`. `activeSurfaces` is nothing but a filter over it — so adding a surface is one row, never a new branch of activation logic. The law the canary proves over the **entire observation cross-product** (not a sampled happy path):

> A surface is never revealed while the layer that reveals it is uncrossed.

Delegation is modelled `optional: true` — it never gates a downstream layer, and is never offered as the *single* next action. This matches both SPEC-COS-001 §2.3 ("often skipped or minimal for a direct human") and the already-ratified accession ladder (`AccessionProgressBar`, operator 2026-07-20: "Delegate is OPTIONAL and never gates").

---

## 3. What was COMPOSED, not rebuilt

This is the part that matters most, so it is stated concretely:

| Concern | Composed from | Evidence it was not duplicated |
|---|---|---|
| Caller identity | `getActivePersona` | Resolved **once** per request in the route, then passed down. Two reads can never disagree about who asked — the 2026-07-20 `AccessionProgressBar` failure class. |
| Passport / access / delegation | `resolveParticipationSelfView` (shared with `/api/participation/my-access`) | Canary asserts the resolver source contains **no** `polity_passport_records`, `access_grants`, or `delegation_grants` query. |
| The five journeys, their ladders, the Founder Office apex | `services/threshold/journeyRegistry.ts` (PRD-THR-001 §9.1) | No journey data restated. `ARCHETYPE_JOURNEY` is a projection; the canary re-resolves every value against the live registry, so an upstream rename fails the build. |
| Constitutional-root capability vocabulary | `services/threshold/serviceRegistry.ts` | No capability strings invented. |
| Passport deep links | `passportDeepLinks()` (CFS-043a, `guidedOnboarding.ts`) | Layers with no verified link return `null` — no URL is constructed or guessed (CLAUDE.md "No Guessing"). |
| Experience state + archetype | `getExperienceQube` — **T1 `meta` slice only** | The `blak` (T0) slice is never read. |
| Delegation authority | **nothing — deliberately** | The resolver imports neither `constitutionalAgreement` nor `delegationGrantStore`. Canary bans both the import and the invocation. |

### Principal–Delegate Separation is structural here

There is no code path through which an agent could advance a layer. The module is read-only; the route has `GET` and nothing else. Advancing Delegation is still `authorizeAgreement`, which refuses anyone but the owning human persona (CFS-043 §2). Two canary assertions enforce this: no import of the agreement/grant modules, and no invocation of `authorizeAgreement` / `acceptAgreement` / `formAgreement` / `persistDelegationGrant` / `claimAccessInvitation`.

---

## 4. Honest gaps — what is genuinely NOT resolvable today

| Layer | Status | Why |
|---|---|---|
| **Journey recommendation** | `not-resolvable-today` | `journey.select` exists as a constitutional-root capability, but **no store persists a selected journey for a persona.** The layer never reads as `crossed`; consequently the `specialist-journey` surface **never activates** (canary-asserted across every observation). A *recommendation* is derivable from the ExperienceQube archetype; a *selection* is not. Closing this needs a journey-selection store — separately chartered. |
| **Agent Me** | `derived` | aigentMe reachability is derived from Passport issuance (§2.2: aigentMe is the operating home of the Constitutional Persona the Passport establishes). Actual *engagement* with the four Capsules is persisted nowhere today. The evidence string says exactly this. |
| **Companion (Claude)** | `declared` | The arrival channel is what the caller declares; metaMe holds no state about an external agent. It changes only the topmost rung, so an untrusted `?channel=` value can never widen what is observed or activated. |

Genuinely observed today: **Gateway** (spine), **Passport**, **Delegation**, **Experience Qubes**.

---

## 5. The one refactor, and why it was required

`GET /api/participation/my-access` held the only correct **person-level** observation of passport + access + delegation — the DidQube observation levels ratified 2026-07-20 (passport observed across the kybe chain *and* the person's spine personas; delegation observed across all of the person's personas; neither flattened onto the active persona).

A second consumer needed exactly that observation. Copying it would have reintroduced the multi-resolution inconsistency that route was created to abolish. So the body was **moved** to `services/passport/participationSelfView.ts` and the route now calls it. The route's response shape is unchanged; the observation now has one authoritative location.

---

## 6. Verification

```
npx vitest run tests/onboarding-substrate.test.ts        # 22 passed
npx vitest run tests/threshold-gateway.test.ts \
               tests/source-of-truth-parity.test.ts \
               tests/access-spine.test.ts                # 59 passed
npx tsc --noEmit                                         # clean for all touched files
```

---

## 7. SQL / migrations

**None.** Phase 1 adds no table, column, constraint, or seed. There is nothing for the operator to run.

---

## 8. Consuming the route

```ts
import { personaFetch } from "@/utils/personaSpine";

const res = await personaFetch("/api/onboarding/substrate-state", {
  cache: "no-store",
  personaIdHint: personaId,   // pass it whenever the surface knows the active persona
});
const { substrate } = await res.json();
// substrate.layers[] · substrate.activeSurfaces[] · substrate.nextAction · substrate.notResolvable[]
```

Optional `?channel=threshold-companion` declares a third-party-agent arrival (PRD-THR-001). Anything else reads as a direct browser arrival.

**Never** call it with raw `fetch` or `authedFetchHeaders` — it is a spine endpoint (CLAUDE.md "Client-side spine fetches", canary-enforced).

---

## 9. Not in this pass

No UI or tab · no MCP gateway work (Threshold owns that) · no specialist-journey implementation · no journey-selection store · no migration. Each remains separately chartered, per the same discipline PRD-THR-001 §13 and CFS-043 §7 apply to their own build items.
