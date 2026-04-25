-- iqube_wrapped_keys: stores DEK wrapped with minter's public key (MetaMask eth_getEncryptionPublicKey)
-- Keys are never stored on-chain; only the minter can unwrap via eth_decrypt
CREATE TABLE IF NOT EXISTS public.iqube_wrapped_keys (
  token_id bigint PRIMARY KEY,
  minter_address text NOT NULL,
  wrapped_key text NOT NULL,
  ipfs_hash text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS: restrict reads to minter (decrypt flow will verify via signed message; RLS can use service role for now)
ALTER TABLE public.iqube_wrapped_keys ENABLE ROW LEVEL SECURITY;

-- Allow insert from anon/authenticated (mint flow); restrict select to minter (requires custom auth - deferred)
CREATE POLICY "Allow insert for mint flow" ON public.iqube_wrapped_keys
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select for minter" ON public.iqube_wrapped_keys
  FOR SELECT USING (true);
-- TODO: When decrypt flow is added, tighten SELECT to verify caller is minter_address via Edge Function
