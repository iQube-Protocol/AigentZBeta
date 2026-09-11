# Commit Brief: `d0d5618` — trinity rename: code surface — disambiguate iQube primitives from SmartTriad

| Field | Value |
|-------|-------|
| SHA | [`d0d5618`](https://github.com/iQube-Protocol/AigentZBeta/commit/d0d561824e882545f08daceb4ab095c8d2bea23c) |
| Author | Claude |
| Date | 2026-05-31T19:47:03Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
trinity rename: code surface — disambiguate iQube primitives from SmartTriad

Per operator decision (Option A): rename the code-facing identifiers +
prose for the iQube cryptographic spine (MetaQube + BlakQube +
TokenQube) from "triad" to "trinity" so the term doesn't collide with
SmartTriad (Codex + Copilot + Wallet) at the experience layer.

Renamed:
- getQubeTriad             → getQubeTrinity         (iqRegistryService)
- loadTriadFromContentQube → loadTrinityFromContentQube (contentQubeAdapter)
- loadTriadMetaRows        → loadTrinityMetaRows    (runBackfill)
- local `const triad`      → local `const trinity`  (contentQubeAdapter)
- JSDoc + comments + error detail strings across the registry plane
- docs/iqube-score-derivation.md prose

Deliberately NOT touched (per Option A scope):
- DB-stored enum literals `'triad_meta'`, `'triad_blak'`, `'triad_token'`
  (~98+ live iqube_id_map rows reference these)
- `IQubeIdMapSource` type alias name (avoids churning 15+ import sites)
- Historical close reports + PRD drafts (immutable accounts of what
  shipped at that point)
- SmartTriad (~317 refs untouched — that's the OTHER trio)

Naming convention doc:
codexes/packs/agentiq/updates/2026-05-31_iqube-trinity-naming-convention.md
```

## Body

Per operator decision (Option A): rename the code-facing identifiers +
prose for the iQube cryptographic spine (MetaQube + BlakQube +
TokenQube) from "triad" to "trinity" so the term doesn't collide with
SmartTriad (Codex + Copilot + Wallet) at the experience layer.

Renamed:
- getQubeTriad             → getQubeTrinity         (iqRegistryService)
- loadTriadFromContentQube → loadTrinityFromContentQube (contentQubeAdapter)
- loadTriadMetaRows        → loadTrinityMetaRows    (runBackfill)
- local `const triad`      → local `const trinity`  (contentQubeAdapter)
- JSDoc + comments + error detail strings across the registry plane
- docs/iqube-score-derivation.md prose

Deliberately NOT touched (per Option A scope):
- DB-stored enum literals `'triad_meta'`, `'triad_blak'`, `'triad_token'`
  (~98+ live iqube_id_map rows reference these)
- `IQubeIdMapSource` type alias name (avoids churning 15+ import sites)
- Historical close reports + PRD drafts (immutable accounts of what
  shipped at that point)
- SmartTriad (~317 refs untouched — that's the OTHER trio)

Naming convention doc:
codexes/packs/agentiq/updates/2026-05-31_iqube-trinity-naming-convention.md

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/registry/iqube/[id]/fork/route.ts` |
| Modified | `app/api/registry/iqube/[id]/route.ts` |
| Modified | `app/api/registry/iqube/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-31_iqube-trinity-naming-convention.md` |
| Modified | `docs/iqube-score-derivation.md` |
| Modified | `server/services/iqRegistryService.ts` |
| Modified | `services/registry/adapters/contentQubeAdapter.ts` |
| Modified | `services/registry/backfill/runBackfill.ts` |
| Modified | `services/registry/legacy/legacyAdapter.ts` |
| Modified | `services/registry/scoreBackfill/clusterQubeScores.ts` |

## Stats

 11 files changed, 151 insertions(+), 25 deletions(-)
