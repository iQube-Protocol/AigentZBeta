import crypto from 'crypto';
import type { BrowserReceiptRecord, BrowserSessionRecord } from './types.js';

export class BrowserReceiptsService {
  createReceipt(
    session: BrowserSessionRecord,
    receiptType: string,
    payload: Record<string, unknown>
  ): BrowserReceiptRecord {
    const createdAt = new Date().toISOString();
    const serialized = JSON.stringify({
      sessionId: session.sessionId,
      receiptType,
      payload,
      createdAt,
    });
    return {
      id: crypto.randomUUID(),
      sessionId: session.sessionId,
      receiptType,
      receiptHash: crypto.createHash('sha256').update(serialized).digest('hex'),
      payload,
      createdAt,
    };
  }
}

export const browserReceiptsService = new BrowserReceiptsService();
