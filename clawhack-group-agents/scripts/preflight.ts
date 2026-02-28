#!/usr/bin/env tsx

import { OpenClawWorker } from "../openclaw-wrapper/openclawWorker";
import { loadEnv } from "./loadEnv";

loadEnv();

function parseCSV(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function run(): Promise<void> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const environment = process.env.ENVIRONMENT || "hackathon";
  const xmtpSimulationMode = process.env.XMTP_SIMULATION_MODE !== "false";
  const discordBotToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();

  if (!discordBotToken && !discordWebhookUrl) {
    errors.push("Set DISCORD_BOT_TOKEN or DISCORD_WEBHOOK_URL.");
  }

  if (!xmtpSimulationMode) {
    if (!process.env.XMTP_WALLET_PRIVATE_KEY?.trim()) {
      errors.push("Set XMTP_WALLET_PRIVATE_KEY when XMTP_SIMULATION_MODE=false.");
    }
    if (environment === "prod" && !process.env.XMTP_DB_ENCRYPTION_KEY?.trim()) {
      errors.push("Set XMTP_DB_ENCRYPTION_KEY in prod when XMTP_SIMULATION_MODE=false.");
    }
    try {
      const moduleName = "@xmtp/node-sdk";
      await import(moduleName);
    } catch (error: any) {
      errors.push(
        `Unable to import @xmtp/node-sdk (${error?.message || "unknown"}). Install clawhack-group-agents dependencies.`
      );
    }
  }

  const tenantId = process.env.QT_TENANT_ID || "tnt_clawhack";
  const workspace = process.env.QT_CHANNEL_MAIN || "clawhack";
  const requiredTools = parseCSV(
    process.env.OPENCLAW_REQUIRED_TOOLS || "knyt.comic.generate_pack,dpr.run"
  );
  const requireRemoteRegistry =
    process.env.OPENCLAW_REQUIRE_REMOTE_REGISTRY === "true" ||
    (environment === "prod" && process.env.OPENCLAW_REQUIRE_REMOTE_REGISTRY !== "false");
  const strictRequiredTools =
    process.env.OPENCLAW_REQUIRED_TOOLS_STRICT === "true" ||
    ((environment === "prod" || process.env.NODE_ENV === "production") &&
      process.env.OPENCLAW_REQUIRED_TOOLS_STRICT !== "false");

  const worker = new OpenClawWorker({
    tenantId,
    workspace,
    registryEndpoint: process.env.MCP_REGISTRY_ENDPOINT || "http://localhost:8080/registry",
    shelfId: process.env.MCP_SHELF_ID || "shelf_clawhack_2026_group_agents",
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
  });

  try {
    const snapshot = await worker.assertRegistryReady({
      requiredToolIds: requiredTools,
      requireRemote: requireRemoteRegistry,
    });
    console.log(
      `[preflight] registry ready source=${snapshot.source} requiredTools=${requiredTools.join(",")}`
    );
  } catch (error: any) {
    const message = `Registry preflight failed: ${error?.message || "unknown error"}`;
    if (strictRequiredTools) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  if (warnings.length > 0) {
    console.warn("[preflight] WARNINGS");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("[preflight] FAILED");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("[preflight] PASSED");
}

run().catch((error) => {
  console.error("[preflight] fatal:", error);
  process.exit(1);
});
