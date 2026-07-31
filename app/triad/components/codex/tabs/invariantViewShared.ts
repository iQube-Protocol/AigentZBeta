/**
 * Shared vocabulary for the Invariant browser views (Chrysalis Foundation,
 * CFS-001..014). One canonical home for the namespace/status enumerations,
 * their colour ramps, and the wire row shape — reused by the Browse, Overview,
 * Ontology, and Graph views so the palette can never drift between them.
 */

import { personaFetch } from "@/utils/personaSpine";

export const NAMESPACES = [
  "constitutional",
  "reasoning",
  "engineering",
  "experience",
  "capability",
  "style",
  "narrative",
  "sovereignty",
  "cybernetics",
  "interaction",
  "epistemology",
  "representation",
  "polity",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const STATUSES = [
  "draft",
  "proposed",
  "validated",
  "canonical",
  "rejected",
  "deprecated",
  "superseded",
] as const;

export const NAMESPACE_COLOR: Record<string, string> = {
  constitutional: "bg-violet-950/60 text-violet-300 border-violet-800",
  reasoning: "bg-cyan-950/60 text-cyan-300 border-cyan-800",
  engineering: "bg-slate-800/60 text-slate-300 border-slate-700",
  experience: "bg-amber-950/60 text-amber-300 border-amber-800",
  capability: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
  style: "bg-pink-950/60 text-pink-300 border-pink-800",
  narrative: "bg-indigo-950/60 text-indigo-300 border-indigo-800",
  sovereignty: "bg-teal-950/60 text-teal-300 border-teal-800",
  cybernetics: "bg-sky-950/60 text-sky-300 border-sky-800",
  interaction: "bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800",
  epistemology: "bg-lime-950/60 text-lime-300 border-lime-800",
  representation: "bg-rose-950/60 text-rose-300 border-rose-800",
  polity: "bg-yellow-950/60 text-yellow-300 border-yellow-800",
};

/** Solid dot/bar colour per namespace — for charts where a border-box tag
 *  would be too heavy (histogram bars, graph nodes). */
export const NAMESPACE_FILL: Record<string, string> = {
  constitutional: "bg-violet-500",
  reasoning: "bg-cyan-500",
  engineering: "bg-slate-400",
  experience: "bg-amber-500",
  capability: "bg-emerald-500",
  style: "bg-pink-500",
  narrative: "bg-indigo-500",
  sovereignty: "bg-teal-500",
  cybernetics: "bg-sky-500",
  interaction: "bg-fuchsia-500",
  epistemology: "bg-lime-500",
  representation: "bg-rose-500",
  polity: "bg-yellow-500",
};

/** Hex equivalents of NAMESPACE_FILL — for inline SVG (graph nodes/strokes)
 *  where Tailwind classes don't apply. */
export const NAMESPACE_HEX: Record<string, string> = {
  constitutional: "#8b5cf6",
  reasoning: "#06b6d4",
  engineering: "#94a3b8",
  experience: "#f59e0b",
  capability: "#10b981",
  style: "#ec4899",
  narrative: "#6366f1",
  sovereignty: "#14b8a6",
  cybernetics: "#0ea5e9",
  interaction: "#d946ef",
  epistemology: "#84cc16",
  representation: "#f43f5e",
  polity: "#eab308",
};

export const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-800 text-slate-400",
  proposed: "bg-amber-900/50 text-amber-300",
  validated: "bg-cyan-900/50 text-cyan-300",
  canonical: "bg-emerald-900/50 text-emerald-300",
  rejected: "bg-rose-900/50 text-rose-300",
  deprecated: "bg-slate-800/50 text-slate-500 line-through",
  superseded: "bg-slate-800/50 text-slate-500",
};

export interface InvariantRow {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: string;
  ontologyClassId: string | null;
  semanticType: string | null;
  status: string;
  confidence: number;
  standing: number;
  reach: number;
  createdAt: string;
}

/**
 * Load the full invariant set (Standing-desc, capped server-side at 500).
 * Shared by Overview and Ontology so they compute facets from the same
 * snapshot the Browse view lists.
 */
export async function loadAllInvariants(): Promise<InvariantRow[]> {
  const res = await personaFetch(`/api/invariants?limit=500`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load invariants");
  return data.invariants as InvariantRow[];
}
