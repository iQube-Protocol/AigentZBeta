"use client";

/**
 * Invariant Video Experiment Runner (Chrysalis EXP-002, CFS-011/012 §6).
 *
 * A self-contained Studio-adjacent surface for the "coherence across
 * segments" test: ground a multi-segment video in invariants, generate a
 * per-segment brief, then hand it to the (fixed) SkillVideoPlayer to produce
 * and stitch the segments.
 *
 * Grounding is NAMESPACE-based by default — it resolves a namespace to its
 * invariant ids client-side and passes them to the brief API as
 * `invariantIds` groundings. This is what works against the seeded substrate
 * (83 invariants, 0 collections): the earlier collection-picker build was a
 * dead end because no Level-2 collections have been created yet. Curated
 * collections remain supported by the brief API for when they exist.
 *
 * Deliberately NOT wired into ComposerStudio.tsx's ~9000-line manual-form
 * state machine — deep composer integration is a separate follow-up.
 */

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { personaFetch } from "@/utils/personaSpine";
import SkillVideoPlayer from "@/components/composer/SkillVideoPlayer";

interface SegmentBriefView {
  index: number;
  foregroundedInvariantIds: string[];
  narrativeInvariantId: string | null;
  beat: string;
  prompt: string;
  composedBy: "llm" | "template";
}

interface BriefView {
  continuityBlock: string;
  styleInvariantIds: string[];
  narrativeInvariantIds: string[];
  semanticInvariantIds: string[];
  segments: SegmentBriefView[];
}

interface CoherenceView {
  constitutionalScore: number | null;
  pass: boolean;
  violations: { dimension: string; severity: string; message: string; segmentIndex?: number }[];
  recommendations: { dimension: string; message: string }[];
  dimensions: Record<string, { score: number | null; evaluated: boolean }>;
}

const SEGMENT_COUNT_OPTIONS = [2, 3, 4];

// Namespaces usable as the SEMANTIC grounding (the principles each segment
// dramatizes). style/narrative are handled by their own toggles below.
const SEMANTIC_NAMESPACES = [
  "constitutional",
  "reasoning",
  "capability",
  "experience",
  "engineering",
] as const;

// Resolve a namespace to its invariant ids (proposed/validated/canonical),
// capped so a segment brief stays legible.
async function idsForNamespace(namespace: string, limit = 40): Promise<string[]> {
  const params = new URLSearchParams({ namespace, limit: String(limit) });
  const res = await personaFetch(`/api/invariants?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `Failed to load ${namespace} invariants`);
  return (data.invariants as { id: string }[]).map((i) => i.id);
}

export default function InvariantVideoExperimentRunner() {
  const [semanticNamespace, setSemanticNamespace] = useState<string>("constitutional");
  const [includeStyle, setIncludeStyle] = useState<boolean>(true);
  const [includeNarrative, setIncludeNarrative] = useState<boolean>(true);
  const [semanticLimit, setSemanticLimit] = useState<number>(12);
  const [segmentCount, setSegmentCount] = useState<number>(4);
  const [productionTitle, setProductionTitle] = useState<string>("");
  const [useLlm, setUseLlm] = useState<boolean>(true);
  const [skillId, setSkillId] = useState<string>("venice_video_gen");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [visualStyle, setVisualStyle] = useState<string>("cinematic");

  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefView | null>(null);
  const [coherence, setCoherence] = useState<CoherenceView | null>(null);

  const generateBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    setCoherence(null);
    try {
      const semanticIds = await idsForNamespace(semanticNamespace, semanticLimit);
      if (semanticIds.length === 0) {
        throw new Error(
          `No invariants found in the '${semanticNamespace}' namespace. Run the seed (scripts/ingest-canonical-invariants.mjs) first.`,
        );
      }
      const groundings: { invariantIds: string[]; role: string }[] = [
        { invariantIds: semanticIds, role: "semantic" },
      ];
      if (includeStyle) {
        const styleIds = await idsForNamespace("style");
        if (styleIds.length) groundings.push({ invariantIds: styleIds, role: "style" });
      }
      if (includeNarrative) {
        const narrativeIds = await idsForNamespace("narrative");
        if (narrativeIds.length) groundings.push({ invariantIds: narrativeIds, role: "narrative" });
      }

      const res = await personaFetch("/api/video/invariant-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groundings,
          segmentCount,
          productionTitle: productionTitle || undefined,
          useLlm,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to generate brief");
      setBrief(data.brief as BriefView);
      setCoherence((data.coherence as CoherenceView) ?? null);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Failed to generate brief");
    } finally {
      setBriefLoading(false);
    }
  }, [semanticNamespace, semanticLimit, includeStyle, includeNarrative, segmentCount, productionTitle, useLlm]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Invariant Video Experiment Runner</h2>
        <p className="text-sm text-slate-400 mt-1">
          Chrysalis EXP-002 / CFS-011 (style) / CFS-012 (narrative) — ground a multi-segment video
          in the live invariant substrate: a semantic namespace (the principles each segment
          dramatizes, distributed round-robin), an optional style layer (cinematographic continuity,
          shared identically across segments), and an optional narrative arc (fixed story beats,
          mapped sequentially). Generate the brief, review its coherence, then run it through the
          real generation + stitch pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-slate-300">
          Semantic namespace (the principles — required)
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={semanticNamespace}
            onChange={(e) => setSemanticNamespace(e.target.value)}
          >
            {SEMANTIC_NAMESPACES.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Max semantic invariants to ground on
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={semanticLimit}
            onChange={(e) => setSemanticLimit(Number(e.target.value))}
          >
            {[6, 12, 20, 40].map((n) => (
              <option key={n} value={n}>
                {n} (highest-standing first)
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Segments (12s each)
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={segmentCount}
            onChange={(e) => setSegmentCount(Number(e.target.value))}
          >
            {SEGMENT_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} segments (~{n * 12}s)
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Production title (optional)
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={productionTitle}
            onChange={(e) => setProductionTitle(e.target.value)}
            placeholder="e.g. The Constitutional Internet"
          />
        </label>

        <label className="text-sm text-slate-300 flex items-center gap-2 mt-1">
          <input type="checkbox" checked={includeStyle} onChange={(e) => setIncludeStyle(e.target.checked)} />
          Include Style Invariants (7 seeded — cinematographic continuity, CFS-011)
        </label>

        <label className="text-sm text-slate-300 flex items-center gap-2 mt-1">
          <input type="checkbox" checked={includeNarrative} onChange={(e) => setIncludeNarrative(e.target.checked)} />
          Include Narrative Invariants (5 seeded — fixed story arc, CFS-012)
        </label>

        <label className="text-sm text-slate-300 flex items-center gap-2 mt-1 md:col-span-2">
          <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} />
          Compose cinematic prose with LLM (falls back to a structured template if unavailable)
        </label>
      </div>

      {briefError && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          {briefError}
        </div>
      )}

      <Button onClick={generateBrief} disabled={briefLoading}>
        {briefLoading ? "Generating brief…" : "Generate Brief"}
      </Button>

      {brief && (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Continuity block</h3>
            <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{brief.continuityBlock}</pre>
          </div>

          {coherence && (
            <div
              className={`rounded-lg border p-3 ${
                coherence.pass ? "border-emerald-800 bg-emerald-950/30" : "border-rose-800 bg-rose-950/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">
                  Constitutional Coherence {coherence.pass ? "— PASS" : "— FAIL (rendering gated, CFS-014)"}
                </span>
                <span className="text-sm text-slate-300">CCS: {coherence.constitutionalScore ?? "—"}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                {Object.entries(coherence.dimensions).map(([dim, d]) => (
                  <span key={dim}>
                    {dim}: {d.evaluated ? d.score : "unevaluated"}
                  </span>
                ))}
              </div>
              {coherence.violations.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {coherence.violations.map((v, i) => (
                    <li key={i} className={v.severity === "error" ? "text-rose-300" : "text-amber-300"}>
                      [{v.severity}/{v.dimension}
                      {typeof v.segmentIndex === "number" ? ` · seg ${v.segmentIndex + 1}` : ""}] {v.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {brief.segments.map((segment) => (
            <div key={segment.index} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Segment {segment.index + 1}</span>
                <span>{segment.composedBy === "llm" ? "LLM-composed" : "Template"}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 italic">{segment.beat}</p>
              <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{segment.prompt}</p>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm text-slate-300">
              Skill
              <input
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
              />
            </label>
            <label className="text-sm text-slate-300">
              Aspect ratio
              <input
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
              />
            </label>
            <label className="text-sm text-slate-300">
              Visual style preset
              <input
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value)}
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-xs text-slate-500 mb-2">
              This mounts the real video skill player, seeded with the {brief.segments.length} distinct
              segment prompts above. Use its own "Generate Video" button below to run the live
              generation + stitch pipeline.
            </p>
            <SkillVideoPlayer
              skill_id={skillId}
              prompt={brief.segments[0]?.prompt ?? ""}
              duration={brief.segments.length * 12}
              aspect_ratio={aspectRatio}
              style={visualStyle}
              segment_prompts={brief.segments.map((s) => s.prompt)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
