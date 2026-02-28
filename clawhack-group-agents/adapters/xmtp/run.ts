#!/usr/bin/env tsx

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
import { loadEnv } from "../../scripts/loadEnv";
import { XMTPAdapter } from "./xmtpAdapter";

loadEnv();

const BRIDGE_AGENT: AgentReference = {
  id: "bridge_adapter_xmtp",
  role: "system",
  name: "XMTP Bridge Adapter",
};

async function run(): Promise<void> {
  const baseDir = process.cwd();
  const tenantId = process.env.QT_TENANT_ID || "tnt_clawhack";
  const channelMap = await loadRuntimeChannelMap(baseDir);
  if (!channelMap) {
    throw new Error(
      "Missing channel IDs. Run `npm run init-channels` or set QT_CHANNEL_*_ID env vars."
    );
  }
  const groupIds = (process.env.XMTP_GROUP_ID_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (groupIds.length === 0) {
    throw new Error("XMTP_GROUP_ID_ALLOWLIST is required");
  }

  const adapter = new XMTPAdapter({
    provider: "xmtp",
    credentials: {
      wallet_private_key: process.env.XMTP_WALLET_PRIVATE_KEY,
      inbox_id: process.env.XMTP_INBOX_ID,
    },
    allowlist: {
      group_ids: groupIds,
    },
    db_encryption_key: process.env.XMTP_DB_ENCRYPTION_KEY,
    xmtp_env: process.env.XMTP_ENV === "production" ? "production" : "dev",
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
  console.log(`[xmtp-adapter] Listening on groups: ${groupIds.join(", ")}`);
  console.log(`[xmtp-adapter] bridgeInbound=${channelMap.bridgeInbound}`);
  console.log(`[xmtp-adapter] bridgeOutbound=${channelMap.bridgeOutbound}`);

  let keepRunning = true;
  const shutdown = async (): Promise<void> => {
    keepRunning = false;
    console.log("\n[xmtp-adapter] Shutting down...");
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
        `[xmtp-adapter] inbound ${event.message.provider_message_id} group=${event.thread.provider_thread_id} text=${text}`
      );
      await qubetalkClient.sendInboundEvent(channelMap.bridgeInbound, event, BRIDGE_AGENT);
    }
  })();

  const outboundLoop = (async () => {
    const cursorName = "xmtp-bridge-outbound";
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
        if (!outbound || outbound.provider.name !== "xmtp") {
          continue;
        }

        const result = await adapter.publish(outbound);
        if (!result.success) {
          console.error(
            `[xmtp-adapter] outbound publish failed request=${outbound.audit.request_id}: ${result.error}`
          );
          continue;
        }
        console.log(
          `[xmtp-adapter] outbound posted request=${outbound.audit.request_id} msg=${result.provider_message_id}`
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
    console.error("[xmtp-adapter] fatal:", error);
    process.exit(1);
  });
}
