# Commit Brief: `2af7d43` — Venture iQube Phase A1: ingest route + use_kind enum extension + Operation metaWill fixture

| Field | Value |
|-------|-------|
| SHA | [`2af7d43`](https://github.com/iQube-Protocol/AigentZBeta/commit/2af7d4366159b3ae93e1cbed542493c154dc42a6) |
| Author | Claude |
| Date | 2026-05-30T01:10:21Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Venture iQube Phase A1: ingest route + use_kind enum extension + Operation metaWill fixture

Wires the Phase A1 path the v0.1/v0.2 schema docs promised:

1. services/uploads/personaUploadService.ts — UploadUseKind union
   gains 'venture_iqube' so persona_uploads rows tagged this kind flow
   through the existing upload pipeline (storage, list, retrieval).

2. supabase/migrations/20260529000000_persona_uploads_venture_iqube.sql
   — extends the persona_uploads_use_kind_check constraint to include
   'venture_iqube'. Idempotent (drops+re-adds). OPERATOR ACTION: run
   this migration in Supabase before the route accepts uploads.

3. components/metame/uploads/UploadDrawer.tsx — adds the
   "Ingest as Venture iQube" picker option so the operator can choose
   it at upload time. Description names the schema versions and what
   aigentMe will do with the file post-ingest.

4. app/api/persona/venture-iqube/ingest/route.ts — POST endpoint that
   accepts either { uploadId } (resolves from persona_uploads) or
   { payload } (inline JSON). Validates schema-version + high-level
   shape (operator, strategy, ventures[], plan horizons), translates
   sub-surface bindings (studio → metame, iqube-registry → agentiq-os,
   moneypenny → metame, legal-metacommons → metame) for the
   ExperienceQube hydrate target, computes the IntentQube queue from
   ventures[].objectives[], and returns a structured preview.
   Spine-scoped: getActivePersona(req) gates the route; the resolved
   personaId is what the Phase A2 hydration will key on.
   Phase A2 (next session) will add: upsertExperienceQubeMeta,
   IntentQube row creation, DVN 'venture_iqube_ingested' receipt, and
   persona_uploads.metadata write-back of the ingest result.

5. codexes/packs/agentiq/items/venture-iqube/
   operation-metawill-v0.2.json — operator-emitted Operation metaWill
   Venture iQube file, preserved as a known-good fixture for the
   ingest route to test against locally and as historical record of
   the first real Venture iQube populated.
```

## Body

Wires the Phase A1 path the v0.1/v0.2 schema docs promised:

1. services/uploads/personaUploadService.ts — UploadUseKind union
   gains 'venture_iqube' so persona_uploads rows tagged this kind flow
   through the existing upload pipeline (storage, list, retrieval).

2. supabase/migrations/20260529000000_persona_uploads_venture_iqube.sql
   — extends the persona_uploads_use_kind_check constraint to include
   'venture_iqube'. Idempotent (drops+re-adds). OPERATOR ACTION: run
   this migration in Supabase before the route accepts uploads.

3. components/metame/uploads/UploadDrawer.tsx — adds the
   "Ingest as Venture iQube" picker option so the operator can choose
   it at upload time. Description names the schema versions and what
   aigentMe will do with the file post-ingest.

4. app/api/persona/venture-iqube/ingest/route.ts — POST endpoint that
   accepts either { uploadId } (resolves from persona_uploads) or
   { payload } (inline JSON). Validates schema-version + high-level
   shape (operator, strategy, ventures[], plan horizons), translates
   sub-surface bindings (studio → metame, iqube-registry → agentiq-os,
   moneypenny → metame, legal-metacommons → metame) for the
   ExperienceQube hydrate target, computes the IntentQube queue from
   ventures[].objectives[], and returns a structured preview.
   Spine-scoped: getActivePersona(req) gates the route; the resolved
   personaId is what the Phase A2 hydration will key on.
   Phase A2 (next session) will add: upsertExperienceQubeMeta,
   IntentQube row creation, DVN 'venture_iqube_ingested' receipt, and
   persona_uploads.metadata write-back of the ingest result.

5. codexes/packs/agentiq/items/venture-iqube/
   operation-metawill-v0.2.json — operator-emitted Operation metaWill
   Venture iQube file, preserved as a known-good fixture for the
   ingest route to test against locally and as historical record of
   the first real Venture iQube populated.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/persona/venture-iqube/ingest/route.ts` |
| Added | `codexes/packs/agentiq/items/venture-iqube/operation-metawill-v0.2.json` |
| Modified | `components/metame/uploads/UploadDrawer.tsx` |
| Modified | `services/uploads/personaUploadService.ts` |
| Added | `supabase/migrations/20260529000000_persona_uploads_venture_iqube.sql` |

## Stats

 5 files changed, 521 insertions(+), 1 deletion(-)
