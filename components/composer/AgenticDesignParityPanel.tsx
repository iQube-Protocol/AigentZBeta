"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  LayoutGrid,
  Play,
  RefreshCw,
  Settings,
  XCircle,
  Zap,
} from "lucide-react";
import type { DesignQube, DesignQubeThemeMode } from "@/types/designQube";
import { DISGenerator, type DesignIntentSpec } from "@/app/services/designParity/DesignIntentSpec";
import { ConstraintManifestGenerator, type ConstraintManifest } from "@/app/services/designParity/ConstraintManifest";
import { ParityChecker, type DesignParityReport } from "@/app/services/designParity/ParityChecker";

type ExperienceQubeLike = {
  id: string;
  name: string;
  description: string;
  goal: string;
  mechanics: string;
  metrics: string;
  template_id: string;
  status: string;
  configuration?: Record<string, any>;
  metadata?: { category?: string; version?: string };
};

type PipelineState = {
  status: "idle" | "loading" | "success" | "error";
  dis?: DesignIntentSpec;
  cm?: ConstraintManifest;
  parityReport?: DesignParityReport;
  error?: string;
  appraisedExperienceId?: string;
};

type AgenticDesignParityPanelProps = {
  designQube: DesignQube | null;
  activeDesignQubeId: string;
  designTheme: DesignQubeThemeMode;
  experiences: ExperienceQubeLike[];
  previewExperience: ExperienceQubeLike | null;
  previewAction: string | null;
  onOpenExperience?: (experienceId: string) => void;
  onOpenRuntimePreview?: () => void;
};

const toPx = (value: unknown, fallback: string) => {
  if (typeof value === "number") return `${value}px`;
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback;
};

const toHex = (input: string | undefined, fallback: string) => {
  if (!input || typeof input !== "string") return fallback;
  return input;
};

const buildTemplateRegistry = (designQube: DesignQube | null, experiences: ExperienceQubeLike[]) => {
  const fromExperienceTemplates = experiences
    .map((experience) => experience.template_id)
    .filter(Boolean)
    .map((templateId) => ({ id: templateId, category: "card", name: templateId }));

  const fromStructurePriority =
    designQube?.structureQube?.templateSelection?.priority?.map((templateId) => {
      const lowered = String(templateId).toLowerCase();
      const category = lowered.includes("nav")
        ? "navigation"
        : lowered.includes("button")
          ? "button"
          : "card";
      return { id: templateId, category, name: templateId };
    }) || [];

  const defaults = [
    { id: "button-primary", category: "button", name: "Primary Button" },
    { id: "card-default", category: "card", name: "Default Card" },
    { id: "navigation-header", category: "navigation", name: "Header Navigation" },
  ];

  const merged = [...defaults, ...fromStructurePriority, ...fromExperienceTemplates];
  const byId = new Map<string, { id: string; category: string; name: string }>();
  merged.forEach((template) => {
    if (!byId.has(template.id)) byId.set(template.id, template);
  });
  return Array.from(byId.values());
};

const normalizeDesignQubeForDIS = (
  designQube: DesignQube,
  activeDesignQubeId: string,
  designTheme: DesignQubeThemeMode,
  previewExperience: ExperienceQubeLike
) => {
  const themeTokens = designQube.tokens?.themes?.[designTheme] || designQube.tokens?.themes?.dark || {};
  const colors = themeTokens?.color || {};
  const typography = designQube.tokens?.typography || {};
  const voiceProfile =
    designQube.styleQube?.audio?.voice ||
    (designQube.styleQube as any)?.voice ||
    {};
  const textFormatting =
    designQube.styleQube?.text?.formatting ||
    (designQube.styleQube as any)?.text ||
    {};

  const sources = [
    ...(designQube.sources || []),
    {
      id: `experience-${previewExperience.id}`,
      type: "freeform",
      label: "ExperienceQube Context",
      location: `/studio/composer/experience/${previewExperience.id}`,
      extractedAt: new Date().toISOString(),
      coverage: ["goal", "mechanics", "metrics", "template"],
    },
  ];

  return {
    id: activeDesignQubeId || designQube.id,
    name: `${designQube.name || "DesignQube"} • ${previewExperience.name}`,
    description: [
      designQube.styleBrief,
      previewExperience.description,
      `Goal: ${previewExperience.goal}`,
      `Mechanics: ${previewExperience.mechanics}`,
      `Metrics: ${previewExperience.metrics}`,
    ]
      .filter(Boolean)
      .join(" "),
    tags: [
      ...(designQube.manifest?.themes || []),
      previewExperience.status,
      previewExperience.metadata?.category || "experience",
      previewExperience.template_id,
    ].filter(Boolean),
    tokens: {
      themes: {
        dark: {
          color: {
            primary: toHex(colors.primary || colors.accent, "#22d3ee"),
            secondary: toHex(colors.secondary || colors.muted, "#64748b"),
            accent: toHex(colors.accent || colors.primary, "#a855f7"),
            surface: toHex(colors.surface, "#0f172a"),
            text: toHex(colors.text, "#f8fafc"),
            textSecondary: toHex((colors as any).textSecondary || colors.muted, "#cbd5e1"),
            textMuted: toHex((colors as any).textMuted || colors.muted, "#94a3b8"),
            border: toHex(colors.border, "rgba(148,163,184,0.2)"),
          },
        },
      },
      fontFamily: {
        primary:
          typography?.fontFamily?.sans ||
          textFormatting.fontFamily ||
          "Inter, system-ui, sans-serif",
      },
      radius: designQube.tokens?.radius || {},
      spacing: designQube.tokens?.spacing || {},
      shadow: designQube.tokens?.shadow || {},
    },
    styleQube: {
      voice: {
        persona: voiceProfile?.persona,
        accent: voiceProfile?.accent,
        pace: voiceProfile?.pace,
        pitch: voiceProfile?.pitch,
        tone: voiceProfile?.tone,
        ttsHints: voiceProfile?.ttsHints,
      },
      text: {
        fontFamily: textFormatting?.fontFamily,
        fontSize: textFormatting?.fontSize,
        lineHeight: textFormatting?.lineHeight,
        maxWidth: textFormatting?.maxWidth,
        paragraphSpacing: textFormatting?.paragraphSpacing,
        hyphenation: textFormatting?.hyphenation,
        textAlign: textFormatting?.textAlign,
        textRendering: textFormatting?.textRendering,
        fontSmoothing: textFormatting?.fontSmoothing,
        cssText: textFormatting?.cssText,
      },
    },
    structureQube: {
      templateSelection: designQube.structureQube?.templateSelection || {
        priority: [],
        byModality: {},
        byDensity: {},
        bySurface: {},
      },
      breakpoints: designQube.structureQube?.breakpoints || {},
      layoutRules: designQube.structureQube?.layoutRules || [],
    },
    sources,
    copilotHints: {
      ...(designQube.copilotHints || {}),
      experience: {
        id: previewExperience.id,
        name: previewExperience.name,
        templateId: previewExperience.template_id,
        goal: previewExperience.goal,
        mechanics: previewExperience.mechanics,
        metrics: previewExperience.metrics,
        status: previewExperience.status,
      },
    },
  };
};

const createParityEvaluationElement = (
  previewExperience: ExperienceQubeLike,
  designQube: DesignQube,
  designTheme: DesignQubeThemeMode
) => {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "-10000px";
  host.style.pointerEvents = "none";
  host.style.opacity = "0";
  host.style.width = "1200px";
  host.style.height = "900px";

  const themeTokens = designQube.tokens?.themes?.[designTheme] || designQube.tokens?.themes?.dark || {};
  const color = themeTokens?.color || {};
  const typography = designQube.tokens?.typography || {};
  const radius = designQube.tokens?.radius || {};
  const spacing = designQube.tokens?.spacing || {};

  const root = document.createElement("div");
  root.className = "mcp-app container";
  root.style.maxWidth = "1200px";
  root.style.margin = "0 auto";
  root.style.background = toHex(color.bg, "#020617");
  root.style.color = toHex(color.text, "#f8fafc");
  root.style.fontFamily = typography?.fontFamily?.sans || "Inter, system-ui, sans-serif";
  root.style.border = `1px solid ${toHex(color.border, "rgba(148,163,184,0.2)")}`;

  root.innerHTML = `
    <header class="header navigation-header" style="background:${toHex(color.surface, "#0f172a")};height:64px;padding:${toPx(spacing.sm, "10px")} ${toPx(spacing.lg, "18px")};border-bottom:1px solid ${toHex(color.border, "rgba(148,163,184,0.2)")};display:flex;align-items:center;justify-content:space-between;">
      <nav class="flex nav-row" style="display:flex;gap:10px;align-items:center;">
        <button class="primary btn-primary" style="background:${toHex(color.accent, "#22d3ee")};color:${toHex((color as any).accentText, "#ffffff")};padding:8px 14px;border-radius:${toPx(radius.md, "10px")};font-size:14px;border:1px solid transparent;">Launch</button>
        <button class="secondary btn-secondary" style="background:transparent;color:${toHex(color.text, "#f8fafc")};padding:8px 14px;border-radius:${toPx(radius.md, "10px")};font-size:14px;border:1px solid ${toHex(color.border, "rgba(148,163,184,0.2)")};">Preview</button>
      </nav>
      <div style="font-size:12px;opacity:.85">${previewExperience.template_id}</div>
    </header>
    <main class="main-grid grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${toPx(spacing.lg, "18px")};padding:${toPx(spacing.lg, "18px")};">
      <section class="card default card-default" style="grid-column:span 2;background:${toHex(color.surface, "#0f172a")};border:1px solid ${toHex(color.border, "rgba(148,163,184,0.2)")};border-radius:${toPx(radius.lg, "14px")};padding:${toPx(spacing.lg, "18px")};">
        <h2 style="margin:0 0 8px;font-size:20px;">${previewExperience.name}</h2>
        <p style="margin:0 0 8px;opacity:.9;">${previewExperience.description || ""}</p>
        <p style="margin:0 0 8px;opacity:.85;"><strong>Goal:</strong> ${previewExperience.goal || ""}</p>
        <p style="margin:0;opacity:.8;"><strong>Mechanics:</strong> ${previewExperience.mechanics || ""}</p>
      </section>
      <aside class="card elevated card-elevated" style="background:${toHex((color as any).surface2 || color.surface, "#111827")};border:1px solid ${toHex(color.border, "rgba(148,163,184,0.2)")};border-radius:${toPx(radius.lg, "14px")};padding:${toPx(spacing.md, "14px")};">
        <h3 style="margin:0 0 6px;font-size:14px;">Metrics</h3>
        <p style="margin:0;font-size:12px;opacity:.85;">${previewExperience.metrics || ""}</p>
      </aside>
    </main>
  `;

  host.appendChild(root);
  document.body.appendChild(host);
  return {
    element: root,
    cleanup: () => {
      if (host.parentNode) host.parentNode.removeChild(host);
    },
  };
};

export function AgenticDesignParityPanel({
  designQube,
  activeDesignQubeId,
  designTheme,
  experiences,
  previewExperience,
  previewAction,
  onOpenExperience,
  onOpenRuntimePreview,
}: AgenticDesignParityPanelProps) {
  const [activeTab, setActiveTab] = useState("pipeline");
  const [state, setState] = useState<PipelineState>({ status: "idle" });

  const templateRegistry = useMemo(
    () => buildTemplateRegistry(designQube, experiences),
    [designQube, experiences]
  );

  const runPipeline = useCallback(async () => {
    if (!designQube || !previewExperience) {
      setState({
        status: "error",
        error: "Select an ExperienceQube and DesignQube to run parity analysis.",
      });
      return;
    }

    setState({ status: "loading", appraisedExperienceId: previewExperience.id });

    let cleanup: (() => void) | undefined;
    try {
      const normalizedDesignQube = normalizeDesignQubeForDIS(
        designQube,
        activeDesignQubeId,
        designTheme,
        previewExperience
      );
      const dis = await DISGenerator.generateFromDesignQube(normalizedDesignQube, templateRegistry, {
        strictMode: false,
      });
      const cm = ConstraintManifestGenerator.generateFromDIS(dis);

      const parityElement = createParityEvaluationElement(previewExperience, designQube, designTheme);
      cleanup = parityElement.cleanup;

      const parityReport = await ParityChecker.generateReport(parityElement.element, dis, cm, {
        includeScreenshots: false,
        strictMode: false,
        breakpoints: ["mobile", "tablet", "desktop"],
      });

      setState({
        status: "success",
        dis,
        cm,
        parityReport,
        appraisedExperienceId: previewExperience.id,
      });
    } catch (error: any) {
      setState({
        status: "error",
        error: error?.message || "Failed to run Design Parity pipeline.",
        appraisedExperienceId: previewExperience?.id,
      });
    } finally {
      cleanup?.();
    }
  }, [designQube, previewExperience, activeDesignQubeId, designTheme, templateRegistry]);

  useEffect(() => {
    if (!designQube || !previewExperience) return;
    void runPipeline();
  }, [designQube, previewExperience, runPipeline]);

  const scoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-300";
    if (score >= 70) return "text-amber-300";
    return "text-rose-300";
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-5 w-5 text-cyan-300" />
          <h2 className="text-lg font-semibold text-white">Agentic UI Design Parity</h2>
          <p className="text-sm text-slate-400">
            DIS, CM, and parity report aligned to the selected ExperienceQube + DesignQube.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {previewAction && <span className="text-xs text-slate-400">Last action: {previewAction}</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void runPipeline()}
            disabled={state.status === "loading"}
            className="text-xs"
          >
            {state.status === "loading" ? (
              <>
                <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Play className="mr-1 h-3.5 w-3.5" />
                Run Pipeline
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-cyan-400/40 text-cyan-200">
            Experience: {previewExperience?.name || "None selected"}
          </Badge>
          <Badge variant="outline" className="border-purple-400/40 text-purple-200">
            Template: {previewExperience?.template_id || "N/A"}
          </Badge>
          <Badge variant="outline" className="border-emerald-400/40 text-emerald-200">
            DesignQube: {activeDesignQubeId}
          </Badge>
          {state.appraisedExperienceId && (
            <Badge variant="outline" className="border-amber-400/40 text-amber-200">
              Appraised ID: {state.appraisedExperienceId}
            </Badge>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={!previewExperience?.id}
            onClick={() => previewExperience?.id && onOpenExperience?.(previewExperience.id)}
          >
            Open Experience Viewer
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={!previewExperience}
            onClick={() => onOpenRuntimePreview?.()}
          >
            Open Runtime Preview
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 space-y-4">
        <TabsList className="grid w-full grid-cols-4 border border-slate-800 bg-slate-950/70">
          <TabsTrigger value="pipeline" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="dis" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            DIS
          </TabsTrigger>
          <TabsTrigger value="cm" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            CM
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            DPR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "Design Ingestion", ready: !!designQube },
              { label: "DIS Generation", ready: !!state.dis },
              { label: "CM Generation", ready: !!state.cm },
              { label: "DPR Appraisal", ready: !!state.parityReport },
            ].map((step) => (
              <div key={step.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                <div className="mb-2 font-semibold">{step.label}</div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {step.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-500" />
                  )}
                  {step.ready ? "Ready" : "Pending"}
                </div>
              </div>
            ))}
          </div>
          {state.status === "error" && (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {state.error}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dis">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
            {state.dis ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-400">Name</div>
                    <div>{state.dis.metadata.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Source</div>
                    <div>{state.dis.source.designQubeId}</div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-400">Voice Schema</div>
                    <div>
                      persona `{state.dis.style.voice.persona || "n/a"}`, accent `{state.dis.style.voice.accent || "n/a"}`,
                      pace `{state.dis.style.voice.pace || "n/a"}`, pitch `{state.dis.style.voice.pitch || "n/a"}`,
                      tone `{state.dis.style.voice.tone || "n/a"}`
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Text Styling</div>
                    <div>
                      {state.dis.style.text.fontFamily || "n/a"} • {state.dis.style.text.fontSize || "n/a"} •{" "}
                      {state.dis.style.text.lineHeight || "n/a"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  Experience alignment: {state.dis.metadata.copilotHints?.experience?.id || "n/a"} •{" "}
                  {state.dis.metadata.copilotHints?.experience?.templateId || "n/a"}
                </div>
              </div>
            ) : (
              <div className="text-slate-400">Run pipeline to generate DIS.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cm">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
            {state.cm ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-400">Strict Mode</div>
                    <div>{state.cm.verification.strictMode ? "Yes" : "No"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Priority Ordering</div>
                    <div>{state.cm.verification.priorityOrdering.join(" • ")}</div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-slate-400">Color Tolerance</div>
                    <div>{Math.round(state.cm.verification.toleranceLevels.color * 100)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Spacing Tolerance</div>
                    <div>{Math.round(state.cm.verification.toleranceLevels.spacing * 100)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Typography Tolerance</div>
                    <div>{Math.round(state.cm.verification.toleranceLevels.typography * 100)}%</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  Component contracts: {Object.keys(state.cm.components.buttons).length} buttons •{" "}
                  {Object.keys(state.cm.components.cards).length} cards •{" "}
                  {Object.keys(state.cm.components.navigation).length} navigation items
                </div>
              </div>
            ) : (
              <div className="text-slate-400">Run pipeline to generate CM.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="report">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
            {state.parityReport ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xs text-slate-400">Overall DPR</div>
                  <div className={`text-lg font-semibold ${scoreColor(state.parityReport.parity.overall)}`}>
                    {state.parityReport.parity.overall}/100
                  </div>
                  <Badge variant="outline" className="border-slate-700 text-slate-300">
                    Checks: {state.parityReport.audit.totalChecks}
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                    Passed: {state.parityReport.audit.passedChecks}
                  </Badge>
                  <Badge variant="outline" className="border-rose-500/40 text-rose-300">
                    Failed: {state.parityReport.audit.failedChecks}
                  </Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-5">
                  {Object.entries(state.parityReport.parity.structural).map(([key, score]) => (
                    <div key={key} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-center">
                      <div className="text-[11px] capitalize text-slate-400">{key}</div>
                      <div className={`font-semibold ${scoreColor(score)}`}>{score}</div>
                    </div>
                  ))}
                </div>
                {state.parityReport.violations.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                    {state.parityReport.violations.length} parity violations found. Top issue:{" "}
                    {state.parityReport.violations[0].message}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400">Run pipeline to generate DPR.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AgenticDesignParityPanel;
