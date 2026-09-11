# Commit Brief: `b907029` — archive duplicate AgentiQ OS codex + restore 3rd-tier sub-tab nav row

| Field | Value |
|-------|-------|
| SHA | [`b907029`](https://github.com/iQube-Protocol/AigentZBeta/commit/b907029f0691b8c30f9e6c6802aecc492ac89f67) |
| Author | Claude |
| Date | 2026-05-26T03:33:08Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
archive duplicate AgentiQ OS codex + restore 3rd-tier sub-tab nav row

Two cleanup items the operator flagged.

1) Duplicate AgentiQ OS removed from CODEX_DEFINITIONS

The standalone /triad/embed/codex/agentiq-os surface was a second
copy of the AgentiQ OS content already exposed inline as the
`agentiqos` tabGroup inside METAME_CODEX (via aiqOsTabsByGroup).
Operators landing on the standalone URL got confused about which is
canonical. Drops AGENTIQ_OS_CARTRIDGE from the CODEX_DEFINITIONS
registry so the duplicate embed route no longer resolves, but keeps
the constant exported so aiqOsTabsByGroup can continue reading the
source tab definitions from a single place. A comment in the
registry block documents the archive + the indirect dependency.

2) Tier-3 sub-sub-tab row restored for multi-tab groups

Regression introduced by ed2ad425 ("split tab: outer padding...
third-tier subTabs mechanism wired through AgentiQ OS group"). The
nav-bar render branches in CodexPanelDynamic were mutually exclusive
via an if / else if: multi-tab groups rendered tier-2 sibling tabs;
single-tab groups with subTabs rendered tier-3 in the tier-2 slot.
The new AgentiQ OS structure is BOTH — a multi-tab group whose
active tab also has subTabs — and the else-if branch never fired,
so the tier-3 row silently disappeared.

Adds a second nav row immediately below the existing one that
renders activeSubTabs whenever:
  - the active group has multiple sibling tabs (tier-2 is already
    rendering siblings above), AND
  - the active tab has its own subTabs (tier-3 content exists)

The single-tab-with-subTabs branch above is left intact so
single-tab groups (e.g. legacy Order of Metayé) keep promoting their
subTabs into the tier-2 slot — that path was correct, the new path
just adds back the case it didn't cover.

Same pattern unblocks the planned admin-tab-in-activation
surfacing: any metaMe group that mounts a foreign cartridge's admin
tab will need this second row to render the admin tab's own sub-nav.
```

## Body

Two cleanup items the operator flagged.

1) Duplicate AgentiQ OS removed from CODEX_DEFINITIONS

The standalone /triad/embed/codex/agentiq-os surface was a second
copy of the AgentiQ OS content already exposed inline as the
`agentiqos` tabGroup inside METAME_CODEX (via aiqOsTabsByGroup).
Operators landing on the standalone URL got confused about which is
canonical. Drops AGENTIQ_OS_CARTRIDGE from the CODEX_DEFINITIONS
registry so the duplicate embed route no longer resolves, but keeps
the constant exported so aiqOsTabsByGroup can continue reading the
source tab definitions from a single place. A comment in the
registry block documents the archive + the indirect dependency.

2) Tier-3 sub-sub-tab row restored for multi-tab groups

Regression introduced by ed2ad425 ("split tab: outer padding...
third-tier subTabs mechanism wired through AgentiQ OS group"). The
nav-bar render branches in CodexPanelDynamic were mutually exclusive
via an if / else if: multi-tab groups rendered tier-2 sibling tabs;
single-tab groups with subTabs rendered tier-3 in the tier-2 slot.
The new AgentiQ OS structure is BOTH — a multi-tab group whose
active tab also has subTabs — and the else-if branch never fired,
so the tier-3 row silently disappeared.

Adds a second nav row immediately below the existing one that
renders activeSubTabs whenever:
  - the active group has multiple sibling tabs (tier-2 is already
    rendering siblings above), AND
  - the active tab has its own subTabs (tier-3 content exists)

The single-tab-with-subTabs branch above is left intact so
single-tab groups (e.g. legacy Order of Metayé) keep promoting their
subTabs into the tier-2 slot — that path was correct, the new path
just adds back the case it didn't cover.

Same pattern unblocks the planned admin-tab-in-activation
surfacing: any metaMe group that mounts a foreign cartridge's admin
tab will need this second row to render the admin tab's own sub-nav.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/CodexPanelDynamic.tsx` |
| Modified | `data/codex-configs.ts` |

## Stats

 2 files changed, 45 insertions(+), 1 deletion(-)
