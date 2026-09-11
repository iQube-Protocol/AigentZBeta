import { NextRequest, NextResponse } from "next/server";
import { draftArticleArtifact } from "@/services/composer/articleDraftService";
// CVR-002 — additive consequence tiering for Studio productions.
// Best-effort + failure-isolated: never changes how drafts are generated.
import { tierStudioArtifact } from "@/services/composer/studioArtifactTiering";

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
    const prompt =
      typeof body?.prompt === "string" && body.prompt.trim()
        ? body.prompt
        : typeof body?.goal === "string" && body.goal.trim()
          ? body.goal
          : typeof body?.description === "string" && body.description.trim()
            ? body.description
            : undefined;
    const title = typeof body?.title === "string" && body.title.trim() ? body.title : undefined;
    const result = await draftArticleArtifact({
      experienceName: typeof body?.experienceName === "string" ? body.experienceName : undefined,
      title,
      prompt,
      outputs: Array.isArray(body?.outputs) ? body.outputs : undefined,
      takeawaysCount: typeof body?.takeawaysCount === "number" ? body.takeawaysCount : undefined,
      mediaMode: body?.mediaMode === "video" ? "video" : "image",
      contextHints: Array.isArray(body?.contextHints) ? body.contextHints : undefined,
    });

    // CVR-002 tiering (additive, never throws): a completed draft with a REAL
    // prompt or title is operational documentation and persists as an
    // ArtifactRecord; the unprompted deterministic fallback and a failed draft
    // are disposable and NEVER persisted. Existing response fields unchanged.
    const tiering = await tierStudioArtifact({
      kind: !result.articleDraft
        ? "studio.article.draft.failed"
        : prompt || title
          ? "studio.article.draft.completed"
          : "studio.article.draft.unprompted",
      title: result.articleDraft?.title ?? title ?? null,
      prompt: prompt ?? null,
      provider: result.provider,
      outputs: (result.articleDraft?.sections ?? []).map((s) => ({ label: s.heading })),
    });

    return NextResponse.json({
      ok: true,
      articleDraft: result.articleDraft,
      provider: result.provider,
      ...tiering,
    });
  } catch (error) {
    console.error("[article-draft] generation error", error);
    return NextResponse.json({ ok: false, error: "Failed to generate article draft" }, { status: 500 });
  }
}
