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

export type SectionId =
  | "experience"
  | "specialists"
  | "cartridges"
  | "google"
  | "context"
  | "receipts";

export type CardKind = "brief" | "nbe" | "approval" | "artifact";

interface BridgeInputs {
  /** Open / close compose modals (parent owns booleans). */
  openCompose: (kind: ComposeKind) => void;
  /** Fire a primary CTA (brief-me, move-this-forward, ...). */
  fireCta: (ctaId: string) => void;
  /** Expand a config section in the right-pane accordion. */
  expandSection: (sectionId: SectionId) => void;
  /** Focus / scroll-into-view a live card kind on the right pane. */
  focusCard: (cardKind: CardKind) => void;

  // Readable snapshot — T1 only.
  readable: {
    activeBrief: { hasBrief: boolean; summary: string | null };
    pendingApproval: { has: boolean; cartridge: string | null };
    experienceModelStatus: { configured: boolean; stage: string | null };
    activeCartridges: string[];
    latestArtifact: { kind: string | null; title: string | null; status: string | null };
    nextBestActionsCount: number;
    expandedSectionId: SectionId | null;
    receiptsCount: number;
  };
}

export function useAigentMeCopilotBridge({
  openCompose,
  fireCta,
  expandSection,
  focusCard,
  readable,
}: BridgeInputs) {
  // ── Readables ──────────────────────────────────────────────────────
  useCopilotReadable({
    description: "Active brief on the aigentMe welcome surface (null when no brief has been requested).",
    value: readable.activeBrief,
  });
  useCopilotReadable({
    description: "Pending approval card state — whether the user has a queued NBE awaiting their go-ahead.",
    value: readable.pendingApproval,
  });
  useCopilotReadable({
    description: "ExperienceModel configuration status (whether the user has set up their venture-building model and current stage).",
    value: readable.experienceModelStatus,
  });
  useCopilotReadable({
    description: "Active cartridge slugs the user currently has installed (KNYT, Marketa, Qriptopian, etc.).",
    value: readable.activeCartridges,
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
}
