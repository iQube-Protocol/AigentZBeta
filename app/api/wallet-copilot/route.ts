import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function fetchWalletKbText(): Promise<string> {
  if (!supabase) return "";
  const { data, error } = await supabase
    .from("knowledge_base")
    .select("title, content")
    .in("doc_type", ["KNYT", "general"])
    .order("updated_at", { ascending: false })
    .limit(6);
  if (error || !data?.length) return "";
  return data.map((d) => `\n\n### ${d.title}\n${d.content}`).join("");
}

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
When asked about rewards, explain pending vs claimed rewards.

Tier 0 KNYT (Phase 1/1.5):
- KNYT can be earned and spent in the x402/Qripto ledger (gas-free; no external wallet required).
- DVN on ICP is on-chain/public; Supabase is an off-chain mirror/index used for UI/reporting.

Pricing knobs (defaults):
- knytUsdRate=1.40
- paypalFeePercent=0.03, usdcFeePercent=0.01
- fiatPremiumPercent=0.07 (applies to external fiat rails to bias KNYT)
- qctPremiumPercent=0.00 (discounted/waived when paying in Q¢ to drive Q¢ adoption)
- knytDiscountPercent=0.20

Rewards (Phase 1.5):
- Rewards are KNYT credits (micro 0.1–0.25, medium 0.5–1, high-value 2–4).
- Hero tasks: qualified referrals, engagement/streaks, sharing milestones.

Entitlements:
- Buying content grants explicit access entitlements (typically perpetual unless an expiry is set).`;

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return NextResponse.json(
        { message: "I'm currently offline. Please check back later!" },
        { status: 200 }
      );
    }

    const openai = getOpenAI();

    const kbText = await fetchWalletKbText();

    // Build context string
    const contextStr = context
      ? `\n\nUser Context:\n- Wallet Balance: ${context.walletBalance?.toFixed(2) || 0} Q¢\n- Agent: ${context.agentName || 'Unknown'}`
      : '';

    // Convert messages to OpenAI format
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: WALLET_COPILOT_PROMPT + contextStr + (kbText ? `\n\nWallet Knowledge Base:${kbText}` : '') },
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
