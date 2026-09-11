"use client";

/**
 * Constitutional Video Skill Runner — the surface for the Constitutional Video
 * experience (ratified grammar 2026-07-19) and, in bundle mode, the
 * "Constitutional Video + Integrated Artefacts" bundle.
 *
 * BLANK CANVAS: the operator supplies the content direction (what the video is
 * about) + the CTA; the skill supplies the grammar and the invariant
 * grounding. Standalone mode POSTs /api/skills/constitutional-video (plan);
 * bundle mode POSTs /api/skills/coherent-bundle (video plan + companion
 * article from ONE shared brief, with a built-in coherence score).
 *
 * The SkillVideoPlayer renders the plan's per-segment prompts, muxes a
 * voiceover onto each segment (segment_post_process → /api/skills/video/mux-audio)
 * and stitches with audio preserved. Per-segment regeneration + recovery come
 * from the shared player.
 *
 * Judgement is opt-in and clearly labelled as optional + credit-spending —
 * never part of generation.
 */

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { personaFetch } from "@/utils/personaSpine";
import SkillVideoPlayer from "@/components/composer/SkillVideoPlayer";
import { idsForNamespace } from "@/components/composer/InvariantVideoExperimentRunner";

const SEMANTIC_NAMESPACES = ["constitutional", "reasoning", "capability", "experience", "engineering"] as const;
const NAMESPACE_THEME_LABELS: Record<string, string> = {
  constitutional: "Principles & values",
  reasoning: "Ideas & reasoning",
  capability: "Product capabilities",
  experience: "Customer experience",
  engineering: "How it's built",
};
const DURATIONS = [24, 36, 48] as const;
const CTA_TARGETS = [
  { value: "passport", label: "Claim Passport" },
  { value: "delegation", label: "Delegate an Agent" },
  { value: "founder-office", label: "Founder Office" },
  { value: "research-lab", label: "Research Lab" },
  { value: "custom", label: "Custom" },
];
const VIDEO_SKILLS = [
  { id: "venice_video_gen", label: "Venice Video (privacy · Badge A)" },
  { id: "sora_video_gen_curated", label: "OpenAI Sora (curated · Badge A)" },
];

export type ConstitutionalVideoAudience = "lab" | "creator";

interface SegmentView {
  index: number;
  prompt: string;
  thresholdStatement: string;
  voiceoverLines: string[];
  isCta: boolean;
}
interface CoherenceView {
  composite?: number | null;
  pass?: boolean;
  constitutionalScore?: number | null;
}
interface PlanView {
  segments: SegmentView[];
  grammar: { pass: boolean; violations: string[] };
  coherence: CoherenceView | null;
  builtInCoherence?: CoherenceView | null;
  article?: { title: string; body: string; composedBy: string } | null;
  brief?: unknown;
  foregroundedInvariantIds?: string[];
  totalSeconds: number;
  segmentCount: number;
  receiptId: string | null;
}

interface JudgeVerdict { marker: string; verdict: string; note: string }
interface JudgeReport {
  score: number;
  pass: boolean;
  perInvariant: JudgeVerdict[];
  hallucinationFlags: number;
  remediationHints: { documentId: string; reason: string; suggestion: string }[];
}

export default function ConstitutionalVideoSkillRunner({
  audience = "lab",
  bundle = false,
  experienceId,
}: {
  audience?: ConstitutionalVideoAudience;
  bundle?: boolean;
  experienceId?: string;
} = {}) {
  const isCreator = audience === "creator";
  const [subject, setSubject] = useState("");
  const [concepts, setConcepts] = useState("");
  const [namespace, setNamespace] = useState<string>("constitutional");
  const [durationSeconds, setDurationSeconds] = useState<number>(48);
  const [ctaTarget, setCtaTarget] = useState<string>("passport");
  const [claimLine, setClaimLine] = useState("");
  const [skillId, setSkillId] = useState(VIDEO_SKILLS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [showArticle, setShowArticle] = useState(true);
  const [videoReceiptId, setVideoReceiptId] = useState<string | null>(null);
  const [judging, setJudging] = useState(false);
  const [judgeReport, setJudgeReport] = useState<JudgeReport | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    setVideoReceiptId(null);
    setJudgeReport(null);
    try {
      if (!subject.trim()) throw new Error("Describe what the video is about — this is your blank canvas.");
      if (!claimLine.trim()) throw new Error("Add a claim line for the closing call to action.");
      const semanticIds = await idsForNamespace(namespace, 24);
      if (semanticIds.length === 0) {
        throw new Error(`No invariants found in the '${namespace}' namespace — run the seed ingest first.`);
      }
      const groundings: { invariantIds: string[]; role: string }[] = [{ invariantIds: semanticIds, role: "semantic" }];
      const styleIds = await idsForNamespace("style", 12);
      if (styleIds.length) groundings.push({ invariantIds: styleIds, role: "style" });

      const contentDirection = {
        subject: subject.trim(),
        concepts: concepts.split(",").map((c) => c.trim()).filter(Boolean),
      };
      const cta = { target: ctaTarget, claimLine: claimLine.trim() };

      let data: Record<string, unknown>;
      if (bundle) {
        const res = await personaFetch("/api/skills/coherent-bundle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            groundings,
            contentDirection,
            assets: ["constitutional_video_plan", "article"],
            video: { durationSeconds, cta },
            productionTitle: subject.trim(),
          }),
        });
        data = await res.json();
        if (!res.ok || !data.ok) throw new Error(String(data.error || "Failed to generate the coherent bundle"));
        const vp = data.videoPlan as { segments?: SegmentView[]; grammar?: PlanView["grammar"] } | null;
        const cohere = data.coherence as (CoherenceView & { foregroundedInvariantIds?: string[] }) | undefined;
        setPlan({
          segments: vp?.segments ?? [],
          grammar: vp?.grammar ?? { pass: true, violations: [] },
          coherence: cohere ?? null,
          builtInCoherence: cohere ?? null,
          article: (data.article as PlanView["article"]) ?? null,
          brief: data.brief,
          foregroundedInvariantIds: cohere?.foregroundedInvariantIds ?? [],
          totalSeconds: (data.totalSeconds as number) ?? durationSeconds,
          segmentCount: (data.segmentCount as number) ?? vp?.segments?.length ?? 0,
          receiptId: (data.bundleReceiptId as string) ?? null,
        });
      } else {
        const res = await personaFetch("/api/skills/constitutional-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "plan", groundings, contentDirection, durationSeconds, cta, productionTitle: subject.trim() }),
        });
        data = await res.json();
        if (!res.ok || !data.ok) throw new Error(String(data.error || "Failed to build the constitutional video plan"));
        setPlan({
          segments: (data.segments as SegmentView[]) ?? [],
          grammar: (data.grammar as PlanView["grammar"]) ?? { pass: true, violations: [] },
          coherence: (data.coherence as CoherenceView) ?? null,
          totalSeconds: (data.totalSeconds as number) ?? durationSeconds,
          segmentCount: (data.segmentCount as number) ?? 0,
          receiptId: (data.planReceiptId as string) ?? null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build the plan");
    } finally {
      setLoading(false);
    }
  }, [subject, concepts, namespace, durationSeconds, ctaTarget, claimLine, bundle]);

  // Mux a voiceover onto each generated segment before stitching (G1 audio).
  const segmentPostProcess = useCallback(
    async (clipUrl: string, index: number): Promise<string> => {
      const seg = plan?.segments[index];
      const lines = seg?.voiceoverLines ?? [];
      if (lines.length === 0) return clipUrl;
      try {
        const res = await personaFetch("/api/skills/video/mux-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clip_url: clipUrl, voiceover_lines: lines, segment_index: index, production_title: subject.trim() || undefined }),
        });
        const data = await res.json();
        return data?.ok && typeof data.video_url === "string" ? data.video_url : clipUrl;
      } catch {
        return clipUrl; // honest degradation — keep the silent clip
      }
    },
    [plan, subject],
  );

  const onVideoCompleted = useCallback(
    async ({ videoUrl }: { videoUrl: string }) => {
      try {
        const res = await personaFetch("/api/skills/constitutional-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "video-complete",
            videoUrl,
            productionTitle: subject.trim() || undefined,
            segments: plan?.segmentCount,
            evaluation: plan?.builtInCoherence
              ? {
                  kind: "coherence",
                  method: "coherence-score/built-in",
                  ref: plan.receiptId,
                  score: plan.builtInCoherence.composite ?? null,
                  pass: plan.builtInCoherence.pass === true,
                  detail: {},
                  judgedBy: null,
                }
              : null,
          }),
        });
        const data = await res.json();
        if (data.videoReceiptId) setVideoReceiptId(String(data.videoReceiptId));
      } catch {
        /* best-effort receipt */
      }
    },
    [subject, plan],
  );

  // Opt-in judge (bundle mode) — spends credits; never part of generation.
  const runJudge = useCallback(async () => {
    if (!plan) return;
    setJudging(true);
    try {
      const documents = [
        { id: "thresholds", text: plan.segments.map((s) => s.thresholdStatement).join("\n") },
        { id: "voiceover", text: plan.segments.flatMap((s) => s.voiceoverLines).join("\n") },
        ...(plan.article?.body ? [{ id: "article", text: plan.article.body }] : []),
      ];
      const res = await personaFetch("/api/skills/coherent-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "judge", documents, invariant_ids: plan.foregroundedInvariantIds ?? [], provider: "anthropic" }),
      });
      const data = await res.json();
      if (res.ok && data.ok) setJudgeReport(data.report as JudgeReport);
      else setError(String(data.error || data.message || "Judgement failed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Judgement failed");
    } finally {
      setJudging(false);
    }
  }, [plan]);

  const coherenceChip = useMemo(() => {
    const c = plan?.builtInCoherence ?? plan?.coherence;
    if (!c) return null;
    const value = c.composite ?? c.constitutionalScore ?? null;
    return { value, pass: c.pass === true };
  }, [plan]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">
          {bundle ? "Constitutional Video + Integrated Artefacts" : "Constitutional Video"}
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {bundle
            ? "Generate a coherent bundle from one invariant substrate — a voiced constitutional video and a companion article, coherent by construction, with a built-in coherence score. Independent judgement is optional (below), never required."
            : "A blank canvas bound by the constitutional grammar. Describe what the video is about; the skill supplies the rules — 12-second micro-films, one constitutional threshold per segment, and a threshold-crossing call to action."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-slate-300 md:col-span-2">
          What is this video about?
          <textarea
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-600"
            rows={2}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. The arrival of AI agents and why a new civic order needs constitutional rules"
          />
        </label>
        <label className="text-sm text-slate-300 md:col-span-2">
          Constitutional concepts to explore (comma-separated, optional)
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-600"
            value={concepts}
            onChange={(e) => setConcepts(e.target.value)}
            placeholder="e.g. personhood, continuity, action, standing"
          />
        </label>
        <label className="text-sm text-slate-300">
          {isCreator ? "Theme" : "Grounding namespace"}
          <select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100" value={namespace} onChange={(e) => setNamespace(e.target.value)}>
            {SEMANTIC_NAMESPACES.map((ns) => (
              <option key={ns} value={ns}>{isCreator ? NAMESPACE_THEME_LABELS[ns] ?? ns : ns}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Duration
          <select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100" value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} seconds ({d / 12} segments)</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          CTA target
          <select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100" value={ctaTarget} onChange={(e) => setCtaTarget(e.target.value)}>
            {CTA_TARGETS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Claim line
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-600"
            value={claimLine}
            onChange={(e) => setClaimLine(e.target.value)}
            placeholder='e.g. "Claim Your Polity Passport."'
          />
        </label>
        <label className="text-sm text-slate-300">
          {isCreator ? "Video provider" : "Video skill"}
          <select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
            {VIDEO_SKILLS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <Button onClick={generate} disabled={loading}>
        {loading ? "Generating…" : bundle ? "Generate coherent bundle" : "Generate constitutional video plan"}
      </Button>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {plan && (
        <div className="space-y-4">
          {/* Verdict chips */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-400">
              {plan.totalSeconds}s = {plan.segmentCount} × 12s
            </span>
            <span
              className={`rounded border px-2 py-0.5 ${plan.grammar.pass ? "border-emerald-700 bg-emerald-950/40 text-emerald-300" : "border-amber-700 bg-amber-950/40 text-amber-300"}`}
              title={plan.grammar.violations.join(" · ") || "Constitutional grammar validated"}
            >
              grammar {plan.grammar.pass ? "· pass" : `· review (${plan.grammar.violations.length})`}
            </span>
            {coherenceChip && (
              <span className={`rounded border px-2 py-0.5 ${coherenceChip.pass ? "border-emerald-700 bg-emerald-950/40 text-emerald-300" : "border-amber-700 bg-amber-950/40 text-amber-300"}`}>
                coherence {coherenceChip.value ?? "—"} {coherenceChip.pass ? "· pass" : "· review"}
              </span>
            )}
            {plan.receiptId && (
              <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-400">receipt {plan.receiptId.slice(0, 12)}…</span>
            )}
            {videoReceiptId && (
              <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-400">video receipt {videoReceiptId.slice(0, 12)}…</span>
            )}
          </div>

          {/* Per-segment thresholds */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1">
            {plan.segments.map((s) => (
              <div key={s.index} className="text-xs text-slate-300">
                <span className="text-slate-500">Segment {s.index + 1}{s.isCta ? " · CTA" : ""}:</span>{" "}
                <span className="font-medium text-slate-100">{s.thresholdStatement}</span>
              </div>
            ))}
          </div>

          {/* Companion article (bundle mode) */}
          {bundle && plan.article?.body && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <button onClick={() => setShowArticle((v) => !v)} className="text-sm font-medium text-slate-100">
                {plan.article.title} <span className="text-slate-500 text-xs">({plan.article.composedBy}) {showArticle ? "▾" : "▸"}</span>
              </button>
              {showArticle && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-300">{plan.article.body}</pre>}
            </div>
          )}

          {/* The video — grammar-scaffolded prompts, voiced per segment, stitched with audio */}
          <SkillVideoPlayer
            skill_id={skillId}
            prompt={plan.segments[0]?.prompt ?? ""}
            segment_prompts={plan.segments.map((s) => s.prompt)}
            segment_post_process={segmentPostProcess}
            preserveAudio
            duration={plan.totalSeconds}
            experience_id={experienceId}
            onCompleted={onVideoCompleted}
          />

          {/* Opt-in judgement (bundle mode) */}
          {bundle && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
              <div className="flex items-center gap-3">
                <Button onClick={runJudge} disabled={judging} variant="outline">
                  {judging ? "Judging…" : "Judge this bundle (optional)"}
                </Button>
                <span className="text-[11px] text-slate-500">Independent fidelity judgement — optional, never required; spends model credits.</span>
              </div>
              {judgeReport && (
                <div className="text-xs text-slate-300 space-y-1">
                  <div className={judgeReport.pass ? "text-emerald-300" : "text-amber-300"}>
                    Fidelity {judgeReport.score} {judgeReport.pass ? "· pass" : "· review"} · {judgeReport.hallucinationFlags} untraceable claim(s)
                  </div>
                  {judgeReport.remediationHints.length > 0 && (
                    <ul className="list-disc pl-5 text-slate-400">
                      {judgeReport.remediationHints.map((h, i) => (
                        <li key={i}>{h.reason} → {h.suggestion === "regenerate_segment" ? "regenerate that segment" : "re-draft the article"}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
