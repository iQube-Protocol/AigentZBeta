# Operation Chrysalis — Workstream Tracker

**Living consolidated plan. Single source of truth for what is done, in flight, and pending across the one Chrysalis 2.0 program.** Update as increments land. Last updated 2026-07-12.

**Program of record: `CFS-022` — Operation Chrysalis 2.0: The Constitutional Operating Environment.** That doc is the *why* and the reframe (COE, not IDE) + the five-pillar architecture + the gap assessment + the P0–P4 roadmap; this tracker is the *what-next*. The program folds CCRL / DCIR / Atlas / CDE as workstreams (specs unchanged; roadmap consolidated).

Companion / folded specs (authoritative detail lives there):
- `CFS-022` COE program of record · `CFS-015` Chrysalis PRD (mission expanded by CFS-022) · `CFS-016` deployment
- `CFS-019` CCRL charter (Research Lab workstream)
- `CFS-020` DCIR charter (interaction substrate workstream)
- `CFS-021` Constitutional Civic Futurism (representation + Bearing Instrument workstream)

## 0. The dependency graph (CFS-022 §2) — the keystone the program turns on

`Chrysalis 2.0 → Constitutional Runtime → Canonical Invariants (done) → Composable Assets (THE MISSING MIDDLE: Object Model + Asset Registry + Composition) → Atlas Plates → Picture Book.` The Atlas is blocked by the missing runtime, not by artwork. Keystone gaps: **G1 Constitutional Object Model** (contract-first, unblocks all) → **G2 Canonical Asset Registry** → **G3 Composition engine** (compose-not-generate) → G4 Publication unification → G5 Workspace/Factory shell. First leverage milestone: **P2 — compose ONE Atlas Plate end-to-end** (proves the machine; the book becomes routine after).

---

## 1. Workstreams at a glance

| Workstream | What it is | State |
|---|---|---|
| **A. CDE / Dev cockpit infra** | The Constitutional Development Environment surfaces + their reliability | Hardening — hang/flicker/env fixes shipping |
| **B. DCIR** | The interaction substrate (observe → recommend → afford). D0–D2 done; D3 in progress; D4 hook adopted on 4 surfaces | Active |
| **C. Constitutional Atlas / Representation** | CFS-021 representation system + the Bearing Instrument navigation primitive | Active |
| **D. Operator / infra** | Env provisioning, canister health, seed ingests — operator-side actions | Open items tracked below |
| **E. Homecoming — Constitutional Agent Sovereignty** | CFS-023 bridge programme; delegates stood up + Constitutional Presence ladder | Active |
| **F. Constitutional primitives (Identity + Artifacts)** | CFS-024 Constitutional Identity Hierarchy (person↔agent binding/assignment) + CFS-025 Artifact Runtime (three consequence tiers; constitutionality earned by promotion) | CFS-024 P0–P1 shipped; CFS-025 Phase 0 shipped, Phase 1/2 ratification-gated |

---

## 2. Shipped this session (2026-07-08 → 07-09)

**A. CDE infra**
- CDE tool viewports hang fix — `withTimeout` on IC/DVN/GitHub/Linear probes; client `personaFetchDeadline` (12s); `getSupabaseAccessToken` bounded (3s, GoTrue-lock hang) → falls through to localStorage.
- CDE pane flicker/stampede fix — non-memoized `onToolUsed` caused an infinite mount-effect loop (→ API stampede → token/key errors). Ref-stabilised each pane + memoised the parent observers.
- CDE route hang guard — `resolvePersonaOrTimeout` (6s) on all six dev-command-center routes → fast honest 503 naming the failing layer instead of a 12s client abort.
- DevTools tabs — Env/Canisters · Telemetry · DVN Pipeline · Escalation, with failure-flag dots.
- Env allowlist — `GITHUB_TOKEN`, `LINEAR_API_KEY`, `GITHUB_REPOSITORY`, `RQH_CANISTER_ID`, `REWARD_HUB_CANISTER_ID` added to `scripts/create-env-production.js` (Amplify console vars only reach the SSR runtime via this allowlist).

**A. House style**
- Corrected `agentiqLiquidGlass` interpretation from the white-hairline residual to the authoritative **slate** house style (hairline `#1E293B`, tint `rgba(15,23,42,0.4)`, no white inset). Codified the canonical surface-styling rule in `CLAUDE.md`.

**B. DCIR**
- D4: migrated the **CCRL research copilot** to `useDcirSeam` — the last hand-wired seam. All four originally-named surfaces (DCC, aigentMe, Studio Composer, CCRL) now on the one hook.
- D3: exposed the ratified **affordance engine by declaration** through `useDcirSeam` (`affordances` field); migrated the DCC to the single home. Observe-mode, suggest-only, capsule-contained.

**C. Constitutional Atlas**
- **Bearing Instrument v1.0** — `atlas` variant added to `components/representation/BearingInstrument.tsx` (role-driven; compact default + canaries untouched). Canonical anatomy: circular bezel + tick ring, Order/Reasoning/Action octants, Invariant Intelligence / Consequence Engineering poles, needle, six artefact glyphs, HDG/GS/ALT/TRK windows, standing ring + REGISTER marker, five layer labels, parchment (CCF) presentation. Canaries pin the new pure helpers + zero-literal gate.

---

## 3. In flight

| # | Item | Workstream | Notes |
|---|---|---|---|
| 32 | Bearing Instrument v1.0 atlas variant | C | Built + preview sent. Follow-ons: mount it in-app (Atlas hero / dashboard), fidelity polish toward the Breitling render (metal bezel, raised "ears" on the artefacts gauge), literal aviation numerics if wanted. |

---

## 4. Pending / backlog (ratification-gated where noted)

| # | Item | Workstream | Gate |
|---|---|---|---|
| 33 | **DCIR D3 — generic-vocabulary affordance derivations.** `generateAffordances` fires only on DCC dev-loop vocabulary; add derivations from generic event kinds (DocumentCreated / decisions / WorkflowAdvanced / NavigationOccurred) so affordances appear on aigentMe / Studio / CCRL, capsule-contained, deduped vs DCC. Then render on ≥1 non-DCC surface. | B | Ratify before build (CFS-020 §87) |
| 34 | **DCIR D4 frontier** — adopt `useDcirSeam` on surfaces beyond the four: Aigent Z (most-integrated), then Marketa, then per-cartridge. | B | Each its own ratification |
| — | **Bearing Instrument** — mount in-app + fidelity polish (see #32). Use as the invariant nav primitive across Constitutional Atlas surfaces. | C | — |
| 35 | **Verify CDE env vars live** post-deploy — `env-check` shows GITHUB_TOKEN / LINEAR_API_KEY / REWARD_HUB_CANISTER_ID `[✓]`. Requires operator to set `REWARD_HUB_CANISTER_ID=lvo2w-jqaaa-aaaas-qc2wa-cai` on the dev Amplify app. | D | Operator |
| 36 | **DVN canister status** — `dfx canister --network ic status sp5ye-2qaaa-aaaao-qkqla-cai` (cycles / PEM / id-mismatch). **Seed ingests** — `inv.representation.121-129` + `inv.interaction.112-118` are `proposed` in the seed crystal; run the ingest to make them live (CFS docs are canon meanwhile). | D | Operator |
| — | DCIR D2 remaining snapshot fields harden against their organs (intent/goals/policies/persona/standing/…); Feedback Coordinator full design (component #12). | B | Ratify before build |
| — | Two Supabase migrations if not yet run: `dev_loop_sessions`, research objects table. | D | Operator |
| 47 | **CFS-025 Artifact Runtime (AR).** One runtime shepherding artifacts across three consequence tiers — disposable / operational / constitutional; constitutionality EARNED by promotion. **Ratified 2026-07-10.** Phase 0 (contract + canary 19/19), Phase 1 (skeleton: classify + tier router + profiles), Phase 2 (CCRL `research` pilot: `artifact_published` DVN type + `/api/artifact/produce-research` + receipt-reconciliation adapter) all shipped. **Follow-up:** the 15-call-site ReceiptQube migration + retirement (incremental); anchoring registry `asset.published` is an opt-in (one-line flip) awaiting operator call. | F | Follow-ups only |
| 50 | **CFS-026 Constitutional Publishing Factory (CDS + CPS).** Three products: CCS (standards) · CDS (design system) · CPS (= the Artifact Runtime on document profiles). CDS v0.1 encoded as data + wired into native document production; delegate→AR convergence produces CCS-000 as the first factory output (seeded in the Homecoming workshop). **CFS-026 + CFS-027 RATIFIED 2026-07-12.** Plumbing shipped (plates as canonical assets · numbering registry · renderer map) + R1 plate renderer + artifact persistence (migration run). **R2/R3 (publication shell + derived PDF): SKIPPED per operator (2026-07-12)** — build on future request. IRL-0001 production + live drives: TBD (operator). | F | R2/R3 on request; drives TBD |
| 51 | **CP-008 candidate — the Constitutional Orientation compass (Bearing Instrument family).** Operator direction 2026-07-11: the compass in the v0.9 plate sheet is canonical imagery belonging to the Bearing Instrument (Canonical Asset 001). Decide at CFS-027 ratification: enters the plate set as CP-008, or stays the Bearing Instrument's own canonical rendering. Also from the v0.9 sheet: Hybrid-Intelligence-as-Venn (folded into CP-002 in v1.0 — likely stays derived). | F | Decide at CFS-027 ratification |
| 49 | **CFS-025 follow-up — ReceiptQube retirement (verify-in-place).** The receipt trail is unified (adapter double-write) and the raw-personaId T0 leak in `registry_receipts` is closed. Remaining: move the registry-ingestion READ path onto the unified `activity_receipts` table, then retire `registry_receipts` + drop the double-write. Touches the ingestion UI + money-adjacent paths — MUST be done against a running dev instance driving the ingestion UI, not speculatively. Also: the one-line opt-in to anchor registry `asset.published` (awaiting operator call). | F | Verify-in-place; operator-gated |
| 52 | **Consequential-artifacts plan — ALL 5 INCREMENTS SHIPPED 2026-07-12** (operator: "auto execute this whole plan"). (1) **Standing loop**: non-disposable production accrues standing to the PRODUCING delegate via canonical `accrueStanding` (delegated lane; CVS operational 2 / constitutional 5) with the trust-band ceiling (L2≥20 · L3≥50 · L4≥75 · L5≥100) surfaced on the Homecoming Test. (2) **Studio publish seam**: `POST /api/composition/publish` closes the composeArtifact PUBLISH SEAM — propose⇒operational record, publish⇒ONE anchored `artifact_published` receipt folded into provenance as a projection (engine untouched) + constitutional record. (3) **Business/AgentMe tiering**: `classifyBusinessArtifact` wired additively into create-artifact (gmail draft⇒disposable never persisted; doc/sheet/slides/calendar⇒operational records; constitutional structurally impossible on that path). (4) **Software pilot (D1-safe)**: `POST /api/artifact/produce-software` — the Implementation Pack IS the artifact body; operational tier, no receipt, executes/pushes/deploys NOTHING; `proposeDeployment` returns the documented pointer to the existing D1 route. (5) **Promotion UX**: promote route + Homecoming workshop chips lift a record operational→constitutional (receipt BEFORE lift; constitutional CVS accrues to the producing delegate). **Grant-gate decision RESOLVED 2026-07-12: option (c) — both, + admin accelerator.** Delegation route now dual-gated: grantor reputation (existing) AND, for L3+, the delegate's own server-resolved earned ceiling (`delegateStandingAllowsBand`; L1/L2 stay grantor-only as the bootstrap floor). Admins accelerate a delegate's standing via receipted `POST /api/homecoming/agent/standing` (+CVS 1–50 through the canonical accrual, `approval_granted` receipt first — the passportless-Polity-sponsorship shape) + a `+10` chip in the Homecoming workshop. | F | Done |
| 53 | **Linear lifecycle mirror — SHIPPED 2026-07-12 (operator-ratified).** One-way, best-effort projection of the production cycle into Linear (`services/linear/lifecycleMirror.ts`): issues keyed by a deterministic T2-safe `[AR:<hash12>]` marker on (delegate, profile, brief); phases map to portable Linear state TYPES (intent→backlog · pack→unstarted · produced→started · D1 proposed→started · published→completed); transition comments carry receipt ids/hash prefixes/standing. Wired into implementation-pack, deployment-proposal, produce-software, homecoming produce, promote, and composition publish. Soft-fails until the operator sets a write-scoped `LINEAR_API_KEY` + `LINEAR_TEAM_KEY` in Amplify (both allowlisted; the mirror lists available team keys in its warn when the team is unset). Linear is a MIRROR, never a source of truth — receipts stay canonical; only T2-safe content crosses the external boundary. | F | Operator: set env vars |
| 54 | **CFS-028 Capability Graph & Production Routing — RATIFIED + v1 SHIPPED 2026-07-12.** Producer (harness/model/delegate) × capability (AR profile) graph: contract types, seed graph (harnesses + delegates hand-seeded with stated reasons; model producers derived from the ModelQube registry), pure ranking core with the constitutional standing bar (`CONSTITUTIONAL_MIN_CEILING` = L3) applied to delegates, `GET /api/capability/producers` (admin-gated), routing strip on the Homecoming produce panel. `deployment-execution` edges seeded DORMANT until CFS-016 D2 ratification (operator direction: start with the Claude Code session as executor; server-side + other execution agents join as Producers earning the climb by standing). **Later, separately ratified:** receipt-learned fitness, real cost ingestion, live execution edges. | F | Done (follow-ons §4.5) |
| 48 | **CFS-024 Delegation consolidation — SHIPPED 2026-07-10.** Persona-first Delegation tab + persisted per-persona assignments (`persona_agent_assignments`, many delegates / one aigentMe / reassignable) + Wallet reflection (aigentMe star single-sourced from the resolver). Cross-persona aigentMe-creation fixed. Migration run. Follow-up: filter agent-personas out of the "Delegating as" selector (needs a reliable agent-persona marker). | F | Done (1 minor follow-up) |

---

## 5. Discipline reminders (apply to every increment)

- **Observe-mode-first** (CFS-017/CFS-020 §9): instrumentation never blocks or mutates the surface it watches; any gate is its own ratification, never a rider.
- **Extend, don't duplicate**: the seam lives in `useDcirSeam`; affordances in `services/dcir/affordances.ts`; representation in roles/interpretations. Hand-wiring a parallel is an infraction.
- **Tier discipline**: T0 identifiers never in events/receipts/chain-bound data/telemetry.
- **Ratified before build** for D3/D4 increments and any new gating.
- **Role-driven rendering**: no raw colour literals on representation surfaces (canary-enforced); slate house style, not white hairlines.
