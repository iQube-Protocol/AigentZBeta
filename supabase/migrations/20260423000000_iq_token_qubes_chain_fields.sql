-- Add on-chain anchor fields to iq_token_qubes
-- chain_token_id: the ERC721 tokenId returned by iQubeNFT.mintQube()
-- chain_id: EVM chain where the NFT was minted (e.g. 8453 = Base mainnet)
-- chain_tx_hash: transaction hash of the mint tx for block explorer links
-- chain_minter: wallet address that called mintQube() (msg.sender in the contract)

ALTER TABLE iq_token_qubes
  ADD COLUMN IF NOT EXISTS chain_token_id bigint,
  ADD COLUMN IF NOT EXISTS chain_id integer,
  ADD COLUMN IF NOT EXISTS chain_tx_hash text,
  ADD COLUMN IF NOT EXISTS chain_minter text;

COMMENT ON COLUMN iq_token_qubes.chain_token_id IS 'ERC721 tokenId from iQubeNFT contract; null until on-chain mint is executed';
COMMENT ON COLUMN iq_token_qubes.chain_id IS 'EVM chain ID (8453 = Base mainnet, 84532 = Base Sepolia)';
COMMENT ON COLUMN iq_token_qubes.chain_tx_hash IS 'Mint transaction hash';
COMMENT ON COLUMN iq_token_qubes.chain_minter IS 'Wallet address that called mintQube() — used for key escrow lookup';
