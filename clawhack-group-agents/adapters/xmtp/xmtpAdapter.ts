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
  private client: any;
  private groups: Map<string, XMTPGroup> = new Map();
  private streaming: boolean = false;
  private simulationMode: boolean = true;

  constructor(config: XMTPAdapterConfig) {
    super(config);
    this.config = config;
  }

  async start(): Promise<void> {
    console.log("[XMTPAdapter] Starting...");

    this.simulationMode = process.env.XMTP_SIMULATION_MODE !== "false";
    if (this.simulationMode && this.config.environment === "prod") {
      throw new Error(
        "XMTP simulation mode is enabled in prod. Disable XMTP_SIMULATION_MODE and wire real XMTP SDK integration."
      );
    }

    if (!this.simulationMode) {
      if (this.config.environment === "prod" && !this.config.db_encryption_key) {
        throw new Error(
          "XMTP_DB_ENCRYPTION_KEY is required in prod when XMTP simulation mode is disabled."
        );
      }
      this.client = await this.initializeRealClient();
    } else {
      this.client = {
        inboxId: this.config.credentials.inbox_id || "mock_inbox_id",
        conversations: {
          list: async () => [],
          streamAllMessages: async function* () {},
        },
      };
    }

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

    if (this.simulationMode) {
      while (this.streaming) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
      return;
    }

    const streamFn = this.client?.conversations?.streamAllMessages;
    if (typeof streamFn !== "function") {
      throw new Error("XMTP client does not expose conversations.streamAllMessages()");
    }

    for await (const rawMessage of streamFn.call(this.client.conversations)) {
      if (!this.streaming) {
        break;
      }

      const message = this.normalizeRawMessage(rawMessage);
      if (!message) {
        continue;
      }

      const groupId = this.extractGroupId(rawMessage);
      if (!groupId || !this.config.allowlist.group_ids.includes(groupId)) {
        continue;
      }

      const event = this.normalizeInboundMessage(message, groupId);
      await this.emitInboundReceipt(message, groupId);
      yield event;
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
      let messageId: string;
      if (this.simulationMode) {
        messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      } else {
        const conversation = await this.resolveConversation(groupId);
        if (!conversation || typeof conversation.send !== "function") {
          throw new Error(`Unable to resolve XMTP conversation ${groupId}`);
        }
        const sent = await conversation.send(event.message.content.text);
        messageId =
          (typeof sent === "string" ? sent : sent?.id) ||
          `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      }

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
    if (this.simulationMode) {
      for (const groupId of this.config.allowlist.group_ids) {
        this.groups.set(groupId, {
          id: groupId,
          name: `Group ${groupId}`,
          members: [],
        });
      }
      console.log(`[XMTPAdapter] Loaded ${this.groups.size} allowlisted groups`);
      return;
    }

    const conversations = await this.listConversations();
    for (const conversation of conversations) {
      const groupId = this.extractGroupId(conversation);
      if (!groupId || !this.config.allowlist.group_ids.includes(groupId)) {
        continue;
      }

      let members: XMTPGroup["members"] = [];
      if (typeof conversation.members === "function") {
        try {
          const rawMembers = await conversation.members();
          if (Array.isArray(rawMembers)) {
            members = rawMembers.map((member: any) => ({
              inboxId: String(member?.inboxId || member?.inbox_id || ""),
              addresses: Array.isArray(member?.addresses)
                ? member.addresses.map((address: unknown) => String(address))
                : [],
            }));
          }
        } catch {
          members = [];
        }
      }

      this.groups.set(groupId, {
        id: groupId,
        name: typeof conversation?.name === "string" ? conversation.name : undefined,
        members,
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

  private async initializeRealClient(): Promise<any> {
    const privateKey = this.config.credentials.wallet_private_key?.trim();
    if (!privateKey) {
      throw new Error(
        "XMTP_WALLET_PRIVATE_KEY is required when XMTP_SIMULATION_MODE=false"
      );
    }

    let sdk: any;
    try {
      const moduleName = "@xmtp/node-sdk";
      sdk = await import(moduleName);
    } catch (error: any) {
      throw new Error(
        `Unable to import @xmtp/node-sdk. Install dependencies in clawhack-group-agents (error: ${error?.message || "unknown"})`
      );
    }

    const clientFactory =
      sdk?.Client?.create ||
      sdk?.createClient ||
      sdk?.default?.Client?.create ||
      sdk?.default?.createClient;
    if (typeof clientFactory !== "function") {
      throw new Error("Unsupported @xmtp/node-sdk export shape: missing Client.create");
    }

    const options = {
      env: this.config.xmtp_env,
      dbEncryptionKey: this.config.db_encryption_key,
      inboxId: this.config.credentials.inbox_id,
    };

    try {
      return await clientFactory(privateKey, options);
    } catch (error: any) {
      throw new Error(`Failed to initialize XMTP client: ${error?.message || "unknown"}`);
    }
  }

  private async listConversations(): Promise<any[]> {
    const listFn =
      this.client?.conversations?.list ||
      this.client?.listConversations ||
      this.client?.conversations?.getAll;
    if (typeof listFn !== "function") {
      return [];
    }

    const result = await listFn.call(
      this.client.conversations ?? this.client
    );
    return Array.isArray(result) ? result : [];
  }

  private async resolveConversation(groupId: string): Promise<any | null> {
    const directFn =
      this.client?.conversations?.getConversation ||
      this.client?.conversations?.getConversationById;
    if (typeof directFn === "function") {
      const conversation = await directFn.call(this.client.conversations, groupId);
      if (conversation) {
        return conversation;
      }
    }

    const conversations = await this.listConversations();
    return (
      conversations.find((conversation) => this.extractGroupId(conversation) === groupId) ?? null
    );
  }

  private extractGroupId(value: any): string | null {
    const candidates = [
      value?.conversation?.id,
      value?.groupId,
      value?.group_id,
      value?.id,
      value?.conversationId,
      value?.conversation_id,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  }

  private normalizeRawMessage(rawMessage: any): XMTPMessage | null {
    const idCandidates = [rawMessage?.id, rawMessage?.messageId, rawMessage?.message_id];
    const senderCandidates = [
      rawMessage?.senderInboxId,
      rawMessage?.senderInboxID,
      rawMessage?.sender?.inboxId,
      rawMessage?.sender?.inbox_id,
    ];
    const sentCandidates = [rawMessage?.sentAt, rawMessage?.sent_at, rawMessage?.timestamp];

    const id = idCandidates.find(
      (candidate) => typeof candidate === "string" && candidate.trim().length > 0
    );
    const senderInboxId = senderCandidates.find(
      (candidate) => typeof candidate === "string" && candidate.trim().length > 0
    );
    if (!id || !senderInboxId) {
      return null;
    }

    const sentAtRaw = sentCandidates.find(Boolean);
    const sentAt = sentAtRaw ? new Date(sentAtRaw) : new Date();
    return {
      id,
      senderInboxId,
      sentAt: Number.isNaN(sentAt.getTime()) ? new Date() : sentAt,
      content: rawMessage?.content,
      contentType: rawMessage?.contentType || "text",
    };
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
