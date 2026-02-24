# Decision Brief — Agentiq Cartridge

## Context
AgentiQ uses three Codex packs:
1) KNYT Codex (mythos)
2) Qriptopian Codex (logos)
3) Agentiq Cartridge (codebase-state-led)

The Agentiq Cartridge is needed to keep product and architecture truth consistent across OpenAI and Windsurf agents.

## Decision
Create an agentic cartridge that:
- lives in-repo under `codexes/packs/agentiq/`
- mirrors to Autodrive for agent retrieval
- auto-updates on every merged PR
- acts as the canonical "front door" for agents

## Autodrive model
- Git remains raw truth.
- Autodrive is curated, agent-ready truth.

## PR auto-update outputs
On merge, generate:
- PR brief (structured)
- index.json update
- optional weekly rollup

## Retrieval guidance
Agents must read:
1) `AGENTIQ_CARTRIDGE.md`
2) `SYSTEM_MAP.md`
3) latest PR briefs (if relevant)

## Risks + mitigations
- Drift: require SYSTEM_MAP updates on core changes
- Noise: only update touched modules + indexes
- Secrets: exclude .env, tokens, private URLs
