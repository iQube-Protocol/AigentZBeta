-- Reciprocal Artifact Exchange — operator-provided plaintext fallback
-- (2026-09-12, PRD-IRL-AX-001 follow-on).
--
-- Automated content extraction (services/research/reciprocalExchange.ts's
-- extractArtifactText) can fail for a genuinely deposited, correctly
-- fingerprinted artifact — e.g. an Auto Drive download that succeeds from
-- one network but not another. This column lets an authorised operator
-- attach the artifact's OWN text, verified out of band, as a rendering
-- fallback WITHOUT touching the artifact's identity/fingerprint fields
-- (content_hash, source_reference, storage_reference stay untouched — this
-- is a read-convenience annotation, never a re-deposit or a fingerprint
-- override).
alter table exchange_artifacts
  add column if not exists operator_provided_text text;

comment on column exchange_artifacts.operator_provided_text is
  'Operator-supplied plaintext fallback used when automated extraction cannot reach the underlying bytes. Never authoritative for fingerprinting — content_hash remains the source of truth for artifact identity.';
