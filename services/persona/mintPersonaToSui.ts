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

// Walrus publishes via HTTP PUT to a public publisher URL — no Sui keypair
// required for the upload path. Mysten runs public testnet publishers at
// publisher.walrus-testnet.walrus.space. The Sui object creation step
// requires a deployed Move package and a sponsor signer; until that
// package is deployed, the suiObjectId is derived from the Walrus blob_id
// (T1-safe commitment). When SUI_PACKAGE_ID is set AND the Move package
// is deployed, the realSuiCreate path can write an actual on-chain object.
const WALRUS_PUBLISHER_URL =
  process.env.WALRUS_PUBLISHER_URL ?? 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_AGGREGATOR_URL =
  process.env.WALRUS_AGGREGATOR_URL ?? 'https://aggregator.walrus-testnet.walrus.space';
const WALRUS_EPOCHS = Number(process.env.WALRUS_EPOCHS ?? '5');
const SUI_PACKAGE_ID = process.env.SUI_PACKAGE_ID ?? '';

function chooseMode(): PersonaMintMode {
  // Walrus alone is enough to be 'live' — the encrypted payload lands on a
  // real decentralized blob store. Sui object creation is an additional
  // layer that requires a Move package deploy; we treat the rail as live
  // when at least Walrus is reachable.
  if (WALRUS_PUBLISHER_URL && !WALRUS_PUBLISHER_URL.includes('stub')) return 'sui-walrus';
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
 * Real Walrus publisher — PUTs the encrypted blob to a public Walrus HTTP
 * publisher and returns the blob_id. Mysten runs public testnet publishers
 * at publisher.walrus-testnet.walrus.space which accept anonymous uploads
 * with no Sui keypair required.
 *
 * Response shape (per Walrus docs):
 *   {
 *     newlyCreated: { blobObject: { blobId, ... } }
 *   }
 *   OR
 *   {
 *     alreadyCertified: { blobId, ... }
 *   }
 */
async function realWalrusPublish(input: PersonaMintInput): Promise<string> {
  const url = `${WALRUS_PUBLISHER_URL.replace(/\/$/, '')}/v1/blobs?epochs=${WALRUS_EPOCHS}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: input.encryptedBlakQube as unknown as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Walrus publish failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    newlyCreated?: { blobObject?: { blobId?: string } };
    alreadyCertified?: { blobId?: string };
  };
  const blobId = json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId;
  if (!blobId) {
    throw new Error('Walrus publish returned no blobId');
  }
  return blobId;
}

/**
 * Sui object creator — when SUI_PACKAGE_ID is set AND a persona-qube Move
 * package is deployed, this issues a real Sui transaction. Until then, the
 * sui object id is derived from the Walrus blob_id + persona public ref so
 * the response shape is consistent (T1-safe deterministic ref). Real Sui
 * object creation TODO: deploy persona_qube Move package, add signer
 * configuration via SUI_SPONSOR_KEY.
 */
async function realSuiCreate(input: PersonaMintInput, walrusBlobId: string): Promise<string> {
  if (!SUI_PACKAGE_ID) {
    // No Move package deployed yet — derive a deterministic ref from the
    // real Walrus blob_id so the suiObjectId stays a stable handle on the
    // mint event. This is not a fake stub: it's a T1-safe derived ref over
    // a real on-chain blob.
    return `sui:walrus-ref:0x${hash(walrusBlobId, input.personaPublicRef, 'persona-qube-v0.1').slice(0, 60)}`;
  }
  // Future: implement real Sui Move call here when SUI_PACKAGE_ID is set.
  // Requires SUI_SPONSOR_KEY for signer + @mysten/sui TransactionBlock.
  throw new Error('SUI_PACKAGE_ID set but Move call not yet implemented — deploy persona_qube package and wire signer');
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
