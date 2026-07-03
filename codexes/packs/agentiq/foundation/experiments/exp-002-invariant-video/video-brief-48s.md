# Video Brief — "The Constitutional Internet" (48s · 4×12s progressive arc)

**EXP-002 · Four 12s segments sharing the same core invariants, with a progressive story arc: Person → Delegation → Standing → Truth. Each segment varies the prose; the invariants persist across all four.**

## Core invariants (the through-line — every segment touches them; each segment FOREGROUNDS one cluster)

| Marker | Invariant | Foregrounded in |
|---|---|---|
| C-011 / C-016 | Personhood precedes identity; sovereignty is human-only | Segment 1 |
| C-015 / C-014 / C-017 / C-020 | Authority delegable, sovereignty not; accountability survives; agents never mint authority; no permanent delegation | Segment 2 |
| C-012 / C-013 / C-018 | Standing follows action; authority follows standing; standing = veracity-confidence, not reputation | Segment 3 |
| C-060 / C-061 / C-062 | Truth by validation, not popularity; standing ≠ truth; reach ≠ validity | Segment 4 |

## Continuity block (prepend to ALL FOUR segment prompts, verbatim)

> Cinematic, photoreal, dusk-blue palette with a single warm amber accent. One protagonist throughout: a woman in her 30s, close-cropped hair, dark coat — AMARA — calm and deliberate. Beside her from segment 2 onward: her delegate, rendered as a translucent silver figure of light, always half a step behind her, never in front. Slow dolly moves, no cuts within a segment. Recurring motif: her name, AMARA OKAFOR, as persistent glowing amber text. Captions in a clean grotesk typeface. Tone arc: grounded → watchful → earned → serene.

## Segment 1 (0–12s) — PERSON. "Before any network, the person."

**Prompt:** Continuity block + —
Pre-dawn. Amara stands alone on dark glass; beneath the glass, dormant circuitry stretches to the horizon, unlit. As she exhales, her name AMARA OKAFOR ignites in amber at her feet and the circuitry wakes OUTWARD from her — light flowing from person into network, never the reverse. Rising camera reveals the network taking its shape around where she stands. Caption at 8s: "The network begins with the person." Final frame: her silhouette as the network's origin point.
**Foreground:** C-011 (identity flows from the person), C-016 (the human is the sole sovereign source — the network wakes from her, not over her).

## Segment 2 (12–24s) — DELEGATION. "Power lent, never given away."

**Prompt:** Continuity block + —
Daylight rising. Amara raises her hand and draws a thread of amber light from her own chest, shaping it into the silver delegate-figure beside her. A luminous cord remains connecting them — visible, taut, never breaking — as the delegate moves through the network signing documents and opening gates on her behalf. Each gate it opens bears her seal, not its own. At 9s the cord glows brighter with a pulse that travels FROM her TO it: renewal, not release. Caption at 10s: "Authority is lent. Never surrendered." Final frame: delegate mid-task, cord luminous.
**Foreground:** C-015 (delegated authority, retained sovereignty — the cord), C-014 (the cord = accountability, unbroken), C-017 (her seal on every gate — it creates no authority of its own), C-020 (the renewal pulse — nothing permanent).

## Segment 3 (24–36s) — STANDING. "Earned by acting truly."

**Prompt:** Continuity block + —
Afternoon. Amara and the delegate work through the living network: she attests to a bridge inspection, signs a harvest ledger, corrects one of her own earlier records — and at the correction, her amber name flickers, dims slightly, then steadies brighter than before. Around her name a ring of light accumulates in discrete increments, one per completed act. Crowd-noise imagery — floating hearts, follower counters — drifts past her and dissolves without touching the ring. At the ring's third increment, a great door in the network opens for her that remains shut to a passing figure wreathed in dissolving counters. Caption at 33s: "Standing follows action. Authority follows standing." 
**Foreground:** C-012 (increments per act), C-013 (the door opens on the ring, not the counters), C-018 (the honest correction strengthens the ring — veracity, not performance; the dissolving hearts = not reputation).

## Segment 4 (36–48s) — TRUTH. "Three dials, never one number."

**Prompt:** Continuity block + —
Dusk again, full circle. Amara stands before three instrument dials suspended in the network sky: TRUTH (a prism that only turns when a claim passes through layered verification gates), STANDING (her amber ring, transposed), REACH (a fast-spinning counter, blurred). A viral claim — a comet of a million shares — streaks in and spins the REACH dial wildly; the TRUTH prism does not move. Then a small, slow claim passes through the verification gates one by one and the prism turns, casting steady light; her ring brightens a single increment in response. The three dials settle, distinct, side by side — none merging. Caption at 44s: "Truth by validation. Standing by validation of truth. Reach is only adoption." Final frame at 47s: Amara's name beneath the three separated dials, caption: "A legitimate internet."
**Foreground:** C-060 (the comet moves nothing but REACH), C-062 (reach ≠ validity, kept as a separate dial), C-061 (her ring brightens FROM the validation — standing tracks validated truth but is not the prism itself).

## Arc summary

S1 the person lights the network → S2 the person lends power on a visible cord → S3 acts accrete into standing that opens doors → S4 the network's epistemics revealed: three dials, never conflated. Same protagonist, same palette, same name-motif; each segment's prose is new, its invariants are not.

## Production plan (two-pass stitch — the stitcher caps at 3 clips/pass)

1. Generate S1, S2, S3, S4 (12s each) → URL_1..URL_4
2. Pass A: `POST /api/skills/video/stitch` `{ "clips": ["URL_1", "URL_2"] }` → URL_A (24s)
3. Pass B: `POST /api/skills/video/stitch` `{ "clips": ["URL_3", "URL_4"] }` → URL_B (24s)
4. Pass C: `POST /api/skills/video/stitch` `{ "clips": ["URL_A", "URL_B"] }` → the 48s film

## Acceptance checks

- Evaluator recovers the four-beat arc AND the persistent principles (person-first, lent power, earned standing, truth≠popularity) without prompting.
- Every asserted principle maps to a collection invariant; hallucination = 0.
- The renewal pulse (S2), the correction that strengthens (S3), and the unmoved prism (S4) each land as distinct beats — these are the three most-often-lost subtleties (C-020, C-019-adjacent honesty, C-060); their survival measures compression fidelity at its hardest.
