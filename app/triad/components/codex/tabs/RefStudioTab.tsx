"use client";

import React, { useState } from "react";
import {
  Pencil, Loader2, Terminal, ChevronRight, CheckCircle2,
  RotateCcw, Upload, FileJson,
} from "lucide-react";
import { AgentiqCartridgeTab } from "./AgentiqCartridgeTab";

interface RefStudioTabProps {
  personaId?: string;
}

type ArtifactType = "ExperienceQube" | "StudioArtifact" | "ContentPack" | "SkillQube";
type TargetDepth = "pill" | "capsule" | "mini_runtime" | "codex";
type LifecycleStatus = "draft" | "review" | "published" | "canonical" | "archived";

const ARTIFACT_TYPES: ArtifactType[] = ["ExperienceQube", "StudioArtifact", "ContentPack", "SkillQube"];
const TARGET_DEPTHS: TargetDepth[] = ["pill", "capsule", "mini_runtime", "codex"];
const LIFECYCLE: LifecycleStatus[] = ["draft", "review", "published", "canonical", "archived"];

const LIFECYCLE_COLORS: Record<LifecycleStatus, string> = {
  draft: "text-slate-300 border-slate-600 bg-slate-800/50",
  review: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  published: "text-green-300 border-green-500/30 bg-green-500/10",
  canonical: "text-violet-300 border-violet-500/30 bg-violet-500/10",
  archived: "text-slate-500 border-slate-700 bg-slate-900/40",
};

interface ArtifactLog {
  id: string;
  action: string;
  status: LifecycleStatus;
  receiptEmitted: boolean;
  timestamp: string;
}

function buildArtifact(
  type: ArtifactType,
  title: string,
  description: string,
  targetDepth: TargetDepth,
  status: LifecycleStatus,
  personaId: string,
): Record<string, unknown> {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  const base = {
    schema_version: "1.0",
    artifact_type: type,
    id: `${slug}-${Date.now()}`,
    slug,
    title,
    description,
    target_depth: targetDepth,
    status,
    created_by: personaId || "anonymous",
    created_at: new Date().toISOString(),
    cartridge_scope: "agentiq-os-cartridge",
    agent_root_did: "did:iqube:aigent-c-os-root",
    receipt_eligible: status === "published" || status === "canonical",
  };

  if (type === "ExperienceQube") {
    return {
      ...base,
      depth_ladder: { pill: null, capsule: null, mini_runtime: null, codex: null },
      nbe_plan: { disposition: "ask", next_experience: null },
    };
  }
  if (type === "SkillQube") {
    return {
      ...base,
      input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      output_schema: { type: "object", properties: { result: { type: "string" } } },
      trust_band: "L1_EXPERIMENTAL",
    };
  }
  if (type === "ContentPack") {
    return { ...base, collections: [], items: [] };
  }
  return { ...base, source: null, runtime: "agentiq-os", entrypoint: null };
}

export function RefStudioTab({ personaId }: RefStudioTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"docs" | "demo">("docs");

  // Compose form state
  const [artifactType, setArtifactType] = useState<ArtifactType>("ExperienceQube");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDepth, setTargetDepth] = useState<TargetDepth>("pill");
  const [status, setStatus] = useState<LifecycleStatus>("draft");
  const [generated, setGenerated] = useState<Record<string, unknown> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [log, setLog] = useState<ArtifactLog[]>([]);

  const pid = personaId ?? "anonymous";

  async function emitEvent(action: string, newStatus: LifecycleStatus, receiptEligible: boolean) {
    if (!personaId) return;
    void fetch("/api/runtime/orchestration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "z_delegated",
        persona_id: personaId,
        journey_stage: "acolyte",
        active_cartridge: "agentiq-os-cartridge",
        from_role: "aigent-z",
        to_role: "aigent-c",
        reason: `Studio demo: ${action} — ${artifactType} "${title || "untitled"}"`,
        receipt_eligible: receiptEligible,
        metadata: {
          studio_demo: true,
          artifact_type: artifactType,
          lifecycle_status: newStatus,
          target_depth: targetDepth,
          agent_root_did: "did:iqube:aigent-c-os-root",
        },
      }),
    });
  }

  function addLog(action: string, newStatus: LifecycleStatus, receiptEmitted: boolean) {
    setLog((prev) => [
      { id: `${Date.now()}`, action, status: newStatus, receiptEmitted, timestamp: new Date().toISOString() },
      ...prev,
    ]);
  }

  function handleGenerate() {
    if (!title.trim()) return;
    setGenerating(true);
    const artifact = buildArtifact(artifactType, title, description, targetDepth, status, pid);
    setTimeout(() => {
      setGenerated(artifact);
      setGenerating(false);
      addLog("Generated artifact", status, false);
    }, 400);
  }

  function advanceLifecycle() {
    const idx = LIFECYCLE.indexOf(status);
    if (idx >= LIFECYCLE.length - 1) return;
    const next = LIFECYCLE[idx + 1];
    setStatus(next);
    if (generated) {
      setGenerated({ ...generated, status: next, receipt_eligible: next === "published" || next === "canonical" });
    }
    const receipt = next === "published" || next === "canonical";
    addLog(`Advanced to ${next}`, next, receipt);
    void emitEvent(`lifecycle → ${next}`, next, receipt);
  }

  function handleMockPublish() {
    setPublishing(true);
    const publishStatus: LifecycleStatus = "published";
    setStatus(publishStatus);
    if (generated) {
      setGenerated({ ...generated, status: publishStatus, receipt_eligible: true });
    }
    addLog("Mock published to open registry", publishStatus, true);
    void emitEvent("mock_publish", publishStatus, true);
    setTimeout(() => setPublishing(false), 600);
  }

  function handleRollback() {
    const prev = LIFECYCLE[Math.max(0, LIFECYCLE.indexOf(status) - 1)];
    setStatus(prev);
    if (generated) {
      setGenerated({ ...generated, status: prev });
    }
    addLog(`Rolled back to ${prev}`, prev, false);
  }

  function handleReset() {
    setGenerated(null);
    setStatus("draft");
    setTitle("");
    setDescription("");
    setLog([]);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab nav */}
      <div className="flex gap-1 rounded-lg border border-slate-700/40 bg-slate-900/30 p-1 w-fit mx-6 mt-6 flex-shrink-0">
        {(["docs", "demo"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveSubTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeSubTab === tab
                ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "docs" ? "Docs" : "Ref Demo"}
          </button>
        ))}
      </div>

      {activeSubTab === "docs" && (
        <div className="flex-1 overflow-auto">
          <AgentiqCartridgeTab
            packId="agentiq-os"
            collectionId="col_reference"
            defaultPath="items/reference-studio.md"
          />
        </div>
      )}

      {activeSubTab === "demo" && (
        <div className="flex-1 overflow-auto p-6 space-y-5 max-w-2xl">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-1.5">
            <p className="text-sm font-semibold text-violet-200 flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Compose StudioArtifact
            </p>
            <p className="text-xs text-slate-400">
              Author a StudioArtifact, advance it through the lifecycle, and observe DVN receipt emission.
              Demonstrates the closed loop: Studio creates → Runtime renders → Codex preserves.
            </p>
          </div>

          {/* Artifact type */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">Artifact Type</p>
            <div className="flex flex-wrap gap-2">
              {ARTIFACT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setArtifactType(t); setGenerated(null); }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    artifactType === t
                      ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. My First ExperienceQube"
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description of what this artifact does"
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-none"
              />
            </div>
          </div>

          {/* Target depth */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">Target Depth</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {TARGET_DEPTHS.map((d, idx) => (
                <React.Fragment key={d}>
                  <button
                    type="button"
                    onClick={() => setTargetDepth(d)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      targetDepth === d
                        ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                        : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {d}
                  </button>
                  {idx < TARGET_DEPTHS.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !title.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
            Generate StudioArtifact
          </button>

          {/* Generated JSON + lifecycle controls */}
          {generated && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Generated Artifact
                  </p>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                </div>
                <pre className="rounded-lg bg-slate-900/60 border border-slate-700/40 p-3 text-[11px] text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                  {JSON.stringify(generated, null, 2)}
                </pre>
              </div>

              {/* Lifecycle status */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-medium">Lifecycle Status</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {LIFECYCLE.map((s, idx) => (
                    <React.Fragment key={s}>
                      <span
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          s === status
                            ? LIFECYCLE_COLORS[s]
                            : "border-slate-800 text-slate-600 bg-transparent"
                        }`}
                      >
                        {s}
                      </span>
                      {idx < LIFECYCLE.length - 1 && (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Lifecycle action buttons */}
              <div className="flex flex-wrap gap-2">
                {status !== "canonical" && status !== "archived" && (
                  <button
                    type="button"
                    onClick={advanceLifecycle}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/20 transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    Advance Lifecycle
                  </button>
                )}
                {status !== "published" && status !== "canonical" && status !== "archived" && (
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={handleMockPublish}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
                  >
                    {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Mock Publish
                  </button>
                )}
                {LIFECYCLE.indexOf(status) > 0 && (
                  <button
                    type="button"
                    onClick={handleRollback}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Rollback
                  </button>
                )}
              </div>
            </>
          )}

          {/* Event log */}
          {log.length > 0 && (
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" />
                Studio Event Log
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {log.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs">
                    <div className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${LIFECYCLE_COLORS[entry.status].split(" ")[0]}`}>
                          {entry.action}
                        </span>
                        {entry.receiptEmitted && (
                          <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-400 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            DVN receipt
                          </span>
                        )}
                        <span className="text-slate-600">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
