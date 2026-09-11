# Commit Brief: `e4cf0a0` — aigentMe: SpecialistsLayout v1 — server recommender, thread, hand-off

| Field | Value |
|-------|-------|
| SHA | [`e4cf0a0`](https://github.com/iQube-Protocol/AigentZBeta/commit/e4cf0a0bfce48a5a21b9a47dd05fdb4449ed0973) |
| Author | Claude |
| Date | 2026-05-24T17:35:36Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
aigentMe: SpecialistsLayout v1 — server recommender, thread, hand-off

Phase 2 dedicated specialist-querying surface. The "Ask specialists"
chip now mounts a purpose-built layout instead of falling back to the
Phase 1 accordion grid.

New server pieces:

- services/orchestration/specialistRecommender.ts — deterministic
  "who should I ask?" picker with optional Anthropic rerank. Reads
  experienceQube + getActiveActivationIds + listRecentIntentsForPersona
  and returns { topSpecialistId, reason, alternates, roster, llmApplied }.
  Activation gating mirrors the cockpit pattern: every specialist
  carries availability ('active' | 'always-available' | needs-activation
  with the source id and label) so the layout can render an upgrade
  path instead of silently hiding gated specialists. LLM rerank reuses
  the same Capability Gateway preflight liveContext seam we wired into
  the NBE rerank — triple-gated no-op when keys/flags are off.

- app/api/assistant/specialist-recommend/route.ts — wraps the
  recommender with the same preflight gather contract the other four
  progression routes use, surfaceId 'specialists'.

- app/api/assistant/specialist-thread/route.ts — reads
  activity_receipts where action_type='specialist_consulted', filters
  client-side to the requested specialistId (since agents_invoked is
  an array and aigent-me co-attends every consult), returns a thin
  thread of pointers. Full-response replay is the inference-memory
  fast-follow tracked in
  codexes/packs/agentiq/updates/2026-05-25_specialists-layout-inference-memory-backlog.md.

- app/api/assistant/ask-agent/route.ts — accepts an optional
  `handoff: { fromSpecialistId, priorTitle, priorReceiptId }` body
  field. When present the route prefixes the rationale with a
  "Hand-off from X" note, tags the receipt's contextShared with
  'specialist-handoff' so the thread can flag the pivot, and surfaces
  the hand-off back on the response as `handoffFrom: { specialistId,
  priorTitle }` so the SpecialistResponseCard can render a "← marketa"
  pill in the header.

- services/agents/specialistRouter.ts — SpecialistResponse gains the
  optional `handoffFrom` field. Also fixes a stale duplicate
  `requestType` key in the template-response builder that surfaced as
  TS2783 once SpecialistResponse grew the new field.

New client pieces:

- components/metame/welcome/layouts/SpecialistsLayout.tsx — DIS
  template specialists-layout-v1. Five stacked sections:
    1. aigentMe recommendation card (with preflight byline)
    2. Roster strip — all 8 specialists with availability status dots
       (cyan=active, slate=always-available, amber=needs-activation),
       violet ring on the selected one
    3. Active specialist focus card; gated specialists show an
       "Activate <source>" CTA wired to the activations editor
    4. Composer (textarea + mic + 3 prompt templates per specialist)
    5. Current-session SpecialistResponseCard for the selected
       specialist, with a hand-off strip showing every other available
       specialist as a single-click pivot. Below that, a "Prior
       consultations" mini-list from the thread endpoint with
       cartridge + when + hand-off flag.

- components/metame/cards/SpecialistResponseCard.tsx — renders the
  "← from X" pill when handoffFrom is set; existing PreflightByline
  + PreflightChip continue to work.

- components/metame/welcome/layouts/types.ts — 'specialists' added to
  RightPaneLayoutId; layoutProps gain a `specialistsLayout` state
  bundle + onSelectSpecialist / onAskSelectedSpecialist /
  onSetSpecialistPrompt / onHandoffSpecialist /
  onOpenActivationsForSpecialist handlers.

- components/metame/welcome/layouts/registry.ts — register the new
  layout under 'specialists'.

- app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx —
  repoints the "Ask specialists" chip from
  setExpandedSectionId('specialists') to setActiveLayoutId('specialists')
  + fetchSpecialistRecommendation(). Adds state + fetchers for the
  recommendation, thread, and hand-off flow. handleAskSpecialist gains
  an optional handoff parameter that the layout passes through when
  the operator clicks a hand-off chip.

Backlog:

- codexes/packs/agentiq/updates/2026-05-25_specialists-layout-inference-memory-backlog.md
  captures the inference-memory linkage so prior consultations can
  replay as full response cards rather than thin pointers. Five-step
  spec covering persistence, route extension, layout UX, recommender
  cross-session awareness, and the privacy/DVN posture.
```

## Body

Phase 2 dedicated specialist-querying surface. The "Ask specialists"
chip now mounts a purpose-built layout instead of falling back to the
Phase 1 accordion grid.

New server pieces:

- services/orchestration/specialistRecommender.ts — deterministic
  "who should I ask?" picker with optional Anthropic rerank. Reads
  experienceQube + getActiveActivationIds + listRecentIntentsForPersona
  and returns { topSpecialistId, reason, alternates, roster, llmApplied }.
  Activation gating mirrors the cockpit pattern: every specialist
  carries availability ('active' | 'always-available' | needs-activation
  with the source id and label) so the layout can render an upgrade
  path instead of silently hiding gated specialists. LLM rerank reuses
  the same Capability Gateway preflight liveContext seam we wired into
  the NBE rerank — triple-gated no-op when keys/flags are off.

- app/api/assistant/specialist-recommend/route.ts — wraps the
  recommender with the same preflight gather contract the other four
  progression routes use, surfaceId 'specialists'.

- app/api/assistant/specialist-thread/route.ts — reads
  activity_receipts where action_type='specialist_consulted', filters
  client-side to the requested specialistId (since agents_invoked is
  an array and aigent-me co-attends every consult), returns a thin
  thread of pointers. Full-response replay is the inference-memory
  fast-follow tracked in
  codexes/packs/agentiq/updates/2026-05-25_specialists-layout-inference-memory-backlog.md.

- app/api/assistant/ask-agent/route.ts — accepts an optional
  `handoff: { fromSpecialistId, priorTitle, priorReceiptId }` body
  field. When present the route prefixes the rationale with a
  "Hand-off from X" note, tags the receipt's contextShared with
  'specialist-handoff' so the thread can flag the pivot, and surfaces
  the hand-off back on the response as `handoffFrom: { specialistId,
  priorTitle }` so the SpecialistResponseCard can render a "← marketa"
  pill in the header.

- services/agents/specialistRouter.ts — SpecialistResponse gains the
  optional `handoffFrom` field. Also fixes a stale duplicate
  `requestType` key in the template-response builder that surfaced as
  TS2783 once SpecialistResponse grew the new field.

New client pieces:

- components/metame/welcome/layouts/SpecialistsLayout.tsx — DIS
  template specialists-layout-v1. Five stacked sections:
    1. aigentMe recommendation card (with preflight byline)
    2. Roster strip — all 8 specialists with availability status dots
       (cyan=active, slate=always-available, amber=needs-activation),
       violet ring on the selected one
    3. Active specialist focus card; gated specialists show an
       "Activate <source>" CTA wired to the activations editor
    4. Composer (textarea + mic + 3 prompt templates per specialist)
    5. Current-session SpecialistResponseCard for the selected
       specialist, with a hand-off strip showing every other available
       specialist as a single-click pivot. Below that, a "Prior
       consultations" mini-list from the thread endpoint with
       cartridge + when + hand-off flag.

- components/metame/cards/SpecialistResponseCard.tsx — renders the
  "← from X" pill when handoffFrom is set; existing PreflightByline
  + PreflightChip continue to work.

- components/metame/welcome/layouts/types.ts — 'specialists' added to
  RightPaneLayoutId; layoutProps gain a `specialistsLayout` state
  bundle + onSelectSpecialist / onAskSelectedSpecialist /
  onSetSpecialistPrompt / onHandoffSpecialist /
  onOpenActivationsForSpecialist handlers.

- components/metame/welcome/layouts/registry.ts — register the new
  layout under 'specialists'.

- app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx —
  repoints the "Ask specialists" chip from
  setExpandedSectionId('specialists') to setActiveLayoutId('specialists')
  + fetchSpecialistRecommendation(). Adds state + fetchers for the
  recommendation, thread, and hand-off flow. handleAskSpecialist gains
  an optional handoff parameter that the layout passes through when
  the operator clicks a hand-off chip.

Backlog:

- codexes/packs/agentiq/updates/2026-05-25_specialists-layout-inference-memory-backlog.md
  captures the inference-memory linkage so prior consultations can
  replay as full response cards rather than thin pointers. Five-step
  spec covering persistence, route extension, layout UX, recommender
  cross-session awareness, and the privacy/DVN posture.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Added | `app/api/assistant/specialist-recommend/route.ts` |
| Added | `app/api/assistant/specialist-thread/route.ts` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-25_specialists-layout-inference-memory-backlog.md` |
| Modified | `components/metame/cards/SpecialistResponseCard.tsx` |
| Added | `components/metame/welcome/layouts/SpecialistsLayout.tsx` |
| Modified | `components/metame/welcome/layouts/registry.ts` |
| Modified | `components/metame/welcome/layouts/types.ts` |
| Modified | `services/agents/specialistRouter.ts` |
| Added | `services/orchestration/specialistRecommender.ts` |

## Stats

 12 files changed, 1642 insertions(+), 17 deletions(-)
