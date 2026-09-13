# Threshold 007 — Aletheon Draft Replaces 007.2, Citation-Hardened (Implementation Anchors Only)

**Date:** 2026-09-12
**Files:** `docs/qriptopian/thresholds/007-research-edition.md`, `docs/qriptopian/thresholds/007-editions-manifest.json`
**Also synced to:** Supabase `content` table (project "Aigent Z", `bsjhfvctmduxhohtllly`), row slug `invariant-intelligence`, `modalities.read.text` — this is the row the live app and the Threshold MCP actually serve; see the discovery below.

## What happened

The operator supplied a new, substantially longer "Aletheon draft" of the Threshold 007 Research
Edition — the same H1/H2/H3 thesis as 007.2 but restructured with more rigor: explicit falsification
conditions per hypothesis, an alternative-explanations section, promotion criteria (Level B–E), an
explicit publication-constitution workflow (Aletheon → Evidence Agent → Adversary → Publication Gate),
and a request to run the Evidence Agent citation-resolution pass this draft's own §36-38 calls for.

This replaces the 007.2 Research Edition text in full (007.2's Reading Edition is untouched and stays
at version 007.2 — only the Research Edition changed). The manifest's `research.version` is now `007.3`.

## Evidence-resolution pass performed

Rather than reconstruct implementation citations from scratch, the prior 007.1 Research Edition's
citation-hardened Implementation-Evidence Register was recovered from git history (`git show
a3c77375:docs/qriptopian/thresholds/007-research-edition.md`) per this draft's own §36 instruction to
carry forward prior evidence rather than rebuild it. All 16 of its resolvable anchors were re-verified
to still exist at current HEAD (`1cd5a395a90e9560949b4e279a6c08a7dfdd7e26`) — none moved or was removed.

Five anchors new to this draft were independently searched and resolved:

| Construct | Resolution |
|---|---|
| Experience Matrix | `services/strategy/experienceMatrixDeriver.ts`, `services/adaptive/experiencePrescriptionAssembly.ts`, tested by `tests/experience-matrix-uncertainty.test.ts` |
| aigentMe provisioning | `services/agents/provisionAigentMePersona.ts` |
| Standing Graph | `services/standing/buildStandingGraph.ts` |
| myGuard (one of the draft's three companion functions) | `services/governance/sovereignAgentRoles.ts` (`brand: 'myGuard'`, handle `@myguard.aigent`) |
| Golden Cycle / PoTS ("Net Value Acceleration") — unresolved in 007.1 | Now resolved: `services/venture/ventureOutcomeAccrual.ts` implements PoTS/Net Value Acceleration accrual; the "Golden Cycle" label itself is this repo's name for the P1→P2→P3→P4 EXP programme per `docs/vela/accelerator/constitutional-financial-services/README.md` |

Two constructs the draft names could **not** be resolved and are marked Unresolved rather than guessed:

- **myClaw, myBot** — the draft's §17 describes a three-function `myGuard`/`myClaw`/`myBot` companion
  architecture. Only `myGuard` exists as a named role in the codebase (`sovereignAgentRoles.ts`).
  `myClaw` and `myBot` appear nowhere outside the Threshold 007 essay text itself.
- **DevOn** and **Aegis Crucible Submission 0.0** — carried forward unresolved from 007.1, unchanged.

None of these three unresolved items is load-bearing for any claim in the paper.

## What this pass explicitly does NOT do

This is **citation resolution only**. It does not run the five-pass Adversarial Research Review
(`docs/research/adversarial-research-review-gate.md`) this draft's own §37 requires before canonical
publication — no independent claim audit, citation-support audit, implementation audit, experiment
audit, or falsification/alternative-explanation audit has been performed. The file's own
editorial-status note and its new "Evidence Resolution — Implementation-Evidence Register" section
state this explicitly. Current disposition: **CANONICAL_DRAFT / EVIDENCE_RESOLUTION_COMPLETE /
ARR_REVIEW_REQUIRED / NOT_FOR_PUBLICATION.**

The prior 007.1 ARR receipt was deliberately **not** carried forward as if it applied to this new
manuscript — that would misrepresent this draft's review status. The file now states plainly that no
ARR receipt exists for it yet.

## Live-serving gap (recap from the prior fix this session)

As discovered earlier this session, these essays are served to readers and to the Threshold MCP from
a Supabase `content` row, not directly from the repo. The same direct-DB-write procedure used for the
007.2 sync was repeated here for the Research Edition text, hash and description fields (Reading
Edition in the DB is unchanged, still the 007.2 text). Verified via
`mcp__threshold__read_public_document` after the write that the served `sha256OfFullText` matches the
new file's own sha256.

## Outstanding

- Independent ARR pass (five-pass adversarial review) — not started.
- The seven internal citations 007.1 left unresolved (CI, PE, IRL-010, IRL-010A, AEGIS-0.0,
  AEGIS-CRUCIBLE-0.0, GC-0.1) remain unresolved; not re-attempted in this pass.
- Reading Edition PDF asset still reflects the 007.1 render (not regenerated in either this or the
  007.2 pass).
