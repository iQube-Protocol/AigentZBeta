# CFS-051 — The Experiment / Constitutional / Invariant Pipeline

**Chrysalis Foundation · Charter · Status: RATIFIED-for-this-slice (built 2026-07-24, Strand 1 of the operator's four-strand programme)**
**Depends on / composes:** `types/research.ts` (EXPERIMENT_REGISTRY, EXPERIMENT_LIFECYCLE — the ratified/shipped experiment object model this register never forks), `codexes/packs/irl/foundation/canonical-invariants.seed.json` / `appendix-a_canonical-invariants.md` (the ratified invariant canon this register feeds candidates toward, never replaces), CFS-034 (Research Progression Ladder — standing/rungs, unrelated axis), CFS-044 (Open Lab reviewer engagement — the CAS access-grant mechanism this register's gate now COMPOSES, built 2026-07-25, see §5a), `services/access/policyResolvers.ts` (the access spine's shipped `token:*` credential resolver the token path composes — imported, never modified), `services/constitutional/capabilityRegistry.ts` (the structural template: soft-fail Supabase-backed registry, service-role RLS, thin gated API route).

**Renamed 2026-07-24 (operator correction, same day as the build):** this charter and its tab were first titled "...Registry." The operator was explicit that this reads as competing with, or replacing, the platform's actual formal experiment/invariant ratification process — which is unchanged, unaffected, and remains the sole authority (`types/research.ts`'s `EXPERIMENT_REGISTRY`, the canon file's canonization ceremony, protocol freeze/governance). Renamed throughout the user-facing surface (tab label, in-app header, this title) to **Pipeline**: an informal, pre-formal place to capture experiment ideas, candidate principles, and candidate invariants, which a human then runs through the EXISTING formal process, unchanged, to promote into the real registry/canon. §2's "Extend-don't-duplicate" boundary below was already written this way — only the naming was wrong, not the design.

**Status note (honesty over ceremony):** this charter documents a slice that is BUILT (schema, service, API, admin tab, seed data) but not yet operator-ratified as permanent doctrine, and not yet applied to a live database (no Supabase instance is reachable from the build sandbox — the operator must run the migration SQL below). "RATIFIED-for-this-slice" means: the code and schema described here exist and are internally consistent, not that the operator has reviewed and ratified the design. Treat this doc as DESIGN pending operator sign-off, same as any other CFS charter before its ratification record is checked.

---

## 1. Why this register exists

Operator framing (2026-07-24): *"Build a permanent, living register for the platform's experimental/constitutional evolution: active + candidate experiments, candidate constitutional principles, candidate structural invariants, and a research backlog — with status tracking, dependencies, and review history... this should be able to be updated in the front end. For now we can add this to the internal metaMe IRL cartridge admin gated but stubbed for opening up to cohorts or token gated access to enable public users to propose experiment or constitutional principles."*

Before this register, three related but distinct kinds of platform evolution had no common home:

1. **Experiments** — `types/research.ts`'s `EXPERIMENT_REGISTRY` is a hardcoded, canary-pinned TypeScript array. It is the correct SHIPPED/RATIFIED record of formal EXP-NNN experiments, but it cannot be edited from the UI, and it has no place for a candidate research thread that hasn't yet become a formal experiment.
2. **Constitutional principles** — ratified principles live only as markdown CFS documents. There was no "candidate, under review" stage — a principle either didn't exist yet, or was already a ratified charter. CFS-044 §1 is the one place in the corpus that names this gap explicitly: *"candidate constitutional invariant — for ratification."*
3. **Structural invariants** — the ratified canon (`canonical-invariants.seed.json`) already has an internal `status: "proposed"` staging for invariants not yet canonized, but that staging happens INSIDE the canon file itself, authored by hand. There is no place to propose a brand-new candidate invariant that isn't in the canon file at all yet.
4. **Research backlog** — tracked informally across `CHRYSALIS_WORKSTREAM_TRACKER.md` and scattered `agentiq/updates/` docs, never as first-class, status-tracked rows.

This charter's build closes that gap with four new Supabase tables, one service module, one admin-gated API route, and one admin tab — architected from the start so the admin gate can widen to cohort/token-gated public access without touching the CRUD logic.

## 2. Extend-don't-duplicate — the explicit boundary decision

**`EXPERIMENT_REGISTRY` remains the single ratified/shipped experiment list.** This register's `research_candidate_experiments` table is NOT a second experiment registry — it exists specifically for:

- Candidate research threads not yet a formal `EXP-NNN` row (the operator's twelve named workstreams below — most already have real CFS/CRP charters, but none is a tracked `ResearchExperiment` object).
- Any experiment idea surfaced along the way that hasn't been scoped into a formal protocol yet.

Where a candidate genuinely IS already an `EXPERIMENT_REGISTRY` entry (found exactly once in this build: "Software Invariants" = `ISR-001`), the candidate row is a **cross-reference marker** (`status: 'promoted'`, `depends_on: ['EXP-registry:ISR-001']`), not a restatement of the hypothesis — `ISR-001` in `types/research.ts` remains the one source of truth for that content.

**The invariant canon is untouched.** `research_candidate_invariants` is for invariants not yet present in `appendix-a_canonical-invariants.md` / `canonical-invariants.seed.json` under any `inv.*` id — including ones still `status: "proposed"` inside that file. Promotion path: `candidate → proposed-for-canonization → canonized`, at which point a human completes the SAME canonization ceremony the canon file already uses (editing the seed JSON + appendix), and records the real `inv.*` id in `promoted_invariant_id`. This table never writes to the canon file itself.

**Constitutional principles are a genuinely new concept**, per the task brief — there was no pre-ratification stage before this build. `research_candidate_principles` is that stage.

## 3. Data model

Four Supabase tables, one shared shape (`status`, `depends_on text[]`, `review_history jsonb` append-only array of `{ reviewerRef, date, note, disposition }`, `created_at`/`updated_at`), migration `supabase/migrations/20260820000000_experiment_constitutional_registry.sql`:

| Table | Status vocabulary | Notes |
|---|---|---|
| `research_candidate_experiments` | `proposed → scoped → protocol-ratified → running → evaluated → published → promoted` (+ `archived`) | `charter_ref` cites a REAL repo path when one exists; `governing_invariants text[]`; `layer` mirrors `ConstitutionalLayer` (`'I'\|'II'\|'III'`) |
| `research_candidate_principles` | `proposed → under-review → ratified` (+ `rejected`) | mirrors the Hypothesis-vs-Canon discipline (CLAUDE.md) — never enters `ratified` by assertion |
| `research_candidate_invariants` | `candidate → proposed-for-canonization → canonized` (+ `rejected`) | `promoted_invariant_id` records the real `inv.*` id once a human completes canonization outside this table |
| `research_backlog_items` | `backlog → scoped → in-progress → done` | `priority: low\|medium\|high`; `linked_experiment_ids` / `linked_hypothesis_ids text[]` |

Types: `types/researchRegistry.ts` (a NEW file, deliberately not an extension of the canary-pinned `types/research.ts` — see file header for the reasoning). Cross-register `depends_on` entries use a namespaced-ref convention: `experiment:<slug>` / `principle:<slug>` / `invariant:<slug>` / `backlog:<slug>`, or a bare `EXPERIMENT_REGISTRY` id (e.g. `EXP-registry:ISR-001`) when depending on the shipped registry directly.

**T2 discipline:** no `personaId`/`authProfileId` column anywhere in the schema. `review_history` entries carry a `reviewerRef` — `personaPublicRef(personaId)` (sha256, 16 hex — the SAME Polity Public Reference derivation the DVN pipeline and `services/passport/participationAccess.ts` already use), computed server-side, never the raw id.

**No DVN receipts in this slice** (deliberate scope decision — see `backlog-dvn-receipt-registry-actions`). The append-only `review_history` jsonb array is the audit trail for now; wiring `research_registry_item_registered`/`_status_changed` into `activity_receipts` (mirroring `capability_registry`'s CHECK-constraint-rebuild pattern) is a named, tracked follow-on, not forgotten.

## 4. Service + API

- `services/research/registryStore.ts` — `list*`/`create*` per kind (mirrors `capabilityRegistry.ts`'s soft-fail pattern: every list soft-fails to `[]` if the migration isn't applied yet, every create reports `{ ok: false, reason }` honestly), plus kind-generic `transitionRegistryStatus`, `addRegistryReviewNote`, `editRegistryItem` (patch restricted to a per-kind allowlist — never `id`/`slug`/`review_history` directly).
- `services/research/registryAccess.ts` — **the swappable gate** (widened 2026-07-25, see §5a). Exposes a PURE decision core plus a thin I/O shell; the CRUD service and the store remain entirely gate-unaware.
- `app/api/research/registry/route.ts` — `GET` (list all four registers) + `POST` (`action: 'create' | 'edit' | 'transition-status' | 'add-review'`), gated by `resolvePersonaOrTimeout` + `resolveRegistryAccess`, mirroring `/api/constitutional/capability-registry`'s 503/401/403 contract exactly.

## 5. Front-end

`app/triad/components/codex/tabs/ExperimentRegistryTab.tsx` — registered in `TabRenderer.componentRegistry` as `ExperimentRegistryTab`, wired into `IRL_CARTRIDGE` (`data/codex-configs.ts`) as tab id `irl-experiment-registry` (slug `irl-experiment-registry`), group `laboratory`, `adminOnly: true`, sibling to `irl-corpus-scout` / `irl-exp-p1-readiness`. Four-section switcher (Candidate Experiments / Candidate Principles / Candidate Invariants / Research Backlog), each with: a collapsed create form, a list of items with an inline status-transition `<select>`, and an expandable review-history panel + add-review-note mini-form. Uses `personaFetch` exclusively (CLAUDE.md PARAMOUNT spine-fetch rule) and the translucent-slate house style (`bg-slate-900/40` / `border-slate-800`, no white hairlines).

**Path to public access — BUILT 2026-07-25, see §5a.** (The original text here predicted the shape correctly: the widening touched only `services/research/registryAccess.ts`, and neither the CRUD service, the store, nor the tab component changed behaviour.)

## 5a. The gate widening (built 2026-07-25 — operator answered "both")

Asked whether to widen to a CAS research-lab grant, a token gate, or both, the operator answered **both**. The seed backlog row `backlog-widen-registry-access-gate` is now satisfied.

### Three paths, OR'd, each independently sufficient

| Path | Signal | Composes |
|---|---|---|
| `platform-admin` | `persona.cartridgeFlags.isAdmin` | — (unchanged; never weakened) |
| `cas-research-lab-grant` | an active `research-lab` grant in the Constitutional Access Service | `getGrantedExperiments` (`services/passport/participationAccess.ts`) — the SAME grant mechanism CFS-044's Open Lab reviewer engagement issues against. **No second grant system, no new table, no new query.** |
| `token-holding` | the caller holds the operator-configured gate token on-chain | `resolveExternalCredential` (`services/access/policyResolvers.ts`) — the access spine's SHIPPED `token:<chain>:<contract>[:<tokenId>]` credential resolver, which resolves the persona's chain address and reads `balanceOf` via `ownsErc721`/`ownsErc1155`. That file is spine-protected: **imported, never modified.** |

### Propose vs. curate — the gate is TWO capabilities, not one

The operator's framing was specific: widen so public users can **propose**. Proposing and curating are different constitutional acts, so the gate splits:

| Capability | Actions | Who |
|---|---|---|
| `read` | `GET` | any of the three paths |
| `propose` | `POST create` | any of the three paths |
| `curate` | `POST edit` / `transition-status` / `add-review` | **platform admin ONLY — byte-identical to the pre-widening behaviour** |

A status transition is the step a human takes *toward* the formal registry/canon ceremony §2 protects; that judgement stays with the admin. Silently granting full CRUD to every grant-holder would have over-read the instruction.

**Role-scoped curation is deliberately NOT built.** Letting a grant whose role is `reviewer` / `research-steward` / `ratifier` append review notes would need a role-aware grant reader; `getGrantedExperiments` — the only persona-scoped grant reader that exists — returns experiment scoping, not role. Inventing a second grant query would be the parallel-implementation defect `inv.engineering.037` names. Tracked as a follow-on, not guessed at.

### Pure core + thin I/O shell

`decideRegistryAccess(signals) → decision` is PURE and synchronous — three booleans in, a capability decision out — mirroring SPEC-COS-001's `services/onboarding/substrateState.ts::activeSurfaces`. All I/O lives in `resolveRegistryAccess`, which gathers the signals and delegates. Both widened lookups **fail closed** and never throw: a Supabase outage or an RPC failure denies the widened path, never the admin path, and never 500s the route. An admin short-circuits both network lookups entirely.

### Token configuration — nothing is hardcoded

The gate token is named by the operator via `RESEARCH_REGISTRY_TOKEN_CREDENTIAL` (allowlisted in `scripts/create-env-production.js`), in the access spine's own grammar: `token:<chain>:<contract>` or `token:<chain>:<contract>:<tokenId>`. Chains: ethereum | base | optimism | polygon | arbitrum. **Unset is the default and means the token path is INERT, not open**; a malformed value is logged and treated as unset, so a typo fails closed. No contract address is hardcoded, guessed, or defaulted (CLAUDE.md "No Guessing or Hallucinating") — the canary asserts no 40-hex EVM literal appears in the module. **No DB migration was required.**

### A gate-bypass bug found and fixed while widening

`POST create` accepted a client-supplied `status`. While every caller was an admin this was harmless; the moment `propose` widened, a propose-only caller could have created a row already at `published` / `promoted` / `ratified` / `canonized` — precisely the transitions `curate` exists to withhold. The route now drops a non-curator's `status`, so the store applies its own default (`proposed` / `candidate` / `backlog`) and every advance must go through the curate-gated `transition-status`.

### The surface stays admin-only

`irl-experiment-registry` remains `adminOnly: true` in `data/codex-configs.ts`, untouched. Widening the API was additive and operator-directed; exposing a public proposal *surface* is a separate step requiring its own authorization (CLAUDE.md "Security — Access Gates"). `GET` now returns a `capabilities` object so a future public surface can render exactly the affordances its caller holds.

### Canary

`tests/research-registry-access.test.ts` (22 assertions) pins: the full 2^3 decision truth table (admin keeps everything; no-signal passes nothing; each widened path independently grants propose and NEVER curate); token-credential validation failing closed; the action→capability map; the create-status guard; that the gate composes rather than re-implements grants/chain reads; and — structurally — that `registryStore.ts` contains no gate logic, no admin flag, no grant query, and no raw `persona_id`.

## 6. Seed data and its real sources

The operator named twelve workstreams; every one was located by a real grep/read of this repo, never invented. Full citations live in the seed migration's inline comments (`supabase/migrations/20260820000100_seed_experiment_constitutional_registry.sql`); summarized:

| Named item | Real match found | Status set |
|---|---|---|
| Invariant Discovery Engine | CFS-048 (`codexes/packs/irl/foundation/CFS-048_invariant-discovery-engine-charter.md` — filed into the foundation 2026-07-28, byte-identical, from `agentiq/updates/2026-07-20_cfs-048-invariant-discovery-engine-charter.md`) + the parent-linking/phase1a/phase2/recursive-compression amendments, which stay in the updates pack as build records | `published` |
| Financial Services invariant refinement | CRP-003 / CRP-003a | `published` |
| Software Invariants | **already `ISR-001` in `EXPERIMENT_REGISTRY`** | `promoted` (cross-ref, not duplicated) |
| Constitutional Navigation | CFS-050 (Sovereignty Navigation, ratified 2026-07-24) | `published` |
| Constitutional Agent Reconstitution | SPEC-HMC-001 §9 (Strand 2, landed mid-build — see §6a) | `scoped` (DESIGN, unratified) |
| Homecoming | CFS-023 (Chartered 2026-07-09) | `published` |
| Progressive Surface Activation | SPEC-COS-001 §4 (Strand 3, landed mid-build — see §6a), extending CFS-050 §4 | `scoped` (DESIGN, unratified) |
| Sovereignty Journey | `services/venture/customerMatrix.ts` (2026-06-21) + CFS-050 §3 | `published` |
| Common Onboarding Substrate | SPEC-COS-001 (Strand 3, landed mid-build — see §6a) | `scoped` (DESIGN, unratified) |
| Action-oriented Navigation | SPEC-VLM-001 §3.2 (exact title match) + CFS-050 §2 | `published` |
| Constitutional Continuity | CFS-009 (defined term within the four-primitive identity chain) | `scoped` |
| Agent Continuity | SPEC-HMC-001 §1 (Strand 2, landed mid-build — see §6a) | `scoped` (DESIGN, unratified) |

### 6a. A mid-build correction — sibling strands answered three of these live

This build (Strand 1) initially searched the repo as it stood at session start and honestly marked **Constitutional Agent Reconstitution**, **Agent Continuity**, and **Progressive Surface Activation** / **Common Onboarding Substrate** as partial-matches or "candidate, no charter yet" — the real corpus at that moment had no dedicated charter for any of them (closest: CFS-031 §3's general, not agent-specific, Reconstitution; the adjacent `journey_states` substrate; CFS-050 §4's principle without a named doctrine).

Mid-build, this session observed (via `git log`) that **Strand 2** (`SPEC-HMC-001_constitutional-agent-continuity.md`) and **Strand 3** (`SPEC-COS-001_constitutional-onboarding-specification.md`) — sibling strands of the SAME four-strand operator programme, running concurrently on this same branch — had just landed real, on-point, DESIGN-status charters for exactly these gaps:

- **SPEC-HMC-001** — titled *"Homecoming: Constitutional Agent Continuity Specification"* — §1 gives the working definition of agent continuity directly; §9 gives *"a worked-through definition of Constitutional Agent Reconstitution (the operator's own named sub-concept)"*, explicitly distinguished from CRP-003a's unrelated "Transaction Reconstitution" and from CFS-031 §3's general Reconstitution.
- **SPEC-COS-001** — subtitled *"the one substrate every arrival crosses, before any specialist journey begins"* — §4 is titled *"Progressive surface activation"*, explicitly generalizing what CFS-050 and PRD-THR-001 each apply locally.

Rather than leave the earlier honest-but-now-stale "no charter yet" markings in the seed data, this migration was corrected before commit to cite the real sibling-strand charters (both `source_note` fields narrate the correction explicitly, so the audit trail is honest about the sequence: searched → not found → sibling strand landed → re-checked → cited). Status is set to `scoped` rather than `published` for all three, because both source docs' own headers state `Status: DESIGN — docs-only, awaiting explicit operator ratification` — a real charter exists, but is not yet ratified.

The one item this correction does NOT resolve: the seed data still notes that a backlog item (`backlog-clarify-agent-reconstitution-continuity-scope`, retitled *"Ratify SPEC-HMC-001"*) remains open — the remaining work is now the operator's ratification pass, not discovery.

**Additional candidates identified from this session's own recent work** (per the task's invitation to scan `agentiq/updates/` + the CFS-0xx sequence for genuine open threads):

- **Invariant Engine Family** (CFS-035/037/038/039/040/041 — Resolution/Coordinates/Projection/Knowledge-Resolution/Field-Observatory) — cross-referenced against `EXPERIMENT_REGISTRY`'s `IRV-001`/`IPV-001`/`EXP-P1`/`EXP-P2`/`EXP-P3`, which already validate parts of this bundle.
- **Constitutional Cybernetic Loop** (CFS-031) — the two-rate (fast code loop / slow constitutional loop) model, ratified 2026-07-15, tracked as its own top-level thread distinct from the narrower "Agent Reconstitution" question above.
- **Dynamic Constitutional Interaction Runtime (DCIR)** (CFS-020) — a canonical runtime capability alongside Constitutional Reasoning/Order/Action.
- **Capability Brief / mySoftware / Capability Registry** (CFS-049 / SPEC-MMC-002 / CFS-032) — today's (2026-07-24) live thread; this session found it mid-flight as uncommitted working-tree edits, so its candidate row is marked `running`, not `published`.

Also seeded: one candidate constitutional principle (CFS-044's "Runtime is the Place of Record" — the corpus's own clearest example of a principle explicitly staged `PROPOSED (ratify-before-build)`), one candidate structural invariant (a structural framing of CFS-050 §4, deliberately NOT duplicating anything already in the canon file), and three backlog items (widen the access gate; DVN-receipt the registry's own actions; resolve the two partial-match items with the operator).

## 7. What this is NOT (scope guard)

- **Not** a fork of `EXPERIMENT_REGISTRY`, the invariant canon, or the Standing/rung ladder (CFS-034) — composes with all three, forks none.
- **Not** DVN-receipted yet — the `review_history` jsonb log is the audit trail for this slice; DVN anchoring is a named follow-on.
- **Not** a publicly accessible SURFACE yet — the API gate widened 2026-07-25 (§5a) to admit CAS `research-lab` grant holders and token holders for read+propose, but the tab remains `adminOnly: true` until the operator authorizes a public proposal surface. Curation remains platform-admin on every path.
- **Not** applied to a live database — the operator must run the migration SQL (see the session's final report / this build's commit message for the exact copyable block).

## 8. Ratification record

- [x] BUILT 2026-07-24 (Strand 1 of the operator's four-strand programme) — schema, service, API route, admin tab, seed data, this charter.
- [x] GATE WIDENED 2026-07-25 (operator answered "both") — CAS `research-lab` grant + token gate OR'd with the untouched admin path, split into propose vs. curate, canary-pinned (§5a). Satisfies the seed backlog row `backlog-widen-registry-access-gate`.
- [ ] Operator sets `RESEARCH_REGISTRY_TOKEN_CREDENTIAL` in Amplify if the token path should be live (unset = inert, which is a valid steady state — the CAS grant path works without it).
- [ ] Operator authorizes (or declines) a PUBLIC proposal surface; until then `irl-experiment-registry` stays `adminOnly: true`.
- [ ] Operator reviews and ratifies the four-table schema + admin-gate design.
- [ ] Operator runs the migration SQL against the live Supabase instance.
- [ ] Operator ratifies SPEC-HMC-001 and SPEC-COS-001 (Strands 2/3 of this same programme), which this build's seed data now cites for Constitutional Agent Reconstitution, Agent Continuity, Progressive Surface Activation, and Common Onboarding Substrate — see `backlog-clarify-agent-reconstitution-continuity-scope` (retitled "Ratify SPEC-HMC-001").
