# Aigent Me Phase 4 — Venture Progress (AgentiQ Venture Lab read-window)

**Date:** 2026-05-12
**Workstream:** metaMe Personal Assistant Alpha (Aigent Me) — Phase 4
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Predecessors:**
- Phase 3 — Brief + Move-Forward (commit 2c57748)
- Phase 3.5 — Executable NBE cards (commit d168de7)

---

## What landed

Aigent Me's read-only window into AgentiQ Venture Lab. Per PRD §8 Golden Path 4 + §9.2 (Venture Progress Card render contract).

### Service layer

| File | Purpose |
|---|---|
| `services/iqube/intentQube.ts` (+) | New `listRecentIntentsForPersona(personaId, { limit, cartridge })` — filters `nbe_plans` on the IntentQube sentinel so only Aigent Me intents come back. |
| `services/orchestration/ventureProgressBuilder.ts` (new) | Pure `buildVentureProgress({ personaId, cartridge?, recentLimit? })`. Composes ExperienceQube + recent IntentQubes + AVL-tier NBEs from the catalogue. Returns a structured `VentureProgressShape`. |

### API

| Route | Behaviour |
|---|---|
| `POST /api/assistant/venture-progress` | Body optional. Persona from spine. Returns the VentureProgressShape with iQube disclosure. Validates `cartridge` + `recentLimit` (cap 20). |

### UI

| File | Purpose |
|---|---|
| `components/metame/cards/VentureProgressCard.tsx` (new) | PRD §9.2 — header (venture + stage + blockers), iQube disclosure, 4-cell stat grid (KPIs, operational goals, commercial goals, confidential notes flag), linked cartridges, recent activity list, recommended actions (composes `NextBestActionCard`), suggested artifacts, footer. |
| `AigentMeWelcomeTab.tsx` (extended) | `review-venture-progress` CTA flipped `preview → available`. New state + fetcher + render below the BriefCard, above Move-Forward. Recommended actions in the card are Act-wired into the same approval pipeline as Brief / Move-Forward NBEs. |
| `app/api/assistant/bootstrap/route.ts` (extended) | CTA flag flip for `review-venture-progress`. |

---

## Privacy contract

- BlakQube fields surface as **counts only** (PRD §7.2 alpha rule):
  `activeKpisCount`, `operationalGoalsCount`, `commercialGoalsCount`,
  `hasFranchiseProposition` (boolean), `hasConfidentialNotes` (boolean). Values never on the wire.
- Recent IntentQube activity surfaces only public fields
  (`intentId`, `intentName`, `cartridge`, `status`, `createdAt`). No rationale text.
- `personaId` resolved server-side; never read from the request body.
- iQube usage disclosure (`Using: PersonaQube, ExperienceQube, IntentQube`) renders inside the card.
- T0 identifiers untouched.

---

## Reuse-first audit

| Existing primitive | Used? |
|---|---|
| `services/iqube/experienceQube.ts` (Phase 2) | ✓ — sole reader for ExperienceQube state |
| `services/iqube/intentQube.ts` (Phase 2 + new `listRecent…`) | ✓ — recent activity comes from this |
| `services/orchestration/nbeCatalog.ts` (Phase 3) | ✓ — AVL-tier candidates + mixed actions |
| `services/orchestration/briefBuilder.ts::BriefNextBestAction` (Phase 3) | ✓ — shared NBE action shape, no duplicate typing |
| `services/identity/getActivePersona.ts` | ✓ — sole personaId source at the route |
| `IqubeContextDisclosure` (Phase 2.b) | ✓ — composed inside VentureProgressCard |
| `NextBestActionCard` (Phase 3) | ✓ — composed inside VentureProgressCard |
| `ApprovalCard` + `/api/assistant/intent` (Phase 3.5) | ✓ — Act-on-NBE flow re-used in VentureProgressCard |

No new server resolver. No new table. No protected files (CLAUDE.md identity-spine list) modified.

---

## Behaviour after this lands on dev

1. Click **Review venture progress** in the primary CTA grid.
2. VentureProgressCard renders below the Brief Card (or below the welcome header if Brief hasn't been opened yet).
3. The card shows:
   - Venture name + primary goal + stage chip
   - iQube disclosure strip
   - Four state stats (KPIs / op goals / commercial goals / confidential notes)
   - Linked cartridges
   - Recent activity (queued IntentQubes; empty list with copy if none yet)
   - Recommended moves (AVL-tier candidates first, then cross-cartridge filler) with **Act** buttons
   - Suggested artifacts (e.g. `venture-report`, `calendar-block`)
4. Acting on any recommended move goes through the same Phase 3.5 approval pipeline — ApprovalCard appears at the top, Approve creates an IntentQube, queued state stacks.

---

## What's queued (deferred to Phase 6)

- **Real KPI values + charts.** Phase 4 surfaces counts. Phase 4.b (alongside Phase 6 receipts) will render actual KPI movement once the BlakQube encryption flow is wired and the operator opts in per-KPI.
- **Real blockers.** `blockersCount` is `0` today. Phase 6 wires it from the pending-approval queue (intents with `status: 'awaiting_approval'`).
- **AVL canon view.** The card is Aigent Me's window into AVL; the full AVL cartridge tab remains the operator's authoring surface.

---

## Validation

1. After dev rebuilds, click **Review venture progress** → card renders within ~500ms.
2. With an ExperienceQube configured (Phase 2 wizard completed), header shows the experience name + primary goal + stage.
3. Stat grid populates from BlakQube counts. With an empty BlakQube, all counts read `0`. Set strategic notes via the wizard to flip the "Confidential notes" cell to "Set".
4. If you've approved at least one NBE via Phase 3.5, it appears under **Recent activity**.
5. Each recommended move's **Act** button opens the ApprovalCard at the top of the welcome surface — same flow as Brief / Move-Forward.

---

## Files

- `services/iqube/intentQube.ts` (extended)
- `services/orchestration/ventureProgressBuilder.ts` (new)
- `app/api/assistant/venture-progress/route.ts` (new)
- `components/metame/cards/VentureProgressCard.tsx` (new)
- `app/api/assistant/bootstrap/route.ts` (CTA flag flip)
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (extended)
