/**
 * Narrative Engine - ARRIVE→ANCHOR Pipeline
 * 
 * Six-phase orchestration for Smart Triad experiences
 */

import type { FlowContext, DrawerChange } from "./types";

// ARRIVE: Where is the user?
export function arrive(flow: FlowContext): string {
  const { appId, activeAgentId } = flow.location;
  const contentLabel = flow.content?.category || "the platform";
  return `You're in ${appId} with ${activeAgentId}, viewing ${contentLabel}.`;
}

// ALIGN: Who is the user?
export function align(flow: FlowContext): string {
  const { identityState, claimsCount } = flow.persona;
  const qc = flow.wallet?.totalQc ?? 0;
  return `Your identity is ${identityState} (${claimsCount || 0} claims), you have ${qc} Q¢.`;
}

// ASSESS: What's possible?
export function assess(flow: FlowContext): string {
  const content = flow.content;
  if (!content) return "No specific content loaded.";
  
  if (content.ownedByUser) {
    return `You own "${content.smartContentId}" — ready to experience it.`;
  }
  
  if (flow.wallet?.hasRequiredFunds) {
    return `You can unlock "${content.smartContentId}" for ${content.priceQc} Q¢.`;
  }
  
  if (flow.wallet?.supportsDeferredMint) {
    return `You can unlock via deferred minting (x402 DVN settlement).`;
  }
  
  return `Insufficient funds. You need ${content.priceQc} Q¢.`;
}

// ADAPT: Drawer + menu changes
export function adapt(flow: FlowContext): { changes: DrawerChange[]; text: string } {
  const changes: DrawerChange[] = [];
  
  // metaKnyts episodes → immersive
  if (flow.location.appId === "metaKnyts" && flow.content?.category === "episode") {
    changes.push({
      action: "resizeDrawer",
      drawerId: "codex",
      size: "immersive-3q",
      menuBehavior: { mode: "collapsed-pill", side: "left" },
      reason: "Entering cinematic episode view",
    });
  }
  
  // MoneyPenny portfolio → modal-centered
  if (flow.intent?.inferredGoal === "cashflow" && flow.defi?.hasOpenPositions) {
    changes.push({
      action: "focusDrawer",
      drawerId: "portfolio",
      size: "modal-centered",
      reason: "Showing DeFi portfolio overview",
    });
  }
  
  // Quick wallet peek
  if (flow.location.activeDrawerId === "wallet" && !flow.location.activeTabId) {
    changes.push({
      action: "resizeDrawer",
      drawerId: "wallet",
      size: "wallet-narrow",
      reason: "Quick balance check",
    });
  }
  
  const text = changes.length > 0
    ? `Opening ${changes[0].drawerId} drawer`
    : "No drawer changes needed";
  
  return { changes, text };
}

// ACT: Suggested actions
export function act(flow: FlowContext): string {
  if (flow.content && !flow.content.ownedByUser && flow.wallet?.hasRequiredFunds) {
    return `Unlock "${flow.content.smartContentId}" with x402 deferred minting.`;
  }
  
  if (flow.defi?.portfolioValue && flow.defi.portfolioValue < 5000) {
    return `Explore yield strategies with MoneyPenny to grow your portfolio.`;
  }
  
  return "Continue exploring available content.";
}

// ANCHOR: Mythos/Logos/Money tie-in
export function anchor(flow: FlowContext): string {
  if (flow.location.appId === "metaKnyts") {
    return "🧩 Mythos: You're stepping into the Order's narrative universe.";
  }
  if (flow.location.appId === "Qriptopian") {
    return "📚 Logos: Building knowledge on the quantum-ready internet.";
  }
  if (flow.location.appId === "MoneyPenny" || flow.location.appId === "StayBull") {
    return "💰 Money: Optimizing cashflow and DeFi strategies.";
  }
  return "The Triad guides your journey: Mythos → Logos → Money.";
}
