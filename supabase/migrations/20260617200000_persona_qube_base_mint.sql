-- 20260617200000 — PersonaQube Base mainnet mint fallback
--
-- When the Sui/Walrus rail isn't live, the PersonaQube is minted as an ERC-721
-- on Base mainnet against the iQube NFT contract (IQUBE_NFT_CONTRACT_ADDRESS) —
-- iQube is the first-class primitive; persona is a derivative tokenQube. The
-- on-chain token id is a one-way commitment over the persona id (T2-safe),
-- mirroring the locker-UUID protocol — the raw persona id never goes on-chain.

BEGIN;

ALTER TABLE public.persona_qube_mints
  ADD COLUMN IF NOT EXISTS base_token_id text,
  ADD COLUMN IF NOT EXISTS base_tx_hash  text;

COMMENT ON COLUMN public.persona_qube_mints.base_token_id IS
  'Hex uint256 ERC-721 token id on Base (one-way commitment over persona id; T2-safe). NULL when not minted on Base.';

COMMIT;
