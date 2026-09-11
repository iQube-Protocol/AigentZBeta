# Commit Brief: `802b690` — add invariant registry browsing tab: list, filter, standing/reach, detail view

| Field | Value |
|-------|-------|
| SHA | [`802b690`](https://github.com/iQube-Protocol/AigentZBeta/commit/802b6906b6b679b685470766b37e3ffb52bf04c9) |
| Author | Claude |
| Date | 2026-07-04T03:11:24Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add invariant registry browsing tab: list, filter, standing/reach, detail view

Closes the visibility gap flagged in the previous session doc: the live invariant substrate (CFS-001..014) had no browsing UI, API-only.

New tab: AgentiQ cartridge -> Registry -> Invariant Registry. Namespace/status filters + search + sort (standing/reach/recent), grid/table toggle, Standing+Reach as separate 5-dot gauges (Law XII orthogonality visible at a glance). Reuses the generic Pagination + ViewModeToggle from components/registry/ (confirmed iQube-agnostic before reuse); does not reuse FilterSection (hardcoded iQube business-model vocabulary) or IQubeDetailModal internals (mirrors its self-fetch-by-id modal shape only, in a fresh lightweight component).

Extended GET /api/invariants/[id] to batch-resolve neighbor invariant statements alongside edges, so the detail view shows readable graph relationships instead of raw UUIDs.

Registered in TabRenderer.tsx's componentRegistry (the single mechanism resolving data/codex-configs.ts's config.component strings to React components, confirmed via research before writing).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Closes the visibility gap flagged in the previous session doc: the live invariant substrate (CFS-001..014) had no browsing UI, API-only.

New tab: AgentiQ cartridge -> Registry -> Invariant Registry. Namespace/status filters + search + sort (standing/reach/recent), grid/table toggle, Standing+Reach as separate 5-dot gauges (Law XII orthogonality visible at a glance). Reuses the generic Pagination + ViewModeToggle from components/registry/ (confirmed iQube-agnostic before reuse); does not reuse FilterSection (hardcoded iQube business-model vocabulary) or IQubeDetailModal internals (mirrors its self-fetch-by-id modal shape only, in a fresh lightweight component).

Extended GET /api/invariants/[id] to batch-resolve neighbor invariant statements alongside edges, so the detail view shows readable graph relationships instead of raw UUIDs.

Registered in TabRenderer.tsx's componentRegistry (the single mechanism resolving data/codex-configs.ts's config.component strings to React components, confirmed via research before writing).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/invariants/[id]/route.ts` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Added | `app/triad/components/codex/tabs/InvariantDetailModal.tsx` |
| Added | `app/triad/components/codex/tabs/InvariantRegistryTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-04_invariant-registry-tab.md` |
| Modified | `data/codex-configs.ts` |

## Stats

 7 files changed, 663 insertions(+), 4 deletions(-)
