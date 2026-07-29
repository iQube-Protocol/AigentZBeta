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
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public."iqube_mint_stubs"
  ADD COLUMN IF NOT EXISTS meta_qube_id       uuid,
  ADD COLUMN IF NOT EXISTS blak_qube_id       uuid,
  ADD COLUMN IF NOT EXISTS token_qube_id      uuid,
  ADD COLUMN IF NOT EXISTS blakqube_auth_tag  bytea;

COMMENT ON COLUMN public."iqube_mint_stubs".meta_qube_id IS
  'iq_meta_qubes.id — the registry MetaQube for this persona; used as metaIdentifier when minting on-chain';
COMMENT ON COLUMN public."iqube_mint_stubs".blak_qube_id IS
  'iq_blak_qubes.id — encrypted payload pointer (Autonomys CID or Supabase fallback)';
COMMENT ON COLUMN public."iqube_mint_stubs".token_qube_id IS
  'iq_token_qubes.id — wrapped key row that receives the chain anchor after mintQube()';
COMMENT ON COLUMN public."iqube_mint_stubs".blakqube_auth_tag IS
  'AES-256-GCM auth tag for blakqube_ciphertext; without it the payload cannot be decrypted';

-- One trinity per (user, iqube_type). Re-staging updates the existing stub
-- rather than creating a second persona identity for the same subject.
--
-- Every prior stage wrote a fresh row, so the history must be collapsed to one
-- row per (user, iqube_type) before the unique index can be created. Ranking
-- keeps the row furthest along (an Auto Drive CID means its payload was
-- actually stored), then the newest — and it tolerates ties in created_at,
-- which a pairwise self-join comparison does not.
--
-- Deliberately references only pre-existing columns, so this block is correct
-- whether the file runs as one migration or statement-by-statement in the SQL
-- editor. The trinity columns are all NULL on first run regardless.
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

CREATE UNIQUE INDEX IF NOT EXISTS iqube_mint_stubs_user_type_uniq
  ON public."iqube_mint_stubs" (user_id, iqube_type);
