# Commit Brief: `3c1551d` — Add canonical participant research-workspace access resolver

| Field | Value |
|-------|-------|
| SHA | [`3c1551d`](https://github.com/iQube-Protocol/AigentZBeta/commit/3c1551d7501b0bb96581cef25bc3155a200ee260) |
| Author | Claude |
| Date | 2026-09-02T12:59:22Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add canonical participant research-workspace access resolver

Composes the existing access_grants reach resolver
(getBoundaryResearchReadableExperiments) with the pre-existing but
previously-unread ResearchWorkspace.visibility field into ONE
canViewExperiment-shaped predicate (canViewResearchWorkspace) and one
server projection (getParticipantResearchWorkspaceAccess), exposed at
GET /api/participation/my-experiments. Restores the general rule: a
research workspace declared visibility:'public' is visible to any
caller with zero grant; a private/invited workspace is visible only to
a persona holding a matching research-lab entitlement; admins see
everything. No new persistence — reuses access_grants and the research
workspace registry exactly as they already exist.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Composes the existing access_grants reach resolver
(getBoundaryResearchReadableExperiments) with the pre-existing but
previously-unread ResearchWorkspace.visibility field into ONE
canViewExperiment-shaped predicate (canViewResearchWorkspace) and one
server projection (getParticipantResearchWorkspaceAccess), exposed at
GET /api/participation/my-experiments. Restores the general rule: a
research workspace declared visibility:'public' is visible to any
caller with zero grant; a private/invited workspace is visible only to
a persona holding a matching research-lab entitlement; admins see
everything. No new persistence — reuses access_grants and the research
workspace registry exactly as they already exist.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/participation/my-experiments/route.ts` |
| Modified | `services/passport/participationAccess.ts` |

## Stats

 2 files changed, 154 insertions(+)
