# Aigent Me Refinements — Quicklinks + Emerald Copilot + Metame Brand Mix

**Date:** 2026-05-12
**Workstream:** Aigent Me post-Phase-7 refinements
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Predecessors:** Phase 6 + 7 artifacts + receipts pipeline (8f977db)

---

## What landed

Three operator-requested refinements, in one commit.

### 1. QuickLinksCard on the welcome surface

`components/metame/cards/QuickLinksCard.tsx` (new) — deep links into the cartridges + tabs the user works in most. Built on `buildCodexUrl` per the CLAUDE.md inter-cartridge navigation rule, so `personaId` (or `personaSessionToken` when wired) travels with every link.

Default links:

| Label | Destination |
|---|---|
| KNYT · Bundles | `knyt-codex` tab `store-bundles` |
| KNYT · Codex | `knyt-codex` tab `scrolls` |
| The Qriptopian | `qripto-codex` tab `qriptopia` |
| Marketa · Propose | `marketa-codex` tab `propose` |
| Marketa · Reports | `marketa-codex` tab `reports` |
| AgentiQ · Alpha Program | `aigentiq-codex` tab `alpha-program` |
| Venture Lab α | `alpha-knyt-codex` tab `alpha-programme` |
| AgentiQ OS | `agentiq-os-cartridge` tab `os-readme` |

Renders below the iQube disclosure strip + above the context chips. Each tile is a deep `<a>` with hover-emerald border accent.

### 2. Aigent Me copilot on every metaMe cartridge tab

Mounted `CodexCopilotLayer` on `codexId === 'metame-codex'` in `CodexPanelDynamic.tsx`. Renders alongside Experience Framework, Journey Dashboard, and the new Aigent Me tab.

Configuration:
- `accentColor='emerald'` — full emerald branding (button, bubbles, input border, send button, pills, highlights — every previously-hardcoded `cyan-*` class now derives from the chosen accent — see refactor below)
- `agent={{ id: 'aigent-me', name: 'Aigent Me' }}` — the chat route at `/api/codex/chat` uses the agent id to look up the system prompt from `app/data/personas.ts::aigent-me` (registered in Phase 0)
- `initialMessage` — "I'm Aigent Me — your sovereign chief of staff inside metaMe. I know your active ExperienceModel, your goals, the cartridges you're moving forward, and which specialists I can coordinate. Ask me anything."
- `quickPrompts` — `Brief me`, `Move this forward`, `Review venture progress`, `Ask Marketa`, `Ask Quill`, `Ask Kn0w1` (mirrors the welcome CTA labels)
- `contextId={'metame-' + activeTabSlug}` — chat history scoped per tab

### 3. Full emerald fidelity — CodexCopilotLayer ACCENT refactor

The component had a small ACCENT colormap (3 derived classes) but most of the chrome was hard-coded `cyan-*`. Expanded to a full `AccentPalette` covering 14 styled tokens (button bg, hover bg, input focus border, pill border / bg / text / hover, soft bg / text / hover, highlight bg / text / strong, bubble, hex, bot). Every previously-cyan class now derives from `ACCENT.<token>`. Result: `accentColor='emerald'` re-themes the entire surface in one declaration.

Palettes shipped for: `cyan`, `fuchsia`, `rose`, `amber`, `emerald`, `green`, `indigo`. Default falls back to `cyan` for compatibility with any caller that doesn't specify one.

### 4. Emerald accents mixed into welcome cards (alongside violet)

The operator asked for "more emerald alongside the lilac/purple". Surgical injections:

- `IqubeContextDisclosure` — surface bg/border/accent moves to emerald. This strip appears across every Aigent Me card; making it emerald anchors the metaMe brand at every persistent surface.
- `ExperienceModelCard` — stage chip moves to emerald (was slate). Header stays violet for primary brand prominence.
- `BriefCard` — top-priority chevron icons move to emerald. Header stays violet.

The pattern: **violet = Aigent Me primary** (headers, CTA accents, primary buttons); **emerald = metaMe surface anchor** (persistent rails, stage chips, priority indicators). Neither replaces the other; they complement.

---

## Files

| File | Change |
|---|---|
| `app/components/codex/CodexCopilotLayer.tsx` | Refactored — full `AccentPalette` derives all colors from `accentColor` prop. Removed ~20 hardcoded `cyan-*` references. |
| `app/triad/components/CodexPanelDynamic.tsx` | Added `metameCopilotOpen` state + mounted `<CodexCopilotLayer>` on `codexId === 'metame-codex'`. |
| `components/metame/cards/QuickLinksCard.tsx` | **New** — `buildCodexUrl`-driven deep links into all major cartridges. |
| `components/metame/cards/IqubeContextDisclosure.tsx` | Surface + accent moved to emerald. |
| `components/metame/cards/ExperienceModelCard.tsx` | Stage chip moved to emerald. |
| `components/metame/cards/BriefCard.tsx` | Priority chevrons moved to emerald. |
| `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` | Threads `personaId` to `<QuickLinksCard>`; renders the card above the context chips. |

---

## Privacy held

- `buildCodexUrl` carries `personaId` (T0-legacy) or `personaSessionToken` (T1) via existing helpers; no new identifier surfaces.
- Copilot mount inherits the same PersonaSpine + chat route auth pipeline already in use for Marketa / KNYT copilots.
- Emerald accent palette is purely presentational; no auth/identity implications.

---

## Reuse-first audit

| Existing primitive | Used? |
|---|---|
| `utils/codex-nav.ts::buildCodexUrl` | ✓ — sole URL builder for cross-cartridge links |
| `app/components/codex/CodexCopilotLayer` | ✓ — same component used by Marketa / KNYT mounts |
| `app/api/codex/chat/route.ts` | ✓ — copilot's existing LLM call path; no new server route |
| `app/data/personas.ts::aigent-me` (Phase 0) | ✓ — system prompt source for the copilot |
| `IqubeContextDisclosure` (Phase 2.b) | re-themed; no API change |

No new server routes. No new tables. No protected files (CLAUDE.md identity-spine list) modified.

---

## Validation

1. **Quicklinks** — Refresh the metaMe cartridge → Aigent Me tab. Below the iQube disclosure strip, a "Open a cartridge" grid renders with 8 tiles. Clicking any opens the destination cartridge at the right tab with personaId propagated.
2. **Copilot on every metaMe tab** — Visit Aigent Me, Experience Framework, and Journey Dashboard tabs. A floating emerald copilot button appears on each. Click it → chat panel opens with the Aigent Me initial message + quick prompts.
3. **Emerald fidelity** — Copilot button is emerald (not cyan). Input border focus is emerald. Send button is emerald. Quick-prompt pills are emerald. User message bubbles are emerald. Bot messages stay slate as before.
4. **Mixed brand** — iQube disclosure strip is emerald. ExperienceModel card stage chip is emerald. BriefCard priority chevrons are emerald. Header / CTA / primary buttons remain violet.

---

## Next

- **Phase 6.b — Google Workspace** — backlog doc landed in this same release (`2026-05-12_aigent-me-phase-6b-google-workspace-alignment-backlog.md`). Captures the workflowQube alignment with Studio skills + Marketa Mailjet per the operator instruction.
- **Phase 5.b — LLM fallbacks + Quill persona** — register `quill` in `app/data/personas.ts`; add Anthropic + Venice fallback paths to `services/agents/specialistRouter.ts`.
- **PersonaSpine sweep** — 4 deferred files (MetaMeRuntimeClient, ComposerStudio, RuntimeCapsuleRemixEditor, personaService).
