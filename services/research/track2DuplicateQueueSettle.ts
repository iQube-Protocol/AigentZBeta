/**
 * Track 2 Stage 9 duplicate-pair queue — the AUTHORITATIVE post-merge
 * refresh sequence, extracted as a pure orchestration function (operator
 * ruling, 2026-08-27, "UI acceptance gap" pass) so the exact call order —
 * read, conditionally advance, resync, scroll — is unit-testable without
 * rendering any DOM. No React import, no fetch of its own: every IO step is
 * caller-injected, so this module is safe to import from both the client
 * panel and a plain `.test.ts`.
 *
 * NO LOCAL STATE AUTHORITY (operator ruling, 2026-08-27): every step here
 * reads from the caller-injected `readDuplicatePairCount`/`advance`
 * functions — never a client-tracked "resolved" set. The sequence is:
 *
 *   1. Re-read the SAME authoritative Track 2 GET the whole panel already
 *      uses (`readDuplicatePairCount`).
 *   2. If that reading still names outstanding pairs, STOP — the caller's
 *      own re-render (fed by the state that same read already updated)
 *      supplies the next pair; this function does nothing further.
 *   3. Only when that reading confirms ZERO pairs remain, POST the
 *      canonical orchestrator entry point (`advance`) — never a second,
 *      parallel progression mechanism, and never more than once per call.
 *   4. Re-read the authoritative Track 2 GET again (`resync`), so the
 *      caller's own state is back in sync with what the orchestrator just
 *      did — exactly like a plain mount/refresh would observe it.
 *   5. Scroll using the ADVANCE RESPONSE's OWN anchor id, consumed
 *      verbatim — never invented when the response names none.
 */

export interface Track2DuplicateQueueSettleDeps {
  /** Re-reads the SAME authoritative Track 2 GET the whole panel already
   *  uses, and returns how many duplicate pairs THAT reading still names.
   *  `null` means the read itself failed — the sequence stops there and
   *  `advance` is never called. */
  readDuplicatePairCount: () => Promise<number | null>;
  /** POSTs the canonical orchestrator advance route. Returns the anchor id
   *  to scroll to, or `null` if the response named no pending decision —
   *  never fabricated when the response is silent. Rejects on failure. */
  advance: () => Promise<{ anchorId: string | null }>;
  /** Re-reads the authoritative Track 2 GET a second time, AFTER advance,
   *  so the caller's own state is back in sync. Runs even if it fails to
   *  update anything useful — the advance itself already succeeded, and
   *  scrolling still proceeds from the advance response's own anchor. */
  resync: () => Promise<void>;
  scrollToAnchorId: (anchorId: string) => void;
}

export type Track2DuplicateQueueSettleOutcome =
  | { kind: 'read-failed' }
  | { kind: 'pairs-remain'; count: number }
  | { kind: 'advanced'; anchorId: string | null }
  | { kind: 'advance-failed'; error: string };

export async function settleTrack2DuplicateQueue(
  deps: Track2DuplicateQueueSettleDeps,
): Promise<Track2DuplicateQueueSettleOutcome> {
  const count = await deps.readDuplicatePairCount();
  if (count === null) return { kind: 'read-failed' };
  if (count > 0) return { kind: 'pairs-remain', count };

  let result: { anchorId: string | null };
  try {
    result = await deps.advance();
  } catch (e) {
    return { kind: 'advance-failed', error: e instanceof Error ? e.message : 'advance failed' };
  }

  await deps.resync();

  if (result.anchorId) deps.scrollToAnchorId(result.anchorId);
  return { kind: 'advanced', anchorId: result.anchorId };
}
