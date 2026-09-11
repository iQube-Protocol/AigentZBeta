# Experience guide as source of truth — matrix calibration across surfaces

**Date:** 2026-06-21
**Surfaces:** aigentMe (experience guide), metaMe Studio, Venture Lab
**Branch:** `claude/optimistic-davinci-exiykx`

## Gap closed

The experience-guide setup (experience model + `personalGuide` + the persona's
VentureQube) was the intended source of truth, but **nothing derived a matrix
position from it, and the three matrix surfaces were disconnected islands**:
- no derivation service mapped experience stage / alignment / venture stage → a
  matrix coordinate;
- VentureQube (v0.4 + v1.0) was independent of the experience model;
- the Studio matrix was aggregate-only (no per-persona position);
- the Venture Lab growth matrix was manual/sample-only ("No ventures plotted").

## What shipped

### Keystone — shared derivation
- `services/strategy/experienceMatrixDeriver.ts` — `deriveMatrixCalibration(admin,
  personaId)` reads the experience model (`current_stage`, `personalGuide`
  sphere maturity) + the persona's `venture_qubes` and returns:
  - **growth** coordinate (maturity Y × commercialization X + zone) for the
    Venture Lab growth matrix,
  - **experience** coordinate (engagement × sovereignty) for the Studio/customer
    matrix,
  - **per-venture** growth points so a persona's own ventures plot automatically.
  Lead VentureQube wins; else the experience-model stage; else a default. All
  mappings explicit + documented + tunable; soft-fails.
- `GET /api/experience/matrix-calibration` — the single SoT-derived feed all
  three surfaces read (persona-scoped, T1-safe).

### Surfaces aligned to the SoT
- **Venture Lab** (`VentureFunnelTab`) — plots the persona's OWN ventures on the
  growth matrix (amber markers), rings their headline growth cell, rings their
  derived cell on the customer matrix, and shows a "Your position (from
  experience guide)" banner.
- **metaMe Studio** (`ComposerStudio`) — fetches the calibration and rings the
  active persona's own cell in the matrix (amber), additive alongside the
  existing individual/cohort highlights. KNYT path untouched.
- **aigentMe** — the experience guide is the origin SoT; the same endpoint is
  available for its surfaces to consume (thin follow-up to add a visible badge).

## Result
All three surfaces now resolve the persona's matrix position from one
derivation. Configure the experience model / a VentureQube → the position
updates everywhere. Mappings (stage → coordinate) are the tuning knobs.

## Follow-ups
- Add a calibration badge to an aigentMe experience surface (uses the same endpoint).
- Tune the stage→coordinate mappings with the operator against live data.
- Optionally persist the calibration onto `experience_qubes` for history.
