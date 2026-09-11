# PRD-MMC-IMPL-006 — myResearch: the fifth myCluster tab (SPEC-MMC-001 §5)

**Status:** DESIGN → build-in-progress this pass
**Author:** Claude Code, 2026-07-24
**Companion to:** SPEC-MMC-001 (Constitutional Flow) §0.1 + §5, PRD-MMC-001 (umbrella), CFS-019 (metaMe IRL charter), `data/codex-configs.ts` (myCluster tab registry)

---

## 0. Reconciliation (discover before draft)

SPEC-MMC-001 §0.1 already names this precisely: four of Aletheon's five myCluster areas ship
today (`myCanvas`, `myWorkspace`, `myCartridge`, `myLedger` — all registered `group: 'mycluster'`
in `data/codex-configs.ts`, all plain activation-gated, no per-tab admin flag). **`myResearch` is
the one genuinely missing tab.** §0.1 also names where its underlying data already lives:
`research_objects`, `services/research/*`, `/api/research/*`, CFS-019 — "what's missing is the
myCluster-tab presentation of it." This document reconciles what that data actually is before
scoping the tab, because it turns out to be a bigger reconciliation than the one-line pointer
suggests.

### 0.1 CFS-019 is not a myCluster-shaped spec — it's the metaMe IRL institution's charter

CFS-019 (`codexes/packs/irl/foundation/CFS-019_irl-charter.md`) is the full charter for **metaMe
IRL** (the Invariant Research Laboratory) — the platform's own scientific research institution,
not a per-persona feature. It already has a shipped, admin-gated cartridge (`IRL_CARTRIDGE`, slug
`ccrl-cartridge`; public edition `irl-os`) with its own Dashboard, Research-by-layer, Experiment
Laboratory, Living Knowledge, Publications, Consequence Engineering, and Observability tabs (CFS-019
§5, Phases A–D **DELIVERED**). The object model (`research_objects`, `types/research.ts`) is a
**single shared lab record** — not per-persona data. Its own migration comment says so explicitly:

> "Trust model: ... RLS enabled with no policies: service-role access only (all reads/writes flow
> through the spine-gated, admin-only API route)" — `supabase/migrations/20260707100000_research_objects.sql`

And CFS-019's own ratification record is blunter still: *"single-operator, admin-gated model for
now — any admin persona reads and writes the one shared lab record (no per-persona ownership...)"*.

**This matters because myCluster's other four tabs are the opposite shape.** `myWorkspace`,
`myCanvas`, `myCartridge`, `myLedger` are each **that persona's own** private state — not shared,
not admin-gated. A naive fifth tab that just re-hosted the IRL cartridge's admin routes inside
myCluster would either (a) silently 403 for every non-admin persona who has myCluster access
(activation-gated, auto-granted — most personas), or (b) if built loosely enough to skip the
existing admin gate, leak the single shared lab record to every persona, which is a different
kind of container-mismatch than SPEC-MMC-001 was written to warn about but the same underlying
principle: don't build a parallel access path around an existing gate (CLAUDE.md, Security —
Access Gates, PARAMOUNT).

### 0.2 The one route that is NOT admin-gated

Read every route under `app/api/research/`:

| Route | Method(s) | Gate |
|---|---|---|
| `/api/research/overview` | GET | **`getActivePersona` only — no `isAdmin` check** |
| `/api/research/objects` | GET, POST | `isAdmin` |
| `/api/research/lifecycle` | POST | `isAdmin` |
| `/api/research/run-lifecycle` | POST | `isAdmin` |
| `/api/research/readiness/[id]` | GET | `isAdmin` |
| `/api/research/package/[id]` | GET | `isAdmin` |
| `/api/research/report/publish` | POST | `isAdmin` |
| `/api/research/report/regenerate` | POST | `isAdmin` |
| `/api/research/invariant-field` | GET, POST | `getActivePersona` (GET); admin path for mutation |

`/api/research/overview`'s own header comment confirms the intent: *"Persona-gated (T2-safe
content only)... the SAME builder [`buildResearchOverview`] the public IRL OS route
`/api/public/irl/research-overview` calls."* This is the composition seam SPEC-MMC-001 §0.1 was
pointing at — a read surface already designed to be shown broadly (public, even), not a route
that needs a new gate built around it.

`IRLDashboardTab.tsx` (the reference component this data already renders) already knows how to
degrade honestly for non-admin viewers — its own header comment: *"programme status reads the
Chrysalis Test (admin-gated — degrades honestly when the caller isn't admin)"* — and it already
accepts a `publicMode` prop for the IRL OS public surface. The precedent for "same overview feed,
lighter rendering, no admin slice" already exists; myResearch does not need to invent it.

### 0.3 The scoping decision

**myResearch is a compact, read-only, non-admin myCluster mirror of the live research overview —
composing `/api/research/overview` exactly as `IRLDashboardTab` and the public IRL OS surface
already do, never a new backend route, never a parallel gate.** No propose/approve/publish
affordance ships in this tab — those already live in `IRLResearchCopilotTab` (admin-gated,
full IRL cartridge) and stay there. myResearch's job is quick, at-a-glance visibility from the
operator's personal myCluster spine — "what is the state of the research programme right now" —
not a second place to operate it.

This mirrors the same "compose the existing read route, no new backend, honest degradation over
invented mutation" discipline the prior four Movement plans (Capture/Act/Project + Organize) each
converged on independently this week.

### 0.4 What this explicitly does NOT do

- Does not add a `myResearch`-scoped write path. Editing/approving research objects stays admin-only,
  inside the IRL cartridge.
- Does not change `research_objects`, `services/research/*`, or any `/api/research/*` route.
- Does not attempt per-persona research state — the underlying data is genuinely one shared lab
  record (CFS-019's own honest limit); myResearch surfaces that shared state, it does not
  fragment it.
- Does not duplicate `IRLDashboardTab`'s heavy visual apparatus (`RepresentationProvider`,
  `BearingInstrument`, `CanonicalAssetRegistryPanel`) — those are the full-cartridge experience;
  myResearch is a compact card list sized for a myCluster sub-tab, fetching the same JSON.

---

## 1. What ships

**New file:** `app/triad/components/codex/tabs/MyResearchTab.tsx` — mirrors the `MyLedgerTab`/
`MyWorkspaceTab` shape: `{ personaId, isAdmin }` props, `personaFetch('/api/research/overview',
{ personaIdHint: personaId })`, renders:

- Layer maturity strip (I/II/III — static text from CFS-019 §2, same three rows `IRLDashboardTab`
  renders, no live computation needed for these).
- Live experiment list: id, family, lifecycle state (derived + persisted, same `OverviewEntry`
  shape `/api/research/overview` already returns), published-run count, latest run timestamp.
- A single honest line when `isAdmin` is false and the caller wants the deeper Experiment Lab /
  Publications surfaces: a plain-text pointer to the IRL cartridge (`ccrl-cartridge`/`irl-os`),
  not a broken link into an admin-gated tab. Mirrors `IRLResearchCopilotTab`'s existing "Run
  EXP-00X in the Experiment Lab" honest-pointer pattern (CFS-019 Phase C3) rather than inventing
  a new cross-cartridge nav affordance.
- Loading / error states matching the sibling tabs' `Loader2` + inline error text pattern.

**Registration:** one new entry in `data/codex-configs.ts`'s `group: 'mycluster'` block, same
shape as the four siblings (`activationId: 'mycanvas'`, `order: 4`, `type: 'static'`, `config:
{ component: 'MyResearchTab', props: {} }`, `metadata: { icon: 'FlaskConical', description:
'Live research programme state — experiments, lifecycle, recent findings', color: 'violet' }`).
No `adminOnly` flag — the tab itself is visible to every myCluster-activated persona, exactly
like its four siblings; what changes per-persona is the content's honest degradation for the
admin-only pointer line, not the tab's visibility.

**Canary:** `tests/companion-myresearch.test.ts` — structural source-grep in this session's
established style: confirms `MyResearchTab.tsx` only calls `personaFetch('/api/research/overview'
...)` (no new route, no reach into `services/research/*` internals), confirms the tab-config entry
matches the sibling shape (`group: 'mycluster'`, no `adminOnly`), confirms no write/POST call
appears anywhere in the file (read-only guarantee).

---

## 2. Ratification checklist

- [ ] Operator confirms myResearch as a **read-only, non-admin, compact mirror** of
      `/api/research/overview` — not a second place to operate the IRL lab, and not a per-persona
      research data model (§0.3).
- [ ] Operator confirms no new backend route is warranted for this pass — composing the existing
      persona-gated overview route is sufficient for "at-a-glance visibility" (§0.2).

---

*Authored docs-first, 2026-07-24. Reconciled against SPEC-MMC-001 §0.1/§5, CFS-019 (full charter
read end-to-end), all nine `app/api/research/*` routes (auth-gate audited per route),
`services/research/` directory listing, `supabase/migrations/20260707100000_research_objects.sql`,
`data/codex-configs.ts`'s `mycluster` group, and `IRLDashboardTab.tsx` / `MyLedgerTab.tsx` as the
component patterns mirrored. Builds nothing beyond this pass's stated scope; extends PRD-MMC-001 /
SPEC-MMC-001 rather than standing up a new umbrella document.*
