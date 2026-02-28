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

interface OutboundLink {
  label: string;
  url: string;
}

export class OpenClawWorker {
  private readonly config: Required<
    Omit<OpenClawWorkerConfig, "receiptEmitter" | "dataDir" | "discordChannelId" | "moltComicsEnabled"> & {
      dataDir: string;
      discordChannelId: string;
      moltComicsEnabled: boolean;
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
      moltComicsEnabled: false,
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

  async assertRegistryReady(options?: {
    requiredToolIds?: string[];
    requireRemote?: boolean;
  }): Promise<RegistrySnapshot> {
    const snapshot = await this.getSnapshot();
    const requiredToolIds = (options?.requiredToolIds ?? []).filter(Boolean);

    if (options?.requireRemote && snapshot.source !== "remote") {
      throw new Error(
        `Registry source is ${snapshot.source}; remote registry is required in this environment.`
      );
    }

    const missingTools = requiredToolIds.filter((toolId) => !snapshot.toolsById.has(toolId));
    if (missingTools.length > 0) {
      throw new Error(
        `Required tools missing from registry snapshot: ${missingTools.join(", ")}`
      );
    }

    if (this.config.allowlistEnabled) {
      const disallowed = requiredToolIds.filter((toolId) => !snapshot.allowedToolIds.has(toolId));
      if (disallowed.length > 0) {
        throw new Error(
          `Required tools are not in curated allowlist shelf ${snapshot.shelfId}: ${disallowed.join(", ")}`
        );
      }
    }

    return snapshot;
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
    const outboundLinks: OutboundLink[] = [];

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

    if (this.config.moltComicsEnabled) {
      const moltComicsOutcome = await this.tryRunMoltComicsPublish(
        context,
        dataClassification,
        toolchain,
        comicArtifact,
        brief,
        comicPack
      );
      if (moltComicsOutcome.artifact) {
        artifacts.push(moltComicsOutcome.artifact);
      }
      outboundLinks.push(...moltComicsOutcome.links);
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
      outboundLinks.length > 0
        ? `MoltComics links: ${outboundLinks.map((link) => link.url).join(" • ")}`
        : "",
    ].join(" ");

    const outboundEvents: OutboundEvent[] = [
      this.buildOutboundForInboundProvider(context, primaryText, artifacts, outboundLinks),
    ];

    if (this.config.discordChannelId && context.inbound.provider.name !== "discord") {
      outboundEvents.push(
        this.buildDiscordCapsuleOutbound(context, artifacts, outboundLinks)
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
    artifacts: MintedArtifactRef[],
    links: OutboundLink[] = []
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
          ...(links.length > 0 ? { buttons: links.slice(0, 3) } : {}),
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
    artifacts: MintedArtifactRef[],
    links: OutboundLink[] = []
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
          ...(links.length > 0 ? { buttons: links.slice(0, 3) } : {}),
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

  private async tryRunMoltComicsPublish(
    context: RunContext,
    dataClassification: DataClassification,
    toolchain: string[],
    comicArtifact: MintedArtifactRef,
    brief: string,
    comicPack: unknown
  ): Promise<{ links: OutboundLink[]; artifact?: MintedArtifactRef }> {
    const links: OutboundLink[] = [];
    const payload: Record<string, unknown> = {};
    const hasTool = (toolId: string): boolean =>
      context.snapshot.allowedToolIds.has(toolId) && context.snapshot.toolsById.has(toolId);

    if (!hasTool("moltcomics.chains.create") && !hasTool("moltcomics.panels.submit")) {
      return { links };
    }

    try {
      const imageUrl = this.extractImageUrl(context, comicPack);
      const panelCaptionBase =
        this.readNestedString(comicPack, ["panels", "0", "caption"]) ||
        "21 Sats teaser panel generated by myBot";
      const panelCaption = this.ensureMoltCaption(panelCaptionBase, brief);

      let chainId: string | undefined;
      let chainUrl: string | undefined;

      if (hasTool("moltcomics.chains.continuable")) {
        const continuable = await this.invokeCuratedTool(
          "moltcomics.chains.continuable",
          { limit: 20 },
          context,
          dataClassification,
          toolchain
        );
        payload.chains_continuable = continuable;
        chainId = this.extractContinuableChainId(continuable);
      }

      if (!chainId && hasTool("moltcomics.chains.create")) {
        const chainCreate = await this.invokeCuratedTool(
          "moltcomics.chains.create",
          {
            title: "metaKnyt 21 Sats Drop",
            genre: "sci-fi",
            caption: panelCaption,
            image_url: imageUrl,
          },
          context,
          dataClassification,
          toolchain
        );
        payload.chains_create = chainCreate;
        chainId = this.readStringByKeys(chainCreate, ["chainId", "chain_id", "id"]);
        chainUrl = this.readStringByKeys(chainCreate, ["url"]);
      }

      if (chainId && hasTool("moltcomics.chains.get")) {
        const chainGet = await this.invokeCuratedTool(
          "moltcomics.chains.get",
          { chain_id: chainId },
          context,
          dataClassification,
          toolchain
        );
        payload.chains_get = chainGet;
        if (!chainUrl) {
          chainUrl =
            this.readNestedString(chainGet, ["chain", "url"]) ||
            `https://moltcomics.com/chains/${chainId}`;
        }
      }

      if (chainId && hasTool("moltcomics.panels.submit")) {
        const panelSubmit = await this.invokeCuratedTool(
          "moltcomics.panels.submit",
          {
            chain_id: chainId,
            caption: panelCaption,
            image_url: imageUrl,
            prompt_pack_ref: comicArtifact.iqube_id,
          },
          context,
          dataClassification,
          toolchain
        );
        payload.panels_submit = panelSubmit;
        const panelUrl =
          this.readStringByKeys(panelSubmit, ["url", "panelUrl", "panel_url"]) ||
          this.readStringByKeys(panelSubmit, ["imageUrl", "image_url"]);
        this.pushOutboundLink(links, "View Comic Panel", panelUrl);
      }

      if (chainUrl) {
        this.pushOutboundLink(links, "Open MoltComics Chain", chainUrl);
      } else if (chainId) {
        this.pushOutboundLink(links, "Open MoltComics Chain", `https://moltcomics.com/chains/${chainId}`);
      }

      const artifact = await this.mintArtifactAndReceipt(
        {
          tenantId: this.config.tenantId,
          threadKey: context.inbound.thread.thread_key,
          requestId: context.requestId,
          type: "ContentQube",
          label: "MoltComics Submission Result",
          payload,
          toolchain: [...toolchain],
        },
        context
      );

      return { links, artifact };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[openclaw-worker] MoltComics publish failed: ${errorMessage}`);
      return { links };
    }
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

  private readStringByKeys(value: unknown, keys: string[]): string | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      const raw = record[key];
      if (typeof raw === "string" && raw.trim().length > 0) {
        return raw.trim();
      }
    }
    return undefined;
  }

  private readNestedString(value: unknown, path: string[]): string | undefined {
    let current: unknown = value;
    for (const key of path) {
      if (Array.isArray(current)) {
        const idx = Number(key);
        if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
          return undefined;
        }
        current = current[idx];
        continue;
      }
      if (!current || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return typeof current === "string" && current.trim().length > 0
      ? current.trim()
      : undefined;
  }

  private extractContinuableChainId(value: unknown): string | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const record = value as Record<string, unknown>;
    const chains = record.chains;
    if (!Array.isArray(chains) || chains.length === 0) {
      return undefined;
    }
    const first = chains[0];
    if (!first || typeof first !== "object") {
      return undefined;
    }
    const firstRecord = first as Record<string, unknown>;
    const nestedChain = firstRecord.chain;
    if (nestedChain && typeof nestedChain === "object") {
      const id = (nestedChain as Record<string, unknown>).id;
      if (typeof id === "string" && id.trim().length > 0) {
        return id.trim();
      }
    }
    const directId = firstRecord.id;
    if (typeof directId === "string" && directId.trim().length > 0) {
      return directId.trim();
    }
    return undefined;
  }

  private extractImageUrl(context: RunContext, comicPack: unknown): string | undefined {
    const attachment = context.inbound.message.content.attachments?.find((item) =>
      item.mime?.startsWith("image/")
    );
    if (attachment?.url) {
      return attachment.url;
    }

    return (
      this.readStringByKeys(comicPack, ["image_url", "imageUrl", "panel_url", "panelUrl"]) ||
      this.readNestedString(comicPack, ["panels", "0", "image_url"]) ||
      this.readNestedString(comicPack, ["panels", "0", "imageUrl"])
    );
  }

  private ensureMoltCaption(base: string, brief: string): string {
    const seed =
      base.trim().length > 0
        ? base.trim()
        : "A new panel pushes the storyline forward with cinematic tension and clear narrative continuity.";
    const extension =
      ` ${brief.trim()} The scene should preserve visual continuity with prior panels, keep dialogue clear,` +
      " and maintain PG-13 tone while advancing the character arc toward the next dramatic beat.";
    let caption = seed;
    while (caption.length < 320) {
      caption += extension;
    }
    return caption.slice(0, 1100);
  }

  private pushOutboundLink(links: OutboundLink[], label: string, url: string | undefined): void {
    if (!url || !/^https?:\/\//i.test(url)) {
      return;
    }
    if (links.some((link) => link.url === url)) {
      return;
    }
    links.push({ label, url });
  }
}
