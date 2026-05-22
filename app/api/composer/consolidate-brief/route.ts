import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { conversation, templateName } = (await request.json()) as {
      conversation: string;
      templateName?: string;
    };

    if (!conversation?.trim()) {
      return NextResponse.json({ error: "No conversation provided" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI key not configured" }, { status: 503 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You are Marketa, an AI creative co-pilot in the iQube ComposerStudio. You have just completed a creative consultation with a user about an experience they want to produce. Your task is to consolidate the full conversation into a structured production brief.

The brief must capture the complete creative intent discussed throughout the conversation — not just the last few messages. If the artifact includes both written content (article/story) AND visual content (image/video), produce separate prompts for each.

Respond ONLY with a valid JSON object in this exact shape:
{
  "brief": "A single comprehensive paragraph describing the full production brief — what is being created, for whom, the tone, style, key themes, and any specific requirements discussed.",
  "titleSuggestions": ["Concise title option 1", "Concise title option 2", "Concise title option 3"],
  "goal": "One concise sentence stating the creative goal of this experience.",
  "articlePrompt": "If the artifact includes written content: the full text generation prompt. Omit this key entirely if no written content is involved.",
  "visualPrompt": "If the artifact includes images or video: the full visual generation prompt including style, mood, composition, and technical specs. Omit this key entirely if no visual content is involved."
}

Keep titleSuggestions concise (3–6 words each). The brief should be comprehensive enough that a developer can generate the artifact without referring back to the conversation.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Template context: ${templateName || "General experience"}\n\n--- Conversation ---\n${conversation}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // fallback to empty object — field defaults below handle gracefully
    }

    const brief =
      typeof parsed.brief === "string" ? parsed.brief : conversation.slice(-800).trim();
    const titleSuggestions = Array.isArray(parsed.titleSuggestions)
      ? (parsed.titleSuggestions as unknown[])
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .slice(0, 3)
      : [];
    const goal = typeof parsed.goal === "string" ? parsed.goal : "";
    const articlePrompt =
      typeof parsed.articlePrompt === "string" ? parsed.articlePrompt : undefined;
    const visualPrompt =
      typeof parsed.visualPrompt === "string" ? parsed.visualPrompt : undefined;

    return NextResponse.json({ brief, titleSuggestions, goal, articlePrompt, visualPrompt });
  } catch (err) {
    console.error("[consolidate-brief]", err);
    return NextResponse.json({ error: "Consolidation failed" }, { status: 500 });
  }
}
