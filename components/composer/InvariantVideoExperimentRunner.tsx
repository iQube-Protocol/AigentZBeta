"use client";

/**
 * Invariant Video Experiment Runner (Chrysalis EXP-002, CFS-011 §6).
 *
 * A self-contained Studio-adjacent surface for running the "coherence
 * across segments" test: pick a style-invariant grounding + a semantic
 * grounding, generate a per-segment brief, then hand it straight to the
 * (fixed) SkillVideoPlayer to actually produce and stitch the segments.
 *
 * Deliberately NOT wired into ComposerStudio.tsx's manual-form state
 * machine — that file is ~9000 lines of interdependent state, and rewiring
 * its video-prompt path for invariant grounding is a larger, separately
 * reviewable change. This page exercises the real fix (segment_prompts on
 * SkillVideoPlayer + the brief generator) end-to-end today; deep composer
 * integration is tracked as a follow-up.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { personaFetch } from "@/utils/personaSpine";
import SkillVideoPlayer from "@/components/composer/SkillVideoPlayer";

interface CollectionOption {
  id: string;
  name: string;
  namespace: string | null;
}

interface SegmentBriefView {
  index: number;
  foregroundedInvariantIds: string[];
  beat: string;
  prompt: string;
  composedBy: "llm" | "template";
}

interface BriefView {
  continuityBlock: string;
  styleInvariantIds: string[];
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

export default function InvariantVideoExperimentRunner() {
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [styleCollectionId, setStyleCollectionId] = useState<string>("");
  const [narrativeCollectionId, setNarrativeCollectionId] = useState<string>("");
  const [semanticCollectionId, setSemanticCollectionId] = useState<string>("");
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch("/api/invariants/collections", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load collections");
        if (!cancelled) setCollections(data.collections as CollectionOption[]);
      } catch (err) {
        if (!cancelled) {
          setCollectionsError(err instanceof Error ? err.message : "Failed to load collections");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const generateBrief = useCallback(async () => {
    if (!semanticCollectionId) {
      setBriefError("Select a semantic (constitutional/knowledge) collection to ground the segments.");
      return;
    }
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    setCoherence(null);
    try {
      const groundings = [
        ...(styleCollectionId ? [{ collectionId: styleCollectionId, role: "style" }] : []),
        ...(narrativeCollectionId ? [{ collectionId: narrativeCollectionId, role: "narrative" }] : []),
        { collectionId: semanticCollectionId, role: "semantic" },
      ];
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
  }, [styleCollectionId, narrativeCollectionId, semanticCollectionId, segmentCount, productionTitle, useLlm]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Invariant Video Experiment Runner</h2>
        <p className="text-sm text-slate-400 mt-1">
          Chrysalis EXP-002 / CFS-011 (style) / CFS-012 (narrative) — ground a multi-segment
          video in a style-invariant collection (cinematographic continuity, shared identically
          across segments), an optional narrative-invariant collection (a fixed story arc,
          mapped sequentially one beat per segment), and a semantic collection (the principles
          each segment dramatizes, distributed round-robin), then run it through the real
          generation + stitch pipeline to test coherence across segments.
        </p>
      </div>

      {collectionsError && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          {collectionsError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-slate-300">
          Style Invariant Collection (visual/narrative continuity — optional)
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={styleCollectionId}
            onChange={(e) => setStyleCollectionId(e.target.value)}
          >
            <option value="">None</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.namespace ? `(${c.namespace})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Narrative Invariant Collection (fixed story arc — optional)
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={narrativeCollectionId}
            onChange={(e) => setNarrativeCollectionId(e.target.value)}
          >
            <option value="">None</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.namespace ? `(${c.namespace})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Semantic Collection (constitutional / knowledge invariants — required)
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={semanticCollectionId}
            onChange={(e) => setSemanticCollectionId(e.target.value)}
          >
            <option value="">Select a collection…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.namespace ? `(${c.namespace})` : ""}
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
          <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} />
          Compose cinematic prose with LLM (falls back to a structured template if unavailable)
        </label>
      </div>

      {briefError && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          {briefError}
        </div>
      )}

      <Button onClick={generateBrief} disabled={briefLoading || !semanticCollectionId}>
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
                <span className="text-sm text-slate-300">
                  CCS: {coherence.constitutionalScore ?? "—"}
                </span>
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
              This mounts the real video skill player, seeded with the {brief.segments.length}{" "}
              distinct segment prompts above. Use its own "Generate" control below to run the
              live generation + stitch pipeline.
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
