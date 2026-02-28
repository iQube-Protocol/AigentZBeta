import { NextRequest, NextResponse } from "next/server";
import {
  createChannel,
  createMessage,
  getAllChannels,
  getChannel,
  type MessageData,
} from "@/services/qubetalk/qubetalkStore";

export const runtime = "nodejs";

const DEFAULT_TENANT_ID = "tnt_clawhack";
const DEFAULT_WORKSPACE = "clawhack";

interface XMTPBridgePayload {
  group_id?: string;
  message?: {
    id?: string;
    sender?: string;
    content?: string;
    timestamp?: string;
  };
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferIntentHint(text: string): "create_drop" | "summarize" | "help" | "unknown" {
  const normalized = text.toLowerCase();
  if (normalized.includes("drop") || normalized.includes("comic") || normalized.includes("make")) {
    return "create_drop";
  }
  if (normalized.includes("summarize") || normalized.includes("summary")) {
    return "summarize";
  }
  if (normalized.includes("help")) {
    return "help";
  }
  return "unknown";
}

async function resolveBridgeInboundChannelId(tenantId: string, workspace: string): Promise<string> {
  const configured = normalizeString(process.env.QT_CHANNEL_BRIDGE_INBOUND_ID);
  if (configured) {
    const channel = await getChannel(configured, tenantId);
    if (channel) {
      return configured;
    }
  }

  const channels = await getAllChannels(tenantId, { limit: 250, offset: 0 });
  const existing =
    channels.find((channel) => channel.participants.includes("topic:bridge_inbound")) ||
    channels.find((channel) => channel.participants.includes("logical:bridgeInbound"));

  if (existing) {
    return existing.channel_id;
  }

  const channelId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const created = await createChannel({
    channel_id: channelId,
    tenant_id: tenantId,
    participants: [
      "openclaw_group_agent",
      "aigent_z_router",
      "bridge_adapter_xmtp",
      "bridge_adapter_discord",
      "external",
      "topic:bridge_inbound",
      `workspace:${workspace}`,
      "logical:bridgeInbound",
    ],
  });
  return created.channel_id;
}

function buildInboundEvent(input: {
  tenantId: string;
  workspace: string;
  groupId: string;
  providerMessageId: string;
  sender: string;
  text: string;
  sentTs: string;
}) {
  return {
    schema: "metame.bridge.inbound.v0",
    tenant_id: input.tenantId,
    provider: {
      name: "xmtp",
      environment: process.env.ENVIRONMENT || "hackathon",
    },
    thread: {
      provider_thread_id: input.groupId,
      thread_key: `thread_xmtp_${input.groupId}`,
      qt_thread_id: `qt://${input.tenantId}/${input.workspace}/threads/xmtp/${input.groupId}`,
    },
    message: {
      provider_message_id: input.providerMessageId,
      sent_ts: input.sentTs,
      sender: {
        provider_user_id: input.sender,
        display_name: input.sender,
        identity: {
          xmtp_inbox_id: input.sender,
        },
      },
      content: {
        type: "text",
        text: input.text,
      },
    },
    routing: {
      target_agent: "openclaw_group_agent",
      intent_hint: inferIntentHint(input.text),
    },
    security: {
      data_classification: "internal",
      receipt_required: true,
      redaction_required: true,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = normalizeString(request.nextUrl.searchParams.get("tenant_id")) || DEFAULT_TENANT_ID;
    const workspace = normalizeString(process.env.QT_CHANNEL_MAIN) || DEFAULT_WORKSPACE;
    const bridgeInboundChannelId = await resolveBridgeInboundChannelId(tenantId, workspace);

    return NextResponse.json({
      success: true,
      endpoint: "/api/mcp/xmtp-bridge",
      ready: true,
      config: {
        tenant_id: tenantId,
        workspace,
        bridge_inbound_channel_id: bridgeInboundChannelId,
        xmtp_simulation_mode: process.env.XMTP_SIMULATION_MODE !== "false",
        xmtp_env: process.env.XMTP_ENV || "dev",
      },
      accepted_payload: {
        group_id: "string",
        message: {
          id: "string",
          sender: "string",
          content: "string",
          timestamp: "ISO-8601",
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        endpoint: "/api/mcp/xmtp-bridge",
        error: error?.message || "Failed to resolve xmtp bridge status.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as XMTPBridgePayload;
    const tenantId = normalizeString(request.nextUrl.searchParams.get("tenant_id")) || DEFAULT_TENANT_ID;
    const workspace = normalizeString(process.env.QT_CHANNEL_MAIN) || DEFAULT_WORKSPACE;

    const groupId = normalizeString(body?.group_id);
    const sender = normalizeString(body?.message?.sender);
    const text = normalizeString(body?.message?.content);
    const sentTsRaw = normalizeString(body?.message?.timestamp);

    if (!groupId) {
      return NextResponse.json({ success: false, error: "group_id is required" }, { status: 400 });
    }
    if (!sender) {
      return NextResponse.json({ success: false, error: "message.sender is required" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ success: false, error: "message.content is required" }, { status: 400 });
    }

    const providerMessageId =
      normalizeString(body?.message?.id) || `msg_xmtp_bridge_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const sentTs = sentTsRaw || new Date().toISOString();
    const inboundEvent = buildInboundEvent({
      tenantId,
      workspace,
      groupId,
      providerMessageId,
      sender,
      text,
      sentTs,
    });

    const bridgeInboundChannelId = await resolveBridgeInboundChannelId(tenantId, workspace);
    const messageRecord: Omit<MessageData, "created_at"> = {
      message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      channel_id: bridgeInboundChannelId,
      from_agent: {
        id: "bridge_adapter_xmtp",
        role: "system",
        name: "XMTP Bridge Adapter",
      },
      type: "system",
      content: JSON.stringify(inboundEvent),
      metadata: {
        schema: inboundEvent.schema,
        thread_key: inboundEvent.thread.thread_key,
        source: "api.mcp.xmtp-bridge",
      },
    };

    const stored = await createMessage(messageRecord);

    return NextResponse.json({
      success: true,
      accepted: true,
      tenant_id: tenantId,
      channel_id: bridgeInboundChannelId,
      message_id: stored.message_id,
      inbound_event: inboundEvent,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process XMTP bridge payload.",
      },
      { status: 500 }
    );
  }
}
