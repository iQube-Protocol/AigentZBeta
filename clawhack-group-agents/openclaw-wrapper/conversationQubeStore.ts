import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ConversationQube, InboundEvent } from "../schemas/bridgeEvents";
import type {
  ConversationOutcomeUpdate,
  ConversationUpsertResult,
  MintedArtifactRef,
} from "./types";

interface ConversationQubeStoreConfig {
  baseDir?: string;
}

interface PersistResult {
  qube: ConversationQube;
  contentHash: string;
}

function sanitizeThreadKey(threadKey: string): string {
  return threadKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 42);
}

function normalizeProtocol(providerName: string): "xmtp" | "discord" | "other" {
  if (providerName === "xmtp" || providerName === "discord") {
    return providerName;
  }
  return "other";
}

function computeHash(payload: unknown): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(payload));
  return `sha256:${hash.digest("hex")}`;
}

function buildKeyFacts(summary: string): string[] {
  const compact = summary.replace(/\s+/g, " ").trim();
  if (!compact) {
    return [];
  }
  if (compact.length <= 180) {
    return [compact];
  }
  return [compact.slice(0, 180).trimEnd() + "..."];
}

export class ConversationQubeStore {
  private readonly baseDir: string;

  constructor(config: ConversationQubeStoreConfig = {}) {
    this.baseDir =
      config.baseDir ?? path.join(process.cwd(), ".data", "conversation-qubes");
  }

  async upsertFromInbound(
    inbound: InboundEvent,
    allowedTools: string[]
  ): Promise<ConversationUpsertResult> {
    await this.ensureDir();

    const conversationQubeId = this.buildConversationQubeId(inbound.thread.thread_key);
    const existing = await this.readConversation(conversationQubeId);

    const qube = existing ?? this.createConversation(inbound, conversationQubeId, allowedTools);
    qube.cursor.last_processed_message_id = inbound.message.provider_message_id;
    qube.cursor.last_processed_ts = inbound.message.sent_ts;

    if (!existing && inbound.message.content.text) {
      qube.memory.rolling_summary = `Thread initialized with request: ${inbound.message.content.text}`;
      qube.memory.key_facts = buildKeyFacts(qube.memory.rolling_summary);
    }

    const persisted = await this.persist(qube, !existing);
    return {
      qube: persisted.qube,
      isNew: !existing,
      contentHash: persisted.contentHash,
    };
  }

  async recordOutcome(update: ConversationOutcomeUpdate): Promise<PersistResult> {
    await this.ensureDir();
    const qube = await this.readConversation(update.conversationQubeId);
    if (!qube) {
      throw new Error(`ConversationQube ${update.conversationQubeId} not found`);
    }

    qube.memory.rolling_summary = update.summary;
    qube.memory.key_facts = update.keyFacts.length > 0 ? update.keyFacts : buildKeyFacts(update.summary);

    for (const artifact of update.artifacts) {
      this.appendArtifactRef(qube, artifact, update.requestId, update.toolchain);
    }

    return this.persist(qube, false);
  }

  async getById(conversationQubeId: string): Promise<ConversationQube | null> {
    return this.readConversation(conversationQubeId);
  }

  private buildConversationQubeId(threadKey: string): string {
    return `cq_${sanitizeThreadKey(threadKey)}`;
  }

  private createConversation(
    inbound: InboundEvent,
    conversationQubeId: string,
    allowedTools: string[]
  ): ConversationQube {
    return {
      schema: "metame.iqube.conversation.v0",
      conversation_qube_id: conversationQubeId,
      tenant_id: inbound.tenant_id,
      bindings: {
        protocol: normalizeProtocol(inbound.provider.name),
        group_id: inbound.thread.provider_thread_id,
        qt_thread_id: inbound.thread.qt_thread_id,
      },
      policy: {
        scope: "thread_only",
        allowed_agents: [
          "openclaw_group_agent",
          "aigent_z_router",
          "windsurf_cascade",
          "openai_codex",
        ],
        allowed_tools: [...allowedTools],
        memory_rules: {
          store_raw_messages: false,
          store_summary: true,
          summary_ttl_days: 30,
          artifact_refs_only: true,
        },
      },
      cursor: {},
      memory: {
        rolling_summary: "",
        key_facts: [],
        open_tasks: [],
      },
      artifacts: [],
      versions: {
        current: 0,
        history: [],
      },
    };
  }

  private appendArtifactRef(
    qube: ConversationQube,
    artifact: MintedArtifactRef,
    requestId: string,
    toolchain: string[]
  ): void {
    const exists = qube.artifacts.some((entry) => entry.iqube_id === artifact.iqube_id);
    if (exists) {
      return;
    }

    qube.artifacts.push({
      iqube_id: artifact.iqube_id,
      type: artifact.type,
      label: artifact.label,
      created_ts: artifact.created_ts,
      provenance: {
        request_id: requestId,
        toolchain: [...toolchain],
      },
    });
  }

  private async persist(qube: ConversationQube, isNew: boolean): Promise<PersistResult> {
    const pathForConversation = this.pathForConversation(qube.conversation_qube_id);
    const nextVersion = isNew ? 1 : qube.versions.current + 1;
    qube.versions.current = nextVersion;
    const contentHash = computeHash({
      schema: qube.schema,
      tenant_id: qube.tenant_id,
      bindings: qube.bindings,
      policy: qube.policy,
      cursor: qube.cursor,
      memory: qube.memory,
      artifacts: qube.artifacts,
      version: nextVersion,
    });
    qube.versions.history.push({
      version: nextVersion,
      hash: contentHash,
      ts: new Date().toISOString(),
    });
    await writeFile(pathForConversation, JSON.stringify(qube, null, 2), "utf8");
    return { qube, contentHash };
  }

  private async readConversation(conversationQubeId: string): Promise<ConversationQube | null> {
    const pathForConversation = this.pathForConversation(conversationQubeId);
    try {
      const raw = await readFile(pathForConversation, "utf8");
      return JSON.parse(raw) as ConversationQube;
    } catch {
      return null;
    }
  }

  private pathForConversation(conversationQubeId: string): string {
    return path.join(this.baseDir, `${conversationQubeId}.json`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
  }
}
