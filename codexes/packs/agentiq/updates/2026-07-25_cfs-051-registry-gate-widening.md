# CFS-051 — Experiment Pipeline gate widened to CAS grant + token (operator answered "both")

**Date:** 2026-07-25
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Charter:** `codexes/packs/irl/foundation/CFS-051_experiment-constitutional-registry.md` §5a
**Satisfies:** seed backlog row `backlog-widen-registry-access-gate` (migration `20260820000100`)

---

## What changed

`services/research/registryAccess.ts` previously exposed one function:

```ts
export function canManageRegistry(persona): boolean {
  return Boolean(persona?.cartridgeFlags?.isAdmin);
}
```

Its own header named the intended widening. The operator, asked whether to widen to a CAS research-lab grant, a token gate, or both, answered **both**. That is now built.

## Three paths, OR'd, each independently sufficient

| Path | Signal | What it COMPOSES (nothing new was built) |
|---|---|---|
| `platform-admin` | `persona.cartridgeFlags.isAdmin` | — unchanged, never weakened |
| `cas-research-lab-grant` | an active `research-lab` grant in the Constitutional Access Service | `getGrantedExperiments` (`services/passport/participationAccess.ts`) — the same grant mechanism CFS-044's Open Lab reviewer engagement issues against |
| `token-holding` | caller holds the operator-configured gate token on-chain | `resolveExternalCredential` (`services/access/policyResolvers.ts`) — the access spine's shipped `token:<chain>:<contract>[:<tokenId>]` resolver, backed by `resolvePersonaWalletAddress` + `ownsErc721`/`ownsErc1155` |

**A real token-gating primitive already existed** and was fully implemented (real `eth_call` against real RPCs) — what was missing was a caller, not the mechanism. Nothing about it was re-implemented; `policyResolvers.ts` is spine-protected and was imported, never modified. No second grant system, no new table, **no DB migration**.

## The gate is now TWO capabilities, not one

The operator's framing was specific — widen so public users can **propose**.

| Capability | Actions | Who |
|---|---|---|
| `read` | `GET` | any of the three paths |
| `propose` | `POST create` | any of the three paths |
| `curate` | `POST edit` / `transition-status` / `add-review` | **platform admin ONLY — byte-identical to pre-widening** |

A status transition is the step toward the formal registry/canon ceremony CFS-051 §2 protects; that judgement stays with the admin. Granting full CRUD to every grant-holder would have over-read the instruction.

Role-scoped curation (a grant whose role is `reviewer` / `ratifier` appending review notes) is deliberately **not** built: `getGrantedExperiments` returns experiment scoping, not role, and adding a second grant query would be the parallel-implementation defect `inv.engineering.037` names. Named as a follow-on rather than guessed at.

## Pure core + thin I/O shell

`decideRegistryAccess(signals) → decision` is PURE and synchronous — three booleans in, a capability decision out — mirroring SPEC-COS-001's `substrateState.ts::activeSurfaces`. All I/O lives in `resolveRegistryAccess`. Both widened lookups **fail closed** and never throw: a Supabase outage or RPC failure denies the widened path, never the admin path, and never 500s the route. An admin short-circuits both network lookups.

## Bug found and fixed while widening

`POST create` accepted a client-supplied `status`. Harmless while every caller was an admin — but the moment `propose` widened, a propose-only caller could have created a row already at `published` / `promoted` / `ratified` / `canonized`, precisely the transitions `curate` exists to withhold. The route now drops a non-curator's `status`, so the store applies its own default and every advance must go through the curate-gated `transition-status`.

## The surface stays admin-only

`irl-experiment-registry` remains `adminOnly: true` in `data/codex-configs.ts`, untouched. Widening the API was additive and operator-directed; exposing a public proposal *surface* is a separate step needing its own authorization (CLAUDE.md "Security — Access Gates"). `GET` now returns a `capabilities` object so a future public surface can render exactly the affordances its caller holds.

## Operator action — optional, and only if the token path should be live

The token path is **inert until configured**, which is a valid steady state (the CAS grant path works without it). To activate it, set this in the Amplify console for the `dev` branch, then rebuild:

```
RESEARCH_REGISTRY_TOKEN_CREDENTIAL = token:base:0xYOUR_CONTRACT_ADDRESS
```

ERC-1155 form appends a token id: `token:base:0xYOUR_CONTRACT_ADDRESS:7`. Supported chains: `ethereum | base | optimism | polygon | arbitrum`. The variable is allowlisted in `scripts/create-env-production.js` so it reaches the SSR runtime. **No contract address is hardcoded anywhere** — a canary asserts no 40-hex EVM literal appears in the gate module. A malformed value is logged and treated as unset (fails closed).

**No SQL to run.** This change required no migration.

## Files

| File | Change |
|---|---|
| `services/research/registryAccess.ts` | rewritten — pure core + I/O shell, three paths, propose/curate split |
| `app/api/research/registry/route.ts` | one caller resolution, action→capability map, create-status guard, `capabilities` in GET |
| `tests/research-registry-access.test.ts` | NEW — 22-assertion canary |
| `scripts/create-env-production.js` | allowlist `RESEARCH_REGISTRY_TOKEN_CREDENTIAL` |
| `codexes/packs/irl/foundation/CFS-051_experiment-constitutional-registry.md` | §5a records the widening |
| `app/triad/components/codex/tabs/ExperimentRegistryTab.tsx` | stale "admin-only, widening not built" copy corrected |
| `data/codex-configs.ts` | comment corrected; `adminOnly: true` untouched |

`services/research/registryStore.ts` was **not** touched — and the canary structurally asserts it never learns about the gate.

## Canary

`tests/research-registry-access.test.ts` — 22 passing. Pins the full 2^3 decision truth table (admin keeps everything; no-signal passes nothing; each widened path independently grants propose and NEVER curate), token-credential validation failing closed, the action→capability map, the create-status guard, composition-not-duplication of the grant and token mechanisms, and — structurally — that `registryStore.ts` contains no gate logic, no admin flag, no grant query, and no raw `persona_id`.

```bash
npx vitest --config vitest.config.mjs run tests/research-registry-access.test.ts
```
