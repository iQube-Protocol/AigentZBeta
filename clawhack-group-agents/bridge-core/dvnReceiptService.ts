/**
 * DVN Receipt Service
 * 
 * Handles emission of DVN receipts to QubeTalk topic or HTTP endpoint.
 * Provides buffering, retry logic, and error handling.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DVNReceipt } from "../schemas/bridgeEvents";

export interface DVNReceiptServiceConfig {
  endpoint: string; // QubeTalk topic or HTTP endpoint
  mode: "qubetalk" | "http";
  tenant_id: string;
  buffer_size?: number;
  flush_interval_ms?: number;
  retry_attempts?: number;
  retry_delay_ms?: number;
}

class ReceiptFlushError extends Error {
  publishedCount: number;

  constructor(message: string, publishedCount: number) {
    super(message);
    this.publishedCount = publishedCount;
  }
}

export class DVNReceiptService {
  private config: DVNReceiptServiceConfig;
  private buffer: DVNReceipt[] = [];
  private flushTimer?: NodeJS.Timeout;
  private cachedDvnChannelId?: string;
  private stats = {
    emitted: 0,
    failed: 0,
    buffered: 0,
  };

  constructor(config: DVNReceiptServiceConfig) {
    this.config = {
      buffer_size: 100,
      flush_interval_ms: 5000,
      retry_attempts: 3,
      retry_delay_ms: 1000,
      ...config,
    };

    this.startFlushTimer();
  }

  /**
   * Emit a single receipt
   */
  async emit(receipt: DVNReceipt): Promise<void> {
    this.buffer.push(receipt);
    this.stats.buffered = this.buffer.length;

    if (this.buffer.length >= this.config.buffer_size!) {
      await this.flush();
    }
  }

  /**
   * Emit multiple receipts
   */
  async emitBatch(receipts: DVNReceipt[]): Promise<void> {
    this.buffer.push(...receipts);
    this.stats.buffered = this.buffer.length;

    if (this.buffer.length >= this.config.buffer_size!) {
      await this.flush();
    }
  }

  /**
   * Flush buffered receipts
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const receipts = [...this.buffer];
    this.buffer = [];
    this.stats.buffered = 0;

    try {
      let publishedCount = 0;
      if (this.config.mode === "http") {
        await this.flushToHTTP(receipts);
        publishedCount = receipts.length;
      } else {
        publishedCount = await this.flushToQubeTalk(receipts);
      }

      this.stats.emitted += publishedCount;
    } catch (error) {
      console.error("[DVNReceiptService] Flush failed:", error);
      const publishedCount =
        error instanceof ReceiptFlushError ? error.publishedCount : 0;
      const failedReceipts = receipts.slice(publishedCount);
      this.stats.failed += failedReceipts.length;

      // Re-buffer failed receipts (up to buffer size)
      const toRebuffer = failedReceipts.slice(0, this.config.buffer_size);
      this.buffer.unshift(...toRebuffer);
      this.stats.buffered = this.buffer.length;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error("[DVNReceiptService] Auto-flush failed:", error);
      });
    }, this.config.flush_interval_ms!);
  }

  private async flushToHTTP(receipts: DVNReceipt[]): Promise<void> {
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receipts,
        tenant_id: this.config.tenant_id,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
  }

  private async flushToQubeTalk(receipts: DVNReceipt[]): Promise<number> {
    const channelId = await this.resolveDvnChannelId();
    const baseUrl = (process.env.QUBETALK_API_ENDPOINT || "http://localhost:3000/api/qubetalk").replace(
      /\/$/,
      ""
    );
    const authToken = process.env.QUBETALK_AUTH_TOKEN || "";

    const senderCandidates = [
      { id: "dvn_receipt_service", role: "system", name: "DVN Receipt Service" },
      { id: "openclaw_group_agent", role: "tenant", name: "OpenClaw Group Agent" },
      { id: "bridge_adapter_discord", role: "system", name: "Discord Bridge Adapter" },
      { id: "bridge_adapter_xmtp", role: "system", name: "XMTP Bridge Adapter" },
    ] as const;

    let publishedCount = 0;
    for (const receipt of receipts) {
      let published = false;
      let lastStatus = 0;

      for (const sender of senderCandidates) {
        const response = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            tenant_id: this.config.tenant_id,
            channel_id: channelId,
            from_agent: sender,
            type: "receipt",
            content: JSON.stringify(receipt),
            metadata: {
              schema: receipt.schema,
              receipt_type: receipt.receipt_type,
            },
          }),
        });

        if (response.ok) {
          published = true;
          break;
        }

        lastStatus = response.status;
        if (response.status !== 403) {
          break;
        }
      }

      if (!published) {
        throw new ReceiptFlushError(
          `QubeTalk receipt publish failed (${lastStatus || "unknown"})`,
          publishedCount
        );
      }
      publishedCount += 1;
    }

    return publishedCount;
  }

  private async resolveDvnChannelId(): Promise<string> {
    if (this.cachedDvnChannelId) {
      return this.cachedDvnChannelId;
    }

    const fromEnv = process.env.QT_CHANNEL_DVN_RECEIPTS_ID;
    if (fromEnv) {
      this.cachedDvnChannelId = fromEnv;
      return fromEnv;
    }

    const mapPath = path.join(process.cwd(), ".data", "channel-map.json");
    try {
      const raw = await readFile(mapPath, "utf8");
      const parsed = JSON.parse(raw) as { dvnReceipts?: string };
      if (parsed.dvnReceipts) {
        this.cachedDvnChannelId = parsed.dvnReceipts;
        return parsed.dvnReceipts;
      }
    } catch {
      // ignore and throw below
    }

    throw new Error(
      "Unable to resolve DVN receipts channel ID. Set QT_CHANNEL_DVN_RECEIPTS_ID or run init-channels."
    );
  }
}

/**
 * Create a DVN receipt service from environment variables
 */
export function createDVNReceiptService(): DVNReceiptService {
  const tenant_id = process.env.QT_TENANT_ID || "tnt_clawhack";
  const workspace = process.env.QT_CHANNEL_MAIN || "clawhack";
  const endpoint = process.env.DVN_ENDPOINT || `qt://${tenant_id}/${workspace}/dvn/receipts`;
  const mode = endpoint.startsWith("qt://") ? "qubetalk" : "http";

  return new DVNReceiptService({
    endpoint,
    mode,
    tenant_id,
  });
}
