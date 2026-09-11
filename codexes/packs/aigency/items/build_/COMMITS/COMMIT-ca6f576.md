# Commit Brief: `ca6f576` — Gate F: wire deliberation intent detection into chat route

| Field | Value |
|-------|-------|
| SHA | [`ca6f576`](https://github.com/iQube-Protocol/AigentZBeta/commit/ca6f57699866910fed74bc2e115a7fc12e4782d8) |
| Author | Claude |
| Date | 2026-08-17T18:21:51Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Gate F: wire deliberation intent detection into chat route

Adds natural language intent detection for venture reports and reintroductions
to the codex chat pipeline. When operators express intent to create deliberation
artifacts, the chat response includes a suggested_deliberation_action that the
client can use to engage the right-pane deliberation layout.

Implements:
- detectDeliberationIntent: pattern-based NLP detection for 6 venture report +
  reintroduction patterns with confidence scoring (0-1)
- extractBriefContextFromPrompt: extracts briefSpec fields from prompts (audience,
  disclosure level, date hints)
- suggestDeliberationFromPrompt: integrates intent detection → brief initialization
  → context extraction → SuggestedDeliberationAction (requires ventureId + nbeId,
  supplied by client)
- chat route integration: detects intent on every user message, returns signal
  for client to decide layout engagement

Adds DeliberativeArtifactType union type export to types/deliberativeArtifact.ts
for consistent typing across services.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

Adds natural language intent detection for venture reports and reintroductions
to the codex chat pipeline. When operators express intent to create deliberation
artifacts, the chat response includes a suggested_deliberation_action that the
client can use to engage the right-pane deliberation layout.

Implements:
- detectDeliberationIntent: pattern-based NLP detection for 6 venture report +
  reintroduction patterns with confidence scoring (0-1)
- extractBriefContextFromPrompt: extracts briefSpec fields from prompts (audience,
  disclosure level, date hints)
- suggestDeliberationFromPrompt: integrates intent detection → brief initialization
  → context extraction → SuggestedDeliberationAction (requires ventureId + nbeId,
  supplied by client)
- chat route integration: detects intent on every user message, returns signal
  for client to decide layout engagement

Adds DeliberativeArtifactType union type export to types/deliberativeArtifact.ts
for consistent typing across services.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Added | `services/deliberativeArtifact/chatDeliberationBridge.ts` |
| Added | `services/deliberativeArtifact/deliberationIntentDetector.ts` |
| Modified | `types/deliberativeArtifact.ts` |

## Stats

 4 files changed, 408 insertions(+)
