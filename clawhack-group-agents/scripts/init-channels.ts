#!/usr/bin/env tsx
/**
 * QubeTalk Channel Initialization Script
 *
 * Creates/verifies channels for ClawHack Group Agents workspace and
 * persists logical-name -> channel_id map to .data/channel-map.json.
 */

import { QubeTalkChannels } from "../bridge-core/qubetalkChannels";
import { QubeTalkHttpClient, channelMapFromRecords } from "../bridge-core/qubetalkHttpClient";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

interface ChannelMetadata {
  logical_name: string;
  display_name: string;
  topic: string;
  description: string;
  marker: string;
  retention_days?: number;
  max_message_size_kb?: number;
  allowed_publishers?: string[];
  allowed_subscribers?: string[];
}

interface RuntimeChannelMap {
  main: string;
  bridgeInbound: string;
  bridgeOutbound: string;
  openclawRequests: string;
  openclawResponses: string;
  router: string;
}

const TENANT_ID = process.env.QT_TENANT_ID || "tnt_clawhack";
const WORKSPACE = process.env.QT_CHANNEL_MAIN || "clawhack";
const QUBETALK_ENDPOINT = process.env.QUBETALK_API_ENDPOINT || "http://localhost:3000/api/qubetalk";

const BASE_PARTICIPANTS = [
  "openclaw_group_agent",
  "aigent_z_router",
  "windsurf_cascade",
  "openai_codex",
  "lovable_runtime",
  "dvn_receipt_service",
  "bridge_adapter_xmtp",
  "bridge_adapter_discord",
  "external",
];

async function initializeChannels() {
  console.log("🚀 Initializing QubeTalk channels for ClawHack Group Agents...\n");

  const channels = new QubeTalkChannels({
    tenant_id: TENANT_ID,
    workspace: WORKSPACE,
  });
  const client = new QubeTalkHttpClient({
    baseUrl: QUBETALK_ENDPOINT,
    tenantId: TENANT_ID,
    authToken: process.env.QUBETALK_AUTH_TOKEN || "",
    defaultParticipants: BASE_PARTICIPANTS,
  });

  const channelConfigs: ChannelMetadata[] = [
    {
      logical_name: "main",
      display_name: "🏠 Group Agents Main",
      topic: channels.main,
      description: "Main group channel where all agents participate",
      marker: "topic:group_agents_main",
      retention_days: 30,
      max_message_size_kb: 512,
    },
    {
      logical_name: "bridgeInbound",
      display_name: "📥 Bridge Inbound",
      topic: channels.bridgeInbound,
      description: "Normalized messages from external chat surfaces (XMTP, Discord, etc.)",
      marker: "topic:bridge_inbound",
      retention_days: 7,
      max_message_size_kb: 256,
      allowed_publishers: ["bridge_adapter_xmtp", "bridge_adapter_discord"],
    },
    {
      logical_name: "bridgeOutbound",
      display_name: "📤 Bridge Outbound",
      topic: channels.bridgeOutbound,
      description: "Messages to be published to external chat surfaces",
      marker: "topic:bridge_outbound",
      retention_days: 7,
      max_message_size_kb: 256,
      allowed_subscribers: ["bridge_adapter_xmtp", "bridge_adapter_discord"],
    },
    {
      logical_name: "openclawRequests",
      display_name: "🤖 OpenClaw Requests",
      topic: channels.openclawRequests,
      description: "OpenClaw agent job requests",
      marker: "topic:openclaw_requests",
      retention_days: 14,
      max_message_size_kb: 512,
    },
    {
      logical_name: "openclawResponses",
      display_name: "✅ OpenClaw Responses",
      topic: channels.openclawResponses,
      description: "OpenClaw agent job responses",
      marker: "topic:openclaw_responses",
      retention_days: 14,
      max_message_size_kb: 1024,
    },
    {
      logical_name: "dvnReceipts",
      display_name: "📋 DVN Receipts",
      topic: channels.dvnReceipts,
      description: "DVN receipts for audit trail (all bridge/tool/artifact events)",
      marker: "topic:dvn_receipts",
      retention_days: 90,
      max_message_size_kb: 128,
    },
    {
      logical_name: "artifactsMinted",
      display_name: "📦 Artifacts Minted",
      topic: channels.artifactsMinted,
      description: "Artifact creation and versioning events",
      marker: "topic:artifacts_minted",
      retention_days: 30,
      max_message_size_kb: 256,
    },
    {
      logical_name: "router",
      display_name: "🧭 Router Coordination",
      topic: channels.router,
      description: "Router coordination and intent detection",
      marker: "topic:router_coordination",
      retention_days: 7,
      max_message_size_kb: 128,
    },
  ];

  console.log(`Tenant: ${TENANT_ID}`);
  console.log(`Workspace: ${WORKSPACE}\n`);

  const existing = await client.listChannels();
  const markerMap = Object.fromEntries(channelConfigs.map((config) => [config.logical_name, config.marker]));

  const logicalToChannelId: Record<string, string> = {};

  for (const config of channelConfigs) {
    try {
      const existingChannel =
        existing.find((record) => record.participants.includes(config.marker)) ??
        (await client.findChannelByMarker(config.marker));

      const channel =
        existingChannel ??
        (await client.createChannel(
          [
            ...BASE_PARTICIPANTS,
            config.marker,
            `workspace:${WORKSPACE}`,
            `logical:${config.logical_name}`,
          ],
          config.display_name
        ));

      logicalToChannelId[config.logical_name] = channel.channel_id;

      console.log(`✅ ${config.display_name}`);
      console.log(`   ${config.description}`);
      console.log(`   Channel ID: ${channel.channel_id}`);
      console.log(`   Topic: ${config.topic}`);
      if (config.retention_days) {
        console.log(`   Retention: ${config.retention_days} days`);
      }
      console.log();
    } catch (error: any) {
      console.error(`❌ Failed to create ${config.topic}: ${error.message}\n`);
    }
  }

  const recoveredFromMarkers = channelMapFromRecords(await client.listChannels(), markerMap);
  const mapPayload = {
    tenant_id: TENANT_ID,
    workspace: WORKSPACE,
    generated_at: new Date().toISOString(),
    channels: {
      ...recoveredFromMarkers,
      ...logicalToChannelId,
    },
  };
  const requiredKeys: Array<keyof RuntimeChannelMap> = [
    "main",
    "bridgeInbound",
    "bridgeOutbound",
    "openclawRequests",
    "openclawResponses",
    "router",
  ];
  const missing = requiredKeys.filter((key) => !mapPayload.channels[key]);
  if (missing.length > 0) {
    throw new Error(
      `Channel initialization incomplete; missing channel IDs for: ${missing.join(", ")}`
    );
  }
  const mapPath = path.join(process.cwd(), ".data", "channel-map.json");
  await mkdir(path.dirname(mapPath), { recursive: true });
  await writeFile(mapPath, JSON.stringify(mapPayload.channels, null, 2), "utf8");

  console.log("✨ Channel initialization complete!\n");
  console.log(`Saved channel map: ${mapPath}\n`);
  console.log("Next steps:");
  console.log("1. Start adapters: npm run adapter:discord && npm run adapter:xmtp");
  console.log("2. Start runtime: npm run runtime:group");
  console.log("3. Monitor DVN receipts in Composer Studio\n");
}

// Run if executed directly
const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "");

if (isMain) {
  initializeChannels().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { initializeChannels };
