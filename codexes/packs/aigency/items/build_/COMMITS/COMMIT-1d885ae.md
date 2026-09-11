# Commit Brief: `1d885ae` — Add MCP channel-equivalence acceptance tests for OCSGA delegated completion

| Field | Value |
|-------|-------|
| SHA | [`1d885ae`](https://github.com/iQube-Protocol/AigentZBeta/commit/1d885ae175a8e4a3bfaf1c05580b39e089568fca) |
| Author | Claude |
| Date | 2026-08-30T14:01:17Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add MCP channel-equivalence acceptance tests for OCSGA delegated completion

Proves the Threshold MCP path (confirm/freeze/sign) resolves Ian's
principal identically to the bridge — via session.principalPublicRef,
never currentAigentMe/resolveConstitutionalContext — while agentAlias
carries the delegated actor separately. Covers: successful delegated
confirm/freeze/sign; principal pinned to Ian and actor pinned to
aigentMe across all three; no persona-switch coupling; source canaries
proving both channels import the same canonical reciprocalExchange
functions and neither references the old defect's currentAigentMe
check; fail-closed on unresolvable principal, no active exchange, and
missing session scope.
```

## Body

Proves the Threshold MCP path (confirm/freeze/sign) resolves Ian's
principal identically to the bridge — via session.principalPublicRef,
never currentAigentMe/resolveConstitutionalContext — while agentAlias
carries the delegated actor separately. Covers: successful delegated
confirm/freeze/sign; principal pinned to Ian and actor pinned to
aigentMe across all three; no persona-switch coupling; source canaries
proving both channels import the same canonical reciprocalExchange
functions and neither references the old defect's currentAigentMe
check; fail-closed on unresolvable principal, no active exchange, and
missing session scope.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `tests/threshold-mcp-constitutional-rituals.test.ts` |

## Stats

 2 files changed, 172 insertions(+), 1 deletion(-)
