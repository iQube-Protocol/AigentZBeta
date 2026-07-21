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
import SkillVideoPlayer, { stitchHierarchical } from "@/components/composer/SkillVideoPlayer";
import { experimentGet } from "./experimentStepFetch";

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

// The Studio's integrated video skills (services/composer/studioSkillCatalog.ts).
// Provider is inferred from the id by SkillVideoPlayer (contains 'venice' →
// Venice; else OpenAI Sora).
const VIDEO_SKILLS = [
  { id: "venice_video_gen", label: "Venice Video (privacy · Badge A)" },
  { id: "sora_video_gen_curated", label: "OpenAI Sora (curated · Badge A)" },
  { id: "sora_video_gen_community", label: "Sora (community · Badge C)" },
];

// Venice model options — mirror the curated select in composerStore.ts, which
// itself mirrors VENICE_PREFERRED_TEXT_TO_VIDEO_MODELS in
// app/api/skills/invoke/route.ts. Do not add models not registered there.
// Empty = let the server pick by priority.
const VENICE_VIDEO_MODELS = [
  { value: "", label: "Auto (server priority)" },
  { value: "ltx-2-19b-full-text-to-video", label: "LTX-2 19B" },
  { value: "kling-2.6-pro-text-to-video", label: "Kling 2.6 Pro" },
  { value: "kling-2.5-turbo-pro-text-to-video", label: "Kling 2.5 Turbo Pro" },
  { value: "veo3.1-fast-text-to-video", label: "Veo 3.1 Fast" },
  { value: "wan-2.6-text-to-video", label: "Wan 2.6" },
  { value: "wan-2.5-preview-text-to-video", label: "Wan 2.5 (preview)" },
];
const SEMANTIC_NAMESPACES = [
  "constitutional",
  "reasoning",
  "capability",
  "experience",
  "engineering",
] as const;

// Resolve a namespace to its invariant ids (proposed/validated/canonical),
// capped so a segment brief stays legible. Exported for the video-article
// skill runner, which grounds the same way.
export async function idsForNamespace(namespace: string, limit = 40): Promise<string[]> {
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
  const [veniceModel, setVeniceModel] = useState<string>("");
  const [trustOverride, setTrustOverride] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [visualStyle, setVisualStyle] = useState<string>("cinematic");

  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefView | null>(null);
  const [coherence, setCoherence] = useState<CoherenceView | null>(null);
  // Ontology drift check over the COMPOSED brief prose (CFS-015 Phase 1B) —
  // non-canonical terms the render would propagate.
  const [ontologyUnresolved, setOntologyUnresolved] = useState<string[]>([]);

  const generateBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    setCoherence(null);
    setOntologyUnresolved([]);
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
      setOntologyUnresolved(((data.ontology as { unresolved?: string[] } | undefined)?.unresolved) ?? []);
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

      {/* Recovery FIRST — repairing a previous run's failed stitch must never
          require generating a new brief (that reads as a new experiment). */}
      <SegmentRecoveryPanel veniceModel={veniceModel} />

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
              {ontologyUnresolved.length > 0 && (
                <p className="mt-2 text-xs text-amber-300">
                  Ontology drift in composed prose (CFS-015): non-canonical term
                  {ontologyUnresolved.length > 1 ? "s" : ""} {ontologyUnresolved.join(", ")} — review before rendering.
                </p>
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="text-sm text-slate-300">
              Video skill / provider
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
            <label className={`text-sm ${skillId.includes("venice") ? "text-slate-300" : "text-slate-600"}`}>
              Venice model
              <select
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 disabled:opacity-50"
                value={veniceModel}
                onChange={(e) => setVeniceModel(e.target.value)}
                disabled={!skillId.includes("venice")}
                title={skillId.includes("venice") ? undefined : "Applies to the Venice skill only"}
              >
                {VENICE_VIDEO_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
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

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={trustOverride}
              onChange={(e) => setTrustOverride(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900"
            />
            Accept lower trust badge
            <span className="text-xs text-slate-500">
              — required for Badge C skills (e.g. Sora community, composite 52 vs the 60 hydration
              gate). The gate is the platform's trust posture doing its job; this is the explicit
              operator waiver, per experiment run.
            </span>
          </label>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-xs text-slate-500 mb-2">
              This mounts the real video skill player, seeded with the {brief.segments.length} distinct
              segment prompts above. Use its own "Generate Video" button below to run the live
              generation + stitch pipeline. Cross-model runs are separate experiment instances —
              record the skill/model alongside each result, never as comparable rows.
            </p>
            {/* Keyed remount so switching skill/model between runs resets the
                player's job state instead of mixing providers mid-flight. */}
            <SkillVideoPlayer
              key={`${skillId}:${veniceModel}:${trustOverride}`}
              skill_id={skillId}
              prompt={brief.segments[0]?.prompt ?? ""}
              duration={brief.segments.length * 12}
              aspect_ratio={aspectRatio}
              style={visualStyle}
              segment_prompts={brief.segments.map((s) => s.prompt)}
              venice_model={skillId.includes("venice") && veniceModel ? veniceModel : undefined}
              trust_override={trustOverride}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Segment recovery — re-stitch already-generated clips ------------------

interface RecoverableSegment {
  kind: "sora" | "venice";
  name: string;
  clipUrl: string;
  thumbnailUrl: string | null;
  createdAt: string | null;
  sizeBytes: number | null;
}

interface SequenceView {
  sequenceId: string;
  createdAt: string;
  skillId: string;
  provider: "openai" | "venice";
  veniceModel: string | null;
  title: string | null;
  segments: { index: number; provider: string; generationId: string; prompt?: string; clipUrl: string; persistedCopy: boolean }[];
}

/**
 * Recovers orphaned segments from a run whose clips generated but whose stitch
 * pass failed (e.g. the 2026-07-05 "ffmpeg binary unavailable" incident). The
 * clips persist server-side — Sora in Supabase storage, Venice retrievable by
 * queueId (recovered from the persisted thumbnails) — so re-stitching costs
 * nothing; only regeneration is expensive. Select the clips IN PLAY ORDER,
 * then stitch.
 */
function SegmentRecoveryPanel({ veniceModel }: { veniceModel: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<RecoverableSegment[] | null>(null);
  const [sequences, setSequences] = useState<SequenceView[] | null>(null);
  // Clip URLs in play order.
  const [selected, setSelected] = useState<string[]>([]);
  const [stitching, setStitching] = useState(false);
  const [stitchError, setStitchError] = useState<string | null>(null);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Sequences are the primary recovery unit (recorded at submit time,
      // ordered); the raw clip list is the fallback for pre-manifest runs.
      const [segData, seqData] = await Promise.all([
        experimentGet("/api/skills/video/recoverable-segments"),
        experimentGet("/api/skills/video/sequences").catch(() => ({ sequences: [] })),
      ]);
      setSegments(segData.segments as RecoverableSegment[]);
      setSequences((seqData.sequences as SequenceView[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list recoverable segments");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && segments === null && !loading) void load();
  };

  // Venice clips need the model on the proxy URL for /retrieve; use the
  // runner's Venice-model dropdown (must match the model the clips were
  // generated with).
  const urlFor = (seg: RecoverableSegment) =>
    seg.kind === "venice" && veniceModel
      ? `${seg.clipUrl}?model=${encodeURIComponent(veniceModel)}`
      : seg.clipUrl;

  const stitchUrls = async (urls: string[]) => {
    setStitching(true);
    setStitchError(null);
    setStitchedUrl(null);
    const res = await stitchHierarchical(urls, undefined);
    if (res.ok && res.video_url) setStitchedUrl(res.video_url);
    else setStitchError(res.error || "Stitch failed");
    setStitching(false);
  };

  const stitchSelected = () => stitchUrls(selected);

  // Stitch a recorded sequence in its manifest order — the proposed play
  // order is shown in the UI and honoured verbatim: Constitutional
  // Sequencing (Law XV corollary) applied to the recovery path.
  const stitchSequence = (seq: SequenceView) =>
    stitchUrls([...seq.segments].sort((a, b) => a.index - b.index).map((s) => s.clipUrl));

  // Sequencing control arm (EXP-002): same clips, deliberately REVERSED
  // order. Every segment is locally correct; only the temporal ordering is
  // violated — the composed film should read as incoherent (completion before
  // establishment), demonstrating inv.constitutional.078 with the identical
  // component set. Record results as a separate experiment instance.
  const stitchSequenceReversed = (seq: SequenceView) =>
    stitchUrls([...seq.segments].sort((a, b) => b.index - a.index).map((s) => s.clipUrl));

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
      <button onClick={toggleOpen} className="text-sm text-slate-300 hover:text-slate-100 font-medium">
        {open ? "▾" : "▸"} Recover unstitched segments
        <span className="ml-2 text-xs text-slate-500 font-normal">
          re-stitch clips from a run whose stitch pass failed — nothing gets regenerated
        </span>
      </button>

      {open && (
        <>
          {loading && <p className="text-xs text-slate-500">Listing generated segments…</p>}
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {segments !== null && segments.length === 0 && (sequences?.length ?? 0) === 0 && (
            <p className="text-xs text-slate-500">No recoverable segments found in storage.</p>
          )}

          {/* Experiment sequences — recorded at submit time, in play order.
              One click stitches the whole run; no picking clips from a pile. */}
          {sequences !== null && sequences.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-300">Experiment sequences (recorded play order)</p>
              {sequences.map((seq) => (
                <div key={seq.sequenceId} className="rounded border border-indigo-900/60 bg-indigo-950/20 px-2.5 py-2 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-indigo-950 border border-indigo-800 px-1.5 py-0.5 text-[10px] text-indigo-300">
                      {seq.segments.length} segments
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {seq.provider}{seq.veniceModel ? ` / ${seq.veniceModel}` : ""}
                    </span>
                    <span className="text-[10px] text-slate-600">{new Date(seq.createdAt).toLocaleString()}</span>
                  </div>
                  {seq.title && <p className="text-[11px] text-slate-500 truncate" title={seq.title}>{seq.title}</p>}
                  <ol className="space-y-0.5">
                    {[...seq.segments].sort((a, b) => a.index - b.index).map((s) => (
                      <li key={s.generationId} className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="rounded bg-slate-800 px-1 text-slate-300">#{s.index + 1}</span>
                        <span className="truncate flex-1" title={s.generationId}>{s.generationId}</span>
                        {s.persistedCopy ? (
                          <span className="text-emerald-400">stored</span>
                        ) : (
                          <span className="text-amber-400" title="No persisted copy — stitches via the provider proxy while the provider retains the asset">
                            provider-only
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      disabled={stitching}
                      onClick={() => stitchSequence(seq)}
                      className="text-xs bg-indigo-700 hover:bg-indigo-600 text-white"
                    >
                      {stitching ? "Stitching…" : `Stitch sequence in order (${seq.segments.length} clips)`}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={stitching}
                      onClick={() => stitchSequenceReversed(seq)}
                      className="text-xs text-amber-400 hover:text-amber-300"
                      title="Sequencing control arm: identical clips, deliberately reversed order — every component locally correct, only the temporal ordering violated (inv.constitutional.078)"
                    >
                      Stitch reversed (sequencing control)
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {segments !== null && segments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Newest first. Click <span className="text-slate-300">Add</span> on each clip of your
                run <span className="text-slate-300">in play order</span> (Venice clips: make sure the
                Venice model dropdown above matches the model the run used).
              </p>
              <div className="max-h-64 overflow-auto space-y-1">
                {segments.map((seg) => {
                  const url = urlFor(seg);
                  const idx = selected.indexOf(url);
                  return (
                    <div key={`${seg.kind}:${seg.name}`} className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                      {seg.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={seg.thumbnailUrl} alt="" className="h-8 w-14 rounded object-cover bg-slate-800" />
                      ) : (
                        <div className="h-8 w-14 rounded bg-slate-800" />
                      )}
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${seg.kind === "sora" ? "bg-sky-950 text-sky-300" : "bg-violet-950 text-violet-300"}`}>
                        {seg.kind}
                      </span>
                      <span className="flex-1 truncate text-[11px] text-slate-400" title={seg.name}>{seg.name}</span>
                      <span className="text-[10px] text-slate-600">
                        {seg.createdAt ? new Date(seg.createdAt).toLocaleString() : ""}
                      </span>
                      {idx >= 0 ? (
                        <button
                          onClick={() => setSelected(selected.filter((u) => u !== url))}
                          className="rounded bg-emerald-900/60 px-2 py-0.5 text-[10px] text-emerald-300"
                        >
                          #{idx + 1} · remove
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelected([...selected, url])}
                          className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={selected.length < 2 || stitching}
                  onClick={stitchSelected}
                  className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white"
                >
                  {stitching ? "Stitching…" : `Stitch ${selected.length} clips in order`}
                </Button>
                {selected.length > 0 && (
                  <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={() => setSelected([])}>
                    Clear selection
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={load}>
                  Refresh list
                </Button>
              </div>

              {stitchError && <p className="text-xs text-rose-400">{stitchError}</p>}
              {stitchedUrl && (
                <div className="space-y-1">
                  <video src={stitchedUrl} controls className="w-full max-w-xl rounded border border-slate-800" />
                  <p className="text-[10px] text-slate-500 break-all">Stitched: {stitchedUrl}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
