# AgentiQ Codex — Start Here

This Codex is the canonical knowledge base (KB) for **Aigent Z** and the **AgentiQ** platform.

**Custody:** Aigent Z owns and maintains this codex. Both the Platform Copilot (`mode=copilot`) and the Aigent Z System AI (`mode=system`) draw from this as their authoritative source of truth.

## What's inside

- **Codex**: omni content surface (Liquid UI default)
- **Build**: briefs, backlog, decisions, work allocation, changelog
  - **PR/**: auto-generated PR briefs on every merge to main
  - **DECISIONS/**: structured decision notes extracted from PRs
  - **PROBLEMS/**: structured problem logs extracted from PRs
  - **templates/**: templates for humans and agents filling PR sections
- **Architecture**: how the system works (system map, data/identity, payments, protocols)
- **Knowledge**: canonical docs + API + schemas + snippets
- **Tutorials**: quickstarts + how-tos + recipes
- **Repos**: repo map + modules + conventions
- **Memory**: retrieval index + receipts + context packs + prompts/policies

## How to navigate (agents and humans)

When answering any product or architecture question:
1. Read `architecture/system-map.md` for the big picture
2. Check `build_/DECISIONS/` for intent and constraints behind current choices
3. Check `build_/PR/` for what changed recently and why
4. Check `build_/PROBLEMS/` for known issues and their resolutions
5. Only then read source code for implementation details

## PR-driven update pipeline

Every merged PR to `main` automatically:
1. Generates a PR brief → `build_/PR/PR-<number>.md`
2. Extracts decision notes → `build_/DECISIONS/` (if `## AIGENTZ_DECISIONS` has content)
3. Extracts problem logs → `build_/PROBLEMS/` (if `## AIGENTZ_PROBLEMS` has content)
4. Updates `build_/changelog.md` and `memory/retrieval-index.md`
5. Updates `index.json` with latest PR pointer
6. Syncs to Autodrive (when `AUTODRIVE_ENDPOINT` secret is configured)

This is deterministic — no LLM is required.

## Standing directives

- **Integrate, don't rebuild.**
- **Server authoritative** for gating, entitlements, unlock, receipts.
- **No locked content leaks.**
- **Update `architecture/system-map.md`** whenever core flows or module contracts change.

## Aigent Z interfaces

Both interfaces below draw from this codex as their KB:

| Interface | Mode | Tone | Entry |
|-----------|------|------|-------|
| Aigent Z System AI | `mode=system` | Operational, conservative | Aigents → Aigent Z → System AI |
| Platform Copilot | `mode=copilot` | Creative, skill-enabled | `/copilot` or Copilot menu |
