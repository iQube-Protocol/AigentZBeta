# Commit Brief: `782e03f` — fix template progression, copilot routing, and receipt regression

| Field | Value |
|-------|-------|
| SHA | [`782e03f`](https://github.com/iQube-Protocol/AigentZBeta/commit/782e03f5f1b90241d5dd07ce4ac6f2796d0e4bff) |
| Author | Claude |
| Date | 2026-03-21T00:31:44Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix template progression, copilot routing, and receipt regression

- register ai-image-generation and ai-article-draft in composerStore so
  handleStartSession can create sessions for these templates (was 404)
- fix copilot image-only and article-only branches to call
  startSeededSessionForTemplate with their own template IDs, not
  qriptopian_reading_sprint_v0 (was routing to image+article bundle)
- restore receipt link in embedded preview to point back to ComposerStudio
  with focus=receipt, matching the launcher card receipt links
- add focus=receipt URL param handler in ComposerStudio to auto-open DVN
  Receipts tab (setStudioAnalysisTab receipts + expand parity panel)
- restore receipt icon visibility without previewMedia gate (was hiding
  receipt before media generated, receipts exist independently of media)
- remove incorrect focusReceipt → showPacket logic from ExperienceViewer
  (receipt ≠ packet; receipt = DVN Receipts tab in ComposerStudio)

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
