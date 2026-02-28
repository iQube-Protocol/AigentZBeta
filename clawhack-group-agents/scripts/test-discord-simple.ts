#!/usr/bin/env tsx
/**
 * Simple Discord Integration Test
 * Tests Discord bot connectivity and message posting
 */

import { DiscordAdapter } from "../adapters/discord/discordAdapter";
import { DVNReceiptService } from "../bridge-core/dvnReceiptService";
import type { OutboundEvent } from "../schemas/bridgeEvents";

async function testDiscord() {
  console.log("🧪 Testing Discord Integration\n");

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_METAKNYTS_CHANNEL_ID;

  if (!botToken || !channelId) {
    console.error("❌ Missing DISCORD_BOT_TOKEN or DISCORD_METAKNYTS_CHANNEL_ID");
    process.exit(1);
  }

  console.log(`Bot Token: ${botToken.substring(0, 20)}...`);
  console.log(`Channel ID: ${channelId}\n`);

  const dvnService = new DVNReceiptService({
    endpoint: process.env.DVN_ENDPOINT || "qt://tnt_clawhack/clawhack/dvn/receipts",
    mode:
      (process.env.DVN_ENDPOINT || "").startsWith("qt://") || !process.env.DVN_ENDPOINT
        ? "qubetalk"
        : "http",
    tenant_id: "tnt_clawhack",
  });

  const adapter = new DiscordAdapter({
    provider: "discord",
    credentials: {
      bot_token: botToken,
    },
    allowlist: {
      channel_ids: [channelId],
    },
    surface_planner_endpoint: process.env.SURFACE_PLANNER_ENDPOINT,
    environment: "hackathon",
    tenant_id: "tnt_clawhack",
  });

  adapter.setReceiptEmitter(async (receipt) => {
    await dvnService.emit(receipt);
  });

  try {
    console.log("⏳ Starting Discord adapter...");
    await adapter.start();
    console.log("✅ Discord adapter started successfully!\n");

    console.log("⏳ Posting test message to Discord...");
    const outboundEvent: OutboundEvent = {
      schema: "metame.bridge.outbound.v0",
      tenant_id: "tnt_clawhack",
      provider: {
        name: "discord",
      },
      thread: {
        provider_thread_id: channelId,
        provider_channel_id: channelId,
      },
      message: {
        content: {
          text: "🧪 **ClawHack Test Message**\n\nThis is a test from the ClawHack Group Agents bridge system.\n\nTimestamp: " + new Date().toISOString(),
          format: "markdown",
        },
      },
      audit: {
        request_id: `test_${Date.now()}`,
        artifacts: [],
      },
      security: {
        data_classification: "internal",
        receipt_required: true,
      },
    };

    const result = await adapter.publish(outboundEvent);
    
    if (result.success) {
      console.log(`✅ Message posted successfully!`);
      console.log(`   Message ID: ${result.provider_message_id}`);
      console.log(`\n✨ Check Discord channel to see the message!`);
    } else {
      console.error(`❌ Failed to post message: ${result.error}`);
      process.exit(1);
    }

    await adapter.stop();
    await dvnService.stop();

    console.log("\n✅ Test completed successfully!");
  } catch (error: any) {
    console.error(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

testDiscord();
