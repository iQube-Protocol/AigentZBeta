# Operation Chrysalis — Workstream Tracker

**Living consolidated plan. Single source of truth for what is done, in flight, and pending across the one Chrysalis 2.0 program.** Update as increments land. Last updated 2026-07-09.

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
| **F. Constitutional primitives (Identity + Production)** | CFS-024 Constitutional Identity Hierarchy (person↔agent binding/assignment) + CFS-025 Constitutional Production Runtime (composition vs production) | CFS-024 P0–P1 shipped; CFS-025 proposed |

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
| 47 | **CFS-025 Constitutional Production Runtime (CPR).** Extract the duplicated production phase out of AgentMe / AigentZ / Studio / Cryptopia / CCRL into ONE constitutional primitive invoked by all (composition vs production). Spec authored (PROPOSED). In flight: production-surface audit + contract draft (agents). Then Phase 0 contract + canary → Phase 1 runtime skeleton (composing receipts/registry/standing/DVN) → Phase 2 one pilot invocation. | F | Ratify before build |
| 48 | **CFS-024 Phase 2/3 — Delegation consolidation.** Persona-first Delegation tab + persisted per-persona agent assignments (multiple assigned agents, one aigentMe, reassignable) + Wallet reflection. Plan presented; awaiting operator approval + a migration. | F | Operator approval + migration |

---

## 5. Discipline reminders (apply to every increment)

- **Observe-mode-first** (CFS-017/CFS-020 §9): instrumentation never blocks or mutates the surface it watches; any gate is its own ratification, never a rider.
- **Extend, don't duplicate**: the seam lives in `useDcirSeam`; affordances in `services/dcir/affordances.ts`; representation in roles/interpretations. Hand-wiring a parallel is an infraction.
- **Tier discipline**: T0 identifiers never in events/receipts/chain-bound data/telemetry.
- **Ratified before build** for D3/D4 increments and any new gating.
- **Role-driven rendering**: no raw colour literals on representation surfaces (canary-enforced); slate house style, not white hairlines.
