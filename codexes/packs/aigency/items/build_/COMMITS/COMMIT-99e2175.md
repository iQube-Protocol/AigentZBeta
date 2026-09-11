# Commit Brief: `99e2175` — aigent-me chat: load metaMe cartridge state into system prompt

| Field | Value |
|-------|-------|
| SHA | [`99e2175`](https://github.com/iQube-Protocol/AigentZBeta/commit/99e2175eeef7e0e2a6ea7404e73a755b29904fd6) |
| Author | Claude |
| Date | 2026-05-25T18:55:28Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
aigent-me chat: load metaMe cartridge state into system prompt

When the active runtime agent resolves to aigent-me (the user's
sovereign personal aigent — see codexes/packs/metame/items/AIGENT_
TRINITY_Z_C_ME.md), the codex chat handler now loads the user's
metaMe cartridge state and renders it as a "User's metaMe Cartridge
State" block in the system prompt — so the reply is framed inside
the user's declared workstream, not as a generic system orchestrator.

Loaded:
  - ExperienceQube.meta (experienceName, experienceType, primaryGoal,
    currentStage, activeCartridges)
  - PersonalGuide.blak (focusIntent, alignmentState)

Wiring:
  app/api/codex/chat/route.ts
    - New loadMetameContext(personaId) helper. Reads via the existing
      services/iqube/experienceQube.ts spine surface (getExperienceQube
      + getPersonalGuide) — both already T0-keyed correctly.
    - Loader is called only when normalizeAgentId(aigentId) ===
      'aigent-me'. Errors and missing state fall back to generic mode
      (no cartridge block in the prompt) — never blocks the chat.
    - UserContext.metameContext field added so the loaded payload
      flows through the existing buildSystemPrompt() pipeline.
    - buildSystemPrompt renders the new context block only for
      aigent-me; other agents see no change in their prompts.

The alias chain still holds: clients sending 'aigent-z' or any other
trinity alias resolve to aigent-me and get the same enrichment. No
new request fields required — the thin client just needs to keep
sending personaId in the body (already does).

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

When the active runtime agent resolves to aigent-me (the user's
sovereign personal aigent — see codexes/packs/metame/items/AIGENT_
TRINITY_Z_C_ME.md), the codex chat handler now loads the user's
metaMe cartridge state and renders it as a "User's metaMe Cartridge
State" block in the system prompt — so the reply is framed inside
the user's declared workstream, not as a generic system orchestrator.

Loaded:
  - ExperienceQube.meta (experienceName, experienceType, primaryGoal,
    currentStage, activeCartridges)
  - PersonalGuide.blak (focusIntent, alignmentState)

Wiring:
  app/api/codex/chat/route.ts
    - New loadMetameContext(personaId) helper. Reads via the existing
      services/iqube/experienceQube.ts spine surface (getExperienceQube
      + getPersonalGuide) — both already T0-keyed correctly.
    - Loader is called only when normalizeAgentId(aigentId) ===
      'aigent-me'. Errors and missing state fall back to generic mode
      (no cartridge block in the prompt) — never blocks the chat.
    - UserContext.metameContext field added so the loaded payload
      flows through the existing buildSystemPrompt() pipeline.
    - buildSystemPrompt renders the new context block only for
      aigent-me; other agents see no change in their prompts.

The alias chain still holds: clients sending 'aigent-z' or any other
trinity alias resolve to aigent-me and get the same enrichment. No
new request fields required — the thin client just needs to keep
sending personaId in the body (already does).

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/codex/chat/route.ts` |

## Stats

 2 files changed, 90 insertions(+), 3 deletions(-)
