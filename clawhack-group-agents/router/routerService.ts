import type { InboundEvent } from "../schemas/bridgeEvents";

export interface RouterDecision {
  inbound: InboundEvent;
  targetAgent: "openclaw_group_agent" | "aigent_marketa" | "router";
  intent: InboundEvent["routing"]["intent_hint"];
  reason: string;
}

function normalizeIntent(text: string | undefined): InboundEvent["routing"]["intent_hint"] {
  const normalized = (text ?? "").toLowerCase();
  if (!normalized.trim()) return "unknown";
  if (normalized.includes("summarize") || normalized.includes("summary")) return "summarize";
  if (
    normalized.includes("drop") ||
    normalized.includes("comic") ||
    normalized.includes("make") ||
    normalized.includes("21 sats")
  ) {
    return "create_drop";
  }
  if (normalized.includes("help")) return "help";
  return "unknown";
}

export class RouterService {
  route(inbound: InboundEvent): RouterDecision {
    const detectedIntent = normalizeIntent(inbound.message.content.text);
    const explicitIntent = inbound.routing.intent_hint;
    const intent = explicitIntent === "unknown" ? detectedIntent : explicitIntent;

    const targetAgent =
      intent === "create_drop" || intent === "summarize" || intent === "help"
        ? "openclaw_group_agent"
        : "router";

    return {
      inbound: {
        ...inbound,
        routing: {
          ...inbound.routing,
          target_agent: targetAgent,
          intent_hint: intent,
        },
      },
      targetAgent,
      intent,
      reason:
        targetAgent === "openclaw_group_agent"
          ? `Thread-scoped intent matched (${intent})`
          : "No executable intent detected; kept with router",
    };
  }
}

export function createRouterService(): RouterService {
  return new RouterService();
}
