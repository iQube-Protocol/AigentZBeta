# Commit Brief: `c34a792` — Build the Bearing Instrument v1: the constitutional compass, operating within the CCRL reference field

| Field | Value |
|-------|-------|
| SHA | [`c34a792`](https://github.com/iQube-Protocol/AigentZBeta/commit/c34a792471c29529def93a9b66a1a22bd39fdb96) |
| Author | Claude |
| Date | 2026-07-08T08:29:40Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build the Bearing Instrument v1: the constitutional compass, operating within the CCRL reference field

Render the primary operational representation invariant of Constitutional Civic
Futurism (CFS-021 §5) as a drawn instrument — not a logo, not an icon. Its verbs
are orient, navigate, reason.

components/representation/BearingInstrument.tsx — a fine-linework SVG compass:
the 7 Constitutional Field sectors as annular wedges (each filled from its
field.<sector> role); a needle rotating to activeSector with motion.reveal
easing (orientation); a graduated maturity bezel lit up to the current rung via
the standing.<level> scale (standing); related-sector ticks + real, keyboard-
operable <button>s that emit onNavigate(sector) intent, never routing
(navigation). Instrument semantics: role="img" with an aria-label naming the
active sector + standing; per-sector button aria-labels; SSR-safe (pure
deterministic geometry, no window in render); presentational, emits intent only,
no identifiers. Consumes ONLY representation roles — it reskins CCF <-> High-
Contrast with zero code change (7 field + 4 standing roles resolve to different
values under each interpretation). No contract role was missing: emphasis, the
needle, the bezel and the ticks were composed from existing roles (opacity on a
role colour; needle from accent.geometry / the active sector's field colour).

Mount it in the CCRL Dashboard reference environment (inside the existing tab-
level RepresentationProvider), a small "you are here" element oriented to the
lab's home sector — intelligence (Layer I Invariant Intelligence is the CCRL's
completed foundation; reasoning/knowledge/consequence illuminate as related) —
with Foundational standing. onNavigate records intent (no plate destinations
exist yet); no fake navigation wired.

Projection (modality rotation) and plate-navigation are deferred honestly — there
are no modalities and no Constitutional Plates, so they are NOT stubbed; recorded
as gated follow-ons in CFS-021 §5.

Zero raw colour literals — canary extended: tests/ccrl-dashboard-adoption.test.ts
now holds BearingInstrument.tsx to the same grep gate (plus a bare-#rrggbb gate
for inline SVG) and pins the mount; tests/bearing-instrument.test.ts pins the 7
sectors, the role-driven sector/standing mapping (interpretation-agnostic),
onNavigate firing with the clicked sector, and the aria-label. CFS-021 §5
delivery note appended.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Render the primary operational representation invariant of Constitutional Civic
Futurism (CFS-021 §5) as a drawn instrument — not a logo, not an icon. Its verbs
are orient, navigate, reason.

components/representation/BearingInstrument.tsx — a fine-linework SVG compass:
the 7 Constitutional Field sectors as annular wedges (each filled from its
field.<sector> role); a needle rotating to activeSector with motion.reveal
easing (orientation); a graduated maturity bezel lit up to the current rung via
the standing.<level> scale (standing); related-sector ticks + real, keyboard-
operable <button>s that emit onNavigate(sector) intent, never routing
(navigation). Instrument semantics: role="img" with an aria-label naming the
active sector + standing; per-sector button aria-labels; SSR-safe (pure
deterministic geometry, no window in render); presentational, emits intent only,
no identifiers. Consumes ONLY representation roles — it reskins CCF <-> High-
Contrast with zero code change (7 field + 4 standing roles resolve to different
values under each interpretation). No contract role was missing: emphasis, the
needle, the bezel and the ticks were composed from existing roles (opacity on a
role colour; needle from accent.geometry / the active sector's field colour).

Mount it in the CCRL Dashboard reference environment (inside the existing tab-
level RepresentationProvider), a small "you are here" element oriented to the
lab's home sector — intelligence (Layer I Invariant Intelligence is the CCRL's
completed foundation; reasoning/knowledge/consequence illuminate as related) —
with Foundational standing. onNavigate records intent (no plate destinations
exist yet); no fake navigation wired.

Projection (modality rotation) and plate-navigation are deferred honestly — there
are no modalities and no Constitutional Plates, so they are NOT stubbed; recorded
as gated follow-ons in CFS-021 §5.

Zero raw colour literals — canary extended: tests/ccrl-dashboard-adoption.test.ts
now holds BearingInstrument.tsx to the same grep gate (plus a bare-#rrggbb gate
for inline SVG) and pins the mount; tests/bearing-instrument.test.ts pins the 7
sectors, the role-driven sector/standing mapping (interpretation-agnostic),
onNavigate firing with the clicked sector, and the aria-label. CFS-021 §5
delivery note appended.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/ccrl/foundation/CFS-021_constitutional-civic-futurism.md` |
| Modified | `components/composer/CCRLDashboardTab.tsx` |
| Added | `components/representation/BearingInstrument.tsx` |
| Added | `tests/bearing-instrument.test.ts` |
| Modified | `tests/ccrl-dashboard-adoption.test.ts` |

## Stats

 5 files changed, 635 insertions(+), 19 deletions(-)
