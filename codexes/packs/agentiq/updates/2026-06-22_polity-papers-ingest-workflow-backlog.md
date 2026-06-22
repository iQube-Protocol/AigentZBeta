# BACKLOG: Polity Paper series → Polity Core commentary + KB (in progress)

**Date:** 2026-06-22
**Status:** in progress — paused on a vision-provider blocker (operator to resolve)
**Branch:** `claude/optimistic-davinci-exiykx`
**Revisit:** end of session

## Goal

Ingest the 16 published Qriptopian Polity Papers (3 series) into Polity Core as
machine-readable **constitutional commentary** (markdown + framework index +
KB), and elevate *The Constitution of the Agentic Polity* to ratified status.

## What's built (shipped on the branch)

- **Commentary scaffolding** — `services/polity/frameworks/polity-papers-commentary.v1.json`
  (status `commentary`, seeded concepts: PoWP, PoTS, Time/Experience Sovereignty)
  + `constitution-agentic-polity.v1.json` (ratified) + loader accessors in
  `services/polity/constitution.ts` (both in the `/api/polity-core/constitution`
  bundle) + 3 commentary collections + Polity Core "Commentary" tab group +
  `items/commentary/README.md` placeholder.
- **Extraction script** `scripts/ingest-polity-papers.mjs` — enumerates papers
  via the public `/api/codex/qripto/papers`; hybrid extraction: `pdf-parse` for
  text-layer PDFs, else a **vision provider chain** (Anthropic → OpenAI →
  Venice), all reading the PDF directly (no poppler). `--dry-run` (free plan
  preview), `--limit=N`, upfront key preflight.
- **KB ingestion** — `KnowledgeBaseService.ingestTextDocument()` +
  `PDFExtractionService.chunkPlainText()` + `POST /api/admin/kb/ingest-polity-commentary`
  (reads committed markdown → chunks → embeds under the `qriptopian` domain).

## Where we are (dry-run result, 2026-06-22)

- **16 papers enumerated**, all in the 3 constitutional series.
- **10 have a real text layer** → pdf-parse (instant, free): all COYN Thesis +
  all The Polity + the Agent Runbook.
- **5 are image/vector PDFs** (no text layer) → need vision: The Sovereign
  Runtime, The Time Dividend, From Vibe Coding to Experience Vibing,
  Progressive Creative Sovereignty (20pp), Operators Manual (30pp).
- **1 broken: "5 The Experience Polity"** — its PDF URL returns **400** (a
  bad/missing `codex_media_assets` storage row — needs re-upload / asset check
  in the codex admin; not a script bug).

## Blocker (operator)

Vision transcription needs a working provider. Current state of keys:
- **Anthropic**: key authenticates but the **account is out of credits**
  (`credit balance too low`). Adding ~$5 credit makes the (working) URL flow
  succeed — cheapest path.
- **OpenAI / Venice**: fallback chain wired; operator to set `OPENAI_API_KEY`
  (recommended fallback) and/or `VENICE_API_KEY` + `VENICE_MODEL` (best-effort;
  Venice PDF support unverified).

## Next steps (to resume)

1. Resolve a vision provider (Anthropic credit, or `export OPENAI_API_KEY=…`).
2. `node scripts/ingest-polity-papers.mjs --host=https://dev-beta.aigentz.me --limit=1`
   → eyeball quality → run full (drop `--limit`).
3. Fix the "Experience Polity" upload (paper #5) so it stops 400-ing.
4. Commit the generated markdown + JSON, deploy.
5. `curl -X POST -H "Authorization: Bearer $ADMIN_OPS_TOKEN" https://dev-beta.aigentz.me/api/admin/kb/ingest-polity-commentary`
6. Record AutoDrive CIDs in the Amendment Records (existing publish-polity-core flow).
7. (Open question) Whether *The Constitution of the Agentic Polity* joins the
   Agent Passport binding triple — a governance decision, deliberately not done.

## Open verification caveats

- OpenAI's exact PDF file-input request shape + Venice's PDF support are
  untested from the dev sandbox; if a real run errors, capture the
  `all vision providers failed — …` line to tune the request format.
- Pro/Portfolio upload ingester maps uploaded layers by field name (Zod strips
  unknowns); validate against a real Pro upload's `ventures.errors[]`.
