# Commit Brief: `ed278e2` — fix Generate Images fallback and auto-gen trigger to not depend on blockKinds

| Field | Value |
|-------|-------|
| SHA | [`ed278e2`](https://github.com/iQube-Protocol/AigentZBeta/commit/ed278e2ba03b62e1a97cba90911f129a30f9eb31) |
| Author | Claude |
| Date | 2026-03-20T17:30:41Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Generate Images fallback and auto-gen trigger to not depend on blockKinds

- MetaMeRuntimeClient: needsImages now checks for image prompts in
  configuration.image_generation AND absence of generated_assets, so the
  Generate Images fallback button shows for all experiences with prompts
  regardless of whether blockKinds is populated
- ComposerStudio: move imageGenerationConfig outside the image-bundle guard
  and add hasImagePrompts as a secondary trigger so auto-generation fires
  even if composition_bundle metadata check fails

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
