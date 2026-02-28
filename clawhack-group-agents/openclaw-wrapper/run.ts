#!/usr/bin/env tsx

import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createDVNReceiptService } from "../bridge-core/dvnReceiptService";
import { QubeTalkChannels } from "../bridge-core/qubetalkChannels";
import type { InboundEvent } from "../schemas/bridgeEvents";
import { OpenClawWorker } from "./openclawWorker";
import { loadEnv } from "../scripts/loadEnv";
import { assertMoltComicsConfig, resolveMoltComicsConfig } from "../scripts/moltcomicsConfig";

loadEnv();

interface CLIArgs {
  inboundFile?: string;
  text?: string;
  provider?: "xmtp" | "discord";
}

function parseCSV(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--inbound-file" && next) {
      args.inboundFile = next;
      index += 1;
      continue;
    }
    if (token === "--text" && next) {
      args.text = next;
      index += 1;
      continue;
    }
    if (token === "--provider" && (next === "xmtp" || next === "discord")) {
      args.provider = next;
      index += 1;
    }
  }
  return args;
}

async function loadInboundEvent(args: CLIArgs): Promise<InboundEvent> {
  if (args.inboundFile) {
    const absolute = path.resolve(process.cwd(), args.inboundFile);
    const raw = await readFile(absolute, "utf8");
    return JSON.parse(raw) as InboundEvent;
  }

  const tenantId = process.env.QT_TENANT_ID || "tnt_clawhack";
  const workspace = process.env.QT_CHANNEL_MAIN || "clawhack";
  const provider = args.provider ?? "xmtp";
  const providerThreadId =
    provider === "xmtp"
      ? process.env.XMTP_GROUP_ID_ALLOWLIST?.split(",")[0] || "group_test"
      : process.env.DISCORD_METAKNYTS_CHANNEL_ID || "1234567890";
  const channels = new QubeTalkChannels({ tenant_id: tenantId, workspace });
  const text = args.text || "Make a 21 Sats comic drop";

  return {
    schema: "metame.bridge.inbound.v0",
    tenant_id: tenantId,
    provider: {
      name: provider,
      environment: "hackathon",
    },
    thread: {
      provider_thread_id: providerThreadId,
      provider_channel_id: provider === "discord" ? providerThreadId : undefined,
      thread_key: `thread_${provider}_${providerThreadId}`,
      qt_thread_id: channels.threadTopic(provider, providerThreadId),
    },
    message: {
      provider_message_id: `msg_${Date.now()}`,
      sent_ts: new Date().toISOString(),
      sender: {
        provider_user_id: "user_demo",
        display_name: "Demo User",
      },
      content: {
        type: "text",
        text,
      },
    },
    routing: {
      target_agent: "openclaw_group_agent",
      intent_hint: text.toLowerCase().includes("summarize") ? "summarize" : "create_drop",
    },
    security: {
      data_classification: "internal",
      receipt_required: true,
      redaction_required: false,
    },
  };
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const tenantId = process.env.QT_TENANT_ID || "tnt_clawhack";
  const workspace = process.env.QT_CHANNEL_MAIN || "clawhack";
  const environment = process.env.ENVIRONMENT || "hackathon";
  const moltComicsConfig = resolveMoltComicsConfig(process.env);
  assertMoltComicsConfig(moltComicsConfig);

  const dvnService = createDVNReceiptService();
  const worker = new OpenClawWorker({
    tenantId,
    workspace,
    registryEndpoint: process.env.MCP_REGISTRY_ENDPOINT || "http://localhost:8080/registry",
    shelfId: process.env.MCP_SHELF_ID || "shelf_clawhack_2026_group_agents",
    moltComicsEnabled: moltComicsConfig.enabled,
    allowlistEnabled: process.env.OPENCLAW_ALLOWLIST_ENABLED !== "false",
    allowStubToolResults:
      process.env.OPENCLAW_ALLOW_STUB_RESULTS !== undefined
        ? process.env.OPENCLAW_ALLOW_STUB_RESULTS === "true"
        : environment !== "prod",
    allowRegistryFallback:
      process.env.OPENCLAW_ALLOW_REGISTRY_FALLBACK !== undefined
        ? process.env.OPENCLAW_ALLOW_REGISTRY_FALLBACK === "true"
        : environment !== "prod",
    mcpTimeoutMs: Number(process.env.OPENCLAW_MCP_TIMEOUT_MS || "12000"),
    discordChannelId: process.env.DISCORD_METAKNYTS_CHANNEL_ID || "",
    dataDir: process.env.OPENCLAW_DATA_DIR || ".data",
    receiptEmitter: async (receipt) => dvnService.emit(receipt),
  });
  const requiredTools = parseCSV(
    process.env.OPENCLAW_REQUIRED_TOOLS || "knyt.comic.generate_pack,dpr.run"
  );
  const requireRemoteRegistry =
    process.env.OPENCLAW_REQUIRE_REMOTE_REGISTRY === "true" ||
    (environment === "prod" &&
      process.env.OPENCLAW_REQUIRE_REMOTE_REGISTRY !== "false");
  const strictRequiredTools =
    process.env.OPENCLAW_REQUIRED_TOOLS_STRICT === "true" ||
    ((environment === "prod" || process.env.NODE_ENV === "production") &&
      process.env.OPENCLAW_REQUIRED_TOOLS_STRICT !== "false");

  let registrySnapshot;
  try {
    registrySnapshot = await worker.assertRegistryReady({
      requiredToolIds: requiredTools,
      requireRemote: requireRemoteRegistry,
    });
  } catch (error: any) {
    if (strictRequiredTools) {
      throw error;
    }
    console.warn(
      `[openclaw-worker] non-strict registry precheck warning: ${error?.message || "unknown error"}`
    );
  }

  const inboundEvent = await loadInboundEvent(args);
  const result = await worker.handleInboundEvent(inboundEvent);
  await dvnService.flush();

  console.log("\nOpenClaw Worker Result");
  console.log("======================");
  console.log(`MoltComics Enabled: ${moltComicsConfig.enabled}`);
  console.log(`Request ID: ${result.requestId}`);
  if (registrySnapshot) {
    console.log(`Registry Ready: source=${registrySnapshot.source}`);
  }
  console.log(`Registry Source: ${result.registrySource}`);
  console.log(`Artifacts Minted: ${result.artifacts.length}`);
  console.log(`Outbound Events: ${result.outboundEvents.length}`);
  console.log(`Receipts Emitted: ${result.receipts.length}`);
  console.log("\nOutbound Event Preview:");
  console.log(JSON.stringify(result.outboundEvents, null, 2));
  console.log("\nArtifact IDs:");
  for (const artifact of result.artifacts) {
    console.log(`- ${artifact.iqube_id} (${artifact.label})`);
  }

  await dvnService.stop();
}

const isMain =
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "");

if (isMain) {
  run().catch((error) => {
    console.error("[openclaw-worker] fatal:", error);
    process.exit(1);
  });
}
