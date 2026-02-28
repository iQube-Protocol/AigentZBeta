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
    storyCreate: string;
    storyStatus: string;
    panelSubmit: string;
    roundResult: string;
    storyExport: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    const enabled = process.env.MOLTCOMICS_ENABLED === "true" && process.env.MOLTCOMICS_DIRECT_API !== "false";
    const baseUrl =
      process.env.MOLTCOMICS_API_BASE_URL?.trim() ||
      process.env.MOLTCOMICS_API_ENDPOINT?.trim() ||
      "https://www.moltcomics.com";

    return {
      enabled,
      baseUrl,
      apiKey: process.env.MOLTCOMICS_API_KEY?.trim(),
      agentId: process.env.MOLTCOMICS_AGENT_ID?.trim(),
      endpoints: {
        storyCreate: process.env.MOLTCOMICS_API_PATH_STORY_CREATE || "/api/stories",
        storyStatus: process.env.MOLTCOMICS_API_PATH_STORY_STATUS || "/api/stories/{story_id}",
        panelSubmit:
          process.env.MOLTCOMICS_API_PATH_PANEL_SUBMIT || "/api/stories/{story_id}/panels",
        roundResult:
          process.env.MOLTCOMICS_API_PATH_ROUND_RESULT ||
          "/api/stories/{story_id}/rounds/{round_id}/result",
        storyExport:
          process.env.MOLTCOMICS_API_PATH_STORY_EXPORT || "/api/stories/{story_id}/export",
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

    if (toolId === "moltcomics.story.create") {
      return this.callMoltComics({
        method: "POST",
        pathTemplate: this.moltComics.endpoints.storyCreate,
        args,
        requestId,
        body: {
          ...args,
          agent_id: this.moltComics.agentId,
        },
      });
    }

    if (toolId === "moltcomics.story.status") {
      return this.callMoltComics({
        method: "GET",
        pathTemplate: this.moltComics.endpoints.storyStatus,
        args,
        requestId,
      });
    }

    if (toolId === "moltcomics.panel.submit") {
      return this.callMoltComics({
        method: "POST",
        pathTemplate: this.moltComics.endpoints.panelSubmit,
        args,
        requestId,
        body: {
          ...args,
          agent_id: this.moltComics.agentId,
        },
      });
    }

    if (toolId === "moltcomics.round.result") {
      return this.callMoltComics({
        method: "GET",
        pathTemplate: this.moltComics.endpoints.roundResult,
        args,
        requestId,
      });
    }

    if (toolId === "moltcomics.export.story") {
      return this.callMoltComics({
        method: "POST",
        pathTemplate: this.moltComics.endpoints.storyExport,
        args,
        requestId,
        body: args,
      });
    }

    throw new Error(`Unsupported MoltComics direct tool: ${toolId}`);
  }

  private async callMoltComics(input: {
    method: "GET" | "POST";
    pathTemplate: string;
    args: Record<string, unknown>;
    requestId: string;
    body?: Record<string, unknown>;
  }): Promise<unknown> {
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
    if (input.method !== "GET") {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        method: input.method,
        headers,
        body: input.method === "GET" ? undefined : JSON.stringify(input.body || {}),
        signal: controller.signal,
      });

      const text = await response.text();
      const parsed = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(
          `MoltComics API ${input.method} ${url} failed (${response.status}): ${
            isRecord(parsed) && typeof parsed.message === "string"
              ? parsed.message
              : text.slice(0, 180)
          }`
        );
      }

      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`MoltComics API returned non-JSON response for ${input.method} ${url}`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildMoltComicsUrl(pathTemplate: string, args: Record<string, unknown>): string {
    const tokens: Record<string, string | undefined> = {
      story_id: typeof args.story_id === "string" ? args.story_id : undefined,
      round_id: typeof args.round_id === "string" ? args.round_id : undefined,
      panel_id: typeof args.panel_id === "string" ? args.panel_id : undefined,
      agent_id: this.moltComics.agentId,
    };

    const resolvedPath = pathTemplate.replace(/\{(story_id|round_id|panel_id|agent_id)\}/g, (_, key) => {
      const value = tokens[key];
      if (!value) {
        throw new Error(`Missing required path token: ${key}`);
      }
      return encodeURIComponent(value);
    });

    return new URL(resolvedPath, this.moltComics.baseUrl).toString();
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

    if (toolId === "moltcomics.story.create") {
      const storyId = `story_${Date.now()}`;
      return {
        story_id: storyId,
        url: `https://www.moltcomics.com/story/${storyId}`,
        status: "created",
      };
    }

    if (toolId === "moltcomics.story.status") {
      return {
        story_id: typeof args.story_id === "string" ? args.story_id : "story_stub",
        round_id: `round_${Date.now()}`,
        phase: "submission",
      };
    }

    if (toolId === "moltcomics.panel.submit") {
      const panelId = `panel_${Date.now()}`;
      const storyId = typeof args.story_id === "string" ? args.story_id : "story_stub";
      return {
        panel_id: panelId,
        story_id: storyId,
        panel_url: `https://www.moltcomics.com/story/${storyId}/panel/${panelId}`,
        status: "submitted",
      };
    }

    if (toolId === "moltcomics.round.result") {
      return {
        status: "provisional",
        winner: {
          panel_id: `panel_${Date.now()}`,
          panel_url: "https://www.moltcomics.com/panel/winner",
          caption: "21 sats teaser winner",
        },
      };
    }

    if (toolId === "moltcomics.export.story") {
      return {
        export_url: "https://www.moltcomics.com/export/story-pack.zip",
        manifest: {
          story_id: typeof args.story_id === "string" ? args.story_id : "story_stub",
          assets: [{ type: "panel", url: "https://www.moltcomics.com/panel/winner" }],
        },
      };
    }

    return {
      tool_id: toolId,
      status: "stubbed",
      echo: args,
    };
  }
}
