/**
 * Agent Voices - Narrative templates for each agent
 * 
 * Each agent has a distinct voice and focus:
 * - Kn0w1: Mythos guide, lore keeper, story-focused
 * - MoneyPenny: Money guide, DeFi strategist, practical
 * - Nakamoto: Logos guide, technical, protocol-focused
 * - Copilot: Neutral helper, bridges all domains
 */

import type { FlowContext, AgentId } from './flowContext';

// =============================================================================
// VOICE TEMPLATES
// =============================================================================

export interface AgentVoice {
  id: AgentId;
  name: string;
  domain: 'mythos' | 'logos' | 'money' | 'bridge';
  tone: string;
  greeting: (flow: FlowContext) => string;
  walletOverview: (flow: FlowContext) => string;
  taskPrompt: (flow: FlowContext) => string;
  contentUnlock: (flow: FlowContext, contentTitle: string, price: string) => string;
  defiSummary: (flow: FlowContext) => string;
  farewell: (flow: FlowContext) => string;
}

// =============================================================================
// KN0W1 - MYTHOS GUIDE
// =============================================================================

export const kn0w1Voice: AgentVoice = {
  id: 'Kn0w1',
  name: 'Kn0w1',
  domain: 'mythos',
  tone: 'mysterious, story-focused, guiding',

  greeting: (flow) => {
    const persona = flow.persona.id;
    if (flow.content?.title) {
      return `Welcome back, ${persona}. The story of "${flow.content.title}" awaits your attention.`;
    }
    return `Welcome back, ${persona}. The codex holds many secrets yet to be revealed.`;
  },

  walletOverview: (flow) => {
    const balance = flow.wallet?.primaryBalance || '0';
    const asset = flow.wallet?.primaryAsset || 'tokens';
    return `Your treasury holds ${balance} ${asset}. These resources fuel your journey through the narrative.`;
  },

  taskPrompt: (flow) => {
    return `Your quest path reveals tasks that will deepen your understanding of the metaKnyts universe.`;
  },

  contentUnlock: (flow, contentTitle, price) => {
    return `"${contentTitle}" beckons. For ${price}, this chapter of the saga becomes yours to explore.`;
  },

  defiSummary: (flow) => {
    if (!flow.defi?.hasOpenPositions) {
      return `The financial realm remains unexplored. Perhaps MoneyPenny can guide you there.`;
    }
    return `Your strategies weave through the financial fabric. ${flow.defi.runningStrategies} threads are active.`;
  },

  farewell: (flow) => {
    return `Until next time, ${flow.persona.id}. The story continues when you return.`;
  },
};

// =============================================================================
// MONEYPENNY - MONEY GUIDE
// =============================================================================

export const moneyPennyVoice: AgentVoice = {
  id: 'MoneyPenny',
  name: 'MoneyPenny',
  domain: 'money',
  tone: 'practical, strategic, supportive',

  greeting: (flow) => {
    if (flow.defi?.hasOpenPositions) {
      const pnl = flow.defi.unrealizedPnl || '0';
      const pnlNum = parseFloat(pnl);
      if (pnlNum > 0) {
        return `Good to see you. Your portfolio is up ${pnl}. Let's keep the momentum going.`;
      } else if (pnlNum < 0) {
        return `Welcome back. Your portfolio is down ${Math.abs(pnlNum)}. Let's review your positions.`;
      }
    }
    return `Hello, ${flow.persona.id}. Ready to optimize your financial position?`;
  },

  walletOverview: (flow) => {
    const balance = flow.wallet?.primaryBalance || '0';
    const asset = flow.wallet?.primaryAsset || 'QCT';
    return `You have ${balance} ${asset} available. ${flow.wallet?.balancesSummary || ''}`;
  },

  taskPrompt: (flow) => {
    return `Here are your pending tasks. Completing them can unlock rewards and improve your strategy performance.`;
  },

  contentUnlock: (flow, contentTitle, price) => {
    const hasEnough = flow.wallet?.hasRequiredFunds;
    if (hasEnough) {
      return `"${contentTitle}" costs ${price}. You have sufficient funds. Shall I proceed with the unlock?`;
    }
    return `"${contentTitle}" costs ${price}. You'll need to add funds or adjust your allocation.`;
  },

  defiSummary: (flow) => {
    if (!flow.defi?.hasOpenPositions) {
      return `You don't have any active DeFi positions. Would you like to explore our strategies?`;
    }
    const strategies = flow.defi.runningStrategies || 0;
    const value = flow.defi.portfolioValue || '0';
    const risk = flow.defi.dominantRiskBand || 'balanced';
    return `You have ${strategies} active strategies with ${value} deployed. Risk profile: ${risk}.`;
  },

  farewell: (flow) => {
    return `Take care. Your portfolio will keep working while you're away.`;
  },
};

// =============================================================================
// NAKAMOTO - LOGOS GUIDE
// =============================================================================

export const nakamotoVoice: AgentVoice = {
  id: 'Nakamoto',
  name: 'Nakamoto',
  domain: 'logos',
  tone: 'technical, precise, protocol-focused',

  greeting: (flow) => {
    const identity = flow.persona.identityState;
    return `Greetings. Your identity state is ${identity}. All transactions are cryptographically secured.`;
  },

  walletOverview: (flow) => {
    const chains = flow.wallet?.primaryAsset ? ['bitcoin'] : [];
    return `Your wallet spans ${chains.length || 'multiple'} chains. All balances are verified on-chain.`;
  },

  taskPrompt: (flow) => {
    return `Protocol tasks await. Each completed task strengthens your position in the network.`;
  },

  contentUnlock: (flow, contentTitle, price) => {
    return `Content unlock for "${contentTitle}" requires ${price}. Transaction will be processed via x402 protocol.`;
  },

  defiSummary: (flow) => {
    if (!flow.defi?.hasOpenPositions) {
      return `No active DeFi positions detected. Smart contracts are ready when you are.`;
    }
    return `${flow.defi.runningStrategies} strategies executing across protocols. All positions are on-chain.`;
  },

  farewell: (flow) => {
    return `Session ending. Your keys, your coins. Stay sovereign.`;
  },
};

// =============================================================================
// COPILOT - BRIDGE AGENT
// =============================================================================

export const copilotVoice: AgentVoice = {
  id: 'Copilot',
  name: 'Copilot',
  domain: 'bridge',
  tone: 'helpful, neutral, adaptive',

  greeting: (flow) => {
    const app = flow.location.appId;
    return `Hi! I'm here to help you navigate ${app}. What would you like to do?`;
  },

  walletOverview: (flow) => {
    return flow.wallet?.balancesSummary || `Your wallet is ready. Let me know if you need help with anything.`;
  },

  taskPrompt: (flow) => {
    return `You have tasks waiting. I can help you work through them or explain what each one involves.`;
  },

  contentUnlock: (flow, contentTitle, price) => {
    return `"${contentTitle}" is available for ${price}. Would you like me to explain what's included?`;
  },

  defiSummary: (flow) => {
    if (!flow.defi?.hasOpenPositions) {
      return `You don't have any DeFi positions yet. I can connect you with MoneyPenny if you're interested.`;
    }
    return `You have ${flow.defi.runningStrategies} active strategies. Need help understanding any of them?`;
  },

  farewell: (flow) => {
    return `See you next time! I'll be here whenever you need help.`;
  },
};

// =============================================================================
// VOICE REGISTRY
// =============================================================================

export const agentVoices: Record<AgentId, AgentVoice> = {
  Kn0w1: kn0w1Voice,
  MoneyPenny: moneyPennyVoice,
  Nakamoto: nakamotoVoice,
  Copilot: copilotVoice,
};

export function getAgentVoice(agentId: AgentId): AgentVoice {
  return agentVoices[agentId] || copilotVoice;
}

export function generateNarrative(
  agentId: AgentId,
  flow: FlowContext,
  narrativeType: keyof Omit<AgentVoice, 'id' | 'name' | 'domain' | 'tone'>
): string {
  const voice = getAgentVoice(agentId);
  const generator = voice[narrativeType];
  
  if (typeof generator === 'function') {
    if (narrativeType === 'contentUnlock') {
      // contentUnlock needs extra params
      return (generator as (f: FlowContext, t: string, p: string) => string)(
        flow,
        flow.content?.title || 'Content',
        '10 QCT'
      );
    }
    return (generator as (f: FlowContext) => string)(flow);
  }
  
  return '';
}
