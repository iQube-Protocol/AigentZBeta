# Commit Brief: `afdc85f` — seed standing-cartridge activation qube so the catalog card works

| Field | Value |
|-------|-------|
| SHA | [`afdc85f`](https://github.com/iQube-Protocol/AigentZBeta/commit/afdc85ff223adb53f3a50c7c2a5dcb7a66463064) |
| Author | Claude |
| Date | 2026-06-19T16:17:08Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
seed standing-cartridge activation qube so the catalog card works

Root cause: standing-cartridge was added to ACTIVATION_CATALOG after the
original activation seed migration, which only seeded through
polity-passport. With no backing content_qubes row (content_kind=
'activation_tab', content_type='standing-cartridge'), the
activation_tab_qubes view never surfaced it — so activate() failed with
'content_qube-missing', listActivations() could never resolve an edition,
the status stayed null, and the Standing tab never became active or
rendered in the runtime.

Revert the earlier permanent-activation change (Standing stays
activation-gated as specified) and instead seed the missing qube + a
'free' access policy so the persona can self-activate via the Activations
catalog card, exactly like every other open activation.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

Root cause: standing-cartridge was added to ACTIVATION_CATALOG after the
original activation seed migration, which only seeded through
polity-passport. With no backing content_qubes row (content_kind=
'activation_tab', content_type='standing-cartridge'), the
activation_tab_qubes view never surfaced it — so activate() failed with
'content_qube-missing', listActivations() could never resolve an edition,
the status stayed null, and the Standing tab never became active or
rendered in the runtime.

Revert the earlier permanent-activation change (Standing stays
activation-gated as specified) and instead seed the missing qube + a
'free' access policy so the persona can self-activate via the Activations
catalog card, exactly like every other open activation.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `data/codex-configs.ts` |
| Added | `supabase/migrations/20260619000000_seed_standing_activation_qube.sql` |

## Stats

 2 files changed, 46 insertions(+), 6 deletions(-)
