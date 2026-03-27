# Commit Brief: `93b134d` — fix video preview: correct capsule type, stop infinite polling, clear banner on completion

| Field | Value |
|-------|-------|
| SHA | [`93b134d`](https://github.com/iQube-Protocol/AigentZBeta/commit/93b134dd492c74ecf5acf8931df98231f149a129) |
| Author | Claude |
| Date | 2026-03-22T18:15:54Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video preview: correct capsule type, stop infinite polling, clear banner on completion

- runtimeDeliveryProfile: assetType() now treats /api/skills/video/ proxy URLs as
  video (no .mp4 extension to match on) — fixes wrong capsule type (article instead
  of video+article) for all video experiences
- ComposerStudio: polling useEffect uses refreshExperienceFromServerRef to avoid
  refreshExperienceFromServer in deps (which caused infinite re-polling); adds
  completedVideoGenerationIds ref guard so completed generations never re-poll
- ComposerStudio: setConfirmedCompleteGenerationId on first ready=true response;
  banner condition checks currentVideoGenerationId !== confirmedCompleteGenerationId
  so banner clears automatically without a manual Reload Preview click
- ComposerStudio: removed setPreviewNonce from handlePersonaMediaUpdated and
  handlePersonaMediaMessage — runtimePreviewSrc changes naturally when
  imageAssets.portrait is added, avoiding the infinite iframe reload loop

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
