"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  Layers,
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
  metadata?: Record<string, any>;
};

type PipelineState = {
  status: "idle" | "loading" | "success" | "error";
  dis?: DesignIntentSpec;
  cm?: ConstraintManifest;
  parityReport?: DesignParityReport;
  error?: string;
  appraisedExperienceId?: string;
};

type ExperienceModelData = {
  journey?: {
    stage: string;
    depth: string;
    active_at: string | null;
  } | null;
  nbe?: {
    disposition: string;
    next_experience_depth: string | null;
    rationale: string | null;
    expires_at: string | null;
  } | null;
  strategy?: { name: string; description: string; target_segments: string[] } | null;
  model?: { name: string; description: string; stages: string[] } | null;
  matrix?: { stage: string; depth_ladder: string[] }[] | null;
  analysis?: { card_type: string; content: string; score: number | null }[] | null;
};

type AgenticDesignParityPanelProps = {
  designQube: DesignQube | null;
  activeDesignQubeId: string;
  designTheme: DesignQubeThemeMode;
  experiences: ExperienceQubeLike[];
  previewExperience: ExperienceQubeLike | null;
  previewAction: string | null;
  personaId?: string;
  routingSummary?: string;
  recommendedTargetLabel?: string;
  deploymentGuidance?: Array<{
    id: string;
    label: string;
    ready: boolean;
    note: string;
    trustScore: number;
    costScore: number;
    suitabilityScore: number;
    watchouts?: string[];
    latest?: {
      status?: string;
      mode?: string;
    } | null;
  }>;
  onOpenExperience?: (experienceId: string) => void;
  onOpenRuntimePreview?: () => void;
  onApplyRemedy?: (experienceId: string, patch: Partial<ExperienceQubeLike>, summary: string) => Promise<void>;
  onLogAuditEvent?: (
    experienceId: string,
    action: "pipeline_run" | "pipeline_error" | "remedy_proposed" | "remedy_rejected",
    summary: string,
    details?: Record<string, any>
  ) => Promise<void>;
};

type RemedyState = {
  status: "idle" | "proposed" | "applying" | "applied" | "error";
  summary?: string;
  proposals?: string[];
  error?: string;
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

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const loadParityTargetFromIframe = async (params: {
  url: string;
  width: number;
  height: number;
  rootSelector: string;
  timeoutMs?: number;
}) => {
  const { url, width, height, rootSelector, timeoutMs = 15000 } = params;
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "-10000px";
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;
  host.style.opacity = "0";
  host.style.pointerEvents = "none";
  host.style.overflow = "hidden";
  host.style.zIndex = "-1";

  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.width = String(width);
  iframe.height = String(height);
  iframe.style.border = "0";
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;

  host.appendChild(iframe);
  document.body.appendChild(host);

  const cleanup = () => {
    if (host.parentNode) host.parentNode.removeChild(host);
  };

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out loading parity target iframe: ${url}`));
    }, timeoutMs);

    iframe.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    iframe.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error(`Failed to load parity target iframe: ${url}`));
    };
  });

  await delay(700);
  const doc = iframe.contentDocument;
  if (!doc) {
    cleanup();
    throw new Error(`No iframe document available for parity target: ${url}`);
  }
  const target = (doc.querySelector(rootSelector) as HTMLElement | null) || (doc.body as HTMLElement | null);
  if (!target) {
    cleanup();
    throw new Error(`No parity DOM root found for selector ${rootSelector}`);
  }

  // Clone iframe DOM into current document so getComputedStyle/layout APIs work reliably.
  const mirrorHost = document.createElement("div");
  mirrorHost.style.position = "fixed";
  mirrorHost.style.left = "-20000px";
  mirrorHost.style.top = "-20000px";
  mirrorHost.style.width = `${width}px`;
  mirrorHost.style.height = `${height}px`;
  mirrorHost.style.opacity = "0";
  mirrorHost.style.pointerEvents = "none";
  mirrorHost.style.overflow = "hidden";
  const cloned = target.cloneNode(true) as HTMLElement;
  mirrorHost.appendChild(cloned);
  document.body.appendChild(mirrorHost);

  return {
    element: cloned,
    cleanup: () => {
      cleanup();
      if (mirrorHost.parentNode) mirrorHost.parentNode.removeChild(mirrorHost);
    },
  };
};

const createSyntheticParityFallback = (experience: ExperienceQubeLike) => {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "-10000px";
  host.style.width = "1200px";
  host.style.height = "900px";
  host.style.opacity = "0";
  host.style.pointerEvents = "none";
  host.className = "bg-slate-950 text-slate-100";
  host.innerHTML = `
    <header class="navigation-header border-b border-slate-700 p-4 flex items-center justify-between">
      <div class="flex gap-2">
        <button class="btn-primary primary rounded-md px-3 py-2 bg-cyan-500 text-white">Launch</button>
        <button class="btn-secondary rounded-md px-3 py-2 border border-slate-600">Preview</button>
      </div>
      <span class="text-xs">${experience.template_id}</span>
    </header>
    <main class="grid p-4 gap-3" style="grid-template-columns: repeat(3,minmax(0,1fr));">
      <section class="card-default card rounded-xl border border-slate-700 p-4" style="grid-column: span 2;">
        <h2 class="text-xl font-semibold">${experience.name}</h2>
        <p class="mt-2">${experience.description || ""}</p>
        <p class="mt-2"><strong>Goal:</strong> ${experience.goal || ""}</p>
        <p class="mt-2"><strong>Mechanics:</strong> ${experience.mechanics || ""}</p>
      </section>
      <aside class="card-elevated card rounded-xl border border-slate-700 p-4">
        <h3 class="text-sm font-semibold">Metrics</h3>
        <p class="mt-2 text-xs">${experience.metrics || ""}</p>
      </aside>
    </main>
  `;
  document.body.appendChild(host);
  return {
    element: host as HTMLElement,
    cleanup: () => {
      if (host.parentNode) host.parentNode.removeChild(host);
    },
  };
};

const mergeParityReports = (
  reports: Array<{ source: "runtime" | "experience"; report: DesignParityReport }>
): DesignParityReport => {
  if (reports.length === 1) return reports[0].report;

  const first = reports[0].report;
  const avg = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
  const structuralKeys: Array<keyof DesignParityReport["parity"]["structural"]> = [
    "layout",
    "typography",
    "spacing",
    "components",
    "accessibility",
  ];
  const visualKeys: Array<keyof DesignParityReport["parity"]["visual"]> = ["mobile", "tablet", "desktop"];

  const breakdownKeys = Array.from(
    new Set(reports.flatMap((item) => Object.keys(item.report.parity.breakdown || {})))
  );
  const breakdown = breakdownKeys.reduce<Record<string, { score: number; weight: number; issues: number }>>(
    (acc, key) => {
      const entries = reports
        .map((item) => item.report.parity.breakdown?.[key])
        .filter(Boolean) as Array<{ score: number; weight: number; issues: number }>;
      if (entries.length === 0) return acc;
      acc[key] = {
        score: Math.round(avg(entries.map((entry) => entry.score))),
        weight: entries[0].weight,
        issues: entries.reduce((sum, entry) => sum + entry.issues, 0),
      };
      return acc;
    },
    {}
  );

  return {
    ...first,
    generatedAt: new Date().toISOString(),
    source: {
      ...first.source,
      mcpAppId: reports.map((item) => item.source).join("+"),
      verificationMethod: "hybrid",
    },
    parity: {
      overall: Math.round(avg(reports.map((item) => item.report.parity.overall))),
      structural: structuralKeys.reduce(
        (acc, key) => {
          acc[key] = Math.round(avg(reports.map((item) => item.report.parity.structural[key])));
          return acc;
        },
        {} as DesignParityReport["parity"]["structural"]
      ),
      visual: visualKeys.reduce(
        (acc, key) => {
          acc[key] = Math.round(avg(reports.map((item) => item.report.parity.visual[key])));
          return acc;
        },
        {} as DesignParityReport["parity"]["visual"]
      ),
      breakdown,
    },
    violations: reports.flatMap((item) =>
      item.report.violations.map((violation) => ({
        ...violation,
        component: `${item.source}:${violation.component || "unknown"}`,
        message: `[${item.source}] ${violation.message}`,
      }))
    ),
    visualDifferences: reports.flatMap((item) =>
      item.report.visualDifferences.map((difference) => ({
        ...difference,
        component: `${item.source}:${difference.component}`,
      }))
    ),
    recommendations: {
      immediate: unique(reports.flatMap((item) => item.report.recommendations.immediate)),
      shortTerm: unique(reports.flatMap((item) => item.report.recommendations.shortTerm)),
      longTerm: unique(reports.flatMap((item) => item.report.recommendations.longTerm)),
    },
    audit: {
      totalChecks: reports.reduce((sum, item) => sum + item.report.audit.totalChecks, 0),
      passedChecks: reports.reduce((sum, item) => sum + item.report.audit.passedChecks, 0),
      failedChecks: reports.reduce((sum, item) => sum + item.report.audit.failedChecks, 0),
      skippedChecks: reports.reduce((sum, item) => sum + item.report.audit.skippedChecks, 0),
      executionTime: reports.reduce((sum, item) => sum + item.report.audit.executionTime, 0),
    },
    metadata: {
      ...first.metadata,
      lastValidated: new Date().toISOString(),
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
  personaId,
  routingSummary,
  recommendedTargetLabel,
  deploymentGuidance,
  onOpenExperience,
  onOpenRuntimePreview,
  onApplyRemedy,
  onLogAuditEvent,
}: AgenticDesignParityPanelProps) {
  const [activeTab, setActiveTab] = useState("pipeline");
  const [expTab, setExpTab] = useState("status");
  const [state, setState] = useState<PipelineState>({ status: "idle" });
  const [remedyState, setRemedyState] = useState<RemedyState>({ status: "idle" });
  const [expData, setExpData] = useState<ExperienceModelData>({});
  const [expLoading, setExpLoading] = useState(false);
  const [parityModalOpen, setParityModalOpen] = useState(false);

  useEffect(() => {
    if (activeTab !== "experience" || !previewExperience) return;
    setExpLoading(true);
    const params = new URLSearchParams({ experienceId: previewExperience.id });
    if (personaId) params.set("personaId", personaId);
    fetch(`/api/runtime/experience?${params}`)
      .then((r) => r.ok ? r.json() : {})
      .then((data: ExperienceModelData) => setExpData(data))
      .catch(() => setExpData({}))
      .finally(() => setExpLoading(false));
  }, [activeTab, previewExperience, personaId]);
  const onLogAuditEventRef = useRef(onLogAuditEvent);

  useEffect(() => {
    onLogAuditEventRef.current = onLogAuditEvent;
  }, [onLogAuditEvent]);

  const templateRegistrySeed = useMemo(() => {
    const ids = experiences
      .map((experience) => experience.template_id)
      .filter(Boolean)
      .sort();
    return ids.join("|");
  }, [experiences]);

  const templateRegistry = useMemo(() => buildTemplateRegistry(designQube, experiences), [designQube, templateRegistrySeed]);

  const parityExperience = useMemo(() => {
    if (!previewExperience) return null;
    return {
      id: previewExperience.id,
      name: previewExperience.name,
      description: previewExperience.description,
      goal: previewExperience.goal,
      mechanics: previewExperience.mechanics,
      metrics: previewExperience.metrics,
      template_id: previewExperience.template_id,
      status: previewExperience.status,
      metadata: { category: previewExperience.metadata?.category },
    } as ExperienceQubeLike;
  }, [
    previewExperience?.id,
    previewExperience?.name,
    previewExperience?.description,
    previewExperience?.goal,
    previewExperience?.mechanics,
    previewExperience?.metrics,
    previewExperience?.template_id,
    previewExperience?.status,
    previewExperience?.metadata?.category,
  ]);

  const runPipeline = useCallback(async () => {
    if (!designQube || !parityExperience) {
      setState({
        status: "error",
        error: "Select an ExperienceQube and DesignQube to run parity analysis.",
      });
      return;
    }

    setState({ status: "loading", appraisedExperienceId: parityExperience.id });

    try {
      const normalizedDesignQube = normalizeDesignQubeForDIS(
        designQube,
        activeDesignQubeId,
        designTheme,
        parityExperience
      );
      const dis = await DISGenerator.generateFromDesignQube(normalizedDesignQube, templateRegistry, {
        strictMode: false,
      });
      const cm = ConstraintManifestGenerator.generateFromDIS(dis);
      const baseUrl = window.location.origin;
      const cacheBust = Date.now();
      const targets: Array<{
        source: "runtime" | "experience";
        url: string;
        rootSelector: string;
      }> = [
        {
          source: "runtime",
          url: `${baseUrl}/metame/runtime?embed=1&preview=1&experienceId=${encodeURIComponent(
            parityExperience.id
          )}&capsule=${encodeURIComponent(parityExperience.id)}&device=desktop&parity=1&t=${cacheBust}`,
          rootSelector: '[data-parity-root="metame-runtime"]',
        },
        {
          source: "experience",
          url: `${baseUrl}/studio/composer/experience/${encodeURIComponent(parityExperience.id)}?parity=1&t=${cacheBust}`,
          rootSelector: '[data-parity-root="experience-viewer"]',
        },
      ];

      const sourceReports: Array<{ source: "runtime" | "experience"; report: DesignParityReport }> = [];
      const sourceErrors: Array<{ source: "runtime" | "experience"; error: string }> = [];
      for (const target of targets) {
        try {
          const loaded = await loadParityTargetFromIframe({
            url: target.url,
            width: 1280,
            height: 900,
            rootSelector: target.rootSelector,
          });
          try {
            const report = await ParityChecker.generateReport(loaded.element, dis, cm, {
              includeScreenshots: false,
              strictMode: false,
              breakpoints: ["mobile", "tablet", "desktop"],
            });
            sourceReports.push({ source: target.source, report });
          } finally {
            loaded.cleanup();
          }
        } catch (targetError: any) {
          console.warn(`[DesignParity] ${target.source} target failed`, targetError);
          sourceErrors.push({
            source: target.source,
            error: targetError?.message || "Unknown DOM target failure",
          });
        }
      }

      if (sourceReports.length === 0) {
        const fallback = createSyntheticParityFallback(parityExperience);
        try {
          const fallbackReport = await ParityChecker.generateReport(fallback.element, dis, cm, {
            includeScreenshots: false,
            strictMode: false,
            breakpoints: ["mobile", "tablet", "desktop"],
          });
          sourceReports.push({ source: "experience", report: fallbackReport });
        } finally {
          fallback.cleanup();
        }
      }

      const parityReport = mergeParityReports(sourceReports);

      setState({
        status: "success",
        dis,
        cm,
        parityReport,
        appraisedExperienceId: parityExperience.id,
      });
      if (onLogAuditEventRef.current) {
        await onLogAuditEventRef.current(
          parityExperience.id,
          "pipeline_run",
          `DPR ${parityReport.parity.overall}/100 with ${parityReport.violations.length} violations.`,
          {
            overall: parityReport.parity.overall,
            structural: parityReport.parity.structural,
            audit: parityReport.audit,
            violationCount: parityReport.violations.length,
            topViolation: parityReport.violations[0]?.message || null,
            sources: sourceReports.map((item) => item.source),
            sourceErrors,
          }
        );
      }
    } catch (error: any) {
      setState({
        status: "error",
        error: error?.message || "Failed to run Design Parity pipeline.",
        appraisedExperienceId: parityExperience?.id,
      });
      if (parityExperience && onLogAuditEventRef.current) {
        await onLogAuditEventRef.current(
          parityExperience.id,
          "pipeline_error",
          error?.message || "Failed to run Design Parity pipeline.",
          {
            designQubeId: designQube?.id,
            templateId: parityExperience.template_id,
          }
        );
      }
    }
  }, [designQube, parityExperience, activeDesignQubeId, designTheme, templateRegistry]);

  useEffect(() => {
    if (!designQube || !parityExperience) return;
    void runPipeline();
  }, [designQube, parityExperience, runPipeline]);

  useEffect(() => {
    setRemedyState({ status: "idle" });
  }, [previewExperience?.id]);

  const scoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-300";
    if (score >= 70) return "text-amber-300";
    return "text-rose-300";
  };

  const pipelineReady =
    !!state.parityReport &&
    !!parityExperience &&
    state.appraisedExperienceId === parityExperience.id;

  const proposeRemedy = async () => {
    if (!state.parityReport || !previewExperience) return;
    const proposals = state.parityReport.violations.slice(0, 6).map((violation) => {
      if (violation.suggestion) return violation.suggestion;
      return `Adjust ${violation.type} for ${violation.component || "component"} at ${violation.breakpoint}.`;
    });
    const summary = `Proposed ${proposals.length} remedy actions for ${previewExperience.name}.`;
    setRemedyState({
      status: "proposed",
      summary,
      proposals,
    });
    if (onLogAuditEvent) {
      await onLogAuditEvent(previewExperience.id, "remedy_proposed", summary, {
        proposalCount: proposals.length,
        proposals,
        currentDpr: state.parityReport.parity.overall,
      });
    }
  };

  const applyRemedy = async () => {
    if (!previewExperience || !onApplyRemedy || !remedyState.proposals?.length) return;
    setRemedyState((prev) => ({ ...prev, status: "applying" }));
    const summary = remedyState.summary || "Applied parity remediation updates.";
    const remedyText = remedyState.proposals.join(" ");
    const nextMetadata = {
      ...(previewExperience.metadata || {}),
      parityRemedies: [
        ...((previewExperience.metadata?.parityRemedies as string[]) || []),
        ...remedyState.proposals,
      ],
      paritySummary: summary,
      parityStatus: "applied",
      parityUpdatedAt: new Date().toISOString(),
    };
    const patch: Partial<ExperienceQubeLike> = {
      mechanics: previewExperience.mechanics
        ? `${previewExperience.mechanics}\n\nRemedy: ${remedyText}`
        : `Remedy: ${remedyText}`,
      metrics: previewExperience.metrics
        ? `${previewExperience.metrics}\n\nRemedy: ${remedyText}`
        : `Remedy: ${remedyText}`,
      metadata: nextMetadata,
    };
    try {
      await onApplyRemedy(previewExperience.id, patch, summary);
      setRemedyState((prev) => ({ ...prev, status: "applied", error: undefined }));
    } catch (error: any) {
      setRemedyState((prev) => ({
        ...prev,
        status: "error",
        error: error?.message || "Failed to apply remediation.",
      }));
    }
  };

  const rejectRemedy = async () => {
    if (!previewExperience) return;
    if (onLogAuditEvent) {
      await onLogAuditEvent(
        previewExperience.id,
        "remedy_rejected",
        `Rejected remedy proposal for ${previewExperience.name}.`,
        {
          proposalCount: remedyState.proposals?.length || 0,
          proposals: remedyState.proposals || [],
          currentDpr: state.parityReport?.parity?.overall,
        }
      );
    }
    setRemedyState({ status: "idle" });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          DIS, CM, and parity report aligned to the selected ExperienceQube + DesignQube.
        </div>
        <div className="flex items-center gap-2">
          {previewAction && <span className="text-xs text-slate-400">Last action: {previewAction}</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void runPipeline()}
            disabled={state.status === "loading" || !previewExperience || !designQube}
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
                {pipelineReady ? "Review DPR" : "Run Pipeline"}
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

      {recommendedTargetLabel || routingSummary || (deploymentGuidance && deploymentGuidance.length > 0) ? (
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">
                Deployment Guidance
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {recommendedTargetLabel
                  ? `Recommended path: ${recommendedTargetLabel}`
                  : "Routing envelope active"}
              </div>
              {routingSummary ? (
                <div className="mt-1 max-w-3xl text-sm text-slate-300">{routingSummary}</div>
              ) : null}
            </div>
            <Badge variant="outline" className="border-cyan-400/40 text-cyan-200">
              Trust + Cost Envelope
            </Badge>
          </div>
          {deploymentGuidance && deploymentGuidance.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {deploymentGuidance.map((target) => (
                <div
                  key={target.id}
                  className={`rounded-xl border px-3 py-3 text-sm ${
                    target.ready
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-amber-500/20 bg-amber-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{target.label}</div>
                    <div className={target.ready ? "text-emerald-300" : "text-amber-300"}>
                      {target.ready ? "ready" : "blocked"}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{target.note}</div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    <span>trust {target.trustScore}/5</span>
                    <span>cost {target.costScore}/5</span>
                    <span>fit {target.suitabilityScore}</span>
                  </div>
                  {target.watchouts && target.watchouts.length > 0 ? (
                    <div className="mt-2 text-[11px] text-amber-200/90">
                      {target.watchouts.join(" · ")}
                    </div>
                  ) : null}
                  {target.latest ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      Last result: {target.latest.status || "unknown"}
                      {target.latest.mode ? ` · ${target.latest.mode}` : ""}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 space-y-4">
        <TabsList className="grid w-full grid-cols-5 border border-slate-800 bg-slate-950/70">
          <TabsTrigger value="pipeline" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="experience" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Experience
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
          <div className="space-y-4">
            {/* DIS pipeline */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Design Parity Pipeline</div>
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
            </div>

            {/* Experience model pipeline — COD-209 */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Experience Model Pipeline</div>
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: "Strategy", ready: !!expData.strategy },
                  { label: "Model", ready: !!expData.model },
                  { label: "Matrix", ready: !!(expData.matrix?.length) },
                  { label: "NBE", ready: !!expData.nbe },
                  { label: "Artifact", ready: !!previewExperience },
                  { label: "Codex Sync", ready: !!state.dis },
                  { label: "Runtime", ready: !!state.parityReport },
                  { label: "Analytics", ready: !!(expData.analysis?.length) },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-1">
                    <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                      step.ready
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-700 bg-slate-900/50 text-slate-400"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {step.ready
                          ? <CheckCircle2 className="h-3 w-3" />
                          : <XCircle className="h-3 w-3 text-slate-600" />}
                        {step.label}
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="experience">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
            {!previewExperience ? (
              <div className="text-slate-400">Select an experience to view its model data.</div>
            ) : expLoading ? (
              <div className="text-slate-400">Loading experience model…</div>
            ) : (
              <Tabs value={expTab} onValueChange={setExpTab} className="space-y-3">
                <TabsList className="grid w-full grid-cols-6 border border-slate-800 bg-slate-900/60 text-xs">
                  {(["status", "strategy", "model", "matrix", "nbe", "analysis"] as const).map((t) => (
                    <TabsTrigger key={t} value={t} className="capitalize text-xs">{t}</TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="status">
                  {expData.journey ? (
                    <div className="grid gap-2 md:grid-cols-3">
                      {[
                        { label: "Stage", value: expData.journey.stage },
                        { label: "Depth", value: expData.journey.depth },
                        { label: "Active", value: expData.journey.active_at ? new Date(expData.journey.active_at).toLocaleDateString() : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                          <div className="text-[11px] text-slate-400">{label}</div>
                          <div className="mt-1 font-semibold capitalize">{value}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs">No journey state found for this experience. Run the DB migration and seed a journey state to see data here.</div>
                  )}
                </TabsContent>

                <TabsContent value="strategy">
                  {expData.strategy ? (
                    <div className="space-y-2">
                      <div className="font-semibold">{expData.strategy.name}</div>
                      <div className="text-xs text-slate-300">{expData.strategy.description}</div>
                      {expData.strategy.target_segments?.length ? (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {expData.strategy.target_segments.map((s) => (
                            <Badge key={s} variant="outline" className="border-slate-700 text-slate-300 text-[11px]">{s}</Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs">No strategy linked to this experience.</div>
                  )}
                </TabsContent>

                <TabsContent value="model">
                  {expData.model ? (
                    <div className="space-y-2">
                      <div className="font-semibold">{expData.model.name}</div>
                      <div className="text-xs text-slate-300">{expData.model.description}</div>
                      {expData.model.stages?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {expData.model.stages.map((s, i) => (
                            <div key={s} className="flex items-center gap-1 text-xs">
                              <Badge variant="outline" className="border-violet-500/40 text-violet-300 text-[11px]">{s}</Badge>
                              {i < expData.model!.stages.length - 1 && <span className="text-slate-600">→</span>}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs">No experience model found.</div>
                  )}
                </TabsContent>

                <TabsContent value="matrix">
                  {expData.matrix?.length ? (
                    <div className="space-y-2">
                      {expData.matrix.map((row) => (
                        <div key={row.stage} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                          <div className="text-[11px] font-semibold capitalize text-slate-300 mb-1">{row.stage}</div>
                          <div className="flex gap-1 flex-wrap">
                            {row.depth_ladder.map((d) => (
                              <Badge key={d} variant="outline" className="border-slate-700 text-slate-400 text-[11px]">{d}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs">No experience matrix configured.</div>
                  )}
                </TabsContent>

                <TabsContent value="nbe">
                  {expData.nbe ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-400">Disposition</div>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 capitalize">{expData.nbe.disposition}</Badge>
                      </div>
                      {expData.nbe.next_experience_depth && (
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-slate-400">Next depth</div>
                          <Badge variant="outline" className="border-violet-500/40 text-violet-300">{expData.nbe.next_experience_depth}</Badge>
                        </div>
                      )}
                      {expData.nbe.rationale && (
                        <div className="text-xs text-slate-300 mt-1">{expData.nbe.rationale}</div>
                      )}
                      {expData.nbe.expires_at && (
                        <div className="text-[11px] text-slate-500">Expires: {new Date(expData.nbe.expires_at).toLocaleDateString()}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs">No NBE plan active for this experience.</div>
                  )}
                </TabsContent>

                <TabsContent value="analysis">
                  {expData.analysis?.length ? (
                    <div className="space-y-2">
                      {expData.analysis.map((card, i) => (
                        <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="border-slate-700 text-slate-300 text-[11px] capitalize">{card.card_type}</Badge>
                            {card.score != null && (
                              <span className="text-xs font-semibold text-emerald-300">{card.score}</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-300">{card.content}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs">No analysis cards for this experience.</div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dis">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
            {state.dis ? (() => {
              const dis = state.dis;
              const tokens = dis.tokens;
              const sources = dis.metadata.sources || [];
              const templateSelection = dis.structure.templateSelection || { priority: [], byModality: {}, byDensity: {}, bySurface: {} };
              return (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="text-xs text-slate-400">DIS Name</div>
                      <div>{dis.metadata.name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">DesignQube</div>
                      <div>{dis.source.designQubeId}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Ingestion</div>
                      <div className="capitalize">{dis.source.ingestionMethod}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Experience Guidance</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div>
                        <div className="text-xs text-slate-400">Experience</div>
                        <div>{previewExperience?.name || "n/a"}</div>
                        <div className="text-xs text-slate-500">{previewExperience?.template_id || "n/a"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Status</div>
                        <div className="capitalize">{previewExperience?.status || "n/a"}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-slate-400">Goal</div>
                        <div className="text-xs text-slate-300">{previewExperience?.goal || "n/a"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Mechanics</div>
                        <div className="text-xs text-slate-300">{previewExperience?.mechanics || "n/a"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Metrics</div>
                        <div className="text-xs text-slate-300">{previewExperience?.metrics || "n/a"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">Voice and Text</div>
                      <div className="mt-2 text-xs text-slate-300">
                        Voice: persona {dis.style.voice.persona || "n/a"}, accent {dis.style.voice.accent || "n/a"}, pace{" "}
                        {dis.style.voice.pace || "n/a"}, pitch {dis.style.voice.pitch || "n/a"}, tone {dis.style.voice.tone || "n/a"}
                      </div>
                      <div className="mt-2 text-xs text-slate-300">
                        Text: {dis.style.text.fontFamily || "n/a"} • {dis.style.text.fontSize || "n/a"} •{" "}
                        {dis.style.text.lineHeight || "n/a"} • {dis.style.text.textAlign || "n/a"} •{" "}
                        {dis.style.text.textRendering || "n/a"}
                      </div>
                      {dis.style.text.cssText && (
                        <div className="mt-2 rounded-md border border-slate-700 bg-slate-950/60 p-2 text-[11px] text-slate-400">
                          {dis.style.text.cssText}
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">Tokens</div>
                      <div className="mt-2 text-xs text-slate-300">
                        Colors: primary {tokens.colors.primary}, accent {tokens.colors.accent}, surface {tokens.colors.surface}
                      </div>
                      <div className="mt-2 text-xs text-slate-300">
                        Typography: {tokens.typography.fontFamily.primary} • {tokens.typography.fontSize.base} •{" "}
                        {tokens.typography.lineHeight.normal}
                      </div>
                      <div className="mt-2 text-xs text-slate-300">
                        Spacing: {tokens.spacing.sm} • {tokens.spacing.md} • {tokens.spacing.lg} • Radius: {tokens.borderRadius.md}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">Structure</div>
                      <div className="mt-2 text-xs text-slate-300">
                        Layout rules: {(dis.structure.layoutRules || []).slice(0, 4).join(" • ") || "n/a"}
                      </div>
                      <div className="mt-2 text-xs text-slate-300">
                        Breakpoints: {Object.keys(dis.structure.breakpoints || {}).join(" • ") || "n/a"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">Template Selection</div>
                      <div className="mt-2 text-xs text-slate-300">
                        Priority: {(templateSelection.priority || []).slice(0, 4).join(" • ") || "n/a"}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        By modality: {Object.keys(templateSelection.byModality || {}).join(" • ") || "n/a"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
                    Sources: {sources.length} references
                    {sources.length > 0 && (
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {sources.slice(0, 4).map((source) => (
                          <div key={source.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                            <div className="text-slate-200">{source.label}</div>
                            <div className="text-[11px] text-slate-400">
                              {source.type} • {source.coverage?.slice(0, 3).join(", ") || "general"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-400">
                    Experience alignment: {dis.metadata.copilotHints?.experience?.id || "n/a"} •{" "}
                    {dis.metadata.copilotHints?.experience?.templateId || "n/a"}
                  </div>
                </div>
              );
            })() : (
              <div className="text-slate-400">Run pipeline to generate DIS.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cm">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
            {state.cm ? (() => {
              const cm = state.cm;
              const gridKeys = Object.keys(cm.layout.grids || {});
              const gridSample = gridKeys[0] ? cm.layout.grids[gridKeys[0]] : null;
              const containerKeys = Object.keys(cm.layout.containers || {});
              const sectionKeys = Object.keys(cm.layout.sections || {});
              return (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs text-slate-400">Strict Mode</div>
                      <div>{cm.verification.strictMode ? "Yes" : "No"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Priority Ordering</div>
                      <div>{cm.verification.priorityOrdering.join(" • ")}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="text-xs text-slate-400">Color Tolerance</div>
                      <div>{Math.round(cm.verification.toleranceLevels.color * 100)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Spacing Tolerance</div>
                      <div>{Math.round(cm.verification.toleranceLevels.spacing * 100)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Typography Tolerance</div>
                      <div>{Math.round(cm.verification.toleranceLevels.typography * 100)}%</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Layout Constraints</div>
                    <div className="mt-2 text-xs text-slate-300">
                      Grids: {gridKeys.length} • Containers: {containerKeys.length} • Sections: {sectionKeys.length}
                    </div>
                    {gridSample && (
                      <div className="mt-2 text-xs text-slate-300">
                        Grid sample: columns {gridSample.columns.desktop.min} • gap {gridSample.gap.min} • padding {gridSample.padding.min}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Responsive Rules</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs text-slate-300">
                      {(["mobile", "tablet", "desktop"] as const).map((bp) => (
                        <div key={bp} className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                          <div className="text-slate-200 capitalize">{bp}</div>
                          <div className="text-[11px] text-slate-400">
                            Grid columns {cm.responsive.layout[bp].gridColumns.min} to {cm.responsive.layout[bp].gridColumns.max}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Font size {cm.responsive.typography[bp].fontSize.min} to {cm.responsive.typography[bp].fontSize.max}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
                    Component contracts: {Object.keys(cm.components.buttons).length} buttons •{" "}
                    {Object.keys(cm.components.cards).length} cards •{" "}
                    {Object.keys(cm.components.navigation).length} navigation items
                  </div>
                </div>
              );
            })() : (
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
                  <Button variant="outline" size="sm" onClick={() => setParityModalOpen(true)} className="text-xs h-6 px-2">
                    Full Report
                  </Button>
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
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void proposeRemedy()}
                      disabled={!state.parityReport.violations.length || remedyState.status === "applying"}
                      className="text-xs"
                    >
                      Remedy Infringements
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void applyRemedy()}
                      disabled={!remedyState.proposals?.length || remedyState.status === "applying"}
                      className="text-xs"
                    >
                      Apply Remedy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void runPipeline()}
                      disabled={state.status === "loading" || !previewExperience || !designQube}
                      className="text-xs"
                    >
                      Re-run DPR
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void rejectRemedy()}
                      disabled={remedyState.status === "applying"}
                      className="text-xs"
                    >
                      Reject Remedy
                    </Button>
                    {remedyState.status === "applied" && (
                      <Badge variant="outline" className="border-emerald-400/50 text-emerald-300">
                        Remedy applied
                      </Badge>
                    )}
                  </div>
                  {remedyState.summary && (
                    <div className="mt-2 text-[11px] text-slate-400">{remedyState.summary}</div>
                  )}
                  {remedyState.proposals && remedyState.proposals.length > 0 && (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {remedyState.proposals.map((proposal, idx) => (
                        <div key={`${proposal}-${idx}`} className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                          {proposal}
                        </div>
                      ))}
                    </div>
                  )}
                  {remedyState.status === "error" && (
                    <div className="mt-2 text-[11px] text-rose-300">{remedyState.error}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-slate-400">Run pipeline to generate DPR.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* COD-208 — Parity Modal */}
      <Dialog open={parityModalOpen} onOpenChange={setParityModalOpen}>
        <DialogContent className="max-w-2xl border-slate-800 bg-slate-950 text-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <BarChart3 className="h-4 w-4 text-violet-400" />
              Design Parity Report
            </DialogTitle>
          </DialogHeader>
          {state.parityReport ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs text-slate-400">Overall Score</div>
                <div className={`text-2xl font-bold ${scoreColor(state.parityReport.parity.overall)}`}>
                  {state.parityReport.parity.overall}/100
                </div>
                <Badge variant="outline" className="border-slate-700 text-slate-300">
                  {state.parityReport.audit.totalChecks} checks
                </Badge>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                  {state.parityReport.audit.passedChecks} passed
                </Badge>
                <Badge variant="outline" className="border-rose-500/40 text-rose-300">
                  {state.parityReport.audit.failedChecks} failed
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
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Violations</div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {state.parityReport.violations.map((v, i) => (
                      <div key={i} className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                        {v.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { void proposeRemedy(); setParityModalOpen(false); }}
                  disabled={!state.parityReport.violations.length || remedyState.status === "applying"} className="text-xs">
                  Remedy Infringements
                </Button>
                <Button variant="outline" size="sm" onClick={() => { void runPipeline(); setParityModalOpen(false); }}
                  disabled={state.status === "loading" || !previewExperience || !designQube} className="text-xs">
                  Re-run DPR
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">
              Run the pipeline to generate a Design Parity Report.
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => { void runPipeline(); setParityModalOpen(false); }}
                  disabled={state.status === "loading" || !previewExperience || !designQube} className="text-xs">
                  Run Pipeline
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AgenticDesignParityPanel;
