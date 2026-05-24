# Commit Brief: `1c86dae` — aigentMe: surface Capability Gateway preflight + add Ask specialists chip

| Field | Value |
|-------|-------|
| SHA | [`1c86dae`](https://github.com/iQube-Protocol/AigentZBeta/commit/1c86daee23d5cdb2554a749569dcaf2093e1a173) |
| Author | Claude |
| Date | 2026-05-24T09:51:12Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
aigentMe: surface Capability Gateway preflight + add Ask specialists chip

UI integration for the Capability Gateway preflight pass that's now
live behind CAPABILITY_GATEWAY_PREFLIGHT on the four progression
routes (brief / move-forward / venture-progress / ask-agent).

Adds:

- components/metame/cards/PreflightByline.tsx — small shared component
  exporting both a one-line "aigentMe researched: …" byline (truncated
  at 140 chars, full text in tooltip) and a header "🔍 researched" chip
  (full summary + 8-char workOrder prefix in tooltip for support
  correlation). Identity-safe: never renders policyHash, never renders
  the full workOrderId.

- Renders the byline + chip on all four cards when preflightContext
  is present:
    BriefCard (header chip + byline under title)
    VentureProgressCard (header chip + byline under title)
    SpecialistResponseCard (header chip + byline under title)
    NextBestActionCard hero variant (chip + byline; compact variant
    skips since the gather is bundle-level, not per-NBA)
  Also surfaces the byline inline in the SpecialistsGrid quick-ask
  panel since that path renders responses inline rather than via the
  full card.

- Threads preflightContext through:
    BriefShape, MoveForwardShape, VentureProgressShape,
    SpecialistResponse (server interfaces, importing the canonical
    PreflightContext type from services/capabilities/preflight)
    BriefCardData, VentureProgressData, SpecialistResponseData
    (client-side mirrors)
    moveForwardResult state in AigentMeWelcomeSplitTab + the matching
    WelcomeRightPaneProps shape, since move-forward's preflight lives
    on the parent shape and is passed down to the hero NBA card

- /api/assistant/ask-agent now attaches preflightContext to the
  response payload alongside the existing rationale enrichment, so
  the UI reads it the same way as the other three routes.

Ask specialists chip:

- Adds a fourth cold-open chip to copilotQuickPrompts that opens the
  stack layout AND expands the Specialists accordion via
  setExpandedSectionId('specialists'). The copilot prompt frames the
  full specialist roster (Marketa, Quill, Kn0w1, Aigent Z, Aigent C,
  Aigent Nakamoto, Moneypenny, metaYe) so the LLM has the full
  picture when the operator clicks; the right pane simultaneously
  surfaces the inline ask panels for each specialist so a follow-up
  individual ask is one click away.

No execution path is wired on the client — preflight runs server-side
upstream of every response, this commit is the affordance only.
```

## Body

UI integration for the Capability Gateway preflight pass that's now
live behind CAPABILITY_GATEWAY_PREFLIGHT on the four progression
routes (brief / move-forward / venture-progress / ask-agent).

Adds:

- components/metame/cards/PreflightByline.tsx — small shared component
  exporting both a one-line "aigentMe researched: …" byline (truncated
  at 140 chars, full text in tooltip) and a header "🔍 researched" chip
  (full summary + 8-char workOrder prefix in tooltip for support
  correlation). Identity-safe: never renders policyHash, never renders
  the full workOrderId.

- Renders the byline + chip on all four cards when preflightContext
  is present:
    BriefCard (header chip + byline under title)
    VentureProgressCard (header chip + byline under title)
    SpecialistResponseCard (header chip + byline under title)
    NextBestActionCard hero variant (chip + byline; compact variant
    skips since the gather is bundle-level, not per-NBA)
  Also surfaces the byline inline in the SpecialistsGrid quick-ask
  panel since that path renders responses inline rather than via the
  full card.

- Threads preflightContext through:
    BriefShape, MoveForwardShape, VentureProgressShape,
    SpecialistResponse (server interfaces, importing the canonical
    PreflightContext type from services/capabilities/preflight)
    BriefCardData, VentureProgressData, SpecialistResponseData
    (client-side mirrors)
    moveForwardResult state in AigentMeWelcomeSplitTab + the matching
    WelcomeRightPaneProps shape, since move-forward's preflight lives
    on the parent shape and is passed down to the hero NBA card

- /api/assistant/ask-agent now attaches preflightContext to the
  response payload alongside the existing rationale enrichment, so
  the UI reads it the same way as the other three routes.

Ask specialists chip:

- Adds a fourth cold-open chip to copilotQuickPrompts that opens the
  stack layout AND expands the Specialists accordion via
  setExpandedSectionId('specialists'). The copilot prompt frames the
  full specialist roster (Marketa, Quill, Kn0w1, Aigent Z, Aigent C,
  Aigent Nakamoto, Moneypenny, metaYe) so the LLM has the full
  picture when the operator clicks; the right pane simultaneously
  surfaces the inline ask panels for each specialist so a follow-up
  individual ask is one click away.

No execution path is wired on the client — preflight runs server-side
upstream of every response, this commit is the affordance only.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/cards/BriefCard.tsx` |
| Modified | `components/metame/cards/NextBestActionCard.tsx` |
| Added | `components/metame/cards/PreflightByline.tsx` |
| Modified | `components/metame/cards/SpecialistResponseCard.tsx` |
| Modified | `components/metame/cards/VentureProgressCard.tsx` |
| Modified | `components/metame/welcome/WelcomeRightPane.tsx` |
| Modified | `components/metame/welcome/layouts/DecisionBoardLayout.tsx` |
| Modified | `services/agents/specialistRouter.ts` |
| Modified | `services/orchestration/briefBuilder.ts` |
| Modified | `services/orchestration/ventureProgressBuilder.ts` |

## Stats

 12 files changed, 156 insertions(+), 4 deletions(-)
