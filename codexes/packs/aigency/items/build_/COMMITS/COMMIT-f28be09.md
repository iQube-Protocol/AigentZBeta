# Commit Brief: `f28be09` — fix scroll glitch and menu flush in embed runtime preview

| Field | Value |
|-------|-------|
| SHA | [`f28be09`](https://github.com/iQube-Protocol/AigentZBeta/commit/f28be097d0698a8ad28d83cc37127509ee42a433) |
| Author | Claude |
| Date | 2026-03-21T02:40:22Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix scroll glitch and menu flush in embed runtime preview

Root causes addressed:

1. Scroll glitch (scrollChatToBottom fighting user scroll):
   - The capsule-panel effect was appending the experience carousel LAST,
     so CodexCopilotLayer's scrollChatToBottom() always landed on the
     carousel. Any subsequent message update (lastIntent change rippling
     through launchCapsule → capsulePanel) re-triggered scrollChatToBottom,
     making it impossible to scroll up to the experience panel.
   - Fix: in embedPreview mode the capsule-panel effect now PREPENDS the
     carousel, so the experience panel (added by launchCapsule) stays at
     the bottom. scrollChatToBottom() naturally shows the experience panel
     and is no longer fighting the user.

2. Gap between carousel and menu / invisible scroll blocker:
   - floatingInput=true creates an invisible h-28 (112px) hover zone at
     bottom-0 inside CodexCopilotLayer. This zone sits above the
     runtimeMenu and partially overlaps the scroll area (scroll area bottom
     is at 100px, zone is 112px tall → 12px overlap). Mouse hover in this
     zone triggers the floating input panel, blocking scroll events.
   - Fix: in embedPreviewMode (embedMode + selected experience capsule),
     disablePromptInput=true (eliminates the hover zone, resolvedFooterHeight
     becomes 0 so the scroll area fills the shell height), footerContent=null
     (removed from CodexCopilotLayer), floatingInput=false. The runtimeMenu
     is rendered as a shrink-0 sibling div below CodexCopilotLayer, sitting
     flush against the scroll area bottom.

3. Removed the chip from auto-launch messages (was adding a redundant
   separate message; experience panel already shows title/image). Cleaned
   up auto-launch deps accordingly.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
