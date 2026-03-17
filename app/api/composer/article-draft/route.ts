import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ArticleDraftArtifact = {
  title: string;
  deck: string;
  opening: string;
  sections: Array<{ heading: string; body: string }>;
  takeaways: string[];
  glossary: Array<{ term: string; definition: string }>;
  nextAction: string | null;
};

function firstNonEmptyString(values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function trimTrailingPunctuation(value: string) {
  return value.trim().replace(/[.?!]+$/g, "");
}

function sentence(value: string, fallback: string) {
  const normalized = trimTrailingPunctuation(value || "");
  if (!normalized) return fallback;
  return `${normalized}.`;
}

function buildFallbackArticleDraftArtifact(params: {
  experienceName?: string | null;
  title?: string | null;
  prompt?: string | null;
  outputs?: string[];
  takeawaysCount?: number;
  mediaMode?: "image" | "video";
}): ArticleDraftArtifact | null {
  const title = firstNonEmptyString([params.title, params.experienceName, "Editorial draft"]);
  const prompt = firstNonEmptyString([params.prompt]);
  if (!title && !prompt) return null;

  const outputs = normalizeStringArray(params.outputs);
  const takeawaysCount = Math.min(Math.max(params.takeawaysCount || 3, 1), 5);
  const mediaNoun = params.mediaMode === "video" ? "video experience" : "visual experience";
  const promptSentence = sentence(
    prompt || "",
    `Frame the current ${mediaNoun} with a supporting editorial narrative`,
  );
  const deck = `${title || "Editorial draft"} pairs the current ${mediaNoun} with copy that explains why it matters and what the audience should do next.`;
  const opening = `${promptSentence} This draft is structured to help the audience understand the core idea quickly, then move into the supporting details with confidence.`;
  const sections = [
    {
      heading: "Why this matters",
      body: `Use this section to establish the editorial thesis behind ${title || "the experience"} and explain why the audience should care right now.`,
    },
    {
      heading: params.mediaMode === "video" ? "How to watch this" : "How to read the visual",
      body: `Anchor the audience in the primary ${mediaNoun}, call out the important cues to notice, and connect those cues back to the editorial prompt.`,
    },
    {
      heading: "What to do next",
      body: "Close with the strongest practical takeaway, the intended action, and any reward, quest, or follow-on experience the audience should open next.",
    },
  ];

  const takeaways = Array.from({ length: takeawaysCount }, (_, index) => {
    if (index === 0) return `Lead with the core thesis behind ${title || "this experience"}.`;
    if (index === 1) return `Tie the ${mediaNoun} directly to the supporting editorial explanation.`;
    if (index === 2) return "Make the audience's next action explicit and easy to follow.";
    if (index === 3) return "Use the supporting copy to reinforce trust, provenance, and reward context.";
    return "Keep the closing summary concise enough to work as a launch or share-ready capsule.";
  });

  return {
    title: title || "Editorial draft",
    deck,
    opening,
    sections,
    takeaways: outputs.includes("takeaways") ? takeaways : [],
    glossary: outputs.includes("glossary")
      ? [
          {
            term: "Editorial frame",
            definition: "The short narrative layer that explains what the audience is seeing and why it matters.",
          },
          {
            term: "Supporting context",
            definition: "Companion copy that turns a media asset into a guided experience rather than a standalone artifact.",
          },
        ]
      : [],
    nextAction: outputs.includes("next_action")
      ? "Prompt the user to continue into the linked experience, unlock the next capsule, or share the strongest takeaway."
      : null,
  };
}

function asArticleDraftArtifact(value: unknown): ArticleDraftArtifact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const title = firstNonEmptyString([record.title]) || "Editorial draft";
  const deck = firstNonEmptyString([record.deck]) || "";
  const opening = firstNonEmptyString([record.opening]) || "";
  const sections = Array.isArray(record.sections)
    ? record.sections
        .filter(
          (item): item is { heading: string; body: string } =>
            Boolean(
              item &&
                typeof item === "object" &&
                !Array.isArray(item) &&
                typeof (item as { heading?: unknown }).heading === "string" &&
                typeof (item as { body?: unknown }).body === "string",
            ),
        )
        .map((item) => ({
          heading: item.heading.trim(),
          body: item.body.trim(),
        }))
        .filter((item) => item.heading && item.body)
    : [];
  const takeaways = normalizeStringArray(record.takeaways);
  const glossary = Array.isArray(record.glossary)
    ? record.glossary
        .filter(
          (item): item is { term: string; definition: string } =>
            Boolean(
              item &&
                typeof item === "object" &&
                !Array.isArray(item) &&
                typeof (item as { term?: unknown }).term === "string" &&
                typeof (item as { definition?: unknown }).definition === "string",
            ),
        )
        .map((item) => ({
          term: item.term.trim(),
          definition: item.definition.trim(),
        }))
        .filter((item) => item.term && item.definition)
    : [];
  const nextAction = typeof record.nextAction === "string" && record.nextAction.trim() ? record.nextAction.trim() : null;

  if (!deck && !opening && sections.length === 0) return null;

  return {
    title,
    deck,
    opening,
    sections,
    takeaways,
    glossary,
    nextAction,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const experienceName = firstNonEmptyString([body?.experienceName]) || "";
    const title = firstNonEmptyString([body?.title, experienceName]) || "Editorial draft";
    const prompt = firstNonEmptyString([body?.prompt, body?.goal, body?.description]) || "";
    const outputs = normalizeStringArray(body?.outputs);
    const takeawaysCount =
      typeof body?.takeawaysCount === "number" && Number.isFinite(body.takeawaysCount)
        ? Math.min(Math.max(body.takeawaysCount, 1), 5)
        : 3;
    const mediaMode = body?.mediaMode === "video" ? "video" : "image";
    const contextHints = normalizeStringArray(body?.contextHints);
    const fallback = buildFallbackArticleDraftArtifact({
      experienceName,
      title,
      prompt,
      outputs,
      takeawaysCount,
      mediaMode,
    });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        ok: true,
        articleDraft: fallback,
        provider: "fallback",
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content:
            "You are an editorial experience writer. Return strict JSON only with keys: title, deck, opening, sections, takeaways, glossary, nextAction. " +
            "Write concrete consumer-facing copy for a bundled media + article experience. Do not use placeholders or meta commentary. " +
            "Each section body should be substantive and specific to the prompt and context.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate a polished supporting article draft for a media bundle.",
            experienceName,
            title,
            prompt,
            outputs,
            takeawaysCount,
            mediaMode,
            contextHints,
            requirements: {
              deck: "1-2 sentences",
              opening: "1 short paragraph",
              sections: "3 or 4 sections, each with a heading and 2-4 sentences",
              takeaways: outputs.includes("takeaways") ? `${takeawaysCount} concise takeaways` : "omit if not requested",
              glossary: outputs.includes("glossary") ? "2-4 glossary terms" : "omit if not requested",
              nextAction: outputs.includes("next_action") ? "1 concise CTA" : "omit if not requested",
            },
          }),
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    const parsed = content ? asArticleDraftArtifact(JSON.parse(content)) : null;

    return NextResponse.json({
      ok: true,
      articleDraft: parsed || fallback,
      provider: parsed ? "openai" : "fallback",
    });
  } catch (error) {
    console.error("[article-draft] generation error", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate article draft",
      },
      { status: 500 },
    );
  }
}
