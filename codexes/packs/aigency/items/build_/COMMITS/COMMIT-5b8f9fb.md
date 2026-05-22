# Commit Brief: `5b8f9fb` — add STT mic affordance to compose modals and expGuide textareas

| Field | Value |
|-------|-------|
| SHA | [`5b8f9fb`](https://github.com/iQube-Protocol/AigentZBeta/commit/5b8f9fb2c5efd69f53aa5ea040b2bfdfc4cbdd1f) |
| Author | Claude |
| Date | 2026-05-22T16:48:23Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add STT mic affordance to compose modals and expGuide textareas

Web Speech API (SpeechRecognition / webkitSpeechRecognition) is wrapped
in a reusable useSpeechRecognition hook and a MicButton primitive. The
mic sits next to "Draft for me" in all six aigentMe compose modals
(Gmail, Doc, Calendar, Sheet, Slides, Marketa), and inside each
free-form textarea on the expGuide / experience-model setup wizards
and the welcome ask-specialist surfaces.

transformEmailDictation maps "<word> at <word> dot <tld>" runs to
"<word>@<word>.<tld>" without touching unrelated "at" / "dot" usages.
Applied in every compose modal so dictated recipient addresses come out
correctly without changing the rest of the sentence.

Mic hides on browsers without the API (Firefox).

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Web Speech API (SpeechRecognition / webkitSpeechRecognition) is wrapped
in a reusable useSpeechRecognition hook and a MicButton primitive. The
mic sits next to "Draft for me" in all six aigentMe compose modals
(Gmail, Doc, Calendar, Sheet, Slides, Marketa), and inside each
free-form textarea on the expGuide / experience-model setup wizards
and the welcome ask-specialist surfaces.

transformEmailDictation maps "<word> at <word> dot <tld>" runs to
"<word>@<word>.<tld>" without touching unrelated "at" / "dot" usages.
Applied in every compose modal so dictated recipient addresses come out
correctly without changing the rest of the sentence.

Mic hides on browsers without the API (Firefox).

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` |
| Modified | `components/metame/connections/ComposeCalendarEventModal.tsx` |
| Modified | `components/metame/connections/ComposeGmailDraftModal.tsx` |
| Modified | `components/metame/connections/ComposeGoogleDocModal.tsx` |
| Modified | `components/metame/connections/ComposeGoogleSheetModal.tsx` |
| Modified | `components/metame/connections/ComposeMarketaEmailModal.tsx` |
| Modified | `components/metame/connections/ComposeSlidesModal.tsx` |
| Modified | `components/metame/setup/ExperienceModelSetupWizard.tsx` |
| Modified | `components/metame/setup/PersonalGuideSetupWizard.tsx` |
| Modified | `components/metame/welcome/WelcomeRightPane.tsx` |
| Added | `components/ui/MicButton.tsx` |
| Added | `hooks/useSpeechRecognition.ts` |

## Stats

 13 files changed, 424 insertions(+), 34 deletions(-)
