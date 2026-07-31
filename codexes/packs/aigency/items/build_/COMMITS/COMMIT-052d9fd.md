# Commit Brief: `052d9fd` — SpecialistsLayout: suggested-artifact chips open composer pre-populated

| Field | Value |
|-------|-------|
| SHA | [`052d9fd`](https://github.com/iQube-Protocol/AigentZBeta/commit/052d9fd33b2529a2257091241d03ffa4f75f7d88) |
| Author | Claude |
| Date | 2026-05-24T18:48:05Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
SpecialistsLayout: suggested-artifact chips open composer pre-populated

Today the suggested-artifact chips on a specialist response card sit
inert — the SpecialistsLayout passed onCreateArtifact={undefined}.
Wires them up end-to-end so clicking "Partner proposal" / "Email
draft" / "Article brief" etc. opens the matching ComposerLayout with
the inline form already populated by an aigentMe draft built from the
specialist's response (title + summary + top recommendations).

Six compose modals (Gmail / Calendar / Doc / Sheet / Slides / Marketa
email) gain an `initialPrompt?: string` prop. When set on mount, a
small useEffect pre-fills the AI prompt textarea AND auto-fires the
existing draft handler exactly once per unique prompt — tracked via a
ref that stores the last-fired prompt, so a same-kind composer
reopened with a different artifact re-drafts cleanly. Existing
handleDraft is split into draftWithPrompt(promptToUse) +
handleDraft() so the validation message ("Tell aigentMe what the
email is for...") still surfaces on manual click but the auto-fire
path bypasses the empty-string check.

ComposerLayout threads composerInitialPrompt through to whichever
modal it renders inline. RightPaneLayoutProps gains
composerInitialPrompt?: string | null and a matching
onUseSuggestedArtifact handler shape.

Tab adds:
- composerInitialPrompt state, cleared on every non-suggested-artifact
  composer open path (chip dispatch, openComposeByKind) so manual
  composer opens land on an empty form
- composeKindForSuggestedArtifact() — keyword matcher that maps
  free-form artifact labels to a ComposeKind (email / event / doc /
  sheet / slides / marketa). Returns null for anything that doesn't
  fit, leaving the chip non-clickable rather than opening the wrong
  surface
- buildPromptForSuggestedArtifact() — composes the inferred draft
  prompt from the specialist response (title + summary + up to 4
  recommendations + the chosen artifact label) with explicit guidance
  to keep the output concrete and ready to review/edit/send
- handleUseSuggestedArtifact() — the public handler that resolves
  ComposeKind, builds the prompt, sets composerInitialPrompt +
  composerKind, and activates the composer layout

SpecialistsLayout's ConsultationCard now forwards onUseSuggestedArtifact
into SpecialistResponseCard's existing onCreateArtifact prop so the
chips render as buttons. The chips for unsupported artifact strings
(e.g. "Strategy memo PDF") still render but stay non-clickable since
the resolver returns null.
```

## Body

Today the suggested-artifact chips on a specialist response card sit
inert — the SpecialistsLayout passed onCreateArtifact={undefined}.
Wires them up end-to-end so clicking "Partner proposal" / "Email
draft" / "Article brief" etc. opens the matching ComposerLayout with
the inline form already populated by an aigentMe draft built from the
specialist's response (title + summary + top recommendations).

Six compose modals (Gmail / Calendar / Doc / Sheet / Slides / Marketa
email) gain an `initialPrompt?: string` prop. When set on mount, a
small useEffect pre-fills the AI prompt textarea AND auto-fires the
existing draft handler exactly once per unique prompt — tracked via a
ref that stores the last-fired prompt, so a same-kind composer
reopened with a different artifact re-drafts cleanly. Existing
handleDraft is split into draftWithPrompt(promptToUse) +
handleDraft() so the validation message ("Tell aigentMe what the
email is for...") still surfaces on manual click but the auto-fire
path bypasses the empty-string check.

ComposerLayout threads composerInitialPrompt through to whichever
modal it renders inline. RightPaneLayoutProps gains
composerInitialPrompt?: string | null and a matching
onUseSuggestedArtifact handler shape.

Tab adds:
- composerInitialPrompt state, cleared on every non-suggested-artifact
  composer open path (chip dispatch, openComposeByKind) so manual
  composer opens land on an empty form
- composeKindForSuggestedArtifact() — keyword matcher that maps
  free-form artifact labels to a ComposeKind (email / event / doc /
  sheet / slides / marketa). Returns null for anything that doesn't
  fit, leaving the chip non-clickable rather than opening the wrong
  surface
- buildPromptForSuggestedArtifact() — composes the inferred draft
  prompt from the specialist response (title + summary + up to 4
  recommendations + the chosen artifact label) with explicit guidance
  to keep the output concrete and ready to review/edit/send
- handleUseSuggestedArtifact() — the public handler that resolves
  ComposeKind, builds the prompt, sets composerInitialPrompt +
  composerKind, and activates the composer layout

SpecialistsLayout's ConsultationCard now forwards onUseSuggestedArtifact
into SpecialistResponseCard's existing onCreateArtifact prop so the
chips render as buttons. The chips for unsupported artifact strings
(e.g. "Strategy memo PDF") still render but stay non-clickable since
the resolver returns null.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/connections/ComposeCalendarEventModal.tsx` |
| Modified | `components/metame/connections/ComposeGmailDraftModal.tsx` |
| Modified | `components/metame/connections/ComposeGoogleDocModal.tsx` |
| Modified | `components/metame/connections/ComposeGoogleSheetModal.tsx` |
| Modified | `components/metame/connections/ComposeMarketaEmailModal.tsx` |
| Modified | `components/metame/connections/ComposeSlidesModal.tsx` |
| Modified | `components/metame/welcome/layouts/ComposerLayout.tsx` |
| Modified | `components/metame/welcome/layouts/SpecialistsLayout.tsx` |
| Modified | `components/metame/welcome/layouts/types.ts` |

## Stats

 10 files changed, 280 insertions(+), 53 deletions(-)
