# AGENTS.md — Dev Rules for AigentZ / iQube Protocol (OpenAI Codex)

This file governs how OpenAI Codex agents work in this codebase.
It is derived from `docs/agent-harness/metaproof-core.md` — the canonical source of truth.
When rules conflict, the harness spec wins.

---

## Core Principle: Extend, Don't Duplicate

1. **Search for existing implementations** before writing any new code.
2. **Reuse and extend** what's there. Modify the existing unit, don't create a parallel one.
3. **Move logic when refactoring** — one authoritative location per concern.

---

## System Model

See full spec: `docs/agent-harness/metaproof-core.md`

| Role | Agent | Layer |
|------|-------|-------|
| Sovereign guardian | **metaMe** | Above all — policy veto |
| System orchestrator | **Aigent Z** | Routes, delegates, enforces |
| Customer guide | **Aigent C** | User-facing, NBE delivery |
| Cartridge lead | per-cartridge | Domain specialist |

### Routing priority chain
1. metaMe guardian (policy veto)
2. Active cartridge lead
3. Aigent Z (orchestrator)
4. Aigent C (default handler)

### Key contracts
- `NBEPlan` — `disposition: ask | act | wait | escalate | deny`
- `StudioArtifact` — handoff format for Studio→Codex→Runtime loop
- `OrchestrationEvent` — every routing decision is persisted
- `HandoffPayload` — typed interface in `types/orchestration.ts`

### Journey stages
`prospect → acolyte → keta → keji → first → zero`

### Experience depth ladder (one step at a time)
`L0 pill → L1 capsule → L2 mini_runtime → L3 codex`

---

## TypeScript Standards

- No `any` casts unless existing code already uses them in that context.
- Use `typeof x === "string"` guards before casting.
- Use `asRecord()` for safe unknown-to-object access.
- Accurate `useCallback`/`useMemo` dependency arrays — never just append.

---

## State Management Boundaries

- **Server-first**: Registry data, visibility, and ownership live in Supabase via Next.js API routes.
- **`localStorage` for UX reactivity only**: e.g. `library_<id>`, `minted_<id>` flags.
- **No SSR/CSR mismatches**: client-only conditions go inside `useEffect`.

---

## Key Directories

```
components/composer/   — ComposerStudio and experience authoring
components/registry/   — iQube registry UI
components/ui/         — Shared UI primitives
app/api/               — Next.js API routes (server-side only)
services/              — Backend services (aa-api, agentiq-wallet)
packages/              — Shared packages (smarttriad, smartwallet, avatar-host)
docs/agent-harness/    — Canonical specs (read before working on orchestration)
types/                 — orchestration.ts, studioArtifact.ts
```

---

## Shared Type Contracts

Always import from the canonical type files — do not redefine:

```typescript
// Orchestration
import type {
  AgentRoleId, JourneyStage, ExperienceDepth, AgentDisposition,
  NBEPlan, HandoffPayload, OrchestrationEvent, RoutingRequest, RoutingResponse
} from '@/types/orchestration';

// Studio artifacts
import type { StudioArtifact, StudioArtifactDraft } from '@/types/studioArtifact';
import { createDraftArtifact } from '@/types/studioArtifact';
```

---

## Commit Discipline

- One concern per commit. Keep diffs focused and minimal.
- Commit messages are imperative, lowercase, no period.
- Never bundle unrelated changes.

---

## Security

- Never hardcode secrets, keys, or credentials.
- All sensitive config lives in `.env.local`.
- `NEXT_PUBLIC_` prefix for browser-exposed values only — never for service role keys.
- Follow zero-knowledge, encryption-first, minimum-disclosure patterns for iQube data.

---

## QubeTalk Bridge — Code Transfer Protocol

Codex cannot push directly to GitHub. The bridge pattern:

1. **Complete work** and commit locally.
2. **Run `scripts/qubetalk_bridge/create_packet.py`** to generate an outbox packet with embedded file contents.
3. **The packet lands in `docs/qubetalk-bridge/outbox/`.**
4. **Ask the user to trigger Lovable relay** — Lovable posts outbox messages to the channel.
5. **Claude Code reads the inbox**, extracts the `files` array from Codex packets, writes them to the repo, commits, and deploys.

See full protocol: `docs/qubetalk-bridge/README.md`

---

## Architecture Layers

| Layer | Responsibility | Technologies |
|-------|---------------|-------------|
| Context | Semantic intelligence, RAG, iQube content | LangChain, DB-GPT, blakQube |
| Service | API integration, wallet, CRUD | Next.js API routes, Supabase, AA-API |
| State | Blockchain-backed persistence, audit trail | ICP canisters, EVM, Supabase |

---

## Harness Reference

| File | Read before working on... |
|------|--------------------------|
| `docs/agent-harness/metaproof-core.md` | Any orchestration or policy work |
| `docs/agent-harness/aigent-z-aigent-c-contract.md` | Routing, handoff, role logic |
| `docs/agent-harness/journey-state-schema.md` | Journey state, experience model, NBE |
| `docs/agent-harness/studio-artifact-schema.md` | StudioArtifact, Codex↔Studio sync |
