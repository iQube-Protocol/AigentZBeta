"use client";

/**
 * useAigentMeCopilotBridge — AG-UI bridge for the aigentMe split tab.
 *
 * Registers CopilotKit actions + readables so the copilot on the left
 * side of the split surface can drive the right side: open a compose
 * modal, fire a primary CTA, expand a section, focus a live card.
 *
 * The hook only registers — it does not render. The owning tab passes
 * imperative setters + a snapshot of current right-pane state.
 *
 * Spine contract: every readable strips T0 identifiers (no personaId,
 * authProfileId, rootDid). Only T1-safe fields are exposed.
 */

import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import type { ComposeKind } from "@/components/metame/copilot/ComposeQuickActionsStrip";
import type { KpiRecord, KpiSource } from "@/services/strategy/kpiTypes";

export type SectionId =
  | "experience"
  | "specialists"
  | "cartridges"
  | "google"
  | "context"
  | "receipts";

export type CardKind = "brief" | "nbe" | "approval" | "artifact";

/** Source picker option exposed to the copilot — describes what
 *  metrics the persona can bind a KPI to right now (active activations
 *  only). Inactive activations are omitted; the copilot is told to
 *  suggest activating them when relevant rather than offering them as
 *  choices that would fail to resolve. */
export interface CopilotKpiSourceOption {
  activationId: string;
  activationLabel: string;
  metric: string;
  metricLabel: string;
  metricClass: 'activity' | 'outcome' | 'standing';
  defaultUnit?: string;
}

/** T1-safe KPI snapshot for the copilot readable. */
export interface CopilotKpiSnapshot {
  id: string;
  name: string;
  target: string;
  current: number | null;
  unit?: string;
  trend: 'up' | 'down' | 'flat' | 'unknown';
  class?: 'activity' | 'outcome' | 'standing';
  sourceKind: 'manual' | 'activation' | 'receipts';
  sourceLabel: string;
  unresolvedReason: string | null;
}

interface BridgeInputs {
  /** Open / close compose modals (parent owns booleans). */
  openCompose: (kind: ComposeKind) => void;
  /** Fire a primary CTA (brief-me, move-this-forward, ...). */
  fireCta: (ctaId: string) => void;
  /** Expand a config section in the right-pane accordion. */
  expandSection: (sectionId: SectionId) => void;
  /** Focus / scroll-into-view a live card kind on the right pane. */
  focusCard: (cardKind: CardKind) => void;

  // Phase 2 B.1 — KPI mutation handlers.
  /** Add a new KPI (activation-bound OR manual). Resolves after save. */
  addKpi: (input: {
    name: string;
    target: string;
    source: KpiSource;
    unit?: string;
  }) => Promise<{ ok: true; id: string } | { ok: false; reason: string }>;
  /** Update an existing manual KPI's current value. */
  setKpiValue: (input: {
    kpiId: string;
    current: number;
  }) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Remove a KPI. */
  removeKpi: (kpiId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Open the KpiDetailLayout for a specific KPI. */
  openKpiDetail: (kpiId: string) => void;

  // Readable snapshot — T1 only.
  readable: {
    /**
     * Active brief shape — when present, includes the structured
     * data the brief render uses (top priorities + computed NBAs)
     * so the copilot's narrative can ground in the actual rows
     * shown on the right pane instead of generating from scratch
     * via RAG (which used to drift into KNYT lore for venture-
     * focused operators).
     */
    activeBrief: {
      hasBrief: boolean;
      briefType: string | null;
      primaryGoal: string | null;
      experienceName: string | null;
      currentStage: string | null;
      topPriorities: Array<{ id: string; label: string; cartridge: string }>;
      /** Compact NBA list — id + label + rationale + cartridge so the
       *  LLM can name them by label in its narrative. */
      nextBestActions: Array<{
        id: string;
        label: string;
        rationale: string;
        cartridge: string;
        effort: string;
        impact: string;
        approvalRequired: boolean;
        suggestedArtifact: string | null;
      }>;
    };
    pendingApproval: { has: boolean; cartridge: string | null };
    experienceModelStatus: { configured: boolean; stage: string | null; primaryGoal: string | null };
    activeCartridges: string[];
    /**
     * 2026-05-26 chief-of-staff extension: surfaces the persona's
     * cartridge admin grants so the copilot biases recommendations
     * toward chief-of-staff moves on admin-scoped surfaces. Empty
     * array + isGlobalAdmin: false ⇒ ground-level operator framing.
     */
    cartridgeAdminGrants: {
      isGlobalAdmin: boolean;
      adminCartridges: string[];
    };
    latestArtifact: { kind: string | null; title: string | null; status: string | null };
    nextBestActionsCount: number;
    expandedSectionId: SectionId | null;
    receiptsCount: number;
    /** KPIs currently declared (T1 snapshot). */
    activeKpis: CopilotKpiSnapshot[];
    /** Metric sources the persona can bind a NEW KPI to — derived from
     *  active activations + the catalog. Empty when no relevant
     *  activations are on. */
    availableKpiSources: CopilotKpiSourceOption[];
  };
}

export function useAigentMeCopilotBridge({
  openCompose,
  fireCta,
  expandSection,
  focusCard,
  addKpi,
  setKpiValue,
  removeKpi,
  openKpiDetail,
  readable,
}: BridgeInputs) {
  // ── Readables ──────────────────────────────────────────────────────
  useCopilotReadable({
    description:
      "Active brief shape on the aigentMe welcome surface. When hasBrief is true, ground your narrative in the exact topPriorities + nextBestActions rows the right pane is rendering — name them by label, reference their rationale, and prescribe specific next moves rooted in this list. Do NOT invent unrelated suggestions. Use primaryGoal + currentStage as the framing axis.",
    value: readable.activeBrief,
  });
  useCopilotReadable({
    description: "Pending approval card state — whether the user has a queued NBE awaiting their go-ahead.",
    value: readable.pendingApproval,
  });
  useCopilotReadable({
    description: "ExperienceModel configuration status (whether the user has set up their venture-building model, current stage, and primary goal).",
    value: readable.experienceModelStatus,
  });
  useCopilotReadable({
    description:
      "Active cartridge slugs the user currently has installed. Bias every recommendation toward these surfaces — never propose work on cartridges that are NOT in this list. When the list is short (e.g. just 'metame'), focus on setup / ExperienceModel completion moves first.",
    value: readable.activeCartridges,
  });
  useCopilotReadable({
    description:
      "Cartridge admin grants for this persona. When isGlobalAdmin is true OR adminCartridges contains the slug for an active surface, prefer chief-of-staff moves (review queues, partner ops, content-pipeline state) over ground-level operator moves. Cite the specific cartridge by name when admin-tier work is relevant.",
    value: readable.cartridgeAdminGrants,
  });
  useCopilotReadable({
    description: "Latest artifact created on this surface (Gmail draft, calendar event, doc, sheet, slides, Marketa email).",
    value: readable.latestArtifact,
  });
  useCopilotReadable({
    description: "Number of next-best-action cards currently displayed.",
    value: readable.nextBestActionsCount,
  });
  useCopilotReadable({
    description: "Which right-pane config section is currently expanded (only one at a time).",
    value: readable.expandedSectionId,
  });
  useCopilotReadable({
    description: "Count of activity receipts currently loaded into the right-pane receipts section.",
    value: readable.receiptsCount,
  });
  useCopilotReadable({
    description:
      "KPIs this persona currently tracks in their Venture Cockpit. Each row has T1-safe fields: id, name, target description, current value (null = unresolved), unit, trend, class (activity/outcome/standing), and source provenance.",
    value: readable.activeKpis,
  });
  useCopilotReadable({
    description:
      "Metric sources the persona can bind a NEW KPI to right now — derived from their ACTIVE activations plus the catalog. Each option carries activationId, activationLabel, metric (key), metricLabel, metricClass, and defaultUnit. When the user wants to add a KPI sourced from a cartridge they haven't activated yet, the copilot should suggest activating that surface in the Activations tab.",
    value: readable.availableKpiSources,
  });

  // ── Actions ────────────────────────────────────────────────────────
  useCopilotAction({
    name: "aigentme_open_compose",
    description:
      "Open a compose modal on the aigentMe welcome surface. Use this when the user asks to draft an email, schedule an event, create a Google Doc / Sheet / Slides, or send a Marketa email.",
    parameters: [
      {
        name: "kind",
        type: "string",
        description: "Which compose modal to open. Allowed: gmail | event | doc | sheet | slides | marketa.",
        required: true,
      },
    ],
    handler: ({ kind }: { kind: string }) => {
      const k = String(kind).toLowerCase();
      const allowed = ["gmail", "event", "doc", "sheet", "slides", "marketa"];
      if (!allowed.includes(k)) {
        return { ok: false, reason: `Unknown compose kind '${kind}'. Allowed: ${allowed.join(", ")}.` };
      }
      openCompose(k as ComposeKind);
      return { ok: true, opened: k };
    },
  });

  useCopilotAction({
    name: "aigentme_fire_cta",
    description:
      "Fire a primary CTA on the aigentMe welcome surface. Use this when the user asks for a daily brief, wants to move things forward, set up their experience model, or review venture progress.",
    parameters: [
      {
        name: "ctaId",
        type: "string",
        description:
          "Which CTA to fire. Allowed: brief-me | move-this-forward | set-up-experience-model | review-venture-progress.",
        required: true,
      },
    ],
    handler: ({ ctaId }: { ctaId: string }) => {
      const id = String(ctaId).toLowerCase();
      const allowed = ["brief-me", "move-this-forward", "set-up-experience-model", "review-venture-progress"];
      if (!allowed.includes(id)) {
        return { ok: false, reason: `Unknown ctaId '${ctaId}'. Allowed: ${allowed.join(", ")}.` };
      }
      fireCta(id);
      return { ok: true, fired: id };
    },
  });

  useCopilotAction({
    name: "aigentme_expand_section",
    description:
      "Expand a configuration section in the right-pane accordion (only one is open at a time). Use this when the user wants to see Specialists, the Experience Model, Cartridges, Google Workspace, Active context, or Activity receipts.",
    parameters: [
      {
        name: "sectionId",
        type: "string",
        description: "Section to expand. Allowed: experience | specialists | cartridges | google | context | receipts.",
        required: true,
      },
    ],
    handler: ({ sectionId }: { sectionId: string }) => {
      const id = String(sectionId).toLowerCase();
      const allowed: SectionId[] = ["experience", "specialists", "cartridges", "google", "context", "receipts"];
      if (!allowed.includes(id as SectionId)) {
        return { ok: false, reason: `Unknown sectionId '${sectionId}'. Allowed: ${allowed.join(", ")}.` };
      }
      expandSection(id as SectionId);
      return { ok: true, expanded: id };
    },
  });

  useCopilotAction({
    name: "aigentme_focus_card",
    description:
      "Scroll a live card into view on the right pane. Use this when the user wants to see their brief, next best actions, pending approval, or latest artifact.",
    parameters: [
      {
        name: "cardKind",
        type: "string",
        description: "Card kind to focus. Allowed: brief | nbe | approval | artifact.",
        required: true,
      },
    ],
    handler: ({ cardKind }: { cardKind: string }) => {
      const k = String(cardKind).toLowerCase();
      const allowed: CardKind[] = ["brief", "nbe", "approval", "artifact"];
      if (!allowed.includes(k as CardKind)) {
        return { ok: false, reason: `Unknown cardKind '${cardKind}'. Allowed: ${allowed.join(", ")}.` };
      }
      focusCard(k as CardKind);
      return { ok: true, focused: k };
    },
  });

  // ── KPI actions (Phase 2 B.1 3/3) ──────────────────────────────────
  // The copilot can read `availableKpiSources` + `activeKpis` and act
  // on them through the three handlers below. All writes go through
  // the same /api/assistant/experience-model path the editor uses, so
  // the cockpit picks up changes on the next venture-progress refresh
  // (the tab fires it automatically after each save).

  useCopilotAction({
    name: "aigentme_add_kpi",
    description:
      "Add a new KPI to the persona's Venture Cockpit. Prefer activation-bound sources (the value resolves automatically from the persona's active cartridges) over manual sources. Before calling, check `availableKpiSources` to see what the persona can bind to right now — if the user asks for a source whose activation is not yet on, suggest they activate it in the Activations tab rather than calling this with an inactive source. Use Manual ONLY when the user explicitly wants to track a number themselves.",
    parameters: [
      { name: "name", type: "string", description: "Display name for the KPI (e.g. 'Partner replies').", required: true },
      { name: "target", type: "string", description: "Free-form target description (e.g. '20 replies / week by EOQ').", required: false },
      { name: "sourceKind", type: "string", description: "Allowed: 'manual' | 'activation'. Default 'activation' when activationId is supplied.", required: false },
      { name: "activationId", type: "string", description: "Required when sourceKind='activation'. Pick from availableKpiSources.", required: false },
      { name: "metric", type: "string", description: "Required when sourceKind='activation'. Pick from availableKpiSources for the chosen activationId.", required: false },
      { name: "unit", type: "string", description: "Optional unit override (e.g. 'replies/wk'). Defaults to the metric's catalog unit.", required: false },
    ],
    handler: async (input: {
      name: string;
      target?: string;
      sourceKind?: string;
      activationId?: string;
      metric?: string;
      unit?: string;
    }) => {
      const name = String(input.name ?? "").trim();
      if (!name) return { ok: false, reason: "name is required" };
      const target = String(input.target ?? "").trim();
      const sourceKind = (input.sourceKind ?? (input.activationId ? "activation" : "manual")).toLowerCase();

      let source: KpiSource;
      if (sourceKind === "activation") {
        const activationId = String(input.activationId ?? "").trim();
        const metric = String(input.metric ?? "").trim();
        if (!activationId || !metric) {
          return { ok: false, reason: "activation-bound sourceKind requires activationId AND metric — check availableKpiSources for valid combinations." };
        }
        // Refuse to add a KPI bound to a source the persona doesn't
        // currently have active. The copilot should suggest activating
        // it first instead.
        const isAvailable = readable.availableKpiSources.some(
          (s) => s.activationId === activationId && s.metric === metric,
        );
        if (!isAvailable) {
          return {
            ok: false,
            reason: `Source ${activationId}:${metric} isn't in availableKpiSources. Either the activation isn't active or the metric doesn't exist. Suggest the user activate that surface in the Activations tab first.`,
          };
        }
        source = { kind: "activation", activationId, metric };
      } else if (sourceKind === "manual") {
        source = { kind: "manual" };
      } else {
        return { ok: false, reason: `Unknown sourceKind '${input.sourceKind}'. Allowed: 'manual' | 'activation'.` };
      }

      const result = await addKpi({ name, target, source, unit: input.unit });
      return result;
    },
  });

  useCopilotAction({
    name: "aigentme_set_kpi_value",
    description:
      "Update the current value of a MANUAL KPI. Use this when the user wants to record a number they're tracking themselves (e.g. 'I had 3 partner meetings this week — log it'). For activation-bound KPIs the value resolves from receipts automatically; never use this on those.",
    parameters: [
      { name: "kpiId", type: "string", description: "The KPI id (from activeKpis readable).", required: true },
      { name: "current", type: "number", description: "New current value.", required: true },
    ],
    handler: async ({ kpiId, current }: { kpiId: string; current: number }) => {
      if (!kpiId) return { ok: false, reason: "kpiId is required" };
      if (typeof current !== "number" || !Number.isFinite(current)) {
        return { ok: false, reason: "current must be a finite number" };
      }
      // Refuse to overwrite activation-bound KPIs — the resolver owns
      // their value. Surface a clear reason so the copilot tells the
      // user the metric is tracked automatically.
      const kpi = readable.activeKpis.find((k) => k.id === kpiId);
      if (kpi && kpi.sourceKind !== "manual") {
        return {
          ok: false,
          reason: `KPI '${kpi.name}' is sourced from ${kpi.sourceLabel} — its value resolves automatically. To override, change the source to Manual via the KPI editor first.`,
        };
      }
      return setKpiValue({ kpiId, current });
    },
  });

  useCopilotAction({
    name: "aigentme_remove_kpi",
    description:
      "Remove a KPI from the persona's Venture Cockpit. Use only when the user explicitly asks to stop tracking it.",
    parameters: [
      { name: "kpiId", type: "string", description: "The KPI id (from activeKpis readable).", required: true },
    ],
    handler: async ({ kpiId }: { kpiId: string }) => {
      if (!kpiId) return { ok: false, reason: "kpiId is required" };
      return removeKpi(kpiId);
    },
  });

  useCopilotAction({
    name: "aigentme_open_kpi_detail",
    description:
      "Open the detail layout for a specific KPI in the right pane. Use this when the user wants to inspect a KPI in depth, see its source, update its manual value, or check its trend.",
    parameters: [
      { name: "kpiId", type: "string", description: "The KPI id (from activeKpis readable).", required: true },
    ],
    handler: ({ kpiId }: { kpiId: string }) => {
      if (!kpiId) return { ok: false, reason: "kpiId is required" };
      openKpiDetail(kpiId);
      return { ok: true, opened: kpiId };
    },
  });
}
