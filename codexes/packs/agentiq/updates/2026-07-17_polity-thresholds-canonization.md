# Polity Canonization — Pass 3: Thresholds / Constitutional Internet

**Date:** 2026-07-17
**Corpus:** `codexes/packs/polity-core/items/thresholds/Threshold Articles.txt`
**Contains:** Thresholds Editorial Canon; two full articles ("Representatives Need Passports / The Missing Primitive of the AI Revolution" and "The Internet Needs a Constitution"); the Threshold Video Canon; the ContentQube production canon; the 10 Constitutional Seeds; and the canonical ontology.
**Reconciled against:** `codexes/packs/irl/foundation/canonical-invariants.seed.json` (218 invariants; 47 in the `polity` namespace, max id `inv.polity.206`).
**ID block used:** `inv.polity.235`–`inv.polity.251` (17 of 25 slots; block 235–259 not exceeded).
**Status of all new entries:** `proposed` (pending operator ratification).

This pass separates **constitutional invariants** (canonized below) from **editorial / video / ContentQube production doctrine** (recorded, not seeded, in `codexes/packs/polity-core/items/thresholds/THRESHOLDS_CANON.md`).

## Staging outputs (not merged into the shared seed)

- `_polity-pass3/thresholds-invariants.json` — 17 invariant objects (validated: parses, ids 235–251 sequential).
- `_polity-pass3/thresholds-appendix.md` — appendix markdown for the same 17.
- `2026-07-17_polity-thresholds-canonization.md` — this report.
- `../polity-core/items/thresholds/THRESHOLDS_CANON.md` — editorial/production doctrine + ontology diagram (non-invariant).

**Not touched:** `canonical-invariants.seed.json`, `appendix-a_canonical-invariants.md`, the source `.txt`.

---

## Reconciliation table

| Claim (from corpus) | Disposition |
|---|---|
| Bounded delegation — agency delegable, accountability not | **Already canon** — `inv.constitutional.014` / `inv.constitutional.015` / `inv.polity.170` / `inv.polity.183` (reaffirmed) |
| Action gives standing | **Already canon** — `inv.constitutional.012` (reaffirmed; also extended by 247) |
| Humans + agents amplify, not replace | **Already canon** — `inv.polity.173` (reaffirmed; complemented by 250) |
| Privacy with accountability / minimum disclosure | **Already canon** — constitutional cluster + DVN-receipt canon (reaffirmed; extended by 244) |
| Personhood precedes permission | **Already canon** — `inv.polity.175` (reaffirmed; extended by 237) |
| FACT / operational vs absolute truth | **Already canon** — `inv.epistemology.149` (reaffirmed) |
| Anonymous ≠ consequence-free | **Already canon** — `inv.polity.192` + privacy/accountability cluster (reaffirmed) |
| All-or-nothing permission is wrong; authority is bounded/revocable/verifiable | **Already canon** — `inv.polity.170` (reaffirmed) |
| The Constitutional Internet (network→society; civic layer above transport) | **Newly seeded** — `inv.polity.235` |
| The Threshold (every generation crosses into a new civic order) | **Newly seeded** — `inv.polity.236` |
| Entity before identity (identity is one mode of social recognizability) | **Newly seeded** — `inv.polity.237` (extends 175) |
| Ethics → Law → Economics → Consequence → Code (platform internet inverted it) | **Newly seeded** — `inv.polity.238` |
| The constitutional vacuum (absent principles, software/capital fill it) | **Newly seeded** — `inv.polity.239` |
| Intelligence → Agency → Representation (three-stage evolution) | **Newly seeded** — `inv.polity.240` |
| Legitimacy is the missing primitive (representation needs governance) | **Newly seeded** — `inv.polity.241` |
| Trust doesn't scale, governance does / trust policy not software | **Newly seeded** — `inv.polity.242` |
| Polity Passport = constitutional credential ("what are you authorised to do?") | **Newly seeded** — `inv.polity.243` |
| Receipts belong to the principal; accountability without surveillance | **Newly seeded** — `inv.polity.244` (extends privacy/DVN canon) |
| Reciprocal trust / mutual verification of authority | **Newly seeded** — `inv.polity.245` |
| Legitimacy grounded in human rights, not platform ownership | **Newly seeded** — `inv.polity.246` |
| The Constitutional Economy loop (information→standing→capital→agency) | **Newly seeded** — `inv.polity.247` (extends 192 + 012) |
| Consequential Benefit as telos | **Newly seeded** — `inv.polity.248` |
| The canonical ontology (institution / credential / experience / representative) | **Newly seeded** — `inv.polity.249` |
| metaMe = constitutional experience layer (not a product) | **Newly seeded** — `inv.polity.250` |
| The Agentic Internet connects representatives | **Newly seeded** — `inv.polity.251` |
| "The Constitutional Internet is the internet fulfilling its original promise" | **Deferred** — editorial/rhetorical framing, not a distinct load-bearing invariant |
| Thresholds Editorial Canon (one threshold / one primitive / one revelation; "Claim your Polity Passport. Cross the threshold.") | **Deferred to doc** — production doctrine → `THRESHOLDS_CANON.md` |
| Threshold Video Canon (8.0s films, Constitutional Bearing Mark, the Threshold Pause) | **Deferred to doc** — production doctrine → `THRESHOLDS_CANON.md` |
| ContentQube production pipeline (Article→Creative Brief→Studio Prompt→Contact Sheet→Hero→Social) | **Deferred to doc** — production doctrine → `THRESHOLDS_CANON.md` |

## Tally

- **Newly seeded:** 17 (`inv.polity.235`–`inv.polity.251`)
- **Reaffirmed (already canon):** 8 clusters (`inv.constitutional.012/014/015`, `inv.polity.170/173/175/183/192`, `inv.epistemology.149`)
- **Deferred:** 4 (1 editorial framing + 3 production-doctrine bodies → recorded in `THRESHOLDS_CANON.md`)

## One line per new invariant

- **235 — The Constitutional Internet:** the network became a society, and the response is a constitutional civic layer above transport, not another platform.
- **236 — The Threshold:** every generation crosses a threshold into a new civic order; the response follows a crossing already made, it does not predict one.
- **237 — Entity before identity:** personhood precedes identity; identity is just one way an entity becomes socially recognizable.
- **238 — Ethics → Law → Economics → Consequence → Code:** code should not define law, law should constrain code; the platform internet inverted the hierarchy.
- **239 — The constitutional vacuum:** when constitutional principles are absent, software, ToS, and capital assume constitutional functions by architecture.
- **240 — Intelligence → Agency → Representation:** AI evolves through three questions, ending in "can machines legitimately represent us?".
- **241 — Legitimacy is the missing primitive:** representation needs authority, accountability, governance, and evidence — legitimacy, not capability.
- **242 — Trust doesn't scale, governance does:** trust policy, not platforms; the representative carries its principal's rules, it does not invent them.
- **243 — The Polity Passport:** the constitutional credential answering "what are you authorised to do?", distinct from identity and Standing.
- **244 — Receipts belong to the principal:** verifiable receipts prove action without exposure; accountability need never require surveillance.
- **245 — Reciprocal trust:** in an agentic economy every party verifies not only identity but authority — "can my representative trust yours?".
- **246 — Legitimacy grounded in human rights:** Constitutional-Internet legitimacy comes from human rights and pre-existing norms, not platform ownership.
- **247 — The Constitutional Economy:** information → standing → constitutional capital → agency; organized around agency, not identity or attention.
- **248 — Consequential Benefit:** the telos is measurable positive benefit for individuals, communities, and the polity — not technology for its own sake.
- **249 — The canonical ontology:** Polity (institution) / Passport (credential) / metaMe (experience) / aigentMe (representative) within the Human Agency Field.
- **250 — metaMe is the experience layer:** metaMe is not a product; citizens participate through it, they do not use it.
- **251 — The Agentic Internet connects representatives:** computers → people → value → representatives; connecting representatives requires constitutional infrastructure.
