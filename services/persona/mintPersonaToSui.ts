/**
 * Persona → Sui + Walrus mint pipeline.
 *
 * Per the 2026-06-13 hackathon-submission plan, the Polity Passport persona
 * stack mints through a dual-rail of Sui (object/ownership/policy) + Walrus
 * (encrypted blob storage). AutoDrive remains the canonical rail for
 * non-passport content (KNYT, Qripto, etc.) and is NOT touched by this
 * service.
 *
 * Architecture:
 *   1. The persona descriptor is encrypted client-side or here, then
 *      published to Walrus as an encrypted blob — Walrus returns a
 *      content-addressed blob_id.
 *   2. A Sui object is created representing the PersonaQube — it carries
 *      the Walrus blob_id, the persona's public commitment refs, and an
 *      access-policy field (default: holder-only).
 *   3. The (suiObjectId, walrusBlobId) pair is anchored to a DVN receipt
 *      via the existing activityReceiptDvnPipeline.
 *
 * Stub-mode publishers:
 *   When SUI_PACKAGE_ID / WALRUS_PUBLISHER_URL are not set in env, this
 *   module emits deterministic fake IDs derived from a SHA-256 of the
 *   persona descriptor + a salt. This lets the mint flow complete
 *   end-to-end on dev/preview without external dependencies, while the
 *   shape of the response matches the real path. When the env vars are
 *   set AND the Sui/Walrus npm packages are installed, the real
 *   publishers (TODO: see realSuiPublisher / realWalrusPublisher below)
 *   fire instead.
 *
 * T0 discipline: this module NEVER serialises persona_id, kybe_id, or
 * root_did into the blob, the Sui object, or the response. Only public
 * commitment refs travel out.
 */

import { createHash } from 'crypto';

export type PersonaMintMode = 'stub' | 'sui-walrus';

export interface PersonaMintInput {
  /** Caller's persona — T0 ID. Used server-side only for the receipt; never serialised. */
  personaId: string;
  /** Public commitment refs that are T1-safe to publish. */
  personaPublicRef: string;
  kybeDidPublicRef?: string | null;
  /** Display label the holder chose. Optional, T1-safe. */
  displayLabel?: string;
  /** Encrypted blakQube blob (already encrypted under holder key). */
  encryptedBlakQube: Buffer;
  /** AES-GCM IV used for the encryption. */
  encryptionIv: Buffer;
  /** AES-GCM auth tag. */
  encryptionAuthTag: Buffer;
}

export interface PersonaMintResult {
  mode: PersonaMintMode;
  suiObjectId: string;
  walrusBlobId: string;
  receiptId: string | null;
  mintedAt: string;
  /** True if the result reflects real on-chain writes. */
  onChain: boolean;
  /** Diagnostic note — explains why stub vs real. */
  note?: string;
}

const SUI_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL ?? '';
const SUI_PACKAGE_ID = process.env.SUI_PACKAGE_ID ?? '';
const SUI_NETWORK = process.env.SUI_NETWORK ?? 'testnet';

function chooseMode(): PersonaMintMode {
  if (SUI_PACKAGE_ID && SUI_PUBLISHER_URL) return 'sui-walrus';
  return 'stub';
}

function hash(...parts: Array<string | Buffer>): string {
  const h = createHash('sha256');
  for (const p of parts) {
    h.update(typeof p === 'string' ? p : p);
  }
  return h.digest('hex');
}

/**
 * Stub Walrus publisher — generates a deterministic fake blob_id from the
 * encrypted payload, so the flow completes without external calls.
 */
function stubWalrusPublish(input: PersonaMintInput): string {
  const blobHash = hash(input.encryptedBlakQube, input.encryptionIv, input.encryptionAuthTag);
  return `walrus:stub:${blobHash.slice(0, 40)}`;
}

/**
 * Stub Sui object creator — generates a deterministic fake object_id from
 * the persona public ref + walrus blob id.
 */
function stubSuiCreate(input: PersonaMintInput, walrusBlobId: string): string {
  const objHash = hash(input.personaPublicRef, walrusBlobId, 'persona-qube-v0.1');
  return `sui:stub:0x${objHash.slice(0, 60)}`;
}

/**
 * Real Walrus publisher — TODO when @mysten/walrus is installed and
 * WALRUS_PUBLISHER_URL is reachable. The shape of the call:
 *
 *   const res = await fetch(`${SUI_PUBLISHER_URL}/v1/store`, {
 *     method: 'PUT',
 *     body: input.encryptedBlakQube,
 *   });
 *   const json = await res.json();
 *   return json.newlyCreated.blobObject.blobId;
 */
async function realWalrusPublish(_input: PersonaMintInput): Promise<string> {
  throw new Error('real Walrus publisher not yet wired — install @mysten/walrus and configure WALRUS_PUBLISHER_URL');
}

/**
 * Real Sui object creator — TODO when @mysten/sui is installed and
 * SUI_PACKAGE_ID points at the deployed persona-qube Move module. The
 * shape of the call:
 *
 *   const tx = new TransactionBlock();
 *   tx.moveCall({
 *     target: `${SUI_PACKAGE_ID}::persona_qube::mint`,
 *     arguments: [tx.pure(personaPublicRef), tx.pure(walrusBlobId), ...],
 *   });
 *   const result = await client.signAndExecuteTransactionBlock({ transactionBlock: tx, ... });
 *   return result.objectChanges[0].objectId;
 */
async function realSuiCreate(_input: PersonaMintInput, _walrusBlobId: string): Promise<string> {
  throw new Error('real Sui publisher not yet wired — install @mysten/sui and configure SUI_PACKAGE_ID');
}

/**
 * Main entry — mints a PersonaQube to Sui+Walrus (real or stub) and returns
 * the IDs + receipt anchor reference.
 */
export async function mintPersonaToSui(input: PersonaMintInput): Promise<PersonaMintResult> {
  const mode = chooseMode();
  const mintedAt = new Date().toISOString();

  let walrusBlobId: string;
  let suiObjectId: string;

  if (mode === 'sui-walrus') {
    walrusBlobId = await realWalrusPublish(input);
    suiObjectId = await realSuiCreate(input, walrusBlobId);
  } else {
    walrusBlobId = stubWalrusPublish(input);
    suiObjectId = stubSuiCreate(input, walrusBlobId);
  }

  // DVN receipt anchoring is a follow-on step performed by the route caller
  // (the route writes a row into persona_qube_mints, then enqueues a DVN
  // receipt via activityReceiptDvnPipeline). We return receiptId=null here;
  // the caller fills it in after the receipt enqueue lands.
  return {
    mode,
    suiObjectId,
    walrusBlobId,
    receiptId: null,
    mintedAt,
    onChain: mode === 'sui-walrus',
    note:
      mode === 'stub'
        ? 'Stub mode — deterministic IDs derived from encrypted payload + commitment refs. Set SUI_PACKAGE_ID + WALRUS_PUBLISHER_URL and install @mysten/sui + @mysten/walrus to enable on-chain mint.'
        : 'On-chain mint complete — Sui object created, Walrus blob published.',
  };
}

export const _stubInternals = {
  chooseMode,
  hash,
  stubSuiCreate,
  stubWalrusPublish,
};
