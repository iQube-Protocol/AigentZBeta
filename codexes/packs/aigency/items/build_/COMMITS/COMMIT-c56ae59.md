# Commit Brief: `c56ae59` — copilot: kill KNYT lore bias + thread brief shape + admin grants into LLM context

| Field | Value |
|-------|-------|
| SHA | [`c56ae59`](https://github.com/iQube-Protocol/AigentZBeta/commit/c56ae59256287ce9c5aa09bc97a39ae13057731a) |
| Author | Claude |
| Date | 2026-05-26T14:46:41Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
copilot: kill KNYT lore bias + thread brief shape + admin grants into LLM context

Three coordinated changes that fix the "aigentMe copilot keeps
generating KNYT lore for venture-focused operators" report
2026-05-26. Each ships individually but reinforces the others.

Move C — kill the KNYT lore default-fallback in /api/codex/chat
---------------------------------------------------------------
TWO bugs colluded to produce KNYT prose for every persona that
wasn't explicitly handled:

  (1) fetchCodexMetadata(domain) only branched on
      domain === 'qriptopian' — every OTHER value (including
      'agentiq' from aigentMe / aigent-z / aigent-c) FELL THROUGH
      to a default block that unconditionally queried
      codex_characters / codex_knyt_cards / codex_episodes WHERE
      series = 'metaKnyts'. Even though buildSystemPrompt gates the
      injected character/episode summaries on KNYT_FOCUSED_AGENTS,
      the metadata fetch happened anyway and the stats made it into
      the "You have access to the complete metaKnyts Codex" line of
      the prompt — implicitly telling the LLM "your knowledge base
      is KNYT lore" for every persona.

  (2) SmartTriadCopilotLayer resolved persona via
      `personaId ?? 'aigent-kn0w1'` — but the aigentMe surface
      passes `agent={ id: 'aigent-me' }` WITHOUT a separate
      personaId prop. The copilot was therefore treated as Kn0w1
      (a KNYT_FOCUSED_AGENT) and got the full character/episode
      character-summary injection block on every turn.

Fixes:
  - fetchCodexMetadata returns empty stats for any domain other
    than 'metaKnyts' or 'qriptopian'. Aigency personas (agentiq /
    protocol) no longer get KNYT metadata grafted into their
    prompt.
  - Resolved persona fallback chain becomes `personaId ?? agent?.id
    ?? 'aigent-z'`. The aigentMe panel's agent.id is now respected,
    so the copilot reads as aigent-me and the KNYT_FOCUSED_AGENTS
    gate excludes it correctly.

Move B — admin grants readable
------------------------------
useAigentMeCopilotBridge gains `cartridgeAdminGrants` readable
populated from useCartridgeAdminGrants. The copilot now sees
{ isGlobalAdmin, adminCartridges[] } every turn and biases toward
chief-of-staff moves (review queues, partner ops, pipeline state)
when the persona qualifies. Plumbed via AigentMeWelcomeSplitTab.

Move A — brief shape as readable context
----------------------------------------
The activeBrief readable used to be `{ hasBrief, summary }` only —
and brief.summary doesn't even exist on BriefCardData. Replaces it
with the structured shape:
  { briefType, primaryGoal, experienceName, currentStage,
    topPriorities[], nextBestActions[] }
Each NBA carries id / label / rationale / cartridge / effort /
impact / approvalRequired / suggestedArtifact so the LLM can name
specific rows in its narrative ("here's why drafting that Gmail
outreach via workspace is your strongest move right now") instead
of generating unrelated suggestions from RAG.

The readable's description string explicitly instructs the LLM:
"ground your narrative in the exact topPriorities + nextBestActions
rows the right pane is rendering — name them by label, reference
their rationale, and prescribe specific next moves rooted in this
list. Do NOT invent unrelated suggestions."

Same enrichment also added to experienceModelStatus
(primaryGoal added), and the activeCartridges readable description
gained an explicit "never propose work on cartridges that are NOT
in this list" instruction so the LLM doesn't drift onto unactivated
surfaces.

Net behaviour after deploy
--------------------------
- aigentMe copilot's narrative grounds in the deterministic brief
  shape — no more lore prose for a venture-focused operator
- Domain bias correct by persona: aigentMe → agentiq KB (which
  today returns empty, falling back to the persona's own system
  prompt — clean, neutral framing). KNYT-bound personas
  (aigent-kn0w1, aigent-marketa) still get KNYT context as before.
- Admin grants influence framing: an uber-admin sees orchestration-
  biased suggestions; tenant-admins see chief-of-staff moves on
  their granted cartridges.

Followup
--------
Move D (left ↔ right context-aware NBA prepopulation) is the next
step — design proposal coming separately. Idea: have the copilot's
narrative also emit a structured "suggested compose context" for
each NBA so clicking e.g. "Draft a Gmail outreach" pre-populates
the compose modal with the operator-specific brief excerpt
("Outreach to <named partner> about <specific cycle event> per
your brief — here's a draft for review").

44/44 admin canaries still pass. No new typecheck errors from
these changes (pre-existing implicit-any errors in
AigentMeWelcomeSplitTab are unrelated; tracked separately).
```

## Body

Three coordinated changes that fix the "aigentMe copilot keeps
generating KNYT lore for venture-focused operators" report
2026-05-26. Each ships individually but reinforces the others.

Move C — kill the KNYT lore default-fallback in /api/codex/chat
---------------------------------------------------------------
TWO bugs colluded to produce KNYT prose for every persona that
wasn't explicitly handled:

  (1) fetchCodexMetadata(domain) only branched on
      domain === 'qriptopian' — every OTHER value (including
      'agentiq' from aigentMe / aigent-z / aigent-c) FELL THROUGH
      to a default block that unconditionally queried
      codex_characters / codex_knyt_cards / codex_episodes WHERE
      series = 'metaKnyts'. Even though buildSystemPrompt gates the
      injected character/episode summaries on KNYT_FOCUSED_AGENTS,
      the metadata fetch happened anyway and the stats made it into
      the "You have access to the complete metaKnyts Codex" line of
      the prompt — implicitly telling the LLM "your knowledge base
      is KNYT lore" for every persona.

  (2) SmartTriadCopilotLayer resolved persona via
      `personaId ?? 'aigent-kn0w1'` — but the aigentMe surface
      passes `agent={ id: 'aigent-me' }` WITHOUT a separate
      personaId prop. The copilot was therefore treated as Kn0w1
      (a KNYT_FOCUSED_AGENT) and got the full character/episode
      character-summary injection block on every turn.

Fixes:
  - fetchCodexMetadata returns empty stats for any domain other
    than 'metaKnyts' or 'qriptopian'. Aigency personas (agentiq /
    protocol) no longer get KNYT metadata grafted into their
    prompt.
  - Resolved persona fallback chain becomes `personaId ?? agent?.id
    ?? 'aigent-z'`. The aigentMe panel's agent.id is now respected,
    so the copilot reads as aigent-me and the KNYT_FOCUSED_AGENTS
    gate excludes it correctly.

Move B — admin grants readable
------------------------------
useAigentMeCopilotBridge gains `cartridgeAdminGrants` readable
populated from useCartridgeAdminGrants. The copilot now sees
{ isGlobalAdmin, adminCartridges[] } every turn and biases toward
chief-of-staff moves (review queues, partner ops, pipeline state)
when the persona qualifies. Plumbed via AigentMeWelcomeSplitTab.

Move A — brief shape as readable context
----------------------------------------
The activeBrief readable used to be `{ hasBrief, summary }` only —
and brief.summary doesn't even exist on BriefCardData. Replaces it
with the structured shape:
  { briefType, primaryGoal, experienceName, currentStage,
    topPriorities[], nextBestActions[] }
Each NBA carries id / label / rationale / cartridge / effort /
impact / approvalRequired / suggestedArtifact so the LLM can name
specific rows in its narrative ("here's why drafting that Gmail
outreach via workspace is your strongest move right now") instead
of generating unrelated suggestions from RAG.

The readable's description string explicitly instructs the LLM:
"ground your narrative in the exact topPriorities + nextBestActions
rows the right pane is rendering — name them by label, reference
their rationale, and prescribe specific next moves rooted in this
list. Do NOT invent unrelated suggestions."

Same enrichment also added to experienceModelStatus
(primaryGoal added), and the activeCartridges readable description
gained an explicit "never propose work on cartridges that are NOT
in this list" instruction so the LLM doesn't drift onto unactivated
surfaces.

Net behaviour after deploy
--------------------------
- aigentMe copilot's narrative grounds in the deterministic brief
  shape — no more lore prose for a venture-focused operator
- Domain bias correct by persona: aigentMe → agentiq KB (which
  today returns empty, falling back to the persona's own system
  prompt — clean, neutral framing). KNYT-bound personas
  (aigent-kn0w1, aigent-marketa) still get KNYT context as before.
- Admin grants influence framing: an uber-admin sees orchestration-
  biased suggestions; tenant-admins see chief-of-staff moves on
  their granted cartridges.

Followup
--------
Move D (left ↔ right context-aware NBA prepopulation) is the next
step — design proposal coming separately. Idea: have the copilot's
narrative also emit a structured "suggested compose context" for
each NBA so clicking e.g. "Draft a Gmail outreach" pre-populates
the compose modal with the operator-specific brief excerpt
("Outreach to <named partner> about <specific cycle event> per
your brief — here's a draft for review").

44/44 admin canaries still pass. No new typecheck errors from
these changes (pre-existing implicit-any errors in
AigentMeWelcomeSplitTab are unrelated; tracked separately).

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/welcome/useAigentMeCopilotBridge.ts` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |

## Stats

 4 files changed, 106 insertions(+), 10 deletions(-)
