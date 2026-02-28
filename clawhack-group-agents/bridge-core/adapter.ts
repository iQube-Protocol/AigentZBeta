/**
 * Bridge Adapter Interface
 * 
 * Defines the contract that all chat surface adapters (XMTP, Discord, etc.)
 * must implement to integrate with QubeTalk + DVN receipts.
 */

import type { InboundEvent, OutboundEvent, DVNReceipt } from "../schemas/bridgeEvents";

export interface AdapterConfig {
  provider: string;
  credentials: Record<string, string>;
  allowlist: {
    thread_ids?: string[];
    channel_ids?: string[];
    group_ids?: string[];
  };
  environment: "hackathon" | "dev" | "prod";
  tenant_id: string;
}

export interface PublishResult {
  success: boolean;
  provider_message_id?: string;
  error?: string;
}

export interface AdapterCheckpoint {
  last_message_id?: string;
  last_timestamp?: string;
  cursor?: string;
}

/**
 * BridgeAdapter: The core interface all adapters must implement
 */
export abstract class BridgeAdapter {
  protected config: AdapterConfig;
  protected receiptEmitter?: (receipt: DVNReceipt) => Promise<void>;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  /**
   * Set the receipt emitter callback
   */
  setReceiptEmitter(emitter: (receipt: DVNReceipt) => Promise<void>): void {
    this.receiptEmitter = emitter;
  }

  /**
   * Start the adapter: connect to provider APIs/SDK, validate credentials
   */
  abstract start(): Promise<void>;

  /**
   * Stop the adapter: cleanup connections
   */
  abstract stop(): Promise<void>;

  /**
   * Ingest messages from provider and emit InboundEvents
   * Returns an async generator that yields events as they arrive
   */
  abstract ingest(): AsyncGenerator<InboundEvent, void, unknown>;

  /**
   * Publish an outbound message to the provider
   */
  abstract publish(event: OutboundEvent): Promise<PublishResult>;

  /**
   * Optional: Save/restore checkpoint for resilience
   */
  async checkpoint(state: AdapterCheckpoint): Promise<void> {
    // Default: no-op (adapters can override)
  }

  async getCheckpoint(): Promise<AdapterCheckpoint | null> {
    // Default: no checkpoint
    return null;
  }

  /**
   * Helper: Emit a DVN receipt
   */
  protected async emitReceipt(receipt: DVNReceipt): Promise<void> {
    if (this.receiptEmitter) {
      await this.receiptEmitter(receipt);
    }
  }

  /**
   * Helper: Generate receipt ID
   */
  protected generateReceiptId(): string {
    return `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Helper: Hash payload for receipts
   */
  protected hashPayload(payload: any): string {
    // Simple hash for demo; use crypto.subtle.digest in production
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `sha256:${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Receipt Emitter: Publishes receipts to QubeTalk DVN topic
 */
export class DVNReceiptEmitter {
  private qubetalkPublisher: (topic: string, payload: any) => Promise<void>;
  private tenant_id: string;

  constructor(
    tenant_id: string,
    qubetalkPublisher: (topic: string, payload: any) => Promise<void>
  ) {
    this.tenant_id = tenant_id;
    this.qubetalkPublisher = qubetalkPublisher;
  }

  async emit(receipt: DVNReceipt): Promise<void> {
    const topic = `qt://${this.tenant_id}/dvn/receipts`;
    await this.qubetalkPublisher(topic, receipt);
  }
}
