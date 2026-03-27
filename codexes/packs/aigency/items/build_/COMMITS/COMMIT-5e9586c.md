# Commit Brief: `5e9586c` — fix image bundle generation to check editing experience for bundle identity

| Field | Value |
|-------|-------|
| SHA | [`5e9586c`](https://github.com/iQube-Protocol/AigentZBeta/commit/5e9586c42bfee262601e6a542e7e4e51d67c8a47) |
| Author | Claude |
| Date | 2026-03-20T04:32:42Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix image bundle generation to check editing experience for bundle identity

When completing a Customizer editing session, completeSession() creates a
new ExperienceQube with minimal metadata — no composition_bundle. The bundle
check was reading the new experience and always returning null, so image
generation never fired.

Fix: check the editing experience (which has composition_bundle from preset
apply) when editingExperienceId is set. Also target asset persistence and
refresh against editingExperienceId so assets land on the final experience,
not the temporary one that gets deleted.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
