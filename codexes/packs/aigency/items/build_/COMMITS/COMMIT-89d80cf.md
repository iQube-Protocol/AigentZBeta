# Commit Brief: `89d80cf` — AgentiQ OS: stub Admin tabGroup so the mirror has content

| Field | Value |
|-------|-------|
| SHA | [`89d80cf`](https://github.com/iQube-Protocol/AigentZBeta/commit/89d80cfd47367eb3754cc9a1afc9ce24fc82007e) |
| Author | Claude |
| Date | 2026-05-26T10:12:01Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
AgentiQ OS: stub Admin tabGroup so the mirror has content

Same chief-of-staff pattern, but AgentiQ OS didn't yet have admin
content of its own — so the metaMe-side mirror was empty and the
"AgentiQ OS Admin" parent tab rendered with no sub-tabs (which
combined with the missing TabRendererFallback registration showed
nothing at all).

Adds a real Admin tabGroup to AGENTIQ_OS_CARTRIDGE with a single
stub child (PlaceholderTab) explaining the surface is pending real
admin workflow content (registry ops, agent lifecycle, etc.). The
tabGroup carries adminOnly: true so only admins ever see the
top-level tab on the AgentiQ OS cartridge itself.

Updates agentiqOsAdminTabsForMetameAgentiqos() to filter by
`group === 'admin'` instead of the prior `adminOnly && no group`
heuristic — the new tabGroup is the canonical source now.

Outcome
-------
- AgentiQ OS cartridge: admins see an "Admin" tabGroup at the top
  level with a single AgentiQ OS Admin placeholder.
- metaMe agentiqos group: admins see "AgentiQ OS Admin" sub-tab
  (parent) with the same placeholder as tier-3 — no more empty
  parent, no more red "Component not found" placeholder.
- Non-admins see neither surface, same fail-closed posture.

When real AIQ-OS admin content lands, swap PlaceholderTab for the
real component and add siblings in the admin tabGroup. Both the
in-cartridge surface AND the metaMe mirror update from that single
declaration.
```

## Body

Same chief-of-staff pattern, but AgentiQ OS didn't yet have admin
content of its own — so the metaMe-side mirror was empty and the
"AgentiQ OS Admin" parent tab rendered with no sub-tabs (which
combined with the missing TabRendererFallback registration showed
nothing at all).

Adds a real Admin tabGroup to AGENTIQ_OS_CARTRIDGE with a single
stub child (PlaceholderTab) explaining the surface is pending real
admin workflow content (registry ops, agent lifecycle, etc.). The
tabGroup carries adminOnly: true so only admins ever see the
top-level tab on the AgentiQ OS cartridge itself.

Updates agentiqOsAdminTabsForMetameAgentiqos() to filter by
`group === 'admin'` instead of the prior `adminOnly && no group`
heuristic — the new tabGroup is the canonical source now.

Outcome
-------
- AgentiQ OS cartridge: admins see an "Admin" tabGroup at the top
  level with a single AgentiQ OS Admin placeholder.
- metaMe agentiqos group: admins see "AgentiQ OS Admin" sub-tab
  (parent) with the same placeholder as tier-3 — no more empty
  parent, no more red "Component not found" placeholder.
- Non-admins see neither surface, same fail-closed posture.

When real AIQ-OS admin content lands, swap PlaceholderTab for the
real component and add siblings in the admin tabGroup. Both the
in-cartridge surface AND the metaMe mirror update from that single
declaration.

## Files Changed

| Change | File |
|--------|------|
| Modified | `data/codex-configs.ts` |

## Stats

 1 file changed, 39 insertions(+), 4 deletions(-)
