# Commit Brief: `a487b18` — fix shell overflow, thumbnail clipping, scroll block, and missing live view shell

| Field | Value |
|-------|-------|
| SHA | [`a487b18`](https://github.com/iQube-Protocol/AigentZBeta/commit/a487b188bbedf268081635f0d8c7e0d27da15c14) |
| Author | Claude |
| Date | 2026-03-21T03:08:08Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix shell overflow, thumbnail clipping, scroll block, and missing live view shell

Three targeted fixes:

1. CodexCopilotLayer overflow (thumbnails invisible, scroll clipped):
   In embedPreviewMode, runtimeMenu is a shrink-0 sibling below
   CodexCopilotLayer in the flex column. CodexCopilotLayer had
   className="h-full" which made it claim 100% of the parent height,
   overflowing past the runtimeMenu. The outer shell has overflow-hidden,
   so the overflow (including the thumbnails at the scroll area bottom)
   was clipped — making them invisible and limiting scroll range.
   Fix: className="flex-1 min-h-0" in embedPreviewMode so CodexCopilotLayer
   takes only the remaining flex space, leaving room for runtimeMenu.

2. Scroll glitch (invisible h-28 hover zone):
   floatingInput=true creates a 112px transparent hover-trigger zone at
   absolute bottom-0 inside CodexCopilotLayer. This zone partially
   overlaps the scroll area (scroll bottom=100px but zone is 112px tall),
   capturing mouse events and triggering the floating input panel, which
   blocks scroll. disablePromptInput=true in embedPreviewMode removes this
   entire block (resolvedFooterHeight→0, no hover zone), eliminating the
   interference.

3. Non-embed live view missing shell:
   The queryPreviewDisplayCapsule early return in the non-embed path was
   rendering chip + editor + content panel directly without the
   CodexCopilotLayer shell (no R/T header, no Be/Earn/Play footer).
   Removed this early return; the code now falls through to the
   PreviewFrame path which renders runtimeSurface (full shell). The
   auto-launch effect populates the shell's message stream with the
   experience content.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
