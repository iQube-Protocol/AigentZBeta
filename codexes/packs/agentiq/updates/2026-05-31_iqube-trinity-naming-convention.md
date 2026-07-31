# iQube Trinity Naming Convention — Disambiguation from SmartTriad

**Date:** 2026-05-31
**Status:** Shipped on `claude/dreamy-gates-mMqNv`. Forward-looking code uses "trinity" for the iQube primitive trio (MetaQube + BlakQube + TokenQube); SmartTriad continues to mean the experience layer (Codex + Copilot + Wallet).
**Triggered by:** Operator question on naming overlap risk.

---

## The two trios

| Layer | Components | Term going forward |
|---|---|---|
| iQube cryptographic spine | **MetaQube** + **BlakQube** + **TokenQube** | **trinity** |
| Experience surface | **Codex** + **Copilot** + **Wallet** | **SmartTriad** |

Before this rename both were called "triad" in code prose + JSDoc, which made it hard to read code that touches both layers (the iQube registry plane sits near the SmartTriad copilot layer at several seams).

---

## What changed (code surface)

Pure mechanical rename of code-facing identifiers + prose. **DB enum values, type-union literals, and stored data were intentionally NOT touched.**

### Renamed identifiers

| Old | New | File |
|---|---|---|
| `getQubeTriad` | `getQubeTrinity` | `server/services/iqRegistryService.ts` |
| `loadTriadFromContentQube` | `loadTrinityFromContentQube` | `services/registry/adapters/contentQubeAdapter.ts` |
| `loadTriadMetaRows` | `loadTrinityMetaRows` | `services/registry/backfill/runBackfill.ts` |
| local `const triad =` | local `const trinity =` | `services/registry/adapters/contentQubeAdapter.ts` |

### Renamed prose / JSDoc

Across `services/registry/`, `app/api/registry/`, `server/services/iqRegistryService.ts`, `docs/iqube-score-derivation.md`:
- "iQube triad" → "iQube trinity"
- "triad spine" → "trinity spine"
- "triad refs" → "trinity refs"
- "triad meta row" → "trinity meta row"
- "triad-backed parent" → "trinity-backed parent"
- "bridged-triad columns" → "bridged-trinity columns"

### Error-detail strings (API responses)

| Route | Old detail | New detail |
|---|---|---|
| `POST /api/registry/iqube/[id]/fork` | `fork requires a triad-backed parent` | `fork requires a trinity-backed parent` |
| `PATCH /api/registry/iqube/[id]` | `cannot patch a record without a triad meta row` | `cannot patch a record without a trinity meta row` |

External callers parsing these strings would be a smell — they should match on the `error` code (`parent_has_no_meta_qube`, `no_meta_qube`) which is unchanged.

---

## What was deliberately NOT changed

### DB-stored enum values

`iqube_id_map.source` carries the literal values:
- `'triad_meta'`
- `'triad_blak'`
- `'triad_token'`

These are part of the `IQubeIdMapSource` type union (`types/registry-canonical.ts`) and a CHECK constraint on the column. ~98+ live rows in dev Supabase have `source = 'triad_meta'`. Renaming these would require:
- ALTER TYPE / CHECK constraint
- UPDATE every existing row
- Coordinated deploy ordering

This was Option B in the original assessment — explicitly out of scope per operator decision. Future cleanup workstream can pick it up if it ever becomes useful, but the disambiguation benefit is already captured: the SDK/code/operator-facing surface reads "trinity", the internal serialization detail "triad_meta" is invisible to humans.

### `IQubeIdMapSource` type alias name

Renaming the type alias itself would force every reference site (~15 files) to update imports. The type's union members (`'triad_meta'` etc.) carry the disambiguation cost at the value level; the alias name doesn't introduce confusion in practice.

### Historical close reports + PRD docs

Close reports and PRD drafts dated 2026-05-30 / 2026-05-31 describe what shipped at that point in time using the then-current term. Rewriting them retroactively churns history without value. The convention going forward is set by:
1. This naming-convention doc
2. The forward-facing reference: `docs/iqube-score-derivation.md` (updated)
3. The JSDoc + comments in the registry code surface (updated)

New docs from this point on should use "trinity" for the iQube primitive trio.

### SmartTriad

Zero changes. ~317 references across `components/smarttriad/`, `packages/smarttriad/`, `app/triad/`, etc. all remain. The disambiguation is one-sided: "trinity" is the new term for the iQube layer; "SmartTriad" continues to mean the experience layer exactly as it did.

---

## Where the boundary sits

When reading code that mentions a "three-part" structure in an iQube context:

- **Trinity** when referring to: a single iQube's cryptographic spine (one MetaQube + one BlakQube + one TokenQube per asset); resolver/adapter code; backfill workstreams; canonical record references; `iqube_id_map` source surfaces
- **SmartTriad** when referring to: the right-pane copilot ecosystem; codex tabs + copilot layer + wallet; cross-cartridge navigation between those three surfaces; component paths like `components/smarttriad/`

If a single sentence touches both layers, name them explicitly: "the iQube trinity surfaces in the SmartTriad codex via …".

---

## Files touched in this change

```
docs/iqube-score-derivation.md
server/services/iqRegistryService.ts
services/registry/adapters/contentQubeAdapter.ts
services/registry/backfill/runBackfill.ts
services/registry/scoreBackfill/clusterQubeScores.ts
services/registry/legacy/legacyAdapter.ts
app/api/registry/iqube/route.ts
app/api/registry/iqube/[id]/route.ts
app/api/registry/iqube/[id]/fork/route.ts
```

Plus this naming-convention doc.

---

**End of trinity naming-convention note.**
