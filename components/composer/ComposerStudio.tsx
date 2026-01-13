"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

type ComposerField = {
  id: string;
  name: string;
  type: "text" | "select" | "multiselect" | "checkbox" | "slider" | "textarea";
  required: boolean;
  options?: Array<{ value: string; label: string; description?: string }>;
  validation?: { min?: number; max?: number; step?: number };
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

  const isStepValid = useMemo(() => {
    if (!currentStep) return false;
    return currentStep.ui_config.fields.every((field) => {
      if (!field.required) return true;
      const value = stepValues[field.id];
      if (field.type === "multiselect") return Array.isArray(value) && value.length > 0;
      if (field.type === "checkbox") return value === true;
      return value !== undefined && value !== null && `${value}`.trim().length > 0;
    });
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

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Composer v0</h1>
          <p className="text-slate-400">
            Build ExperienceQubes using guided templates. This uses the existing Composer API and receipt pipeline.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
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
            <div className="mt-4 space-y-3">
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
                    <div className="text-xs text-slate-400">
                      {template.estimated_time} min
                    </div>
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
              <div className="mt-4 space-y-4">
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
                        return (
                          <div key={field.id}>
                            <label className="text-xs text-slate-400">
                              {field.name} {field.required && <span className="text-rose-400">*</span>}
                            </label>
                            {field.type === "text" && (
                              <input
                                value={value || ""}
                                onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                              />
                            )}
                            {field.type === "textarea" && (
                              <textarea
                                value={value || ""}
                                onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                                rows={3}
                              />
                            )}
                            {field.type === "select" && (
                              <select
                                value={value || ""}
                                onChange={(e) => updateField(currentStep.id, field.id, e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
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
                            {field.help_text && (
                              <div className="mt-1 text-[11px] text-slate-500">{field.help_text}</div>
                            )}
                          </div>
                        );
                      })}
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
                </div>
              </div>
            )}
          </div>
        </div>

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
          <div className="mt-4 grid gap-3 md:grid-cols-2">
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
              </div>
            ))}
            {experiences.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                No ExperienceQubes created yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
