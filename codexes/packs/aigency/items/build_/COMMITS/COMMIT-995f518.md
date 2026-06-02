# Commit Brief: `995f518` — myCanvas: remix-from-template button (Qriptopian Agents of Change 15-min sprint)

| Field | Value |
|-------|-------|
| SHA | [`995f518`](https://github.com/iQube-Protocol/AigentZBeta/commit/995f51837a707f5052cb9d74ec707dd2397c8a17) |
| Author | Claude |
| Date | 2026-05-31T20:44:08Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
myCanvas: remix-from-template button (Qriptopian Agents of Change 15-min sprint)

Operator-requested seed: surface a remixable Qriptopian Agents of
Change 15-min reading sprint template directly in myCanvas so a new
persona can hit the cartridge and immediately remix something
substantial instead of landing on an empty list with only a New
button.

Two render points (both gated to surface='canvas' — the myWorkspace
and myLedger tabs don't want a public-template affordance):

  1. Empty state — when entries.length === 0, the "No entries yet"
     placeholder is followed by a button card pointing at the seed
     experience. One click → opens the existing RemixDialog with
     sourceExperienceId='exp_1773512145689_1vnt1jcnt'.

  2. Populated state — a "Templates" footer at the bottom of the
     entries list with the same button. Always available so the
     operator can spin up another remix without clearing the list.

Implementation: synthetic CanvasEntry passed to setRemixSource with
metaJson.experienceId set to the seed exp id. RemixDialog already
reads metaJson.experienceId / metaJson.sourceExperienceId as the
source, so no API or new prop is needed — the existing remix flow
handles everything (article/story toggle, Q¢ cost, free-remaining,
generate, discard/share/publish).

Short-term: single hardcoded template. Follow-up: pull a list of
templates from a registry so we can rotate seeds without code
changes. Tracked in the metaArtifacts restructure follow-up note.
```

## Body

Operator-requested seed: surface a remixable Qriptopian Agents of
Change 15-min reading sprint template directly in myCanvas so a new
persona can hit the cartridge and immediately remix something
substantial instead of landing on an empty list with only a New
button.

Two render points (both gated to surface='canvas' — the myWorkspace
and myLedger tabs don't want a public-template affordance):

  1. Empty state — when entries.length === 0, the "No entries yet"
     placeholder is followed by a button card pointing at the seed
     experience. One click → opens the existing RemixDialog with
     sourceExperienceId='exp_1773512145689_1vnt1jcnt'.

  2. Populated state — a "Templates" footer at the bottom of the
     entries list with the same button. Always available so the
     operator can spin up another remix without clearing the list.

Implementation: synthetic CanvasEntry passed to setRemixSource with
metaJson.experienceId set to the seed exp id. RemixDialog already
reads metaJson.experienceId / metaJson.sourceExperienceId as the
source, so no API or new prop is needed — the existing remix flow
handles everything (article/story toggle, Q¢ cost, free-remaining,
generate, discard/share/publish).

Short-term: single hardcoded template. Follow-up: pull a list of
templates from a registry so we can rotate seeds without code
changes. Tracked in the metaArtifacts restructure follow-up note.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/MyCanvasTab.tsx` |

## Stats

 1 file changed, 75 insertions(+), 2 deletions(-)
