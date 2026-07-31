# SPEC-CDR-001 P4 + P5 — capability modules, and the first time the system chooses silence

**Date:** 2026-07-25 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Spec:** `codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md`

## P4 — capability modules (D-2/D-3/D-4/D-11)

A profile now **names** its applicable modules as a typed `CapabilityModuleId[]` (operator P4-1) and still asserts **no** `executionDomains`. Naming a module is a presentation assertion; if it ever became an execution claim, §0.3's hazard is back.

**Posture derives, never restates.** An executable module's posture comes from P1's `EXECUTION_DOMAINS`, so a module cannot claim to be authoritative while its execution domain is shadow-only — it holds no copy of that fact. Governance modules are `non-executable` **by class** (D-2/D-3), not an execution surface awaiting a flip.

**The D-11 firewall, both halves.** Visual: `Shadow` for shadow-only, `Context` for governance, nothing for authoritative (the unmarked case), each carrying the operator's tooltip — *"Visible for context; not authorized or executable from this surface."* Behavioural: only an authoritative module renders a route control, and it is **absent** rather than disabled, because a disabled button still implies the action exists.

The shipped capability rows became the `financial-intelligence` module rather than a second list beside it — one rendering model (P4-3). `SHAPE_CAPABILITY_IDS` is deleted; ids hang off modules, one mapping instead of two.

**Two calls made inside the decisions:** an executable module with zero matched capabilities stays omitted (otherwise an unpopulated registry turns a clean card into an empty header); `Context` is the governance chip.

## P5 — provisional discovery and abstention

### The resolution path

```
Ratified code seed  →  Promoted database profile  →  Abstention (L4)
```

Seeds resolve first and **stay in code** for P5 (operator P5-1): moving them would have bundled "introduce generated profiles" with "migrate the existing source of authority" into one change. Both sources normalise to the same `DomainProfile` contract, so composition never asks where a profile came from. `profileSource: 'ratified-seed' | 'promoted-discovery'` records origin as **operational metadata**, deliberately distinct from `assertionProvenance` — a code seed is not a provenance class, and is not automatically more trustworthy than a verified promoted one.

### The two numbers, kept apart

| | Question it answers | Where it lives |
|---|---|---|
| `confidence` | How strongly does the evidence support this? | IDE candidate → copied to the profile |
| `presentation_threshold` | How much support before we **interrupt the citizen**? | The runtime profile only, nullable |

Resolution is `profile.presentationThreshold` → `CDR_PRESENTATION_THRESHOLD`. A third layer (subject-type / domain policy) slots between them later with **no schema change** — it is a lookup, not a column.

### Fail safe — the part that matters most

Where neither a valid row override nor a valid environment value exists, the runtime **silently abstains**. It does not fall back to zero, and it does not show every candidate. Invalid values are rejected rather than coerced into range, because coercion silently changes policy.

This is mutation-tested, not asserted: making the unconfigured case default to `0` — the classic form of this bug, and one that would interrupt citizens on the strength of nothing — fails two canaries. `CDR_PRESENTATION_THRESHOLD` starts at **0.80**, deliberately high, to be calibrated *downward* from evidence.

### The hedged offer

> **"Financial context may be relevant here."**  ·  *View context* / *Dismiss*

**May**, not *is*. No card is composed and no context is stated — the citizen decides whether to look, and is never asked to classify the page themselves. Expanding shows that the context is provisional, its discovery confidence, the applied threshold, and that verification is still required. Viewing does not promote or assert anything.

Dismissal is intentionally **not persisted**: a provisional profile that later gets verified should be able to surface properly, and a permanent client-side suppression would outlive the state that justified it.

### Instrumentation

Every decision writes an event carrying the threshold **actually applied** — without it, a later change to the row value or the env default makes all history uninterpretable. `silent_abstention` is recorded as deliberately as `offered`: an abstention nobody counted is an abstention nobody can calibrate (§6.3 — the rate is a metric to publish, not a defect to minimise).

**The event log carries no citizen identifier.** It measures how often the system stayed silent, not at whom. The column doesn't exist rather than being left nullable.

## Verification

- **69 passing** across `cdr-presentation-policy`, `source-of-truth-parity`, `companion-observer`. `tsc --noEmit` clean of new errors.
- Mutation-tested twice: letting a shadow module present an action fails the P4 firewall canary; defaulting an unconfigured threshold to zero fails the P5 fail-safe canaries.
- Every storage path soft-fails, so **the runtime degrades to exact P3 behaviour until the migration is applied** — no broken surface in between.

## Operator actions

**1 — Run the migration** (already reviewed, `supabase/migrations/20260822000000_cdr_domain_profiles.sql`). It must be applied before storage is read; until then the code path is inert by design.

**2 — Set the env var** in Amplify (it is now in `.env.example` and the `create-env-production.js` allowlist):

```
CDR_PRESENTATION_THRESHOLD=0.80
```

Unset or invalid means silent abstention, so a missed deploy under-serves rather than over-asserts.

## What P5 deliberately did not do

No automated evidence acquisition — the Overlay does not scrape, classify, or submit page evidence (operator P5-1). Evidence is operator/steward-supplied through the IDE's existing admin-gated workflow. Automated acquisition is separately chartered: consent, provenance, page boundaries, dynamic and adversarial content, collection authority, and evidence freshness are all live questions there.

No verification-events ledger. **P5 provides current-state verification traceability, not an append-only history** — `updated_at` is sufficient for P5's bounded lifecycle and is **lossy**, not a substitute. P5b adds a ledger when any of these become requirements: multiple review attempts, rejection reasons, reopening, status reversals, competing reviewers, evidence added between reviews, audit-grade chronology, or reviewer standing attribution.

## Where CDR stands

P1–P5 shipped. P6 (agent classification) is unblocked by D-12 and wants **D-13**, which reverted to a live operator call when its deferral condition discharged. P7 (Context Resolution) and P8 (Human Mobility) not started. **D-8 remains the only open decision, and it is soft.**

## Review

- `services/resolution/{capabilityModules,presentationPolicy,domainProfileStore,domainResolver}.ts`
- In-app: `https://dev-beta.aigentz.me/triad/embed/codex/agentiq-codex?tab=updates`
