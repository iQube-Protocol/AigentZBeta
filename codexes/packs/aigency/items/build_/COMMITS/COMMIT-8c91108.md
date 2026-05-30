# Commit Brief: `8c91108` — Venture iQube v0.2: add studio / iqube-registry / moneypenny / legal-metacommons to cartridgeSlug enum

| Field | Value |
|-------|-------|
| SHA | [`8c91108`](https://github.com/iQube-Protocol/AigentZBeta/commit/8c911082f70991a7aa9f4d91036a89ed26e5920f) |
| Author | Claude |
| Date | 2026-05-30T00:58:08Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Venture iQube v0.2: add studio / iqube-registry / moneypenny / legal-metacommons to cartridgeSlug enum

Operator's first ChatGPT-populated v0.1 file (Operation metaWill,
2026-05-29) flagged four cartridge bindings the v0.1 enum couldn't
express. Three of them map to sub-surfaces that exist today
(studio = tabGroup in metame-codex; iqube-registry = tab in
agentiq-os-cartridge; moneypenny = treasury surface, currently a
specialist agent that owns the Qc/QriptoCENT mental model);
legal-metacommons is a 2027 deep-commons stub so ventures can mark
forward dependencies without burying them in the notes field.

v0.2 changes:
  - cartridgeSlug enum gains: studio, iqube-registry, moneypenny,
    legal-metacommons.
  - schemaVersion bumps to "venture-iqube/v0.2"; ingest accepts both
    v0.1 and v0.2, forward-only (v0.2 supersedes v0.1 under the same
    personaId).
  - Sub-surface binding semantics documented: aigentMe's ingest
    mapper translates studio → metame-codex+tabGroup, iqube-registry
    → agentiq-os-cartridge+slug, moneypenny → active Qc surface or
    moneypenny specialist routing, legal-metacommons → recorded but
    no live NBE surface.
  - Operator prompt update for re-running ChatGPT included so the
    next Venture iQube file binds Studio, Registry, Qc, and the
    legal/metaCommons 2027 horizon to the real (v0.2) slugs instead
    of v0.1 workarounds.

No code touched. /api/persona/venture-iqube/ingest still pending; the
v0.1 doc's ingest roadmap covers it.
```

## Body

Operator's first ChatGPT-populated v0.1 file (Operation metaWill,
2026-05-29) flagged four cartridge bindings the v0.1 enum couldn't
express. Three of them map to sub-surfaces that exist today
(studio = tabGroup in metame-codex; iqube-registry = tab in
agentiq-os-cartridge; moneypenny = treasury surface, currently a
specialist agent that owns the Qc/QriptoCENT mental model);
legal-metacommons is a 2027 deep-commons stub so ventures can mark
forward dependencies without burying them in the notes field.

v0.2 changes:
  - cartridgeSlug enum gains: studio, iqube-registry, moneypenny,
    legal-metacommons.
  - schemaVersion bumps to "venture-iqube/v0.2"; ingest accepts both
    v0.1 and v0.2, forward-only (v0.2 supersedes v0.1 under the same
    personaId).
  - Sub-surface binding semantics documented: aigentMe's ingest
    mapper translates studio → metame-codex+tabGroup, iqube-registry
    → agentiq-os-cartridge+slug, moneypenny → active Qc surface or
    moneypenny specialist routing, legal-metacommons → recorded but
    no live NBE surface.
  - Operator prompt update for re-running ChatGPT included so the
    next Venture iQube file binds Studio, Registry, Qc, and the
    legal/metaCommons 2027 horizon to the real (v0.2) slugs instead
    of v0.1 workarounds.

No code touched. /api/persona/venture-iqube/ingest still pending; the
v0.1 doc's ingest roadmap covers it.

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.2.md` |

## Stats

 2 files changed, 81 insertions(+)
