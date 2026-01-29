"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { CopilotChat } from "@copilotkit/react-ui";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import type { DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { SmartTriadProvider } from "@/app/components/content";
import { liquidTemplateRegistry } from "@/app/triad/components/codex/liquidTemplates/registry";
import { resolveLiquidTemplateId } from "@/services/composer/composerRegistryMapping";
import type { SmartContentQube } from "@/types/smartContent";
import { useDesignQubeTheme } from "@/components/metame/useDesignQubeTheme";
import type { DesignQube, DesignQubeThemeMode } from "@/types/designQube";

type ComposerField = {
  id: string;
  name: string;
  type: "text" | "select" | "multiselect" | "checkbox" | "slider" | "textarea";
  required: boolean;
  options?: Array<{ value: string; label: string; description?: string }>;
  validation?: { min?: number; max?: number; step?: number; pattern?: string };
  default_value?: any;
  help_text?: string;
};

type ComposerStep = {
  id: string;
  title: string;
  description: string;
  type: "selection" | "configuration" | "validation" | "preview";
  required: boolean;
  component_type?: "DataQube" | "ContentQube" | "ToolQube" | "ModelQube" | "AgentQube";
  ui_config: {
    layout: "wizard" | "form" | "grid" | "timeline";
    fields: ComposerField[];
  };
};

type ExperienceTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: string;
  estimated_time: number;
  required_components: string[];
  optional_components: string[];
  steps: ComposerStep[];
  tags: string[];
};

type ComposerSession = {
  id: string;
  tenant_id: string;
  user_id: string;
  template_id: string;
  current_step: number;
  status: "active" | "completed" | "abandoned";
  data: Record<string, any>;
};

type ExperienceQube = {
  id: string;
  name: string;
  description: string;
  tenant_id: string;
  creator_id: string;
  template_id: string;
  status: string;
  metadata?: { tags?: string[]; category?: string; version?: string };
};

const DEFAULT_TENANT = "t_demo_001";
const DEFAULT_USER = "u_demo_001";

export const ComposerStudio = () => {
  const router = useRouter();
  const [templates, setTemplates] = useState<ExperienceTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT);
  const [userId, setUserId] = useState(DEFAULT_USER);
  const [session, setSession] = useState<ComposerSession | null>(null);
  const [sessionTemplate, setSessionTemplate] = useState<ExperienceTemplate | null>(null);
  const [sessionData, setSessionData] = useState<Record<string, any>>({});
  const [stepData, setStepData] = useState<Record<string, Record<string, any>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [experience, setExperience] = useState<ExperienceQube | null>(null);
  const [experiences, setExperiences] = useState<ExperienceQube[]>([]);
  const [designQube, setDesignQube] = useState<DesignQube | null>(null);
  const [designQubeLoading, setDesignQubeLoading] = useState(false);
  const [designQubeError, setDesignQubeError] = useState<string | null>(null);
  const [designTheme, setDesignTheme] = useState<DesignQubeThemeMode>("dark");
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<DeviceType>("mobile");
  const [previewAction, setPreviewAction] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchTemplates = async () => {
      try {
        setTemplatesLoading(true);
        const res = await fetch("/api/composer/templates");
        if (!res.ok) throw new Error("Failed to load templates");
        const data = await res.json();
        if (active) {
          setTemplates(data.templates || []);
          setTemplatesError(null);
        }
      } catch (err: any) {
        if (active) setTemplatesError(err.message || "Failed to load templates");
      } finally {
        if (active) setTemplatesLoading(false);
      }
    };
    fetchTemplates();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchDesignQube = async () => {
      try {
        setDesignQubeLoading(true);
        const res = await fetch("/api/metame/design-qube?includeImages=1");
        if (!res.ok) throw new Error("Failed to load DesignQube");
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to load DesignQube");
        if (active) {
          setDesignQube(data.designQube || null);
          setDesignQubeError(null);
        }
      } catch (err: any) {
        if (active) setDesignQubeError(err.message || "Failed to load DesignQube");
      } finally {
        if (active) setDesignQubeLoading(false);
      }
    };
    fetchDesignQube();
    return () => {
      active = false;
    };
  }, []);

  useDesignQubeTheme(designQube?.tokens, designQube?.constraints, designTheme);

  const [previewSession, setPreviewSession] = useState({
    consentGiven: false,
    iqubeCreated: false,
    settlementComplete: false,
    shared: false,
  });

  const previewExperience = useMemo(() => {
    if (!selectedExperienceId) return experience;
    return experiences.find((exp) => exp.id === selectedExperienceId) || experience;
  }, [selectedExperienceId, experiences, experience]);

  const liquidTemplateId = resolveLiquidTemplateId((previewExperience as any) || null);
  const PreviewTemplate = liquidTemplateRegistry[liquidTemplateId] || liquidTemplateRegistry["liquidui:drawer_grid_v1"];
  const demoContent = useMemo(() => {
    return [
      {
        id: previewExperience?.id || "experience-preview",
        type: "SmartContentQube",
        app: "metaMe",
        title: previewExperience?.name || "Experience Preview",
        description: previewExperience?.description || "Preview capsule",
        rewardOutcomes: {
          engagementRewards: previewSession.settlementComplete
            ? [{ trigger: "settled", amount: 40, currency: "Q¢" }]
            : [],
        },
        modalities: { read: { enabled: true }, watch: { enabled: false }, listen: { enabled: false }, interact: { enabled: false } },
      } as unknown as SmartContentQube,
    ];
  }, [previewExperience, previewSession.settlementComplete]);

  const previewTemplateDevice = previewDevice === "desktop" ? "desktop" : previewDevice === "tablet" ? "tablet" : "mobile";

  const previewSettings = useMemo(() => {
    return {
      device: previewTemplateDevice,
      action: previewAction,
      consentGiven: previewSession.consentGiven,
      iqubeCreated: previewSession.iqubeCreated,
      settlementComplete: previewSession.settlementComplete,
      shared: previewSession.shared,
      receipts: previewSession.settlementComplete
        ? [
            {
              id: `receipt_${previewExperience?.id || "preview"}`,
              action: "settle",
              createdAt: new Date().toISOString(),
              receiptId: `rcpt_${Math.random().toString(36).slice(2, 8)}`,
            },
          ]
        : [],
    };
  }, [previewTemplateDevice, previewAction, previewSession, previewExperience?.id]);

  const RuntimePreviewMenu = ({
    onEarn,
    onPlay,
    onMake,
    onBe,
    onShare,
  }: {
    onEarn?: () => void;
    onPlay?: () => void;
    onMake?: () => void;
    onBe?: () => void;
    onShare?: () => void;
  }) => (
    <div className="absolute inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/90 px-4 py-2 text-[10px] uppercase tracking-wide text-slate-300 backdrop-blur">
      <div className="flex items-center justify-between">
        <button onClick={onBe} className="text-slate-400 hover:text-white">Be</button>
        <div className="flex items-center gap-4 text-slate-100">
          <button onClick={onEarn} className="hover:text-white">Earn</button>
          <button onClick={onPlay} className="hover:text-white">Play</button>
          <button onClick={onMake} className="hover:text-white">Make</button>
        </div>
        <button onClick={onShare} className="text-slate-400 hover:text-white">Share</button>
      </div>
    </div>
  );

  const PreviewStatus = () => (
    <div className="absolute top-3 right-3 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span>Consent</span>
        <span className={previewSession.consentGiven ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.consentGiven ? "On" : "Off"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>iQube</span>
        <span className={previewSession.iqubeCreated ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.iqubeCreated ? "Created" : "Pending"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>Settlement</span>
        <span className={previewSession.settlementComplete ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.settlementComplete ? "Complete" : "Pending"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>Share</span>
        <span className={previewSession.shared ? "text-emerald-300" : "text-slate-500"}>
          {previewSession.shared ? "Sent" : "Pending"}
        </span>
      </div>
    </div>
  );

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    const fetchExperiences = async () => {
      try {
        const res = await fetch(`/api/composer/experiences?tenant_id=${encodeURIComponent(tenantId)}`);
        if (!res.ok) throw new Error("Failed to load experiences");
        const data = await res.json();
        if (active) setExperiences(data.experience_qubes || []);
      } catch {
        if (active) setExperiences([]);
      }
    };
    fetchExperiences();
    return () => {
      active = false;
    };
  }, [tenantId, experience?.id]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const currentStep = useMemo(() => {
    if (!sessionTemplate) return null;
    return sessionTemplate.steps[session?.current_step || 0] || null;
  }, [sessionTemplate, session?.current_step]);

  const getFieldError = (field: ComposerField, value: any): string | null => {
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0);

    if (field.type === "multiselect") {
      const list = Array.isArray(value) ? value : [];
      if (field.required && list.length === 0) return "Select at least one option.";
      return null;
    }

    if (field.type === "checkbox") {
      if (field.required && value !== true) return "This must be enabled.";
      return null;
    }

    if (field.required && isEmpty) return "This field is required.";

    if (field.validation?.pattern && !isEmpty) {
      try {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(String(value))) return "Value does not match the required format.";
      } catch {
        // Ignore invalid regex patterns.
      }
    }

    if (field.validation && typeof value === "number") {
      const min = field.validation.min;
      const max = field.validation.max;
      if (min !== undefined && value < min) return `Minimum value is ${min}.`;
      if (max !== undefined && value > max) return `Maximum value is ${max}.`;
    }

    return null;
  };

  useEffect(() => {
    if (!currentStep) return;
    setStepData((prev) => {
      if (prev[currentStep.id]) return prev;
      const defaults: Record<string, any> = {};
      currentStep.ui_config.fields.forEach((field) => {
        if (field.default_value !== undefined) defaults[field.id] = field.default_value;
      });
      if (Object.keys(defaults).length === 0) return prev;
      return { ...prev, [currentStep.id]: defaults };
    });
  }, [currentStep]);

  const stepValues = currentStep ? stepData[currentStep.id] || {} : {};

  const mergedData = useMemo(() => {
    if (!currentStep) return sessionData;
    return {
      ...sessionData,
      [currentStep.id]: stepValues,
    };
  }, [currentStep, sessionData, stepValues]);

  const isStepValid = useMemo(() => {
    if (!currentStep) return false;
    return currentStep.ui_config.fields.every((field) => !getFieldError(field, stepValues[field.id]));
  }, [currentStep, stepValues]);

  const handleStartSession = async () => {
    if (!selectedTemplate || !tenantId || !userId) return;
    try {
      setSessionError(null);
      setIsSaving(true);
      const res = await fetch("/api/composer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: userId,
          template_id: selectedTemplate.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      setSession(data.session);
      setSessionTemplate({ ...selectedTemplate, steps: data.template.steps || selectedTemplate.steps });
      setSessionData(data.session?.data || {});
      setStepData({});
      setExperience(null);
    } catch (err: any) {
      setSessionError(err.message || "Failed to start session");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSession = async (nextStep: number) => {
    if (!session) return;
    const nextData = {
      ...sessionData,
      ...(currentStep ? { [currentStep.id]: stepValues } : {}),
    };
    const res = await fetch(`/api/composer/sessions/${session.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_step: nextStep,
        data: nextData,
        status: session.status,
      }),
    });
    if (!res.ok) throw new Error("Failed to save session");
    const data = await res.json();
    setSession(data.session);
    setSessionData(nextData);
  };

  const handleNext = async () => {
    if (!sessionTemplate || !session) return;
    const nextStep = Math.min(sessionTemplate.steps.length - 1, (session.current_step || 0) + 1);
    try {
      setIsSaving(true);
      await updateSession(nextStep);
    } catch (err: any) {
      setSessionError(err.message || "Failed to save step");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = async () => {
    if (!sessionTemplate || !session) return;
    const prevStep = Math.max(0, (session.current_step || 0) - 1);
    try {
      setIsSaving(true);
      await updateSession(prevStep);
    } catch (err: any) {
      setSessionError(err.message || "Failed to save step");
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    try {
      setIsCompleting(true);
      setSessionError(null);
      const res = await fetch(`/api/composer/sessions/${session.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!res.ok) throw new Error("Failed to complete session");
      const data = await res.json();
      setExperience(data.experience_qube || null);
      setSession((prev) => (prev ? { ...prev, status: "completed" } : prev));
    } catch (err: any) {
      setSessionError(err.message || "Failed to complete session");
    } finally {
      setIsCompleting(false);
    }
  };

  const updateField = (stepId: string, fieldId: string, value: any) => {
    setStepData((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [fieldId]: value,
      },
    }));
  };

  const cardClass = "rounded-2xl border border-slate-800 bg-slate-900/60 p-6";
  const summaryCardClass = "rounded-xl border border-slate-800 bg-slate-950/60 p-4";
  const copilotInstructions = `You are the Studio Compose Copilot. Help the user define the next micro-experience to compose.\nFocus on intent, audience, template choice, and required modules. Provide short, decisive prompts.`;

  const getMergedValue = (stepId: string, fieldId: string) => mergedData?.[stepId]?.[fieldId];
  const summary = useMemo(() => {
    if (!sessionTemplate) return [];
    const getLabel = (stepId: string, fieldId: string) => {
      const step = sessionTemplate.steps.find((s) => s.id === stepId);
      const field = step?.ui_config.fields.find((f) => f.id === fieldId);
      return field?.name || fieldId;
    };

    const list: Array<{ label: string; value: string }> = [];
    const intentStep = mergedData.intent_timebox || {};
    if (intentStep.experience_name) list.push({ label: getLabel("intent_timebox", "experience_name"), value: intentStep.experience_name });
    if (intentStep.goal) list.push({ label: getLabel("intent_timebox", "goal"), value: intentStep.goal });
    if (intentStep.time_available) list.push({ label: getLabel("intent_timebox", "time_available"), value: `${intentStep.time_available} min` });
    if (intentStep.depth) list.push({ label: getLabel("intent_timebox", "depth"), value: intentStep.depth });

    const contentStep = mergedData.content_selection || {};
    if (contentStep.issue_slug) list.push({ label: getLabel("content_selection", "issue_slug"), value: contentStep.issue_slug });
    if (contentStep.feature_item_id) list.push({ label: getLabel("content_selection", "feature_item_id"), value: contentStep.feature_item_id });
    if (Array.isArray(contentStep.supporting_item_ids) && contentStep.supporting_item_ids.length > 0) {
      list.push({ label: getLabel("content_selection", "supporting_item_ids"), value: `${contentStep.supporting_item_ids.length} items` });
    }

    const walletStep = mergedData.wallet_rewards || {};
    if (walletStep.unlock_price !== undefined) list.push({ label: getLabel("wallet_rewards", "unlock_price"), value: `${walletStep.unlock_price} Q¢` });
    if (walletStep.reward_amount !== undefined) list.push({ label: getLabel("wallet_rewards", "reward_amount"), value: `${walletStep.reward_amount} Q¢` });
    if (walletStep.require_wallet_connect !== undefined) list.push({ label: getLabel("wallet_rewards", "require_wallet_connect"), value: walletStep.require_wallet_connect ? "Required" : "Optional" });

    const copilotStep = mergedData.copilot_output || {};
    if (Array.isArray(copilotStep.outputs) && copilotStep.outputs.length > 0) {
      list.push({ label: getLabel("copilot_output", "outputs"), value: copilotStep.outputs.join(", ") });
    }
    if (copilotStep.takeaways_count !== undefined) list.push({ label: getLabel("copilot_output", "takeaways_count"), value: String(copilotStep.takeaways_count) });

    return list;
  }, [mergedData, sessionTemplate]);

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Composer v0</h1>
          <p className="text-slate-400">
            Build ExperienceQubes using guided templates. This uses the existing Composer API and receipt pipeline.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr_1fr]">
          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Compose Copilot</h2>
                <p className="text-sm text-slate-400">What would you like to compose?</p>
              </div>
            </div>
            <div className="mt-4 h-[520px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
              <CopilotChat
                instructions={copilotInstructions}
                labels={{
                  title: "Compose Copilot",
                  initial: "What would you like to compose?",
                  placeholder: "Describe the experience you want to build...",
                }}
                className="h-full"
              />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Templates</h2>
                <p className="text-sm text-slate-400">Select a template to begin a new session.</p>
              </div>
              {templatesLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>
            {templatesError && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {templatesError}
              </div>
            )}
            <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-1">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedTemplateId === template.id
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{template.name}</div>
                      <div className="text-xs text-slate-400">{template.description}</div>
                    </div>
                    <div className="text-xs text-slate-400">{template.estimated_time} min</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span className="rounded-full border border-slate-700 px-2 py-0.5">
                      {template.category}
                    </span>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5">
                      {template.complexity}
                    </span>
                    {template.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-700 px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
              {!templatesLoading && templates.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                  No templates available yet.
                </div>
              )}
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400">Tenant ID</label>
                <input
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">User ID</label>
                <input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                />
              </div>
            </div>
            <button
              onClick={handleStartSession}
              disabled={!selectedTemplate || isSaving}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-500/40"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Session"}
            </button>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Session</h2>
                <p className="text-sm text-slate-400">Follow the guided steps and publish an ExperienceQube.</p>
              </div>
              {session && (
                <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                  {session.status}
                </span>
              )}
            </div>
            {!session && (
              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                Start a session to begin composing an experience.
              </div>
            )}
            {session && sessionTemplate && (
              <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {sessionTemplate.steps.map((step, idx) => (
                    <div key={step.id} className="flex items-start gap-3">
                      {idx <= (session.current_step || 0) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-500 mt-0.5" />
                      )}
                      <div>
                        <div className="text-sm text-slate-200">{step.title}</div>
                        <div className="text-xs text-slate-500">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {currentStep && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="mb-2 text-sm font-semibold text-white">{currentStep.title}</div>
                    <div className="mb-4 text-xs text-slate-400">{currentStep.description}</div>
                    <div className="space-y-3">
                      {currentStep.ui_config.fields.map((field) => {
                        const value = stepValues[field.id];
                        const error = getFieldError(field, value);
                        return (
                          <div key={field.id}>
                            <label className="text-xs text-slate-400">
                              {field.name} {field.required && <span className="text-rose-400">*</span>}
                            </label>
                            {field.type === "text" && (
                              <input
                                value={value || ""}
                                onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                className={`mt-1 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 ${
                                  error ? "border-rose-500/60" : "border-slate-800"
                                }`}
                              />
                            )}
                            {field.type === "textarea" && (
                              <textarea
                                value={value || ""}
                                onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                className={`mt-1 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 ${
                                  error ? "border-rose-500/60" : "border-slate-800"
                                }`}
                                rows={3}
                              />
                            )}
                            {field.type === "select" && (
                              <select
                                value={value || ""}
                                onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                className={`mt-1 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 ${
                                  error ? "border-rose-500/60" : "border-slate-800"
                                }`}
                              >
                                <option value="">Select...</option>
                                {field.options?.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            {field.type === "multiselect" && (
                              <div className="mt-2 grid gap-2">
                                {field.options?.map((opt) => {
                                  const selected = Array.isArray(value) && value.includes(opt.value);
                                  return (
                                    <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={(e) => {
                                          const next = new Set(Array.isArray(value) ? value : []);
                                          if (e.target.checked) next.add(opt.value);
                                          else next.delete(opt.value);
                                          updateField(currentStep.id, field.id, Array.from(next));
                                        }}
                                      />
                                      {opt.label}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            {field.type === "checkbox" && (
                              <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={value === true}
                                  onChange={(e) => updateField(currentStep.id, field.id, e.target.checked)}
                                />
                                Enabled
                              </label>
                            )}
                            {field.type === "slider" && (
                              <div className="mt-2 space-y-1">
                                <input
                                  type="range"
                                  min={field.validation?.min ?? 0}
                                  max={field.validation?.max ?? 100}
                                  step={field.validation?.step ?? 1}
                                  value={value ?? field.default_value ?? 0}
                                  onChange={(e) => updateField(currentStep.id, field.id, Number(e.target.value))}
                                  className="w-full"
                                />
                                <div className="text-xs text-slate-500">
                                  {value ?? field.default_value ?? 0}
                                </div>
                              </div>
                            )}
                            {error && <div className="mt-1 text-[11px] text-rose-300">{error}</div>}
                            {field.help_text && !error && (
                              <div className="mt-1 text-[11px] text-slate-500">{field.help_text}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {summary.length > 0 && (
                  <div className={summaryCardClass}>
                    <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">Experience Snapshot</div>
                    <div className="grid gap-2 text-sm text-slate-200">
                      {summary.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">{item.label}</span>
                          <span className="text-slate-200 text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sessionError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {sessionError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleBack}
                    disabled={!session || (session.current_step || 0) === 0 || isSaving}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!sessionTemplate || !session || !isStepValid || isSaving || (session.current_step || 0) === sessionTemplate.steps.length - 1}
                    className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Next"}
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={!sessionTemplate || !session || !isStepValid || isCompleting || (session.current_step || 0) !== sessionTemplate.steps.length - 1}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isCompleting ? "Completing..." : "Complete"}
                  </button>
                  {experience && (
                    <button
                      onClick={() => router.push(`/studio/composer/experience/${experience.id}`)}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200"
                    >
                      Open Experience
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">ExperienceQubes</h2>
                <p className="text-sm text-slate-400">Latest experiences for the current tenant.</p>
              </div>
              {experience && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                  Created {experience.name}
                </span>
              )}
            </div>
            <div className="mt-4 max-h-[420px] overflow-y-auto pr-1">
              <div className="grid gap-3 md:grid-cols-2">
                {experiences.map((exp) => (
                  <div key={exp.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="text-sm font-semibold text-white">{exp.name}</div>
                    <div className="text-xs text-slate-400">{exp.description}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                      <span className="rounded-full border border-slate-700 px-2 py-0.5">{exp.status}</span>
                      {exp.metadata?.category && (
                        <span className="rounded-full border border-slate-700 px-2 py-0.5">
                          {exp.metadata.category}
                        </span>
                      )}
                      {exp.metadata?.tags?.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-700 px-2 py-0.5">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedExperienceId(exp.id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          selectedExperienceId === exp.id
                            ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                            : "border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => router.push(`/studio/composer/experience/${exp.id}`)}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                      >
                        Launch Experience
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {experiences.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                  No ExperienceQubes created yet.
                </div>
              )}
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">DesignQube</h2>
                <p className="text-sm text-slate-400">Guidance cartridge for Runtime and Studio composition.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs uppercase tracking-wider text-slate-500">Theme</label>
                <select
                  value={designTheme}
                  onChange={(event) => setDesignTheme(event.target.value as DesignQubeThemeMode)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="dark">Dark (KNYT glass)</option>
                  <option value="light">Light (metaMe beige)</option>
                </select>
              </div>
            </div>

            {designQubeLoading && (
              <div className="mt-4 text-sm text-slate-400">Loading DesignQube references...</div>
            )}
            {designQubeError && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {designQubeError}
              </div>
            )}

            {designQube && (
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                  <span>{designQube.name}</span>
                  <span>{designQube.references?.length || 0} reference screens</span>
                </div>
                {designQube.manifest && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="rounded-full border border-slate-700 px-2 py-0.5">
                      {designQube.manifest.authorityLevel || "guidance"}
                    </span>
                    {designQube.manifest.themes?.map((theme) => (
                      <span key={theme} className="rounded-full border border-slate-700 px-2 py-0.5">
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
                {designQube.styleBrief && (
                  <div className="mt-2 max-h-[160px] overflow-y-auto pr-1 text-sm text-slate-300">
                    {designQube.styleBrief}
                  </div>
                )}
                <div className="mt-4 max-h-[420px] overflow-y-auto pr-1">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {designQube.references?.slice(0, 6).map((ref) => (
                      <div key={ref.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-2">
                        {ref.dataUrl ? (
                          <img
                            src={ref.dataUrl}
                            alt={ref.title || ref.file}
                            className="h-32 w-full rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">
                            {ref.file}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-slate-400">{ref.title || ref.file}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Runtime Preview</h2>
                <p className="text-sm text-slate-400">Toggle device sizes to validate the Runtime flow.</p>
              </div>
              {previewAction && (
                <span className="text-xs text-slate-400">Last action: {previewAction}</span>
              )}
            </div>
            <div className="mt-4 h-[620px]">
              {PreviewTemplate ? (
                <PreviewFrame
                  defaultDevice="mobile"
                  chromeless
                  deviceQueryParam="device"
                  onDeviceChange={(device) => setPreviewDevice(device)}
                >
                  <div className="relative min-h-[600px]">
                    <SmartTriadProvider initialContent={demoContent[0]}>
                      <PreviewTemplate
                        contentObjects={demoContent}
                        contentObject={demoContent[0]}
                        device={previewTemplateDevice}
                        messages={[]}
                        events={[]}
                        lineItems={[]}
                        listings={[]}
                        columns={[]}
                        points={[]}
                        session={previewSettings}
                        document={{}}
                        nodes={[]}
                        project={{}}
                        cells={[]}
                        settings={previewSettings}
                      />
                    </SmartTriadProvider>
                    <PreviewStatus />
                    <RuntimePreviewMenu
                      onBe={() => setPreviewAction("Be")}
                      onEarn={() => {
                        setPreviewAction("Earn");
                        setPreviewSession((prev) => ({
                          ...prev,
                          consentGiven: true,
                          iqubeCreated: true,
                          settlementComplete: true,
                        }));
                      }}
                      onPlay={() => setPreviewAction("Play")}
                      onMake={() => {
                        setPreviewAction("Make");
                        setPreviewSession((prev) => ({ ...prev, consentGiven: true, iqubeCreated: true }));
                      }}
                      onShare={() => {
                        setPreviewAction("Share");
                        setPreviewSession((prev) => ({ ...prev, shared: true }));
                      }}
                    />
                  </div>
                </PreviewFrame>
              ) : (
                <PreviewFrame
                  src={`/metame/runtime/offer?embed=1&stub=1&theme=${designTheme}`}
                  defaultDevice="mobile"
                  chromeless
                />
              )}
            </div>
          </div>
      </div>
    </div>
  );
};
