/**
 * Narrative Engine - Orchestration Pipeline
 */

import type { FlowContext, AgentId } from './flowContext';

export interface DrawerChange {
  action: 'focusDrawer' | 'focusTab' | 'openDrawer' | 'noChange';
  drawerId?: string;
  tabId?: string;
  reason?: string;
}

export interface NarrativeHints {
  arrive?: string;
  align?: string;
  assess?: string;
  adapt?: string;
  act?: string;
  anchor?: string;
}

export interface OrchestrationDecision {
  flowContext: FlowContext;
  primaryAgentId: AgentId;
  secondaryAgentIds: AgentId[];
  drawerChanges: DrawerChange[];
  narrativeHints: NarrativeHints;
}

export function arrive(flow: FlowContext): string {
  const app = flow.location.appId;
  return `You're in ${app} under your ${flow.persona.id} persona.`;
}

export function align(flow: FlowContext): string {
  return flow.wallet?.balancesSummary || 'Wallet data loading...';
}

export function assess(flow: FlowContext): string {
  if (flow.defi?.hasOpenPositions) {
    return `${flow.defi.runningStrategies} active strategies.`;
  }
  return 'Ready to explore.';
}

export function adapt(flow: FlowContext): { changes: DrawerChange[]; text: string } {
  const changes: DrawerChange[] = [];
  if (flow.location.appId === 'MoneyPenny') {
    changes.push({ action: 'focusDrawer', drawerId: 'portfolio' });
  }
  return { changes, text: 'Layout adapted for your context.' };
}

export function act(flow: FlowContext): string {
  return 'You can explore content, manage your wallet, or chat with an agent.';
}

export function anchor(flow: FlowContext): string {
  return 'Each action advances your journey across mythos, logos, and money.';
}

export function orchestrate(flow: FlowContext): OrchestrationDecision {
  const adaptResult = adapt(flow);
  return {
    flowContext: flow,
    primaryAgentId: flow.location.activeAgentId,
    secondaryAgentIds: ['Copilot'],
    drawerChanges: adaptResult.changes,
    narrativeHints: {
      arrive: arrive(flow),
      align: align(flow),
      assess: assess(flow),
      adapt: adaptResult.text,
      act: act(flow),
      anchor: anchor(flow),
    },
  };
}
