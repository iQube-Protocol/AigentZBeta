import type { MCPInvocationArgs, MCPInvocationResult } from "./types";

interface MCPInvokerConfig {
  timeoutMs?: number;
  allowStubFallback?: boolean;
}

interface MoltComicsDirectConfig {
  enabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  agentId?: string;
  endpoints: {
    chainsCreate: string;
    chainsContinuable: string;
    chainsGet: string;
    panelsSubmit: string;
    panelsUpvote: string;
  };
}

interface MoltComicsCallInput {
  method: "GET" | "POST" | "POST_FORM";
  pathTemplate: string;
  args: Record<string, unknown>;
  requestId: string;
  body?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export class MCPInvoker {
  private config: Required<MCPInvokerConfig>;
  private moltComics: MoltComicsDirectConfig;

  constructor(config: MCPInvokerConfig = {}) {
    this.config = {
      timeoutMs: 12_000,
      allowStubFallback: true,
      ...config,
    };
    this.moltComics = this.resolveMoltComicsConfig();
  }

  async invoke({ tool, provider, args, requestId }: MCPInvocationArgs): Promise<MCPInvocationResult> {
    if (this.isMoltComicsTool(tool.tool_id) && this.moltComics.enabled) {
      try {
        const data = await this.invokeMoltComicsDirect(tool.tool_id, args, requestId);
        return {
          data,
          stubbed: false,
          endpoint: `${this.moltComics.baseUrl || "direct_api"} (direct_api)`,
        };
      } catch (error) {
        if (!this.config.allowStubFallback) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[mcp-invoker] MoltComics direct API failed for ${tool.tool_id}: ${message}`);
      }
    }

    const endpoint = tool.invoke_endpoint ?? provider?.connection?.endpoint;
    if (endpoint) {
      try {
        const remote = await this.invokeRemote(endpoint, tool.tool_id, args, requestId, provider);
        return { data: remote, stubbed: false, endpoint };
      } catch (error) {
        if (!this.config.allowStubFallback) {
          throw error;
        }
      }
    }

    if (!this.config.allowStubFallback) {
      throw new Error(`No MCP endpoint available for tool ${tool.tool_id}`);
    }

    return {
      data: this.generateStubResult(tool.tool_id, args),
      stubbed: true,
      endpoint,
    };
  }

  private isMoltComicsTool(toolId: string): boolean {
    return toolId.startsWith("moltcomics.");
  }

  private async invokeRemote(
    endpoint: string,
    toolId: string,
    args: Record<string, unknown>,
    requestId: string,
    provider?: MCPInvocationArgs["provider"]
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const authHeaders = this.resolveAuthHeaders(provider);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authHeaders,
        },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/call",
          params: {
            name: toolId,
            arguments: args,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP invoke failed (${response.status})`);
      }

      const payload: unknown = await response.json();
      if (isRecord(payload) && "error" in payload && payload.error) {
        throw new Error(`MCP returned error for ${toolId}`);
      }
      if (isRecord(payload) && "result" in payload) {
        return payload.result;
      }

      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveAuthHeaders(provider?: MCPInvocationArgs["provider"]): Record<string, string> {
    const mode = provider?.connection?.auth?.mode;
    const envVar = provider?.connection?.auth?.env_var;
    if (!mode || !envVar) {
      return {};
    }

    const secret = process.env[envVar]?.trim();
    if (!secret) {
      return {};
    }

    if (mode === "api_key") {
      return {
        Authorization: `Bearer ${secret}`,
        "x-api-key": secret,
      };
    }

    if (mode === "bearer") {
      return {
        Authorization: `Bearer ${secret}`,
      };
    }

    return {};
  }

  private resolveMoltComicsConfig(): MoltComicsDirectConfig {
    const enabled =
      process.env.MOLTCOMICS_ENABLED === "true" &&
      process.env.MOLTCOMICS_DIRECT_API !== "false";
    const baseUrl =
      process.env.MOLTCOMICS_API_BASE_URL?.trim() ||
      process.env.MOLTCOMICS_API_ENDPOINT?.trim() ||
      "https://moltcomics.com";

    return {
      enabled,
      baseUrl,
      apiKey: process.env.MOLTCOMICS_API_KEY?.trim(),
      agentId: process.env.MOLTCOMICS_AGENT_ID?.trim(),
      endpoints: {
        chainsCreate:
          process.env.MOLTCOMICS_API_PATH_CHAINS_CREATE || "/api/v1/chains",
        chainsContinuable:
          process.env.MOLTCOMICS_API_PATH_CHAINS_CONTINUABLE ||
          "/api/v1/chains/continuable",
        chainsGet:
          process.env.MOLTCOMICS_API_PATH_CHAINS_GET || "/api/v1/chains/{chain_id}",
        panelsSubmit:
          process.env.MOLTCOMICS_API_PATH_PANELS_SUBMIT || "/api/v1/panels",
        panelsUpvote:
          process.env.MOLTCOMICS_API_PATH_PANELS_UPVOTE ||
          "/api/v1/panels/{panel_id}/upvote",
      },
    };
  }

  private async invokeMoltComicsDirect(
    toolId: string,
    args: Record<string, unknown>,
    requestId: string
  ): Promise<unknown> {
    if (!this.moltComics.baseUrl) {
      throw new Error("MoltComics direct API is enabled but MOLTCOMICS_API_BASE_URL is not set.");
    }
    if (!this.moltComics.apiKey) {
      throw new Error("MoltComics direct API is enabled but MOLTCOMICS_API_KEY is not set.");
    }

    if (toolId === "moltcomics.chains.create") {
      return this.callMoltComics({
        method: "POST_FORM",
        pathTemplate: this.moltComics.endpoints.chainsCreate,
        args,
        requestId,
      });
    }

    if (toolId === "moltcomics.chains.continuable") {
      return this.callMoltComics({
        method: "GET",
        pathTemplate: this.moltComics.endpoints.chainsContinuable,
        args,
        requestId,
      });
    }

    if (toolId === "moltcomics.chains.get") {
      return this.callMoltComics({
        method: "GET",
        pathTemplate: this.moltComics.endpoints.chainsGet,
        args,
        requestId,
      });
    }

    if (toolId === "moltcomics.panels.submit") {
      return this.callMoltComics({
        method: "POST_FORM",
        pathTemplate: this.moltComics.endpoints.panelsSubmit,
        args,
        requestId,
      });
    }

    if (toolId === "moltcomics.panels.upvote") {
      return this.callMoltComics({
        method: "POST",
        pathTemplate: this.moltComics.endpoints.panelsUpvote,
        args,
        requestId,
        body: {},
      });
    }

    throw new Error(`Unsupported MoltComics direct tool: ${toolId}`);
  }

  private async callMoltComics(input: MoltComicsCallInput): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const url = this.buildMoltComicsUrl(input.pathTemplate, input.args);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.moltComics.apiKey}`,
      "x-api-key": this.moltComics.apiKey || "",
      "x-request-id": input.requestId,
      ...(this.moltComics.agentId ? { "x-agent-id": this.moltComics.agentId } : {}),
    };

    try {
      const method = input.method === "POST_FORM" ? "POST" : input.method;
      let body: unknown;

      if (input.method === "POST") {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(input.body || {});
      }

      if (input.method === "POST_FORM") {
        body = await this.buildMoltComicsFormData(input.pathTemplate, input.args);
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body as any,
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: unknown = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`MoltComics API returned non-JSON response for ${method} ${url}`);
      }

      if (!response.ok) {
        const message =
          isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === "string"
            ? parsed.error.message
            : isRecord(parsed) && typeof parsed.message === "string"
              ? parsed.message
              : text.slice(0, 180);
        throw new Error(`MoltComics API ${method} ${url} failed (${response.status}): ${message}`);
      }

      return parsed;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildMoltComicsUrl(pathTemplate: string, args: Record<string, unknown>): string {
    const tokens: Record<string, string | undefined> = {
      chain_id: asNonEmptyString(args.chain_id) || asNonEmptyString(args.chainId),
      panel_id: asNonEmptyString(args.panel_id) || asNonEmptyString(args.panelId),
      agent_id: this.moltComics.agentId,
    };

    const resolvedPath = pathTemplate.replace(/\{(chain_id|panel_id|agent_id)\}/g, (_, key) => {
      const value = tokens[key];
      if (!value) {
        throw new Error(`Missing required path token: ${key}`);
      }
      return encodeURIComponent(value);
    });

    const url = new URL(resolvedPath, this.moltComics.baseUrl);

    if (resolvedPath.includes("?")) {
      return url.toString();
    }

    const maybeLimit = asNumber(args.limit);
    if (maybeLimit !== undefined) {
      url.searchParams.set("limit", String(maybeLimit));
    }

    const maybeSort = asNonEmptyString(args.sort);
    if (maybeSort) {
      url.searchParams.set("sort", maybeSort);
    }

    const maybeGenre = asNonEmptyString(args.genre);
    if (maybeGenre) {
      url.searchParams.set("genre", maybeGenre);
    }

    const maybeCursor = asNonEmptyString(args.cursor);
    if (maybeCursor) {
      url.searchParams.set("cursor", maybeCursor);
    }

    return url.toString();
  }

  private async buildMoltComicsFormData(
    pathTemplate: string,
    args: Record<string, unknown>
  ): Promise<FormData> {
    const form = new FormData();
    const isChainsCreate = pathTemplate === this.moltComics.endpoints.chainsCreate;
    const isPanelsSubmit = pathTemplate === this.moltComics.endpoints.panelsSubmit;

    if (isChainsCreate) {
      form.append("title", asNonEmptyString(args.title) || "metaKnyt 21 Sats Drop");
      form.append("genre", asNonEmptyString(args.genre) || "sci-fi");
      const caption =
        asNonEmptyString(args.caption) ||
        `A new signal ignites the chain as 21 sats unlock the next panel. ${this.getMetaKnytDirective()}`;
      form.append("caption", caption);
    }

    if (isPanelsSubmit) {
      const chainId = asNonEmptyString(args.chain_id) || asNonEmptyString(args.chainId);
      if (!chainId) {
        throw new Error("moltcomics.panels.submit requires chain_id");
      }
      form.append("chainId", chainId);
      const caption =
        asNonEmptyString(args.caption) ||
        `The signal mutates into a new panel as the storyline advances. ${this.getMetaKnytDirective()}`;
      form.append("caption", caption);
    }

    const { blob, filename } = await this.resolveMoltComicsImage(args);
    form.append("image", blob, filename);
    return form;
  }

  private async resolveMoltComicsImage(
    args: Record<string, unknown>
  ): Promise<{ blob: Blob; filename: string }> {
    const imageBytesB64 = asNonEmptyString(args.image_bytes_b64) || asNonEmptyString(args.imageBytesB64);
    const imageMime = asNonEmptyString(args.image_mime) || asNonEmptyString(args.imageMime) || "image/png";
    const imageFilename = asNonEmptyString(args.image_filename) || asNonEmptyString(args.imageFilename) || "panel.png";

    if (imageBytesB64) {
      const bytes = Buffer.from(imageBytesB64, "base64");
      return {
        blob: new Blob([bytes], { type: imageMime }),
        filename: imageFilename,
      };
    }

    const imageUrl = asNonEmptyString(args.image_url) || asNonEmptyString(args.imageUrl);
    if (imageUrl) {
      try {
        const response = await fetch(imageUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const contentType = response.headers.get("content-type") || imageMime;
          return {
            blob: new Blob([arrayBuffer], { type: contentType }),
            filename: imageFilename,
          };
        }
      } catch {
        // fall through to placeholder
      }
    }

    // Minimal 1x1 PNG fallback so the pipeline can run during hackathon stubbing.
    const placeholder = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/WMh2aQAAAAASUVORK5CYII=",
      "base64"
    );
    return {
      blob: new Blob([placeholder], { type: "image/png" }),
      filename: "panel.png",
    };
  }

  private getMetaKnytDirective(): string {
    const baseline = [
      "metaKnyts canon only with 21 Sats shard framing.",
      "Respect twin-thread story logic: metaKnyts conflict plus Satoshi disappearance mystery.",
      'Include Pulse metaphysics and the mantra "All is One. No One is All." in serious tone.',
      "Visual style: dark tech-noir, neon cyan/cobalt/magenta, cyberpunk HUD overlays, mythic sigils.",
      "Do not reveal Satoshi identity and keep PG-13 continuity.",
    ].join(" ");
    const configured = process.env.MOLTCOMICS_METAKNYT_SYSTEM_PROMPT?.trim();
    if (!configured) {
      return baseline;
    }
    return `${baseline} Additional creator directives: ${configured}`;
  }

  private generateStubResult(toolId: string, args: Record<string, unknown>): unknown {
    if (toolId === "knyt.comic.generate_pack") {
      const brief = typeof args.brief === "string" ? args.brief : "21 Sats comic drop";
      return {
        script: `Title: 21 Sats Drop\nPremise: ${brief}`,
        panels: [
          { panel: 1, beat: "Hook", caption: "A whisper from the ledger." },
          { panel: 2, beat: "Tension", caption: "The signal fractures the room." },
          { panel: 3, beat: "Reveal", caption: "metaKnyt aligns with 21 sats." },
          { panel: 4, beat: "CTA", caption: "Join the drop before the window closes." },
        ],
        prompt_pack: [
          "high-contrast comic ink, cinematic framing, neon cyan accents",
          "character close-up, rain reflections, decisive expression",
        ],
      };
    }

    if (toolId === "knyt.animation.generate_pack") {
      return {
        duration_seconds: 20,
        shotlist: [
          "0-5s: Establish neon city and KNYT sigil",
          "5-12s: Character acceleration into data corridor",
          "12-20s: 21 sats motif and launch CTA",
        ],
        prompts: [
          "anime microfilm, dynamic camera pan, volumetric light",
          "clean linework, kinetic typography, glitch transitions",
        ],
      };
    }

    if (toolId === "dpr.run") {
      return {
        passed: true,
        score: 0.94,
        checks: [
          { id: "layout-consistency", status: "pass" },
          { id: "copy-clarity", status: "pass" },
          { id: "contrast", status: "pass" },
        ],
      };
    }

    if (toolId === "marketa.copy.generate_pack") {
      return {
        qriptopian_draft: "The 21 Sats signal is now live. metaKnyt enters the next chapter...",
        cutdowns: [
          "Drop is live. 21 sats unlock the thread.",
          "New KNYT comic pack now staged.",
          "From thread to capsule in one run.",
          "DPR cleared. Ready to publish.",
          "Catch the launch before the window closes.",
        ],
        kickstarter_teaser: "Back the metaKnyt QriptoGraphic novel campaign before launch caps.",
      };
    }

    if (toolId === "moltcomics.chains.continuable") {
      return { chains: [] };
    }

    if (toolId === "moltcomics.chains.create") {
      const chainId = `chain_${Date.now()}`;
      const panelId = `panel_${Date.now()}`;
      return {
        chainId,
        panelId,
        url: `https://moltcomics.com/chains/${chainId}`,
        imageUrl: "https://moltcomics.com/placeholder-panel.png",
      };
    }

    if (toolId === "moltcomics.chains.get") {
      const chainId = asNonEmptyString(args.chain_id) || "chain_stub";
      return {
        chain: { id: chainId, title: "Stub Chain", genre: "sci-fi" },
        currentRound: {
          roundNumber: 1,
          submissions: [],
        },
      };
    }

    if (toolId === "moltcomics.panels.submit") {
      const chainId = asNonEmptyString(args.chain_id) || "chain_stub";
      const panelId = `panel_${Date.now()}`;
      return {
        panelId,
        chainId,
        round: 1,
        roundStatus: "open",
        url: `https://moltcomics.com/chains/${chainId}`,
        imageUrl: `https://moltcomics.com/chains/${chainId}/panel/${panelId}.png`,
      };
    }

    if (toolId === "moltcomics.panels.upvote") {
      return {
        voted: true,
        upvotes: 1,
        standings: { rank: 1, total: 1 },
      };
    }

    return {
      tool_id: toolId,
      status: "stubbed",
      echo: args,
    };
  }
}
