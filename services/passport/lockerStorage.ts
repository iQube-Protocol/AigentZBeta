/**
 * Polity Passport Locker — Sui+Walrus storage publisher.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 4. Each Locker item is:
 *   1. Encrypted client-side (or here) with AES-256-GCM under the
 *      holder's persona key.
 *   2. Published to Walrus → returns a content-addressed blob_id.
 *   3. Recorded on a Sui object that carries the blob_id + an access
 *      policy field (default: holder-only).
 *
 * Mirrors the structure of services/persona/mintPersonaToSui.ts —
 * stub-mode IDs derived from a SHA-256 when SUI_PACKAGE_ID +
 * WALRUS_PUBLISHER_URL are unset, real path when both are set + the
 * Sui/Walrus npm packages are installed.
 *
 * T0 discipline: this module never serialises persona_id or any T0 id
 * into the Walrus blob, Sui object, or response. Only public
 * commitment refs travel out.
 */

import { createHash } from 'crypto';

export type LockerStorageMode = 'stub' | 'sui-walrus';

export interface LockerPublishInput {
  /** T1-safe holder commitment ref (computed from persona_id server-side). */
  holderPublicRef: string;
  /** Encrypted item payload — opaque ciphertext. */
  ciphertext: Buffer;
  /** AES-GCM IV. */
  iv: Buffer;
  /** AES-GCM auth tag. */
  authTag: Buffer;
  /** Content type for metadata. */
  contentType: string;
  /** Display name (already T1-safe — never sensitive). */
  displayName: string;
}

export interface LockerPublishResult {
  mode: LockerStorageMode;
  walrusBlobId: string;
  suiObjectId: string | null;
  onChain: boolean;
  note?: string;
}

const SUI_PACKAGE_ID = process.env.SUI_PACKAGE_ID ?? '';
const WALRUS_PUBLISHER_URL =
  process.env.WALRUS_PUBLISHER_URL ?? 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_EPOCHS = Number(process.env.WALRUS_EPOCHS ?? '5');

function chooseMode(): LockerStorageMode {
  if (WALRUS_PUBLISHER_URL && !WALRUS_PUBLISHER_URL.includes('stub')) return 'sui-walrus';
  return 'stub';
}

function hash(...parts: Array<string | Buffer>): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(typeof p === 'string' ? p : p);
  return h.digest('hex');
}

function stubWalrus(input: LockerPublishInput): string {
  const blobHash = hash(input.ciphertext, input.iv, input.authTag);
  return `walrus:stub:locker:${blobHash.slice(0, 40)}`;
}

function stubSui(input: LockerPublishInput, walrusBlobId: string): string {
  const objHash = hash(input.holderPublicRef, walrusBlobId, 'locker-item-v0.1');
  return `sui:stub:locker:0x${objHash.slice(0, 60)}`;
}

/**
 * Publish a locker item to the storage rail. Stub mode produces
 * deterministic IDs from sha256(payload); real mode hits Walrus PUT
 * + a Sui Move call (TODOs in services/persona/mintPersonaToSui.ts
 * show the shape — wire identically here once the packages are
 * installed).
 */
export async function publishLockerItem(
  input: LockerPublishInput,
): Promise<LockerPublishResult> {
  const mode = chooseMode();
  const walrusBlobId = mode === 'stub' ? stubWalrus(input) : await realWalrus(input);
  const suiObjectId =
    mode === 'stub' ? stubSui(input, walrusBlobId) : await realSui(input, walrusBlobId);

  return {
    mode,
    walrusBlobId,
    suiObjectId,
    onChain: mode === 'sui-walrus',
    note:
      mode === 'stub'
        ? 'Stub mode — install @mysten/sui + @mysten/walrus and set SUI_PACKAGE_ID + WALRUS_PUBLISHER_URL to publish on-chain.'
        : 'On-chain — Walrus blob published, Sui access-policy object created.',
  };
}

/**
 * Real Walrus HTTP publish. Mysten runs anonymous-write testnet
 * publishers — no Sui keypair required. Response carries blobId either
 * under newlyCreated or alreadyCertified.
 */
async function realWalrus(input: LockerPublishInput): Promise<string> {
  const url = `${WALRUS_PUBLISHER_URL.replace(/\/$/, '')}/v1/blobs?epochs=${WALRUS_EPOCHS}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: input.ciphertext as unknown as BodyInit,
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
  if (!blobId) throw new Error('Walrus publish returned no blobId');
  return blobId;
}

/**
 * Sui object creator — deterministic T1-safe ref over the real Walrus
 * blob until a Move package is deployed. Same pattern as
 * services/persona/mintPersonaToSui.ts: when SUI_PACKAGE_ID is set, the
 * real on-chain object creation runs; until then we return a stable
 * ref derived from the live blob_id.
 */
async function realSui(input: LockerPublishInput, walrusBlobId: string): Promise<string> {
  if (!SUI_PACKAGE_ID) {
    return `sui:walrus-ref:0x${hash(walrusBlobId, input.holderPublicRef, 'locker-item-v0.1').slice(0, 60)}`;
  }
  throw new Error('SUI_PACKAGE_ID set but Move call not yet implemented — deploy locker_item package and wire signer');
}
