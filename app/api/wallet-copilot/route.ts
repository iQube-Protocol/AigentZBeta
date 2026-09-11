/**
 * Wallet Copilot API Route — DEPRECATED, delegates to MoneyPenny.
 *
 * This used to be a standalone `openai.chat.completions.create()` call with
 * its own tiny hardcoded system prompt and a trivial 6-row `knowledge_base`
 * lookup — zero connection to the platform's actual Invariant Canon /
 * constitutional grounding. It produced fabricated, ungrounded answers (e.g.
 * inventing "Q¢ balance, task rewards, reputation scores" content when asked
 * "what are invariants in metaMe").
 *
 * The wallet Copilot tab (app/components/content/SmartWalletDrawer.tsx) now
 * calls /api/moneypenny/chat directly — the grounded, sovereign-routed
 * MoneyPenny backend. This route is kept ONLY because
 * components/drawer/AgentPanelRenderer.tsx still calls it. It is a thin
 * delegator, NOT a second implementation — do not add logic here. New
 * callers should hit /api/moneypenny/chat directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runMoneyPennyChat, type ChatMessage, type WalletContext } from '@/app/api/moneypenny/chat/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { messages?: ChatMessage[]; context?: WalletContext };
    const { messages, context } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ message: "I'm here to help! What would you like to know?" }, { status: 200 });
    }

    const result = await runMoneyPennyChat({
      messages,
      agent_class: 'moneypenny',
      tenant_id: 'wallet-copilot-legacy',
      context,
    });

    return NextResponse.json({ message: result.response });
  } catch (error) {
    console.error('Wallet Copilot (deprecated → delegates to /api/moneypenny/chat) error:', error);
    return NextResponse.json(
      { message: 'Sorry, I encountered an error. Please try again.' },
      { status: 200 },
    );
  }
}
