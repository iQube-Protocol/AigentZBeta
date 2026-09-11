# Commit Brief: `35ac289` — Promote SmartTriad inline video into a universal Rich Block primitive

| Field | Value |
|-------|-------|
| SHA | [`35ac289`](https://github.com/iQube-Protocol/AigentZBeta/commit/35ac289dfd05627ccb82f489d4cd99fd691d44af) |
| Author | Claude |
| Date | 2026-09-04T21:38:08Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Promote SmartTriad inline video into a universal Rich Block primitive

Generalizes MoneyPenny's smarttriad.media.video.v0 payload into a
platform-wide smarttriad.block.v1 envelope with a shared
parser/validator/normalizer (services/smarttriad/richBlocks.ts) and one
shared renderer (components/smarttriad/richblocks/), consumed by both
copilot renderer families: SmartTriadInferenceRenderer.tsx (used by
SmartTriadCopilotLayer) and CopilotInferenceBodyRenderer.tsx (used by
CodexCopilotLayer, independent of its enableInferenceRendering flag).

Adds a cartridge-aware media provider registry
(services/smarttriad/mediaProviders.ts) so app/api/codex/chat/route.ts
carries no MoneyPenny-specific branch anymore; MoneyPenny is migrated
to be the first registered provider, and a second, genuinely
non-MoneyPenny provider (Financial Sovereignty bridge lesson video,
scoped to the journey-runtime surface) proves the abstraction using a
real, already-published Studio asset. Adds first-class `blocks`
transport on the chat response contract, additive to the existing
fenced-JSON compatibility path. Never lets the model emit a media URL;
actions are a closed, typed, registry-validated set; forbidden URL
schemes and non-public access classes are rejected.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Generalizes MoneyPenny's smarttriad.media.video.v0 payload into a
platform-wide smarttriad.block.v1 envelope with a shared
parser/validator/normalizer (services/smarttriad/richBlocks.ts) and one
shared renderer (components/smarttriad/richblocks/), consumed by both
copilot renderer families: SmartTriadInferenceRenderer.tsx (used by
SmartTriadCopilotLayer) and CopilotInferenceBodyRenderer.tsx (used by
CodexCopilotLayer, independent of its enableInferenceRendering flag).

Adds a cartridge-aware media provider registry
(services/smarttriad/mediaProviders.ts) so app/api/codex/chat/route.ts
carries no MoneyPenny-specific branch anymore; MoneyPenny is migrated
to be the first registered provider, and a second, genuinely
non-MoneyPenny provider (Financial Sovereignty bridge lesson video,
scoped to the journey-runtime surface) proves the abstraction using a
real, already-published Studio asset. Adds first-class `blocks`
transport on the chat response contract, additive to the existing
fenced-JSON compatibility path. Never lets the model emit a media URL;
actions are a closed, typed, registry-validated set; forbidden URL
schemes and non-public access classes are rejected.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `app/components/codex/CodexCopilotLayer.tsx` |
| Modified | `app/components/codex/CopilotInferenceBodyRenderer.tsx` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |
| Modified | `components/smarttriad/copilot/SmartTriadInferenceRenderer.tsx` |
| Added | `components/smarttriad/richblocks/SmartTriadRichBlockRenderer.tsx` |
| Added | `components/smarttriad/richblocks/SmartTriadVideoBlockRenderer.tsx` |
| Modified | `docs/SmartTriad_Copilot_Inference_Rendering_Spec.md` |
| Added | `services/smarttriad/mediaProviders.ts` |
| Added | `services/smarttriad/richBlocks.ts` |
| Modified | `tests/moneypenny-c15-educational-video.test.ts` |
| Added | `tests/smarttriad-rich-blocks.test.ts` |
| Added | `types/smarttriad/richBlocks.ts` |

## Stats

 13 files changed, 1393 insertions(+), 221 deletions(-)
