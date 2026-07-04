# Video Brief — "The Weight of a Name" (24s · 2×12s)

**EXP-002 · One continuous story across two 12s segments. Same core invariants, varied prose.**

## Core invariants (both segments carry ALL of these)

| Marker | Invariant |
|---|---|
| C-011 | Personhood precedes identity. |
| C-012/013 | Standing follows action; authority follows standing. |
| C-060/062 | Truth is established through validation, not popularity; reach measures adoption, not validity. |

Segment 1 states them through **loss** (the fall of the popularity network). Segment 2 states them through **restoration** (the constitutional network). Different prose, same invariants — that is the experiment.

## Continuity block (prepend to BOTH segment prompts, verbatim)

> Cinematic, photoreal, dusk-blue palette with a single warm amber accent. One protagonist throughout: a woman in her 30s, close-cropped hair, dark coat — calm, not distressed. Slow dolly moves, no cuts within the segment. Recurring motif: her name, AMARA OKAFOR, rendered as glowing text that persists while other UI dissolves. Tone: quiet, dignified, hopeful by the end. No dialogue; on-screen captions only, in a clean grotesk typeface.

## Segment 1 (0–12s) — "Everything that was rented, vanishes"

**Prompt:**
Continuity block + —
A vast wall of glowing social-media counters — follower numbers, like counts, verification badges — towers over the woman. The counters flicker and dissolve into ash-like particles that drift upward, the platform logos crumbling with them. Numbers reading 400,000 fade to zero. Through the dissolving wall, her name — AMARA OKAFOR — remains, softly glowing amber, untouched by the collapse. She watches without fear. Caption fades in at 8s: "Popularity was never the asset." Final frame: only her name is left in the dark, steady.

**Invariant mapping:** the collapse of counters while the name persists = C-011 (identity is not platform-granted; the person is prior) + C-060/062 (popularity/reach vanish because they never established validity). Setup for C-012/013 by negation: nothing she loses was earned standing.

**Bridge out:** end on the glowing name alone in darkness — segment 2 opens on the identical frame.

## Segment 2 (12–24s) — "Everything that was earned, remains"

**Prompt:**
Continuity block + —
Opening on the same glowing amber name in darkness, hold one beat. From the name, thin luminous threads grow outward — each thread lights up as a small scene-node: a signed document, a completed audit, a handshake, a verified seal. With each act, the threads thicken and a quiet lattice assembles around her — a calm constitutional network replacing the vanished wall, geometric and steady where the old wall was frantic. Doors of light open along the lattice as it strengthens. Caption at 18s: "Standing follows action. Authority follows standing." Final frame at 23s: the lattice complete around her, caption: "A legitimate internet." 

**Invariant mapping:** threads growing from acts = C-012 (standing follows action); doors opening as the lattice strengthens = C-013 (authority follows standing); the lattice built from verified acts, not crowd-noise = C-060 (validation, not popularity); the name as the seed of everything = C-011.

## Production plan

1. Generate segment 1 (12s) → URL_A
2. Generate segment 2 (12s) → URL_B
3. `POST /api/skills/video/stitch` `{ "clips": ["URL_A", "URL_B"] }` → the 24s film

## Acceptance checks

- A viewer who has never seen the collection should recover, unprompted: "your identity isn't the platform's to take," "you earn standing by acting," "popularity isn't truth." (compression fidelity)
- No asserted principle outside the collection. (hallucination = 0)
- The two segments read as one film (motif + palette + protagonist continuity).
