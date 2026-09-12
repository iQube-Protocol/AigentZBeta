# Reciprocal Artifact Exchange — Actual Document Content, Not Just Metadata

**Status:** Shipped. Fixes the gap flagged live (2026-09-12): "It's pointless having all of this wrapping if we can't actually see the content, the actual bytes... we're sharing it with Ian, and if Ian cannot access that content, then the whole exercise is pointless."

## The gap

`ExchangeArtifactRecord` (`types/reciprocalExchange.ts`) always carried `sourceType`/`sourceReference`/`storageReference`/`repositoryCommit`/`mimeType`, and `getExchangeView` already correctly, fail-closed-ly disclosed that *metadata* once the exchange's disclosure policy permitted it. But nothing in the codebase ever dereferenced those fields into actual bytes/text — the UI's `ArtifactCard` (`IRLExchangeTab.tsx`) rendered only fingerprint/source-path/commit strings. A participant could see that a document existed and its hash, never the document itself.

Confirmed against the live `CI/IRL × OCSGA Independent Architecture Exchange` row (`0b4134a6-6246-48a8-98f6-e3a22fcd18b3`):
- Party A: `source_type: 'repository-commit'`, `source_reference: 'codexes/packs/irl/foundation/experiments/ci-irl-native-architecture-baseline-v1.0.md'` — a real, readable 22KB markdown file confirmed to exist at exactly that path.
- Party B: `source_type: 'immutable-reference'`, `storage_reference: 'autodrive:860e6ac7-...:bafkr6i...'` — a DOCX on Autonomys Auto Drive, registered operator-assisted.

Both references were always genuine and correctly deposited — this was a missing-renderer problem, not a broken deposit.

## What shipped

**`services/research/reciprocalExchange.ts`** — new `resolveExchangeArtifactContent(admin, {exchangeId, personaId, party})`, gated by the SAME `getExchangeView` disclosure decision (never a second, parallel authorization path). Dispatches by `sourceType`:

- `repository-commit` — reads the file directly from the deployed repo filesystem, bounded to paths under `codexes/` (no traversal). No new dependency; this is the same class of read `/api/codex/packs/irl/file` already performs for reviewer-kit documents.
- An `autodrive:`-prefixed `storageReference` — parses the CID (final `:`-separated segment) and downloads via `@autonomys/auto-drive`'s `createAutoDriveApi(...).downloadFile(cid)` — the exact same call `/api/content/pdf/[cid]/route.ts` already uses in production, reused rather than reimplemented. Then:
  - DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) → `mammoth.extractRawText({buffer})` (already a `package.json` dependency, previously an unused Phase-2 stub in `services/uploads/uploadIndexer.ts` — now actually wired for the first time).
  - `text/markdown` / `text/plain` → decoded directly.
  - Anything else → an honest `format: 'unsupported'` note naming the mime type, never fabricated content.
- Any other `sourceType`/reference shape → the same honest `unsupported` response.

**`GET /api/research/exchanges/[exchangeId]/artifact-content?party=A|B`** — new route, same auth/error conventions as the existing `GET /api/research/exchanges/[exchangeId]` metadata route.

**`IRLExchangeTab.tsx`** — `ArtifactCard` gained a "Read document" expandable section (new `ArtifactContentReader`) that fetches this route on first expand and renders the content inline — never a link out, per CLAUDE.md's "render, don't redirect" rule. Mirrors `WorkspaceCapabilitiesPanel.tsx`'s existing `DocumentRow` expand-on-click pattern rather than inventing a new one.

## Verified

- `npx tsc --noEmit`: clean, no new errors.
- `tests/reciprocal-exchange.test.ts`, `reciprocal-exchange-implementation-singularity.test.ts`, `irl-exchange-focus-contract.test.ts`, `ocsga-exchange-actions-route.test.ts`, `ocsga-exchange-principal-gate.test.ts`, `ctp-exchange-artifact-confirm-primitive.test.ts` — 107 tests, all passing, no regressions.
- Party A's repository-commit path verified end-to-end against the real live file (read succeeded, 22,177 characters, correct opening line).
- Party B's Auto Drive/DOCX path reuses proven production code verbatim (the PDF-stream route's own download call) — **not independently live-tested from this session** (no `AUTONOMYS_API_KEY` available in this sandbox, and neither login available to this session is a party to the live OCSGA exchange to drive a full authenticated HTTP round-trip). Recommend the operator do one live click-through on the real exchange to confirm the DOCX branch end-to-end.

## Known limitation, stated honestly

Only `repository-commit` and an `autodrive:`-prefixed `storageReference` have a working extractor. `upload` (a bare, non-autodrive storage path) and `manifest` source types still return an honest "no extractor exists yet" note rather than fabricated content — extend `extractArtifactText` in `services/research/reciprocalExchange.ts` if/when those need support.
