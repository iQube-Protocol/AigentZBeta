# Commit Brief: `a180ab5` — move invariant registry to canonical home: iqube registry cartridge, sibling tab

| Field | Value |
|-------|-------|
| SHA | [`a180ab5`](https://github.com/iQube-Protocol/AigentZBeta/commit/a180ab59e88b250864c680b2a58d0a4864c6fd76) |
| Author | Claude |
| Date | 2026-07-04T03:27:46Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
move invariant registry to canonical home: iqube registry cartridge, sibling tab

Corrected placement after reviewing a live screenshot of the deployed iQube Registry cartridge. Considered adding 'Invariant' as a filter pill inside Browse iQubes (next to ContentQube/ToolQube/.../ModelQube) but rejected it: raw invariants are not iqube_id_map rows -- only published InvariantQubes register there, staged as DataQube per CFS-004 Sec3 Stage 1 (promotion to a genuine 7th primitive awaits a future canonization request). A pill in that closed six-primitive set would visually claim otherwise.

Added as a sibling tab instead: IQUBE_REGISTRY_CARTRIDGE.tabs gains 'iqube-registry-invariants' (group: browse, order 3, after Browse iQubes/Intake/DVN Receipts/Passports), component: InvariantRegistryTab -- already registered in TabRenderer.tsx's componentRegistry from the prior commit, so no new wiring needed there. IQubeRegistryBrowseTab.tsx read for reference only, left untouched. The AgentiQ cartridge tab from the prior commit remains as an explicit mirror.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Corrected placement after reviewing a live screenshot of the deployed iQube Registry cartridge. Considered adding 'Invariant' as a filter pill inside Browse iQubes (next to ContentQube/ToolQube/.../ModelQube) but rejected it: raw invariants are not iqube_id_map rows -- only published InvariantQubes register there, staged as DataQube per CFS-004 Sec3 Stage 1 (promotion to a genuine 7th primitive awaits a future canonization request). A pill in that closed six-primitive set would visually claim otherwise.

Added as a sibling tab instead: IQUBE_REGISTRY_CARTRIDGE.tabs gains 'iqube-registry-invariants' (group: browse, order 3, after Browse iQubes/Intake/DVN Receipts/Passports), component: InvariantRegistryTab -- already registered in TabRenderer.tsx's componentRegistry from the prior commit, so no new wiring needed there. IQubeRegistryBrowseTab.tsx read for reference only, left untouched. The AgentiQ cartridge tab from the prior commit remains as an explicit mirror.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/updates/2026-07-04_invariant-registry-tab.md` |
| Modified | `data/codex-configs.ts` |

## Stats

 2 files changed, 24 insertions(+)
