# Commit Brief: `0a8fa17` — runtime: aigent-z → aigent-me in agent dropdown + default, alias-based

| Field | Value |
|-------|-------|
| SHA | [`0a8fa17`](https://github.com/iQube-Protocol/AigentZBeta/commit/0a8fa170bca3098828287f920585b46e9b3449cc) |
| Author | Claude |
| Date | 2026-05-25T17:52:35Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
runtime: aigent-z → aigent-me in agent dropdown + default, alias-based

The runtime agent picker now leads with "aigentMe" instead of "Aigent Z".
The two share one canonical id internally (aigent-me) so platform-
internal surfaces that still reference aigent-z (Sidebar link,
AigentZSystemChat panel, smartWallet metadata, persona maps,
specialist router) continue to resolve through the orchestra without
touching any of those files.

Changed:
  services/metame/agentLlmOrchestra.ts
    - RUNTIME_AGENT_IDS: aigent-z → aigent-me
    - AGENT_ALIASES: aigent-z / "aigent z" / copilot / aigentme /
      metame all resolve to aigent-me
    - IQUBE_ROWS: aigent-z model rows renamed to aigent-me; same six
      providers (openai gpt-4o + mini, venice uncensored, chaingpt,
      thirdweb, anthropic sonnet)
  app/api/aa/v1/runtime/_lib/runtimeShell.ts
    - AGENT_OPTIONS[0] = aigent-me ("aigentMe") with tooltip noting
      the metaMe-cartridge wiring
    - LLM_OPTIONS_BY_AGENT key aigent-z → aigent-me
    - defaultRuntimeState() picks aigent-me (removed KNYT launch
      override that pinned Kn0w1)
    - getLlmOptionsForAgent fallback aigent-z → aigent-me
  services/aa-api/src/routes/runtime.ts
    - Mirror of all three changes above
  components/metame/MetaMeRuntimeClient.tsx
    - RUNTIME_AGENTS[0] = aigent-me
    - AGENT_PERSONA_KEY: aigent-z → aigent-me
    - selectedAgent default picks aigent-me (removed KNYT launch
      override)
  services/metame/metaMeSettingsService.ts
    - ALPHA_DEFAULTS.leadAgent: aigent-kn0w1 → aigent-me
  components/metame/MetaMeSettingsPanel.tsx
    - METAME_ALPHA_DEFAULTS.leadAgent: same change

New documentation (registered in metaMe pack):
  codexes/packs/metame/items/AIGENT_TRINITY_Z_C_ME.md
    - Explains the three-surfaces-of-one-agent model:
        Aigent Z = platform agent (system orchestrator)
        Aigent C = customer-facing agent of the platform
        aigentMe = user's sovereign personalised C
    - Documents the alias-based approach and why a purist rename
      would touch hundreds of locations
    - Lists every file where each surface is configured
    - Recipe for adding a fourth surface
  codexes/packs/metame/collections.json
    - New "Agent Architecture" collection surfacing the trinity doc

Other 4 runtime agents (Kn0w1, MoneyPenny, Nakamoto, Marketa) unchanged
per operator direction — the broader agent roster needs more thought.

Deeper KB wiring (loading PersonalGuide / ExperienceModel /
ExperienceQube into the system prompt when aigent-me is the active
runtime agent) is the follow-up. Today's change wires the visible
surface + identity resolution; the prompt-context injection requires
touching the chat handler.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

The runtime agent picker now leads with "aigentMe" instead of "Aigent Z".
The two share one canonical id internally (aigent-me) so platform-
internal surfaces that still reference aigent-z (Sidebar link,
AigentZSystemChat panel, smartWallet metadata, persona maps,
specialist router) continue to resolve through the orchestra without
touching any of those files.

Changed:
  services/metame/agentLlmOrchestra.ts
    - RUNTIME_AGENT_IDS: aigent-z → aigent-me
    - AGENT_ALIASES: aigent-z / "aigent z" / copilot / aigentme /
      metame all resolve to aigent-me
    - IQUBE_ROWS: aigent-z model rows renamed to aigent-me; same six
      providers (openai gpt-4o + mini, venice uncensored, chaingpt,
      thirdweb, anthropic sonnet)
  app/api/aa/v1/runtime/_lib/runtimeShell.ts
    - AGENT_OPTIONS[0] = aigent-me ("aigentMe") with tooltip noting
      the metaMe-cartridge wiring
    - LLM_OPTIONS_BY_AGENT key aigent-z → aigent-me
    - defaultRuntimeState() picks aigent-me (removed KNYT launch
      override that pinned Kn0w1)
    - getLlmOptionsForAgent fallback aigent-z → aigent-me
  services/aa-api/src/routes/runtime.ts
    - Mirror of all three changes above
  components/metame/MetaMeRuntimeClient.tsx
    - RUNTIME_AGENTS[0] = aigent-me
    - AGENT_PERSONA_KEY: aigent-z → aigent-me
    - selectedAgent default picks aigent-me (removed KNYT launch
      override)
  services/metame/metaMeSettingsService.ts
    - ALPHA_DEFAULTS.leadAgent: aigent-kn0w1 → aigent-me
  components/metame/MetaMeSettingsPanel.tsx
    - METAME_ALPHA_DEFAULTS.leadAgent: same change

New documentation (registered in metaMe pack):
  codexes/packs/metame/items/AIGENT_TRINITY_Z_C_ME.md
    - Explains the three-surfaces-of-one-agent model:
        Aigent Z = platform agent (system orchestrator)
        Aigent C = customer-facing agent of the platform
        aigentMe = user's sovereign personalised C
    - Documents the alias-based approach and why a purist rename
      would touch hundreds of locations
    - Lists every file where each surface is configured
    - Recipe for adding a fourth surface
  codexes/packs/metame/collections.json
    - New "Agent Architecture" collection surfacing the trinity doc

Other 4 runtime agents (Kn0w1, MoneyPenny, Nakamoto, Marketa) unchanged
per operator direction — the broader agent roster needs more thought.

Deeper KB wiring (loading PersonalGuide / ExperienceModel /
ExperienceQube into the system prompt when aigent-me is the active
runtime agent) is the follow-up. Today's change wires the visible
surface + identity resolution; the prompt-context injection requires
touching the chat handler.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/aa/v1/runtime/_lib/runtimeShell.ts` |
| Modified | `codexes/packs/metame/collections.json` |
| Added | `codexes/packs/metame/items/AIGENT_TRINITY_Z_C_ME.md` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |
| Modified | `components/metame/MetaMeSettingsPanel.tsx` |
| Modified | `services/aa-api/src/routes/runtime.ts` |
| Modified | `services/metame/agentLlmOrchestra.ts` |
| Modified | `services/metame/metaMeSettingsService.ts` |

## Stats

 9 files changed, 160 insertions(+), 34 deletions(-)
