/**
 * POST /api/composer/remix-draft
 *
 * Mirrors the aigentMe compose-modal drafter: takes a free-form idea
 * about what the user wants to remix and returns a structured draft
 * (title + article prompt + image prompt). Designed to feed the
 * RemixDialog drafter strip and the ComposerStudio customizer.
 *
 * Respects optional constraints set by the super-admin (in Studio) or
 * the admin (in the per-experienceQube customizer) — image style,
 * takeaways count, tone. When the user's idea doesn't describe the
 * image, the LLM infers it from the article description.
 *
 * Falls back to a deterministic template draft when OPENAI_API_KEY is
 * absent, so the UI never dead-ends.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getActivePersona } from "@/services/identity/getActivePersona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Skill = "article" | "story";
type ImageStyle = "editorial" | "cinematic" | "illustrative" | "minimal";

interface RemixDraftBody {
  idea?: string;
  skill?: Skill;
  sourceExperienceId?: string | null;
  constraints?: {
    imageStyle?: ImageStyle;
    takeawaysCount?: number;
    tone?: string;
  };
}

interface RemixDraftResponse {
  ok: true;
  title: string;
  articlePrompt: string;
  imagePrompt: string;
  rationale: string;
  source: "llm" | "template";
}

function buildSystemPrompt(skill: Skill, c?: RemixDraftBody["constraints"]): string {
  const imageStyle = c?.imageStyle ?? "editorial";
  const takeaways = c?.takeawaysCount ?? 3;
  const tone = c?.tone ?? (skill === "story" ? "evocative, in-canon" : "clear, editorial");
  const formatGuide =
    skill === "story"
      ? "Short KNYT-canon fiction, 250–500 words, with a vivid hook."
      : `Editorial article, 600–900 words, with ${takeaways} concrete takeaways.`;
  return [
    "You are aigentMe's remix drafter.",
    "From a one-liner idea, return THREE separate prompts a downstream",
    "generator will use verbatim: a title, an article/story body prompt,",
    "and an image prompt. If the user's idea does not describe the image,",
    "INFER it from the body prompt — never leave imagePrompt blank.",
    "",
    `Skill: ${skill}. ${formatGuide}`,
    `Tone: ${tone}.`,
    `Image style: ${imageStyle}.`,
    "",
    "Respond with strict JSON: { title, articlePrompt, imagePrompt, rationale }.",
    "rationale is one short sentence explaining the framing choice.",
  ].join("\n");
}

function templateDraft(idea: string, skill: Skill, c?: RemixDraftBody["constraints"]): RemixDraftResponse {
  const imageStyle = c?.imageStyle ?? "editorial";
  const trimmed = idea.trim().replace(/\s+/g, " ");
  const titleSeed = trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
  const articlePrompt =
    skill === "story"
      ? `Write a short KNYT-canon story about: ${trimmed}.`
      : `Write an editorial article exploring: ${trimmed}. Include concrete takeaways.`;
  const imagePrompt = `${imageStyle} image illustrating: ${trimmed}.`;
  return {
    ok: true,
    title: titleSeed || "Untitled remix",
    articlePrompt,
    imagePrompt,
    rationale: "Template fallback — no LLM key configured.",
    source: "template",
  };
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { error: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: RemixDraftBody;
  try {
    body = (await req.json()) as RemixDraftBody;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const idea = (body.idea ?? "").trim();
  if (!idea) {
    return NextResponse.json({ error: "idea-required" }, { status: 400 });
  }
  const skill: Skill = body.skill === "story" ? "story" : "article";

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(templateDraft(idea, skill, body.constraints), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.6,
      messages: [
        { role: "system", content: buildSystemPrompt(skill, body.constraints) },
        { role: "user", content: idea },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      title?: string;
      articlePrompt?: string;
      imagePrompt?: string;
      rationale?: string;
    };
    const title = (parsed.title ?? "").trim() || idea.slice(0, 60);
    const articlePrompt = (parsed.articlePrompt ?? "").trim() || idea;
    const imagePrompt =
      (parsed.imagePrompt ?? "").trim() ||
      `${body.constraints?.imageStyle ?? "editorial"} image illustrating: ${idea}.`;
    const rationale = (parsed.rationale ?? "").trim() || "Drafted from your idea.";
    const response: RemixDraftResponse = {
      ok: true,
      title,
      articlePrompt,
      imagePrompt,
      rationale,
      source: "llm",
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[composer/remix-draft] llm failed, falling back to template:", msg);
    return NextResponse.json(templateDraft(idea, skill, body.constraints), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
