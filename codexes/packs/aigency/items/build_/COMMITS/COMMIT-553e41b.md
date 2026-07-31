# Commit Brief: `553e41b` — fix activations flicker: add mutation generation guard to prevent stale refresh overwriting optimistic state

| Field | Value |
|-------|-------|
| SHA | [`553e41b`](https://github.com/iQube-Protocol/AigentZBeta/commit/553e41b5e67381c99ccea20b2c59a1630e67f886) |
| Author | Claude |
| Date | 2026-06-18T21:32:12Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix activations flicker: add mutation generation guard to prevent stale refresh overwriting optimistic state

The activations tab toggle would flick ON then immediately OFF because
background refresh() calls (triggered by personaId hydration) could
resolve after the optimistic state was set but before the mutation's own
refresh completed, overwriting the optimistic active state with stale
pre-mutation data.

Fix: a mutation generation counter (mutationGenRef) incremented on
mutation start and checked when refresh results arrive. If the generation
changed while a refresh was in flight, its results are discarded —
only the post-mutation refresh applies server state.

Also adds missing aigent-z and polity-passport seed rows to the
activation_tab_qubes migration (catalog has 9 entries, seed had 7).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

The activations tab toggle would flick ON then immediately OFF because
background refresh() calls (triggered by personaId hydration) could
resolve after the optimistic state was set but before the mutation's own
refresh completed, overwriting the optimistic active state with stale
pre-mutation data.

Fix: a mutation generation counter (mutationGenRef) incremented on
mutation start and checked when refresh results arrive. If the generation
changed while a refresh was in flight, its results are discarded —
only the post-mutation refresh applies server state.

Also adds missing aigent-z and polity-passport seed rows to the
activation_tab_qubes migration (catalog has 9 entries, seed had 7).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/activations/ActivationsContext.tsx` |
| Modified | `supabase/migrations/20260524000000_activation_tab_content_qubes.sql` |

## Stats

 2 files changed, 30 insertions(+), 9 deletions(-)
