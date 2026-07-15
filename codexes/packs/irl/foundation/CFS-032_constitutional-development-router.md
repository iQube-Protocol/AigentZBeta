# CFS-032 — The Constitutional Development Router

**Chrysalis Foundation Specification · v1 · Status: CHARTERED 2026-07-16 (operator + Aletheon dialogue, "closing out chrysalis 2.0's last evolutionary set of features").**
Companion to: **CFS-015** (Operation Chrysalis 2.0 PRD — Model Router, Provider Sovereignty, and Sovereign Survivability were already named there as core objectives; this spec completes them for a second axis), **CFS-018** (Platform Sovereignty — the ModelQube router and the "primitives invariant, providers replaceable" rule), **CFS-016** (the deployment authority ladder, D1/D2/D3 — unchanged by this spec), **CFS-029** (Constitutional Capability Pipeline — this spec extends its stage sequence past Implementation Pack), **CFS-030** (Constitutional Reconciliation — the validate→remediate→redispatch loop this spec's executors all still run through), **CFS-023** (Chrysalis Homecoming — the next era after this one).

> "There is code development, there's code orchestration, and there's code development... I don't know that we've actually — maybe I'm conflating two things there, and we want to keep them separate." — operator, 2026-07-16

That uncertainty is answered precisely in §1 below: there are three axes, not one, and this spec is about exactly one of them.

## 0. What this spec is not

It is not a new deployment authority level. CFS-016's D1 (pack-proposed, operator-executed) remains exactly as ratified — the operator still clicks merge, regardless of which executor wrote the diff. It is not a new reasoning/inference router — CFS-015/018's ModelQube router (`resolveModelQubeRoute(stage)`) already routes the platform's OWN reasoning (intent, context, capability, validation, etc.) across providers, invariant-aware, with a proven open-weight sovereign floor. This spec charters the one axis that has no router yet: **which executor writes the code** for a capability the Constitutional Decision stage has already decided requires code.

## 1. Three axes, not one — the distinction that resolves the operator's own uncertainty

| Axis | Question it answers | Router / gate | Status |
|---|---|---|---|
| **Reasoning / inference routing** | Which model does the PLATFORM'S OWN reasoning (intent classification, capability analysis, validation judgment, etc.)? | ModelQube Router, `resolveModelQubeRoute(stage)` | Built (CFS-015 §Phase 2 orchestration advance, 2026-07-09) |
| **Development routing** (this spec) | Which executor WRITES THE CODE once "code" has been decided as the realization mechanism? | Constitutional Development Router (§2 below) | Chartered here, unbuilt |
| **Deployment authority** | Who is ALLOWED to execute the git push / merge that ships a diff to production? | CFS-016's D1/D2/D3 ladder | D1 ratified 2026-07-06; D2/D3 unratified, unchanged by this spec |

**These are independent gates.** A capability can be written by Claude Code, Anthropic's API directly, an open-weight model, or a specialist agent — the Development Router's choice — and STILL only ships to `dev` through the exact same D1 flow: pack → PR → validation → operator-clicked merge. Changing WHO WRITES never changes WHO SHIPS. This was already stated, in the reasoning-routing context, as far back as CFS-015's Phase 2 amendment: *"the routing sovereignty and the deployment sovereignty are separate gates."* This spec is that same sentence, applied to a third axis rather than restated as new.

## 2. The Constitutional Development Router

**Not "choose the best model." Optimize for constitutional fitness**, exactly as the ModelQube router already does for reasoning — same shape, new axis.

```
Constitutional Decision (mechanism = 'code')
        ↓
Development Routing            ← NEW
        ↓
Implementation Pack             (existing terminus, CFS-029 §2 — unchanged)
        ↓
Dispatch to the selected executor's adapter
        ↓
Implementation (CI, executor-specific)
        ↓
Validation                      (existing, CFS-030)
        ↓
Deployment (D1 merge — CFS-016, unchanged)
        ↓
Deployment receipt              (existing, deployment_proposed / merge receipts)
        ↓
Constitutional Acceptance        ← NEW (the registry write — §4)
        ↓
Operational Validation → Standing Accrual   (named gap — §5)
        ↓
Knowledge
```

*(Acceptance placement corrected 2026-07-16, same day, operator direction: originally drafted between Validation and Receipt per Aletheon's first sketch; the operator repositioned it to follow Deployment — you only accept into the platform's constitutional state what has actually shipped. §4 records the corrected definition.)*

**Routing dimensions** (proposed, not yet weighted or scored — this is the vocabulary the router optimizes over, not a working scoring function):

| Dimension | Example |
|---|---|
| Sovereignty | Prefer an open-weight/local executor when policy requires it |
| Privacy | Local execution for sensitive diffs |
| Standing | A trusted delegate agent may be routed privileged code |
| Capability | A Rust specialist vs a React specialist executor |
| Cost | Cheapest executor that clears the bar |
| Latency | Fastest executor that clears the bar |
| Rigor | Highest-reasoning-quality executor for constitutionally sensitive code |
| Verification | Dual-execution or cross-checking for high-stakes diffs |
| Availability | Failover if a preferred executor is unreachable |

**Candidate executors** (named, none built except the first): Claude Code (today's only real adapter, `claude-implement.yml`), the Anthropic API directly (Opus/Sonnet/Fable without the Claude Code CLI wrapper), OpenAI (Codex/GPT), Gemini, an open-weight coding model (local or hosted), a specialist coding agent, or an agent swarm. **Each new executor requires its own dispatch adapter** (today: a GitHub Actions `repository_dispatch` workflow calling `anthropics/claude-code-action@v1`) — the router can be SPECIFIED now as a policy object; actually reaching a non-Claude-Code executor is real per-executor engineering, not a routing-table entry. Naming the router does not build the adapters.

**Operator's original five-stage framing, reconciled:** the operator's own five sequential "sovereignty milestones" (ChatGPT → Claude Code → Anthropic APIs → multi-frontier → open-weight → sovereign agents) are not five projects and not five routing policies to build in sequence, per the operator's own correction mid-dialogue — **they are candidate points on the SAME routing dimension** (which executor, ranked by the fitness dimensions above). Building the router once, with a widening set of adapters over time, replaces building five separate pipelines.

## 3. Correction — "Implementation Strategy" already exists; it is the Constitutional Decision stage

Aletheon's proposed pipeline (2026-07-16) named a new stage, "Implementation Strategy," deciding *how* a capability should be realized (compose / configure / extend / implement code / policy / documentation / workflow). **Checked before drafting: this stage already exists, ratified, under a different name.** CFS-029 §4's **Constitutional Decision** stage already decides exactly this, over an almost identical vocabulary — `none · code · configuration · registry · prompt · policy · schema · knowledge · automation · documentation` — via `decideRealizationMechanism(goal, evidence)`, two-tier (LLM decision + a pure deterministic floor that never fabricates), recorded on the pack, auditable. **No new stage is added for this.** The only place this spec touches CFS-029's sequence is downstream of a `code` decision: Development Routing (§2) fires ONLY when `constitutionalDecision.mechanism === 'code'` — every other mechanism (compose, configuration, policy, etc.) never reaches this router at all, exactly as Aletheon's own framing intended, just without a duplicate stage name.

## 4. Constitutional Acceptance — a genuinely new object

**Checked before drafting: zero prior use of this term in the codebase.** Distinct from Validation, which asks *did it work?* (tests pass, invariants hold, the diff matches the pack). Acceptance asks a different question: **does this become part of the constitutional state of the platform?**

**The constitutional act, defined (operator, 2026-07-16, same-day refinement):** Acceptance IS the act of **recording the shipped capability and its associated metadata in the registry as a new constitutional asset** — a `ConstitutionalObject` carrying the capability's identity, provenance (pack id, PR, validation receipts, deployment receipt), governing invariants, and reuse disposition. Not a review meeting, not a second validation — a registry write, receipted like every other consequential act.

**Where it sits (corrected same day):** immediately following Deployment and its receipt (§2's diagram) — not between Validation and Receipt as first sketched. The reasoning: the platform's constitutional state should only ever contain capabilities that actually SHIPPED; accepting a validated-but-unmerged capability would register an asset that doesn't exist in production. This also composes cleanly with §5's Standing sequence — Acceptance records THAT the capability exists as a constitutional asset; Operational Validation then evidences that it WORKS in production; Standing accrues from the latter, never from the former alone (declared → verified → accrued, preserved).

**Why this is a real gap, verified against the code:** today Gap Analysis reads back `capability_evidence` (per-goal evidence rows, the CS-001 fix — how it found "3 EXISTING with reuse dispositions") — but there is NO durable catalog of shipped capabilities anywhere. The Canonical Asset Registry (`services/composition/canonicalAssets.ts`, CFS-022a) registers representation/composition assets (the Bearing Instrument, metaVitruvian, the Plates) as `ConstitutionalObject`s — the right OBJECT SHAPE and the natural precedent — but no shipped CODE capability has ever been recorded in it or any equivalent. Constitutional Acceptance is the missing write-side: the explicit step that turns "code merged" into "capability exists as a citable, reusable constitutional asset the next Gap Analysis can find."

**Acceptance is a DECISION, not an automatic consequence of deployment.** A one-off fix with no reuse value, or a capability the operator deliberately keeps unregistered, still ships and still receipts — it just never becomes a Registry asset.

**Honest limit:** this section now defines the act (a registry write producing a `ConstitutionalObject`) and its position (post-deployment), but the write mechanism is still unbuilt — no route, no receipt action type, no schema addition exists. Whether the capability asset lands in the existing Canonical Asset Registry (extended with a capability kind) or a sibling registry surface is an extend-don't-duplicate decision for the implementing increment; the strong default, per the codebase's own precedent, is extending the existing `ConstitutionalObject` registry rather than minting a parallel one.

## 5. Standing after deployment — the operator's question, answered against the actual code

**The operator asked directly whether Standing is already part of the pipeline after deployment. It is not — verified against the running code, not assumed.** The `standing_accrued` DVN action type exists (`services/dvn/activityReceiptDvnPipeline.ts`), and a working accrual mechanism exists (`services/crm/standingAccrualService.ts`, `services/standing/standingSignalService.ts`) — but grepping every call site of `actionType: 'standing_accrued'` shows it is created ONLY from `standingAccrualService.ts`, which is CRM/venture-domain accrual. **No call site connects a Dev Command Center deployment, merge, or validation receipt to Standing accrual.** Shipping a capability today produces `deployment_proposed` / `deployment_executed` / `constitutional_validation_recorded` receipts (CFS-016, CFS-029/030) — none of which currently triggers `standing_accrued`.

**Aletheon's proposed sequencing is adopted as the target, not yet built:**

```
Deployment → Operational Validation → Receipt → Standing Accrual
```

Standing should accrue from **verified capability delivered**, not from code merged — the same declared → verified → accrued discipline the platform already applies elsewhere (e.g. delegate Standing in Homecoming, CFS-023). "Operational Validation" here means evidence the deployed capability actually functions in production (a subsequent Chrysalis Test pass, an operator confirmation, or a follow-up experiment), distinct from the PRE-merge Validation stage (CFS-030) that judges the PR before it ships. **This is a named code follow-on, not done by this charter**: wiring a deployment/operational-validation receipt to call `standingAccrualService`'s accrual path (or an equivalent DCC-scoped accrual function — TBD which is the right composition point, extend don't fork) is real engineering work for a future increment.

## 6. Provider Sovereignty and Sovereign Survivability — the objectives this spec completes

CFS-015 already named these as Chrysalis 2.0 objectives at its founding (2026-07-06): *"Provider Sovereignty — no external AI provider SHALL become constitutionally indispensable"* and *"Sovereign Survivability — the Human Agency System SHALL remain operational in the absence of any frontier AI provider."* Verified: these were named as objectives with the Model Router built to satisfy them for REASONING; this spec is Aletheon's proposed **Phase 2B** — completing the same two principles for DEVELOPMENT. Not a new release (Chrysalis 2.5); a completion of stub objectives Chrysalis 2.0 already committed to.

**CFS-018's existing "primitives invariant, providers replaceable" table gains a row** (companion amendment, same date, in CFS-018 itself) for Development — the same pattern already tabulated there for model inference, identity, settlement, and constitutional agreement.

## 7. The invariant this spec extends — recorded as convergence, not new discovery

`inv.engineering.031` is already ratified: *"separate reasoning from inference — the provider infers ONLY; reasoning is the platform's, inference is a swappable object."* Aletheon's closing framing (2026-07-16) — *"Constitutional Development is not defined by who writes the code; it is defined by the constitutional process through which capability is realized"* — is the SAME invariant, restated for a second axis (development, not reasoning). Recorded in `CONVERGENCE_LOG.md` as Entry 003, not presented as a freshly discovered principle: the underlying shape (a constitutional process invariant across swappable executors) was already ratified 2026-07-09; what's new here is recognizing it applies to code-writing as well as inference.

## 8. Sequencing — where this sits in the Chrysalis eras

Per Aletheon's proposed sequencing, verified against CFS-023 (which already defines exactly the four workstreams named below — no correction needed here):

```
Chrysalis 2.0 (Phase 2B, this spec)
  Constitutional Computing · Constitutional Capability Pipeline ·
  Constitutional Development Router · Provider Sovereignty · Sovereign Survivability
        ↓
Chrysalis Homecoming (CFS-023 — unchanged by this spec)
  Knowledge Homecoming · Agent Homecoming · Harness Homecoming · Operational Homecoming
        ↓
Chrysalis 3.0 — Constitutional Society (unscoped, not this spec's concern)
```

## 9. Honest limits

- **No executor beyond Claude Code exists today.** This spec charters the router's shape and vocabulary; it builds no adapter for the Anthropic API directly, OpenAI, Gemini, an open-weight model, or a specialist agent. Each is real, separate engineering work.
- **The routing dimensions (§2) are named, not scored.** No fitness function, weighting, or ranking algorithm exists yet — this is vocabulary for a future implementation, mirroring how the ModelQube router's `resolveModelQubeRoute` took the equivalent vocabulary and made it operational over months, not in one spec.
- **Constitutional Acceptance (§4) now defines the act (post-deployment registry write producing a `ConstitutionalObject`) but the mechanism is unbuilt.** No registry write path, no new receipt type, no schema change exists yet.
- **Standing accrual after deployment (§5) is a verified, real gap** — not wired in code today. This spec names the target sequence; it does not implement it.
- **CFS-016's deployment ladder (D1/D2/D3) is completely unchanged.** Nothing in this spec proposes, requests, or implies moving past D1.
- **This is a charter, not an implementation pack.** No code is dispatched, no PR opens, from this spec alone.

## Ratification record

- [x] **CHARTERED 2026-07-16 by operator + Aletheon dialogue**, as Chrysalis 2.0 Phase 2B — completing the Model Router / Provider Sovereignty / Sovereign Survivability objectives CFS-015 named at Chrysalis 2.0's founding, for the development (code-writing) axis rather than the reasoning axis.
