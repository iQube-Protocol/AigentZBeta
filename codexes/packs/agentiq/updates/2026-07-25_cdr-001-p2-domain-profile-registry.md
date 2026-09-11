# SPEC-CDR-001 P2 — the hostname Set becomes a governed profile registry

**Date:** 2026-07-25 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Spec:** `codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md` · **Gate:** D-14, D-15 (both RATIFIED)

## What changed, in one line

The operator's framing, which is the whole point of the phase:

> The old set said only: *"Render this card for these hosts."*
> The new registry says: *"A named authority has asserted and verified that this host should resolve to this presentation context."*

Same five hostnames. **Not inherited** — re-entered as ratified D-15 seeds, each carrying provenance, verification status, asserting authority, evidence, and rationale.

## The seed registry

`services/resolution/domainProfileRegistry.ts` — **three profiles behind five hostnames**, all `verified`, all `financial-context`.

| Hostname | Provenance | Note |
|---|---|---|
| `metame.com` | `first-party` | canonical production property |
| `www.metame.com` | `first-party` | **alias** → same profile object |
| `dev-beta.aigentz.me` | `first-party` | platform runtime where Passport/Standing/delegation/wallet context applies |
| `coinbase.com` | `curated` | explicit external digital-asset context |
| `www.coinbase.com` | `curated` | **alias** → same profile object |

**Aliases resolve to the identical object**, not a copied body — `resolveDomainProfile('www.metame.com') === resolveDomainProfile('metame.com')`. A canary asserts object identity, so a copy-paste twin fails the build even if every field currently matches. Duplicate hostname keys throw at module load rather than silently shadowing.

**No Horizen hostname.** The operator's reasoning is recorded in the file header so a later agent doesn't add one on affiliation grounds: the registry classifies a subject by the context relevant *on that subject*. A Horizen property enters only with an actual pilot/agent-discovery surface, a first-party attestation or capability manifest, or a specifically curated route — which likely means the pilot begins with **agent** profiles, not hostname profiles.

## Three judgement calls worth reviewing

1. **`verifiedBy` — schema deviation, deliberately.** §5.3 specifies a T2 `personaPublicRef`. No such ref was issued for the act of ratifying D-15, and minting or guessing one would break the no-guessing rule outright. So the authority type is a union, with an explicit `operator-ratification` variant naming the decision (`SPEC-CDR-001:D-15`). Both variants are **T0-safe by construction** — neither can carry a `personaId`, `authProfileId`, or `rootDid`. A canary asserts no UUID appears in a serialised `verifiedBy`.

2. **No `executionDomains` on any seed.** A hostname profile asserts a *presentation context*. Asserting an execution domain for a hostname would let a presentation surface imply that money may move there — the D-11 firewall. A canary fails if any profile grows the field. `FinancialDomain` is exactly as P1 left it.

3. **D-6 enforced by the type system.** `DomainProfile` is a discriminated union: `confidence` is `never` for `first-party`/`curated` and **mandatory** for `discovered`. A confidence score on an asserted profile — implying an inference that never ran — is now a compile error rather than something review has to catch.

One addition beyond §5.3: a `rationale` string per profile. The stated purpose of P2 is that the reason a host resolves is "explicit, inspectable and governed", and a machine-readable schema with no human-readable justification only delivers two of the three.

## The rename (D-14)

`banking` → `financial-context` across `overlayMapping.ts`, `overlayComposition.ts` (`BankingOverlayCard` → `FinancialContextOverlayCard`, `composeBankingCard` → `composeFinancialContextCard`), `CompanionOverlayPanel.tsx` (`BankingCard` → `FinancialContextCard`, the wire-value branch), the capability table key, and the existing canary. `OverlayShape` now folds in `OverlayContext` from the registry rather than restating the literal, so the registry stays the single source of truth for the context name.

`BANKING_DOMAINS` is deleted. `shapeForDomain` calls `overlayContextForDomain`.

**No extension change was needed** — the extension never referenced the shape; it hosts the Companion page in an iframe.

## Migration-equivalent, as instructed

No inferred classification. No provisional profiles. No change to `FinancialDomain`, execution posture, or financial execution behaviour. No new rendering behaviour. The same five hosts produce the same card; only the reason is now governed.

## Canaries — and proof they bite

Eleven checks in `tests/source-of-truth-parity.test.ts`: exact membership vs an independently-restated ratified list · migration equivalence (every legacy host still resolves) · **alias object identity** · provenance per host · all-verified · no-discovered / no-provisional / no-confidence · authority + evidence + rationale present · **no T0 identifier in `verifiedBy`** · abstention for unmapped hosts (including `metame.com.evil.test`) plus case/whitespace normalisation · **legacy `banking` literal absent from live code** in all three companion surfaces (block comments stripped, so the historical record survives) · `shapeForDomain` derives rather than hardcodes · capability table exhaustive over the renamed shape.

Mutation-tested, not merely observed passing. Removing the `www.coinbase.com` alias and reviving a `'banking'` literal in live code produced **5 targeted failures**; reverting restored 18/18.

## Verification

- `tests/source-of-truth-parity.test.ts` + `tests/companion-observer.test.ts` — **50 passed**.
- `tsc --noEmit` — no new errors (the two reported are the pre-existing config errors: missing `iqube` type defs, invalid `--ignoreDeprecations`).

## Where CDR stands now

| Phase | Status |
|---|---|
| P1 execution taxonomy | **Shipped** |
| P2 profile registry + rename | **Shipped** |
| P3 resolver (L1/L2/L4) | Not started — unblocked by decision |
| P4 capability modules | Not started — unblocked by decision |
| P5 / P6 | **Blocked on D-12** — which engine owns profile generation |
| P7 Context Resolution | Not started |
| P8 Human Mobility | Blocked on D-21 precondition + HMS steward sign-off |

**D-12 is now the only decision blocking a phase.** D-8 remains soft (interim ruling: treat `ire://` as documentary, so nothing depends on its resolvability).

## Review

- Registry: `services/resolution/domainProfileRegistry.ts`
- Spec §10.3 (ratified seed table): `codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md`
- In-app: `https://dev-beta.aigentz.me/triad/embed/codex/agentiq-codex?tab=updates`

No SQL — the registry is code, not schema.
