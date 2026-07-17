# Polity Papers → Canon — Canonization Pass 2 (Full-Text Reconcile + Seed)

**Date:** 2026-07-17
**Status:** `proposed` — pending operator ratification (pass 1's candidates were ratified same-day; this pass follows the same gate)
**Scope:** canonize the FULL-TEXT constitutional + economic content of the Qriptopian **Polity Papers**, now that 10 of the 16 PDF bodies have been extracted, reconciling first against the existing crystal (CS-001 discipline).
**Touched (lockstep):** `codexes/packs/irl/foundation/canonical-invariants.seed.json` + `codexes/packs/irl/foundation/appendix-a_canonical-invariants.md`. New global ids **175–206** (32 invariants), all namespace `polity`, all `status: proposed`.

## What changed since pass 1

Pass 1 canonized what was legible from in-repo charter SUMMARIES and the `services/polity/frameworks/*.json` concept files, seeding `inv.polity.160–174` (15 invariants, operator-ratified to `canonical`). Its #1 deferral was **the Constitution of the Agentic Polity's specific Articles** — the source body was empty in-repo (`articles: []`).

Pass 2 reads the **actual extracted full text** now present at `codexes/packs/polity-core/items/commentary/` (extracted 2026-07-17 via `scripts/ingest-polity-papers.mjs`, pdf-parse):

- `CONSTITUTION_OF_AGENTIC_POLITY.md` / `commentary/polity/04-*` — **the crown jewel** (Paper 4, 25pp, 4820 words). 12 Articles now readable.
- `commentary/polity/01-beyond-the-binary.md`, `02-from-perimeter-to-polity.md`, `03-citizenship-in-the-agentic-internet.md`
- `commentary/coyn-thesis/01-05` — the ECONOMIC mechanics (sovereign cybernetics; money/time/COYN; PoWP/PoTS measurement stack; the sovereign cybernetic economy)
- `commentary/experience-sovereignty/07-agent-runbook.md`

The papers remain DVN-receipted in the Qriptopian cartridge as provenance (`codex_media_assets`, `series='qriptopian'`).

## The Constitution's Articles canonized (the #1 pass-1 deferral, now closed)

| Article | Subject | Invariant(s) |
|---|---|---|
| Preamble + I | Foundational principles (personhood precedes permission; priority chain; human-rights floor; open implementation) | 175, 176, 177, 185 |
| II | The Sovereign Natural Person (proof of personhood, KybeDIDs, practical layers) | 178 |
| III | Rights of the Polity (four-tier hierarchy, descending resolution) | 179 |
| IV | Citizenship and Standing (ladder, citizenship ≠ consumption, personas as surfaces) | 180, 181 |
| V | Bounded Autonomy and Delegated Stewardship | 182 |
| VI | Agents, Stewardship, Constitutional Protection (rights-affecting-action gate) | 183 |
| VII | Youth, Guardianship, Protected Development | 187 |
| VIII | Institutions, Work, Governed Domains | 182 (institutional application) |
| IX | Jurisdiction, Escalation, Rights Conflicts | 184 |
| X | Open Standards and Plural Implementation | 185 |
| XI | Mythos, Formation, Civic Culture (logos/mythos/ethos) | 188 |
| XII | Amendment and Constitutional Restraint (entrenchment) | 186 |

## Reconciliation table — every candidate claim considered

### Already canon — REAFFIRMED, not re-seeded

| Claim | Existing id |
|---|---|
| Authority delegated, sovereignty not | `inv.constitutional.015` |
| Sovereignty exclusively with human citizens | `inv.constitutional.016` |
| Agent exercises delegated authority, never creates authority | `inv.constitutional.017` |
| Delegation never removes accountability | `inv.constitutional.014` |
| Standing = veracity confidence, not reputation / not truth | `inv.constitutional.018`, `.061` |
| Citizens responsible for veracity, not consequences of truthful info | `inv.constitutional.019` |
| Permanent/unlimited delegation prohibited | `inv.constitutional.020` |
| Standing follows action; authority follows standing | `inv.constitutional.012` / `.013` |
| Canonical status requires human ratification | `inv.constitutional.022` |
| Append-only memory; supersession replaces deletion | `inv.constitutional.023` |
| Re-identifying identifiers never leave the server | `inv.constitutional.024` |
| Personhood precedes identity/individualization; identity optional derivative | `inv.constitutional.011`, `.063` |
| FACT — a Fundamentally Accurate Current Truth | `inv.epistemology.149` |
| Sovereign progression is 'ask' (guardian-gated), not 'act' | `inv.reasoning.156` |
| PoWP — capability latent before applied | pass-1 `inv.polity.160` |
| Verification-accrual gate ('verified over claimed') | pass-1 `inv.polity.162` |
| metaCommons is a field | pass-1 `inv.polity.165` |
| Standing calibrates confidence, does not gate | pass-1 `inv.polity.166` |
| Capability-into-outcome (formation not extraction) | pass-1 `inv.polity.167` |
| Citizen obligation is veracity; Polity obligation is interpretation | pass-1 `inv.polity.168` |
| No orphaned agents; every action receipted; always non-human | pass-1 `inv.polity.171` |
| Ventures execute; people participate | pass-1 `inv.polity.172` |
| VentureQube is a living venture specification | pass-1 `inv.polity.174` |

### Newly seeded (175–206) — genuinely-absent, load-bearing

| id | one-line | source |
|---|---|---|
| 175 | Personhood precedes permission; polity recognizes, not grants | Constitution Preamble + I + II §7 |
| 176 | Priority chain: rights > citizenship > delegated power > policy | Constitution I §3-4, III §11 |
| 177 | Human-rights floor; the stateless person is its test | Constitution I §6-7, IX; Citizenship §III |
| 178 | Proof of personhood is the key; KybeDID anchors; layers never negate rights | Constitution II |
| 179 | Four-tier rights hierarchy, strict descending resolution | Constitution III |
| 180 | Citizenship = standing + responsibility, not consumption; the ladder | Constitution IV |
| 181 | Personas are civic surfaces, never replace the sovereign person | Constitution IV §8-11 |
| 182 | Bounded autonomy under delegated stewardship (the recurring pattern) | Constitution V + VIII |
| 183 | Agents as bounded instruments + rights-affecting-action review gate | Constitution VI + IX §5 |
| 184 | Escalation over silent execution; jurisdiction shall not erase personhood | Constitution IX |
| 185 | Open, plural, non-monopolized implementation | Constitution I §10-11, X |
| 186 | Constitutional restraint + entrenchment (unamendable core) | Constitution XII |
| 187 | Youth protection = rights-preserving guardianship, anti-masquerade | Constitution VII |
| 188 | Civic formation + logos/mythos/ethos triad (AgentiQ/KNYT/Constitution) | Constitution XI |
| 189 | From perimeter to polity; policy is the executable constitution | Perimeter-to-Polity |
| 190 | Post-binary layered architecture; guarantees by layer | Beyond the Binary |
| 191 | metaMe Runtime is a constitutional runtime | Citizenship §VI; Time Sov §12 |
| 192 | Information is work potential; who governs the loop | COYN 1 |
| 193 | Open context · governed payload · accountable activation | COYN 1 §8-9 |
| 194 | Sovereign vs extractive cybernetics | COYN 1 §7-13 |
| 195 | Money vs COYN; Currency Of Your Net-work; Qc settles, COYN signals | COYN 1 + 4 |
| 196 | Three signal currencies (dollar/Bitcoin/COYN) | COYN 4 |
| 197 | Risk gates value; markets cannot buy away harm | COYN 1/4/5 |
| 198 | Information-integrity time delta + PoTS four-term formula, validity gate | COYN 2/3 |
| 199 | Price at access, settle at consequence; activation ≠ derivative rights | COYN 4 §8-10 |
| 200 | Human (existential) vs agentic (operational) time; iQubes coordinate both | COYN 2 §7-9 |
| 201 | iQube = container of work potential / consequence-bearing primitive | COYN 1/2/5 |
| 202 | The sovereign cybernetic economy (info→work→matter→consequence; Earth closed; regenerative) | COYN 5 |
| 203 | Economy of the sovereign self (boundary of the self is consequence) | COYN 5 §11 |
| 204 | Accountable speech (speech as action in a feedback loop) | COYN 2 §11 |
| 205 | Experience Vibing rule (recommend / authorize / validate; reduce load, preserve agency) | Runbook §2/5/6/16 |
| 206 | The Experience Model (Strategy·Ladder·Matrix·Journey·State; aigentMe regent) | Runbook §4 |

### DEEPENED a pass-1 id (extends, not duplicates — cited in provenance)

| new id | extends | distinct sub-claim added |
|---|---|---|
| 181 | 169 | personas are contextual civic surfaces, not the sovereign person |
| 183 | 171 | rights-affecting agentic action → receipt/traceability/review/challenge gate; no agent resolves a foundational-rights conflict without human review |
| 186 | 023 / 022 | entrenchment — a core set of principles cannot be amended away; no legitimacy by market dominance / technical inevitability |
| 195 | 163 | the money→price / value→time / COYN→context distinction |
| 198 | 161 / 162 | the explicit PoTS four-term measurement stack (Baseline − Actual − Repair − Risk) + 'no validity, no proof' gate |
| 200 | 163 | human-existential vs agentic-operational time; iQubes as human-time↔agentic-compute coordination primitives |
| 205 | 173 | the crisp three-party operating rule + agent-boundary set for every copilot surface |
| 206 | 164 | the five-component Experience Model + aigentMe-as-Runtime-regent |

(202 is a new capstone that composes with 163/165 rather than extending a single id.)

### Deferred (considered, not seeded)

| Claim | Why deferred |
|---|---|
| The metaMe production pipeline ordering (AgentiQ OS → Registry → nanOS → Studio → Catalogue → Runtime) | Operational/mutable spec detail — the Runbook itself "corrected" the ordering mid-document; not a durable constitutional invariant. |
| The ten dimensions of governance (identity/access/asset/behavioral/state/execution/economic/trust/memory/social) | An enumerative taxonomy, not a single governing principle; captured in spirit by 189 (policy is the executable constitution). |
| Bitcoin as a proof-of-work timechain (standalone) | Folded into 196 ("Bitcoin signals state … not a truth machine"); the platform's Bitcoin-anchoring is already built. |
| Enterprise / crown-jewel asset governance (Constitution VIII) as its own invariant | Folded into 182 (bounded autonomy under delegated stewardship, institutional application) to avoid duplication. |
| The 6 remaining unextracted papers (Experience Sovereignty 1–6) | Bodies not yet extracted; nothing to canonize without the text. |

## Tally

- **Candidates considered:** ~55 distinct claims across 10 papers.
- **Already canon (reaffirmed, not re-seeded):** 23 (the `constitutional.*` cluster + pass-1 `inv.polity.160/162/165/166/167/168/171/172/174` + `epistemology.149` + `reasoning.156`).
- **Newly seeded:** **32** — `inv.polity.175–206`, all `status: proposed`.
- **Of which DEEPEN a pass-1 id** (extension cited in provenance, no duplication): 8 (181, 183, 186, 195, 198, 200, 205, 206; 202 composes).
- **Deferred:** 5.

## Seeding conventions used

- **Namespace:** existing `polity` (registered in pass 1). Global id counter continued from the prior max (174) → **175–206**, each id used once, no collisions.
- **Status:** every entry `proposed`. Nothing marked `canonical`/`validated` — operator ratifies via the canonization process.
- **Provenance:** each `source` cites the specific paper + article/section, notes the papers are DVN-receipted in the Qriptopian cartridge and that full text was extracted 2026-07-17 to `commentary/`, names the existing invariant it reaffirms/extends where applicable, and ends with "Candidate pending operator ratification (Polity Papers canonization pass 2)."
- **Semantic_type:** `principle` for all (every seeded claim is normative/governing).
- **Contexts:** 2–4 short tags matching the existing polity entries.
- **Lockstep:** `canonical-invariants.seed.json` (ingestion SoT) and `appendix-a_canonical-invariants.md` (human canon) updated together with matching ids/statements. JSON re-verified valid; the seed edit is a pure append (zero deletions).

## Follow-ons (not done here — this pass touches only the three deliverable files)

1. **Register this report** in `codexes/packs/agentiq/collections.json` under `col_updates` so it surfaces in the AgentiQ "Updates" tab (deferred: task constrained edits to seed.json + appendix-a + this report).
2. **Ratify** `inv.polity.175–206` through the canonization process (flips `proposed` → `canonical`) — the operator-gated step.
3. **Extract the remaining 6 papers** (Experience Sovereignty 1–6) for a possible pass 3.
