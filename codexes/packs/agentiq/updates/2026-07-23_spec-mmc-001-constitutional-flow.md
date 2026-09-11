# SPEC-MMC-001 — Constitutional Flow (authored, docs-only)

Authored `SPEC-MMC-001_constitutional-flow.md` — a new interaction-model specification extending **PRD-MMC-001 (metaMe Companion)**, not a second PRD, per the operator's own framing after an Aletheon design session: "it's just a specification, an extension of the current PRD."

**Full spec:** `codexes/packs/irl/foundation/SPEC-MMC-001_constitutional-flow.md`

## What it is

Aletheon's four-movement interaction model (Capture / Organize / Act / Project) for how the browser Companion satellite moves information between the Legacy Internet and the Constitutional Internet, plus Workspace-as-membrane, myCluster-as-operational-spine, and the "Pull Across" signature verb — reconciled against shipped code, exactly as PRD-MMC-001's own §0 reconciles Aletheon's original Companion vision.

## Reconciliation highlights

- **`myResearch` is a genuine gap.** Four of Aletheon's five named myCluster areas already ship (`MyCanvasTab`, `MyWorkspaceTab`, `MyCartridgeTab`, `MyLedgerTab` in `data/codex-configs.ts`); `myResearch` does not exist as a tab today. Confirmed, not glossed over.
- **The extension is Observer-only today.** `extension/companion-observer/` implements consent-gated browser-context observation + search — not the Capture ("Bring into…"), Act, or Project movements. The spec targets unbuilt work.
- **Consent posture carried forward unweakened.** "Pull Across" (Movement I/IV) is the same observation surface PRD-MMC-001 §0.4 already named the platform's single biggest risk; the friendlier verb does not loosen the per-capability grant/revocation model.
- **Cited, not reinvented:** Content Capsule Containment (Movement II) and the observer-awareness "observed, never asserted" pattern (Workspace membrane) — both already CLAUDE.md doctrine.

## Status

DESIGN — docs-only, awaiting explicit operator ratification (Aletheon's draft self-declared "Ratified"; corrected per this repo's ratify-before-build discipline). Ratification checklist is SPEC-MMC-001 §11.
