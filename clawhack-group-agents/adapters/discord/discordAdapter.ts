/**
 * Discord Adapter for QubeTalk Bridge
 * 
 * Integrates Discord with QubeTalk using the existing Discord API infrastructure
 * and routes capsule generation through A2UI/Surface Planner.
 */

import type {
  InboundEvent,
  OutboundEvent,
  DVNReceipt,
  DiscordCapsulePayload,
} from "../../schemas/bridgeEvents";
import { BridgeAdapter, type AdapterConfig, type PublishResult } from "../../bridge-core/adapter";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export interface DiscordAdapterConfig extends AdapterConfig {
  credentials: {
    bot_token?: string;
    webhook_url?: string;
  };
  allowlist: {
    channel_ids: string[];
  };
  surface_planner_endpoint?: string; // Optional: route capsules through Surface Planner
}

export class DiscordAdapter extends BridgeAdapter {
  protected config: DiscordAdapterConfig;
  private botId?: string;
  private polling: boolean = false;
  private lastMessageTimestampByChannel: Map<string, string> = new Map();
  private webhookUrl?: string;

  constructor(config: DiscordAdapterConfig) {
    super(config);
    this.config = config;
  }

  async start(): Promise<void> {
    const botToken = this.config.credentials.bot_token?.trim();
    const webhookUrl = this.config.credentials.webhook_url?.trim();
    const hasBotToken = Boolean(botToken);
    const hasWebhook = Boolean(webhookUrl);

    if (!hasBotToken && !hasWebhook) {
      throw new Error("Discord bot token or webhook URL is required");
    }

    this.webhookUrl = webhookUrl;

    if (hasBotToken) {
      // Validate bot identity
      const me = await this.fetchDiscord("/users/@me", { headers: this.authHeaders() });
      if (!me.ok) {
        throw new Error(`Failed to validate Discord bot: ${me.data?.message || "Unknown error"}`);
      }

      this.botId = me.data?.id;
      console.log(`[DiscordAdapter] Started with bot: ${me.data?.username} (${this.botId})`);

      // Validate channel access
      for (const channelId of this.config.allowlist.channel_ids) {
        const channel = await this.fetchDiscord(`/channels/${channelId}`, {
          headers: this.authHeaders(),
        });
        if (!channel.ok) {
          throw new Error(`Cannot access channel ${channelId}: ${channel.data?.message}`);
        }
        console.log(`[DiscordAdapter] Verified access to channel: ${channel.data?.name}`);
      }

      this.polling = true;
      return;
    }

    console.log("[DiscordAdapter] Started in publish-only webhook mode");
    this.polling = false;
  }

  async stop(): Promise<void> {
    this.polling = false;
    console.log("[DiscordAdapter] Stopped");
  }

  async *ingest(): AsyncGenerator<InboundEvent, void, unknown> {
    while (this.polling) {
      for (const channelId of this.config.allowlist.channel_ids) {
        try {
          const messages = await this.fetchRecentMessages(channelId);
          const orderedMessages = [...messages].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          let channelCursor = this.lastMessageTimestampByChannel.get(channelId);

          for (const msg of orderedMessages) {
            // Skip bot's own messages
            if (msg.author?.id === this.botId) continue;

            // Skip if already processed
            if (channelCursor && msg.timestamp <= channelCursor) {
              continue;
            }

            const event = this.normalizeInboundMessage(msg, channelId);
            
            // Emit DVN receipt for inbound
            await this.emitReceipt({
              schema: "metame.dvn.receipt.v0",
              receipt_id: this.generateReceiptId(),
              tenant_id: this.config.tenant_id,
              timestamp: new Date().toISOString(),
              receipt_type: "bridge.inbound_received",
              payload: {
                provider: "discord",
                provider_thread_id: channelId,
                provider_message_id: msg.id,
                payload_hash: this.hashPayload(msg),
              },
            });

            yield event;
            channelCursor = msg.timestamp;
          }

          if (channelCursor) {
            this.lastMessageTimestampByChannel.set(channelId, channelCursor);
          }
        } catch (error) {
          console.error(`[DiscordAdapter] Error ingesting from channel ${channelId}:`, error);
        }
      }

      // Poll every 5 seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  async publish(event: OutboundEvent): Promise<PublishResult> {
    const channelId = event.thread.provider_channel_id || event.thread.provider_thread_id;

    try {
      // If surface_planner_endpoint is configured, route through A2UI/Surface Planner
      let payload: any;
      
      if (this.config.surface_planner_endpoint && event.audit.artifacts?.length) {
        payload = await this.generateCapsuleThroughSurfacePlanner(event);
      } else {
        // Fallback: simple message
        payload = this.buildSimpleMessage(event);
      }

      const useWebhook = Boolean(this.webhookUrl && !this.config.credentials.bot_token);
      if (!useWebhook && !this.config.allowlist.channel_ids.includes(channelId)) {
        return {
          success: false,
          error: `Channel ${channelId} not in allowlist`,
        };
      }

      let result: { ok: boolean; status: number; data: any };
      if (useWebhook) {
        const webhookUrl = this.webhookUrl!;
        const joinChar = webhookUrl.includes("?") ? "&" : "?";
        const response = await fetch(`${webhookUrl}${joinChar}wait=true`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        result = { ok: response.ok, status: response.status, data };
      } else {
        result = await this.fetchDiscord(`/channels/${channelId}/messages`, {
          method: "POST",
          headers: {
            ...this.authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      if (!result.ok) {
        return {
          success: false,
          error: result.data?.message || "Failed to post message",
        };
      }

      // Emit DVN receipt for outbound
      await this.emitReceipt({
        schema: "metame.dvn.receipt.v0",
        receipt_id: this.generateReceiptId(),
        tenant_id: this.config.tenant_id,
        timestamp: new Date().toISOString(),
        receipt_type: "bridge.outbound_posted",
        payload: {
          provider: "discord",
          provider_thread_id: channelId,
          provider_message_id: result.data?.id,
          payload_hash: this.hashPayload(payload),
          request_id: event.audit.request_id,
        },
      });

      return {
        success: true,
        provider_message_id: result.data?.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  }

  private async generateCapsuleThroughSurfacePlanner(
    event: OutboundEvent
  ): Promise<DiscordCapsulePayload> {
    // Call Surface Planner to generate deterministic capsule design
    const response = await fetch(this.config.surface_planner_endpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capsule_type: "discord_pill",
        content: event.message.content,
        artifacts: event.audit.artifacts,
        device_context: { type: "mobile" }, // Discord is primarily mobile
      }),
    });

    if (!response.ok) {
      throw new Error("Surface Planner failed");
    }

    const capsule = (await response.json()) as DiscordCapsulePayload;
    return capsule;
  }

  private buildSimpleMessage(event: OutboundEvent): any {
    const message: any = {
      content: event.message.content.text,
    };

    // Add embeds if artifacts present
    if (event.audit.artifacts?.length) {
      message.embeds = [
        {
          title: "Generated Artifacts",
          description: event.audit.artifacts.map((a) => `• ${a.label}`).join("\n"),
          color: 0x00d9ff, // Cyan
        },
      ];
    }

    // Add buttons if present
    if (event.message.content.buttons?.length) {
      message.components = [
        {
          type: 1, // ACTION_ROW
          components: event.message.content.buttons.map((btn) => ({
            type: 2, // BUTTON
            style: 5, // LINK
            label: btn.label,
            url: btn.url,
          })),
        },
      ];
    }

    return message;
  }

  private normalizeInboundMessage(msg: any, channelId: string): InboundEvent {
    const threadKey = this.hashPayload(`${this.config.tenant_id}:discord:${channelId}`);
    
    // Simple intent detection
    const text = msg.content?.toLowerCase() || "";
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
        name: "discord",
        environment: this.config.environment,
      },
      thread: {
        provider_thread_id: channelId,
        provider_channel_id: channelId,
        thread_key: threadKey,
        qt_thread_id: `qt://${this.config.tenant_id}/threads/discord/${channelId}`,
      },
      message: {
        provider_message_id: msg.id,
        sent_ts: msg.timestamp,
        sender: {
          provider_user_id: msg.author?.id || "unknown",
          display_name: msg.author?.username,
        },
        content: {
          type: "text",
          text: msg.content,
          attachments: msg.attachments?.map((att: any) => ({
            name: att.filename,
            mime: att.content_type,
            url: att.url,
          })),
        },
      },
      routing: {
        target_agent: "router", // Let router decide
        intent_hint,
      },
      security: {
        data_classification: "internal",
        receipt_required: true,
        redaction_required: false,
      },
    };
  }

  private async fetchRecentMessages(channelId: string): Promise<any[]> {
    if (!this.config.credentials.bot_token) {
      throw new Error("Discord inbound polling requires bot token credentials");
    }

    const result = await this.fetchDiscord(`/channels/${channelId}/messages?limit=10`, {
      headers: this.authHeaders(),
    });

    if (!result.ok) {
      throw new Error(`Failed to fetch messages: ${result.data?.message}`);
    }

    return Array.isArray(result.data) ? result.data : [];
  }

  private async fetchDiscord(
    path: string,
    init?: RequestInit
  ): Promise<{ ok: boolean; status: number; data: any }> {
    const url = path.startsWith("http") ? path : `${DISCORD_API_BASE}${path}`;
    const res = await fetch(url, { ...init });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  private authHeaders(): Record<string, string> {
    if (!this.config.credentials.bot_token) {
      return {};
    }
    return {
      Authorization: `Bot ${this.config.credentials.bot_token}`,
    };
  }
}
