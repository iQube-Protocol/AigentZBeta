"use client";

/**
 * Video + Article Skill Runner — the surface for the 24-second video +
 * corresponding article skill (Implementation Pack executed 2026-07-13).
 *
 * Flow: ground in a semantic namespace (+ optional style/narrative layers,
 * exactly like the EXP-002 runner) → POST /api/skills/video-article → the
 * plan comes back with the 2-segment/24s brief, its coherence validation, the
 * drafted article (article receipt already emitted server-side), then the
 * (fixed) SkillVideoPlayer produces + stitches the two 12-second clips. On
 * the player's completion callback the runner posts mode:'video-complete' to
 * emit the video receipt — closing the pack's receipt plan.
 *
 * Validation plan surfaced inline: 24s by construction (2×12s chip), the
 * article's grounding statement (drafted from the SAME brief), and the
 * coherence score (quality gate).
 */

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { personaFetch } from "@/utils/personaSpine";
import SkillVideoPlayer from "@/components/composer/SkillVideoPlayer";
import { idsForNamespace } from "@/components/composer/InvariantVideoExperimentRunner";

const SEMANTIC_NAMESPACES = ["constitutional", "reasoning", "capability", "experience", "engineering"] as const;

const VIDEO_SKILLS = [
  { id: "venice_video_gen", label: "Venice Video (privacy · Badge A)" },
  { id: "sora_video_gen_curated", label: "OpenAI Sora (curated · Badge A)" },
];

interface SegmentView {
  index: number;
  beat: string;
  prompt: string;
  composedBy: "llm" | "template";
}

interface PlanView {
  brief: {
    continuityBlock: string;
    segments: SegmentView[];
  };
  article: { title: string; body: string; composedBy: string; model?: string; sovereignFloor?: boolean };
  coherence: { constitutionalScore: number | null; pass: boolean } | null;
  alignment: { score: number; pass: boolean; perSegment: { index: number; coverage: number; missingCues: string[] }[] };
  renderPlan: { stitchPasses: number; segmentCount: number; segmentSeconds: number };
  totalSeconds: number;
  segmentCount: number;
  articleReceiptId: string | null;
}

export default function VideoArticleSkillRunner() {
  const [namespace, setNamespace] = useState<string>("constitutional");
  const [includeStyle, setIncludeStyle] = useState(true);
  const [title, setTitle] = useState("");
  const [skillId, setSkillId] = useState(VIDEO_SKILLS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [videoReceiptId, setVideoReceiptId] = useState<string | null>(null);
  const [showArticle, setShowArticle] = useState(true);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    setVideoReceiptId(null);
    try {
      const semanticIds = await idsForNamespace(namespace, 20);
      if (semanticIds.length === 0) {
        throw new Error(`No invariants found in the '${namespace}' namespace — run the seed ingest first.`);
      }
      const groundings: { invariantIds: string[]; role: string }[] = [
        { invariantIds: semanticIds, role: "semantic" },
      ];
      if (includeStyle) {
        const styleIds = await idsForNamespace("style", 12);
        if (styleIds.length) groundings.push({ invariantIds: styleIds, role: "style" });
      }
      const res = await personaFetch("/api/skills/video-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groundings, productionTitle: title.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to build the video-article plan");
      setPlan(data as PlanView);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build the plan");
    } finally {
      setLoading(false);
    }
  }, [namespace, includeStyle, title]);

  // Receipt plan item 1 — the video receipt, on the player's completion seam.
  const onVideoCompleted = useCallback(
    async ({ videoUrl }: { videoUrl: string }) => {
      try {
        const res = await personaFetch("/api/skills/video-article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "video-complete", videoUrl, productionTitle: title.trim() || undefined }),
        });
        const data = await res.json();
        if (data.videoReceiptId) setVideoReceiptId(String(data.videoReceiptId));
      } catch {
        // Receipt is best-effort from the client seam; the video itself is done.
      }
    },
    [title],
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Video + Article Skill</h2>
        <p className="text-sm text-slate-400 mt-1">
          One skill, two corresponding artifacts: a 24-second video (2 × 12s segments, stitched) and a
          companion article — both generated from the SAME invariant-grounded brief, so correspondence
          is structural. Article receipt on plan; video receipt on stitch completion.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-slate-300">
          Semantic namespace (the principles)
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
          >
            {SEMANTIC_NAMESPACES.map((ns) => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Video skill
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
          >
            {VIDEO_SKILLS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300 md:col-span-2">
          Production title (optional)
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-600"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Invariant Primitive, in 24 seconds"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={includeStyle} onChange={(e) => setIncludeStyle(e.target.checked)} />
          Include style continuity layer (CFS-011)
        </label>
      </div>

      <Button onClick={generate} disabled={loading}>
        {loading ? "Building brief + article…" : "Generate plan (brief + article)"}
      </Button>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {plan && (
        <div className="space-y-4">
          {/* Validation plan, surfaced */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded border border-emerald-700 bg-emerald-950/40 px-2 py-0.5 text-emerald-300" title="Validation plan: verify the video is 24 seconds — holds by construction: 2 segments × 12s, one stitch">
              24s = {plan.segmentCount} × 12s
            </span>
            <span className="rounded border border-emerald-700 bg-emerald-950/40 px-2 py-0.5 text-emerald-300" title="Validation plan: the article corresponds to the video — both are generated from the SAME invariant-grounded brief">
              article ⇄ video: same brief
            </span>
            {plan.coherence && (
              <span
                className={`rounded border px-2 py-0.5 ${plan.coherence.pass ? "border-emerald-700 bg-emerald-950/40 text-emerald-300" : "border-amber-700 bg-amber-950/40 text-amber-300"}`}
                title="Validation plan: quality standards — the CFS-014 coherence engine's constitutional score"
              >
                coherence {plan.coherence.constitutionalScore ?? "—"} {plan.coherence.pass ? "· pass" : "· review"}
              </span>
            )}
            {plan.alignment && (
              <span
                className={`rounded border px-2 py-0.5 ${plan.alignment.pass ? "border-emerald-700 bg-emerald-950/40 text-emerald-300" : "border-amber-700 bg-amber-950/40 text-amber-300"}`}
                title={`Automated Content Alignment (heuristic): per-segment coverage of the shared brief — ${plan.alignment.perSegment.map((s) => `seg ${s.index + 1}: ${Math.round(s.coverage * 100)}%`).join(" · ")}`}
              >
                alignment {plan.alignment.score} {plan.alignment.pass ? "· pass" : "· review"}
              </span>
            )}
            {plan.renderPlan && (
              <span
                className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-400"
                title="Rendering Optimization: the structural render plan — segment layout + the minimal stitch tree the pipeline's 2-3-clips-per-stitch limit allows"
              >
                render: {plan.renderPlan.segmentCount} × {plan.renderPlan.segmentSeconds}s · {plan.renderPlan.stitchPasses} stitch pass{plan.renderPlan.stitchPasses === 1 ? "" : "es"}
              </span>
            )}
            {plan.articleReceiptId && (
              <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-400" title="Receipt plan: emitted on successful article generation">
                article receipt {plan.articleReceiptId.slice(0, 12)}…
              </span>
            )}
            {videoReceiptId && (
              <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-400" title="Receipt plan: emitted on successful video generation (stitch completion)">
                video receipt {videoReceiptId.slice(0, 12)}…
              </span>
            )}
          </div>

          {/* The corresponding article */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <button onClick={() => setShowArticle((v) => !v)} className="text-sm font-medium text-slate-100">
              {plan.article.title} <span className="text-slate-500 text-xs">({plan.article.composedBy}{plan.article.model ? ` · ${plan.article.model}` : ""}) {showArticle ? "▾" : "▸"}</span>
            </button>
            {showArticle && (
              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-300">{plan.article.body}</pre>
            )}
          </div>

          {/* The 24-second video — the fixed player, driven by the same brief */}
          <SkillVideoPlayer
            skill_id={skillId}
            prompt={plan.brief.segments[0]?.prompt ?? ""}
            segment_prompts={plan.brief.segments.map((s) => s.prompt)}
            duration={plan.totalSeconds}
            onCompleted={onVideoCompleted}
          />
        </div>
      )}
    </div>
  );
}
