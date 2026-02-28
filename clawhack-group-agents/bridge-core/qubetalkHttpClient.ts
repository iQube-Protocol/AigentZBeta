import type { InboundEvent, OutboundEvent } from "../schemas/bridgeEvents";

export interface AgentReference {
  id: string;
  role: "system" | "tenant" | "external";
  name: string;
}

export interface QubeTalkChannelRecord {
  channel_id: string;
  tenant_id: string;
  participants: string[];
  created_at: string;
  updated_at: string;
}

export interface QubeTalkMessageRecord {
  message_id: string;
  channel_id: string;
  in_reply_to?: string;
  from_agent: AgentReference;
  type: "request" | "response" | "event" | "error" | "text" | "delegation" | "system" | "receipt";
  content: string;
  created_at: string;
  iqube_refs?: string[];
  receipt_ref?: string;
  metadata?: Record<string, unknown>;
}

export interface QubeTalkClientConfig {
  baseUrl: string;
  tenantId: string;
  authToken?: string;
  defaultParticipants?: string[];
}

interface ChannelListResponse {
  success: boolean;
  channels: QubeTalkChannelRecord[];
}

interface MessageListResponse {
  messages: QubeTalkMessageRecord[];
}

function withTrailingSlashRemoved(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export class QubeTalkHttpClient {
  private readonly config: Required<QubeTalkClientConfig>;

  constructor(config: QubeTalkClientConfig) {
    this.config = {
      authToken: "",
      defaultParticipants: [],
      ...config,
      baseUrl: withTrailingSlashRemoved(config.baseUrl),
    };
  }

  async listChannels(): Promise<QubeTalkChannelRecord[]> {
    const url = `${this.config.baseUrl}/channels?tenant_id=${encodeURIComponent(this.config.tenantId)}&limit=250`;
    const response = await this.fetchJSON<ChannelListResponse>(url, { method: "GET" });
    if (!response?.success || !Array.isArray(response.channels)) {
      return [];
    }
    return response.channels;
  }

  async findChannelByMarker(marker: string): Promise<QubeTalkChannelRecord | null> {
    const channels = await this.listChannels();
    return channels.find((channel) => channel.participants.includes(marker)) ?? null;
  }

  async createChannel(participants: string[], displayName?: string): Promise<QubeTalkChannelRecord> {
    const uniqueParticipants = Array.from(
      new Set([...this.config.defaultParticipants, ...participants].filter(Boolean))
    );
    const payload = {
      tenant_id: this.config.tenantId,
      participants: uniqueParticipants,
      created_by: "clawhack-bootstrap",
      created_by_name: "ClawHack Bootstrap",
      ...(displayName && { display_name: displayName }),
    };

    const response = await this.fetchJSON<{ success: boolean; channel: QubeTalkChannelRecord }>(
      `${this.config.baseUrl}/channels`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    if (!response?.success || !response.channel) {
      throw new Error("Failed to create QubeTalk channel");
    }
    return response.channel;
  }

  async sendMessage(input: {
    channelId: string;
    fromAgent: AgentReference;
    type: QubeTalkMessageRecord["type"];
    content: string;
    metadata?: Record<string, unknown>;
    inReplyTo?: string;
    iqubeRefs?: string[];
    receiptRef?: string;
  }): Promise<QubeTalkMessageRecord> {
    const payload = {
      tenant_id: this.config.tenantId,
      channel_id: input.channelId,
      from_agent: input.fromAgent,
      type: input.type,
      content: input.content,
      metadata: input.metadata,
      in_reply_to: input.inReplyTo,
      iqube_refs: input.iqubeRefs,
      receipt_ref: input.receiptRef,
    };

    const response = await this.fetchJSON<QubeTalkMessageRecord>(
      `${this.config.baseUrl}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    if (!response?.message_id) {
      throw new Error(`Failed to send QubeTalk message to ${input.channelId}`);
    }

    return response;
  }

  async listMessages(
    channelId: string,
    options: { since?: string; limit?: number } = {}
  ): Promise<QubeTalkMessageRecord[]> {
    const limit = options.limit ?? 100;
    const query = new URLSearchParams({
      tenant_id: this.config.tenantId,
      limit: String(limit),
    });
    if (options.since) {
      query.set("since", options.since);
    }

    const url = `${this.config.baseUrl}/channels/${encodeURIComponent(channelId)}/messages?${query.toString()}`;
    const response = await this.fetchJSON<MessageListResponse>(url, { method: "GET" });
    if (!response || !Array.isArray(response.messages)) {
      return [];
    }
    return response.messages;
  }

  async sendInboundEvent(channelId: string, event: InboundEvent, fromAgent: AgentReference): Promise<void> {
    await this.sendMessage({
      channelId,
      fromAgent,
      type: "event",
      content: JSON.stringify(event),
      metadata: {
        schema: event.schema,
        thread_key: event.thread.thread_key,
      },
    });
  }

  async sendOutboundEvent(
    channelId: string,
    event: OutboundEvent,
    fromAgent: AgentReference,
    refs: string[] = []
  ): Promise<void> {
    await this.sendMessage({
      channelId,
      fromAgent,
      type: "event",
      content: JSON.stringify(event),
      iqubeRefs: refs,
      metadata: {
        schema: event.schema,
        request_id: event.audit.request_id,
      },
    });
  }

  private async fetchJSON<T>(url: string, init: RequestInit): Promise<T | null> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.config.authToken) {
        headers.Authorization = `Bearer ${this.config.authToken}`;
      }

      const response = await fetch(url, {
        ...init,
        headers: {
          ...headers,
          ...(init.headers ?? {}),
        },
      });

      const body = (await response.json().catch(() => null)) as T | null;
      if (!response.ok) {
        return null;
      }
      return body;
    } catch {
      return null;
    }
  }
}

export function parseInboundEventFromMessage(message: QubeTalkMessageRecord): InboundEvent | null {
  try {
    const parsed = JSON.parse(message.content) as InboundEvent;
    if (parsed?.schema === "metame.bridge.inbound.v0") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseOutboundEventFromMessage(message: QubeTalkMessageRecord): OutboundEvent | null {
  try {
    const parsed = JSON.parse(message.content) as OutboundEvent;
    if (parsed?.schema === "metame.bridge.outbound.v0") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function channelMapFromRecords(
  channels: QubeTalkChannelRecord[],
  markersByLogicalName: Record<string, string>
): Record<string, string> {
  const entries = Object.entries(markersByLogicalName).map(([logicalName, marker]) => {
    const channel = channels.find((record) => record.participants.includes(marker));
    return channel ? [logicalName, channel.channel_id] : null;
  });
  return Object.fromEntries(entries.filter(isNotNull));
}
