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
const WALRUS_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL ?? '';

function chooseMode(): LockerStorageMode {
  if (SUI_PACKAGE_ID && WALRUS_PUBLISHER_URL) return 'sui-walrus';
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

async function realWalrus(_input: LockerPublishInput): Promise<string> {
  throw new Error(
    'real Walrus publisher not yet wired — install @mysten/walrus and configure WALRUS_PUBLISHER_URL',
  );
}

async function realSui(_input: LockerPublishInput, _walrusBlobId: string): Promise<string> {
  throw new Error(
    'real Sui publisher not yet wired — install @mysten/sui and configure SUI_PACKAGE_ID',
  );
}
