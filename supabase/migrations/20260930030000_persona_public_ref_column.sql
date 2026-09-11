-- PERSONA-PUBLIC-REF-001 (operator-ratified 2026-08-24)
--
-- personas.id is a T0, server-internal identifier and must never be the
-- normal user-supplied/external persona identifier. The Polity Public
-- Reference already exists conceptually (services/identity/personaReferences.ts
-- personaPublicRef(), mirrored verbatim by hashPersonaRef() in
-- services/dvn/activityReceiptDvnPipeline.ts and already the ONLY persona
-- identifier written into every DVN receipt to date) — this migration
-- persists that SAME derivation as a real column, rather than inventing a
-- fourth identity layer.
--
-- GENERATED ALWAYS AS ... STORED is deliberate: the column can never drift
-- from personaPublicRef(id) because Postgres recomputes it from `id` on
-- every insert/update, for every existing AND future row, with no backfill
-- script and no risk of the app-layer JS and the DB column disagreeing.
--
-- 16 hex chars = 64 bits of a one-way sha256 digest — collision-safe at any
-- realistic persona population; a UNIQUE index would refuse it anyway.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS public_ref TEXT
  GENERATED ALWAYS AS (substr(encode(digest(id::text, 'sha256'), 'hex'), 1, 16)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_personas_public_ref_unique ON personas(public_ref);

COMMENT ON COLUMN personas.public_ref IS
  'Polity Public Reference (Level 2 of the three-level persona identity model, CLAUDE.md). '
  'Durable, opaque, one-way-derived from id (sha256(id) first 16 hex chars) — the SAME '
  'value already used in every DVN receipt (hashPersonaRef) and by personaPublicRef(). '
  'This is the identifier user-facing forms, CLI tools, and external workflows should ask '
  'for. Resolving it back to personas.id requires the admin-gated '
  '/api/admin/persona/resolve-public-ref route — never a public API, and never a client-side '
  'reverse computation.';
