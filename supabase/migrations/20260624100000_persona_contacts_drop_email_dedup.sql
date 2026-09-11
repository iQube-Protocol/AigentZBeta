-- ============================================================================
-- Drop the partial unique email index on persona_contacts.
--
-- Root cause: idx_persona_contacts_email_dedup is a partial unique index
-- on (persona_id, lower(email)) WHERE email IS NOT NULL. When upserting
-- a vCard batch (onConflict: persona_id,source,source_id), PostgreSQL
-- still enforces ALL other unique constraints — so if any contact in the
-- batch shares an email with an already-imported Google contact, the
-- entire batch of 200 fails. Result: 2000 contacts skipped, 7 imported.
--
-- The source-level dedup constraint (persona_contacts_source_dedup_uniq,
-- added in 20260624000000) already handles idempotent re-imports correctly.
-- Cross-source email deduplication (Google ↔ vCard ↔ iCloud) should be
-- a merge/link operation at the application layer, not a DB constraint
-- that silently blocks bulk imports.
-- ============================================================================

DROP INDEX IF EXISTS idx_persona_contacts_email_dedup;
