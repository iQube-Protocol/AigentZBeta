import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Wallet Copilot System Prompt - focused on wallet operations
const WALLET_COPILOT_PROMPT = `You are the Aigent Z Wallet Copilot, a helpful assistant embedded in the SmartWallet drawer.

Your role is to help users with:
- Understanding their Q¢ (QriptoCENT) balance and what they can afford
- Finding ways to earn more Q¢ through tasks and rewards
- Navigating the wallet features (Library, Tasks, Reputation, Rewards)
- Answering questions about content purchases and payments
- Explaining reputation scores and badges

Keep responses concise (2-3 sentences max) and actionable. Use a friendly, helpful tone.

Context provided:
- walletBalance: User's current Q¢ balance
- agentName: The user's agent/persona name

When asked about affordability, reference their balance.
When asked about earning, mention tasks and engagement rewards.
When asked about rewards, explain pending vs claimed rewards.`;

let _openai: OpenAI | null = null;

function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, context } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: "I'm currently offline. Please check back later!" },
        { status: 200 }
      );
    }

    const openai = getOpenAI();

    // Build context string
    const contextStr = context
      ? `\n\nUser Context:\n- Wallet Balance: ${context.walletBalance?.toFixed(2) || 0} Q¢\n- Agent: ${context.agentName || 'Unknown'}`
      : '';

    // Convert messages to OpenAI format
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: WALLET_COPILOT_PROMPT + contextStr },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 200,
      temperature: 0.7,
    });

    const responseMessage = completion.choices[0]?.message?.content || "I'm here to help! What would you like to know?";

    return NextResponse.json({ message: responseMessage });
  } catch (error) {
    console.error('Wallet Copilot error:', error);
    return NextResponse.json(
      { message: "Sorry, I encountered an error. Please try again." },
      { status: 200 }
    );
  }
}
