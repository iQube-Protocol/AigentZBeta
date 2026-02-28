#!/usr/bin/env tsx

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDVNReceiptService } from "../bridge-core/dvnReceiptService";
import {
  parseInboundEventFromMessage,
  QubeTalkHttpClient,
  type AgentReference,
} from "../bridge-core/qubetalkHttpClient";
import { OpenClawWorker } from "../openclaw-wrapper/openclawWorker";
import { RouterService } from "../router/routerService";
import {
  loadRuntimeChannelMap,
  loadRuntimeCursor,
  messageCursor,
  saveRuntimeCursor,
} from "./runtimeChannelMap";
import { loadEnv } from "./loadEnv";
import { assertMoltComicsConfig, resolveMoltComicsConfig } from "./moltcomicsConfig";

loadEnv();

interface RuntimeArgs {
  once: boolean;
  pollMs: number;
}

function parseCSV(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const ROUTER_AGENT: AgentReference = {
  id: "aigent_z_router",
  role: "tenant",
  name: "Aigent Z Router",
};

const OPENCLAW_AGENT: AgentReference = {
  id: "openclaw_group_agent",
  role: "tenant",
  name: "OpenClaw Group Agent",
};

function parseArgs(argv: string[]): RuntimeArgs {
  let once = false;
  let pollMs = 4000;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--once") {
      once = true;
      continue;
    }
    if (token === "--poll-ms" && argv[index + 1]) {
      pollMs = Number(argv[index + 1]) || pollMs;
      index += 1;
    }
  }
  return { once, pollMs };
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const baseDir = process.cwd();
  const tenantId = process.env.QT_TENANT_ID || "tnt_clawhack";
  const workspace = process.env.QT_CHANNEL_MAIN || "clawhack";
  const environment = process.env.ENVIRONMENT || "hackathon";
  const moltComicsConfig = resolveMoltComicsConfig(process.env);
  assertMoltComicsConfig(moltComicsConfig);
  const channelMap = await loadRuntimeChannelMap(baseDir);
  if (!channelMap) {
    throw new Error(
      "Missing channel IDs. Run `npm run init-channels` or set QT_CHANNEL_*_ID env vars."
    );
  }

  const qubetalkClient = new QubeTalkHttpClient({
    baseUrl: process.env.QUBETALK_API_ENDPOINT || "http://localhost:3000/api/qubetalk",
    tenantId,
    authToken: process.env.QUBETALK_AUTH_TOKEN || "",
  });
  const dvnService = createDVNReceiptService();
  const router = new RouterService();
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
    xmtpGroupId: parseCSV(process.env.XMTP_GROUP_ID_ALLOWLIST)[0] || "",
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
      `[group-runtime] non-strict registry precheck warning: ${error?.message || "unknown error"}`
    );
  }

  console.log("[group-runtime] started");
  console.log(`[group-runtime] tenant=${tenantId}`);
  console.log(`[group-runtime] moltcomics_enabled=${moltComicsConfig.enabled}`);
  if (registrySnapshot) {
    console.log(
      `[group-runtime] registry=${registrySnapshot.source} requiredTools=${requiredTools.join(",")}`
    );
  }
  console.log(`[group-runtime] channels=${JSON.stringify(channelMap)}`);

  const cursorName = "group-runtime-bridge-inbound";
  let since: string | undefined =
    process.env.RUNTIME_SINCE_TS ||
    (await loadRuntimeCursor(baseDir, cursorName)) ||
    new Date().toISOString();
  const processed = new Set<string>();
  const processedQueue: string[] = [];
  const maxProcessed = 5000;
  let keepRunning = true;

  const shutdown = async (): Promise<void> => {
    keepRunning = false;
    await dvnService.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  while (keepRunning) {
    const messages = await qubetalkClient.listMessages(channelMap.bridgeInbound, {
      since,
      limit: 100,
    });
    const nextSince = messageCursor(messages, since);
    if (nextSince && nextSince !== since) {
      since = nextSince;
      await saveRuntimeCursor(baseDir, cursorName, nextSince);
    }

    for (const message of messages) {
      if (processed.has(message.message_id)) {
        continue;
      }
      processed.add(message.message_id);
      processedQueue.push(message.message_id);
      if (processedQueue.length > maxProcessed) {
        const oldest = processedQueue.shift();
        if (oldest) {
          processed.delete(oldest);
        }
      }

      const inbound = parseInboundEventFromMessage(message);
      if (!inbound) {
        continue;
      }

      const decision = router.route(inbound);
      try {
        await qubetalkClient.sendMessage({
          channelId: channelMap.router,
          fromAgent: ROUTER_AGENT,
          type: "system",
          content: JSON.stringify({
            event: "router.decision",
            reason: decision.reason,
            intent: decision.intent,
            target_agent: decision.targetAgent,
            request_preview: inbound.message.content.text,
            provider_message_id: inbound.message.provider_message_id,
          }),
        });

        if (decision.targetAgent !== "openclaw_group_agent") {
          continue;
        }

        await qubetalkClient.sendMessage({
          channelId: channelMap.openclawRequests,
          fromAgent: ROUTER_AGENT,
          type: "request",
          content: JSON.stringify({
            event: "openclaw.request",
            inbound: decision.inbound,
          }),
        });

        const result = await worker.handleInboundEvent(decision.inbound);

        await qubetalkClient.sendMessage({
          channelId: channelMap.openclawResponses,
          fromAgent: OPENCLAW_AGENT,
          type: "response",
          content: JSON.stringify({
            event: "openclaw.response",
            request_id: result.requestId,
            registry_source: result.registrySource,
            artifact_count: result.artifacts.length,
            outbound_count: result.outboundEvents.length,
            conversation_qube_id: result.conversationQube.conversation_qube_id,
            artifacts: result.artifacts.map((artifact) => ({
              iqube_id: artifact.iqube_id,
              label: artifact.label,
              type: artifact.type,
            })),
          }),
          iqubeRefs: result.artifacts.map((artifact) => artifact.iqube_id),
        });

        for (const artifact of result.artifacts) {
          await qubetalkClient.sendMessage({
            channelId: channelMap.artifactsMinted,
            fromAgent: OPENCLAW_AGENT,
            type: "event",
            content: JSON.stringify({
              event: "artifact.minted",
              request_id: result.requestId,
              iqube_id: artifact.iqube_id,
              label: artifact.label,
              type: artifact.type,
            }),
            iqubeRefs: [artifact.iqube_id],
          });
        }

        for (const outbound of result.outboundEvents) {
          await qubetalkClient.sendOutboundEvent(
            channelMap.bridgeOutbound,
            outbound,
            OPENCLAW_AGENT,
            (outbound.audit.artifacts ?? []).map((artifact) => artifact.iqube_id)
          );
        }

        await qubetalkClient.sendMessage({
          channelId: channelMap.main,
          fromAgent: OPENCLAW_AGENT,
          type: "system",
          content: `Completed ${result.requestId} for "${decision.intent}" with ${result.artifacts.length} artifacts.`,
          iqubeRefs: result.artifacts.map((artifact) => artifact.iqube_id),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[group-runtime] message processing failed:", errorMessage);
        await qubetalkClient.sendMessage({
          channelId: channelMap.main,
          fromAgent: OPENCLAW_AGENT,
          type: "error",
          content: `Failed to process message ${inbound.message.provider_message_id}: ${errorMessage}`,
        });
      }
    }

    if (args.once) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, args.pollMs));
  }

  await dvnService.flush();
  await dvnService.stop();
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "");

if (isMain) {
  run().catch((error) => {
    console.error("[group-runtime] fatal:", error);
    process.exit(1);
  });
}
