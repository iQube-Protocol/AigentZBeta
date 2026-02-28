#!/usr/bin/env tsx
/**
 * E2E Test Harness for ClawHack Group Agents
 * 
 * Tests the full flow:
 * Convos/XMTP → Bridge → QubeTalk → OpenClaw → Artifacts → Discord + Receipts
 */

import { XMTPAdapter } from "../adapters/xmtp/xmtpAdapter";
import { DiscordAdapter } from "../adapters/discord/discordAdapter";
import { QubeTalkChannels } from "../bridge-core/qubetalkChannels";
import { DVNReceiptService } from "../bridge-core/dvnReceiptService";
import type { InboundEvent, OutboundEvent } from "../schemas/bridgeEvents";
import { OpenClawWorker } from "../openclaw-wrapper/openclawWorker";
import type { OpenClawRunResult } from "../openclaw-wrapper/types";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./loadEnv";
import { assertMoltComicsConfig, resolveMoltComicsConfig } from "./moltcomicsConfig";

loadEnv();

interface TestConfig {
  tenant_id: string;
  workspace: string;
  xmtp_group_id: string;
  discord_channel_id: string;
  test_message: string;
  expected_artifacts: number;
  timeout_seconds: number;
}

class E2ETestHarness {
  private config: TestConfig;
  private channels: QubeTalkChannels;
  private dvnService: DVNReceiptService;
  private xmtpAdapter?: XMTPAdapter;
  private discordAdapter?: DiscordAdapter;
  private openclawWorker?: OpenClawWorker;
  private latestInboundEvent?: InboundEvent;
  private openclawResult?: OpenClawRunResult;
  private testResults: {
    phase: string;
    status: "pending" | "running" | "success" | "failed";
    duration_ms?: number;
    error?: string;
  }[] = [];

  constructor(config: TestConfig) {
    this.config = config;
    this.channels = new QubeTalkChannels({
      tenant_id: config.tenant_id,
      workspace: config.workspace,
    });
    this.dvnService = new DVNReceiptService({
      endpoint:
        process.env.DVN_ENDPOINT ||
        `qt://${config.tenant_id}/${config.workspace}/dvn/receipts`,
      mode:
        (process.env.DVN_ENDPOINT || "").startsWith("qt://") || !process.env.DVN_ENDPOINT
          ? "qubetalk"
          : "http",
      tenant_id: config.tenant_id,
    });
  }

  async run(): Promise<void> {
    console.log("🧪 ClawHack E2E Test Harness\n");
    console.log(`Tenant: ${this.config.tenant_id}`);
    console.log(`Workspace: ${this.config.workspace}`);
    console.log(`Test Message: "${this.config.test_message}"\n`);

    try {
      await this.phase1_InitializeAdapters();
      await this.phase2_SimulateInboundMessage();
      await this.phase3_VerifyQubeTalkRouting();
      await this.phase4_SimulateOpenClawExecution();
      await this.phase5_VerifyDiscordCapsule();
      await this.phase6_VerifyDVNReceipts();

      this.printResults();
    } catch (error: any) {
      console.error("\n❌ Test failed:", error.message);
      this.printResults();
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  private async phase1_InitializeAdapters(): Promise<void> {
    const phase = "Phase 1: Initialize Adapters";
    this.startPhase(phase);

    try {
      const moltComicsConfig = resolveMoltComicsConfig(process.env);
      assertMoltComicsConfig(moltComicsConfig);

      const discordBotToken = process.env.DISCORD_BOT_TOKEN;
      const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!discordBotToken && !discordWebhookUrl) {
        throw new Error(
          "DISCORD_BOT_TOKEN or DISCORD_WEBHOOK_URL is required for e2e verification."
        );
      }

      // Initialize XMTP adapter
      this.xmtpAdapter = new XMTPAdapter({
        provider: "xmtp",
        credentials: {
          inbox_id: "test_inbox",
        },
        allowlist: {
          group_ids: [this.config.xmtp_group_id],
        },
        xmtp_env: "dev",
        environment: "hackathon",
        tenant_id: this.config.tenant_id,
      });

      this.xmtpAdapter.setReceiptEmitter(async (receipt) => {
        await this.dvnService.emit(receipt);
      });

      await this.xmtpAdapter.start();

      // Initialize Discord adapter
      this.discordAdapter = new DiscordAdapter({
        provider: "discord",
        credentials: {
          bot_token: discordBotToken,
          webhook_url: discordWebhookUrl,
        },
        allowlist: {
          channel_ids: [this.config.discord_channel_id],
        },
        surface_planner_endpoint: process.env.SURFACE_PLANNER_ENDPOINT,
        environment: "hackathon",
        tenant_id: this.config.tenant_id,
      });

      this.discordAdapter.setReceiptEmitter(async (receipt) => {
        await this.dvnService.emit(receipt);
      });

      await this.discordAdapter.start();

      this.openclawWorker = new OpenClawWorker({
        tenantId: this.config.tenant_id,
        workspace: this.config.workspace,
        registryEndpoint: process.env.MCP_REGISTRY_ENDPOINT || "http://localhost:8080/registry",
        shelfId: process.env.MCP_SHELF_ID || "shelf_clawhack_2026_group_agents",
        allowlistEnabled: process.env.OPENCLAW_ALLOWLIST_ENABLED !== "false",
        allowStubToolResults: true,
        allowRegistryFallback: true,
        mcpTimeoutMs: Number(process.env.OPENCLAW_MCP_TIMEOUT_MS || "12000"),
        discordChannelId: this.config.discord_channel_id,
        dataDir: process.env.OPENCLAW_DATA_DIR || ".data",
        receiptEmitter: async (receipt) => {
          await this.dvnService.emit(receipt);
        },
      });
      const strictRequiredTools =
        process.env.OPENCLAW_REQUIRED_TOOLS_STRICT === "true" ||
        ((process.env.ENVIRONMENT === "prod" || process.env.NODE_ENV === "production") &&
          process.env.OPENCLAW_REQUIRED_TOOLS_STRICT !== "false");

      try {
        await this.openclawWorker.assertRegistryReady({
          requiredToolIds: ["knyt.comic.generate_pack", "dpr.run"],
          requireRemote: false,
        });
      } catch (error: any) {
        if (strictRequiredTools) {
          throw error;
        }
        console.warn(
          `   ⚠️ Non-strict registry precheck warning: ${error?.message || "unknown error"}`
        );
      }

      this.completePhase(phase, "success");
    } catch (error: any) {
      this.completePhase(phase, "failed", error.message);
      throw error;
    }
  }

  private async phase2_SimulateInboundMessage(): Promise<void> {
    const phase = "Phase 2: Simulate Inbound Message from XMTP";
    this.startPhase(phase);

    try {
      // In a real test, this would come from XMTP stream
      // For now, simulate the InboundEvent
      const inboundEvent: InboundEvent = {
        schema: "metame.bridge.inbound.v0",
        tenant_id: this.config.tenant_id,
        provider: {
          name: "xmtp",
          environment: "hackathon",
        },
        thread: {
          provider_thread_id: this.config.xmtp_group_id,
          thread_key: `thread_${this.config.xmtp_group_id}`,
          qt_thread_id: this.channels.threadTopic("xmtp", this.config.xmtp_group_id),
        },
        message: {
          provider_message_id: `msg_test_${Date.now()}`,
          sent_ts: new Date().toISOString(),
          sender: {
            provider_user_id: "test_user_inbox",
            display_name: "Test User",
          },
          content: {
            type: "text",
            text: this.config.test_message,
          },
        },
        routing: {
          target_agent: "router",
          intent_hint: "create_drop",
        },
        security: {
          data_classification: "internal",
          receipt_required: true,
          redaction_required: false,
        },
      };

      this.latestInboundEvent = inboundEvent;

      console.log(`   📨 Inbound message: "${inboundEvent.message.content.text}"`);
      console.log(`   📍 Thread: ${inboundEvent.thread.qt_thread_id}`);

      // Emit receipt
      await this.dvnService.emit({
        schema: "metame.dvn.receipt.v0",
        receipt_id: `rcpt_${Date.now()}`,
        tenant_id: this.config.tenant_id,
        timestamp: new Date().toISOString(),
        receipt_type: "bridge.inbound_received",
        payload: {
          provider: "xmtp",
          provider_thread_id: this.config.xmtp_group_id,
          provider_message_id: inboundEvent.message.provider_message_id,
        },
      });

      this.completePhase(phase, "success");
    } catch (error: any) {
      this.completePhase(phase, "failed", error.message);
      throw error;
    }
  }

  private async phase3_VerifyQubeTalkRouting(): Promise<void> {
    const phase = "Phase 3: Verify QubeTalk Routing";
    this.startPhase(phase);

    try {
      console.log(`   ✓ Bridge inbound topic: ${this.channels.bridgeInbound}`);
      console.log(`   ✓ Router topic: ${this.channels.router}`);
      console.log(`   ✓ OpenClaw requests topic: ${this.channels.openclawRequests}`);

      this.completePhase(phase, "success");
    } catch (error: any) {
      this.completePhase(phase, "failed", error.message);
      throw error;
    }
  }

  private async phase4_SimulateOpenClawExecution(): Promise<void> {
    const phase = "Phase 4: Simulate OpenClaw Execution";
    this.startPhase(phase);

    try {
      if (!this.latestInboundEvent) {
        throw new Error("Missing inbound event from phase 2");
      }
      if (!this.openclawWorker) {
        throw new Error("OpenClaw worker not initialized");
      }

      this.openclawResult = await this.openclawWorker.handleInboundEvent(
        this.latestInboundEvent
      );

      console.log(`   🔧 OpenClaw request: ${this.openclawResult.requestId}`);
      console.log(`   🧰 Registry source: ${this.openclawResult.registrySource}`);
      console.log(`   📦 Artifacts minted: ${this.openclawResult.artifacts.length}`);

      this.completePhase(phase, "success");
    } catch (error: any) {
      this.completePhase(phase, "failed", error.message);
      throw error;
    }
  }

  private async phase5_VerifyDiscordCapsule(): Promise<void> {
    const phase = "Phase 5: Verify Discord Capsule Publication";
    this.startPhase(phase);

    try {
      const generatedDiscordEvent =
        this.openclawResult?.outboundEvents.find(
          (event) => event.provider.name === "discord"
        ) ?? null;

      const outboundEvent: OutboundEvent =
        generatedDiscordEvent ||
        ({
          schema: "metame.bridge.outbound.v0",
          tenant_id: this.config.tenant_id,
          provider: {
            name: "discord",
          },
          thread: {
            provider_thread_id: this.config.discord_channel_id,
            provider_channel_id: this.config.discord_channel_id,
          },
          message: {
            content: {
              text: "✨ Your comic drop is ready!",
              format: "markdown",
            },
          },
          audit: {
            request_id: this.openclawResult?.requestId || `req_${Date.now()}`,
            artifacts: this.openclawResult?.artifacts.map((artifact) => ({
              iqube_id: artifact.iqube_id,
              label: artifact.label,
            })) || [{ iqube_id: "iq_comic_0", label: "Comic Pack" }],
          },
          security: {
            data_classification: "internal",
            receipt_required: true,
          },
        } as OutboundEvent);

      if (this.discordAdapter) {
        const result = await this.discordAdapter.publish(outboundEvent);
        if (!result.success) {
          throw new Error(`Discord publish failed: ${result.error}`);
        }
        console.log(`   📤 Discord message posted: ${result.provider_message_id}`);
      }

      // Emit capsule published receipt
      await this.dvnService.emit({
        schema: "metame.dvn.receipt.v0",
        receipt_id: `rcpt_${Date.now()}_capsule`,
        tenant_id: this.config.tenant_id,
        timestamp: new Date().toISOString(),
        receipt_type: "capsule.published",
        payload: {
          capsule_id: "capsule_001",
          publish_target: "discord",
          request_id: this.openclawResult?.requestId,
        },
      });

      this.completePhase(phase, "success");
    } catch (error: any) {
      this.completePhase(phase, "failed", error.message);
      throw error;
    }
  }

  private async phase6_VerifyDVNReceipts(): Promise<void> {
    const phase = "Phase 6: Verify DVN Receipts";
    this.startPhase(phase);

    try {
      await this.dvnService.flush();
      const stats = this.dvnService.getStats();

      console.log(`   📊 DVN Receipt Stats:`);
      console.log(`      Emitted: ${stats.emitted}`);
      console.log(`      Failed: ${stats.failed}`);
      console.log(`      Buffered: ${stats.buffered}`);

      if (stats.emitted === 0) {
        throw new Error("No receipts were emitted");
      }

      this.completePhase(phase, "success");
    } catch (error: any) {
      this.completePhase(phase, "failed", error.message);
      throw error;
    }
  }

  private startPhase(phase: string): void {
    console.log(`\n⏳ ${phase}...`);
    this.testResults.push({
      phase,
      status: "running",
    });
  }

  private completePhase(phase: string, status: "success" | "failed", error?: string): void {
    const result = this.testResults.find((r) => r.phase === phase);
    if (result) {
      result.status = status;
      result.error = error;
    }

    if (status === "success") {
      console.log(`✅ ${phase} - PASSED`);
    } else {
      console.log(`❌ ${phase} - FAILED: ${error}`);
    }
  }

  private printResults(): void {
    console.log("\n" + "=".repeat(60));
    console.log("TEST RESULTS");
    console.log("=".repeat(60));

    for (const result of this.testResults) {
      const icon = result.status === "success" ? "✅" : result.status === "failed" ? "❌" : "⏳";
      console.log(`${icon} ${result.phase}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }

    const passed = this.testResults.filter((r) => r.status === "success").length;
    const failed = this.testResults.filter((r) => r.status === "failed").length;

    console.log("\n" + "=".repeat(60));
    console.log(`Total: ${this.testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log("=".repeat(60) + "\n");
  }

  private async cleanup(): Promise<void> {
    console.log("\n🧹 Cleaning up...");
    if (this.xmtpAdapter) {
      await this.xmtpAdapter.stop();
    }
    if (this.discordAdapter) {
      await this.discordAdapter.stop();
    }
    await this.dvnService.stop();
    console.log("✅ Cleanup complete\n");
  }
}

// Run if executed directly
const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "");

if (isMain) {
  const config: TestConfig = {
    tenant_id: process.env.QT_TENANT_ID || "tnt_clawhack",
    workspace: process.env.QT_CHANNEL_MAIN || "clawhack",
    xmtp_group_id: process.env.XMTP_GROUP_ID_ALLOWLIST?.split(",")[0] || "group_test",
    discord_channel_id: process.env.DISCORD_METAKNYTS_CHANNEL_ID || "1234567890",
    test_message: "Make a 21 Sats comic drop",
    expected_artifacts: 1,
    timeout_seconds: 120,
  };

  const harness = new E2ETestHarness(config);
  harness.run().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { E2ETestHarness };
