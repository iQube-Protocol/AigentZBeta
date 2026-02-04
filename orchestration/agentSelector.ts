/**
 * Agent Selection Logic
 * 
 * Determines which agent(s) should be active based on context
 */

import type { FlowContext } from "./types";

export function selectAgents(flow: FlowContext): {
  primaryAgentId: string;
  secondaryAgentIds: string[];
} {
  const { appId } = flow.location;
  
  // Qriptopian: Kn0w1 for knowledge/content
  if (appId === "Qriptopian") {
    return {
      primaryAgentId: "Kn0w1",
      secondaryAgentIds: ["Copilot"],
    };
  }
  
  // MoneyPenny/StayBull: MoneyPenny for DeFi/trading
  if (appId === "MoneyPenny" || appId === "StayBull") {
    return {
      primaryAgentId: "MoneyPenny",
      secondaryAgentIds: ["Nakamoto", "Copilot"],
    };
  }
  
  // metaKnyts: Kn0w1 for narrative/codex
  if (appId === "metaKnyts") {
    return {
      primaryAgentId: "Kn0w1",
      secondaryAgentIds: ["MetaAvatar"],
    };
  }
  
  // Default: Copilot
  return {
    primaryAgentId: "Copilot",
    secondaryAgentIds: [],
  };
}
