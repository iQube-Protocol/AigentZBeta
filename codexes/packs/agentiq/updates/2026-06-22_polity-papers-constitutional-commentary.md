# Polity Paper series → Polity Core constitutional commentary

**Date:** 2026-06-22
**Status:** scaffolding shipped; content extraction is an operator-run step
**Closes (partially):** `2026-06-17_polity-paper-series-ingest-backlog.md`

## What this does

Brings the Qriptopian **Polity Paper series** into **Polity Core** as
**machine-readable constitutional commentary**, and elevates one paper —
*The Constitution of the Agentic Polity* (4th paper of the Polity series) — to
ratified constitutional status. Three series are in scope:

- **Experience Sovereignty** (`papers/experience-sovereignty`)
- **COYN Thesis** (`papers/coyn-thesis`)
- **The Polity** (`papers/polity`)

The papers are published as PDFs in the Qriptopian codex
(`codex_media_assets`, `series='qriptopian'`), enumerated by the public
`GET /api/codex/qripto/papers`. They are converted to markdown + indexed so
agents can reason over them via inference for constitutional direction — even
before any concept paper is formally ratified.

## Shipped (in this branch)

- **Machine-readable index** `services/polity/frameworks/polity-papers-commentary.v1.json`
  (status `commentary`) — three series + a seeded `concepts` block (PoWP, PoTS,
  Time Sovereignty, Experience Sovereignty) so agents get direction immediately.
  `series[].papers[]` is filled by the ingest script.
- **Elevated constitution** `services/polity/frameworks/constitution-agentic-polity.v1.json`
  (status `ratified`). NOTE: intentionally **not** added to
  `CURRENT_CONSTITUTIONAL_VERSIONS` — binding it re-binds every Agent Passport
  and is a separate governance act.
- **Loader** `services/polity/constitution.ts` — `getPolityPapersCommentary()`
  and `getConstitutionOfAgenticPolity()`; both added to the bundle served by
  `GET /api/polity-core/constitution`.
- **Cartridge surface** — Polity Core gains a **Commentary** tab group (three
  series tabs) + a **Constitution of the Agentic Polity** tab. Collections added
  to `codexes/packs/polity-core/collections.json` with a README placeholder
  until extraction runs.
- **Ingest script** `scripts/ingest-polity-papers.mjs`.

## Operator step — run the extraction

The Claude Code sandbox has no outbound network and PDF text extraction is
unreliable on Lambda, so extraction runs on a machine with network access
(your laptop / CI). The PDF URLs are public, so no Supabase credentials are
needed — only the host:

```bash
node scripts/ingest-polity-papers.mjs --host=https://dev-beta.aigentz.me
# preview first with: --dry-run
```

It downloads each paper, extracts text via `pdf-parse`, writes
`codexes/packs/polity-core/items/commentary/<series>/<NN-slug>.md`, rewrites the
commentary collections + the `polity-papers-commentary.v1.json` index, and fills
`CONSTITUTION_OF_AGENTIC_POLITY.md` + `constitution-agentic-polity.v1.json`.
Review the diff and commit the generated markdown + JSON.

## Inference availability

- The commentary index + concepts are in the constitutional bundle
  (`GET /api/polity-core/constitution`) — directly consumable by agents/services.
- Per-paper full text is served from the pack via
  `GET /api/codex/packs/polity-core/file?path=items/commentary/...`.
- **Semantic + keyword RAG (wired):** after extraction + deploy, ingest the
  commentary markdown into the Knowledge Base via
  `POST /api/admin/kb/ingest-polity-commentary` (ADMIN_OPS_TOKEN). It reads the
  committed markdown, chunks + stores it under the `qriptopian` domain
  (`contentCategory='constitutional-commentary'`; the elevated Constitution uses
  `'constitutional'`), and drains the embedding queue so agents retrieve the
  papers via `embeddingService.hybridSearch` (the chat context path). New KB
  plumbing: `KnowledgeBaseService.ingestTextDocument()` +
  `PDFExtractionService.chunkPlainText()`. Uses the existing `OPENAI_API_KEY`
  for embeddings; without an embedding key the chunks remain keyword-searchable.

## Follow-ons

- AutoDrive CID recording in the Amendment Records via the existing
  `publish-polity-core.mjs` flow (the papers are already on AutoDrive with ID
  records; record the commentary CIDs there).
- Governance decision on whether the Constitution of the Agentic Polity joins
  the Agent Passport binding triple.
