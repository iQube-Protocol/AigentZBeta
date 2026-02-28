import { createHash } from "node:crypto";
import type {
  ConversationQube,
  DataClassification,
  DVNReceipt,
  InboundEvent,
  OutboundEvent,
} from "../schemas/bridgeEvents";
import { ArtifactStore } from "./artifactStore";
import { ConversationQubeStore } from "./conversationQubeStore";
import { MCPInvoker } from "./mcpInvoker";
import { ToolPolicyEnforcer } from "./policyEnforcer";
import { MCPRegistryClient } from "./registryClient";
import type {
  MintedArtifactRef,
  OpenClawRunResult,
  OpenClawWorkerConfig,
  RegistrySnapshot,
} from "./types";

interface RunContext {
  inbound: InboundEvent;
  requestId: string;
  snapshot: RegistrySnapshot;
  conversationQube: ConversationQube;
  receipts: DVNReceipt[];
}

export class OpenClawWorker {
  private readonly config: Required<
    Omit<OpenClawWorkerConfig, "receiptEmitter" | "dataDir" | "discordChannelId"> & {
      dataDir: string;
      discordChannelId: string;
    }
  >;
  private readonly receiptEmitter?: (receipt: DVNReceipt) => Promise<void>;
  private readonly registryClient: MCPRegistryClient;
  private readonly policyEnforcer: ToolPolicyEnforcer;
  private readonly mcpInvoker: MCPInvoker;
  private readonly conversationStore: ConversationQubeStore;
  private readonly artifactStore: ArtifactStore;
  private snapshot?: RegistrySnapshot;

  constructor(config: OpenClawWorkerConfig) {
    this.config = {
      allowlistEnabled: true,
      mcpTimeoutMs: 12_000,
      allowStubToolResults: false,
      allowRegistryFallback: false,
      discordChannelId: "",
      dataDir: ".data",
      ...config,
    };
    this.receiptEmitter = config.receiptEmitter;

    this.registryClient = new MCPRegistryClient({
      endpoint: this.config.registryEndpoint,
      shelfId: this.config.shelfId,
      includeFallbackTools: this.config.allowRegistryFallback,
    });
    this.policyEnforcer = new ToolPolicyEnforcer({
      allowlistEnabled: this.config.allowlistEnabled,
    });
    this.mcpInvoker = new MCPInvoker({
      timeoutMs: this.config.mcpTimeoutMs,
      allowStubFallback: this.config.allowStubToolResults,
    });
    this.conversationStore = new ConversationQubeStore({
      baseDir: `${this.config.dataDir}/conversation-qubes`,
    });
    this.artifactStore = new ArtifactStore({
      baseDir: `${this.config.dataDir}/artifacts`,
    });
  }

  async handleInboundEvent(inbound: InboundEvent): Promise<OpenClawRunResult> {
    const receipts: DVNReceipt[] = [];
    const snapshot = await this.getSnapshot();
    const requestId = this.generateId("req");

    const upsert = await this.conversationStore.upsertFromInbound(
      inbound,
      Array.from(snapshot.allowedToolIds)
    );
    await this.emitReceipt(
      {
        schema: "metame.dvn.receipt.v0",
        receipt_id: this.generateId("rcpt"),
        tenant_id: this.config.tenantId,
        timestamp: new Date().toISOString(),
        receipt_type: upsert.isNew ? "artifact.minted" : "artifact.versioned",
        payload: {
          request_id: requestId,
          thread_key: inbound.thread.thread_key,
          iqube_id: upsert.qube.conversation_qube_id,
          artifact_type: "ConversationQube",
          content_hash: upsert.contentHash,
          version: upsert.qube.versions.current,
        },
      },
      receipts
    );

    const context: RunContext = {
      inbound,
      requestId,
      snapshot,
      conversationQube: upsert.qube,
      receipts,
    };

    let outboundEvents: OutboundEvent[] = [];
    let artifacts: MintedArtifactRef[] = [];

    try {
      if (inbound.routing.intent_hint === "create_drop") {
        const run = await this.runKnytDropCaptain(context);
        outboundEvents = run.outboundEvents;
        artifacts = run.artifacts;
      } else if (inbound.routing.intent_hint === "summarize") {
        outboundEvents = await this.runSummary(context);
      } else {
        outboundEvents = [this.buildHelpResponse(context)];
      }
    } finally {
      this.policyEnforcer.resetRequest(requestId);
    }

    return {
      requestId,
      inboundEvent: inbound,
      outboundEvents,
      artifacts,
      conversationQube: context.conversationQube,
      receipts,
      registrySource: snapshot.source,
    };
  }

  async refreshRegistrySnapshot(): Promise<RegistrySnapshot> {
    this.snapshot = await this.registryClient.loadSnapshot();
    return this.snapshot;
  }

  private async runKnytDropCaptain(
    context: RunContext
  ): Promise<{ outboundEvents: OutboundEvent[]; artifacts: MintedArtifactRef[] }> {
    const toolchain: string[] = [];
    const dataClassification = context.inbound.security.data_classification;
    const brief =
      context.inbound.message.content.text?.trim() ??
      "Create a 21 Sats comic and marketing drop for metaKnyt.";

    const comicPack = await this.invokeCuratedTool(
      "knyt.comic.generate_pack",
      {
        brief,
        thread_key: context.inbound.thread.thread_key,
      },
      context,
      dataClassification,
      toolchain
    );

    const comicArtifact = await this.mintArtifactAndReceipt(
      {
        tenantId: this.config.tenantId,
        threadKey: context.inbound.thread.thread_key,
        requestId: context.requestId,
        type: "ContentQube",
        label: "KNYT Comic Pack",
        payload: comicPack,
        toolchain: [...toolchain],
      },
      context
    );

    const dprResult = await this.invokeCuratedTool(
      "dpr.run",
      {
        artifact_id: comicArtifact.iqube_id,
        artifact: comicPack,
      },
      context,
      dataClassification,
      toolchain
    );

    const dprArtifact = await this.mintArtifactAndReceipt(
      {
        tenantId: this.config.tenantId,
        threadKey: context.inbound.thread.thread_key,
        requestId: context.requestId,
        type: "ContentQube",
        label: "DPR Result",
        payload: dprResult,
        toolchain: [...toolchain],
      },
      context
    );

    const artifacts: MintedArtifactRef[] = [comicArtifact, dprArtifact];

    if (context.snapshot.allowedToolIds.has("marketa.copy.generate_pack")) {
      const marketingResult = await this.invokeCuratedTool(
        "marketa.copy.generate_pack",
        {
          brief,
          references: artifacts.map((artifact) => artifact.iqube_id),
        },
        context,
        dataClassification,
        toolchain
      );

      const marketingArtifact = await this.mintArtifactAndReceipt(
        {
          tenantId: this.config.tenantId,
          threadKey: context.inbound.thread.thread_key,
          requestId: context.requestId,
          type: "ContentQube",
          label: "Marketing Copy Pack",
          payload: marketingResult,
          toolchain: [...toolchain],
        },
        context
      );
      artifacts.push(marketingArtifact);
    }

    const summary = this.buildRunSummary(brief, artifacts);
    const conversationPersist = await this.conversationStore.recordOutcome({
      conversationQubeId: context.conversationQube.conversation_qube_id,
      summary,
      keyFacts: [
        "Thread scoped workflow executed with curated MCP tools.",
        `Artifacts minted: ${artifacts.length}`,
      ],
      artifacts,
      requestId: context.requestId,
      toolchain,
    });

    context.conversationQube = conversationPersist.qube;
    await this.emitReceipt(
      {
        schema: "metame.dvn.receipt.v0",
        receipt_id: this.generateId("rcpt"),
        tenant_id: this.config.tenantId,
        timestamp: new Date().toISOString(),
        receipt_type: "artifact.versioned",
        payload: {
          request_id: context.requestId,
          thread_key: context.inbound.thread.thread_key,
          iqube_id: conversationPersist.qube.conversation_qube_id,
          artifact_type: "ConversationQube",
          content_hash: conversationPersist.contentHash,
          version: conversationPersist.qube.versions.current,
        },
      },
      context.receipts
    );

    const primaryText = [
      "KNYT Drop Captain completed this run.",
      `Generated ${artifacts.length} artifacts and passed DPR checks.`,
      `ConversationQube: ${conversationPersist.qube.conversation_qube_id}`,
    ].join(" ");

    const outboundEvents: OutboundEvent[] = [
      this.buildOutboundForInboundProvider(context, primaryText, artifacts),
    ];

    if (this.config.discordChannelId && context.inbound.provider.name !== "discord") {
      outboundEvents.push(
        this.buildDiscordCapsuleOutbound(context, artifacts)
      );
    }

    return { outboundEvents, artifacts };
  }

  private async runSummary(context: RunContext): Promise<OutboundEvent[]> {
    const summary = context.conversationQube.memory.rolling_summary || "No summary available yet.";
    const openTasks = context.conversationQube.memory.open_tasks
      .filter((task) => task.status === "open")
      .map((task) => `• ${task.title}`);
    const taskSection =
      openTasks.length > 0 ? ` Open tasks:\n${openTasks.join("\n")}` : " No open tasks.";

    const text = `Thread summary: ${summary}${taskSection}`;
    return [this.buildOutboundForInboundProvider(context, text, [])];
  }

  private buildHelpResponse(context: RunContext): OutboundEvent {
    const text =
      "I can run thread-scoped workflows. Try: 'Make a 21 Sats comic drop' or 'summarize'.";
    return this.buildOutboundForInboundProvider(context, text, []);
  }

  private buildOutboundForInboundProvider(
    context: RunContext,
    text: string,
    artifacts: MintedArtifactRef[]
  ): OutboundEvent {
    return {
      schema: "metame.bridge.outbound.v0",
      tenant_id: this.config.tenantId,
      provider: {
        name: context.inbound.provider.name,
      },
      thread: {
        provider_thread_id: context.inbound.thread.provider_thread_id,
        provider_channel_id: context.inbound.thread.provider_channel_id,
      },
      message: {
        in_reply_to_provider_message_id: context.inbound.message.provider_message_id,
        content: {
          text,
          format: "markdown",
        },
      },
      audit: {
        request_id: context.requestId,
        artifacts: artifacts.map((artifact) => ({
          iqube_id: artifact.iqube_id,
          label: artifact.label,
        })),
      },
      security: {
        data_classification: context.inbound.security.data_classification,
        receipt_required: true,
      },
    };
  }

  private buildDiscordCapsuleOutbound(
    context: RunContext,
    artifacts: MintedArtifactRef[]
  ): OutboundEvent {
    const text = `✨ 21 Sats drop ready: ${artifacts
      .map((artifact) => artifact.label)
      .join(", ")}.`;

    return {
      schema: "metame.bridge.outbound.v0",
      tenant_id: this.config.tenantId,
      provider: {
        name: "discord",
      },
      thread: {
        provider_thread_id: this.config.discordChannelId,
        provider_channel_id: this.config.discordChannelId,
      },
      message: {
        content: {
          text,
          format: "markdown",
        },
      },
      audit: {
        request_id: context.requestId,
        artifacts: artifacts.map((artifact) => ({
          iqube_id: artifact.iqube_id,
          label: artifact.label,
        })),
      },
      security: {
        data_classification: "internal",
        receipt_required: true,
      },
    };
  }

  private async invokeCuratedTool(
    toolId: string,
    args: Record<string, unknown>,
    context: RunContext,
    dataClassification: DataClassification,
    toolchain: string[]
  ): Promise<unknown> {
    const tool = context.snapshot.toolsById.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found in registry snapshot`);
    }

    this.policyEnforcer.assertCanInvoke(toolId, tool, {
      requestId: context.requestId,
      threadKey: context.inbound.thread.thread_key,
      scope: "thread_only",
      dataClassification,
      allowedToolIds: context.snapshot.allowedToolIds,
    });

    const provider = context.snapshot.providersById.get(tool.provider_id);
    const invocation = await this.mcpInvoker.invoke({
      tool,
      provider,
      args,
      requestId: context.requestId,
    });

    this.policyEnforcer.registerInvocation(toolId, {
      requestId: context.requestId,
      threadKey: context.inbound.thread.thread_key,
      scope: "thread_only",
      dataClassification,
    });
    toolchain.push(toolId);

    await this.emitReceipt(
      {
        schema: "metame.dvn.receipt.v0",
        receipt_id: this.generateId("rcpt"),
        tenant_id: this.config.tenantId,
        timestamp: new Date().toISOString(),
        receipt_type: "tool.invoked",
        payload: {
          request_id: context.requestId,
          thread_key: context.inbound.thread.thread_key,
          tool_id: toolId,
          args_hash: this.hashPayload(args),
          result_hash: this.hashPayload(invocation.data),
        },
      },
      context.receipts
    );

    return invocation.data;
  }

  private async mintArtifactAndReceipt(
    input: {
      tenantId: string;
      threadKey: string;
      requestId: string;
      type: "ContentQube" | "MediaQube";
      label: string;
      payload: unknown;
      toolchain: string[];
    },
    context: RunContext
  ): Promise<MintedArtifactRef> {
    const artifact = await this.artifactStore.mintArtifact(input);
    await this.emitReceipt(
      {
        schema: "metame.dvn.receipt.v0",
        receipt_id: this.generateId("rcpt"),
        tenant_id: this.config.tenantId,
        timestamp: artifact.created_ts,
        receipt_type: "artifact.minted",
        payload: {
          request_id: context.requestId,
          thread_key: context.inbound.thread.thread_key,
          iqube_id: artifact.iqube_id,
          artifact_type: artifact.type,
          content_hash: artifact.content_hash,
          version: artifact.version,
        },
      },
      context.receipts
    );
    return artifact;
  }

  private buildRunSummary(brief: string, artifacts: MintedArtifactRef[]): string {
    const labels = artifacts.map((artifact) => artifact.label).join(", ");
    return `Executed knyt_drop_captain for brief "${brief}". Artifacts minted: ${labels}.`;
  }

  private async getSnapshot(): Promise<RegistrySnapshot> {
    if (!this.snapshot) {
      this.snapshot = await this.registryClient.loadSnapshot();
    }
    return this.snapshot;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private hashPayload(payload: unknown): string {
    const hash = createHash("sha256");
    hash.update(JSON.stringify(payload));
    return `sha256:${hash.digest("hex")}`;
  }

  private async emitReceipt(receipt: DVNReceipt, receipts: DVNReceipt[]): Promise<void> {
    receipts.push(receipt);
    if (this.receiptEmitter) {
      await this.receiptEmitter(receipt);
    }
  }
}
