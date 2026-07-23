/**
 * MoneyPenny Chat API Route
 *
 * MoneyPenny is the platform's financial / wallet copilot (Q¢ pricing and
 * settlement, cross-chain quotes, portfolio and risk framing, strategy
 * discussion — see services/agents/specialistRouter.ts's `moneypenny` /
 * 'micro_economics_brief' framing for the canonical domain scope).
 *
 * Previously this route was a pure mock: a random canned string from a
 * hardcoded array, with keyword overrides. Real numbers ("68% win rate",
 * "$2,500 P&L") were fabricated, and it was not grounded in anything.
 *
 * This is now a real, SOVEREIGN, invariant-grounded call:
 *  - callSovereign('reasoning', ...) — the invariant-aware, multi-provider
 *    resilient inference entry point (services/constitutional/modelRouter.ts),
 *    the same entry point app/api/copilot/chat/route.ts and app/api/codex/chat
 *    /route.ts use. Never a bare provider SDK call.
 *  - resolveCitableInvariants(...) — the Invariant Resolution Engine's
 *    per-message grounding projection (services/invariants/resolution.ts),
 *    the SAME service function codex/chat's SmartTriad Phase 2 block calls
 *    (`resolveConstitutionalField`), factored out there as the minimal
 *    reusable grounding assembly so this route reuses it rather than
 *    re-deriving or hand-copying the "cite by seed id" block.
 *
 * Request contract (preserved + extended additively — do not remove fields
 * without checking callers first; app/(shell)/moneypenny/components/
 * MoneyPennyChat.tsx and app/components/content/SmartWalletDrawer.tsx both
 * call this route):
 *   { messages, agent_class?, tenant_id?, context? }
 * Response contract (preserved + extended additively):
 *   { response, message, agent_class, tenant_id, timestamp }
 *   (`message` mirrors `response` — SmartWalletDrawer's wallet Copilot tab
 *   reads `data.message`, MoneyPennyChat.tsx reads `data.response`.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { callSovereign } from '@/services/constitutional/modelRouter';
import { resolveCitableInvariants, formatCitableInvariantsBlock } from '@/services/invariants/resolution';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface WalletContext {
  walletBalance?: number;
  personaId?: string;
  agentName?: string;
}

export interface MoneyPennyChatParams {
  messages: ChatMessage[];
  agent_class?: string;
  tenant_id?: string;
  context?: WalletContext;
}

export interface MoneyPennyChatResult {
  response: string;
  agent_class?: string;
  tenant_id?: string;
  timestamp: string;
}

const MONEYPENNY_SYSTEM_PROMPT = `You are MoneyPenny, the AigentZ platform's financial / wallet copilot — embedded in the SmartWallet drawer's Copilot and MoneyPenny surfaces.

Your domain:
- Q¢ (QriptoCENT) pricing and settlement: how value moves, where it settles, and how the user retains custody (rails include Q¢, KNYT, USDC, PayPal).
- Wallet balance, affordability, and entitlements (content purchases, access grants).
- Portfolio, P&L, and risk/exposure framing — when real figures are supplied in the context below, reference them; never invent one.
- Cross-chain quotes, arbitrage spreads, and liquidity conditions — same rule: only discuss figures actually provided to you.
- Trading / liquidity strategy discussion (e.g. arbitrage hunting, liquidity provision) at a conceptual level.
- Reputation scores, badges, and Q¢ rewards/tasks.

Canonical Q¢ conversion (never restate differently): $1 = 100 Q¢. Show USD as the primary figure when discussing price; Q¢ as a secondary count (e.g. "$9.00 / 900 Q¢").

Ground rules — read carefully:
- NEVER invent specific numbers (balances, P&L, win rates, spreads, APRs) that were not supplied in the User Context below or in the governing invariants block. If you don't have real data for a figure the user asks about, say so honestly and point them at the relevant wallet tab (Wallet, Tasks, Reputation, Rewards, Payments) instead of fabricating one.
- If a governing platform invariant below is directly relevant to your answer, cite it by its bracketed seed id, e.g. [inv.xyz.001]. If none were resolved for this message, do not claim any exist — just answer from your domain framing above.
- Keep responses concise (2-4 sentences) and actionable. Friendly, direct tone.`;

/**
 * The reusable core: resolve invariants relevant to the message, ground the
 * MoneyPenny system prompt with them, and run the sovereign inference call.
 * Exported so app/api/wallet-copilot/route.ts (kept only for its one
 * remaining caller, components/drawer/AgentPanelRenderer.tsx) can DELEGATE
 * to this exact implementation instead of running a second, divergent one.
 */
export async function runMoneyPennyChat(params: MoneyPennyChatParams): Promise<MoneyPennyChatResult> {
  const { messages, agent_class, tenant_id, context } = params;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const messageText = lastUserMessage?.content ?? '';

  // Invariant Resolution Engine (CFS-037) — resolve the invariants relevant
  // to THIS message, exactly like codex/chat's SmartTriad Phase 2 block.
  // Best-effort: resolveCitableInvariants never throws (see resolution.ts),
  // and formatCitableInvariantsBlock returns '' when nothing was resolved —
  // never fabricate a citation block from nothing.
  const citable = await resolveCitableInvariants(messageText);
  const invariantBlock = formatCitableInvariantsBlock(citable);

  const contextStr = context
    ? `\n\nUser Context:\n- Wallet Balance: ${typeof context.walletBalance === 'number' ? context.walletBalance.toFixed(2) : '0'} Q¢\n- Agent: ${context.agentName || 'Unknown'}`
    : '';

  const systemPrompt = `${MONEYPENNY_SYSTEM_PROMPT}${contextStr}${invariantBlock ? `\n\n${invariantBlock}` : ''}`;

  // callSovereign takes a single system + user string (no message-array
  // shape) — fold recent turns into one transcript, latest message last,
  // the same role-prefix convention services/experiments/llm.ts already
  // uses for its single-turn providers (chaingpt).
  const transcript = messages
    .slice(-10)
    .map((m) => `${m.role === 'assistant' ? 'MoneyPenny' : 'User'}: ${m.content}`)
    .join('\n');

  const sovereign = await callSovereign('reasoning', systemPrompt, transcript, 400, 0.7);
  const response = sovereign.text || "I'm here to help! What would you like to know?";

  return {
    response,
    agent_class,
    tenant_id,
    timestamp: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MoneyPennyChatParams;
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 });
    }

    const result = await runMoneyPennyChat(body);

    return NextResponse.json({
      ...result,
      message: result.response,
    });
  } catch (error) {
    console.error('MoneyPenny chat API error:', error);
    return NextResponse.json(
      {
        response: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        message: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
      },
      { status: 200 },
    );
  }
}
