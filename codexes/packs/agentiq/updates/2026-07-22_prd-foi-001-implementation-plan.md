# PRD-FOI-001 — Founder Office Institutional Layer: Implementation Plan (Action Modes + Founders Club Phase 1)

**metaMe IRL / iQube Protocol · Engineering implementation plan · Status: DESIGN — implementation plan for two already-ratified architectures; this document itself requires operator ratification before code work begins**
**Owner:** AgentiQ Alpha / Venture Lab α workstream · **Origin:** follow-on implementation plan authored 2026-07-22, per the explicit next-step both source documents name in their own ratification records
**Governs:** the concrete, file-level build sequence that turns two fully-ratified architectures — the Founder Office Action Modes amendment and PRD-FDC-001 (Founders Club) — into shipped code, without re-deriving any decision either document already made.

**Source documents (both fully ratified, 2026-07-22 — read in full before this plan; this plan makes no independent architectural decisions, only sequencing and file-level ones):**

1. `codexes/packs/agentiq/updates/2026-07-22_founder-office-action-modes-amendment.md` — the Action Modes amendment (five modes, three-layer model, weighting-signal-only Phase 1).
2. `codexes/packs/agentiq/updates/2026-07-22_prd-fdc-001-founders-club.md` — PRD-FDC-001, Founders Club architecture.

This document is docs-only. **No code was written or modified to produce it.** No `npm`/`tsc`/`vitest` command was run — there is no `node_modules` in the authoring sandbox. Every file reference below was verified by direct read at authoring time (cited inline); nothing is paraphrased from memory or assumed present.

---

## §0 Reconciliation — two independent phase-numbering schemes, mapped onto one

### 0.1 The problem this section resolves

Both source documents ratified their own phase sequencing, using the same word — "Phase" — for two different axes:

| | Amendment's own phases (§8 item 6, §9) | PRD-FDC-001's own phases (§10, §13) |
|---|---|---|
| Axis | Action Modes rollout (UX + Runtime signal → Founders Club consumption → analytics) | Founders Club rollout (foundation → digital concierge → constitutional matching → physical infrastructure) |
| Phase 0 | *(not named — amendment has no Phase 0)* | Foundation / ratification — **done**, this is that |
| Phase 1 | Action Modes as UX + Runtime NBE-reranking weighting signal only. Zero changes to Standing/Billing/Archetypes/Entitlements/Research SKU. "New front-end, existing back-end." | Digital Concierge + 8-agent base roster, reading existing signals, interim (non-ML, explainable) matching heuristic. Journey Concierge excluded. |
| Phase 2 | Founders Club / Community Concierge **built using** Action Modes | True Constitutional Coordinates matching, gated on IRE/CCR being ratified **and built** |
| Phase 3 | Mode analytics / history / adaptive onboarding, gated on Phase 1–2 proving value | Physical Club infrastructure; Journey Concierge activates |

**Reading the two tables side by side, the collision is exact and answerable**: the amendment's own **Phase 2** ("Founders Club/Community Concierge built using Action Modes") and PRD-FDC-001's own **Phase 1** ("Digital Concierge, base roster, interim matching") are **the same body of work**, described from each document's own vantage point. This is not a guess — PRD-FDC-001 §5 names "Current Action Modes" as one of the nine named signals in its own Phase 1 interim matching heuristic, which means PRD-FDC-001's Phase 1 **already assumes** the amendment's Phase 1 (Action Modes as UX + weighting signal) is built and available to read from. A builder who tried to start PRD-FDC-001's Phase 1 without the amendment's Phase 1 already shipped would find the matching heuristic missing one of its nine signals.

Overloading "Phase 1" to mean two different things — amendment-Phase-1 (Action-Modes-only, no Founders Club) vs. FDC-Phase-1 (Founders-Club-only, assumes Action Modes exist) — is exactly the kind of ambiguity a future builder should not have to untangle from two source documents at once. This plan resolves it with its own, single, linear numbering: **Increments**, each cross-referenced back to both documents' own phase numbers so nothing is renamed, only sequenced.

### 0.2 The mapping this plan uses from here forward

| This plan's increment | Amendment's phase | PRD-FDC-001's phase | What ships |
|---|---|---|---|
| **Increment 1** | Phase 1 (in full) | *(pre-Phase-1 — a dependency PRD-FDC-001's own Phase 1 assumes exists)* | `ConstitutionalActionMode` type, archetype↔mode↔role mapping, mode-select UX in the setup wizard, `activeActionModes` request-scoped wiring, NBE reranking weighting signal |
| **Increment 2** | Phase 2 (its first slice — "Founders Club built using Action Modes") | Phase 1 (in full) | Founders Club UI placement (§2.1 of PRD-FDC-001), Community Concierge shell as a Founders-Club-scoped `SmartTriadCopilotLayer` instance, the 8-agent base roster wired at the routing/registry level (not all agents' deep specialist logic — see Increment 2's own scope note), the Phase 1 interim matching heuristic (consuming Increment 1's `activeActionModes` as one signal), staff-exception receipts |
| **Increment 3** | Phase 2 (its remainder) | Phase 1 (fast-follow) | Marketa-as-Market-Awareness extension, Ecosystem Analyst + Community Steward + Knowledge Curator (the three Addendum-B agents PRD-FDC-001 §10 does not explicitly exclude from Phase 1, but also does not explicitly confirm — flagged, §4) |
| **OUT OF SCOPE for this plan** | Phase 3 (mode analytics/history) | Phase 2 (Constitutional Coordinates matching) and Phase 3 (physical infrastructure, Journey Concierge) | Everything gated on IRE/CCR ratification+build, or on Phase 1–2 data "proving value," or on physical Club infrastructure existing |

This plan does not rename either source document's phases — the table above is a cross-reference, not a substitution. Anyone reading only the amendment or only PRD-FDC-001 can still find their own "Phase 1"/"Phase 2" language; this plan's "Increment N" is the connective layer between the two.

### 0.3 Real file-state facts verified for this plan (not assumed)

Every file this plan names below was read in full or in the cited section before being referenced here. The load-bearing facts that shape the increments:

1. **`services/iqube/experienceQube.ts`** (531 lines, read in full) — `OperatorArchetype` is exactly `'citizen' | 'entrepreneurial' | 'technical' | 'creative' | 'research'`, threaded through `ExperienceQubeMeta.operatorArchetype`, `DbRow.operator_archetype`, `VALID_ARCHETYPES`, `rowToRecord()`, `upsertExperienceQube()`. **No `ConstitutionalActionMode` type or `activeActionModes` field exists anywhere in this file today.** Confirms the amendment's own §0.1 exactly.
2. **`services/standing/standingScore.ts`** (259 lines, read in full) — `ARCHETYPE_DOMAINS: Record<OperatorArchetype, string[]>` and `ArchetypePathwayTag` are the only archetype-adjacent structures; no mode-awareness anywhere. Confirms the amendment's §6.3 "stays as-is" claim for this file.
3. **`components/metame/setup/ExperienceModelSetupWizard.tsx`** (539 lines, read in full) — Step 0 ("Project") renders `Field label="How do you participate?"` with a `RadioGroup` bound to `OPERATOR_ARCHETYPES` and `selectArchetype()`, which **replaces the whole `operatorArchetype` value** (single-select, no multi-mode state anywhere in `FormState`). Confirms the amendment's §0.2 point 2 and gives Increment 1 its exact insertion point (§2, Increment 1 below).
4. **`services/orchestration/nbeLlmRerank.ts`** (read: header + lines 60–260) — `RerankContext` interface (line ~95) already carries `operatorArchetype?: OperatorArchetype | null` with a doc comment: *"When set, the reranker biases toward archetype-appropriate NBEs."* `summariseForPrompt()` (line ~219) folds `ctx.operatorArchetype` into the JSON block sent to the LLM reranker (line ~234: `...(ctx.operatorArchetype ? { operatorArchetype: ctx.operatorArchetype } : {})`). **This is the exact, already-existing seam the amendment's §5 "weighting signal" targets** — not a new reranking algorithm, but one more optional field on an interface that already has this shape for archetype.
5. **`services/orchestration/briefBuilder.ts`** (read: relevant lines) — the actual caller: reads `getExperienceQube(input.personaId)` (line 236, line 412) and passes `operatorArchetype: qube?.meta.operatorArchetype ?? null` into `llmRerankNbeCandidates(...)` (lines 305–311, 483–489). This is where `activeActionModes` would also need to be threaded through, alongside `operatorArchetype`, once a source for it exists (§4.1 below — this is the open engineering question about session-state storage).
6. **`app/api/assistant/brief/route.ts`** (read in full) — confirms there is **no existing generic ephemeral "session-context" service** in this codebase for something request-scoped-but-not-permanent. The existing pattern for exactly this kind of value is: the client includes it in the POST body (`briefType`, `scopedCartridge` are both optional fields on this exact route, resolved per-request, never persisted server-side), sourced from whatever the client already tracks. This is a concrete, useful precedent for §4.1's open question — not a full resolution (see §4.1 for what remains genuinely open).
7. **`data/activation-catalog.ts`** (`ActivationCatalogEntry` interface read in full, lines 76–97) — confirmed no `modes` field exists today; `sourceCartridge`, `metrics`, `actions` are the only cross-cutting fields. Confirms the amendment's §6.3 "optionally ADD a `modes` field" proposal is additive against a real, verified current shape.
8. **`app/triad/components/codex/tabs/FounderOfficeTab.tsx`** (896 lines; header + `SubView` type read) — `type SubView = 'workspace' | 'discover' | 'validate' | 'architect' | 'blueprint';` (line 69). **Confirmed: no "Founders Club" or "Community" sub-view or primary section exists in this file today.** This is a real, verified gap — PRD-FDC-001 §2.1's "new primary section, coordinate with the Operational Domain" is genuinely unbuilt, not partially built.
9. **`components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`** (1,528 lines; header + agent-identity + `renderDots` sections read) — confirmed the reusable shape PRD-FDC-001 §0.3 names: `agentName`/`agentId`/`agentSubtitle` props render one visible face; `renderDots(value, type)` is the canonical R/T dot primitive (CLAUDE.md's "metaMe Client Protocol Primitive" section). Confirmed two existing cartridge-scoped instantiations to mirror: `app/triad/components/codex/tabs/DevCommandCenterTab.tsx` (line 1155: `agent={{ id: "aigent-z", name: "aigentZ" }}`) and `components/composer/IRLResearchCopilotTab.tsx`. **A Founders-Club-scoped instance is a third instantiation of this same pattern, not a new component family** — this is the concrete file-level form PRD-FDC-001 §0.3's "Founders-Club-scoped instance of the existing copilot pattern" decision takes.
10. **`codexes/packs/agentiq/collections.json`** (read in full) — `col_updates` collection lists update docs as bare path strings (`"updates/<filename>.md"`), newest-first. This document is registered as the new first entry, per that convention.
11. **`data/codex-configs.ts`** — **NOT read for editing purposes and NOT modified by this plan.** It is the reserved, high-collision file this session's own instructions route through the orchestrating session. Every increment below that would eventually touch it (adding a "Founders Club" tab/slug to the Venture Lab α cartridge's tab registry) is called out explicitly as **"describe only, route through the orchestrating session before editing."**

---

## §1 Purpose and scope

This plan turns the amendment's Phase 1 (Action Modes as UX + weighting signal) and PRD-FDC-001's Phase 1 (Digital Concierge + base roster + interim matching, per this plan's Increment 2–3) into a concrete, file-level build sequence. It is the "follow-on implementation plan (its own phase/PRD numbering)" both source documents' ratification records name as the one remaining gate before code work begins (amendment §9 last item; PRD-FDC-001 §13 last item).

**In scope:**

- Increment 1 — Action Modes as UX + Runtime NBE-reranking weighting signal (amendment Phase 1, in full).
- Increment 2 — Founders Club digital concierge, UI placement, 8-agent base roster (routing/registry level), interim matching heuristic (PRD-FDC-001 Phase 1, core).
- Increment 3 — the three Addendum-B agents not explicitly excluded from PRD-FDC-001 Phase 1 (Ecosystem Analyst, Community Steward, Knowledge Curator) and the Marketa Market-Awareness extension.

**Explicitly out of scope for this plan** (both source documents' own words, not this plan's invention):

- **Amendment Phase 3** — mode analytics, mode history, adaptive onboarding. Per the amendment's own §8 item 6: gated on Phase 1–2 data "proving valuable," and **"still no impact on standing computation unless a future constitutional decision explicitly calls for it."** Not chartered by this plan.
- **PRD-FDC-001 Phase 2** — true Constitutional Coordinates matching. Per PRD-FDC-001 §10: requires CFS-037 (IRE) and CFS-038 (CCR) to be **ratified and at least Phase-0-shadow-built** first. Neither is ratified today (PRD-FDC-001 §0.6 confirms CFS-037 is still "Architectural Foundation — DRAFT, awaiting operator ratification (2026-07-17)"). Not chartered by this plan; this plan does not attempt to pre-build any part of the Constitutional Awareness Graph (PRD-FDC-001 §7) or the Community Intelligence Engine (§8) beyond what Increment 2's interim heuristic needs.
- **PRD-FDC-001 Phase 3** — physical Club infrastructure; Journey Concierge activation. Per PRD-FDC-001 §10: "Journey Concierge... activates only here — the first agent whose domain requires physical-world referents." Not chartered by this plan; Journey Concierge is not built, wired, or stubbed by any increment below.
- **Standing computation changes, billing/entitlement changes, archetype enum changes, Research SKU changes** — forbidden by the amendment's own Phase 1 gate ("zero changes to Standing/Billing/Archetypes/Entitlements/Research SKU") and this plan does not propose any increment that would touch them.
- **`data/codex-configs.ts` edits** — reserved to the orchestrating session per this task's own instructions; every increment that would eventually need a codex-configs.ts change is called out with a "describe only" note rather than a task to perform.

---

## §2 Increment-by-increment plan

### Increment 1 — Action Modes: type, mapping, UX, weighting signal

**Goal:** Ship the amendment's Phase 1 exactly as ratified: "new front-end, existing back-end." A founder can express an Action Mode; the Runtime is aware of it as a weighting signal; nothing about Standing, Billing, Archetypes, Entitlements, or the Research SKU changes.

**Files touched:**

| File | New or modified | What changes |
|---|---|---|
| `services/iqube/experienceQube.ts` | Modified (additive) | ADD `export type ConstitutionalActionMode = 'Build' \| 'Create' \| 'Develop' \| 'Research' \| 'Safeguard';` and a `VALID_ACTION_MODES` set, mirroring the existing `OperatorArchetype`/`VALID_ARCHETYPES` pattern in the same file. **No new field on `ExperienceQubeMeta`/`DbRow`** — per the amendment's corrected §6.1/§6.2, the mode-set is session/runtime state, not profile data, so this file's job is limited to exporting the type + validation set for other modules to import. `OperatorArchetype`, `VALID_ARCHETYPES`, `operator_archetype` column, every read/write function — untouched. |
| `services/iqube/actionModes.ts` (**new file**) | New | The archetype↔mode↔role mapping table (amendment §3), expressed as code: `ARCHETYPE_TO_ACTION_MODE: Record<OperatorArchetype, ConstitutionalActionMode>` (the "exact" mappings — `entrepreneurial→Build`, `technical→Develop`, `creative→Create`, `research→Research`; `citizen` maps to no default mode per §3's own row) and `ACTION_MODE_ROLE: Record<ConstitutionalActionMode, string>` (`Build→'Builder'`, `Create→'Creator'`, `Develop→'Developer'`, `Research→'Researcher'`, `Safeguard→'Protector'`). **Justification for a new file rather than folding into `experienceQube.ts` or `standingScore.ts`** (per CLAUDE.md "never create a new file unless it represents a genuinely new, standalone concern"): this mapping is read by at least three unrelated call sites once Increment 1–2 ship (the wizard's default-seed logic, the NBE reranker's weighting pass, and PRD-FDC-001's Phase 1 matching heuristic in Increment 2) — none of which is `experienceQube.ts`'s concern (qube persistence) or `standingScore.ts`'s concern (standing computation). A single new module is the source-of-truth location per `inv.engineering.036/037` (source-of-truth-parity discipline), avoiding a hand-duplicated mapping table at each read site — exactly the failure class CLAUDE.md's "Source-of-truth parity is canary-enforced" section names. |
| `components/metame/setup/ExperienceModelSetupWizard.tsx` | Modified | Per the amendment's §8 item 5 ("keep the archetype picker, but move it behind the scenes... Action Mode becomes the UX"): ADD a new Step 0 question — **"What do you want to do?"** — as a multi-select chip group over the five Action Modes (Build/Create/Develop/Research/Safeguard), distinct from the existing single-select `RadioGroup` archetype picker. The existing "How do you participate?" `RadioGroup` (line ~293) **stays in the component, unchanged in its own behavior** — it moves to a later step (or a collapsed/"Advanced" section) rather than being deleted, satisfying "the wizard's archetype step is de-emphasized in the UI layer, not deleted or functionally altered" (amendment §8 item 5). On first open for a persona with an existing `operatorArchetype` but no prior mode selection, the new mode-select step pre-selects via `ARCHETYPE_TO_ACTION_MODE` (Increment 1's new module) as its non-empty starting seed — the "reseeding, not migration" mechanism from amendment §6.2 point 3. `OPERATOR_ARCHETYPES`, `ARCHETYPE_DEFAULT_TYPE`, `selectArchetype()` — untouched. |
| `services/orchestration/nbeLlmRerank.ts` | Modified (additive) | ADD `activeActionModes?: ConstitutionalActionMode[]` to the `RerankContext` interface (next to the existing `operatorArchetype?: OperatorArchetype \| null` field, same doc-comment style). In `summariseForPrompt()`, fold it into the JSON block the same way `operatorArchetype` already is (line ~234's pattern: `...(ctx.activeActionModes?.length ? { activeActionModes: ctx.activeActionModes } : {})`). Extend the system prompt's ranking instructions with one additional weighting rule: candidates matching an active mode rank up, everything else ranks slightly down — an additive instruction, not a rewritten ranking algorithm, per the amendment's §5 corrected framing ("re-weighting pass over the existing signal set, not a parallel/independent signal"). No change to the deterministic eligibility set the reranker already preserves (per the file's own existing comment at line ~58). |
| `services/orchestration/briefBuilder.ts` | Modified (additive) | At both `llmRerankNbeCandidates(...)` call sites (lines ~305–311 and ~483–489), add `activeActionModes: <resolved value>` alongside the existing `operatorArchetype: qube?.meta.operatorArchetype ?? null` line. The `<resolved value>` source is **Increment 1's remaining open item** — see §4.1, since this plan does not invent a new persistent session-context service (amendment §6.2 point 1 explicitly defers this to "whichever existing session-context mechanism is the closest fit"). |
| `data/activation-catalog.ts` | Not touched in Increment 1 | The optional `modes` field on `ActivationCatalogEntry` (amendment §6.3) is deferred to Increment 2, where it becomes useful for Founders Club's matching heuristic — adding it in Increment 1 with no consumer would be scope creep against "new front-end, existing back-end." |

**What's reused vs. new:**

- Reused: `OperatorArchetype`, `VALID_ARCHETYPES`, `ExperienceQubeMeta`, `RerankContext`, `llmRerankNbeCandidates`, `getExperienceQube` — every existing seam named in §0.3 is extended, not forked.
- New: `ConstitutionalActionMode` type + `VALID_ACTION_MODES` set (in the existing `experienceQube.ts`), the `services/iqube/actionModes.ts` mapping module, the wizard's new mode-select step, the `activeActionModes` field on `RerankContext`.

**Verification / acceptance:**

- A canary test mirroring `tests/source-of-truth-parity.test.ts`'s pattern: assert `Object.keys(ARCHETYPE_TO_ACTION_MODE)` covers every `OperatorArchetype` value except (per §3's own row) `citizen`, and that `ACTION_MODE_ROLE` covers all five `ConstitutionalActionMode` values — a parity canary against silent drift between the type union and the mapping table, per `inv.engineering.036/037`.
- A manual smoke test: open `ExperienceModelSetupWizard`, confirm the new "What do you want to do?" step renders before or alongside (not replacing) the existing archetype `RadioGroup`; confirm selecting an archetype with no prior mode selection pre-seeds the mode chips via `ARCHETYPE_TO_ACTION_MODE`; confirm saving still round-trips through the existing `POST /api/assistant/experience-model` route unchanged (the route's own body shape is untouched by this increment).
- A manual smoke test on the reranker: call `/api/assistant/brief` with a persona that has `activeActionModes` populated (once §4.1 is resolved) and confirm the LLM rerank JSON payload (loggable via the existing `summariseForPrompt` call) includes the new field, and that candidates tagged toward the active mode(s) rank higher in the returned `order` array than an equivalent call with `activeActionModes` omitted.

**Explicit non-goals for Increment 1:**

- No DB migration, no new column, no `research_tier`-style schema change (amendment §6.1 corrected decision).
- No change to `ARCHETYPE_DOMAINS`, `ARCHETYPE_PATHWAYS`, or `computeStandingScore()` in `standingScore.ts`.
- No change to `services/activations/activationPlanGate.ts` (confirmed by the amendment's own §0.2 point 3 that no gate reads `operatorArchetype` directly — nothing to migrate).
- No removal of the existing archetype `RadioGroup` or `selectArchetype()` behavior in the wizard.
- No Founders Club UI, agent, or matching code — that is Increment 2.

**Dependencies:** none — this increment is buildable immediately against ratified, already-existing infrastructure, independent of Founders Club.

**High-collision / reserved-file callout:** none in this increment. `data/codex-configs.ts` is not touched.

---

### Increment 2 — Founders Club: UI placement, Community Concierge shell, 8-agent base roster, interim matching

**Goal:** Ship PRD-FDC-001 Phase 1 (§10) core: a new "Founders Club" primary section exists in the Venture Lab α cartridge's Founder Office surface, a Community Concierge (as a Founders-Club-scoped `SmartTriadCopilotLayer` instance) is the single visible face, the 8-agent base roster (§4.2 of PRD-FDC-001) is wired at the routing/registry level, and the Phase 1 interim matching heuristic (§5) runs against existing signals — including Increment 1's `activeActionModes`.

**Depends on:** Increment 1 (the interim matching heuristic's signal list explicitly includes "Current Action Modes," PRD-FDC-001 §5).

**Files touched:**

| File | New or modified | What changes |
|---|---|---|
| `app/triad/components/codex/tabs/FounderOfficeTab.tsx` | Modified | Extend `type SubView = 'workspace' \| 'discover' \| 'validate' \| 'architect' \| 'blueprint'` (line 69, confirmed current) to add `'founders-club'` as a sixth value — **but rendered as a second primary section, coordinate with the existing Operational Domain sub-view strip, not folded into the same tab row** (PRD-FDC-001 §2.1's explicit correction of its own earlier "Community sub-view" framing). Concretely: the existing sub-view nav array (lines ~243–246, confirmed current: `workspace`/`discover`/`validate`/`architect` entries, `Layers`/`Compass`/`ShieldCheck`/`Building2` icons) gets a visually separated second group — an "Operational Domain" label over the existing four-plus-blueprint items, and a "Human Domain — Founders Club" label over the new one — rather than a sixth item indistinguishable from the first five. |
| `app/triad/components/codex/tabs/FoundersClubTab.tsx` (**new file**) | New | The Founders Club sub-view's own component, mounted when `FounderOfficeTab`'s `SubView === 'founders-club'`. Hosts the Community Concierge shell (below) plus whatever static roster/status UI Increment 2 needs. New file justified: Founders Club is a genuinely new surface with no existing home (PRD-FDC-001 §0.9's own "what's allowed to propose as genuinely new" list, item a) — mirrors the file-per-sub-view pattern `FounderOfficeTab.tsx` already uses internally for `Workspace`/`Blueprint` (defined as local functions in the same file per the current read) or as its own file if the surface grows past what a local function comfortably holds; a full `896`-line existing file argues for a new file here rather than growing `FounderOfficeTab.tsx` further. |
| `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` | Not modified | Reused as-is — the Founders Club instance passes its own `agent={{ id: 'aigent-community-concierge', name: 'Community Concierge' }}` (or the project's eventual canonical agent id/name) the same way `DevCommandCenterTab.tsx` passes `agent={{ id: "aigent-z", name: "aigentZ" }}` (line 1155, confirmed current). No fork, no new copilot component family (PRD-FDC-001 §0.3's binding decision). |
| `services/founders-club/agentRoster.ts` (**new file**) | New | The reconciled 8-agent base roster (PRD-FDC-001 §4.2) as a registry: `id`, `label`, `awarenessDomain` (or `null` for the three with no named domain — Event Curator, Circle Facilitator, Introduction Broker, per §4.4), and a routing hint for how Community Concierge dispatches to each. This is registry/metadata only in Increment 2 — it does **not** stand up each agent's full specialist logic (that is deep, cartridge-scale work outside a docs-first implementation plan's file-list scope); Increment 2's acceptance bar is "Community Concierge can name and route toward each of the 8 base-roster agents," not "each of the 8 agents has a fully built specialist capability." |
| `services/founders-club/matchingHeuristic.ts` (**new file**) | New | The Phase 1 interim matching heuristic (PRD-FDC-001 §5): a pure function taking the nine named signals (venture stage, industry/domain, geography, **current Action Modes** — reads `services/iqube/actionModes.ts`'s types from Increment 1 — Standing, current objectives, active challenges, shared interests, constitutional compatibility) and producing an explainable match record with a `"matched you because..."` rationale string, per PRD-FDC-001 §5's mandatory-explainability bar. Reuses `computeStandingScore()` (`services/standing/standingScore.ts`) for the Standing signal — does not reimplement Standing math. |
| `services/standing/standingScore.ts` | Modified (additive, optional) | Per PRD-FDC-001 §6.2: Portfolio Operator is a **role tag**, not an archetype — implemented as an additional read-only lens using the existing `ArchetypePathwayTag`/`ARCHETYPE_DOMAINS['entrepreneurial']` pattern (§0.5 of PRD-FDC-001), not a new scoring system. This is the one place Increment 2 touches Standing-adjacent code, and it is a lens addition, never a change to `computeStandingScore()`'s composite math. |
| `services/orchestration/nbeCatalog.ts` / `data/activation-catalog.ts` | Modified (additive, optional) | Per the amendment's §6.3: ADD the optional `modes?: ConstitutionalActionMode[]` field to `ActivationCatalogEntry` (now with a real consumer — the matching heuristic can read which activations serve which mode). No existing entry's `gate`/`tabSlug`/`metrics`/`actions` changes. |
| `data/codex-configs.ts` | **Describe only — do not edit; route through the orchestrating session.** | Eventually, the Venture Lab α cartridge's tab registry needs a `founders-club` tab slug wired the same way `agentiq-knyt`/other Venture Lab α tabs are registered today, so `FoundersClubTab.tsx` is reachable from the cartridge shell. This is exactly the "high-collision / reserved file" case this session's own instructions name — a future session should make this specific, small addition, not this plan. |

**What's reused vs. new (summary):**

- Reused: `SmartTriadCopilotLayer` (unmodified), `computeStandingScore()`, `ArchetypePathwayTag` pattern, the existing `FounderOfficeTab.tsx` sub-view nav shell (extended, not replaced), Increment 1's `ConstitutionalActionMode`/`ACTION_MODE_ROLE`.
- New: the Founders Club sub-view/tab component, the agent-roster registry, the matching-heuristic module, the Portfolio Operator lens (optional), the `modes` field on the activation catalog (optional).

**Verification / acceptance:**

- Manual smoke test: navigate to the Venture Lab α cartridge → Founder Office → confirm a visually distinct "Founders Club" (Human Domain) section renders alongside the existing Operational Domain sub-view strip, not folded into it — directly checking PRD-FDC-001 §2.1's ratified UI placement decision against the actual rendered UI.
- Manual smoke test: open the Founders Club section, confirm Community Concierge renders as the single visible face (matching the `agentName`/`agentId` pattern already used elsewhere), and that no second competing visible agent picker appears (PRD-FDC-001 §0.3/§9.1 principle 12).
- A canary test mirroring `tests/companion-runtime.test.ts` or `tests/access-gateway-human-session.test.ts`'s shape: given a fixture persona with a known Standing score, known `activeActionModes`, and known venture-stage/industry fields, assert `matchingHeuristic.ts`'s output includes a rationale string that cites at least one of the nine named signals verbatim — enforcing PRD-FDC-001 §5's "never an opaque black-box recommender, every match traceable to specific signals" requirement at the code level, not just as a design intent.
- Manual check: confirm the staff-exception mechanism (PRD-FDC-001 §3) composes the existing unified receipt writer referenced in CLAUDE.md's "Artifact Production" section rather than a bespoke Founders-Club-only log — i.e., no new receipt table or writer is introduced by this increment.

**Explicit non-goals for Increment 2:**

- No Constitutional Awareness Graph (PRD-FDC-001 §7) — deferred; that section's own §7.3 states it "cannot be built before IRE/CFO are ratified and, at minimum, Phase-0 shadow-built."
- No Community Intelligence Engine (PRD-FDC-001 §8) — same IRE dependency.
- No Journey Concierge — explicitly excluded from Phase 1 by PRD-FDC-001 §10 itself.
- No changes to `computeStandingScore()`'s composite score math — only an additive lens.
- No `data/codex-configs.ts` edit performed by this plan (see the callout row above).
- Deep, per-agent specialist logic for all 8 base-roster agents is explicitly not this increment's bar — see the `agentRoster.ts` row's acceptance note above.

**High-collision / reserved-file callout:** `data/codex-configs.ts` — the Venture Lab α tab-registry addition for a `founders-club` slug must be routed through the orchestrating session, per this task's own instruction and CLAUDE.md's "high-collision files" list precedent (`CLAUDE.md` names `data/create-env-production.js`, CRM routes, etc. as the existing examples of this pattern; `data/codex-configs.ts` is this session's explicitly reserved addition to that class).

---

### Increment 3 — Marketa Market Awareness extension + the three unambiguous Addendum-B agents

**Goal:** Close the remaining PRD-FDC-001 §4.3/§4.3a roster items that do not depend on IRE/CCR and are not Journey Concierge: Marketa's extension into Market Awareness, and the Ecosystem Analyst / Community Steward / Knowledge Curator registrations.

**Depends on:** Increment 2 (the agent-roster registry must exist before it can be extended with these four entries).

**Files touched:**

| File | New or modified | What changes |
|---|---|---|
| `services/founders-club/agentRoster.ts` | Modified | ADD four registry entries: `marketa` (pointing at the existing `aigent-marketa` persona / `marketa-codex` cartridge per PRD-FDC-001 §4.3a — **reused, not a new agent**), `ecosystem-analyst`, `community-steward`, `knowledge-curator` — each with their named awareness domain (Market / Ecosystem / Community / Knowledge) per PRD-FDC-001 §4.3/§4.3c. |
| `services/founders-club/matchingHeuristic.ts` | Modified (optional) | If Ecosystem Analyst's input list (PRD-FDC-001 §4.3c) is wired as a live signal source, the "constitutional compatibility" / "shared interests" signals in the Phase 1 heuristic may read from it — genuinely optional for Increment 3's acceptance bar; the heuristic already functions with Increment 2's nine signals alone. |
| `data/codex-configs.ts` | Not touched | No new tab/slug needed for this increment — these four agents extend the existing roster registry, not the UI surface. |

**What's reused vs. new:** Marketa is 100% reused (no new agent, no new file for her — PRD-FDC-001 §4.3a's own decision). Ecosystem Analyst / Community Steward / Knowledge Curator are new registry rows only — no new specialist-logic files in this increment, same "registry, not deep capability" scope note as Increment 2's base roster.

**Verification / acceptance:**

- A parity check (extend Increment 2's canary): assert the roster registry's full agent count matches PRD-FDC-001 §4.4's "13 agent-functions total" once Journey Concierge is added as an explicitly `excluded: true` / Phase-3-flagged row — i.e., the registry should be able to enumerate "12 Founders-Club-native + 1 reused (Marketa) = 13," with Journey Concierge present in the data but flagged inactive, so a future Increment 4 (out of scope here) has a clear activation point rather than a fresh roster edit.
- Manual check: confirm Marketa's existing `marketa-codex` cartridge surfaces (`MarketaCampaignDashboardTab`, `MarketaActivationEngineTab`) are read from, not duplicated, by whatever Market Awareness read Increment 3 wires — no second campaign/partner-intelligence UI is built.

**Explicit non-goals for Increment 3:**

- No new Market Intelligence agent (explicitly rejected by PRD-FDC-001 §4.3a).
- No Journey Concierge build, stub, or activation.
- No Constitutional Awareness Graph, even for these four agents' awareness domains — they still write to whatever placeholder/registry-level "current state" Increment 2 established, not a real Graph/Observatory perspective (PRD-FDC-001 §7.3's honest limit).

**High-collision / reserved-file callout:** none — `data/codex-configs.ts` is not touched by this increment.

---

## §3 Sequencing rationale

1. **Increment 1 before Increment 2 is not a stylistic preference — it is a hard data dependency.** PRD-FDC-001 §5 names "Current Action Modes" as one of the nine signals in its own ratified Phase 1 interim matching heuristic. If Increment 2 shipped first, the matching heuristic would either have to hard-code a placeholder for that signal (silently deviating from the ratified nine-signal list) or block on Increment 1 mid-build — worse than sequencing it first. This is the concrete instance of the general point in §0.1: the amendment's Phase 2 ("Founders Club built using Action Modes") **is** PRD-FDC-001's Phase 1, and "using Action Modes" means the modes must already exist.
2. **Increment 1 has zero Founders Club dependency and is independently valuable** — it is the amendment's own Phase 1, ratified and scoped as a standalone "new front-end, existing back-end" change. Shipping it first de-risks the larger Increment 2 build: the wizard UX change, the type/mapping module, and the reranker weighting signal can all be verified in isolation before Founders Club-specific code depends on them.
3. **Increment 3 after Increment 2, not merged into it**, because Increment 3's four roster entries are the ones PRD-FDC-001 §10's own Phase 1 description is least explicit about (it names "the 8-agent base roster" by number but does not explicitly confirm or exclude the four Addendum-B non-Journey-Concierge agents — see §4.2 below). Keeping them a separate increment means Increment 2 can ship and be verified against the unambiguous 8-agent roster + interim heuristic first, without blocking on resolving that ambiguity.
4. **The two IRE-dependent phases (amendment Phase 3, PRD-FDC-001 Phase 2) and the physical-infrastructure phase (PRD-FDC-001 Phase 3) are placed after all three increments, not interleaved**, because both source documents' own phase gates (amendment §8 item 6: "gated on Phase 1–2 data proving it valuable"; PRD-FDC-001 §10: "gated on... IRE/CCR... ratified and at least Phase-0 shadow-built") make them genuinely un-startable before Increments 1–3 ship and before separate, unrelated ratification work (IRE/CCR) completes. Scheduling them here would just be restating that gate, not sequencing real work.

---

## §4 Open engineering questions requiring a decision at build time

### 4.1 `activeActionModes` — the storage/transport mechanism (amendment §6.2 point 1's deferred decision)

**What the amendment leaves open (quoted, §6.2 point 1):** *"If a lightweight persistence layer is needed at all (e.g. to resume a session), it should use whatever mechanism already carries other ephemeral runtime/session state in this codebase, not a new profile-table column — a decision for whoever builds Phase 1, informed by which existing session-context mechanism is the closest fit."*

**What this plan's investigation found (§0.3 item 6):** there is **no existing generic "ephemeral per-persona session-context service"** in this codebase today. The closest real precedent is `app/api/assistant/brief/route.ts`'s own pattern: optional, non-persisted, request-scoped fields (`briefType`, `scopedCartridge`) that the client includes in each POST body, with no server-side session store behind them at all — the client is the only place that "remembers" the value between requests, typically via a `localStorage` mirror (the same class of pattern CLAUDE.md's Identity & Access Spine section documents for `currentPersonaId`).

**What remains genuinely unresolved, for the builder of Increment 1 to decide:**

- Whether `activeActionModes` should follow the exact same shape (a client-supplied, non-persisted field added to the `POST /api/assistant/brief` and `POST /api/assistant/experience-model` bodies, mirrored client-side in `localStorage` under a new key, e.g. `activeActionModes:<personaId>`) — **the option this plan's investigation leans toward as the closest fit**, since it requires zero new server-side infrastructure and matches an existing, working pattern exactly — or whether a small dedicated ephemeral store (e.g. a short-TTL Supabase row, or an in-memory/edge KV) is preferred for resuming state across devices without relying on `localStorage`, which does not sync across a founder's devices.
- If the `localStorage`-mirror option is chosen: whether the mode-select UI (Increment 1's wizard step) writes directly to `localStorage`, or whether a small client utility (parallel to `personaFetch`) should own reads/writes to keep the key name and shape in one place, per the source-of-truth-parity discipline this plan applies elsewhere.
- Cross-device / cross-tab behavior is explicitly not decided by either source document or this plan — flagged, not resolved, because neither ratified document specifies it and inventing an answer here would be scope creep beyond what was ratified.

This plan does not force a premature decision on this point — building Increment 1's type/mapping/UX/reranker-field work does not require resolving it (the wizard step and the reranker field both function correctly regardless of which transport eventually threads them together); only the final `briefBuilder.ts` wiring step (§2, Increment 1's file table, last row) is blocked on it.

### 4.2 PRD-FDC-001 §10's Phase 1 roster boundary — is it exactly the 8-agent base roster, or the 8 plus the 4 non-Journey-Concierge Addendum-B agents?

PRD-FDC-001 §10 states Phase 1 ships "Community Concierge + the 8-agent base roster (§4.2)" and explicitly excludes only Journey Concierge from Phase 1. It does not explicitly confirm or exclude Ecosystem Analyst, Community Steward, Marketa (Market Awareness), or Knowledge Curator from Phase 1 — the four Addendum-B items this plan places in Increment 3. This plan's own resolution — treating the 8-agent base roster (Increment 2) and the four non-Journey-Concierge Addendum-B agents (Increment 3) as two separate, sequential increments rather than one combined Phase 1 — is a sequencing choice this plan makes to avoid blocking Increment 2 on an ambiguity, **not** a claim that PRD-FDC-001 itself resolved which agents ship "in Phase 1" in the strict PRD sense. If the operator's intent was that all 12 native agents (everything but Journey Concierge) ship together as one Phase 1 unit, Increments 2 and 3 can be executed back-to-back with no rework — the file lists do not conflict — but this plan flags the ambiguity rather than silently picking one reading and presenting it as settled.

### 4.3 Exact component boundary for `FoundersClubTab.tsx`

§2's Increment 2 table proposes a new file (`app/triad/components/codex/tabs/FoundersClubTab.tsx`) rather than a local function inside the already-896-line `FounderOfficeTab.tsx`, reasoning from file-size precedent. This is a judgment call, not a verified requirement — the builder of Increment 2 should confirm whether the existing `Workspace`/`Blueprint` local-function pattern (confirmed present in `FounderOfficeTab.tsx` at the time of this read) is preferred by the operator for consistency, even at the cost of file length, before committing to a new file.

### 4.4 Whether the Portfolio Operator lens belongs in `standingScore.ts` or a Founders-Club-scoped module

§2's Increment 2 table places the optional Portfolio Operator lens as an addition to `services/standing/standingScore.ts` (reusing `ArchetypePathwayTag`). An equally defensible reading of PRD-FDC-001 §6.2 ("a Founders-Club-scoped role tag") is that the lens computation should live in `services/founders-club/` and only *read* `standingScore.ts`'s exported score, never adding Founders-Club-specific code to the shared Standing module. This plan does not resolve which placement the operator prefers — both are additive and neither touches `computeStandingScore()`'s composite math, so the choice is a matter of module boundaries, not architecture, but it should be settled explicitly before Increment 2's Portfolio Operator work begins rather than decided ad hoc mid-build.

---

## §5 Ratification record

**Status: UNRATIFIED. This implementation plan requires explicit operator sign-off before any Increment below begins code work — per both source documents' own final ratification-record items naming a follow-on implementation plan as the one remaining gate.**

- [ ] Operator ratifies the §0 reconciliation — the Increment 1/2/3 numbering and its cross-reference back to the amendment's own Phase 1/2/3 and PRD-FDC-001's own Phase 0/1/2/3, including the core claim that amendment-Phase-2 and PRD-FDC-001-Phase-1 are the same body of work.
- [ ] Operator ratifies Increment 1's file list and scope (§2) — the `ConstitutionalActionMode` type, the new `services/iqube/actionModes.ts` module, the wizard mode-select step, and the `RerankContext`/`briefBuilder.ts` weighting-signal wiring — as the complete, sufficient build for the amendment's Phase 1.
- [ ] Operator ratifies Increment 2's file list and scope (§2) — the Founders Club UI placement mechanism, the Community Concierge shell as a `SmartTriadCopilotLayer` instance, the 8-agent base roster as a registry (not full specialist logic per agent), and the interim matching heuristic — as the complete, sufficient build for PRD-FDC-001's Phase 1 core.
- [ ] Operator ratifies Increment 3's scope (§2) — Marketa's Market Awareness extension plus the three remaining Addendum-B agents as registry-only additions.
- [ ] Operator ratifies the §3 sequencing rationale, in particular that Increment 1 must complete (or at minimum have its type/mapping module available) before Increment 2's matching heuristic is built against it.
- [ ] Operator has reviewed §4's four open engineering questions and either resolves them here or explicitly delegates each to the builder of the relevant increment.
- [ ] Operator confirms the `data/codex-configs.ts` callouts in Increments 2–3 are routed through the orchestrating session rather than edited by whichever session builds these increments.
- [ ] This document is cross-referenced from both source documents' own ratification records (the amendment's §9 last item; PRD-FDC-001's §13 last item) as the "follow-on implementation plan" each names — to be done as a small follow-up edit to both documents once this plan itself is ratified, not performed by this docs-only authoring pass.

Until every box above is checked, this document authorizes no code change. It is a plan for a plan-following session to execute, not itself an authorization to begin Increment 1.

---

*Authored docs-only, 2026-07-22. Reconciles `codexes/packs/agentiq/updates/2026-07-22_founder-office-action-modes-amendment.md` and `codexes/packs/agentiq/updates/2026-07-22_prd-fdc-001-founders-club.md` into one build sequence. Every file reference verified by direct read at authoring time: `services/iqube/experienceQube.ts`, `services/standing/standingScore.ts`, `components/metame/setup/ExperienceModelSetupWizard.tsx`, `services/orchestration/nbeLlmRerank.ts`, `services/orchestration/briefBuilder.ts`, `app/api/assistant/brief/route.ts`, `data/activation-catalog.ts`, `app/triad/components/codex/tabs/FounderOfficeTab.tsx`, `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`, `app/triad/components/codex/tabs/DevCommandCenterTab.tsx`, `codexes/packs/agentiq/collections.json`. `data/codex-configs.ts` was deliberately NOT read for editing purposes and is not modified by this plan. No code was written; no `npm`/`tsc`/`vitest` command was run (no `node_modules` in the authoring sandbox). Structural/tone reference: `codexes/packs/irl/foundation/PRD-EPI-001_exp-p1-experimental-infrastructure-programme.md`, `codexes/packs/irl/foundation/PRD-PAG-001_polity-access-gateway.md`. Builds nothing; proposes a build sequence for operator ratification.*
