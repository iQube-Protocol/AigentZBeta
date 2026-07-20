# Findings Report — sequential + coherent composition (dogfooding EXP-002)

**Date:** 2026-07-20 · **Area:** IRL Research Laboratory → Outputs → Report
**Files:** `components/composer/ExperimentReportTab.tsx`, `services/research/reportComposition.ts`, `tests/report-composition.test.ts`

## Problem (operator)

The lab-generated Findings Report read as **incoherent**: it narrated EXP-001/002/003,
jumped to EXP-006, then dumped EXP-004 / IPV-001 / IRV-001 into a §10 "Additional
experiments" tail — **out of numeric order, and with EXP-005 missing entirely**. It was
"an appended document", not a coherent sequential report. The operator's instruction: use
the platform's own **coherence + sequencing invariants** (the ones EXP-002 validated) so the
generator produces one ordered, coherent document — the introduction a comprehensive
reflection of all experiments to date, the body sequenced by experiment.

This is a self-application: the report generator was itself committing the **sequencing
failure** EXP-002 studied ("sequence is scored, not validated"; composition obeys a
sequential narrative law + a global coherence field).

## Fix — compose along the canonical registry spine

Both composition paths now sequence off the pinned `EXPERIMENT_REGISTRY` + `SERIES_REGISTRY`
(`types/research.ts`) instead of hardcoded sections + an auto-tail.

**Live draft (`ExperimentReportTab.buildReport`) — deterministic:**
- **Sequential composition:** experiments emitted in canonical registry order, grouped under
  their series (FVS → PSE → IIVS → IV0 → …). No `§10` tail — every experiment sits in its
  canonical slot. Section numbers are computed dynamically (the count varies with the record).
- **Global coherence:** the introduction is a generated **programme map** of every series +
  its members' live status, from the same registry+record that drives the body — intro and
  body can no longer drift. The frozen "three orthogonal experiments" preamble is gone.
- **No silent gaps:** an experiment that is run-complete but unpublished (e.g. **EXP-005**)
  appears in its correct slot as *publication pending* rather than vanishing. EXP-005 now
  renders at §7, between EXP-004 (§6) and EXP-006 (§8).
- **No data loss:** a published run whose id is outside the registry is still shown, in
  sequence, under a labelled "Further experiments" block — the registry drives *order*, never
  suppression of real canonical evidence.
- Authored prose retained for EXP-001/002/003/006; EXP-004/005 given proper authored aims
  from their READMEs; instrument-validation runs (IRV/IPV) get a framed section from their
  registry hypothesis rather than a bare table dump.
- Title generalised to "The metaMe Invariant Research Lab — Findings Report" (matches the
  canonical scope title) since the report now spans several series, not just the FVS.

**Canonical regenerate (`composeCanonicalReport`) — LLM path:**
- `gatherFindings` now also returns an ordered `pending[]` (in-scope registry members with no
  runs) so the model can place them in sequence as *publication pending* without inventing
  results.
- `buildFindingsGrounding` declares the **canonical sequence must be preserved** and lists the
  pending members with an explicit "DO NOT invent" instruction.
- `REPORT_SYSTEM` gains an explicit **SEQUENCE** law: emit in canonical order grouped by
  series, no appended catch-all tail, place pending members in-slot, keep intro ≡ body.

## Verification

- Executed the `buildReport` composition logic against the operator's real published set
  (EXP-001/002/003/004/006 + IPV-001 + IRV-001, plus a synthetic orphan): numbering 1→N with
  no gaps, series in canonical order, EXP-005 at §7 between EXP-004 and EXP-006, orphan
  preserved under "Further experiments".
- `tests/report-composition.test.ts` extended with canaries for the pending-in-sequence
  behaviour and the "CANONICAL SEQUENCE / no appended tail" grounding contract.
- Type-check + full canary suite run in CI (node_modules is not provisioned in the session
  sandbox).

## Doctrine

The report is now composed under the same law it reports on: its section order is the
coherence maximum over the experiment set (EXP-002). The composition note in the report header
states this explicitly.
