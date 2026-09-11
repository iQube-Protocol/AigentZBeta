# CVR-002 (candidate) — Studio Composer adopts the Artifact Runtime + Observer Awareness

**Constitutional Validation Run 002 (candidate).** Executes the CLAUDE.md rule
"Artifact Production — AR/CPS + Observer Awareness" against the largest non-adopted surface:
Studio Composer, whose image / video / article / bundle productions bypassed `artifact_records`
entirely.

**Date:** 2026-07-14 · **Harness:** Claude Code (D1 — execution stays human) · **Pattern precedent:** CFS-025 increment 3 (`businessArtifactTiering`), CVR-001 stage order

## Intent

> Studio Composer's productions participate in the disposable | operational consequence ladder:
> completed durable productions persist as ArtifactRecords through the AR seam
> (`saveArtifactRecord`), previews/drafts/failures stay disposable (never persisted), and the
> surface gains an observer seam for the current state of artifact production in its space.

## Capability Evidence (gathered by reconnaissance, not asserted)

- EXISTING · `components/composer/ComposerStudio.tsx` (13,689 lines) — productions hit
  `/api/skills/image/generate` (line 2739), `/api/skills/invoke` (2813),
  `/api/composer/article-draft` (2678); long-form video via SkillVideoPlayer →
  `/api/skills/video/stitch` (comment at 5398); completion of submitted video jobs is
  **client-side polled** through `/api/skills/video/[id]/status`. DCIR seam (`useDcirSeam`,
  line 2651) is an **in-session ring buffer** — no server ground/overview fetch on mount that
  could carry `artifactProduction`.
- EXISTING · `/api/skills/image/generate` — success = `live.length > 0`; live images are already
  persisted to Supabase storage; simulation/failure falls back honestly. [wire]
- EXISTING · `/api/skills/invoke` — video SUBMISSION seam: returns `generation_id` and (except a
  rare immediate-completion branch that resolves `videoUrl` in-response) NO completed video. [wire, submission-aware]
- EXISTING · `/api/skills/video/[id]/status` — the completion seam, but POLLED repeatedly and
  serves a cached fast path on every subsequent call; `saveArtifactRecord` is insert-only (no
  idempotent upsert) → recording here would write one record per poll. [out of scope — honest]
- EXISTING · `/api/skills/video/stitch` — resolves a durable Supabase URL exactly once per stitch
  (deterministic `stitchId`). The clean single-shot completion seam for long-form video. [wire]
- EXISTING · `/api/composer/article-draft` — thin wrapper over
  `services/composer/articleDraftService.ts` (CVR-001); deterministic fallback still returns a
  draft when no real input exists. [wire, input-aware]
- EXISTING · `/api/composer/experiences` POST — ExperienceQube creation persists to its OWN
  canonical store (`composerService`) with a registry publish path (`/api/registry/publish`). [none]
- EXISTING · `services/artifact/artifactRecordStore.ts` (`saveArtifactRecord` — best-effort,
  soft-fail; disposable NEVER persisted), `services/artifact/businessArtifactTiering.ts` (the
  additive route-tiering precedent), `app/api/assistant/create-artifact/route.ts` (the additive
  spread pattern), `app/api/research/overview/route.ts` (the `artifactProduction` observer block),
  `types/constitutionalObject.ts` `findForbiddenObjectKey` (T0 deep-scan guard). [use_directly]
- MISSING · `services/composer/studioArtifactTiering.ts` — the pure Studio classifier.
- MISSING · an observer seam Studio can fetch (`/api/composer/artifact-production`).
- NEVER · change existing response fields · write receipts (operational tier = record only) ·
  put a T0 identifier in a record body · touch dvn/identity/access/encryption/runArtifact internals.

## Constitutional Decision (per flow, taken before implementation)

| Flow | Mechanism | Decision |
|---|---|---|
| Image generation | **code** (additive, route level) | Completed live set → operational `multimedia` record; simulated/failed → disposable, never persisted. Alternative (client-side recording) rejected: persistence is a server concern and the client cannot be trusted with it. |
| Article draft | **code** (additive, route level) | Completed draft with a REAL prompt or title → operational `documentation`; unprompted deterministic fallback and failed drafts → disposable. A `provider: 'fallback'` draft from real input still records — it is a completed asked-for draft. |
| Video generation (invoke) | **code, submission-aware** | Submission ≠ production: submitted/simulated → disposable (the video does not exist yet). Only the rare immediate-completion branch records (operational `multimedia`). The poll-completion seam (`/api/skills/video/[id]/status`) is **deliberately not wired**: it fires repeatedly (poll loop + cached fast path) and the record store has no idempotent upsert — wiring it would mint duplicate records per poll. Honest follow-on: an idempotent record-by-content-hash seam, then record at first completed poll. |
| Video stitch | **code** (additive, route level) | Single-shot durable completion → operational `multimedia` record. Known limit: re-stitching identical clips is storage-idempotent (deterministic `stitchId`) but would insert a second record; acceptable at current volume, noted for the idempotency follow-on. |
| Bundle / experience deployment | **none** | ExperienceQubes already persist to their own canonical store with a registry publish path. Double-recording them as ArtifactRecords would duplicate a canonical home — the CS-001 defect class this rule exists to prevent. |
| Observer awareness | **code** (new gated route) | ComposerStudio's DCIR seam is in-session only; no existing mount fetch to fold into. Lightest honest seam: `GET /api/composer/artifact-production` (spine-gated, same projection as `/api/research/overview`'s `artifactProduction` block). Mounting it into the Studio UI is a follow-on — the UI fold would require ComposerStudio surgery this increment forbids. |

**`noBuildRequired: false`** — the seams exist but Studio's flows are unwired; alternative `none`
(leave Studio unadopted) rejected: it is the named largest infraction of the production rule.

## What was built (additive, surgical)

1. **`services/composer/studioArtifactTiering.ts`** — the pure classifier + record seam,
   mirroring `businessArtifactTiering`: `classifyStudioArtifact` (pure, total; 9 named production
   kinds; unknown → disposable fail-safe; return type makes constitutional structurally
   impossible), `buildStudioRecordBody` (whitelist-copy projection — T0 identifiers structurally
   inexpressible), `recordStudioArtifact` / `tierStudioArtifact` (best-effort, soft-fail, never
   throw; delegate `'operator'`, receiptId `null` — operational tier writes no receipts).
2. **`app/api/skills/image/generate/route.ts`** — tiering spread additively onto the response
   (`...tiering` after existing fields); records completed live sets only.
3. **`app/api/composer/article-draft/route.ts`** — input-aware tiering (real prompt/title →
   completed; else unprompted/failed → disposable); response shape `{ ok, articleDraft, provider }`
   preserved, tier fields additive.
4. **`app/api/skills/invoke/route.ts`** — submission-aware tiering; records only immediate
   completions; adds the honest disposable classification for submissions/simulations.
5. **`app/api/skills/video/stitch/route.ts`** — records the stitched durable video (operational
   `multimedia`), response fields unchanged + additive tier.
6. **`app/api/composer/artifact-production/route.ts`** — the observer seam: spine-gated GET
   returning `{ artifactProduction: { recentRecords (limit 8, T2 projection), publications } }` —
   the `/api/research/overview` projection, verbatim shape.
7. **`tests/studio-artifact-tiering.test.ts`** — canary mirroring
   `tests/business-artifact-tiering.test.ts`: pins the map, disposable-never-persisted kinds,
   unknown → disposable, nothing-born-constitutional, and body T0-inexpressibility via
   `findForbiddenObjectKey` (including hostile smuggled `personaId`/`authProfileId`/`rootDid`
   props at both top level and nested output refs).

## Constitutional Validation

- esbuild parse gates: **7/7** touched files (`--bundle --packages=external --alias:@=.`).
- Stub-bundle drill (vitest not executable in repo; manual esbuild+node): **20/20** —
  pure map (4 operational, 5 disposable, unknown/empty → disposable, nothing constitutional),
  body builder (forbidden-key scan null, smuggled T0 props dropped top-level AND nested,
  pointers survive), impure seam with a THROWING store stub (disposable kinds return without
  touching the store; operational + store down soft-fails to tier-only, never throws).
- No existing response field changed on any route — additions only (`consequenceClass`,
  `artifactRecordId?`).
- No receipt writes anywhere in this increment; no money/send/externalization path touched;
  no forbidden file touched.

## Constitutional Receipt

- The implementation receipts are the commits carrying this increment on the session branch
  (main session commits after verification) + this run record. In-app receipted twin: replay the
  goal through the DCC Capability Pipeline once deployed — the evidence rows above persist via
  `capability_evidence` and the pack generation writes `implementation_pack_generated`.
- **D1 operating-history cycle**: propose the deployment from the Capability Pipeline tab with
  this goal + the commit range once deployed.

## Honest limits

- **Polled video completion is not recorded.** A Sora/Venice generation that completes via the
  client poll loop leaves no ArtifactRecord (only immediate completions and stitches do). Fixing
  this honestly needs an idempotent record seam (e.g. unique on `content_hash` or
  `artifact_id` upsert) before the status route can record at first completion.
- **Stitch re-runs can duplicate records.** Storage is idempotent (deterministic `stitchId`);
  the record insert is not. Same idempotency follow-on.
- **The observer seam is not yet mounted in the Studio UI.** `GET /api/composer/artifact-production`
  exists and is gated; folding it into ComposerStudio's `copilotGroundContext` requires touching
  the 13k-line component, deferred by design. Until then Studio can observe via the route but the
  copilot does not yet narrate it.
- **Skill routes are unauthenticated surfaces** (pre-existing); records they write carry no
  persona linkage by construction (delegate `'operator'`, whitelist body). The tiering does not
  change their auth posture.
- Bundle/experience deployment deliberately records nothing — its canonical store already exists
  (decision table above).
