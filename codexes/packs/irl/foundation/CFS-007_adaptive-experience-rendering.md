# CFS-007 — Adaptive Experience Rendering

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

Renderer abstraction and adapters. Law VI: **Separate Architecture from Rendering.**

---

## 1. The stack

```
Experience Architecture      (canonical: depth ladders, matrices, capsule contracts, invariants)
        ↓
Adaptive Rendering           (the renderer abstraction + adapters)
        ↓
Citizen Experience           (what the citizen actually sees, per context)
```

Experience should adapt while architecture remains invariant. Rendering is contextual; primitives are constitutional.

## 2. What exists (and why this spec is codification, not greenfield)

The architecture layer is real today: the depth ladder (`ExperienceDepth`: `pill → capsule → mini_runtime → codex`), the prescription engine (`app/api/experience/capsule` resolving `patronage_stage × pcs_stage` matrix cells), `experience_models`/`experience_matrices` tables, ExperienceQube (`services/iqube/experienceQube.ts`), and hard-won rendering contracts (capsule↔layout lockstep, R/T dots, containment).

The rendering layer is real but **unnamed**: it is distributed across codex tabs, `liquidTemplateRegistry`, runtime projection (`services/composer/runtimeProjectionService.ts`), and the CopilotKit runtime. What is missing is the seam — a named `ExperienceRenderer` interface that makes Law VI enforceable in review.

## 3. The renderer abstraction

```
ExperienceRenderer {
  id: string                                  // 'copilotkit' | 'liquid' | future
  capabilities(): RendererCapabilities        // which depths/surfaces it can render
  render(prescription: ExperiencePrescription,
         context: CitizenContext): RenderedExperience
}
```

- `ExperiencePrescription` — the architecture-side output (depth, matrix cell, capsule contract, invariant slice, NBE chips), renderer-agnostic
- `CitizenContext` — T1-safe identity surface + device/surface + journey state
- Adapters MUST NOT interpret architecture (no depth logic, no gating decisions in adapters) — they translate prescriptions into surface-specific output. Access is resolved upstream by the spine; renderers render.

## 4. Adapters

| Adapter | Status | Notes |
|---|---|---|
| **CopilotKit** | exists — retrofit | `@copilotkit/*` 1.50; server-side runtime (`app/api/copilotkit/`), backend actions (`app/(shell)/copilot/actions/`), AGUI provider. Becomes adapter #1 by wrapping, not rewriting |
| **Liquid templates** | exists — retrofit | `liquidTemplateRegistry` + `CartridgeRuntimeTemplate` becomes adapter #2 |
| **Differ** | future | slot reserved; thin-client render-diff protocol |
| **Future renderers** | open | metaMe client protocol thin-clients (Lovable etc.) implement the same prescription contract line-for-line (the R/T dot primitive already establishes this discipline) |

## 5. Invariant-aware rendering

The renderer consumes the experience-namespace ontology: progressive disclosure invariants (*Agency increases through progressive disclosure*) govern how much of a prescription renders at a given journey stage; the depth ladder ascends one step at a time because that is a canonical invariant, not a UI preference. Rendering decisions thus become explainable the same way dispositions are: cite the invariant.

## 6. Current substrate index

`types/orchestration.ts` (`ExperienceDepth`, NBE chip contracts), `app/api/experience/capsule/route.ts`, `experience_models`/`experience_matrices` (migration `20260402000000`), `services/iqube/experienceQube.ts`, `app/api/copilotkit/`, `docs/COPILOTKIT.md`, `liquidTemplates/`, `services/composer/runtimeProjection*.ts`, capsule/layout contract (`CLAUDE.md` + `2026-05-28_aigentme-capsule-layout-contract.md`).
