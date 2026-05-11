# Aigent Me Phase 2.b — ExperienceModel UI (card, wizard, iQube disclosure)

**Date:** 2026-05-12
**Workstream:** metaMe Personal Assistant Alpha (Aigent Me) — Phase 2.b
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Predecessors:**
  - Phase 2 — ExperienceQube data layer + setup endpoint (commit fa3f06d)
  - PersonaSpine + parent contract (commits b220a1b, 3f7eb36)

---

## Why

Phase 2 shipped the data layer and API for the user's ExperienceQube, but the welcome surface still rendered the placeholder line "ExperienceModel: not yet set up. Setup flow lands in Phase 2." That promise needed cashing.

Phase 2.b delivers the three UI components that turn the welcome surface into a real chief-of-staff command space — with the iQube discipline visible at the top of every interaction.

---

## What landed

### Three new canonical card components

| File | Purpose |
|---|---|
| `components/metame/cards/ExperienceModelCard.tsx` | Renders the user's ExperienceQube state per PRD §9.2: experience name + type, primary goal, current stage, progress model, confidentiality, active cartridges, BlakQube counts (never values). Two states: invitation (when unconfigured) and configured. Accepts `onEdit` for the wizard trigger. |
| `components/metame/cards/IqubeContextDisclosure.tsx` | The "Using: PersonaQube, ExperienceQube · Not shared: confidential strategy notes / private investor data / unreleased IP unless approved" strip per PRD §9.2 (Brief Card → Required iQube display). Pure render — does not gate. Accepts `using: IqubeKind[]` so the calling surface declares what it actually consulted. |
| `components/metame/setup/ExperienceModelSetupWizard.tsx` | Three-step modal calling `POST /api/assistant/experience-model` via `personaFetch`. Step 1 = Project (name + type + primary goal); Step 2 = Scope (cartridges + stage); Step 3 = Privacy (confidentiality + progress model). On save, calls `onSaved` with the GET response shape so the parent re-renders without an extra fetch. |

### Welcome surface wiring

`app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` now:

- Fetches `/api/assistant/experience-model` in parallel with `/api/assistant/bootstrap` once the spine is ready
- Renders `<IqubeContextDisclosure>` directly under the header (always visible — declares what's in use)
- Renders `<ExperienceModelCard>` in place of the previous inline placeholder line
- Wires the `set-up-experience-model` CTA (and the card's "Set up" / "Edit" buttons) to open the wizard
- Pre-fills the wizard from the existing ExperienceQube on edit
- Accepts the wizard's saved record and updates state immediately (no refetch round-trip)

---

## Reuse-first audit (per CLAUDE.md golden rule)

| Existing primitive | Used? |
|---|---|
| `components/ui/dialog.tsx` (shadcn Dialog) | ✓ — wizard modal |
| `utils/personaSpine.tsx` (`personaFetch`) | ✓ — wizard's POST call |
| `app/api/assistant/experience-model` route (Phase 2) | ✓ — wizard endpoint |
| `services/iqube/experienceQube.ts` (Phase 2) | ✓ — server backing the route |
| `lucide-react` icons | ✓ — already a project dep |
| `app/triad/components/codex/TabRenderer.tsx` registry | ✓ — no change needed; the new components are rendered inside the existing `AigentMeWelcomeTab` |

No new dependencies. No new server routes. No protected files (CLAUDE.md identity-spine list) modified.

---

## Privacy held

- Wizard sends only the meta fields + a sanitised BlakQube patch. PersonaId is NEVER in the body — the route resolves it from the spine.
- `<ExperienceModelCard>` renders only counts of BlakQube items (e.g. "5 goals · 3 priority partners · confidential notes set"), never the values. The `GET /api/assistant/experience-model` route enforces this server-side.
- `<IqubeContextDisclosure>` makes iQube usage *visible* — surfaces declare what they consulted. This is the canonical tone-setter for every Aigent Me card going forward.
- Auth: `personaFetch()` attaches `Authorization: Bearer <supabase-jwt>` automatically. No hand-rolled auth in any component.

---

## Validation steps

After this lands on dev:

1. Navigate to **metaMe Cartridge → Aigent Me** tab.
2. **Unconfigured state:** the ExperienceModelCard shows "Not yet set up" with a "Set up" button. The IqubeContextDisclosure shows "Using: PersonaQube".
3. Click **Set up** (or the **Set up my ExperienceModel** primary CTA). The wizard opens at Step 1.
4. Fill Project (name + type + primary goal) → Next.
5. Adjust Scope (toggle cartridges + pick stage) → Next.
6. Choose Privacy (confidentiality + progress model) → Save.
7. The wizard closes; the card re-renders with the new state. The disclosure now shows "Using: PersonaQube, ExperienceQube".
8. Click **Edit** on the card → the wizard re-opens pre-filled with the saved values.

---

## What does NOT ship in Phase 2.b

Deferred:
- BlakQube value editing (strategic notes, IP, KPIs, partners, campaigns) — Phase 5 specialist routing surfaces edit these one slice at a time per the disclosure boundary.
- Curated experience-model picker (selecting from the global `experience_models` catalogue) — Phase 4 AVL flow uses this.
- Inline confirmation/undo after save — alpha keeps the toast surface minimal.
- Mobile layout polish — alpha defaults to the runtime's standard responsive shell.

---

## What's queued

- **PersonaSpine migration sweep #2-12** — start with `app/triad/components/codex/tabs/DevPersonaTab.tsx`, then `MetaMeRuntimeClient`, the four iqube drawers, `PersonaCreationForm`, `ComposerStudio`, `RuntimeCapsuleRemixEditor`, `personaService`, `PersonaQuickAddModal`. One PR per surface; each removes 15-30 lines of duplicated auth plumbing.
- **Phase 3** — Brief / Move-forward (wires the IntentQube service, adds the brief endpoint + Brief Card).

---

## Files

- `components/metame/cards/ExperienceModelCard.tsx` (new)
- `components/metame/cards/IqubeContextDisclosure.tsx` (new)
- `components/metame/setup/ExperienceModelSetupWizard.tsx` (new)
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (extended)
