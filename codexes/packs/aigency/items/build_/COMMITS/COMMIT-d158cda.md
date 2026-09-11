# Commit Brief: `d158cda` — Add acceptance tests for IRL OS experiment membership resolver [merge feature/irl-experiment-membership-workspace]

| Field | Value |
|-------|-------|
| SHA | [`d158cda`](https://github.com/iQube-Protocol/AigentZBeta/commit/d158cdac69cbf63b116de03bf1a56ddc09ef1743) |
| Author | Claude |
| Date | 2026-09-02T12:59:23Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add acceptance tests for IRL OS experiment membership resolver [merge feature/irl-experiment-membership-workspace]

Covers the canViewResearchWorkspace predicate and the
getParticipantResearchWorkspaceAccess/my-experiments projection:
public-without-grant, private-default-deny, an OCSGA-shaped grant
(Ian) sees only its own workspace, an EXP-P1+Validation-shaped grant
(Austin) sees both and never OCSGA, revocation removes access
immediately, and admin sees everything -- plus structural canaries
that the resolver and its route compose the existing access_grants
resolver rather than a parallel authorization system.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Covers the canViewResearchWorkspace predicate and the
getParticipantResearchWorkspaceAccess/my-experiments projection:
public-without-grant, private-default-deny, an OCSGA-shaped grant
(Ian) sees only its own workspace, an EXP-P1+Validation-shaped grant
(Austin) sees both and never OCSGA, revocation removes access
immediately, and admin sees everything -- plus structural canaries
that the resolver and its route compose the existing access_grants
resolver rather than a parallel authorization system.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `tests/irl-experiment-membership-workspace.test.ts` |

## Stats

 2 files changed, 156 insertions(+), 1 deletion(-)
