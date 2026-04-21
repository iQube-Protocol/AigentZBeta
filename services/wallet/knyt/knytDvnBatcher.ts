/**
 * KNYT DVN Batcher
 * 
 * Batches KNYT micro-transactions for efficient DVN submission.
 * - In-memory queue with configurable batch size
 * - Auto-flush on interval or batch size threshold
 * - Submits batches to DVN monitor endpoint
 */

import { KnytDvnEvent, KnytDvnBatch, KnytDvnSubmitResult, DEFAULT_KNYT_CONFIG } from './types';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

// In-memory queue (server-side singleton)
let eventQueue: KnytDvnEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let isInitialized = false;

const config = {
  batchSize: DEFAULT_KNYT_CONFIG.dvnBatchSize,
  flushIntervalMs: DEFAULT_KNYT_CONFIG.dvnBatchFlushIntervalMs,
};

/** Initialize the batcher with optional config */
export function initKnytBatcher(options?: { batchSize?: number; flushIntervalMs?: number }) {
  if (isInitialized) return;
  
  if (options?.batchSize) config.batchSize = options.batchSize;
  if (options?.flushIntervalMs) config.flushIntervalMs = options.flushIntervalMs;
  
  // Start auto-flush timer
  flushTimer = setInterval(() => {
    if (eventQueue.length > 0) {
      flushBatch().catch(console.error);
    }
  }, config.flushIntervalMs);
  
  isInitialized = true;
  console.log(`[KNYT Batcher] Initialized. Batch size: ${config.batchSize}, Flush interval: ${config.flushIntervalMs}ms`);
}

/** Enqueue a DVN event for batched submission */
export async function enqueueDvnEvent(event: KnytDvnEvent): Promise<void> {
  if (!isInitialized) initKnytBatcher();
  
  eventQueue.push(event);
  console.log(`[KNYT Batcher] Enqueued event ${event.txId}. Queue size: ${eventQueue.length}`);
  
  // Flush if batch size reached
  if (eventQueue.length >= config.batchSize) {
    await flushBatch();
  }
}

/** Flush current batch to DVN */
export async function flushBatch(): Promise<KnytDvnSubmitResult> {
  if (eventQueue.length === 0) {
    return { success: true, batchId: '' };
  }
  
  const batchId = `knyt_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const events = [...eventQueue];
  eventQueue = []; // Clear queue immediately
  
  const batch: KnytDvnBatch = {
    batchId,
    events,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  
  console.log(`[KNYT Batcher] Flushing batch ${batchId} with ${events.length} events`);
  
  try {
    // Submit to DVN monitor endpoint
    const dvnPayload = {
      txHash: batchId,
      chainId: 0, // KNYT ledger (off-chain)
      sourceChain: 'knyt_ledger',
      targetChain: 'knyt_ledger',
      amount: events.reduce((sum, e) => sum + (e.direction === 'credit' ? e.amount : -e.amount), 0).toString(),
      operation: 'knyt_batch',
      timestamp: Date.now(),
      eventId: batchId,
      metadata: {
        eventCount: events.length,
        events: events.map(e => ({
          txId: e.txId,
          personaId: e.personaId,
          amount: e.amount,
          direction: e.direction,
          source: e.source,
          assetId: e.assetId,
        })),
      },
    };
    
    const response = await fetch(
      process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/ops/dvn/monitor`
        : '/api/ops/dvn/monitor',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dvnPayload),
      }
    );
    
    if (!response.ok) {
      throw new Error(`DVN submission failed: ${response.status}`);
    }
    
    const result = await response.json();
    const dvnMessageId: string | undefined = result.messageId;
    console.log(`[KNYT Batcher] Batch ${batchId} submitted to DVN. MessageId: ${dvnMessageId}`);

    // Write DVN message ID back to wallet_transactions so finalization can match them
    if (dvnMessageId) {
      const supabase = getSupabaseServer();
      if (supabase) {
        const txIds = events.map((e) => e.txId);
        const { error: updateErr } = await supabase
          .from('wallet_transactions')
          .update({ dvn_batch_id: dvnMessageId, dvn_submitted_at: new Date().toISOString() })
          .in('id', txIds);
        if (updateErr) {
          console.error(`[KNYT Batcher] Failed to write dvn_batch_id back:`, updateErr.message);
        }
      }
    }

    return {
      success: true,
      batchId,
      dvnMessageId,
    };
  } catch (error) {
    console.error(`[KNYT Batcher] Batch ${batchId} submission failed:`, error);
    // Re-queue events on failure
    eventQueue = [...events, ...eventQueue];
    return {
      success: false,
      batchId,
      error: (error as Error).message,
    };
  }
}

/** Get current queue status */
export function getBatcherStatus() {
  return {
    queueSize: eventQueue.length,
    batchSize: config.batchSize,
    flushIntervalMs: config.flushIntervalMs,
    isInitialized,
  };
}

/** Stop the batcher (for cleanup) */
export function stopKnytBatcher() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  isInitialized = false;
}
