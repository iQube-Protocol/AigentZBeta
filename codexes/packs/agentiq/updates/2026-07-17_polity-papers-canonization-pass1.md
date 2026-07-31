# Polity Papers → Canon — Canonization Pass 1 (Reconcile + Seed)

**Date:** 2026-07-17
**Status:** RATIFIED into Canon 2026-07-17 (operator: "All ratified") — `inv.polity.160–174` promoted `proposed` → `canonical`
**Scope:** ratify the governing constitutional CONTENT of the Qriptopian **Polity Papers** into the IRL invariant crystal (Canon)
**Touched:** `codexes/packs/irl/foundation/canonical-invariants.seed.json` + `appendix-a_canonical-invariants.md` (same-commit lockstep). New namespace `inv.polity.*`, global ids **160–174**.

## What this pass does

The Polity Papers are a 16-paper Qriptopian series (Experience Sovereignty · COYN Thesis · The Polity), DVN-receipted in the Qriptopian cartridge (`codex_media_assets`, `series='qriptopian'`; enumerated by `GET /api/codex/qripto/papers`) and machine-mirrored in `services/polity/frameworks/`. Their **FACT** framing ("a Fundamentally Accurate Current Truth") was already canon at `inv.epistemology.149`. This pass canonizes the papers' **actual governing constitutional claims** — reconciling first against the existing crystal so nothing is duplicated (CS-001 discipline: reaffirm, never duplicate).

**Hard constraint honoured:** the live full-text PDF extraction (dev host + vision-provider credits, operator-only per the ingest-workflow backlog) was NOT run. Canonization here is drawn from the Polity Papers material that IS in the repo: the ratified `polity-core` charters, the `services/polity/frameworks/*.json` extracted-concept files, the constitutional-commentary update, and the invariant-intelligence anchor.

## Source material read

- `codexes/packs/polity-core/items/*.md` — CONSTITUTION, GOVERNANCE_FRAMEWORK, STANDING_CHARTER, STANDING_FRAMEWORK, DELEGATION_FRAMEWORK, METACOMMONS_CHARTER, FOUNDER_OFFICE_CHARTER, AGENT_CHARTER, VENTUREQUBE_SPEC, PARTICIPATION_MODEL, MACHINE_READABLE, AMENDMENT_RECORDS
- `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
- `services/polity/frameworks/polity-papers-commentary.v1.json`, `constitution-agentic-polity.v1.json`, and the per-charter mirrors
- `codexes/packs/agentiq/updates/2026-06-22_polity-papers-constitutional-commentary.md` and the two ingest backlog docs

## Reconciliation table — every claim considered

| # | Claim considered | Source | Disposition |
|---|---|---|---|
| 1 | Authority may be delegated; sovereignty may not (Polity → Citizen → Delegation → Agent) | Constitution §Core | **Already canon** — `inv.constitutional.015` |
| 2 | Sovereignty remains exclusively with human citizens; agents are not constitutional persons | Constitution §Sovereignty | **Already canon** — `inv.constitutional.016` |
| 3 | An agent may exercise delegated authority but never create new authority | Constitution / Agent Charter | **Already canon** — `inv.constitutional.017` |
| 4 | Delegation never removes accountability | (spine) | **Already canon** — `inv.constitutional.014` |
| 5 | Standing = confidence in veracity of declarations, not reputation | Standing Charter | **Already canon** — `inv.constitutional.018` (+ 061 not-a-measure-of-truth) |
| 6 | Citizens responsible for veracity, not for predicting consequences of truthful information | Standing Charter §First Principle | **Already canon** — `inv.constitutional.019` |
| 7 | Permanent/unlimited delegation is prohibited | Delegation Framework | **Already canon** — `inv.constitutional.020` |
| 8 | Standing follows action; authority follows standing | (spine) | **Already canon** — `inv.constitutional.012 / 013` |
| 9 | Constitutional memory append-only; supersession replaces deletion (Amendment Records) | Amendment Records / Machine-Readable | **Already canon** — `inv.constitutional.023` |
| 10 | Five operator archetypes / Invariant Lenses (citizen · entrepreneurial · technical · creative · research) | Participation Model §I | **Already canon** — `inv.reasoning.157` (five lenses map 1:1 to archetypes) |
| 11 | Sovereign progression is 'ask' not 'act'; consequential progression never automatic | (harness) | **Already canon** — `inv.reasoning.156` |
| 12 | FACT — a Fundamentally Accurate Current Truth (operational, not absolute) | Polity Papers | **Already canon** — `inv.epistemology.149` |
| 13 | **Proof of Work Potential (PoWP)** — capability latent in truthful info before applied | Papers concept + Standing/metaCommons Charters | **Newly seeded** — `inv.polity.160` |
| 14 | **Proof of Time Saved (PoTS) / Net Value Acceleration** = Time-to-Value − Risk Repair Burden | Papers concept + Standing/metaCommons Charters | **Newly seeded** — `inv.polity.161` |
| 15 | **Verification-accrual gate** — claims accrue nothing until verified ('verified over claimed') | Participation Model §VI + PoTS | **Newly seeded** — `inv.polity.162` |
| 16 | **Time Sovereignty** — value accrues to those whose time/capability produced it | Papers concept (exp-sovereignty + coyn) | **Newly seeded** — `inv.polity.163` |
| 17 | **Experience Sovereignty** — operators own their experience model/data/progression | Experience Sovereignty series | **Newly seeded** — `inv.polity.164` |
| 18 | **metaCommons is a field** — sovereign signals → collective intelligence; aggregates PoWP, learns via PoTS | metaCommons Charter | **Newly seeded** — `inv.polity.165` |
| 19 | **Standing calibrates confidence; does not gate** worth/success/opportunity | Standing + Founder Office + VentureQube | **Newly seeded** — `inv.polity.166` |
| 20 | **Capability-into-outcome** — value from transforming latent capability; purpose is formation, not extraction | Founder Office Charter | **Newly seeded** — `inv.polity.167` |
| 21 | **Citizen obligation is veracity; Polity obligation is interpretation** | Standing Charter §First Principle | **Newly seeded** — `inv.polity.168` (pairs with & extends 019) |
| 22 | **Participant agents hold Standing but never citizenship** (participatory, revocable rights) | Standing Charter + Standing Framework v1.0.1 | **Newly seeded** — `inv.polity.169` (refines 016) |
| 23 | **Delegation envelope bounded on every dimension + immutable after creation** (scope/duration/spend/info/domains) | Delegation Framework + Agent Charter | **Newly seeded** — `inv.polity.170` (operationalizes 020) |
| 24 | **No orphaned agents** — every agent traces to a sponsor; every action receipted; always identifiable as non-human | Agent Charter | **Newly seeded** — `inv.polity.171` (extends 014) |
| 25 | **Ventures execute; people participate** (people before products) | Participation Model §VI | **Newly seeded** — `inv.polity.172` |
| 26 | **aigentMe amplifies sovereignty, does not replace judgment; consequential actions require operator approval** | Participation Model §IV | **Newly seeded** — `inv.polity.173` |
| 27 | **VentureQube is a living venture specification** (transforms info+capability+intelligence into executable ventures) | VentureQube Spec v1 (WIP) | **Newly seeded** — `inv.polity.174` (proposed; upstream spec is itself WIP) |
| 28 | Constitutional mismatch ⇒ automatic suspension of a superseded-binding agent | Governance Framework / Agent Charter | **Deferred** — operational binding rule, better expressed as an engineering/enforcement invariant than a durable constitutional principle; revisit with the Agent Passport binding-triple canonization |
| 29 | Amendment/versioning authority is reserved to human citizens; agents do not govern | Governance Framework | **Deferred as distinct** — substantially covered by `inv.constitutional.016/022` (sovereignty human-only; canonical status requires human ratification); no separate seed to avoid duplication |
| 30 | The Constitution of the Agentic Polity (4th Polity paper) elevated to ratified constitutional status | `constitution-agentic-polity.v1.json` | **Deferred to full-text** — the document body is empty in-repo (`articles: []`, `fullTextPath` unpopulated); its specific articles need the live extraction before their claims can be canonized |

**Tally:** 30 claims considered → **12 already canon** (reaffirmed, not duplicated: `inv.constitutional.012–020/023`, `inv.reasoning.156/157`, `inv.epistemology.149`) · **15 newly seeded** (`inv.polity.160–174`, all `status: proposed`) · **3 deferred**.

## Seeding conventions used

- **Namespace:** new `inv.polity.*`, appended to the seed's `namespaces` array. Global id counter continued from the existing max (159) → **160–174**; no id collisions (160+ were all free).
- **Status:** every new entry is `proposed`. The operator ratifies via the canonization/ingest process — nothing was marked `canonical`/`validated`.
- **Provenance:** each `source` cites the originating paper/charter, notes the Polity Papers are DVN-receipted in the Qriptopian cartridge as provenance, notes machine-mirroring in `services/polity/frameworks/`, and states "candidate pending operator ratification."
- **CS-001 discipline:** every new entry's provenance names the existing invariant it reaffirms/extends (e.g. 160 extends 018; 168 pairs with 019; 170 operationalizes 020) so ratification binds to canon rather than forking it.
- **Lockstep:** `canonical-invariants.seed.json` (ingestion SoT) and `appendix-a_canonical-invariants.md` (human canon) were updated in the same commit, matching the crystal's lockstep rule.

## What still needs the LIVE full-text extraction (deferred — operator-run)

This pass canonized what is legible from the in-repo charters + extracted-concept JSON. The following require running `node scripts/ingest-polity-papers.mjs --host=<dev host>` (dev host + vision-provider credits, per `2026-06-22_polity-papers-ingest-workflow-backlog.md`) and are **not** captured here:

1. **The 16 PDFs' full body text.** `polity-papers-commentary.v1.json` `series[].papers[]` is empty; `codexes/packs/polity-core/items/commentary/` holds only a README placeholder. Any invariant that lives in a paper's argument (not its abstract/concept summary) is unreachable until extraction runs.
2. **The Constitution of the Agentic Polity (Polity paper #4).** Elevated to `ratified` in `constitution-agentic-polity.v1.json`, but `articles: []` and `fullTextPath: items/CONSTITUTION_OF_AGENTIC_POLITY.md` is unpopulated. Its specific articles (the rights of constitutional persons, the detailed chain-of-legitimacy provisions) need the live text before they can be canonized beyond the core principles already at `inv.constitutional.015–017`.
3. **COYN Thesis economic mechanics.** Only the Time-Sovereignty framing surfaced through the concept block (→ 163); the thesis's detailed value-accrual/economic model needs the full text.
4. **Experience Sovereignty series specifics.** The ownership principle surfaced (→ 164); the series' concrete experience-model / progression mechanics need the full text.
5. **Per-paper DVN receipt commitments / AutoDrive CIDs.** Recording the commentary CIDs in the Amendment Records (via `publish-polity-core.mjs`) is a named follow-on, not done here.

## Ratification path for the operator

1. Review `inv.polity.160–174` in `appendix-a_canonical-invariants.md` (human canon) and `canonical-invariants.seed.json`.
2. Run the live extraction (`scripts/ingest-polity-papers.mjs`) to unlock the deferred full-text claims for a pass 2.
3. Ratify the accepted candidates through the canonization process (flips `proposed` → `canonical`), which is the operator-gated step — this pass deliberately stops at `proposed`.
