# Commit Brief: `1994a91` — docs: aigentMe voice-loop Phase 2 backlog + Venture iQube schema v0.1

| Field | Value |
|-------|-------|
| SHA | [`1994a91`](https://github.com/iQube-Protocol/AigentZBeta/commit/1994a919eee61ca0b8be48bbaa4a5934d3cdd378) |
| Author | Claude |
| Date | 2026-05-30T00:37:00Z |
| Branch | dev (direct push) |
| Type | `docs` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
docs: aigentMe voice-loop Phase 2 backlog + Venture iQube schema v0.1

Two AgentiQ Updates entries, both registered in collections.json so
they surface in the AgentiQ Cartridge Updates tab.

1) Voice-loop backlog (Phase 2, high-impact)
   2026-05-29_aigentme-voice-loop-stt-tts-sync-backlog.md captures
   the operator ask: fuse the three currently-independent voice
   surfaces (mic input → /api/skills/stt; speaker icon →
   /api/skills/tts; quick-action chips) into one seamless STT ↔ TTS
   ↔ quick-action turn loop. Covers continuous-voice toggle,
   auto-listen on TTS end, voice-bargein, fuzzy-matched quick-action
   dispatch, R/T pulse extension to the STT capture window, and
   per-turn voice_turn_completed DVN receipt shape.

2) Venture iQube schema v0.1 (operator-strategy iQube spec)
   2026-05-29_venture-iqube-schema-v0.1.md is the JSON Schema the
   operator can paste into ChatGPT to emit a populated venture
   iQube file. Covers operator identity + strategic thesis +
   one-or-more ventures (cartridge-bound) + objectives + four
   horizon plan bands (today / 24h / 7d / 30d / 90d) +
   specialist preferences + cross-venture KPI board. Designed to
   round-trip into ExperienceQube.meta (headline, primaryGoal,
   currentStage, activeCartridges) + IntentQube records (one per
   objective + horizon action) once /api/persona/venture-iqube/
   ingest lands. Versioned (schemaVersion: 'venture-iqube/v0.1')
   so v0.2+ can extend with reputation / treasury / encryption
   without a refactor. Includes a worked example skeleton for
   operator-dele's three ventures (metaMe / KNYT / Qriptopian) and
   a roadmap toward promoting v1.0 to a first-class VentureQube.
```

## Body

Two AgentiQ Updates entries, both registered in collections.json so
they surface in the AgentiQ Cartridge Updates tab.

1) Voice-loop backlog (Phase 2, high-impact)
   2026-05-29_aigentme-voice-loop-stt-tts-sync-backlog.md captures
   the operator ask: fuse the three currently-independent voice
   surfaces (mic input → /api/skills/stt; speaker icon →
   /api/skills/tts; quick-action chips) into one seamless STT ↔ TTS
   ↔ quick-action turn loop. Covers continuous-voice toggle,
   auto-listen on TTS end, voice-bargein, fuzzy-matched quick-action
   dispatch, R/T pulse extension to the STT capture window, and
   per-turn voice_turn_completed DVN receipt shape.

2) Venture iQube schema v0.1 (operator-strategy iQube spec)
   2026-05-29_venture-iqube-schema-v0.1.md is the JSON Schema the
   operator can paste into ChatGPT to emit a populated venture
   iQube file. Covers operator identity + strategic thesis +
   one-or-more ventures (cartridge-bound) + objectives + four
   horizon plan bands (today / 24h / 7d / 30d / 90d) +
   specialist preferences + cross-venture KPI board. Designed to
   round-trip into ExperienceQube.meta (headline, primaryGoal,
   currentStage, activeCartridges) + IntentQube records (one per
   objective + horizon action) once /api/persona/venture-iqube/
   ingest lands. Versioned (schemaVersion: 'venture-iqube/v0.1')
   so v0.2+ can extend with reputation / treasury / encryption
   without a refactor. Includes a worked example skeleton for
   operator-dele's three ventures (metaMe / KNYT / Qriptopian) and
   a roadmap toward promoting v1.0 to a first-class VentureQube.

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-29_aigentme-voice-loop-stt-tts-sync-backlog.md` |
| Added | `codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.1.md` |

## Stats

 3 files changed, 478 insertions(+)
