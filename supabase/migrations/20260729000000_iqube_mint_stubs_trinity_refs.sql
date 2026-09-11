-- ─────────────────────────────────────────────────────────────────────────────
-- Link iqube_mint_stubs to the canonical iQube trinity registry rows.
--
-- Staging a persona iQube previously wrote ONLY an iqube_mint_stubs row, so the
-- persona had no iq_meta_qubes / iq_blak_qubes / iq_token_qubes identity. That
-- left POST /api/core/mint-tokenqube with nothing to anchor: no metaIdentifier
-- pointing at a registry MetaQube, and no tokenQubeId for
-- updateTokenQubeChainAnchor() to write chain_token_id/chain_tx_hash back to.
--
-- These three refs make the stub the join between the persona row and the
-- trinity, and make re-staging idempotent (the same persona reuses its trinity
-- instead of minting a second identity for the same subject).
--
-- blakqube_auth_tag closes a real defect: the staging route encrypted with
-- AES-256-GCM but never persisted cipher.getAuthTag(), so every staged payload
-- was undecryptable — GCM cannot verify or decrypt without its tag.
--
-- ─── Why this is ONE statement ───────────────────────────────────────────────
-- The unique index cannot be created while duplicate (user_id, iqube_type) rows
-- exist, and every prior stage wrote a fresh row, so duplicates DO exist. An
-- earlier revision of this file put the de-duplication and the index in separate
-- statements; run piecemeal in the SQL editor that yields either
--   23505  could not create unique index … Key (…) is duplicated
-- (index without the dedupe) or
--   42703  column "meta_qube_id" does not exist
-- (dedupe ordering on a column the ALTER had not yet added).
-- Wrapping the whole migration in a single DO block makes partial execution
-- impossible: it is one statement, and it is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- 1. Trinity refs + the missing GCM auth tag.
  ALTER TABLE public."iqube_mint_stubs"
    ADD COLUMN IF NOT EXISTS meta_qube_id       uuid,
    ADD COLUMN IF NOT EXISTS blak_qube_id       uuid,
    ADD COLUMN IF NOT EXISTS token_qube_id      uuid,
    ADD COLUMN IF NOT EXISTS blakqube_auth_tag  bytea;

  -- 2. Collapse the stub history to one row per (user, iqube_type). Ranking
  --    keeps the row furthest along — an Auto Drive CID means its payload was
  --    actually stored — then the newest. Tolerates ties in created_at, which a
  --    pairwise self-join comparison does not.
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, iqube_type
             ORDER BY (autonomys_cid IS NOT NULL) DESC,
                      created_at DESC NULLS LAST,
                      id DESC
           ) AS rn
      FROM public."iqube_mint_stubs"
  )
  DELETE FROM public."iqube_mint_stubs" s
    USING ranked r
   WHERE s.id = r.id
     AND r.rn > 1;

  -- 3. One trinity per subject. This is what makes staging idempotent — the
  --    upsert in stagePersonaIQube() targets exactly this conflict.
  CREATE UNIQUE INDEX IF NOT EXISTS iqube_mint_stubs_user_type_uniq
    ON public."iqube_mint_stubs" (user_id, iqube_type);
END $$;

COMMENT ON COLUMN public."iqube_mint_stubs".meta_qube_id IS
  'iq_meta_qubes.id — the registry MetaQube for this persona; used as metaIdentifier when minting on-chain';
COMMENT ON COLUMN public."iqube_mint_stubs".blak_qube_id IS
  'iq_blak_qubes.id — encrypted payload pointer (Autonomys CID or Supabase fallback)';
COMMENT ON COLUMN public."iqube_mint_stubs".token_qube_id IS
  'iq_token_qubes.id — wrapped key row that receives the chain anchor after mintQube()';
COMMENT ON COLUMN public."iqube_mint_stubs".blakqube_auth_tag IS
  'AES-256-GCM auth tag for blakqube_ciphertext; without it the payload cannot be decrypted';
