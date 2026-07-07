# CFS-018 — Platform Sovereignty: the Bundle, its Invariants, and the Experiment Series

**Chrysalis Foundation Specification · v1.0 · Ratified by operator direction 2026-07-06**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
Companion to CFS-015 (Operation Chrysalis 2.0), the Sovereignty Scale (`types/constitutional.ts`), and the constitutional glossary.
Invariants: `inv.sovereignty.100`–`inv.sovereignty.107` (Appendix A).

---

## The definition

**Platform sovereignty, like identity, is a bundle of capabilities.** It is not one property and never a boolean — it is a scale of **operator control**, assessed dimension by dimension (`inv.sovereignty.100`). The essence is the operator's ability to choose and not be dependent; open weights are the maximum of one dimension, not the definition of the whole.

## The dimensions of the bundle

| Dimension | What it means | Governing invariants | Today's honest state |
|---|---|---|---|
| **Model openness** | Open weights + open scoring + open access — each alone insufficient | 101 | Venice serves open-weight models (weights ✓); scoring/access dimensions unassessed |
| **Provider choice** | Choose, switch, combine providers; no commercial or platform lock-in (the S1 essence) | 102 | 4 live interchangeable adapters (anthropic, openai, venice, chaingpt) — strongest dimension |
| **Commercial independence** | No credit wall, billing gate, licence, or account standing can block constitutional operation | 103 | **INFRINGED — the founding case study.** Venice credit restrictions block access to open-weight models: openness without access is not sovereignty |
| **Infrastructure agency** | Operator control over hosting, storage, execution — decentralized or centralized *by choice* | 104 | Mixed: decentralized organs exist (Autonomys CIDs, Walrus/Sui, ICP canisters for DVN) alongside centralized ones (Amplify hosting, Supabase storage) — posture inventoried, not yet measured |
| **Infrastructure survivability** | Constitutional operation survives the loss of any single infrastructure provider | 105 | Untested — no infrastructure drill has run |

## The Venice lesson (why commercial independence is its own dimension)

The models we reach through Venice are open-weight — the model-openness dimension looks satisfied. Yet credit restrictions block access, so constitutional operation on the open-weight path is **blocked by a commercial gate**. That is a sovereignty infringement (`inv.sovereignty.103`) despite open weights. The lesson generalizes: **dimensions do not substitute for each other**. Openness without access, access without choice, choice without infrastructure agency — each gap is a real hole in the bundle, findable only if the bundle is assessed per dimension.

## The measurability mandate

`inv.sovereignty.106`: every sovereignty dimension shall be measurable by experiment — an unmeasured sovereignty claim is a claim, not a capability. This is the charter for the series below, and it is why the invariants exist as substrate seeds rather than prose: experiments cite them, receipts carry them, Reach accrues to them.

## The Platform Sovereignty Experiment series (PSE)

EXP-004 is the first member (`inv.sovereignty.107`). The series roster — first set named now, run operator-paced; each experiment publishes canonically (hash-committed) and cites its governing invariants:

| # | Experiment | Dimension | Design sketch | Status |
|---|---|---|---|---|
| PSE-1 | **EXP-004 Sovereignty Drill** | Model/provider (Sovereignty Scale S1–S3) | Constitutional battery on substitute providers (S2) and the open-weight provider (S3) | **Built + publishing graded results.** Frontier run live (chaingpt → openai) publishing legitimate S2 (substitutable) data; the open-weight S3 apex run is a distinct higher rung, pending PSE-2's subject (the Venice credit wall) |
| PSE-2 | **Commercial-independence drill** | Commercial (103) | Enumerate every commercial gate on the constitutional path (provider credits, hosting billing, storage quotas); measure which can halt constitutional operation and what degrades instead | Named — the Venice credit wall is its founding datum |
| PSE-3 | **Infrastructure survivability drill** | Infrastructure (105) | Simulate loss of one infrastructure provider at a time (storage, hosting, chain-anchoring); constitutional operation must continue — quality may degrade, operation shall not (the EXP-004 semantics applied to infrastructure) | Named |
| PSE-4 | **Hosting/storage posture assessment** | Infrastructure agency (104) | Inventory every platform organ's hosting posture (decentralized/centralized/by-choice); produce the agency map that PSE-3 drills against | Named |
| PSE-5 | **Model-openness audit** | Model (101) | Per provider: weights open? scoring open? access open? — the three-part openness bundle scored honestly | Named |

Design discipline for every PSE member (inherited from EXP-004): failures are data, never masked; substitutes never satisfy the dimension they substitute for; publishes carry the rung/dimension explicitly; degradation is reported, never scored as failure when operation continues.

## Relationship to the Sovereignty Scale

The Sovereignty Scale (S0–S3, `types/constitutional.ts`) is the **measure of the model/provider dimension** — one axis of the bundle. The bundle is the full space; other dimensions get their own measures as their experiments are designed (PSE-2's commercial-gate census, PSE-3's survivability matrix). The scale is not renamed or widened: one clean measure per dimension, per the one-concern discipline.

## Interpretation correction (2026-07-07, operator)

The series claim is that platform sovereignty is a **measurable bundle** (model, provider choice, commercial independence, infrastructure). It follows that **measurement at ANY rung of the Sovereignty Scale is valid experiment data** supporting the measurable-bundle claim — the scale grades the *degree* of sovereignty demonstrated, it is not a gate on the experiment's validity or progress. A frontier-provider run (chaingpt/openai) **measures real bundle components** — provider interchangeability and commercial independence from any single vendor — and is a legitimate S1/S2 datum, **not "not a sovereignty claim."** Open-weight / self-hosted operation is the **apex** (S3, the fullest expression), a distinct higher rung — not the gate for the experiment to count as progress.

This supersedes the earlier "rehearsal — not a sovereignty claim… reads as partial, never pass" framing, which was too restrictive and contradicted the very claim the experiment exists to prove. Consequences, threaded through the build:

- **EXP-004 (PSE-1) publishes graded results across rungs and concludes across them.** Every completed run publishes `sovereigntyRung` (`s2-substitutable` for a completed frontier run, `s3-open-weight` for a completed open-weight run) and a `bundleComponentsMeasured` array — no `rehearsal: true` flag, no "never a sovereignty claim" note.
- **The Chrysalis sovereignty criterion passes the measurable-bundle claim on ANY completed run** (frontier or open-weight), naming the highest rung reached and flagging apex status ("S3 open-weight apex reached" vs "S2 substitutable demonstrated · S3 open-weight apex pending"). A failed/incomplete run is `partial`; nothing published is `pending`. Legacy rows are tolerated for back-compat (`rehearsal`→S2, `sovereigntyHolds:true`→S3).
- The provider allowlists are unchanged (`SOVEREIGN_PROVIDER = venice`, `REHEARSAL_PROVIDERS = chaingpt, openai` — venice excluded because a venice run IS the open-weight S3 run); only the framing is corrected.

## Ratification record

- [x] **v1.0 RATIFIED — 2026-07-06, operator direction** (bundle definition, the Venice case study, the invariant set 100–107, the PSE series charter).
- [ ] PSE-2..5 designs — named, not yet designed; each design is its own ratification before spend.

## Honest limits

- Invariants 100–107 are `proposed` status in the seed crystal until the operator runs the ingest (they become citable substrate then; this document is canon meanwhile).
- The infrastructure dimensions (104/105) are inventoried from the codebase's known organs, not from a verified deployment audit — PSE-4 produces the verified map.
- "Open scoring" and "open access" sub-dimensions of 101 are stated but not yet operationalized into measurable checks; PSE-5's design does that.
