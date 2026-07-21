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
creative`). Its paid copilot, the **Research Copilot**, is sold as its **own unlock with a
unique SKU** — the dedicated `research_copilot` tier, priced at the **same $29/mo stage** as
Sovereignty but **not bundled** into it (just as aigentZ is its own concern). Buying aigentZ
does not grant the Research Copilot, and vice versa.

### Pathway axis (the 5th archetype)

| File | Change |
|---|---|
| `services/iqube/experienceQube.ts` | `OperatorArchetype` union + `VALID_ARCHETYPES` set gain `'research'` |
| `services/standing/standingScore.ts` | `ARCHETYPE_DOMAINS` gains `research: ['publications','education','validation','recognition','professional']` — the declaration domains the research pathway most expresses. `ARCHETYPE_PATHWAYS` derives from this, so the per-pathway Standing lens picks the Researcher up automatically. |
| `components/metame/setup/ExperienceModelSetupWizard.tsx` | local `OperatorArchetype` type + `OPERATOR_ARCHETYPES` picker option (labelled **"Research & Discovery"**, inclusive of analysts/founders/students — see Naming below) + `ARCHETYPE_DEFAULT_TYPE` map (`research → personal`) |
| `supabase/migrations/20260716000000_experience_qubes_archetype_add_research.sql` | widens the `operator_archetype` CHECK constraint (prior migration enumerated only the four) to admit `'research'`. Idempotent: drops the existing constraint by lookup and re-adds the widened one. |

The persistence route (`app/api/assistant/experience-model/route.ts`) needed no change — it
casts to the `OperatorArchetype` type and the store validates against `VALID_ARCHETYPES`,
both now inclusive of `research`.

### Subscription / Founder Office entitlement — its OWN SKU (operator correction 2026-07-16)

The Research Copilot is a **separate unlock with a unique SKU**, sold on its own — **NOT**
bundled into the Sovereignty tier the way aigentZ's `aigentzLiteAccess` is. Operator decision:
its **own dedicated tier**, priced at the **same $29/mo stage** as Sovereignty.

| File | Change |
|---|---|
| `supabase/migrations/20260716010000_persona_plans_research_tier.sql` | new `research_tier` column on `persona_plans` (`'none'`/`'active'`, CHECK-constrained), coexisting with `plan_tier`/`venture_tier`/`standing_tier` (the same additive multi-column model). |
| `services/billing/personaPlan.ts` | new `PersonaPlan.researchCopilotAccess` flag, sourced ONLY from `research_tier === 'active'` — deliberately NOT derived from `sovereignAccess`/`aigentzLiteAccess`. Buying Sovereignty (aigentZ) does not grant it; buying it does not grant aigentZ. Added to the interface, `FREE_PLAN`, `resolve()`, and both `getPersonaPlan` selects. |
| `services/billing/planCheckout.ts` | new `research_copilot` entry in `TIER_CONFIG` (`planColumns: { research_tier: 'active' }`, label "Research Copilot (IRL)") + `CODE_LEVEL_TIER_PRICES.research_copilot = 2900` ($29). The tier-key-driven checkout route (`/api/billing/checkout`) sells it via Q¢ / PayPal / USDC with no route change. |
| `services/activations/activationPlanGate.ts` | `'researcher'` gate now `{ entitled: (p) => p.researchCopilotAccess, requiredTier: 'research_copilot' }` — its own flag + its own tier, no longer sharing aigentZ's. |
| `app/api/billing/plan/route.ts` | admin override sets `researchCopilotAccess: true` (admins get all copilots); the flag surfaces in the plan response automatically. |
| `data/activation-catalog.ts` | new `researcher` catalog entry (`gate: 'gated'`, `tabSlug: 'irl-research-copilot'`); longDescription now names the dedicated Research Copilot (IRL) tier ($29/mo, sold separately). Adds `'researcher'` to the `ActivationAction.specialist` union. |
| `components/metame/billing/PlanUpgradeModal.tsx` | added `research_copilot` to `PlanTierKey` + a contained single-tier render branch (`isResearch`): its own header, blurb, single tier card, and a research feature list — reusing all the shared rail / checkout / PayPal / USDC / Q¢ machinery unchanged. The FO comparison path is untouched. |
| `components/metame/billing/CitizenLadderModal.tsx` | the Research Copilot row now reads "Add-on" across all three citizen columns (it is a separate SKU, not a Sovereignty-bundled feature). |

Because checkout is tier-key-driven, the SKU is purchasable the moment the tier is in
`TIER_CONFIG` — `POST /api/billing/checkout { tierKey: 'research_copilot', rail }`. A non-entitled
persona clicking the gated Research Copilot activation routes (via `resolveActivationPlanGate` →
`requiredTier: 'research_copilot'`) to the single-tier purchase view.

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

### Research Copilot as a first-class aigentMe roster specialist (operator-confirmed 2026-07-16)

The developer copilot `aigent-z` is both a tab AND a first-class `SpecialistId` in the aigentMe
"pick a specialist" roster. For true parity the Research Copilot is now the same — a specialist
aigentMe can recommend and hand off to, gated by the `researcher` activation.

| File | Change |
|---|---|
| `app/data/personas.ts` | new `aigent-researcher` persona — the Research Copilot's system prompt. Frames it as the operator's interface into a **constitutional research environment** (invariant corpus, hypotheses, protocols, experiments, receipts, traceability, replication, standing), not a chatbot. Encodes the constitutional discipline: **narrate/propose, never ratify** (authoring is C2.1 proposal-only, a human ratifies); no fabricated invariants/receipts/citations; ground-and-cite; T0 discipline. Sells "better discovery," not "better answers." |
| `services/agents/specialistRouter.ts` | `SpecialistId` gains `'researcher'`; `SpecialistRequestType` gains `'research_brief'`; `SPECIALIST_PERSONA_KEY.researcher = 'aigent-researcher'`; `SPECIALIST_LABELS.researcher = 'Research Copilot'`; `inferRequestType` returns `'research_brief'`; a `researcher` branch in the template fallback (structural-vs-execution framing, design-before-data, ratification is a human step). |
| `services/orchestration/specialistRecommender.ts` | `researcher` added to `SPECIALIST_LABELS`, `SPECIALIST_DESCRIPTIONS`, `SPECIALIST_ACTIVATION_GATE` (`{ id: 'researcher', label: 'Research Copilot' }` — gated on the researcher activation), and `CARTRIDGE_PRIMARY_SPECIALIST` (`irl-cartridge` / `irl-os` / `researcher` → `researcher`). |
| `components/metame/welcome/layouts/SpecialistsLayout.tsx` | `researcher` quick-prompt templates ("What does the invariant substrate already say about…", "Frame a testable, pre-registered hypothesis for…", "What would falsify the claim that…"). |

The roster gate reuses the same `researcher` activation, so the specialist shows as
`needs-activation` until the Sovereignty tier is purchased — identical availability logic to
every other gated specialist. No exhaustiveness break: all five `Record<SpecialistId>` maps
were updated together.

---

## Why this shape

- **One entitlement resolver, not a parallel gate.** The researcher reuses
  `resolveActivationPlanGate` / `isPlanEntitled` — CLAUDE.md's Identity & Access Spine rule
  ("don't build parallel gates") applied to the subscription layer. It has its OWN entitlement
  flag (`researchCopilotAccess`), but resolves through the same gate machinery.
- **Its own SKU, same price stage.** Per the operator correction (2026-07-16), the Research
  Copilot is NOT bundled with aigentZ — it is the dedicated `research_copilot` tier at $29/mo
  (the same stage as Sovereignty), sold separately. Reused the tier-key-driven checkout so no
  new payment infra was built — a new `TIER_CONFIG` row + a `research_tier` column carry it.
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

## Operator decisions confirmed (2026-07-16)

1. **Its own unlock with a unique SKU, not bundled with aigentZ** — confirmed (this corrected an
   earlier read that it would ride Sovereignty). Built as the dedicated `research_copilot` tier,
   priced at the **same $29/mo stage** as Sovereignty but sold separately (own `research_tier`
   column + own `researchCopilotAccess` flag). Buying aigentZ/Sovereignty does not grant it.
2. **Research Copilot as a first-class roster specialist** — confirmed and built (see the roster
   section above).
3. **The research progression ladder** — confirmed ("yes build it"); chartered separately
   (Phase 22).

### Known limitation (single-row plan model)

`persona_plans` is one row per persona with one shared `current_period_end`. The `research_tier`
column coexists with `plan_tier`/`venture_tier`, but a persona holding Sovereignty AND the
Research Copilot shares one renewal date, and `tierKeyForPlanRow` (the renewal reverse-lookup)
still returns the primary citizen/venture tier. Independent per-SKU renewal would need a separate
add-on subscriptions table — flagged as a follow-on, consistent with the alpha renewal model.

## The Researcher as the fifth *value-creation* pathway (Aleatheon framing, recorded)

The addition completes a symmetry that had been emerging across the platform. The Founder Office
is organised around **modes of value creation** — and the first four are all *production*
pathways:

| # | Archetype | Value created |
|---|---|---|
| 1 | **Citizen** | civic value |
| 2 | **Entrepreneur** | economic value |
| 3 | **Developer** | technical value |
| 4 | **Creative** | cultural value |
| 5 | **Researcher** | **epistemic value** |

The Researcher is different in kind: it is a **knowledge-production** pathway, not another
production profession. Research is the mechanism by which the platform itself learns, improves,
and expands its understanding — so this pathway *complements* the other four rather than
competing with them. "Epistemic value" is what makes the addition feel foundational rather than
incremental.

**Product posture.** The Research Copilot is positioned not as "AI for research" but as a
**constitutional research environment**: the user interacts with hypotheses, protocols,
experiments, receipts, the invariant corpus, traceability, replication, and standing — not just
an LLM chat. The value proposition is **better discovery**, not "better answers." This is why the
`aigent-researcher` persona (above) is framed the way it is.

**Naming.** The pathway is labelled **"Research & Discovery"** in the setup wizard (broadened from
"Researcher") because the journey is not only for academics — financial analysts, policy analysts,
pharmaceutical researchers, systems engineers, founders doing customer discovery, and students are
all engaged in *structured discovery*. The archetype key stays `research`; the copilot stays
"Research Copilot". (Label choice is reversible — "Scientific Discovery" was the alternative.)

**Standing is earned, not bought.** Research is a near-perfect fit for "standing accrues through
action": standing comes from reproducing results, discovering invariants, improving protocols,
identifying flaws, and contributing evidence — never from paying. The subscription tier gates the
*tooling* (the Copilot); standing gates *recognition*.

### Roadmap — the research progression ladder (Aleatheon proposal, NOT built)

A constitutional research ladder was proposed, mirroring academia while staying native to the
model. Recorded here as roadmap; **not implemented in this phase** (it is a substantial future
build, not required for pathway/subscription alignment):

| Level | Role | Primary capability |
|---|---|---|
| Citizen Researcher | Consume, annotate, reproduce research | — |
| Research Analyst | Run experiments, analyse evidence | — |
| Research Associate | Contribute protocols and invariant proposals | — |
| Research Fellow | Lead investigations, mentor | — |
| Principal Investigator | Own research programmes | — |
| Institute Steward | Ratify findings, govern the corpus | — |
| Founder Operator | Shape the Institute itself | — |

This maps onto the existing subscription structure roughly as **Explorer (Free — read papers,
browse corpus)** → **Researcher (Sovereignty — Research Copilot, protocol authoring, personal
experiments)** → **Steward (advanced experiment design, evaluation tooling, replication,
collaboration)** → **Founder Office (Institute governance, canonical ratification, corpus
management, programme leadership)**. The tiers then align with *increasing responsibility* rather
than merely "more features." When chartered, this ladder gets its own CFS spec; the level names
above are the proposal, not yet canon.

## Open follow-ons (flagged, not built)

1. **Research progression ladder** — the seven-level ladder above. A future CFS charter + a
   standing-band → research-level mapping. Substantial; needs its own phase.
2. **Researcher write access** — `/api/research/objects` writes are admin-gated today; loosening
   to the `researcher` entitlement (so paid researchers can persist results) is a deferred,
   separate change with its own gate review.
3. **FounderOffice `VentureAgentConsumer`** — optionally add the Research Copilot as a blueprint
   hand-off target if researchers should be a venture delegation destination. Not required for the
   pathway/subscription alignment; not among the confirmed asks.
