#!/usr/bin/env tsx

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDVNReceiptService } from "../../bridge-core/dvnReceiptService";
import {
  parseOutboundEventFromMessage,
  QubeTalkHttpClient,
  type AgentReference,
} from "../../bridge-core/qubetalkHttpClient";
import {
  loadRuntimeChannelMap,
  loadRuntimeCursor,
  messageCursor,
  saveRuntimeCursor,
} from "../../scripts/runtimeChannelMap";
import { DiscordAdapter } from "./discordAdapter";

const BRIDGE_AGENT: AgentReference = {
  id: "bridge_adapter_discord",
  role: "system",
  name: "Discord Bridge Adapter",
};

async function run(): Promise<void> {
  const baseDir = process.cwd();
  const tenantId = process.env.QT_TENANT_ID || "tnt_clawhack";
  const workspace = process.env.QT_CHANNEL_MAIN || "clawhack";
  const channelMap = await loadRuntimeChannelMap(baseDir);
  if (!channelMap) {
    throw new Error(
      "Missing channel IDs. Run `npm run init-channels` or set QT_CHANNEL_*_ID env vars."
    );
  }
  const channelIds = (process.env.DISCORD_METAKNYTS_CHANNEL_ID || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (channelIds.length === 0) {
    throw new Error("DISCORD_METAKNYTS_CHANNEL_ID is required");
  }

  const adapter = new DiscordAdapter({
    provider: "discord",
    credentials: {
      bot_token: process.env.DISCORD_BOT_TOKEN || "",
    },
    allowlist: {
      channel_ids: channelIds,
    },
    surface_planner_endpoint:
      process.env.SURFACE_PLANNER_ENABLED === "false"
        ? undefined
        : process.env.SURFACE_PLANNER_ENDPOINT,
    environment: (process.env.ENVIRONMENT as "hackathon" | "dev" | "prod") || "hackathon",
    tenant_id: tenantId,
  });
  const dvnService = createDVNReceiptService();
  const qubetalkClient = new QubeTalkHttpClient({
    baseUrl: process.env.QUBETALK_API_ENDPOINT || "http://localhost:3000/api/qubetalk",
    tenantId,
    authToken: process.env.QUBETALK_AUTH_TOKEN || "",
  });

  adapter.setReceiptEmitter(async (receipt) => {
    await dvnService.emit(receipt);
  });

  await adapter.start();
  console.log(
    `[discord-adapter] Listening for inbound events in workspace ${workspace} (${channelIds.join(", ")})`
  );
  console.log(`[discord-adapter] bridgeInbound=${channelMap.bridgeInbound}`);
  console.log(`[discord-adapter] bridgeOutbound=${channelMap.bridgeOutbound}`);

  let keepRunning = true;
  const shutdown = async (): Promise<void> => {
    keepRunning = false;
    console.log("\n[discord-adapter] Shutting down...");
    await adapter.stop();
    await dvnService.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  const inboundLoop = (async () => {
    for await (const event of adapter.ingest()) {
      if (!keepRunning) {
        break;
      }
      const text = event.message.content.text || "<non-text>";
      console.log(
        `[discord-adapter] inbound ${event.message.provider_message_id} thread=${event.thread.provider_thread_id} text=${text}`
      );
      await qubetalkClient.sendInboundEvent(channelMap.bridgeInbound, event, BRIDGE_AGENT);
    }
  })();

  const outboundLoop = (async () => {
    const cursorName = "discord-bridge-outbound";
    let since: string | undefined =
      process.env.RUNTIME_SINCE_TS ||
      (await loadRuntimeCursor(baseDir, cursorName)) ||
      new Date().toISOString();
    const processed = new Set<string>();
    const processedQueue: string[] = [];
    const maxProcessed = 5000;
    const pollMs = Number(process.env.GROUP_RUNTIME_POLL_MS || "4000");

    while (keepRunning) {
      const messages = await qubetalkClient.listMessages(channelMap.bridgeOutbound, {
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

        const outbound = parseOutboundEventFromMessage(message);
        if (!outbound || outbound.provider.name !== "discord") {
          continue;
        }

        const result = await adapter.publish(outbound);
        if (!result.success) {
          console.error(
            `[discord-adapter] outbound publish failed request=${outbound.audit.request_id}: ${result.error}`
          );
          continue;
        }
        console.log(
          `[discord-adapter] outbound posted request=${outbound.audit.request_id} msg=${result.provider_message_id}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  })();

  await Promise.all([inboundLoop, outboundLoop]);
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "");

if (isMain) {
  run().catch((error) => {
    console.error("[discord-adapter] fatal:", error);
    process.exit(1);
  });
}
