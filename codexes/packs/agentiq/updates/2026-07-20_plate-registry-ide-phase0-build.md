# Canonical Plate Registry + IDE Phase 0 — Build Record

**Date:** 2026-07-20 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Migrations:** both run by operator (confirmed in-session)

Two constitutional builds landed in the same session arc, both extension-only:

## 1. Publication split + Canonical Plate Registry (operator + Aletheon design)

- **Internal IRL = laboratory; IRL OS = publishing layer.** `Records & Findings` disabled in the public IRL OS edition (`irl-os-records`, `enabled: false`) — the development record is lab material. IRL OS publishes Reports + Canonical Plates only.
- **Plates became a registry of constitutional objects** (extends CFS-027, never forks): the seven v1 plates stay code-resident as the immutable ratified seed canon; composed plates (CP-008+) persist in `canonical_plate_registry` and move **draft → candidate → ratified (canonise) → published** — canonisation is the constitutional act, publishing merely exposes. Public reads are `published`-only, server-enforced.
- **Compose Plate** (not "upload"): validate (message + ≥1 constitutional ref + structure required; deps must be registered plates) → compose as draft → lifecycle acts, every act receipted. The machine representation (`structure`/plate.json) IS the plate — `CanonicalPlateFigure` renders it live; SVG/PNG/PDF are renderings, uploadable to storage (`/api/constitutional/canonical-plates/asset`, `content-media` bucket) or referenced by URL. `knowledge_qube_ref` slot reserved for plate↔KnowledgeQube binding.
- Files: `services/artifact/canonicalPlateRegistry.ts`, `/api/constitutional/canonical-plates` (+`/asset`), `CanonicalPlatesTab` (registry + composer), migration `20260802000000`.

## 2. CFS-048 IDE Phase 0 — constitutional discovery arm, Financial Services

Charter: `2026-07-20_cfs-048-invariant-discovery-engine-charter.md` (doctrine `inv.reasoning.334–339` canonical). Phase 0 built on operator ratification:

- **Orchestration over existing primitives** — composes `callSovereign` (invariant-aware inference) for extraction/compression and `discoverInvariant()` for promotion; never re-implements the lifecycle.
- `discovery_evidence` (Stage 1) + `discovery_candidates` (Stages 2–3), migration `20260803000000`; T2-safe committer commitments; RLS service-role only.
- **Discipline enforced in code + canary** (`tests/invariant-discovery.test.ts`): promotion lands at `proposed` on the `agent_verified` confidence rung — the service contains no canonisation path and never calls `validateInvariant`/`canonizeInvariant` (inv.reasoning.337). Every candidate carries evidence provenance (335).
- **Discovery workspace** in the internal IRL lab (admin-only): Evidence Explorer (paste regulatory/compliance text with source kind + ref) → *Discover candidates* → Candidate Explorer with Promote→proposed / Reject.
- Files: `services/invariants/discoveryEngine.ts`, `/api/invariants/discovery`, `InvariantDiscoveryTab`, lab Discovery section.

## First-run guide (operator)

1. IRL lab → **Discovery → Invariant Discovery**.
2. Add 3–6 evidence items — paste real regulatory text (e.g. FATF Recommendations excerpts, Basel Core Principles, AML/KYC/CDD guidance, PSD2/travel-rule provisions), one artefact per item with its source ref.
3. **Discover candidates** — one sovereign-routed pass compresses recurring normative structure into 3–8 candidates with evidence citations.
4. Review → **Promote** the good ones (land as `proposed` in the registry, tagged `financial-services` context) → they become IRE-resolvable for the FS field and enter the validation queue for the experiment harness.

## Open (per charter, ratify-before-next)

- Phase 1: corpus-scale synthesis (`mergeInvariants`) + validation queue UI · Phase 2: structural arm (`perception.ts` over FS transaction data) · Phase 3: experiential arm (synthetic expert ensembles) · Phase 4: runtime-evidence loop, domain-agnostic.
- Efficacy remains a `proposed` hypothesis until the FS experiments measure downstream IRE lift.
