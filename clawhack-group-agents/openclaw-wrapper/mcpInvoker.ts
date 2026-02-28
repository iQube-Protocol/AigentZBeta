import type { MCPInvocationArgs, MCPInvocationResult } from "./types";

interface MCPInvokerConfig {
  timeoutMs?: number;
  allowStubFallback?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class MCPInvoker {
  private config: Required<MCPInvokerConfig>;

  constructor(config: MCPInvokerConfig = {}) {
    this.config = {
      timeoutMs: 12_000,
      allowStubFallback: true,
      ...config,
    };
  }

  async invoke({ tool, provider, args, requestId }: MCPInvocationArgs): Promise<MCPInvocationResult> {
    const endpoint = tool.invoke_endpoint ?? provider?.connection?.endpoint;
    if (endpoint) {
      try {
        const remote = await this.invokeRemote(endpoint, tool.tool_id, args, requestId);
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

  private async invokeRemote(
    endpoint: string,
    toolId: string,
    args: Record<string, unknown>,
    requestId: string
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
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
