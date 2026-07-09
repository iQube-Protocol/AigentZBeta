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

---

## PSE-2 — EXP-005, the Provider-Choice Drill (2026-07-07)

PSE-1 (EXP-004) measured constitutional operation on a single provider at a
graded sovereignty rung. PSE-2 measures the **provider-choice** component of
the bundle directly: the platform hands the *same* EXP-003 constitutional
battery across an operator-selected rotation of 2+ real adapters **mid-run**,
and every verdict is cross-provider-judged (the judge is always the NEXT
provider in the rotation — never the answerer).

- **Claim:** provider choice is a real, measured sovereignty-bundle component —
  constitutional operation survives the switch.
- **Metric — `switchIntegrity`:** a run measures the component (`completedAcrossProviders`)
  iff every task completed AND the battery spanned ≥2 providers. A provider
  adapter erroring IS that task's constitutional failure for that provider —
  recorded plainly, never masked, never silently re-routed onto another
  provider (a silent failover would corrupt the measurement).
- **Sovereignty framing:** a completed run demonstrates **S2 (substitutable)
  EXERCISED** — not merely available. Bundle components measured:
  `provider-interchangeability`, `provider-choice-exercised`,
  `commercial-independence`, `constitutional-operation` (+ `open-weight-participation`
  when venice rides the rotation). **S3 remains EXP-004's claim** — venice in the
  rotation is participation, not the open-weight-alone apex.
- **Honesty discipline (inherited from EXP-004):** quality deltas across
  providers are the degradation report — reported, never scored as failure.
- Service `services/experiments/exp005.ts`, route `app/api/experiments/exp005/route.ts`
  (admin-gated), runner `components/composer/Exp005ProviderChoiceRunner.tsx`
  (Experiment Lab → "EXP-005 · Provider Choice"), canary
  `tests/exp005-provider-choice.test.ts`. Registered in EXPERIMENT_REGISTRY +
  the PSE series (`types/research.ts`).

## Apex sovereignty — the self-hosted tier (seam stubbed 2026-07-09)

The fallback ladders terminate at venice, an **open-weight** model — but
venice's *hosting* is still a third party's (the `inv.sovereignty.104`
infrastructure-agency dimension, and the very Venice lesson above:
open weights behind a commercial gate is not full sovereignty). **Apex
sovereignty is running open-weight models on our OWN decentralised infra**,
where no third party can rate-limit, price-gate, or disappear our inference.
So the sovereignty ladder has **three tiers, most-sovereign last**:

| Tier | Weights | Hosting | Rung today |
|---|---|---|---|
| `frontier` | closed | third-party | openai, anthropic |
| `open-weight` | open | third-party | venice/llama — **today's floor** |
| `self-hosted` | open | **ours (decentralised)** | — **APEX, stubbed** |

**Status: STUB, inert.** No node is deployed, so every ladder still terminates
at venice exactly as before — this increment adds only the *seam* the future
capability fills, per operator direction ("don't need it now, but stub for it").
When a node is configured (`SOVEREIGN_NODE_BASE_URL` + `SOVEREIGN_NODE_MODEL`,
optional `SOVEREIGN_NODE_API_KEY`), the `self-hosted` rung is **appended as the
terminal fallback and takes the sovereign floor from venice** (venice stays a
rung, no longer the floor). Local inference servers (vLLM, llama.cpp, Ollama, LM
Studio, TGI) speak the OpenAI-compatible `/chat/completions` API, so the apex
rung reuses the venice rung's shape — appending a rung, not a new protocol.

- Seam: `services/constitutional/sovereignNode.ts` (`sovereignNodeConfig`,
  `sovereignNodeConfigured`, `SOVEREIGN_NODE_ENV`); tier vocabulary
  `SovereigntyTier` on `services/constitutional/modelQube.ts`.
- Live integration point: the tool-calling ladder `toolChatLadder()` in
  `services/constitutional/sovereignToolChat.ts` (gated, inert today). Canary
  `tests/sovereign-node.test.ts` pins both states (no-node floor = venice;
  node-configured floor = apex, exactly one floor either way).
- **NOT yet built** (named future workstream): the decentralised inference
  infrastructure itself — node topology, model distribution, and verification
  that remote inference was genuinely performed by our node (not silently
  proxied). The text router (`modelRouter.ts` FALLBACK_LADDER) and `codex/chat`
  adopt the apex rung when the provider adapter lands (workstream #44).

## Apex PLATFORM sovereignty — the S5 horizon (referenced 2026-07-09)

The same principle scales from the model to the WHOLE PLATFORM. Apex *model*
sovereignty (above) is open-weight inference on our own infra. **Apex *platform*
sovereignty applies the identical move to hosting the entire platform** — storage,
execution, hosting on a SOVEREIGN substrate (e.g. AutoDrive/Autonomys, Walrus/Sui,
ICP canisters) instead of a CENTRALISED provider (Amazon/Amplify, Supabase). This
is the `inv.sovereignty.104` (infrastructure agency) / `inv.sovereignty.105`
(infrastructure survivability) end-state — the whole substrate under operator
control, not just the model.

The **Sovereignty Scale now runs s0 → s5** (`types/constitutional.ts`), extended
from its former s0 → s3 by the apex recalibration:

| Rung | Meaning | Axis |
|---|---|---|
| s0–s2 | dependence → interchangeable → substitutable | intelligence supply |
| **s3-open-weight** | open weights, THIRD-PARTY hosted (venice) — *not* the apex | intelligence supply |
| **s4-self-hosted** | apex MODEL — open-weight on our own decentralised infra | intelligence supply (+ model-hosting) |
| **s5-sovereign-platform** | apex PLATFORM — the whole substrate on sovereign infra | platform substrate (infra agency) |

s5 nests above s4 (a sovereign platform hosts the sovereign model). It is a
**distinct dimension** — the platform substrate, not the intelligence supply — so
the EXP-004 sovereignty drill does **not** and cannot reach it: that drill grades
the model supply and tops out at s4. Apex platform sovereignty is measured by the
**infrastructure drill (PSE-4)**, which produces the verified infra map, and is a
**Chrysalis 3.0** build target — referenced here so the scale and the experiment
series can grow into it, not catered to now (per operator direction 2026-07-09).

- EXP-004 recalibration: `services/experiments/exp004.ts` gains the `self-hosted`
  arm → `s4-self-hosted` (`BUNDLE_COMPONENTS_SELF_HOSTED` adds `model-hosting-
  sovereignty`); the runner + `chrysalis-test` sovereignty criterion + the
  `constitutional-contracts` canary are updated so S3 is labelled "third-party
  hosted" and S4/S5 are named as the apex tiers.

## Provider registry + operator model declaration (2026-07-09)

The `inv.sovereignty.102` provider-choice dimension gains a populated registry and an operator surface.

- **ModelQube registry populated.** All named providers are now ModelQubes: `anthropic`, `openai`, `venice`, and `chaingpt` are ROUTABLE (verified `callChatWithUsage` adapters); `thirdweb`, `gemini`, `grok` are honest STUBS — named + visible in the Model Routes surface with a reason, but filtered out of `resolveModelQubeRoute` so never routed. chaingpt carries low all-stage fitness (eligible alternative, never displaces a frontier default — behaviour-preserving). thirdweb is a stub, not real, because **no thirdweb inference adapter or endpoint exists in the codebase** (No-Guessing: its API shape must be provided to promote it). `ConstitutionalProviderId` widened to the 7; `ROUTABLE_PROVIDER_IDS` + `isExperimentProvider()` guard the router; `ConstitutionalInferenceProvider.implemented` is the static real-vs-stub marker.
- **Operator model declaration** — `operator_model_qubes` table + admin-gated `/api/constitutional/model-qubes` (GET/POST) + a "Declare a model choice" form in the Model Routes surface. An operator registers a model by naming its provider, model id, and the **ENV VAR NAME** that holds its key (set separately in Amplify) — the key VALUE is never entered or stored. The row stores env var NAMES only; the API reports `keyEnvPresent` (does the var exist at runtime?) but never the value. `declared_by_commitment` is a one-way T2 commitment, never a raw personaId.

**Honest limits:** declared choices are captured + surfaced (exportable for the future), but do NOT yet auto-join the synchronous live routing (`resolveModelQubeRoute` is pure/sync) — async hydration of seed ∪ store into routing is the named follow-on, and a declared choice only becomes routable once its provider has a verified adapter AND its `key_env` is set in Amplify. thirdweb/gemini/grok remain inert until their adapters + endpoints are provided.
