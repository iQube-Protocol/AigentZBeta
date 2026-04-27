-- Move iQube key storage away from MetaMask-specific wrapped keys.
-- New rows store the AES DEK encrypted by a server-managed master key.

ALTER TABLE public.iqube_wrapped_keys
  ALTER COLUMN wrapped_key DROP NOT NULL;

ALTER TABLE public.iqube_wrapped_keys
  ADD COLUMN IF NOT EXISTS encrypted_key text,
  ADD COLUMN IF NOT EXISTS key_encryption_iv text,
  ADD COLUMN IF NOT EXISTS key_encryption_scheme text NOT NULL DEFAULT 'metamask_x25519';

COMMENT ON COLUMN public.iqube_wrapped_keys.wrapped_key IS
  'Legacy MetaMask x25519 wrapped DEK. Retained only for one-time migration.';

COMMENT ON COLUMN public.iqube_wrapped_keys.encrypted_key IS
  'AES-GCM encrypted DEK protected by the server-side IQUBE_DEK_MASTER_KEY_HEX secret.';

COMMENT ON COLUMN public.iqube_wrapped_keys.key_encryption_iv IS
  'Base64-encoded IV used when encrypting encrypted_key.';

COMMENT ON COLUMN public.iqube_wrapped_keys.key_encryption_scheme IS
  'metamask_x25519 for legacy rows, server_aes_gcm_v1 for the signature-based decrypt flow.';
