# Researcher pathway — the fifth operator route into the Founder Office (Phase 20)

**Date:** 2026-07-16
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Operator direction:** "align the researcher path with the developer and other 3 paths
now and integrate it into subscription and FO subscription flow now" — the Research
Copilot occupies "a similar tier to the DevOn/AigentZ copilot in the developer pathway."

---

## What changed

The Polity Participation Model gains a **fifth operator archetype — the Researcher** —
a first-class peer to the four existing pathways (`citizen | entrepreneurial | technical |
creative`). Its paid copilot, the **Research Copilot**, is wired into the subscription /
Founder Office entitlement flow at the **same tier and with the same entitlement flag** as
the aigentZ/DevOn developer copilot — no new pricing was invented.

### Pathway axis (the 5th archetype)

| File | Change |
|---|---|
| `services/iqube/experienceQube.ts` | `OperatorArchetype` union + `VALID_ARCHETYPES` set gain `'research'` |
| `services/standing/standingScore.ts` | `ARCHETYPE_DOMAINS` gains `research: ['publications','education','validation','recognition','professional']` — the declaration domains the research pathway most expresses. `ARCHETYPE_PATHWAYS` derives from this, so the per-pathway Standing lens picks the Researcher up automatically. |
| `components/metame/setup/ExperienceModelSetupWizard.tsx` | local `OperatorArchetype` type + `OPERATOR_ARCHETYPES` picker option ("Researcher") + `ARCHETYPE_DEFAULT_TYPE` map (`research → personal`) |
| `supabase/migrations/20260716000000_experience_qubes_archetype_add_research.sql` | widens the `operator_archetype` CHECK constraint (prior migration enumerated only the four) to admit `'research'`. Idempotent: drops the existing constraint by lookup and re-adds the widened one. |

The persistence route (`app/api/assistant/experience-model/route.ts`) needed no change — it
casts to the `OperatorArchetype` type and the store validates against `VALID_ARCHETYPES`,
both now inclusive of `research`.

### Subscription / Founder Office entitlement

| File | Change |
|---|---|
| `services/activations/activationPlanGate.ts` | new `'researcher'` entry in `ACTIVATION_PLAN_GATE`: `{ entitled: (p) => p.aigentzLiteAccess, requiredTier: 'sovereign_citizen' }` — **identical** to the `'aigent-z'` developer-copilot gate. Both resolve through the single `resolveActivationPlanGate` / `isPlanEntitled` path — no parallel gate. |
| `data/activation-catalog.ts` | new `researcher` catalog entry (`gate: 'gated'`, `tabSlug: 'irl-research-copilot'`, `sourceCartridge: 'metame'`), mirroring the `aigent-z` entry: research-loop activity metrics (invariants queried, experiments run, counterfactuals projected) + outcome metrics (results published, invariants validated) + two NBAs. Adds `'researcher'` to the `ActivationAction.specialist` union. |

`aigentzLiteAccess` resolves to `sovereignAccess` (the Sovereignty tier — "for developers to
incubate pre-FO projects; full operational access is Founder Office"). Reusing it means the
same Sovereignty subscription that unlocks the aigentZ Command Center unlocks the Research
Copilot — the Researcher is the fifth route into the Founder Office at the developer copilot's
tier, exactly as directed.

### Surface

| File | Change |
|---|---|
| `data/codex-configs.ts` (metaMe cartridge) | new `research` tab **group** (`activationId: 'researcher'`, `FlaskConical` icon, order 0.85 — right after `agentz`) + a gated `Research Copilot` tab (`metame-research-copilot`, slug `irl-research-copilot`, component `IRLResearchCopilotTab`). This is the paid route peer to the aigentZ `Command Center` tab in the `agentz` group. Group visibility auto-gates on the `researcher` activation via the generic check in `CodexPanelDynamic` — no per-cartridge code. |
| `components/metame/billing/CitizenLadderModal.tsx` | new `Research Copilot (IRL)` FeatureRow in the tier-comparison table, directly under `DevOn (aigentZ)` — unlocked at Sovereignty (b) and Stewardship (c), locked on Free (a). This is the one user-facing subscription surface that maps the developer copilot to a tier; the Research Copilot now sits beside it at the same tier. |
| `services/billing/personaPlan.ts` | doc comment on `aigentzLiteAccess` now records that the Sovereignty tier grants the same flag to the researcher pathway's Research Copilot. |

The internal `irl-cartridge` ("metaMe IRL — Research Laboratory") Research Copilot tab is
left **ungated** — that cartridge is the institution's own workspace, and tab-level
`activationId` does not implicitly bypass admins (per `types/codex.ts`), so gating it would add
friction for the research team without benefit. The **paid** route to the same copilot is the
metaMe `research` group. IRL OS (the public edition) continues to carry the three free public
instruments (Dashboard, Field Explorer, Registry Browse) and reframes the Research Copilot as
this paid tier rather than shipping it free.

---

## Why this shape

- **One entitlement resolver, not a parallel gate.** The researcher reuses
  `resolveActivationPlanGate` and the `aigentzLiteAccess` flag — CLAUDE.md's Identity & Access
  Spine rule ("don't build parallel gates") applied to the subscription layer.
- **No new pricing.** The operator's framing was "a similar tier to the DevOn/AigentZ copilot,"
  so the Research Copilot rides the existing Sovereignty (T1) tier. If a distinct purchasable
  Researcher tier/price is wanted later, it is a one-row change to `requiredTier` +
  `ACTIVATION_PLAN_GATE.entitled` — flagged for operator decision.
- **Pathway parity.** The Researcher is now a full archetype everywhere the other four are
  enumerated (type, validation set, standing domains, setup wizard, DB constraint), so Standing
  lenses, NBE reranking, and the setup surface treat it as a first-class pathway.

---

## What was audited and deliberately NOT changed

- **Founder Office does not route archetypes.** `FounderOfficeTab` enumerates venture paths
  (`discover | validate | architect`) and venture-execution agents (`VentureAgentConsumer`),
  not operator archetypes — so it needs no archetype change. The archetype "route into the
  runtime" is the metaMe menu group (already wired).
- **Archetype consumers are pass-through.** Every `operatorArchetype` reader outside the three
  pathway-axis files (`nbeLlmRerank`, `briefBuilder`, the experience-model + standing routes)
  forwards the value without per-archetype branching, so they handle `research` automatically.
- **No other archetype-card surface.** The setup wizard's `OPERATOR_ARCHETYPES` is the only
  archetype-cards UI; `ExperienceModelCard` renders experienceType, not archetype.

## Open follow-ons (flagged, not built)

1. **Distinct Researcher tier/price** — currently reuses `sovereign_citizen`. A separate
   purchasable tier is a product decision for the operator (one-row change to
   `ACTIVATION_PLAN_GATE.researcher` + `requiredTier`).
2. **Researcher write access** — `/api/research/objects` writes are admin-gated today; loosening
   to the `researcher` entitlement (so paid researchers can persist results) is a deferred,
   separate change with its own gate review.
3. **Research Copilot as a roster specialist** — the developer copilot `aigent-z` is also a
   first-class `SpecialistId` in the aigentMe specialist roster (`specialistRouter.ts` /
   `specialistRecommender.ts`). Adding a `researcher` specialist would let aigentMe recommend and
   hand off to the Research Copilot, but it requires a real backing persona definition (system
   prompt, personality, request type) — a new agent, not just wiring. Deliberately deferred so
   the roster never surfaces a half-wired "consult Research Copilot" option; the Research Copilot
   ships as a complete dedicated tab, matching how the aigentZ Command Center is its own tab.
4. **FounderOffice `VentureAgentConsumer`** — optionally add the Research Copilot as a blueprint
   hand-off target if researchers should be a venture delegation destination. Not required for the
   pathway/subscription alignment.
