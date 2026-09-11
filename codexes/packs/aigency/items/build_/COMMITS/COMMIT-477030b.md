# Commit Brief: `477030b` — STT timeout + composer state persistence (sub-tab survival)

| Field | Value |
|-------|-------|
| SHA | [`477030b`](https://github.com/iQube-Protocol/AigentZBeta/commit/477030b561120cc3d3d56fa80d55f66e48e1b658) |
| Author | Claude |
| Date | 2026-05-29T07:21:26Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
STT timeout + composer state persistence (sub-tab survival)

Two surgical fixes for the regressions reported on dev-beta after the
Anthropic-primary draft-services cutover:

1. /api/skills/stt — 504 Gateway Timeout
   Root cause: Lambda has a 30s hard exec budget; the OpenAI SDK
   defaults to maxRetries=2 with no per-request timeout, so when
   Whisper is slow or the account is quota-throttled the SDK can hold
   the request open past 30s and Amplify returns a 504 before our
   handler ever surfaces a real error. Tighten the client:
     - maxRetries: 0 (no auto-retry-on-failure)
     - timeout: 22_000ms (safely inside Lambda budget)
   Map the resulting failure to a useful body:
     - 503 openai-quota-exhausted (quota / 429 / insufficient_quota)
     - 504 stt-timeout              (abort / timeout)
     - 500 stt-failed               (everything else)
   The FE can now show a real reason instead of a generic 504.

2. AigentMeWelcomeSplitTab — composer state lost on sub-tab navigate
   Root cause: TabRenderer fully unmounts AigentMeWelcomeSplitTab when
   the operator switches to Strategy / NBE / Analysis / etc., the way
   it does for every codex sub-tab. composerKind, composerInitialPrompt,
   and composerSourceIntentId are React-local state — gone on unmount —
   while `artifacts` survives via sessionStorage (existing pattern at
   the top of the tab). Add the same persona-scoped sessionStorage
   hydrate-on-init + persist-on-change pattern to the three composer
   state slots so the modal re-mounts where the operator left it and
   the drafted artifact still nests under the originating Pill.

Modal local field state (to, subject, bodyText, etc.) is still lost on
unmount — that lift is a follow-up. Today's change gets composerKind +
initialPrompt + sourceIntentId, which is what reopens the modal on the
same intent and re-fires the LLM draft on remount.

The third regression reported (CTA subjects no longer contextual) is
already addressed by 78bea0fc: all six draft services now route through
Anthropic first (matching nbeLlmRerank + specialistRouter), so once that
deploy lands the email subject + body fields will carry real LLM prose
again instead of the template fallback that embeds the system prompt
verbatim.
```

## Body

Two surgical fixes for the regressions reported on dev-beta after the
Anthropic-primary draft-services cutover:

1. /api/skills/stt — 504 Gateway Timeout
   Root cause: Lambda has a 30s hard exec budget; the OpenAI SDK
   defaults to maxRetries=2 with no per-request timeout, so when
   Whisper is slow or the account is quota-throttled the SDK can hold
   the request open past 30s and Amplify returns a 504 before our
   handler ever surfaces a real error. Tighten the client:
     - maxRetries: 0 (no auto-retry-on-failure)
     - timeout: 22_000ms (safely inside Lambda budget)
   Map the resulting failure to a useful body:
     - 503 openai-quota-exhausted (quota / 429 / insufficient_quota)
     - 504 stt-timeout              (abort / timeout)
     - 500 stt-failed               (everything else)
   The FE can now show a real reason instead of a generic 504.

2. AigentMeWelcomeSplitTab — composer state lost on sub-tab navigate
   Root cause: TabRenderer fully unmounts AigentMeWelcomeSplitTab when
   the operator switches to Strategy / NBE / Analysis / etc., the way
   it does for every codex sub-tab. composerKind, composerInitialPrompt,
   and composerSourceIntentId are React-local state — gone on unmount —
   while `artifacts` survives via sessionStorage (existing pattern at
   the top of the tab). Add the same persona-scoped sessionStorage
   hydrate-on-init + persist-on-change pattern to the three composer
   state slots so the modal re-mounts where the operator left it and
   the drafted artifact still nests under the originating Pill.

Modal local field state (to, subject, bodyText, etc.) is still lost on
unmount — that lift is a follow-up. Today's change gets composerKind +
initialPrompt + sourceIntentId, which is what reopens the modal on the
same intent and re-fires the LLM draft on remount.

The third regression reported (CTA subjects no longer contextual) is
already addressed by 78bea0fc: all six draft services now route through
Anthropic first (matching nbeLlmRerank + specialistRouter), so once that
deploy lands the email subject + body fields will carry real LLM prose
again instead of the template fallback that embeds the system prompt
verbatim.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/skills/stt/route.ts` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |

## Stats

 2 files changed, 97 insertions(+), 5 deletions(-)
