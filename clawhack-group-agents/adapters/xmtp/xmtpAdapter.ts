/**
 * XMTP/Convos Adapter for QubeTalk Bridge
 * 
 * Integrates XMTP group chat (Convos) with QubeTalk using server-side mode.
 * Supports group ID allowlist and encrypted local DB.
 */

import type {
  InboundEvent,
  OutboundEvent,
  DVNReceipt,
} from "../../schemas/bridgeEvents";
import { BridgeAdapter, type AdapterConfig, type PublishResult } from "../../bridge-core/adapter";

export interface XMTPAdapterConfig extends AdapterConfig {
  credentials: {
    wallet_private_key?: string; // For wallet-based auth
    inbox_id?: string; // For existing inbox
  };
  allowlist: {
    group_ids: string[];
  };
  db_encryption_key?: string;
  xmtp_env: "dev" | "production";
}

interface XMTPMessage {
  id: string;
  senderInboxId: string;
  sentAt: Date;
  content: any;
  contentType: string;
}

interface XMTPGroup {
  id: string;
  name?: string;
  members: Array<{ inboxId: string; addresses: string[] }>;
}

/**
 * XMTP Adapter - Server Mode
 * 
 * This adapter uses the XMTP SDK in server mode to:
 * 1. Connect to XMTP network
 * 2. Monitor allowlisted group chats
 * 3. Normalize messages to InboundEvents
 * 4. Publish OutboundEvents back to groups
 * 5. Emit DVN receipts for all operations
 */
export class XMTPAdapter extends BridgeAdapter {
  protected config: XMTPAdapterConfig;
  private client: any; // XMTP Client (would be imported from @xmtp/node-sdk)
  private groups: Map<string, XMTPGroup> = new Map();
  private streaming: boolean = false;
  private lastProcessedTimestamp: Date = new Date();

  constructor(config: XMTPAdapterConfig) {
    super(config);
    this.config = config;
  }

  async start(): Promise<void> {
    console.log("[XMTPAdapter] Starting...");

    const simulationMode = process.env.XMTP_SIMULATION_MODE !== "false";
    if (simulationMode && this.config.environment === "prod") {
      throw new Error(
        "XMTP simulation mode is enabled in prod. Disable XMTP_SIMULATION_MODE and wire real XMTP SDK integration."
      );
    }

    // In production, this would initialize the XMTP client:
    // 
    // import { Client } from "@xmtp/node-sdk";
    // 
    // this.client = await Client.create(
    //   this.config.credentials.wallet_private_key,
    //   {
    //     env: this.config.xmtp_env,
    //     dbEncryptionKey: this.config.db_encryption_key,
    //   }
    // );

    // For now, simulate client initialization
    if (!simulationMode) {
      throw new Error(
        "Real XMTP SDK path is not enabled in this build. Set XMTP_SIMULATION_MODE=true for local testing."
      );
    }
    this.client = {
      inboxId: this.config.credentials.inbox_id || "mock_inbox_id",
      conversations: {
        list: async () => [],
        streamAllMessages: async function* () {},
      },
    };

    // Load and validate allowlisted groups
    await this.loadAllowlistedGroups();

    this.streaming = true;
    console.log(`[XMTPAdapter] Started with inbox: ${this.client.inboxId}`);
    console.log(`[XMTPAdapter] Monitoring ${this.groups.size} groups`);
  }

  async stop(): Promise<void> {
    this.streaming = false;
    console.log("[XMTPAdapter] Stopped");
  }

  async *ingest(): AsyncGenerator<InboundEvent, void, unknown> {
    console.log("[XMTPAdapter] Starting message ingestion...");

    // In production, this would stream messages from XMTP:
    // 
    // for await (const message of this.client.conversations.streamAllMessages()) {
    //   if (!this.streaming) break;
    //   
    //   const groupId = message.conversation.id;
    //   if (!this.config.allowlist.group_ids.includes(groupId)) {
    //     continue; // Skip non-allowlisted groups
    //   }
    //   
    //   const event = this.normalizeInboundMessage(message, groupId);
    //   await this.emitInboundReceipt(message, groupId);
    //   yield event;
    // }

    // For demo purposes, simulate streaming
    while (this.streaming) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      // In production, messages would be yielded here
    }
  }

  async publish(event: OutboundEvent): Promise<PublishResult> {
    const groupId = event.thread.provider_thread_id;

    if (!this.config.allowlist.group_ids.includes(groupId)) {
      return {
        success: false,
        error: `Group ${groupId} not in allowlist`,
      };
    }

    try {
      // In production, this would send to XMTP:
      // 
      // const group = await this.client.conversations.getConversation(groupId);
      // const messageId = await group.send(event.message.content.text);

      // For demo, simulate send
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Emit DVN receipt for outbound
      await this.emitReceipt({
        schema: "metame.dvn.receipt.v0",
        receipt_id: this.generateReceiptId(),
        tenant_id: this.config.tenant_id,
        timestamp: new Date().toISOString(),
        receipt_type: "bridge.outbound_posted",
        payload: {
          provider: "xmtp",
          provider_thread_id: groupId,
          provider_message_id: messageId,
          payload_hash: this.hashPayload(event.message.content),
          request_id: event.audit.request_id,
        },
      });

      return {
        success: true,
        provider_message_id: messageId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  }

  private async loadAllowlistedGroups(): Promise<void> {
    // In production, this would fetch groups from XMTP:
    // 
    // const allGroups = await this.client.conversations.list();
    // for (const group of allGroups) {
    //   if (this.config.allowlist.group_ids.includes(group.id)) {
    //     this.groups.set(group.id, {
    //       id: group.id,
    //       name: group.name,
    //       members: await group.members(),
    //     });
    //   }
    // }

    // For demo, simulate groups
    for (const groupId of this.config.allowlist.group_ids) {
      this.groups.set(groupId, {
        id: groupId,
        name: `Group ${groupId}`,
        members: [],
      });
    }

    console.log(`[XMTPAdapter] Loaded ${this.groups.size} allowlisted groups`);
  }

  private normalizeInboundMessage(message: XMTPMessage, groupId: string): InboundEvent {
    const threadKey = this.hashPayload(`${this.config.tenant_id}:xmtp:${groupId}`);

    // Simple intent detection
    const text = this.extractTextContent(message.content);
    let intent_hint: InboundEvent["routing"]["intent_hint"] = "unknown";
    if (text.includes("drop") || text.includes("comic") || text.includes("make")) {
      intent_hint = "create_drop";
    } else if (text.includes("summarize") || text.includes("summary")) {
      intent_hint = "summarize";
    } else if (text.includes("help")) {
      intent_hint = "help";
    }

    return {
      schema: "metame.bridge.inbound.v0",
      tenant_id: this.config.tenant_id,
      provider: {
        name: "xmtp",
        environment: this.config.environment,
      },
      thread: {
        provider_thread_id: groupId,
        thread_key: threadKey,
        qt_thread_id: `qt://${this.config.tenant_id}/threads/xmtp/${groupId}`,
      },
      message: {
        provider_message_id: message.id,
        sent_ts: message.sentAt.toISOString(),
        sender: {
          provider_user_id: message.senderInboxId,
          identity: {
            xmtp_inbox_id: message.senderInboxId,
          },
        },
        content: {
          type: "text",
          text: text,
        },
      },
      routing: {
        target_agent: "router",
        intent_hint,
      },
      security: {
        data_classification: "internal",
        receipt_required: true,
        redaction_required: false,
      },
    };
  }

  private extractTextContent(content: any): string {
    // XMTP content can be various types (text, attachment, etc.)
    // This is a simplified extraction
    if (typeof content === "string") {
      return content;
    }
    if (content?.text) {
      return content.text;
    }
    return JSON.stringify(content);
  }

  private async emitInboundReceipt(message: XMTPMessage, groupId: string): Promise<void> {
    await this.emitReceipt({
      schema: "metame.dvn.receipt.v0",
      receipt_id: this.generateReceiptId(),
      tenant_id: this.config.tenant_id,
      timestamp: new Date().toISOString(),
      receipt_type: "bridge.inbound_received",
      payload: {
        provider: "xmtp",
        provider_thread_id: groupId,
        provider_message_id: message.id,
        payload_hash: this.hashPayload(message.content),
      },
    });
  }
}
