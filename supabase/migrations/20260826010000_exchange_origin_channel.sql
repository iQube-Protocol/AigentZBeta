-- Reciprocal Artifact Exchange — evidence origin channel (Surface
-- Independence of Constitutional Acts, 2026-08-26).
--
-- Additive-only migration: neither column changes what counts as valid
-- evidence for public.exchange_artifacts / public.exchange_attestations —
-- both are still written by the exact same canonical functions
-- (services/research/reciprocalExchange.ts's depositArtifact / declareFreeze
-- / signInstrument) regardless of which surface called them. This column
-- only labels HOW a row was originated, honestly, so an MCP-originated
-- attestation is never mistaken for (or misrepresented as) a native
-- browser-surface act. Defaults to 'native-ui' so every existing row, and
-- every write from the existing native UI, is unaffected.
--
-- Idempotent, matching this migration set's own convention.

ALTER TABLE public.exchange_artifacts
  ADD COLUMN IF NOT EXISTS origin_channel text NOT NULL DEFAULT 'native-ui'
    CHECK (origin_channel IN ('native-ui', 'mcp'));

ALTER TABLE public.exchange_attestations
  ADD COLUMN IF NOT EXISTS origin_channel text NOT NULL DEFAULT 'native-ui'
    CHECK (origin_channel IN ('native-ui', 'mcp'));
