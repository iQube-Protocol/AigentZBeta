# aigentZ Platform-Level Ground Knowledge — repo, registries, Autodrive, network ops

**Date:** 2026-06-12
**Branch:** `claude/sharp-einstein-wjzgqx`
**Commit:** `b8b9fd1`
**Workstream:** Operation Chrysalis Phase 1 — aigentZ Development Command Center

## What changed

The aigent-z copilot's ground knowledge previously covered only the dev loop
session state (intent → context → gaps → consequences → validation). This
session adds platform-level breadth and depth, assembled per chat turn by a
new knowledge layer.

### New: `services/knowledge/agentiqPackSearch.ts`

The pack keyword-search engine (searchCodex, getRecentCommits, excerpt
formatting, GitHub-link building) was **moved** out of
`app/api/codex/chat/aigentiq/route.ts` into this shared module. Both the
AgentiQ cartridge copilot and the aigent-z Dev Command Center copilot now use
one authoritative implementation. The aigentiq route imports from it; no
behaviour change for that surface.

### New: `services/knowledge/aigentZPlatformKnowledge.ts`

`buildAigentZPlatformKnowledge(query, origin)` assembles five layers,
cheapest first, every layer best-effort (a failed source degrades to a note,
never a failed chat turn):

1. **Static platform map** (always) — repo layout + architecture layers, the
   three core iQube Registries (template/MetaQubes · instance/BlakQubes+
   TokenQubes · capability/Ingestion Factory supply), the ingestion factory
   pipeline (tables, stages, source types), the AgentiQ cartridge tab map
   (memory / knowledge / operations groups as repo map), and the Network Ops
   surface (`/ops` page + `/api/ops/*` routes).
2. **Pack retrieval** (always) — keyword search over the aigency + agentiq
   packs (architecture, knowledge, operators manual, decisions, 146+ update
   docs) with GitHub-linked excerpts, plus recent dev commits from the
   aigency index.
3. **Repo file access** — file paths named in the query are inlined from
   disk (clamped to 6KB, max 2 files, `.env`/secret paths refused, traversal
   guarded); files not traced into the Lambda degrade to GitHub blob links.
4. **Live registry + Autodrive snapshots** (keyword-gated) — Supabase counts
   and recent rows from `registry_intakes`, `registry_assets` (by trust
   band), `iq_meta_qubes` / `iq_blak_qubes` / `iq_token_qubes`, and
   `codex_media_assets` + `master_content_qubes` for Autonomys auto-drive
   holdings. The Autodrive block restates the gated-content rules (in-app
   viewers only, no raw URLs).
5. **Live network ops snapshot** (keyword-gated) — fetches
   `/api/ops/dvn/status` and `/api/ops/crosschain/status` from the request
   origin with a 6s timeout; reports DVN lock state, pending cross-chain
   messages, latest EVM tx / ICP receipt.

### Wiring: `app/api/codex/chat/route.ts`

When the resolved agent is `aigent-z`, the POST handler builds the platform
knowledge block in parallel with the existing KB/metadata fetches and passes
it into `buildSystemPrompt` as a new optional parameter, appended after the
dev-loop ground context. Other agents are unaffected (empty block).

## Why

The operator asked for aigentZ's KB to gain platform breadth: the AgentiQ
cartridge as a live repo map with real file access, rich knowledge of the
three iQube Registries including the ingestion factory, and current network
state via the Network Ops surface. The dev-loop process knowledge was already
in place; this adds the platform substrate underneath it.

## Verification

- `tsc --noEmit` clean for all touched files.
- Functional smoke test: pack search returns scored GitHub-linked results;
  full assembly with unreachable Supabase + ops backends degrades to notes
  (no throw); a file path named in the query is inlined; worst-case block
  size ~10KB.
