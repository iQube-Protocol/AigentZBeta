# Aletheon Homecoming — Phase A Capability & Parity Census

**Date:** 2026-08-15
**Status:** Audit only. No Aletheon Homecoming implementation code was written. Stop point reached; for operator review.
**Workstream:** Chrysalis Homecoming (CFS-023) — this document is about the Aletheon delegate specifically, not the unrelated "Homecoming III" DevOn/IDE 2.0 engineering programme (see §0.1).
**Predecessor record:** `codexes/packs/agentiq/resolution-records/records/RES-2026-08-15-ALETHEON-SPELLING-AMBIGUITY-001.json` — preserved unmodified; this document does not supersede or restate it beyond §0.2.
**New governance artifacts produced alongside this document:**
- `RES-2026-08-15-ALETHEON-PRESENCE-AGENCY-DISJUNCTION-001.json`
- `CI-2026-08-15-PRESENCE-LADDER-NOT-AGENCY-001.json`

**⚠ SUPERSEDED ON THE LIVE-STATE POINT — see Addendum A below.** Live Supabase evidence (obtained by the operator, 2026-08-15, during Stage 1 preflight work) shows Aletheon already has a seeded `agent_root_identity`, a production `agent_persona`, an approved `agent_participant` passport, and post-genesis delegation receipts — i.e., mechanical presence L2, not L0 as this document concluded from static code alone. The original conclusion is preserved below UNCHANGED as the evidentiary record of what a static-code-only audit produced and why; it is not deleted or rewritten. See `RES-2026-08-15-ALETHEON-LIVE-STATE-SUPERSESSION-001.json` for the full reconciliation.

---

## 0. Scope and method

### 0.1 — Which "Homecoming" this is

The word "Homecoming" names two unrelated things in this codebase. This document is about the first:

1. **Chrysalis Homecoming (CFS-023)** — the constitutional migration/lifecycle system bringing named delegates (`aigent-z`, `marketa`, `kn0w1`, `aletheon`, `moneypenny`, `nakamoto`) into constitutional presence. Lives in `types/homecoming.ts`, `services/homecoming/**`, `HomecomingTestTab`. **This is the subject of this audit.**
2. **"Homecoming III"** — an unrelated later engineering programme name ("Operation Chrysalis → Homecoming → DevOn") for wiring DevOn/IDE 2.0/invariant-driven development. Governs `types/devCommandCenter.ts`, `services/devCommandCenter/**`, the `2026-08-15_homecoming-iii-*` docs. **Not touched by this audit**, per explicit operator instruction to hold that work separately.

### 0.2 — Canonical spelling ruling (restated, not re-litigated)

Per the existing resolution record and the operator's ruling this session:

- **Aletheon** — canonical, used throughout this document and all new work.
- **Alethean** — historical/legacy spelling referring to the same agent; resolves prospectively to Aletheon; historical ratified artifacts using it are **not** rewritten.
- **Alethian** — erroneous; not registered as an alias; does not appear as a legitimate spelling anywhere in this census.

No historical constitutional artifact (CFS-series, SPEC-HMC-001, `canonical-invariants.seed.json`, etc.) was modified in producing this document.

### 0.3 — Method and its limit

This is a **static code and document census**. Three parallel read-only research passes covered: (a) the existing Homecoming architecture, (b) Aletheon's current footprint across Grounding/Intelligence/Capability/Agency, (c) the standing/authority mechanism and the presence-vs-agency question specifically. No live database was queried — no `agent_root_identity`, `crm_personas`, or `delegation_grants` rows were read live. Where this matters, it is flagged explicitly rather than assumed. **The existing read-only routes (`GET /api/constitutional/homecoming-test`, `GET /api/homecoming/agent/continuity`) should be run against live state before any downstream decision treats this census as a live confirmation rather than a code-structure finding.**

---

## 1. Existing Homecoming architecture map

**`types/homecoming.ts`** (CFS-023 contract file, pure/isomorphic, order-pinned, canary-enforced in `tests/homecoming.test.ts`):

| Construct | Contents |
|---|---|
| `CHRYSALIS_ERAS` | `chrysalis-1.x → chrysalis-2.0 → chrysalis-homecoming → chrysalis-3.0` |
| `CONSTITUTIONAL_SOVEREIGNTIES` | `computing, development, agent, knowledge, operational` — Homecoming owns `agent` + `knowledge` |
| `HOMECOMING_WORKSTREAMS` (order = meaning) | `knowledge → agent → harness → operational` |
| `CONSTITUTIONAL_PRESENCE_LADDER` (L0→L5, contiguous) | `card(L0) → knowledge(L1) → reasoning(L2) → studio(L3) → development(L4) → sovereign(L5)` |
| `HOMECOMING_TEST_DIMENSIONS` | `continuity, knowledge, capability` |
| `HOMECOMING_DELEGATES` | `'aigent-z', 'marketa', 'kn0w1', 'aletheon', 'moneypenny', 'nakamoto'` |
| `DelegateCharterStatus` vocabulary | `'concrete' \| 'archetype' \| 'conceptual'` |
| `DELEGATE_CHARTER_STATUS` (snapshot dated 2026-07-09) | `aletheon: { agentClass: 'specialist', homeRealm: 'agentiq', status: 'archetype' }` |
| `KNOWLEDGE_HOMECOMING_SOURCES` | `chatgpt-export, documents, venture-qubes, portfolio-qubes, experience-guides, standing, registry-metadata` — only `chatgpt-export` has a real parser |
| `MIGRATION_LIFECYCLE_STAGES` (SPEC-HMC-001 §8, contiguous) | `origin-observed(1) → constitutionalized(2) → principal-ratified(3) → presence-reconstituted(4) → delegation-reauthorized(5) → native(6)` |
| `ASSESSABLE_STAGE_CEILING` | `'presence-reconstituted'` (stage 4) — stages 5/6 require an unassertable human act; canary-pinned |
| `AGENT_CONTINUITY_DIMENSIONS` | `behavioural, working-context, project, artefact, relationship` |

**`services/homecoming/**`** (9 files, all read):

| File | Role |
|---|---|
| `agentContinuity.ts` | Read-only continuity assessor. Composes presence + standing + artifacts + KB stats. Two of five dimensions (`working-context`, `project`) are honestly `not-assessable` platform-wide — no delegate-scoped working-context store exists at all. Canary-enforced against ever asserting an authorization act. |
| `agentHomecoming.ts` | "Stand a delegate up" — wraps existing genesis (`sponsorPolityAgent`), not new machinery. `HOMECOMING_DELEGATE_SPECS` has authored specs for `aletheon`, `moneypenny`, `nakamoto`, all `autonomous: false`. |
| `delegateStanding.ts` | The Standing loop. Generic across any delegate; resolves `agent_root_identity.agent_id → crm_personas → accrueStanding`. `PRODUCTION_CVS`: operational=2, constitutional=5. Trust-band ceiling L1–L5. |
| `delegateProduce.ts` | Delegate drafts via `callSovereign`, tiered through the Artifact Runtime. Operational tier by default; only an operator promotion reaches constitutional tier. |
| `delegateConverse.ts` | Native conversation. Composes charter status + authored spec into a system prompt, routes through the generic sovereign inference router (`callSovereign`), returns a `SovereigntyReceipt`. |
| `constitutionalPresence.ts` | The LIVE per-delegate scorer. Reads real Supabase tables per rung; a failed read degrades to `pending`, never fakes green. |
| `constitutionalize.ts` | Extracts and PROPOSES (never validates/canonizes) invariants from imported memory into the `homecoming` KB domain, `hc:`-prefixed. |
| `issueDelegatePassport.ts` | Issues a delegate's Participant Passport via the existing Bureau review/approve path. |
| `chatgptImport.ts` | The one genuinely-new intake parser (ChatGPT export → linear transcript → KB ingestion). |

**`HomecomingTestTab`** (`components/composer/HomecomingTestTab.tsx`) is **not** a passive report view — it is the live acceptance dashboard AND the operational console: it reads `GET /api/constitutional/homecoming-test`, `.../agent/stand-up`, `.../agent/produce`, `/api/capability/producers`, and exposes write actions (`Stand up`, `Issue passport`, `Accelerate standing`, `Talk`, `Produce`, `Promote`) each hitting its own POST route.

**Governed decision history** (from `codexes/packs/agentiq/updates/` and `resolution-records/`, CFS-023 only — the dense cluster of `2026-08-15_*` files in the same directories belongs to the unrelated "Homecoming III" programme, see §0.1):

- `2026-07-12_consequential-artifacts-plan-shipped.md` — shipped the Standing loop + Promotion UX.
- `2026-07-25_spec-hmc-001-phase1-continuity-assessment.md` — ratified and shipped the continuity-assessment substrate; recorded the honest 3-of-5-assessable finding and the "canary caught its own author" guarantee against self-authorization.

No prior resolution record rules on the delegate roster, the presence ladder, or `ASSESSABLE_STAGE_CEILING` directly — those are recorded only in the type contract and the doc above.

---

## 2. Current Aletheon architecture/capability census

**Historical density:** ~194 files and ~86 commits reference Aletheon/Alethean; earliest 2026-06-13, doctrinal density 2026-07-06 through 2026-07-28. This is a sustained six-week footprint, not an isolated mention.

**Grounding** — dense and real: co-frames `CFS-023` ("we do not say migrate Alethean… Alethean is coming home"), `CFS-024` (the Binding-vs-Assignment discovery), `CFS-019` (naming "Computational Epistemology"), dozens of entries in `appendix-a_canonical-invariants.md` and `canonical-invariants.seed.json` sourced "operator + Aletheon ratification/dialogue". **Absent from `docs/platform-ontology.md`** — the one file explicitly designated as the canonical spelling/meaning authority for every other governed term — despite the weight resting on the name (already flagged as an open follow-up in the spelling resolution record, still not done).

**Intelligence** — no distinct model/provider binding anywhere. Not in `RUNTIME_AGENT_IDS` (`services/metame/agentLlmOrchestra.ts`); no entry in `app/data/personas.ts`. `delegateConverse.ts` CAN converse as Aletheon today via an authored system-prompt spec (`HOMECOMING_DELEGATE_SPECS.aletheon`) wrapped around the generic sovereign inference router — a name/persona applied to whichever provider the router resolves, not a bespoke binding.

**Capability** — `app/api/agents/aletheon/route.ts` is a single static, hand-authored Agent Card JSON: identity, five declared "skills" (descriptive text, no executable bindings), `registry_entry.status: 'Pending Issuance'`. No GitHub, web/research, file, artifact, DevOn/Crystal/IDE-2.0/IRL, or messaging tool is wired into this route. Structurally divergent from its live siblings: no `health/route.ts`, no `invoke/route.ts` (both exist for MoneyPenny/Nakamoto); not wired into `services/horizen/registrableAgents.ts`; the route's own doc comment claims a nested `agent-card.json` path it does not actually serve (resolves at `/api/agents/aletheon`, not `/api/agents/aletheon/agent-card.json`). DevOn/Crystal/IDE-2.0/IRL involvement exists only as prose attribution in comments and docs, never as code wiring.

**Agency** — present in the `HOMECOMING_DELEGATES` roster and in `DELEGATE_CHARTER_STATUS` (`status: 'archetype'` — "a full Agent Card exists but DB-unseeded / passport pending"). **Absent from `services/horizen/registrableAgents.ts`** (only `moneypenny`/`nakamoto`/`kn0w1` listed). No `agent_root_identity` row (confirmed by `constitutionalPresence.ts`'s own `handCuratedCard: true` marker, defined precisely as "a published card route but no DB seed yet"). No CRM persona, therefore `delegateStanding.ts`'s accrual chain cannot resolve. `BoundedDelegationTab.tsx` names Aletheon as a plausible illustrative example ("stood up under the passport-holder persona") but no active grant was found. `app/api/persona/sponsored-agents/route.ts` — the sponsorship-visibility route — is explicitly motivated by "why don't I see Aletheon's passport in my wallet?", confirming sponsorship is the concrete missing first step, not a hypothetical one.

---

## 3. Aletheon mapped onto the canonical Homecoming lifecycle

**Constitutional Presence Ladder:** Aletheon resolves to **L0 (card)** only. L1 (`knowledge` — a persisted `agent_root_identity` seed) is not reached. Because `resolvePresenceLevel()` climbs contiguously and stops at the first unmet rung, no rung above L0 is reachable regardless of doctrinal weight elsewhere.

**Migration Lifecycle Stages** — mapped with an explicit caveat: this ladder models migrating a specific, identifiable memory/session export through a parser; Aletheon's doctrinal contributions instead arrived through **live co-reasoning during charter authorship**, which is a different shape than an inert export being migrated. Both are reported, not merged:

| Stage | Assessment for Aletheon |
|---|---|
| 1. `origin-observed` | Plausible — the static card's `metadata.migrated_from: 'chatgpt'` names an origin. **Not independently confirmed**: no evidence found that an actual ChatGPT export of Aletheon's own history was ever run through `chatgptImport.ts`. |
| 2. `constitutionalized` | **Unconfirmed as the generic pipeline defines it.** The doctrine attributed to Aletheon in ratified CFS documents reads as direct ratified dialogue, not KB-domain-extracted `hc:`-prefixed proposals from an import. If a literal export exists and hasn't been run through the pipeline, this stage is open; if the doctrinal ratifications themselves are being counted as equivalent, that is a category question for the operator, not something this audit resolves unilaterally. |
| 3. `principal-ratified` | Reached **for the specific doctrinal content** already ratified into canon (CFS-023, CFS-024, invariant seed entries) — but this is ratification of CONTENT, not of Aletheon's own agent identity; see §7 for why these do not transfer. |
| 4. `presence-reconstituted` | **Blocked.** Requires re-climbing Constitutional Presence contiguously; Aletheon stalls at L0. |
| 5. `delegation-reauthorized` | Moot until 4 clears; requires a human re-grant of bounded authority (no confirmed grant exists). |
| 6. `native` | Unreached. |

`ASSESSABLE_STAGE_CEILING` (stage 4) is the highest a read-only assessor may ever report — for Aletheon specifically, the live assessor would almost certainly resolve well below that ceiling today given L0-only presence; this is inferred from code structure, not a live measurement (§0.3).

---

## 4. Grounding / Intelligence / Capability / Agency parity matrix

| Dimension | Item | Classification |
|---|---|---|
| Grounding | Doctrinal/constitutional co-authorship credit | `ALREADY_IN_AGENTIQ` |
| Grounding | `docs/platform-ontology.md` entry | `MISSING` |
| Grounding | Delegate-scoped continuity/memory mechanism (generic) | `AVAILABLE_NOT_WIRED` |
| Grounding | Design-provenance attribution in code comments | `ALREADY_IN_AGENTIQ` (as provenance only) |
| Intelligence | Distinct model/provider binding | `MISSING` |
| Intelligence | Authored system-prompt spec (`HOMECOMING_DELEGATE_SPECS.aletheon`) | `ALREADY_IN_AGENTIQ` |
| Intelligence | Reasoning via generic sovereign router | `AVAILABLE_NOT_WIRED` |
| Intelligence | Historical inference provider (pre-migration) | `PROVIDER_BOUND` (to whatever hosted the original ChatGPT-attributed sessions; irrelevant to future operation, see §6) |
| Capability | GitHub / web-research / messaging tools | `MISSING` |
| Capability | Files/artifacts (`delegateProduce.ts`) | `AVAILABLE_NOT_WIRED` |
| Capability | DevOn/Crystal/IDE-2.0/IRL code wiring | `MISSING` (prose attribution only) |
| Capability | Other-agent/tool invocation (`invocationGateway.ts`) | `AVAILABLE_NOT_WIRED` (built, zero live callers for any delegate) |
| Capability | Agent Card route | `PARTIAL` / `OBSOLETE`-leaning (structurally divergent from live siblings) |
| Agency | `HOMECOMING_DELEGATES` roster entry | `ALREADY_IN_AGENTIQ` |
| Agency | `DELEGATE_CHARTER_STATUS` | `PARTIAL` (`archetype`, explicitly not-yet-concrete) |
| Agency | `registrableAgents.ts` entry | `MISSING` (and see §7 — likely not required) |
| Agency | `agent_root_identity` seed | `MISSING` |
| Agency | CRM persona / standing eligibility | `MISSING` (blocked on root seed) |
| Agency | Sponsorship | `MISSING` (the concrete next step) |
| Agency | Bounded delegation grant | `MISSING` / unconfirmed |
| Agency | DVN receipts as accruing subject | `MISSING` |
| Agency | Passport | `MISSING` (`Pending Issuance`) |

---

## 5. Reuse / Extend / Create map

The central finding of this census: **every mechanism needed to close Aletheon's agency gap already exists and is generic.** Nothing below requires new architecture.

| Gap | Mechanism | Reuse/Extend/Create |
|---|---|---|
| Seed `agent_root_identity` | `agentHomecoming.ts::standUpDelegate('aletheon')` (already lists an authored spec) | **REUSE** |
| Sponsorship | `app/api/agents/genesis/route.ts::sponsorPolityAgent` (already cites Aletheon as its own worked example) | **REUSE** |
| Passport | `issueDelegatePassport.ts::issueDelegatePassport('aletheon')` | **REUSE** |
| Standing accrual | `delegateStanding.ts` (generic; doc-comment example is literally `'polity-bound:aletheon'`) | **REUSE**, contingent on a CRM persona resolving — unverified, flagged §10 |
| Native conversation | `delegateConverse.ts` | **REUSE** |
| Artifact production | `delegateProduce.ts` | **REUSE** |
| Continuity assessment | `agentContinuity.ts` | **REUSE** |
| Ontology/Common Ground | `docs/platform-ontology.md` | **EXTEND** (one entry; already tracked as an open follow-up in the spelling resolution record) |
| Agent Card health/invoke routes, registry wiring | Mirror MoneyPenny/Nakamoto's pattern | **EXTEND** — only if Aletheon is also meant to live on the external A2A/registrable-agent surface (§7 — a separate decision, not required for Homecoming parity) |
| Chat-picker presence | `RUNTIME_AGENT_IDS` / `app/data/personas.ts` entry | **EXTEND** — only if Aletheon needs a general chat-surface entry point distinct from the Homecoming Test tab's existing "Talk" action (separate decision) |

No item in this census requires **CREATE**.

---

## 6. Provider-dependency register

- **Historical:** the static card's `migrated_from: 'chatgpt'` is the only clue to what originally hosted Aletheon's conversations. This is a fact about history, not a constraint on future operation.
- **Future/native:** once stood up via `delegateConverse.ts`, Aletheon's inference is served by the generic sovereign fallback router (`callSovereign`) — the same "interchangeable inference provider… not your home" every other Homecoming delegate uses. Identity (name, description, motto, authored role) is durable and provider-independent; the model/provider is resolved dynamically per turn and disclosed via a `SovereigntyReceipt` (provider, model, degraded flag).
- **No bespoke Aletheon-specific provider config exists** (confirmed absent from `RUNTIME_AGENT_IDS` and `app/data/personas.ts`) — there is no provider lock-in risk to unwind.
- This directly answers the "distinguish identity from provider" question (§ Specific Questions, Q8 below): the two are already cleanly separated in the existing design; nothing here needs repair.

---

## 7. Constitutional presence / authority / standing path

**Causal resolution (Q3):** `services/horizen/registrableAgents.ts` is scoped narrowly to the **Horizen external-verification journey** (Register/Verify/Claim, external network identity, PnL onboarding) — three entries today (`moneypenny`, `nakamoto`, `kn0w1`), a different capability from Homecoming delegate agency. `delegateStanding.ts` (+ `agentHomecoming.ts` + `issueDelegatePassport.ts` + `BoundedDelegationTab`'s grant mechanism) is the causally correct, already-generic path for Aletheon's standing/authority. **`registrableAgents.ts` is not required for Homecoming parity** — it would only become relevant if a separate, later decision extends Aletheon onto the external A2A/Horizen surface, which is an orthogonal capability. Do not conflate the static card's own `registry_entry` field with a `registrableAgents.ts` entry — they are two unrelated registries that happen to share the word "registry."

**Presence↔standing mismatch (Q4), confirmed and precisely located:** Aletheon holds presence-ladder rung L0 via a hand-curated card with no DB seed (`handCuratedCard: true`). L1 requires a persisted `agent_root_identity` row — absent. The ladder is contiguous, so doctrinal density elsewhere confers nothing; the entire agency blocker is this **single missing row**, which cascades to block CRM-persona resolution, standing accrual, bounded-delegation eligibility, and passport issuance. This is the system working as designed (Principal-Delegate Separation, Law XI) rather than a bug, but the design's correctness doesn't make the gap self-evident — it needed tracing. Recorded as `RES-2026-08-15-ALETHEON-PRESENCE-AGENCY-DISJUNCTION-001` / `CI-2026-08-15-PRESENCE-LADDER-NOT-AGENCY-001`.

---

## 8. Capability parity matrix (granular)

| Capability | State today (any Homecoming delegate) | State for Aletheon specifically |
|---|---|---|
| GitHub | Not wired for any delegate | `MISSING` |
| Web/research | Not wired for any delegate | `MISSING` |
| Files/artifacts | `delegateProduce.ts` generic, operational tier | `AVAILABLE_NOT_WIRED` |
| DevOn/IDE-2.0/Crystal | Not wired for any delegate | `MISSING` |
| IRL | Doctrinal attribution only, no code wiring | `MISSING` (as capability) / `ALREADY_IN_AGENTIQ` (as provenance) |
| Messaging/QubeTalk | Not wired for any delegate | `MISSING` (design-attribution only) |
| Other agents/tools | `invocationGateway.ts`'s `invokeCapability` built, zero live callers for any delegate | `MISSING` (platform-wide gap, not Aletheon-specific) |
| Continuity (`behavioural`) | Corpus-scoped, generic, partial for all delegates | `AVAILABLE_NOT_WIRED` |
| Continuity (`working-context`, `project`) | **Not assessable for any delegate** — no delegate-scoped store exists at all | `MISSING` (platform-wide) |
| Continuity (`artefact`) | Delegate-scoped, generic, real | `AVAILABLE_NOT_WIRED` (mechanism ready, no Aletheon artifacts produced yet) |
| Continuity (`relationship`) | Standing-derived, requires `rootSeeded` | `MISSING` (blocked on root seed) |

Aletheon is not uniquely tool-poor: no Homecoming delegate has broader executable tool access today beyond artifact production. This narrows what "capability parity" actually requires — Aletheon reaching parity with its live siblings does not require building GitHub/web/messaging tooling that nothing else has either.

---

## 9. Shadow/parity test design

Proposed, not implemented:

- **Baseline snapshot:** capture Aletheon's current static state (L0 presence, `archetype` charter, zero standing) via the existing read-only routes before any stand-up action, as the pre-change baseline.
- **Shadow comparison:** after any stand-up/passport/standing sequence, re-run `assessConstitutionalPresence()` and `assessAgentContinuity()` for `aletheon` and diff against the baseline. Reuses existing read-only assessment routes as the comparison mechanism — no new test infrastructure.
- **Extend existing canary suites** (do not create new files) with Aletheon-specific cases:
  - `tests/agent-homecoming.test.ts` — `standUpDelegate('aletheon')` is idempotent and seeds exactly the expected root fields.
  - `tests/delegate-standing-gate.test.ts` — `delegateStandingAllowsBand` resolves correctly once standing accrues for `aletheon`.
  - `tests/homecoming.test.ts` — presence ladder resolves contiguously post-seed (L0→L1 at minimum).
  - A continuity case verifying the `relationship` dimension flips from not-satisfiable to assessable once `rootSeeded` is true.
- **Non-elevation canary:** assert nothing in the stand-up/passport path can silently flip the static card's `registry_entry.status` from `'Pending Issuance'` without the corresponding human-gated act — mirroring the `MIGRATION_STAGE_SIGNAL.humanAct` discipline already enforced for stages 3/5/6.

---

## 10. Blocking gaps (ranked)

1. **No `agent_root_identity` row for Aletheon** — the root blocker; everything else cascades from this.
2. **`docs/platform-ontology.md` has no Aletheon/Alethean/Alethian entry** — already tracked as an open follow-up in the spelling resolution record, still not done.
3. **No live verification performed in this audit** — static code only; confirm via `GET /api/constitutional/homecoming-test` and `GET /api/homecoming/agent/continuity` before relying on any specific presence-level claim here.
4. **Unconfirmed whether stand-up also creates a resolvable CRM persona** — the standing-accrual chain requires `agent_root_identity.agent_id → crm_personas`; this census did not confirm whether `standUpDelegate`/genesis creates that link automatically. Open question, not asserted either way.
5. **No confirmed active bounded-delegation grant** — Aletheon appears only as an illustrative code comment in `BoundedDelegationTab.tsx`, not a verified DB row.
6. **Naming collision risk** — `registrableAgents.ts`'s "registrable agent" and the static card's `registry_entry` field are two different registries that share a word; worth a disambiguating note given a naming error (Alethian) already surfaced once this session.
7. **Cosmetic:** Aletheon's card route serves at a different path than its own doc comment claims — fix before any external consumer relies on the documented path.
8. **Unscoped, optional extensions** (external A2A/registrable-agent surface, general chat-picker presence) are separate decisions, not part of the Homecoming parity bar — do not build speculatively.

---

## 11. Proposed implementation sequence (proposal only — not executed)

Each step reuses existing generic mechanism; each human-gated step requires explicit operator go-ahead before execution, consistent with the Principal-Delegate Separation this whole system enforces.

0. **(Doc repair, lowest risk)** Add the Aletheon/Alethean/Alethian entry to `docs/platform-ontology.md` per the already-ratified spelling ruling. Zero code. **Held pending operator go-ahead** rather than executed in this pass, per the explicit instruction to stop after the audit.
1. **(Verify, read-only)** Run the existing live assessment routes for `aletheon` to confirm this census's static-code inferences against actual DB state.
2. **(Human-gated)** `standUpDelegate('aletheon')` via `POST /api/homecoming/agent/stand-up` — seeds `agent_root_identity` through the existing genesis pipeline.
3. **(Human-gated)** `issueDelegatePassport('aletheon')` via the existing Bureau path.
4. **(Verify + optional production)** Re-run continuity assessment; confirm `relationship` now resolves; optionally exercise `delegateProduce.ts` once at operational tier to seed genuine standing (preferred over the admin accelerator shortcut).
5. **(Human-gated, separate decision)** Issue a real `BoundedDelegationTab` grant at an appropriate trust band if the operator wants Aletheon operating with actual authority.
6. **(Optional, separate decision)** Decide whether Aletheon also needs a `RUNTIME_AGENT_IDS`/`app/data/personas.ts` entry for the general chat picker.
7. **(Optional, separate decision)** Decide whether Aletheon should also get health/invoke routes and a `registrableAgents.ts` entry for the external Horizen/A2A surface.

Steps 0–4 are the Homecoming-parity bar. Steps 5–7 serve the larger objective (native operation with attributable standing) but are explicitly separate governed decisions, not parity requirements.

---

## 12. Verdict: NOT PARITY READY

Aletheon is **not parity-ready** today — it holds constitutional presence rung L0 only, no seeded root identity, no standing, no confirmed bounded-delegation grant, and no passport.

However, the shape of "not ready" matters: **the required parity infrastructure is already fully built and generic.** Closing this gap requires zero new architecture — only a sequence of human-gated executions of existing Homecoming mechanisms (§11, steps 0–4) plus one documentation repair. This is a materially different verdict than "significant engineering required": it is "not ready, pending deliberate governed activation."

Consistent with the operator's framing that **parity is necessary but not sufficient**: even after the parity bar (steps 0–4) is cleared, the larger objective — native operation with attributable evidence, standing, and consequence, without human relay — still requires the separate governed decisions in steps 5–7, none of which this audit recommends taking automatically or by inference from doctrinal density.

---

## Specific questions — answered, with pointers

1. **Constitutional presence, historical vs. native evidence** — §2, §7. Historical attribution (doctrinal co-authorship) is real and dense but is evidence of *past dialogue credit*, not native agent standing; the codebase keeps these structurally separate.
2. **Do not manufacture history** — heeded throughout. No section of this audit proposes crediting Aletheon's historical doctrinal contributions toward standing/receipts; any such recognition would need its own separate governed ruling, not proposed here.
3. **Standing/authority path, resolved causally** — §7. `delegateStanding.ts` + `agentHomecoming.ts` + `issueDelegatePassport.ts`, not `registrableAgents.ts` (a different, Horizen-journey-specific capability).
4. **Presence ↔ standing mismatch** — §7, confirmed and precisely located: one missing `agent_root_identity` row.
5. **Delegate tools** — §8. No Homecoming delegate has broad executable tools today; artifact production is the one real surface, platform-wide.
6. **Continuity** — §8, §10 item 4. Generic, delegate-scoped mechanism exists (`agentContinuity.ts`); Aletheon is an eligible subject without a new memory system; two of five dimensions are honestly not-assessable for any delegate.
7. **Ontology/Common Ground** — §2, §10 item 2. Confirmed absent; minimal repair identified (§11, step 0), held pending operator go-ahead.
8. **Provider dependencies** — §6. Identity is provider-independent; inference provider is dynamically resolved and disclosed per-turn; no bespoke binding exists to unwind.

---

## Addendum A — Live-state supersession (2026-08-15, same day, later pass)

**The original §2/§3/§4/§12 conclusions above are PRESERVED UNCHANGED as historical evidence of what a static-code-only audit produced.** They are not deleted, not rewritten, and remain accurate as a description of what the codebase's static markers say. What follows corrects the conclusion drawn FROM them, using live Supabase evidence the original audit explicitly flagged it could not obtain (§0.3: "no live database was queried").

**Live state, independently verified by the operator via the Stage 1 sponsor-resolution preflight (`GET /api/homecoming/agent/stand-up?delegate=aletheon&preflight=true`) and direct Supabase query:**

- `agent_root_identity` — **exists** (`alreadySeeded: true`).
- `agent_persona` (production) — **exists**.
- An **approved `agent_participant` passport** exists for Aletheon.
- **Post-genesis delegation activity/receipts exist.**
- Mechanical Constitutional Presence is therefore **already L2** (`reasoning` — an `agent_persona` routing through bounded sovereign inference), not L0 as §3 concluded.
- **The gap is not "no stand-up occurred."** It is that the original stand-up's sponsor was itself unanchored: the recorded sponsor persona's `root_did` is `did:fio:devagent@qripto`, a FIO-handle-style identifier with **no matching `root_identity` row** — so `agent_persona.delegation_user_root_id` and `agent_persona.delegation_persona_id` are both `NULL`. Aletheon is mechanically present and constitutionally under-anchored, not absent.

**Why the original static-code conclusion was wrong, precisely:** `constitutionalPresence.ts`'s `DELEGATE_DB` map marks `aletheon: { handCuratedCard: true }` — a **hand-authored, session-dated code comment**, not a live query. It was accurate at the time it was written and has since gone stale relative to the database; nothing re-validates it against live state automatically. Recorded as its own candidate invariant (`CI-2026-08-15-STALE-STATIC-PRESENCE-MARKER-001`) — a static marker asserting a live-state fact must never be trusted over an actual query when both are available, and this codebase currently has no mechanism that would have caught the drift.

**Root-cause diagnosis of the sponsor-side gap (code-level, no live DB access from this pass — see the governance record for full evidence):**

1. `personas.root_did` is **not a single canonical scheme**. The Bureau identity-binding flow (`services/passport/bureauIdentityService.ts::bindBureauIdentity`) mints `did:root:ppb:<random>` and a matching `root_identity` row together. The **ordinary, default** persona-creation path (`services/identity/personaService.ts`) instead sets `root_did = 'did:fio:' + fioHandle` — a completely different identifier shape — **with no corresponding `root_identity` row created, ever, by that path.** These are two structurally separate identity systems that were never made to reconcile automatically.
2. `provisionAgentPersona.ts` already knows this: its own code comment (present before this session touched it) reads *"Human personas often carry a `did:fio:<handle>` root_did with no matching root_identity row... flag it for later backfill."* **No backfill mechanism was ever built.** Confirmed by exhaustive search: `delegation_user_root_id`/`delegation_persona_id` are written in exactly one place in the entire codebase — the `INSERT` in `provisionAgentPersona.ts` — and there is no `UPDATE` site anywhere.
3. `provisionAgentPersona.ts`'s idempotency branch (lines 92–113) returns the existing `agent_persona` row **immediately**, before the sponsor-root resolution code (lines 114–140) ever runs — confirming your claim exactly: re-running `standUpDelegate`/`provisionAgentPersona` today cannot repair this. It is a pure no-op on an already-existing persona.
4. **This is very unlikely to be Aletheon-specific.** Because the FIO-handle `root_did` default is the ordinary path for persona creation platform-wide, any Homecoming delegate (or any other sponsor generally) whose sponsoring persona was created via that path and never separately completed Bureau identity binding is exposed to the identical gap. See §"Affected other delegates" in the operator report for the exact live-check query.

**This document's own recommended next action (§10 item 3: "run the live routes to confirm empirically before relying on this census") has now been carried out and materially changed the finding — which is the reason this audit discipline exists.**

---

*Original pass: no implementation code written; this document, its two companion governance records, and the collections.json registration were the only changes. This addendum + `RES-2026-08-15-ALETHEON-LIVE-STATE-SUPERSESSION-001.json` + `CI-2026-08-15-STALE-STATIC-PRESENCE-MARKER-001.json` are the only changes made in this later pass. No repair code and no database writes were made in either pass.*
