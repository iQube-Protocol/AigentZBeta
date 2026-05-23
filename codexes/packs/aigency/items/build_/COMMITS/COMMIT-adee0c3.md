# Commit Brief: `adee0c3` — remove redundant mic from aigentMe copilot input — Marketa already handles voice there

| Field | Value |
|-------|-------|
| SHA | [`adee0c3`](https://github.com/iQube-Protocol/AigentZBeta/commit/adee0c3e7b3f63220a2bb730e63ff7460945e54f) |
| Author | Claude |
| Date | 2026-05-23T00:44:27Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
remove redundant mic from aigentMe copilot input — Marketa already handles voice there

Both SmartTriadCopilotLayer input variants (floating + panel) had a
MicButton added next to the Send button in the previous mic sweep,
but Marketa is already mounted as the voice agent in this copilot,
so the mic affordance was duplicative. Remove the button and the
unused MicButton import; everywhere else the mic was added stays.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Both SmartTriadCopilotLayer input variants (floating + panel) had a
MicButton added next to the Send button in the previous mic sweep,
but Marketa is already mounted as the voice agent in this copilot,
so the mic affordance was duplicative. Remove the button and the
unused MicButton import; everywhere else the mic was added stays.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |

## Stats

 2 files changed, 1 insertion(+), 12 deletions(-)
