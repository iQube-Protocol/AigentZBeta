"use client";

/**
 * CartridgeSetupWizard — the third aigentMe setup wizard. Lands the
 * operator's intent to create a myCartridge as a real cartridge in the
 * codex registry.
 *
 * Phase 6 of the myCartridge PRD §28 + §32. Modeled on
 * ExperienceModelSetupWizard.tsx (dialog shell, step indicator, Field +
 * RadioGroup helpers, personaFetch, save/error UI, re-hydration on
 * open).
 *
 * Five steps:
 *   1. Identity       — title + slug + description + category
 *   2. Purpose        — purpose + audience + visibility (calls
 *                       /api/assistant/cartridge-recommend on entry)
 *   3. Tabs           — template bundle picker, tab list
 *   4. Permissions    — per-tab visibility + primary tab pick
 *   5. Triad + Active + Catalogue
 *
 * Persistence: POST /api/assistant/cartridge-config.
 *
 * Phase 6 scope NOT implemented here:
 *   - Inline tab reorder (PRD §28 step 3) — Phase 7 manager surface.
 *   - JSON blob upload (PRD §28 step 5 KB sources) — typed only.
 *   - Token-gating UI (PRD §28 step 4) — labelled only, no wallet wiring.
 *   - Cartridge-copilot opt-in (PRD §28 step 5 Copilot) — disabled radio.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import type {
  CartridgeCategory,
  CartridgeVisibility,
  CartridgeTabTemplateId,
  CartridgeTabVisibility,
  CartridgeCopilotSource,
  SpecialistId,
  TokenId,
} from "@/types/ventureQube";

// ─── Types ────────────────────────────────────────────────────────────────

type TemplateBundle = "community" | "venture" | "knowledge" | "creative" | "custom";

interface PickedTab {
  slug: string;
  label: string;
  templateId: CartridgeTabTemplateId;
  visibility: CartridgeTabVisibility;
  primary: boolean;
}

interface FormState {
  // Step 1
  title: string;
  slug: string;
  description: string;
  category: CartridgeCategory;
  // Step 2
  purpose: string;
  audienceKind: "open" | "gated" | "franchise" | "inner-circle";
  audienceSize: "1-10" | "10-100" | "100-1k" | "1k-10k" | "10k+";
  visibility: CartridgeVisibility;
  // Step 3
  templateBundle: TemplateBundle;
  tabs: PickedTab[];
  // Step 4
  primaryTabSlug: string;
  // Step 5
  copilotSource: CartridgeCopilotSource;
  knowledgeSources: Array<"mycanvas" | "myworkspace" | "uploads" | "codex" | "json_blob">;
  walletEnabled: boolean;
  tokenWhitelist: TokenId[];
  walletPrimitives: {
    cryptoSend: boolean;
    cryptoReceive: boolean;
    paymentRequest: boolean;
    rewardPayout: boolean;
  };
  specialists: SpecialistId[];
  primarySpecialist?: SpecialistId;
  activeTabSlug: string;
  activeTabMetrics: string[];
  activeTabActions: string[];
  catalogueOptIn: boolean;
}

interface Recommendation {
  templateBundle: TemplateBundle;
  category: string;
  visibility: CartridgeVisibility;
  availableSpecialists: SpecialistId[];
  primarySpecialist: SpecialistId;
  rationale: string;
}

interface CartridgeSavedResult {
  id: string;
  slug: string;
  title: string;
  category: CartridgeCategory;
  visibility: CartridgeVisibility;
  primaryTabSlug: string;
  activeTabSlug: string;
  tabCount: number;
  catalogueStatus: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<FormState>;
  onSaved: (result: CartridgeSavedResult) => void;
}

// ─── Option catalogues ────────────────────────────────────────────────────

const CATEGORIES: Array<{ value: CartridgeCategory; label: string; hint: string }> = [
  { value: "community", label: "Community", hint: "Cohorts, franchises, member networks" },
  { value: "venture", label: "Venture", hint: "Active venture, raise, growth program" },
  { value: "knowledge", label: "Knowledge", hint: "Codex / library / research archive" },
  { value: "creative", label: "Creative", hint: "Editorial, IP, narrative universe" },
  { value: "media", label: "Media", hint: "Channel, publication, broadcast" },
  { value: "franchise", label: "Franchise", hint: "Distributed operator network" },
  { value: "learning", label: "Learning", hint: "Course, curriculum, cohort" },
  { value: "research", label: "Research", hint: "Live inquiry, lab, working group" },
  { value: "professional", label: "Professional", hint: "Practice, client roster, advisory" },
  { value: "private", label: "Private", hint: "Personal / inner-circle only" },
];

const AUDIENCE_KINDS: Array<{ value: FormState["audienceKind"]; label: string; hint: string }> = [
  { value: "open", label: "Open", hint: "Anyone can find + join" },
  { value: "gated", label: "Gated", hint: "Approved members only" },
  { value: "franchise", label: "Franchise", hint: "Affiliated operators + members" },
  { value: "inner-circle", label: "Inner circle", hint: "Invitation only" },
];

const AUDIENCE_SIZES: Array<{ value: FormState["audienceSize"]; label: string }> = [
  { value: "1-10", label: "1–10" },
  { value: "10-100", label: "10–100" },
  { value: "100-1k", label: "100–1k" },
  { value: "1k-10k", label: "1k–10k" },
  { value: "10k+", label: "10k+" },
];

const VISIBILITIES: Array<{ value: CartridgeVisibility; label: string; hint: string }> = [
  { value: "public", label: "Public", hint: "Listed in discovery + Activation Catalogue eligible" },
  { value: "member-only", label: "Member only", hint: "Visible to members only" },
  { value: "invite-only", label: "Invite only", hint: "Visible to invited personas" },
  { value: "private", label: "Private", hint: "Owner only" },
];

const TEMPLATE_BUNDLES: Array<{
  value: TemplateBundle;
  label: string;
  hint: string;
  tabs: Omit<PickedTab, "primary">[];
}> = [
  {
    value: "community",
    label: "Community",
    hint: "Pulse, Codex, Members, Active",
    tabs: [
      { slug: "overview", label: "Overview", templateId: "overview-v1", visibility: "public" },
      { slug: "pulse", label: "Pulse", templateId: "pulse-v1", visibility: "public" },
      { slug: "codex", label: "Codex", templateId: "codex-v1", visibility: "public" },
      { slug: "members", label: "Members", templateId: "members-v1", visibility: "member" },
      { slug: "active", label: "Active", templateId: "active-v1", visibility: "public" },
    ],
  },
  {
    value: "venture",
    label: "Venture",
    hint: "Overview, Venture, Codex, Active, Members, Ledger",
    tabs: [
      { slug: "overview", label: "Overview", templateId: "overview-v1", visibility: "public" },
      { slug: "venture", label: "Venture", templateId: "venture-v1", visibility: "member" },
      { slug: "codex", label: "Codex", templateId: "codex-v1", visibility: "public" },
      { slug: "active", label: "Active", templateId: "active-v1", visibility: "public" },
      { slug: "members", label: "Members", templateId: "members-v1", visibility: "member" },
      { slug: "ledger", label: "Ledger", templateId: "ledger-v1", visibility: "admin" },
    ],
  },
  {
    value: "knowledge",
    label: "Knowledge estate",
    hint: "Overview, Codex, Experience, Active",
    tabs: [
      { slug: "overview", label: "Overview", templateId: "overview-v1", visibility: "public" },
      { slug: "codex", label: "Codex", templateId: "codex-v1", visibility: "public" },
      { slug: "experience", label: "Experience", templateId: "experience-v1", visibility: "member" },
      { slug: "active", label: "Active", templateId: "active-v1", visibility: "public" },
    ],
  },
  {
    value: "creative",
    label: "Creative universe",
    hint: "Overview, Codex, Pulse, Active",
    tabs: [
      { slug: "overview", label: "Overview", templateId: "overview-v1", visibility: "public" },
      { slug: "codex", label: "Codex", templateId: "codex-v1", visibility: "public" },
      { slug: "pulse", label: "Pulse", templateId: "pulse-v1", visibility: "public" },
      { slug: "active", label: "Active", templateId: "active-v1", visibility: "public" },
    ],
  },
  {
    value: "custom",
    label: "Custom",
    hint: "Start minimal, add tabs later",
    tabs: [
      { slug: "overview", label: "Overview", templateId: "overview-v1", visibility: "public" },
      { slug: "active", label: "Active", templateId: "active-v1", visibility: "public" },
    ],
  },
];

const ALL_TAB_VISIBILITIES: Array<{ value: CartridgeTabVisibility; label: string }> = [
  { value: "public", label: "public" },
  { value: "member", label: "member" },
  { value: "admin", label: "admin" },
  { value: "invite", label: "invite" },
  { value: "token-gated", label: "token-gated" },
];

const SPECIALISTS: Array<{ value: SpecialistId; label: string }> = [
  { value: "aigent-c", label: "Aigent C" },
  { value: "aigent-z", label: "Aigent Z" },
  { value: "marketa", label: "Marketa" },
  { value: "moneypenny", label: "Moneypenny" },
  { value: "kn0w1", label: "Kn0w1" },
  { value: "quill", label: "Quill" },
  { value: "metaye", label: "Metayé" },
  { value: "aigent-nakamoto", label: "Aigent Nakamoto" },
];

// ─── Wizard ───────────────────────────────────────────────────────────────

const STEP_TITLES = ["Identity", "Purpose", "Tabs", "Permissions", "Triad & Active"];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function defaultForm(): FormState {
  return {
    title: "",
    slug: "",
    description: "",
    category: "venture",
    purpose: "",
    audienceKind: "open",
    audienceSize: "1-10",
    visibility: "private",
    templateBundle: "venture",
    tabs: TEMPLATE_BUNDLES[1].tabs.map((t, i) => ({ ...t, primary: i === 0 })),
    primaryTabSlug: "overview",
    copilotSource: "aigentMe",
    knowledgeSources: ["mycanvas", "myworkspace"],
    walletEnabled: false,
    tokenWhitelist: ["q-cent", "usdc"],
    walletPrimitives: {
      cryptoSend: false,
      cryptoReceive: false,
      paymentRequest: false,
      rewardPayout: false,
    },
    specialists: ["aigent-c", "moneypenny", "marketa"],
    primarySpecialist: "aigent-c",
    activeTabSlug: "active",
    activeTabMetrics: [],
    activeTabActions: [],
    catalogueOptIn: false,
  };
}

export function CartridgeSetupWizard({ open, onOpenChange, initial, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => ({ ...defaultForm(), ...initial }));
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Re-hydrate on each open — same pattern as ExperienceModelSetupWizard.
  const prevOpenRef = useRef(open);
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return;
    setForm({ ...defaultForm(), ...initial });
    setStep(0);
    setError(null);
    setRecommendation(null);
    setSlugManuallyEdited(false);
  }, [open, initial]);

  // Auto-derive slug from title until the user types in the slug field.
  useEffect(() => {
    if (!slugManuallyEdited) {
      setForm((f) => ({ ...f, slug: slugify(f.title) }));
    }
  }, [form.title, slugManuallyEdited]);

  // Fetch the recommendation when the user enters step 2 the first time.
  useEffect(() => {
    if (step !== 1 || recommendation || recommending) return;
    let cancelled = false;
    (async () => {
      setRecommending(true);
      try {
        const res = await personaFetch("/api/assistant/cartridge-recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            experienceName: form.title,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; recommendation?: Recommendation };
        if (cancelled || !data.ok || !data.recommendation) return;
        setRecommendation(data.recommendation);
      } catch {
        // silent — recommendation is purely advisory
      } finally {
        if (!cancelled) setRecommending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, recommendation, recommending, form.title]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyBundle(bundle: TemplateBundle) {
    const b = TEMPLATE_BUNDLES.find((x) => x.value === bundle);
    if (!b) return;
    const tabs = b.tabs.map((t, i) => ({ ...t, primary: i === 0 }));
    const firstSlug = tabs[0]?.slug ?? "overview";
    const activeSlug =
      tabs.find((t) => t.slug === "active")?.slug ?? firstSlug;
    setForm((f) => ({
      ...f,
      templateBundle: bundle,
      tabs,
      primaryTabSlug: firstSlug,
      activeTabSlug: activeSlug,
    }));
  }

  function acceptRecommendation() {
    if (!recommendation) return;
    setForm((f) => ({
      ...f,
      category: recommendation.category as CartridgeCategory,
      visibility: recommendation.visibility,
      specialists: recommendation.availableSpecialists.slice(0, 3),
      primarySpecialist: recommendation.primarySpecialist,
    }));
    if (recommendation.templateBundle !== "custom") {
      applyBundle(recommendation.templateBundle);
    }
  }

  function toggleSpecialist(s: SpecialistId) {
    setForm((f) => {
      const has = f.specialists.includes(s);
      if (has) {
        const next = f.specialists.filter((x) => x !== s);
        return {
          ...f,
          specialists: next,
          primarySpecialist:
            f.primarySpecialist === s ? next[0] : f.primarySpecialist,
        };
      }
      if (f.specialists.length >= 3) return f; // free-tier cap
      return { ...f, specialists: [...f.specialists, s] };
    });
  }

  function updateTabVisibility(slug: string, vis: CartridgeTabVisibility) {
    setForm((f) => ({
      ...f,
      tabs: f.tabs.map((t) => (t.slug === slug ? { ...t, visibility: vis } : t)),
    }));
  }

  // Step validation gates.
  const step0Valid =
    form.title.trim().length > 0 &&
    form.slug.length > 1 &&
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(form.slug) &&
    form.description.trim().length > 0;
  const step1Valid = form.purpose.trim().length > 0;
  const step2Valid = form.tabs.length > 0;
  const step3Valid =
    form.tabs.some((t) => t.slug === form.primaryTabSlug);
  const step4Valid =
    form.tabs.some((t) => t.slug === form.activeTabSlug) &&
    form.specialists.length > 0 &&
    form.specialists.length <= 3;
  const canAdvance =
    step === 0 ? step0Valid :
    step === 1 ? step1Valid :
    step === 2 ? step2Valid :
    step === 3 ? step3Valid :
    step4Valid;
  const isLast = step === STEP_TITLES.length - 1;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await personaFetch("/api/assistant/cartridge-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug,
          description: form.description.trim(),
          category: form.category,
          purpose: form.purpose.trim(),
          audience: {
            kind: form.audienceKind,
            estimatedSize: form.audienceSize,
            languages: ["en"],
          },
          visibility: form.visibility,
          templateBundle: form.templateBundle,
          tabs: form.tabs,
          primaryTabSlug: form.primaryTabSlug,
          smartTriad: {
            copilot: {
              source: form.copilotSource,
              promptContext: form.purpose.trim().slice(0, 4000),
            },
            knowledgeBase: {
              ingestSources: form.knowledgeSources,
              embeddingScope: "domain",
            },
            codex: { enabled: true },
            wallet: {
              enabled: form.walletEnabled,
              tokenWhitelist: form.walletEnabled ? form.tokenWhitelist : [],
              primitives: form.walletEnabled
                ? form.walletPrimitives
                : {
                    cryptoSend: false,
                    cryptoReceive: false,
                    paymentRequest: false,
                    rewardPayout: false,
                  },
            },
          },
          specialists: {
            available: form.specialists,
            primary: form.primarySpecialist,
          },
          activeTabSlug: form.activeTabSlug,
          activeTabMetrics: form.activeTabMetrics,
          activeTabActions: form.activeTabActions,
          catalogueOptIn: form.catalogueOptIn,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        cartridge?: CartridgeSavedResult;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !body.ok || !body.cartridge) {
        throw new Error(body.detail || body.error || `save failed (${res.status})`);
      }
      onSaved(body.cartridge);
      onOpenChange(false);
      setStep(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create your cartridge</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEP_TITLES.length} · {STEP_TITLES[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          {STEP_TITLES.map((title, i) => (
            <div
              key={title}
              className={`flex-1 h-1 rounded ${
                i <= step ? "bg-violet-500" : "bg-slate-700/50"
              }`}
            />
          ))}
        </div>

        <div className="space-y-4 py-2 min-h-[320px]">
          {step === 0 && (
            <>
              <Field label="Cartridge name" required>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="KNYT Wheel · Qriptopian · Founders Circle"
                  className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500"
                  maxLength={140}
                />
              </Field>
              <Field label="URL slug" required>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    update("slug", slugify(e.target.value));
                  }}
                  placeholder="knyt-wheel"
                  className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm font-mono focus:outline-none focus:border-violet-500"
                  maxLength={64}
                />
                <p className="text-xs text-slate-500 mt-1">
                  URL-safe lowercase + dashes. Auto-derived from name until you edit it.
                </p>
              </Field>
              <Field label="Short description" required>
                <textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="One paragraph — what this cartridge is for."
                  className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500 min-h-[80px]"
                  maxLength={2000}
                />
              </Field>
              <Field label="Category">
                <RadioGroup
                  value={form.category}
                  options={CATEGORIES}
                  onChange={(v) => update("category", v)}
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              {(recommendation || recommending) && (
                <div className="px-3 py-2 rounded-md bg-violet-500/10 border border-violet-500/30 text-sm text-violet-200">
                  {recommending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> aigentMe analysing…
                    </span>
                  ) : recommendation ? (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong className="text-violet-100">Recommended:</strong>{" "}
                        {recommendation.templateBundle} bundle ·{" "}
                        {recommendation.availableSpecialists.length} specialists
                        <p className="text-xs text-violet-300/80 mt-0.5">
                          {recommendation.rationale}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={acceptRecommendation}
                        className="text-xs px-2 py-1 rounded bg-violet-500/30 hover:bg-violet-500/40 whitespace-nowrap"
                      >
                        Use this
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              <Field label="Purpose — what is this cartridge for?" required>
                <textarea
                  value={form.purpose}
                  onChange={(e) => update("purpose", e.target.value)}
                  placeholder="Feeds the copilot system prompt and the cartridge intent."
                  className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500 min-h-[120px]"
                  maxLength={4000}
                />
              </Field>
              <Field label="Audience kind">
                <RadioGroup
                  value={form.audienceKind}
                  options={AUDIENCE_KINDS}
                  onChange={(v) => update("audienceKind", v)}
                />
              </Field>
              <Field label="Estimated size">
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_SIZES.map((s) => {
                    const selected = form.audienceSize === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => update("audienceSize", s.value)}
                        className={`px-3 py-1.5 rounded-full border text-sm ${
                          selected
                            ? "bg-violet-500/20 border-violet-500 text-violet-200"
                            : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Visibility">
                <RadioGroup
                  value={form.visibility}
                  options={VISIBILITIES}
                  onChange={(v) => update("visibility", v)}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Template bundle">
                <RadioGroup
                  value={form.templateBundle}
                  options={TEMPLATE_BUNDLES.map((b) => ({
                    value: b.value,
                    label: b.label,
                    hint: b.hint,
                  }))}
                  onChange={(v) => applyBundle(v)}
                />
              </Field>
              <Field label="Picked tabs">
                <ul className="space-y-1.5">
                  {form.tabs.map((t) => (
                    <li
                      key={t.slug}
                      className="flex items-center gap-2 px-3 py-2 rounded bg-slate-800/40 border border-slate-700/60 text-sm"
                    >
                      <span className="font-mono text-xs text-slate-400 w-32 truncate">
                        {t.templateId}
                      </span>
                      <span className="font-medium flex-1">{t.label}</span>
                      <span className="text-xs text-slate-500">/{t.slug}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500 mt-2">
                  Inline reorder + add/remove lands in the cartridge manager (Phase 7).
                </p>
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Per-tab visibility">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="pb-1">Tab</th>
                      <th className="pb-1">Visibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.tabs.map((t) => (
                      <tr key={t.slug} className="border-t border-slate-700/40">
                        <td className="py-2 pr-2">{t.label}</td>
                        <td className="py-2">
                          <select
                            value={t.visibility}
                            onChange={(e) =>
                              updateTabVisibility(
                                t.slug,
                                e.target.value as CartridgeTabVisibility,
                              )
                            }
                            className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700 text-xs"
                          >
                            {ALL_TAB_VISIBILITIES.map((v) => (
                              <option key={v.value} value={v.value}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 mt-2">
                  Token-gated UI is typed for MVP; wallet wiring lands in Phase 9.
                </p>
              </Field>
              <Field label="Primary tab" required>
                <select
                  value={form.primaryTabSlug}
                  onChange={(e) => update("primaryTabSlug", e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm"
                >
                  {form.tabs.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.label} (/{t.slug})
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <Field label="Copilot source">
                <RadioGroup
                  value={form.copilotSource}
                  options={[
                    { value: "aigentMe", label: "aigentMe (default)", hint: "Your aigentMe persona acts as the cartridge copilot." },
                    { value: "specialist", label: "Specialist", hint: "Pin a specialist as the cartridge copilot." },
                    { value: "cartridge-copilot", label: "Cartridge copilot (v0.5)", hint: "Disabled in MVP — typed only." },
                  ]}
                  onChange={(v) => v !== "cartridge-copilot" && update("copilotSource", v)}
                />
              </Field>
              <Field label="Specialists (≤3, free-tier)">
                <div className="flex flex-wrap gap-2">
                  {SPECIALISTS.map((s) => {
                    const selected = form.specialists.includes(s.value);
                    const atCap = !selected && form.specialists.length >= 3;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        disabled={atCap}
                        onClick={() => toggleSpecialist(s.value)}
                        className={`px-3 py-1.5 rounded-full border text-sm transition ${
                          selected
                            ? "bg-violet-500/20 border-violet-500 text-violet-200"
                            : atCap
                              ? "bg-slate-800/40 border-slate-700/40 text-slate-500 cursor-not-allowed"
                              : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {selected && <Check className="inline w-3 h-3 mr-1" />}
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Free-tier caps at 3 specialists. A 4th+ is payment-gated (v0.5).
                </p>
              </Field>
              <Field label="Wallet">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.walletEnabled}
                    onChange={(e) => update("walletEnabled", e.target.checked)}
                  />
                  Enable wallet primitives (send / receive / request / reward)
                </label>
                {form.walletEnabled && (
                  <p className="text-xs text-slate-500 mt-1">
                    Token whitelist defaults to Q¢ + USDC. Per-primitive enabling lands in the cartridge manager (Phase 7).
                  </p>
                )}
              </Field>
              <Field label="Active tab" required>
                <select
                  value={form.activeTabSlug}
                  onChange={(e) => update("activeTabSlug", e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm"
                >
                  {form.tabs.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.label} (/{t.slug})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Activation Catalogue">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.catalogueOptIn}
                    disabled={form.visibility !== "public"}
                    onChange={(e) => update("catalogueOptIn", e.target.checked)}
                  />
                  Submit my active tab to the metaMe Activation Catalogue for review
                </label>
                {form.visibility !== "public" && (
                  <p className="text-xs text-slate-500 mt-1">
                    Only public cartridges can opt into the Catalogue.
                  </p>
                )}
              </Field>
            </>
          )}
        </div>

        {error && (
          <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
            {error}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          <button
            type="button"
            disabled={step === 0 || saving}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex items-center gap-1 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          {!isLast ? (
            <button
              type="button"
              disabled={!canAdvance || saving}
              onClick={() => setStep((s) => Math.min(STEP_TITLES.length - 1, s + 1))}
              className="flex items-center gap-1 px-4 py-2 rounded-md text-sm bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdvance || saving}
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create cartridge
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Local helpers ────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200 block mb-1.5">
        {label}
        {required && <span className="text-violet-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function RadioGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`w-full text-left px-3 py-2 rounded-md border transition ${
              selected
                ? "bg-violet-500/15 border-violet-500/60"
                : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full border ${
                  selected ? "bg-violet-400 border-violet-400" : "border-slate-500"
                }`}
              />
              <span className="text-sm font-medium text-slate-100">{opt.label}</span>
            </div>
            {opt.hint && (
              <p className="text-xs text-slate-400 mt-1 pl-5">{opt.hint}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
