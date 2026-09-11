# Founder Office + VentureQube v1.0 — venture formation OS

**Date:** 2026-06-21
**Surface:** Venture Lab cartridge (`venture-lab`) + Polity Core (WIP spec)
**Branch:** `claude/optimistic-davinci-exiykx`

## What shipped

The venture-formation operating system behind the metaMe commercial spine
(`Passport → aigentMe Delegation → Standing → Founder Office → Venture Lab →
[verticals: Mobility (HMS), metaKnyt / metaMedia / metaLegal]`). aigentMe helps
the citizen establish Standing; HMS and metaKnyt/metaMedia/metaLegal are Venture
Lab venture-building verticals, not peer rails. Founder Office turns an
idea/opportunity into an executable
**Venture Blueprint** = **VentureQube v1.0**, the per-venture formation
primitive.

### VentureQube primitive (extend, don't duplicate)
- `types/ventureQube.ts` — added `venture-iqube/v1.0`: the canonical 13-layer
  per-venture object (Identity, Thesis, Intent, Signal Evidence, Customer
  Archetype, Revenue Architecture, Commercial Operating Model, Capability,
  Resource, Execution, Delegation, Outcome, Governance, Institutional) +
  `emptyVentureQubeV1()`. v0.1–v0.4 (the operator-portfolio wrapper wired into
  the aigentMe experience-model onboarding) is retained unchanged — a wrapper
  venture graduates into a v1.0 VentureQube.
- `services/iqube/ventureQubeSchema.ts` — added `ventureQubeV1Schema` +
  `parseVentureQubeV1` (separate parse path from v0.4).
- `supabase/migrations/20260621000000_venture_qubes.sql` — `venture_qubes`
  table (T0 `owner_persona_id`, layered JSON, stage CHECK, RLS service-role).
- `services/venture/registerVentureIqube.ts` — registers each VentureQube in the
  iQube registry SoT as a **ClusterQube** (`iqube_id_map.primitive_type='ClusterQube'`),
  T2-safe commitments only (mirrors `registerPersonaIqube`).

### Standing → VentureQube bridge + metaCommons seam
- `services/venture/standingForVenture.ts` — reads the LIVE Standing substrate
  (`crm_persona_reputation` standing_* + 5-axis vector; VSP `vsp_facts` by
  domain) to auto-populate the Signal Evidence + Capability layers. Soft-fails
  if a Standing migration is pending.
- `services/venture/metacommonsSignals.ts` — deterministic stub for the
  metaCommons evaluation; **Standing calibrates confidence, never gates**.
  Replaceable when the metaCommons engine lands (engine is constitutional-only
  today per the metaCommons Charter).
- `services/venture/ventureQubeService.ts` — CRUD + the 3 Founder Office paths
  (Discover / Validate / Architect) + autopopulate orchestration.
- `services/venture/blueprintHandoff.ts` — Venture Blueprint → handoff payloads
  for aigentMe / DevOn / Marketa / Venture Lab / Investor Office, with a
  DVN-anchored `venture_blueprint_handoff` receipt (added to
  `ANCHORABLE_ACTION_TYPES` — the one permitted unilateral DVN change).

### API + surface
- `app/api/venture/qubes` (GET/POST), `…/[ventureId]` (GET/PATCH),
  `…/[ventureId]/autopopulate` (POST), `…/[ventureId]/handoff` (POST),
  `app/api/venture/standing-summary` (GET).
- `FounderOfficeTab.tsx` — first-class **Founder Office** tab in the Venture Lab
  cartridge (`VENTURE_LAB_CODEX`), internal sub-views: Workspace · Discover ·
  Validate · Architect · Blueprint. Registered in `TabRenderer.tsx`.

### Polity Core (WIP spec)
- `VENTUREQUBE_SPEC.md` + `ventureqube-spec.v1.json` (status `draft_wip`,
  `constitutionalStatus: stubbed_pending_canonization`) + `getVentureQubeSpec()`
  + collection + tab + a Drafts/WIP row in Amendment Records. NOT ratified, NOT
  in the Agent Passport binding triple, NOT published to Autodrive yet.

## Commercial context (operator screenshots, 2026-06-21)

This build is the engine under the **metaMe Sovereign Agency Economy** monetization
model. The commercial spine `Passport → Standing → aigentMe → Founder Office →
Venture Lab → Mobility → metaKnyt` maps to: Passport = acquisition engine (free),
Standing = qualification engine, Founder Office = monetization engine, Venture
Lab/Mobility/metaKnyt = expansion. Founder Operators are the highest-value near-term
segment (Founder Office Basic $99 / Professional $299 / Elite $999+). The $100K MRR
model needs ~4,000 Passport holders at a 3% Founder Office conversion (~120 clients).
metaMe is itself the reference venture; the Venture Blueprint model codifies this so
other ventures can run the same play. See the follow-up analysis doc for gaps +
optimal path.

## Operator actions
- Apply migration `20260621000000_venture_qubes.sql` in Supabase.
- (Later) once the engine is validated, lock the VentureQube spec, publish to
  Autodrive, and promote it from WIP to ratified in Amendment Records.
