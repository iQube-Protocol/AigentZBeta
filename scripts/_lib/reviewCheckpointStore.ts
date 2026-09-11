/**
 * File-backed checkpoint store for `scripts/run-independence-review.ts`.
 *
 * All actual filesystem IO for the IRL-REVIEW-001 checkpoint/resume system
 * lives HERE, outside `services/research/review/` — that directory imports
 * no database client and (per its own "no Date.now/Math.random/new Date"
 * canary) performs no IO of any kind. This file is the CLI-side adapter: it
 * turns the pure types and verification logic in
 * `services/research/review/checkpoint.ts` into real files on disk.
 *
 * Run directory layout (per the operator's ruling, 2026-07-30):
 *
 *   codexes/packs/irl/foundation/reviews/<version>/<runId>/
 *     run-manifest.json
 *     r1/batch-000.json ...
 *     r2/batch-000.json ...
 *     final/review-result.json      (written ONLY at state COMPLETE)
 *     final/review-receipt.json     (written ONLY at state COMPLETE)
 *
 * Writes are atomic: write to a sibling `.tmp-<pid>-<counter>` file, then
 * `renameSync` over the final path. A rename within the same directory is
 * atomic on the filesystems this runs on, so an interrupted write cannot
 * leave a half-written file at the real path — a reader either sees the
 * complete prior version or the complete new one, never a partial one.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReviewerSlot } from '../../services/research/review/types';
import type { BatchCheckpoint, RunManifestRecord } from '../../services/research/review/checkpoint';

let tmpCounter = 0;

function atomicWriteJson(path: string, value: unknown): void {
  const tmpPath = `${path}.tmp-${process.pid}-${tmpCounter++}`;
  writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmpPath, path);
}

function readJsonIfExists(path: string): unknown {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export class CorruptCheckpointError extends Error {
  constructor(path: string, cause: unknown) {
    super(`checkpoint at ${path} is present but unreadable/corrupt: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'CorruptCheckpointError';
  }
}

export interface ReviewCheckpointStore {
  runDir: string;
  readRunManifest(): RunManifestRecord | null;
  writeRunManifest(manifest: RunManifestRecord): void;
  /** Throws CorruptCheckpointError if the file exists but fails to parse. Returns null if absent. */
  readBatchCheckpoint(reviewerSlot: ReviewerSlot, batchId: string): BatchCheckpoint | null;
  writeBatchCheckpoint(checkpoint: BatchCheckpoint): void;
  listBatchCheckpoints(reviewerSlot: ReviewerSlot): BatchCheckpoint[];
  writeFinalResult(result: unknown): void;
  writeFinalReceipt(receipt: unknown): void;
}

export function createFileReviewCheckpointStore(runDir: string): ReviewCheckpointStore {
  const manifestPath = join(runDir, 'run-manifest.json');
  const dirFor = (slot: ReviewerSlot) => join(runDir, slot.toLowerCase());
  const pathFor = (slot: ReviewerSlot, batchId: string) => join(dirFor(slot), `${batchId}.json`);
  const finalDir = join(runDir, 'final');

  mkdirSync(runDir, { recursive: true });
  mkdirSync(dirFor('R1'), { recursive: true });
  mkdirSync(dirFor('R2'), { recursive: true });
  mkdirSync(finalDir, { recursive: true });

  return {
    runDir,
    readRunManifest() {
      return readJsonIfExists(manifestPath) as RunManifestRecord | null;
    },
    writeRunManifest(manifest) {
      atomicWriteJson(manifestPath, manifest);
    },
    readBatchCheckpoint(reviewerSlot, batchId) {
      const p = pathFor(reviewerSlot, batchId);
      if (!existsSync(p)) return null;
      try {
        return JSON.parse(readFileSync(p, 'utf-8')) as BatchCheckpoint;
      } catch (err) {
        throw new CorruptCheckpointError(p, err);
      }
    },
    writeBatchCheckpoint(checkpoint) {
      atomicWriteJson(pathFor(checkpoint.reviewerSlot, checkpoint.batchId), checkpoint);
    },
    listBatchCheckpoints(reviewerSlot) {
      const dir = dirFor(reviewerSlot);
      if (!existsSync(dir)) return [];
      const fs = require('node:fs');
      return (fs.readdirSync(dir) as string[])
        .filter((f) => f.endsWith('.json') && !f.includes('.tmp-'))
        .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as BatchCheckpoint);
    },
    writeFinalResult(result) {
      atomicWriteJson(join(finalDir, 'review-result.json'), result);
    },
    writeFinalReceipt(receipt) {
      atomicWriteJson(join(finalDir, 'review-receipt.json'), receipt);
    },
  };
}

/** In-memory implementation for tests — same interface, no filesystem. */
export function createInMemoryReviewCheckpointStore(): ReviewCheckpointStore {
  let manifest: RunManifestRecord | null = null;
  const batches: Record<string, BatchCheckpoint> = {};
  let finalResult: unknown = null;
  let finalReceipt: unknown = null;

  return {
    runDir: 'in-memory',
    readRunManifest: () => manifest,
    writeRunManifest: (m) => {
      manifest = JSON.parse(JSON.stringify(m));
    },
    readBatchCheckpoint: (slot, batchId) => {
      const key = `${slot}/${batchId}`;
      return key in batches ? JSON.parse(JSON.stringify(batches[key])) : null;
    },
    writeBatchCheckpoint: (checkpoint) => {
      batches[`${checkpoint.reviewerSlot}/${checkpoint.batchId}`] = JSON.parse(JSON.stringify(checkpoint));
    },
    listBatchCheckpoints: (slot) =>
      Object.entries(batches)
        .filter(([k]) => k.startsWith(`${slot}/`))
        .map(([, v]) => JSON.parse(JSON.stringify(v))),
    writeFinalResult: (r) => {
      finalResult = r;
    },
    writeFinalReceipt: (r) => {
      finalReceipt = r;
    },
    // Test-only escape hatches, not part of the public interface contract.
    ...({ getFinalResult: () => finalResult, getFinalReceipt: () => finalReceipt } as object),
  };
}
