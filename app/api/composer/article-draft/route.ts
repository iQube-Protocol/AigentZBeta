import { NextRequest, NextResponse } from "next/server";
import { draftArticleArtifact } from "@/services/composer/articleDraftService";

/**
 * POST /api/composer/article-draft — the article-generation skill's endpoint
 * (`skill:article_generation`, rendered as article_draft blocks in bundles).
 *
 * THIN WRAPPER (dogfood run 2026-07-13, CS-001 remediation): the generator —
 * previously inlined here with a direct OpenAI client — is extracted to
 * `services/composer/articleDraftService.ts` and routed through
 * `callSovereign` (constitutional model routing + honest fallback). The
 * response shape is UNCHANGED: `{ ok, articleDraft, provider }`, with
 * `provider: 'fallback'` when the deterministic path served.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await draftArticleArtifact({
      experienceName: typeof body?.experienceName === "string" ? body.experienceName : undefined,
      title: typeof body?.title === "string" ? body.title : undefined,
      prompt:
        typeof body?.prompt === "string"
          ? body.prompt
          : typeof body?.goal === "string"
            ? body.goal
            : typeof body?.description === "string"
              ? body.description
              : undefined,
      outputs: Array.isArray(body?.outputs) ? body.outputs : undefined,
      takeawaysCount: typeof body?.takeawaysCount === "number" ? body.takeawaysCount : undefined,
      mediaMode: body?.mediaMode === "video" ? "video" : "image",
      contextHints: Array.isArray(body?.contextHints) ? body.contextHints : undefined,
    });
    return NextResponse.json({ ok: true, articleDraft: result.articleDraft, provider: result.provider });
  } catch (error) {
    console.error("[article-draft] generation error", error);
    return NextResponse.json({ ok: false, error: "Failed to generate article draft" }, { status: 500 });
  }
}
