/**
 * Self-Custody blakQube Passport Vault — client-side encryption module.
 *
 * PRD Addendum A (Self-Custody Vault): private citizen passport data MUST be
 * encrypted CLIENT-SIDE before upload and stored ONLY on Auto Drive. The
 * Bureau, Registry, Supabase, and sysadmins NEVER receive plaintext. This
 * module is the canonical encrypt/decrypt surface for that contract.
 *
 * NOTE — deliberately NOT built on services/content/encryption.ts: that file
 * is server-side envelope encryption (system-custody keys) and a protected
 * spine file. The vault is the opposite custody model: holder-derived key,
 * client-side WebCrypto, the server only ever relays ciphertext.
 *
 * Client-safe: uses ONLY globalThis.crypto (WebCrypto) — no Node imports.
 * Works in the browser and in Node 18+ (tests).
 *
 * Envelope binary layout (versioned):
 *   bytes 0–8   magic  "PPBVAULT1" (ASCII)
 *   byte  9     version (0x01)
 *   bytes 10–25 PBKDF2 salt (16 bytes)
 *   bytes 26–37 AES-GCM IV (12 bytes)
 *   bytes 38–   ciphertext (includes GCM auth tag)
 *
 * The magic header lets the server-side relay route verify it is receiving a
 * vault envelope (ciphertext) and refuse anything that could be plaintext.
 */

export const VAULT_MAGIC = 'PPBVAULT1';
export const VAULT_VERSION = 0x01;
export const VAULT_ALGORITHM = 'AES-256-GCM' as const;
/** OWASP 2023+ recommendation for PBKDF2-HMAC-SHA256. */
export const VAULT_PBKDF2_ITERATIONS = 310_000;

const MAGIC_BYTES = new TextEncoder().encode(VAULT_MAGIC);
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const HEADER_LENGTH = MAGIC_BYTES.length + 1 + SALT_LENGTH + IV_LENGTH;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('WebCrypto unavailable in this environment');
  return c.subtle;
}

async function deriveVaultKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: VAULT_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface VaultEncryptResult {
  /** The full envelope (magic + version + salt + iv + ciphertext). */
  envelope: Uint8Array;
  /** SHA-256 hex of the envelope bytes — hash of CIPHERTEXT, never plaintext. */
  contentHash: string;
}

/**
 * Encrypt a private payload with a holder passphrase. The payload is
 * serialized as JSON, encrypted with AES-256-GCM under a PBKDF2-derived key,
 * and wrapped in the versioned vault envelope.
 */
export async function encryptVaultPayload(
  payload: unknown,
  passphrase: string,
): Promise<VaultEncryptResult> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Vault passphrase must be at least 8 characters');
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveVaultKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource),
  );

  const envelope = new Uint8Array(HEADER_LENGTH + ciphertext.length);
  envelope.set(MAGIC_BYTES, 0);
  envelope[MAGIC_BYTES.length] = VAULT_VERSION;
  envelope.set(salt, MAGIC_BYTES.length + 1);
  envelope.set(iv, MAGIC_BYTES.length + 1 + SALT_LENGTH);
  envelope.set(ciphertext, HEADER_LENGTH);

  const contentHash = await sha256Hex(envelope);
  return { envelope, contentHash };
}

/** Decrypt a vault envelope with the holder passphrase. */
export async function decryptVaultPayload(
  envelope: Uint8Array,
  passphrase: string,
): Promise<unknown> {
  if (!isVaultEnvelope(envelope)) throw new Error('Not a vault envelope');
  const version = envelope[MAGIC_BYTES.length];
  if (version !== VAULT_VERSION) throw new Error(`Unsupported vault version ${version}`);

  const salt = envelope.slice(MAGIC_BYTES.length + 1, MAGIC_BYTES.length + 1 + SALT_LENGTH);
  const iv = envelope.slice(MAGIC_BYTES.length + 1 + SALT_LENGTH, HEADER_LENGTH);
  const ciphertext = envelope.slice(HEADER_LENGTH);

  const key = await deriveVaultKey(passphrase, salt);
  const plaintext = await subtle().decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/**
 * Structural check used by the server-side relay: the upload route accepts
 * ONLY bytes that carry the vault magic header. Plaintext JSON, form data,
 * or any other shape is refused — the Bureau never receives plaintext.
 */
export function isVaultEnvelope(bytes: Uint8Array): boolean {
  if (bytes.length < HEADER_LENGTH + 16) return false; // 16 = min GCM tag
  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (bytes[i] !== MAGIC_BYTES[i]) return false;
  }
  return true;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await subtle().digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build the schema-conformant selfCustodyBlakQubeRef
 * (polity-passport.common.schema.json#/$defs/selfCustodyBlakQubeRef) for a
 * completed vault upload. All custody/access consts are pinned — they are
 * the constitutional claims of Addendum A and not configurable.
 */
export function buildSelfCustodyRef(input: {
  contentId: string;
  contentHash: string;
  disclosureFlags?: Record<string, boolean>;
}) {
  return {
    storage_model: 'self_custody_encrypted_file' as const,
    storage_provider: 'autodrive' as const,
    encrypted_payload_ref: {
      content_id: input.contentId,
      content_hash: input.contentHash,
      created_at: new Date().toISOString(),
    },
    encryption_profile: {
      encryption_location: 'client_side_before_upload' as const,
      algorithm: VAULT_ALGORITHM,
      key_custody: 'holder_controlled' as const,
      key_derivation_profile: `pbkdf2-sha256-${VAULT_PBKDF2_ITERATIONS}`,
      key_recovery_enabled: false,
      key_recovery_method: 'none' as const,
    },
    holder_key_control: {
      holder_controls_decryption_key: true as const,
      bureau_controls_decryption_key: false as const,
      sysadmin_controls_decryption_key: false as const,
      third_party_key_custodian: null,
    },
    system_plaintext_access: {
      passport_bureau_access: false as const,
      registry_access: false as const,
      supabase_access: false as const,
      sysadmin_access: false as const,
    },
    ...(input.disclosureFlags ? { disclosure_flags: input.disclosureFlags } : {}),
  };
}
