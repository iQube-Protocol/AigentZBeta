# Aigent Me Phase 3 — Brief + Move-Forward (deterministic NBE)

**Date:** 2026-05-12
**Workstream:** metaMe Personal Assistant Alpha (Aigent Me) — Phase 3
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Predecessors:**
  - Phase 2.b — ExperienceModel UI (commit dcf3441)
  - PersonaSpine migration sweep batch A (commit 309ce9d)

---

## What landed

### Service layer

| File | Purpose |
|---|---|
| `services/orchestration/nbeCatalog.ts` | Static, weighted catalogue of Next-Best-Experience candidates per cartridge + stage. 11 entries across metame / knyt / qriptopian / marketa / avl. Includes `selectNbeCandidates()` (deterministic ranked selection) and `selectTopNbeForCartridge()` (single-pick for move-forward). |
| `services/orchestration/briefBuilder.ts` | Pure brief generator. `buildBrief({ briefType, scopedCartridge })` returns a `BriefShape` (context + topPriorities + nextBestActions + iQube usage disclosure). `buildMoveForward({ cartridge })` returns a `MoveForwardShape` (1 hero + 2 alternates). Reads ExperienceQube via the canonical service; never touches BlakQube values. |

### API endpoints

| File | Purpose |
|---|---|
| `app/api/assistant/brief/route.ts` | `POST` returning a `BriefShape`. Body is optional; defaults to `{ briefType: 'daily' }`. Persona resolved from the spine; never read from body. |
| `app/api/assistant/move-forward/route.ts` | `POST { cartridge }` returning a `MoveForwardShape`. Validates cartridge against the canonical slug list. |

### UI components

| File | Purpose |
|---|---|
| `components/metame/cards/NextBestActionCard.tsx` | Per PRD §9.2 — recommended action, rationale, source cartridge, effort, impact, approval flag, suggested artifact, specialist hint. Two variants: `compact` (stacked) and `hero` (single big action for move-forward). Emits `onAct` callback; Phase 6 wires execution. |
| `components/metame/cards/BriefCard.tsx` | Per PRD §9.2 — wraps the BriefShape: header (experience + stage + pending approvals), iQube disclosure (composes `IqubeContextDisclosure`), top priorities, next best actions (composes `NextBestActionCard`). |

### Welcome surface wiring

`app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx`:

- "Brief me" CTA → POSTs `/api/assistant/brief`, renders `<BriefCard>` inline below the CTA grid.
- "Move this forward" CTA → toggles a cartridge picker; clicking a cartridge POSTs `/api/assistant/move-forward` and renders the hero NBE + alternates.
- Bootstrap CTAs `brief-me` and `move-this-forward` flipped from `preview` → `available`.

---

## Design choice — deterministic in alpha

Phase 3 ships **deterministic** brief generation. The NBE catalogue is a static, weighted list. The selection logic is a pure function of `(activeCartridges, currentStage, scopedCartridge)`. Phase 3.b will layer LLM enrichment on top — selection logic stays in `briefBuilder`, prose enrichment lands in a separate path.

Why deterministic first:

1. **Testable.** Pure inputs → pure outputs; no LLM variance.
2. **Reviewable.** The operator can audit which actions surface for which stage.
3. **Predictable for the alpha demo.** PRD §16 minimum demo success requires "Aigent Me recommends moving KNYT Wheel forward" — deterministic guarantees that copy ships.
4. **No new dependencies.** Reuses the existing iQube + persona infrastructure.

---

## Reuse-first audit

| Existing primitive | Used? |
|---|---|
| `services/iqube/experienceQube.ts` (Phase 2) | ✓ — sole reader for ExperienceQube state |
| `services/identity/getActivePersona.ts` | ✓ — sole personaId source |
| `IqubeContextDisclosure` (Phase 2.b) | ✓ — composed inside BriefCard |
| `personaFetch` (PersonaSpine) | ✓ — both client fetches use it |
| `NextBestActionCard` | composed inside BriefCard + welcome surface — single source for NBE rendering |
| `app/api/assistant/bootstrap/route.ts` | ✓ — only the CTA enabled flags changed |

No new server resolver. No new tables. No protected files modified. Phase 1's `assistant_sessions` migration remains unused in this phase (will be wired in Phase 6 when actions are executed and persisted).

---

## Privacy held

- BriefShape and MoveForwardShape contain only meta-slice fields from ExperienceQube (`primaryGoal`, `currentStage`, `experienceName`, `activeCartridges`).
- BlakQube values are never serialised to the client.
- iQube disclosure surfaces what was consulted: `PersonaQube` + `ExperienceQube` (when configured) + `IntentQube` (declared since action paths exist).
- T0 identifiers never appear on the wire. `personaFetch` attaches Bearer; the spine resolves identity server-side.

---

## What does NOT ship in Phase 3

Deferred:
- **LLM-enriched prose** for action labels and rationale → Phase 3.b. Hooks into `services/metame/agentLlmOrchestra.ts`.
- **Workspace inclusion in briefs** (Gmail/Calendar/Drive context) → Phase 6 (after the Google Workspace connectors land per locked decision Q3).
- **Specialist routing on `onAct`** (clicking "Act" actually invokes Marketa / Quill / Kn0w1) → Phase 5.
- **Receipt persistence** — every brief request will create an `assistant_sessions` row + `orchestration_event` once Phase 6 wires the receipt pipeline.

---

## Validation

After this lands on dev:

1. Open the metaMe cartridge → Aigent Me tab.
2. Click **Brief me** → a Brief Card renders below the CTA grid with 3-5 NextBestActionCards.
   - At `stage: alpha_activation`, the KNYT Zero investor update action should appear at the top with `weight: 90`.
   - At `stage: setup` (no ExperienceQube yet), only the metaMe-side actions surface.
3. Click **Move this forward** → cartridge picker opens. Click any cartridge → hero NBE + 2 alternates render.
4. Each NextBestActionCard shows effort, impact, approval flag, and a specialist hint where relevant.
5. The iQube disclosure inside BriefCard reads "Using: PersonaQube, ExperienceQube, IntentQube" and lists the not-shared categories.

Verify the persona spine still works: switch persona via the existing switcher → both the Brief and Move-Forward state should clear (singleton invalidation re-fetches).

---

## What's queued

- **Phase 3.b** — LLM-enriched prose + workspace inclusion proposal
- **Phase 4** — AVL Venture Progress Card + endpoint
- **Phase 5** — Specialist routing (Marketa / Quill / Kn0w1) — `onAct` callback wires through
- **Phase 6** — Artifact creation + Approval Card + receipt pipeline
- **Phase 7** — Receipts UI + history
- **PersonaSpine migration sweep** — 4 deferred files (MetaMeRuntimeClient, ComposerStudio, RuntimeCapsuleRemixEditor, personaService)

---

## Files

- `services/orchestration/nbeCatalog.ts` (new)
- `services/orchestration/briefBuilder.ts` (new)
- `app/api/assistant/brief/route.ts` (new)
- `app/api/assistant/move-forward/route.ts` (new)
- `components/metame/cards/NextBestActionCard.tsx` (new)
- `components/metame/cards/BriefCard.tsx` (new)
- `app/api/assistant/bootstrap/route.ts` (CTA flags flipped)
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (extended)
