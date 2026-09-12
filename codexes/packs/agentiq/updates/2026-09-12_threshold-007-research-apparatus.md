# Threshold 007 Research Apparatus — Citation Resolution Pass (2026-09-12)

## What this is

A staged draft of **Threshold 007 — Research Edition: Invariant Intelligence** plus a
`researchApparatus` machine-readable companion, built per an operator/coordinator-specified
citation-integrity apparatus (Sources & References / Implementation Anchors / Argument-to-Evidence
Graph / Experiment Registry). This is a **staging pass**, not a publication: the Research Edition
was NOT deposited into the Supabase `content` table that `app/api/codex/qripto/essays/[slug]/machine/route.ts`
serves, no `.amplify-deploy` trigger was touched, and nothing was pushed to a deploy-triggering
branch. The operator/coordinator asked to review citations before this goes further.

## Files

- `docs/qriptopian/thresholds/007-research-edition.md` — the full essay (operator's verbatim
  prose preserved section-by-section; only the anchor/reference blocks were edited to record
  resolution status; the "Publication Ingestion Note for Claude Code" section was stripped per its
  own instruction).
- `docs/qriptopian/thresholds/007-research-apparatus.json` — the machine-readable
  `researchApparatus` object, designed to extend `ai_metadata` on the eventual Supabase `content`
  row without altering the existing `qriptopian.threshold-essay.v1` contract.

## Verification basis

All resolved implementation anchors were verified present as real files at commit
`ab946f906d6af629427ac361de4d82aa13fb8b52` on `iQube-Protocol/AigentZBeta` (this session did not
create any new commits before capturing that SHA). Evidence vocabulary (`Ratified / Implemented /
Operational / Demonstrated / Entering deployment / Experimental / Projected / Not found /
Contradicted`) was reused verbatim from the existing
`codexes/packs/polity-core/items/commentary/constitutional-internet/02-source-and-evidence-matrix.json`
apparatus rather than inventing a second vocabulary.

## Honest gaps (do not resolve by inference)

- **EXP-P1 framing mismatch** — the repo's registered EXP-P1
  (`codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md`)
  states its own scope narrower than, and differently from, the draft's summary of it; its own text
  says it does not test the "invariant substrate vs raw experience" question the draft's framing
  implies.
- **EXP-P2 naming ambiguity** — `SERIES-RATIFICATION_p1-p2-p3.md` records at least one prior rename
  of the EXP-P2 directory and the disappearance of a directory named in that same document
  (`exp-p2-structural-invariance/`). At least three current candidate directories exist
  (`exp-p2-consequential-performance/`, `exp-p2a-software-consequences/`,
  `exp-p2b-physical-consequences/`) and none was picked without operator confirmation.
- **Aegis "0.0" doctrine documents and "Golden Cycle Research Thesis v0.1"** — searched by exact
  title and by keyword combination; not found anywhere in the repository. Adjacent "Factor Aegis
  0.1" documents exist but were not assumed to be the same artifacts.
- **T004 / T005** — no manifest, content ID, or machine-endpoint record exists anywhere in this
  repository (only T006 has an in-repo manifest, `docs/qriptopian/thresholds/006-editions-manifest.json`).
- **External bibliography (Bai et al., Claude's Constitution, NIST AI RMF, W3C VC/DID, Wiener,
  Ashby)** — T006's canonical Research Edition text (with its formal reference list) lives only in
  a Supabase `content` row (`modalities.read.text`), not as an in-repo file. This session did not
  execute a live Supabase query (no project ID/connection was confirmed working, and guessing one
  would violate this repo's No-Guessing rule), so these seven entries are left as named-but-unresolved
  rather than copied from memory or invented.
- **004–006 "About this edition" audit** — not completed this pass; requires the same live DB read
  access noted above to compare each edition's `ai_metadata`/prose claims against what actually
  exists. Reported as an open gap rather than guessed.

## Next steps (require operator/coordinator input, not further inference)

1. Confirm/disambiguate the EXP-P1 framing and the EXP-P2 target directory.
2. Locate or confirm-absent: Aegis 0.0 doctrine docs, Aegis Crucible Submission 0.0, Golden Cycle
   Research Thesis v0.1, T004/T005 canonical records.
3. Obtain confirmed Supabase read access (or have the operator paste the T006 reference list) to
   copy the seven external citations verbatim rather than leaving them unresolved.
4. Only after the above: deposit `007-research-edition.md`'s content and
   `007-research-apparatus.json` into the `content` table as `ai_metadata.researchApparatus`,
   mirroring the `qriptopian.threshold-essay.v1` schema, and mint a `007-editions-manifest.json`
   analogous to `006-editions-manifest.json`.
5. Perform the 004–006 apparatus audit against their live `ai_metadata` once DB read access is
   confirmed.
