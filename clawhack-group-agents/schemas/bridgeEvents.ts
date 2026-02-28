import type { MetaMeRuntimeEnvelope } from "./metameEnvelope";

/**
 * Canonical Bridge Event Schemas for ClawHack Group Agents
 * 
 * These schemas define the standard message format for XMTP/Discord/other
 * chat surfaces to integrate with QubeTalk + OpenClaw + DVN receipts.
 */

export type BridgeProvider = "xmtp" | "discord" | "whatsapp" | "telegram" | "email" | "sms";
export type A2UIRegion = "primary" | "secondary" | "footer" | "header" | "sidebar" | "canvas";
export type DataClassification = "public" | "internal" | "confidential" | "restricted";
export type IntentHint = "create_drop" | "summarize" | "help" | "unknown";

/**
 * InboundEvent: Normalized message from external chat surface → QubeTalk
 */
export interface InboundEvent {
  schema: "metame.bridge.inbound.v0";
  tenant_id: string;
  provider: {
    name: BridgeProvider;
    account_id?: string;
    environment: "hackathon" | "dev" | "prod";
  };
  thread: {
    provider_thread_id: string;
    provider_channel_id?: string;
    thread_key: string; // hash(tenant + provider + provider_thread_id)
    qt_thread_id: string; // qt://{tenant}/threads/{provider}/{provider_thread_id}
  };
  message: {
    provider_message_id: string;
    sent_ts: string; // ISO-8601
    sender: {
      provider_user_id: string;
      display_name?: string;
      identity?: {
        xmtp_inbox_id?: string;
        wallet?: string;
        email?: string;
      };
    };
    content: {
      type: "text" | "command" | "attachment";
      text?: string;
      metame_envelope?: MetaMeRuntimeEnvelope;
      attachments?: Array<{
        name: string;
        mime: string;
        url?: string;
        bytes_b64?: string;
      }>;
    };
  };
  routing: {
    target_agent: string; // "openclaw_group_agent" | "aigent_marketa" | "router"
    intent_hint: IntentHint;
  };
  security: {
    data_classification: DataClassification;
    receipt_required: boolean;
    redaction_required: boolean;
  };
}

/**
 * OutboundEvent: QubeTalk → external chat surface
 */
export interface OutboundEvent {
  schema: "metame.bridge.outbound.v0";
  tenant_id: string;
  provider: {
    name: BridgeProvider;
    account_id?: string;
  };
  thread: {
    provider_thread_id: string;
    provider_channel_id?: string;
  };
  message: {
    in_reply_to_provider_message_id?: string;
    content: {
      text: string;
      format: "plain" | "markdown";
      metame_envelope?: MetaMeRuntimeEnvelope;
      attachments?: Array<{
        name: string;
        mime: string;
        url: string;
      }>;
      buttons?: Array<{
        label: string;
        url: string;
      }>;
    };
  };
  audit: {
    request_id: string;
    artifacts?: Array<{
      iqube_id: string;
      label: string;
    }>;
  };
  security: {
    data_classification: DataClassification;
    receipt_required: boolean;
  };
}

/**
 * DVN Receipt Types
 */
export interface DVNReceipt {
  schema: "metame.dvn.receipt.v0";
  receipt_id: string;
  tenant_id: string;
  timestamp: string; // ISO-8601
  receipt_type: DVNReceiptType;
  payload: DVNReceiptPayload;
}

export type DVNReceiptType =
  | "bridge.inbound_received"
  | "bridge.outbound_posted"
  | "tool.invoked"
  | "artifact.minted"
  | "artifact.versioned"
  | "capsule.published";

export interface DVNReceiptPayload {
  // Common fields
  thread_key?: string;
  request_id?: string;
  
  // Bridge-specific
  provider?: BridgeProvider;
  provider_thread_id?: string;
  provider_message_id?: string;
  payload_hash?: string;
  
  // Tool-specific
  tool_id?: string;
  args_hash?: string;
  result_hash?: string;
  
  // Artifact-specific
  iqube_id?: string;
  artifact_type?: string;
  content_hash?: string;
  version?: number;
  
  // Capsule-specific
  capsule_id?: string;
  surface_plan_id?: string;
  publish_target?: string; // "discord" | "xmtp" | etc.
}

/**
 * ConversationQube Schema (thread-scoped durable state)
 */
export interface ConversationQube {
  schema: "metame.iqube.conversation.v0";
  conversation_qube_id: string;
  tenant_id: string;
  bindings: {
    protocol: "xmtp" | "discord" | "other";
    group_id: string;
    qt_thread_id: string;
  };
  policy: {
    scope: "thread_only";
    allowed_agents: string[];
    allowed_tools: string[];
    memory_rules: {
      store_raw_messages: boolean;
      store_summary: boolean;
      summary_ttl_days: number;
      artifact_refs_only: boolean;
    };
  };
  cursor: {
    last_processed_message_id?: string;
    last_processed_ts?: string;
  };
  memory: {
    rolling_summary: string;
    key_facts: string[];
    open_tasks: Array<{
      task_id: string;
      title: string;
      status: "open" | "done";
    }>;
  };
  artifacts: Array<{
    iqube_id: string;
    type: "ContentQube" | "MediaQube";
    label: string;
    created_ts: string;
    provenance: {
      request_id: string;
      toolchain: string[];
    };
  }>;
  versions: {
    current: number;
    history: Array<{
      version: number;
      hash: string;
      ts: string;
    }>;
  };
}

/**
 * Discord Capsule Payload (routed through A2UI/Surface Planner)
 */
export interface DiscordCapsulePayload {
  schema: "metame.discord.capsule.v0";
  capsule_id: string;
  surface_plan_id?: string; // from Surface Planner
  level: "pill" | "capsule" | "full";
  content: {
    text: string;
    format: "plain" | "markdown";
    embeds?: Array<{
      title?: string;
      description?: string;
      url?: string;
      color?: number;
      thumbnail?: { url: string };
      image?: { url: string };
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
    }>;
    components?: Array<{
      type: 1; // ACTION_ROW
      components: Array<{
        type: 2; // BUTTON
        style: 1 | 2 | 3 | 4 | 5; // Primary, Secondary, Success, Danger, Link
        label: string;
        url?: string;
        custom_id?: string;
      }>;
    }>;
  };
  artifacts?: Array<{
    iqube_id: string;
    label: string;
    url?: string;
  }>;
  provenance: {
    request_id: string;
    generated_by: string;
    generated_ts: string;
  };
}
