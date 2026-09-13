# Threshold 007 — myClaw/myBot Citation Corrected (Resolved at Doctrine Level)

**Date:** 2026-09-12
**File:** `docs/qriptopian/thresholds/007-research-edition.md`

## Correction

The prior citation pass (this session) marked `myClaw`/`myBot` (§17's three-function companion
architecture, alongside `myGuard`) as **Unresolved** — searched by exact and case-insensitive match
across the repository, found only inside the Threshold 007 essay text itself.

The operator identified the gap: this three-function anatomy is the subject of a dedicated, already
published essay — **Threshold 001, "myGuard, myClaw, myBot: Why Every Representative Needs a
Passport"** — which the original search missed because it checked only application code
(`services/`, `governance/`) rather than the published essay corpus.

## Verification performed

- Fetched the essay via the Threshold MCP (`cartridge: qriptopian`, `id: myguard-myclaw-mybot`).
  Confirmed it defines exactly this anatomy: *"myGuard protects... myClaw acts. It reaches into
  systems and services to execute authorised actions... myBot helps. It researches, creates, organises
  and assists."*
- Queried the Supabase `content` row directly to confirm series metadata: `ai_metadata.seriesNumber:
  "1"`, `ai_metadata.series: "Thresholds"`, content id `06ce7a35-a158-4bae-bb9c-73704241612b`,
  published 2026-08-17. This confirms the operator's claim that this is Threshold 001.
- Located a second, independent doctrine artifact elaborating myBot specifically:
  `codexes/packs/polity-core/items/experience-sovereignty/Experience Sovereignty.txt`, which
  describes myBot as "a roadmap feature for advanced Runtime users: a configurable, cloneable,
  consumer-grade helper... the bridge between consuming sovereign experiences and composing them"
  (this file also introduces a fourth helper, myAnima, which is not part of Threshold 007's own
  three-function architecture and was not added as a citation for that reason).

## What changed in the research edition

- II007-IA25 changed from Unresolved to **Doctrine (Ratified essay + elaborated specification)**,
  citing both artifacts above.
- The "two entries remain unresolved" framing corrected to just DevOn (II007-IA14) and Aegis Crucible
  (II007-IA20) — the `unresolvedReferences` JSON block now lists two items, not three.
- Added an explicit, honestly-scoped note that no dedicated code module implements `myClaw`/`myBot`
  as named constructs as of this pass — the correction is about the citation (doctrine exists), not a
  claim that shipped software now exists.

## Outstanding — the uploaded scope document could not be read

The operator also supplied `AB___myBot_Scope.docx`, describing myBot's provenance as dating to a
legacy personal data-ownership application from approximately 2013. The uploaded file arrived as
469,398 bytes of all-zero content — corrupted or failed in transit — and could not be opened. This
provenance claim is recorded in the research edition as **operator-stated, not independently
verified**, per the repository's No-Guessing rule. Re-upload requested; if it succeeds, add as a
further resolved anchor for myBot's pre-2026 lineage.

## Still outstanding from prior passes

- Supabase `content` row for the essay itself (not this scope doc) still not re-synced with any of
  today's Threshold 007 research-edition corrections.
- Independent ARR still unperformed.
