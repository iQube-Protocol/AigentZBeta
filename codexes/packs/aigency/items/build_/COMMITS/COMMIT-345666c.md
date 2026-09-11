# Commit Brief: `345666c` — server-side runtime context preference + reading sprint nextActions in packet

| Field | Value |
|-------|-------|
| SHA | [`345666c`](https://github.com/iQube-Protocol/AigentZBeta/commit/345666c72f373e936b027deca3c8ff979064b91f) |
| Author | Claude |
| Date | 2026-06-18T17:44:49Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
server-side runtime context preference + reading sprint nextActions in packet

Runtime takeover toggle was localStorage-only, so the admin tab on
dev-beta couldn't propagate to the thin client iframe on metame.live
(different origin → separate localStorage). Now:

1. New GET/PUT /api/runtime/settings/context stores the preference in
   orchestration_events (no migration needed).
2. Admin tab writes to both localStorage (same-origin sync) and the
   server (cross-origin sync).
3. Runtime client reads the server preference on mount, falling back
   to localStorage.

Also: reading sprint packet now includes composition.nextActions with
the canonical 4-step checklist, so the consumer task runner shows tasks
instead of 'No tasks for this experience yet.'
```

## Body

Runtime takeover toggle was localStorage-only, so the admin tab on
dev-beta couldn't propagate to the thin client iframe on metame.live
(different origin → separate localStorage). Now:

1. New GET/PUT /api/runtime/settings/context stores the preference in
   orchestration_events (no migration needed).
2. Admin tab writes to both localStorage (same-origin sync) and the
   server (cross-origin sync).
3. Runtime client reads the server preference on mount, falling back
   to localStorage.

Also: reading sprint packet now includes composition.nextActions with
the canonical 4-step checklist, so the consumer task runner shows tasks
instead of 'No tasks for this experience yet.'

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/runtime/settings/context/route.ts` |
| Modified | `app/triad/components/codex/tabs/MetaMeRuntimeSettingsTab.tsx` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 3 files changed, 127 insertions(+), 3 deletions(-)
