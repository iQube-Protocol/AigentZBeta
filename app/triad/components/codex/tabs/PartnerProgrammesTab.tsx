"use client";

/**
 * PartnerProgrammesTab — the Workspace surface, mounted by BOTH Labs.
 *
 * ONE IMPLEMENTATION, N ENTRANCES (inv.engineering.036). The Venture Lab's
 * Partner group mounts it on the venture domain (Partner Workspace, Horizen
 * Pilot Series 001); the IRL cartridge's Workspace group mounts the SAME
 * component on the research domain (Research Workspace). A second component
 * for the research half would be the parallel-implementation defect
 * inv.engineering.037 names — the two Labs are "parallel experimental
 * environments operating on a common constitutional and collaborative
 * substrate" (Horizen audit Amendment B §B.6), and this surface is that
 * substrate's UI.
 *
 * COMPOSITION, NOT APPLICATION: this tab orchestrates existing Lab
 * capabilities around a workspace instance. Every workspace fact renders from
 * its registry — `services/venture/partnerWorkspace.ts` (venture) or
 * `services/research/researchWorkspace.ts` (research), the two single
 * authoritative lists the `experimentWorkspace` spine projects from; every
 * capability either MOUNTS an existing component (Collaborate: invitations /
 * peer exchange / locker) or DEEP-LINKS to the capability's existing home via
 * buildCodexUrl (never a bespoke URL).
 *
 * WHY THE REGISTRIES AND NOT THE SPINE. `services/experiments/
 * experimentWorkspace.ts` is the canonical projection, but it reaches
 * Supabase, the ontology resolver and the invariant store — server-only
 * modules that cannot enter a client bundle. This component therefore reads
 * the SAME authoritative registries the spine projects from, and pulls its
 * label/objectives through the registry's own derivation helpers so the two
 * projections cannot disagree. `tests/research-lab-workspace.test.ts` asserts
 * that parity rather than trusting it.
 *
 * Command Center honesty rule: a metric renders a real derivation from an
 * existing API or an explicit "Not yet wired" state — never a fabricated
 * number, never a hardcoded health glyph. The one live derivation today is
 * Open Actions = open constitutional agreements (proposed/accepted, not yet
 * authorized) from GET /api/constitutional/agreement — the pilot's actual
 * operational substrate (CRP-003a).
 *
 * Spine discipline: the agreement route resolves the caller via the spine, so
 * the call goes through personaFetch (raw fetch would 401 — CLAUDE.md
 * PARAMOUNT). Slate house style throughout — no white hairlines.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FlaskConical, GraduationCap, Pencil, Target, Users, X } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { buildCodexUrl } from "@/utils/codex-nav";
import {
  listPartnerWorkspaces,
  layerOwnerDisplayName,
  PARTNER_WORKSPACE_LAYERS,
  type PartnerLayerOwnerId,
  type PartnerWorkspaceLayer,
  type PartnerWorkspace,
  type PartnerWorkspaceLink,
} from "@/services/venture/partnerWorkspace";
import {
  listResearchWorkspaces,
  researchWorkspaceExperiments,
  researchWorkspaceLabel,
  researchWorkspaceObjectives,
  researchWorkspaceOwner,
  researchWorkspaceLayerOwners,
  researchWorkspaceLinks,
  researchWorkspaceInstitutions,
  researchWorkspaceNavSection,
  researchWorkspaceNavDepth,
  researchWorkspaceTitleEditable,
  RESEARCH_WORKSPACE_LAYERS,
  RESEARCH_NAV_SECTIONS,
  type ResearchWorkspaceNavSection,
} from "@/services/research/researchWorkspace";
import {
  getLifecycleTemplate,
  lifecycleStageIndex,
  type LifecycleTemplate,
  type WorkspaceType,
} from "@/services/experiments/workspaceLifecycle";
import {
  RESEARCH_WORKSPACE_VIEWS,
  RESEARCH_WORKSPACE_ADMIN_VIEW,
} from "@/services/research/researchWorkspaceViews";
import { MATERIAL_CLASSES, workspaceSurfaceAuthority } from "@/services/research/workspaceMaterials";
// TYPE-ONLY (erased at compile time — nothing server-side enters the bundle).
// The view shape has ONE definition, on the server that derives it; a hand-
// copied interface here would be the stale-duplicate defect inv.engineering.037
// names, and it would drift the moment a link or status word changed.
import type { EvidenceChainView, ChainLinkState } from "@/services/horizen/evidenceChain";
import { StewardParticipationTab } from "./StewardParticipationTab";
import dynamic from "next/dynamic";
import { LockerTab } from "./LockerTab";
import { PilotJourneyTab } from "./PilotJourneyTab";
import { PassportBureauStewardTab } from "./PassportBureauStewardTab";
import { useParticipationAccess } from "@/app/hooks/useParticipationAccess";
import { scopesGrantedIn } from "@/services/passport/participationTabGate";

// Peer exchange is client-only (clipboard/personaFetch) — same lazy pattern
// as LockerTab's own mount of it.
const QubeTalkInboxTab = dynamic(() => import("@/components/composer/QubeTalkInboxTab"), {
  ssr: false,
  loading: () => <span className="text-[10px] text-slate-400">Loading…</span>,
});

const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm";

const PHASE_LABELS: Record<PartnerWorkspace["phase"], string> = {
  exploration: "Exploration",
  agreement: "Agreement",
  integration: "Integration",
  operation: "Operation",
  evidence: "Evidence",
};

const LAYER_LABELS: Record<(typeof PARTNER_WORKSPACE_LAYERS)[number], string> = {
  operations: "Operations",
  relationship: "Relationship",
  "financial-services": "Financial Services",
  knowledge: "Knowledge",
  "customer-experience": "Customer Experience",
  governance: "Governance",
};

// "administration" is the TIER 0 surface (Horizen Phase 3, audit §B.3) — the
// internal programme space. It is reachable only from an adminOnly tab; the
// server enforces the same boundary independently (the route returns `tier0`
// to admins only), so a client mistake cannot leak it.
//
// The list is the UNION of both Labs' surfaces; WHICH of them an entrance
// offers is decided per Lab by `KIND_SURFACES` below. A union rather than two
// disjoint types because `initialSurface` is a string prop from the tab config
// and has to narrow against one vocabulary.
const SUB_SURFACES = [
  "overview",
  "collaborate",
  // PRD-GJR-001 (Guided Journey Runtime, 2026-07-31, operator-directed) — the
  // Pilot > Journey view. A reusable platform capability (journey bar +
  // surface orchestration + authoritative state + receipts), composed here
  // so the tab's config.component stays PartnerProgrammesTab ("ONE
  // component, N entrances" — tests/partner-workspace.test.ts canary R7 /
  // tests/research-lab-workspace.test.ts). Its actual rendering lives in
  // PilotJourneyTab.tsx / services/journey/.
  "journey",
  "operate",
  "evidence",
  "communicate",
  "administration",
  // The Research Lab's added views (SPEC-IRL-WORKSPACE-001 §7). `locker` and
  // `qubetalk` are PROMOTIONS of two views that already existed inside
  // Collaborate, not new capabilities — the spec makes them first-class
  // surfaces because the boundary between the mutable workspace and the
  // authoritative record has to be visible in the navigation to be real.
  "pipeline",
  "review",
  "working-materials",
  "locker",
  "qubetalk",
  "participants",
  // Steward review queue, MIRRORED from the Polity Passport Bureau (operator,
  // 2026-08-03) so passport applications raised by the Journey can be decided
  // without leaving the cartridge. Admin-gated — see STEWARD_SURFACE below.
  "steward",
] as const;
type SubSurface = (typeof SUB_SURFACES)[number];

/**
 * PUBLIC vs PRIVATE POSTURE (operator ruling, 2026-07-28).
 *
 * The Venture Lab's workspace split into two entrances: the PRIVATE one (the
 * Partner group — the partner↔metaProof bilateral record and the internal
 * programme space) and the PUBLIC one (the Participate group's "Public
 * Workspace" — the cross-partner surface a qualifying cohort sees).
 *
 * `PUBLIC_SURFACES` is the allowlist for the public posture. It is a CLAMP,
 * not the primary gate: the primary gate is the tab config (only the public
 * entrance passes `workspaceVisibility: 'public'`, and it opens on Overview).
 * The clamp exists because that entrance is now reachable by any venture-lab
 * grant holder — one mis-set `initialSurface` in a future config edit would
 * otherwise open a private area to the whole cohort with nothing failing.
 * Defence in depth on the one change in this ruling that widens a gate.
 */
const PUBLIC_SURFACES: readonly SubSurface[] = ["overview"];

/**
 * ADMIN-ONLY SURFACES.
 *
 * `steward` mirrors the Polity Passport Bureau's Review Queue
 * (`passport-bureau-steward`, `adminOnly: true` in data/codex-configs.ts) into
 * the Venture Lab, so an operator deciding a Delegate Passport application
 * raised by the Journey does not have to leave the cartridge to do it.
 *
 * The SAME component is mounted — `PassportBureauStewardTab` — never a second
 * queue implementation. A mirrored surface that re-implemented the queue could
 * drift from the Bureau's own, and two review surfaces disagreeing about which
 * applications are open is precisely the class of defect this codebase spent
 * 2026-08-03 unpicking (inv.engineering.036/037).
 *
 * The mirror carries the ORIGINAL's gate. It is enforced in two places on
 * purpose: the nav strip (so the tab is not offered) and the render (so a deep
 * link or a restored `initialSurface` cannot reach it either). CLAUDE.md's
 * Security rule forbids weakening an access gate; mirroring a surface must not
 * become a way around one.
 */
const ADMIN_ONLY_SURFACES: readonly SubSurface[] = ["steward"];
type WorkspaceVisibility = "private" | "public";

function asVisibility(value: string | undefined): WorkspaceVisibility {
  return value === "public" ? "public" : "private";
}

/**
 * Is this surface offered here? TWO independent conditions, both required:
 *
 *  1. the Lab offers it at all (`KIND_SURFACES`) — a venture entrance can never
 *     reach a research view, and vice versa, whatever a config says;
 *  2. the visibility clamp — private offers everything the caller's TAB gate
 *     already allowed, public offers only `PUBLIC_SURFACES`.
 *
 * Kept as an AND of two checks rather than one merged list, because they answer
 * different questions and fail for different reasons; merging them would make a
 * mis-set posture and a mis-set domain indistinguishable in the fallback.
 */
function surfaceAllowed(
  surface: SubSurface,
  visibility: WorkspaceVisibility,
  kind: WorkspaceKind,
): boolean {
  if (!KIND_SURFACES[kind].includes(surface)) return false;
  return visibility === "private" || PUBLIC_SURFACES.includes(surface);
}
/**
 * WHICH surfaces each Lab offers, and in what order.
 *
 * The Venture Lab's list is unchanged, member for member and in order
 * (SPEC-IRL-WORKSPACE-001 acceptance criterion 3: "existing Venture Lab
 * workspaces remain unchanged") — the research views are simply not in it, so
 * no venture entrance can reach one.
 *
 * The Research Lab's list is DERIVED from `RESEARCH_WORKSPACE_VIEWS`, the same
 * registry `data/codex-configs.ts` builds the IRL tabs from, so the tier-3 menu
 * and this component cannot offer different sets.
 */
const KIND_SURFACES: Record<WorkspaceKind, readonly SubSurface[]> = {
  // "journey" added 2026-07-31, operator-directed (PRD-GJR-001) — the one
  // addition to this list since SPEC-IRL-WORKSPACE-001 froze the prior six
  // member-for-member. That acceptance criterion guarded against the
  // Research Lab's views bleeding into Venture's list during THAT migration;
  // it was never a permanent bar on a later, deliberate Venture Lab surface.
  // tests/lab-tab-restructure-and-locker-ux.test.ts's pinned list is updated
  // to match, with the same reasoning recorded there.
  venture: ["overview", "collaborate", "journey", "operate", "evidence", "communicate", "steward", "administration"],
  research: [
    ...(RESEARCH_WORKSPACE_VIEWS.map((v) => v.id) as SubSurface[]),
    RESEARCH_WORKSPACE_ADMIN_VIEW.id as SubSurface,
  ],
};

/**
 * Labels. `evidence` is the one surface the two Labs NAME differently — the
 * Venture Lab's "Evidence" is the Research Lab's "Activity" (SPEC §7) — so the
 * label is resolved per Lab while the id, the tab slug and every deep link stay
 * put. Everything else is shared, and the research entries are read from the
 * view registry rather than restated.
 */
const SUB_LABELS: Record<SubSurface, string> = {
  overview: "Overview",
  collaborate: "Collaborate",
  journey: "Journey",
  operate: "Operate",
  evidence: "Evidence",
  communicate: "Communicate",
  administration: "Administer",
  pipeline: "Pipeline",
  review: "Review",
  "working-materials": "Working Materials",
  locker: "Locker",
  qubetalk: "QubeTalk",
  participants: "Participants",
  steward: "Steward",
};

function surfaceLabel(surface: SubSurface, kind: WorkspaceKind): string {
  if (kind === "research") {
    const view = RESEARCH_WORKSPACE_VIEWS.find((v) => v.id === surface);
    if (view) return view.label;
  }
  return SUB_LABELS[surface];
}

const COLLAB_VIEWS = ["invitations", "peer-exchange", "locker"] as const;
type CollabView = (typeof COLLAB_VIEWS)[number];
const COLLAB_LABELS: Record<CollabView, string> = {
  invitations: "Invitations",
  "peer-exchange": "Peer Exchange",
  locker: "Locker",
};

interface AgreementRow {
  agreementId: string;
  displayLabel: string;
  status: string;
  capabilityRef: string | null;
  selectedAgentRef: string | null;
}

/** Live derivation state — 'unwired' renders the honest "Not yet wired". */
type AgreementsState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AgreementRow[] }
  | { kind: "unwired" };

interface PartnerProgrammesTabProps {
  personaId?: string;
  isAdmin?: boolean;
  /**
   * Which surface to open on — supplied by the TIER-3 sub-tabs the Venture Lab
   * config declares (operator, 2026-07-27). Its presence also means the menu
   * ABOVE owns surface selection, so this component drops its own surface row:
   * two navigations for one concept is the duplication the tiering removes.
   * Absent (a direct mount, or any host without the sub-tab row) keeps the
   * in-component row, so the tab still works standalone.
   */
  initialSurface?: string;
  /**
   * WHICH LAB this entrance belongs to. Defaults to 'venture' so every existing
   * Venture Lab mount is byte-identical in behaviour; the IRL cartridge passes
   * 'research'. It selects the registry, the access domain, and the operator-
   * facing language — it does NOT branch the surface, which is the point.
   */
  workspaceDomain?: string;
  /**
   * WHICH POSTURE this entrance is (operator ruling, 2026-07-28). 'private'
   * (the default, so every pre-existing mount is byte-identical) is the
   * partner↔metaProof bilateral workspace; 'public' is the cohort-facing
   * surface the Participate group's "Public Workspace" tab opens. It selects
   * the surface NAME and clamps the offered sub-surfaces — it does not select
   * the data, which is scope-filtered per caller either way.
   */
  workspaceVisibility?: string;
  /**
   * Lock this mount to exactly ONE workspace and drop the picker/Command
   * Center chrome — the same "rendered bare" convention the Guided Journey
   * Runtime already uses for PassportBureauApplyTab/BoundedDelegationTab/
   * ParticipationStandingTab (services/journey/journeySurfaceRegistry.ts).
   * Added for the Validation Programme journey (services/journey/
   * validationProgrammeJourney.ts), which composes THIS component's real
   * Overview/Review/Locker/Pipeline/Activity views for one specific research
   * workspace (`autonomi-review-exp-p1`) rather than forking a second
   * presentation of them. Security-neutral: the existing grant-scope filter
   * on `workspaces` still runs first, so locking to a workspace the caller
   * cannot open still resolves to the honest empty state below — this prop
   * only ever NARROWS what is reachable, never widens it.
   */
  lockedWorkspaceId?: string;
  /**
   * Suppress specific workspace-link ids from the Evidence view's link list
   * for THIS mount only — the workspace's own `links` array (services/
   * research/researchWorkspace.ts) is untouched, so every other mount of the
   * same workspace still shows the full list. Added 2026-08-01 for the
   * Validation Programme's Experiment Progress stage (operator instruction,
   * point 6: "remove: Records & Findings" from this rendering only).
   */
  hiddenLinkIds?: string[];
  /**
   * SECURITY (2026-08-27 IRL OS scoped restoration): codexSlug values a
   * workspace's DeepLinkCards must never resolve to FROM THIS MOUNT — the
   * workspace's own `links` array (services/research/researchWorkspace.ts)
   * is untouched (same "this mount only" contract as `hiddenLinkIds`), so
   * the identical workspace mounted elsewhere (e.g. inside the private
   * `irl-cartridge`'s own Workspace tab, where an `irl-cartridge` self-link
   * is correct) is unaffected. IRL OS (`irl-os-cartridge`) passes
   * `['irl-cartridge']` here for every surface it mounts this component
   * with: a caller who holds a genuine research-lab grant for a workspace
   * (Autonomi review, Lehigh capstone, OCSGA, VP1 — `grantedScopes` above
   * already cohort-isolates WHICH workspace they can even open) must still
   * never be handed a navigable link INTO the private cartridge merely
   * because they reached that workspace through the public host. This is
   * the host-awareness guard the original containment audit named as the
   * structurally sound fix (docs/security/2026-08-27_irl-os-containment-breach-audit.md,
   * Residual Risk 1, option b) — enforced at the render boundary rather
   * than by rewriting the shared workspace link data.
   */
  forbiddenCodexSlugs?: string[];
}

// ─── The two Labs, as configuration rather than branches ─────────────────────

type WorkspaceKind = "venture" | "research";

/** The participation access domain each Lab's workspaces are gated by. */
const ACCESS_DOMAIN: Record<WorkspaceKind, string> = {
  venture: "venture-lab",
  research: "research-lab",
};

/** Operator-facing language per Lab. Labels only — no gate, no data.
 *
 *  `surfaceName` is keyed by VISIBILITY (operator ruling, 2026-07-28): the
 *  Venture Lab's workspace has a private and a public expression and the header
 *  must say which one the operator is looking at. Naming both "Partner
 *  Workspace" is the representation gap the same ruling closed elsewhere — a
 *  header that cannot distinguish the bilateral record from the cohort surface
 *  makes the access model invisible at exactly the moment it matters. The
 *  Research Lab has no such split (no ruling asked for one), so both of its
 *  entries are the one name — stated explicitly rather than defaulted, so a
 *  future research split is a deliberate edit here. */
const KIND_COPY: Record<WorkspaceKind, {
  surfaceName: Record<WorkspaceVisibility, string>;
  selectorLabel: string;
  commandCenter: string;
  counterpartyLabel: string;
  unscopedHint: string;
  emptyRegistry: string;
}> = {
  venture: {
    surfaceName: {
      private: "Partner Private Workspace",
      public: "Partner Public Workspace",
    },
    selectorLabel: "Partner",
    commandCenter: "Pilot Command Center",
    counterpartyLabel: "Partner",
    unscopedHint:
      "Your venture-lab access isn’t scoped to a pilot yet — ask your steward to scope your invitation to a specific pilot.",
    emptyRegistry: "No partner workspaces registered.",
  },
  research: {
    surfaceName: {
      private: "Research Workspace",
      public: "Research Workspace",
    },
    selectorLabel: "Programme",
    commandCenter: "Programme Command Center",
    counterpartyLabel: "Series",
    unscopedHint:
      "Your research-lab access isn’t scoped to a programme yet — ask your steward to scope your invitation to a specific research workspace.",
    emptyRegistry: "No research workspaces registered.",
  },
};

function asWorkspaceKind(value: string | undefined): WorkspaceKind {
  return value === "research" ? "research" : "venture";
}

/**
 * The shape this surface renders. A PROJECTION of whichever registry the
 * entrance selects — never a store, and never a place a fact is authored: every
 * field below traces to the registry (or to the registry's own derivation
 * helper), which is what keeps `tests/partner-workspace.test.ts`'s "the tab
 * holds no hand-copied partner data" assertion true for both Labs.
 */
interface WorkspaceView {
  id: string;
  /** Selector chip text. */
  chipLabel: string;
  /** Caption beside the Command Center heading. */
  contextLabel: string;
  /** Rendered in the counterparty metric card; null → "Not yet wired". */
  counterpartyValue: string | null;
  /** Current phase/stage; null → "Not yet wired". */
  phaseLabel: string | null;
  /** Null when no ancestor declares an owner — renders as unassigned, never invented. */
  ownerAgentId: PartnerLayerOwnerId | null;
  layers: PartnerWorkspaceLayer[];
  layerOwners: Partial<Record<PartnerWorkspaceLayer, PartnerLayerOwnerId | null>>;
  objectives: string[];
  links: PartnerWorkspaceLink[];
  /** The workspace's lifecycle template (SPEC §7); null = the id resolves to none. */
  lifecycle: LifecycleTemplate | null;
  currentStage: string | null;
  institutions: string[];
  workspaceType: WorkspaceType;
  /** Extra, honestly-derived metric cards for this Lab. */
  extraMetrics: { label: string; value: string; detail?: string }[];
  /**
   * Left-nav grouping (research kind only; 2026-07-29 restructure) — null for
   * the venture kind, which keeps its existing horizontal selector.
   */
  navSection: ResearchWorkspaceNavSection | null;
  /** Indentation depth within `navSection` (0 = section root). Always 0 for venture. */
  navDepth: number;
  /** Whether this workspace's title may be inline-renamed (Autonomi = never). */
  titleEditable: boolean;
  /** From the registry's optional `contacts` field; [] when none declared. */
  contacts: { name: string; role?: string }[];
  /** From the registry's optional `differentiatorStatement`; null when none declared. */
  differentiatorStatement: string | null;
  /**
   * The research registry's own `visibility` posture (SPEC-IRL-WORKSPACE-001
   * §11 — 'private' | 'invited' | 'public'), null for the venture kind (which
   * has no such concept). IRL OS — Experiment Membership & Artifact Workspace
   * Restoration (2026-09-02): this is what lets a workspace an admin has
   * explicitly declared `'public'` appear to a caller with NO grant at all,
   * without widening anything for the (today, universal) `'invited'`/
   * `'private'` default — see the `workspaces` memo below, the resolver this
   * mirrors (`getParticipantResearchWorkspaceAccess`,
   * services/passport/participationAccess.ts), and the spec's item 5/13.
   */
  researchVisibility: string | null;
}

function ventureView(ws: PartnerWorkspace): WorkspaceView {
  return {
    id: ws.id,
    chipLabel: `${ws.partnerName} · Series ${ws.series}`,
    contextLabel: `${ws.partnerName} Pilot Series ${ws.series} · AgentiQ/metaMe partnership`,
    counterpartyValue: ws.partnerName,
    phaseLabel: PHASE_LABELS[ws.phase],
    ownerAgentId: ws.ownerAgentId,
    layers: [...PARTNER_WORKSPACE_LAYERS],
    layerOwners: ws.layerOwners,
    objectives: ws.objectives,
    links: ws.links,
    // The venture ladder is a lifecycle template like any other — resolved
    // through the SAME registry the research pipelines use, so the Pipeline
    // view is domain-neutral and the venture entrance is unaffected by it
    // (its own sub-surface list never offers Pipeline).
    lifecycle: getLifecycleTemplate("venture-pilot"),
    currentStage: PHASE_LABELS[ws.phase],
    institutions: [ws.partnerName],
    workspaceType: "pilot",
    extraMetrics: [],
    contacts: ws.contacts ?? [],
    differentiatorStatement: ws.differentiatorStatement ?? null,
    // Venture kind keeps its existing horizontal selector — no left-nav
    // grouping concept applies.
    navSection: null,
    navDepth: 0,
    titleEditable: false,
    researchVisibility: null,
  };
}

function researchView(ws: ReturnType<typeof listResearchWorkspaces>[number]): WorkspaceView {
  const label = researchWorkspaceLabel(ws);
  const experiments = researchWorkspaceExperiments(ws);
  // Owner, layer owners and links are INHERITED down the hierarchy by the
  // registry's own derivations — the same ones the spine projects through — so
  // a student project renders its programme's division of labour without the
  // registry restating it, and the surface cannot disagree with the spine.
  const owner = researchWorkspaceOwner(ws);
  const institutions = researchWorkspaceInstitutions(ws);
  const template = getLifecycleTemplate(ws.lifecycleTemplateId);
  return {
    id: ws.id,
    chipLabel: label,
    contextLabel: `${label} · Invariant Research Lab`,
    // The counterparty of a research workspace is the institution(s) it is a
    // collaboration WITH — for a series-convening programme that is still the
    // series. Null when neither is declared, which renders "Not yet wired"
    // rather than an invented value.
    counterpartyValue: institutions.length > 0 ? institutions.join(' · ') : ws.seriesId ?? null,
    // The workspace's stage on its OWN lifecycle template (SPEC §7). Before
    // 2026-07-29 the research registry declared no phase and this was honestly
    // null; it now declares one, so the metric reads the real value — and stays
    // null for a workspace that declares none rather than inventing "stage 1".
    phaseLabel: ws.currentStage ?? null,
    ownerAgentId: owner,
    layers: RESEARCH_WORKSPACE_LAYERS,
    layerOwners: researchWorkspaceLayerOwners(ws),
    objectives: researchWorkspaceObjectives(ws),
    links: researchWorkspaceLinks(ws),
    lifecycle: template,
    currentStage: ws.currentStage ?? null,
    institutions,
    workspaceType: ws.workspaceType,
    extraMetrics: [
      // A count of ZERO is meaningful for a series-convening programme and
      // MEANINGLESS for a cohort, which convenes no series at all. Offering the
      // metric only where it has a referent is the same honesty rule the
      // "Not yet wired" states follow — a "0 Experiments" card on a capstone
      // reads as a broken derivation, not as an absence of series members.
      ...(experiments.length > 0
        ? [
            {
              label: "Experiments",
              value: String(experiments.length),
              detail: "members of this series (registry-derived)",
            },
          ]
        : []),
    ],
    // The research registry has no contacts/differentiator-statement concept
    // today — honestly empty/null, never invented.
    contacts: [],
    differentiatorStatement: null,
    navSection: researchWorkspaceNavSection(ws),
    navDepth: researchWorkspaceNavDepth(ws),
    titleEditable: researchWorkspaceTitleEditable(ws),
    researchVisibility: ws.visibility ?? null,
  };
}

// ─── Small presentational pieces ─────────────────────────────────────────────

function NotYetWired() {
  return <span className="text-xs italic text-slate-500">Not yet wired</span>;
}

/**
 * `accent` (2026-07-29 correction) is an OPTIONAL hex tint — the Programme
 * Command Center's per-programme colour accent (`NAV_SECTION_ACCENT`, see
 * above). Omitted → identical rendering to before (plain slate `PANEL`); the
 * venture kind (which has no nav section) never passes one. Kept restrained:
 * a coloured top hairline + a faint background wash, not a coloured fill.
 */
function MetricCard({
  label,
  children,
  detail,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  detail?: string;
  accent?: string | null;
}) {
  return (
    <div
      className={`${PANEL} px-3 py-2.5`}
      style={
        accent
          ? { borderTopColor: accent, borderTopWidth: 2, backgroundColor: `${accent}12` }
          : undefined
      }
    >
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-200">{children}</div>
      {detail && <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>}
    </div>
  );
}

/** A small colour dot for a subsection heading (2026-07-29 correction) — the
 *  restrained "subsections underneath the Programme Command Center" accent
 *  the operator asked for. Renders nothing when no accent applies (venture
 *  kind, or a research workspace with no resolved section). */
function AccentDot({ color }: { color: string | null | undefined }) {
  if (!color) return null;
  return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

/**
 * SECURITY (2026-08-27 addendum to the IRL OS containment pass — see
 * docs/security/2026-08-27_irl-os-containment-breach-audit.md): `isAdmin` is
 * deliberately NOT propagated into the generated href — a query-derived
 * `?isAdmin=true` used to seed real UI-level admin state at the destination
 * (useCodexEmbedAuthBridge). The destination now resolves its OWN admin
 * status exclusively from its own canonical persona check; forwarding this
 * caller's value would be, at best, a stale/misleading duplicate of that
 * resolution, and at worst the exact authority-confusion primitive this
 * pass removed. `personaId` remains — a navigation hint only (which
 * persona's data to show), never itself authority-bearing.
 */
function DeepLinkCard({ link, personaId }: { link: PartnerWorkspaceLink; personaId?: string }) {
  const href = buildCodexUrl(link.codexSlug, {
    tab: link.tab,
    personaId,
    from: "alpha-knyt",
    fromTab: "partner-programmes",
  });
  return (
    <a href={href} className={`${PANEL} block px-4 py-3 transition hover:bg-slate-800/60`}>
      <p className="text-sm font-medium text-slate-100">{link.label} →</p>
      <p className="mt-0.5 text-xs text-slate-400">{link.description}</p>
    </a>
  );
}

/**
 * The functional boundary of a surface, rendered FROM the authority table
 * rather than written out per view (SPEC §9). Two surfaces claiming different
 * boundaries than the gate enforces is exactly the drift this avoids: the
 * sentence a reader sees and the rule a canary drives come from one record.
 */
function BoundaryNote({ surface }: { surface: string }) {
  const authority = workspaceSurfaceAuthority(surface);
  return (
    <div className={`${PANEL} px-4 py-2.5`}>
      <p className="text-[11px] leading-relaxed text-slate-500">
        <span className="text-slate-400">Boundary:</span> this surface{" "}
        {authority.mayMutateGovernedState ? "may change" : "cannot change"} governed state and{" "}
        {authority.mayAdmitToLocker ? "may admit" : "cannot admit"} artefacts to the Locker.
        {!authority.mayMutateGovernedState && surface === "qubetalk" && (
          <> Deliberation is not a decision — no consequential decision may remain only here.</>
        )}
        {surface === "working-materials" && (
          <> Working Materials are never the authoritative record.</>
        )}
      </p>
    </div>
  );
}

/**
 * The lifecycle template's stages with the workspace's own stage marked.
 *
 * Renders the TEMPLATE, not a computed position: a stage the template does not
 * declare shows as unknown rather than silently snapping to the first stage
 * (`lifecycleStageIndex` returns -1 for exactly this, and "we do not know" and
 * "it is at the beginning" must not read alike).
 */
function PipelinePanel({ ws }: { ws: WorkspaceView }) {
  if (!ws.lifecycle) {
    return (
      <div className={`${PANEL} p-4 text-xs text-slate-400`}>
        This workspace names a lifecycle template that does not resolve — the pipeline cannot be
        rendered honestly until it does.
      </div>
    );
  }
  const current = lifecycleStageIndex(ws.lifecycle, ws.currentStage);
  return (
    <div className="space-y-3">
      <BoundaryNote surface="pipeline" />
      <div className={`${PANEL} p-4`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">{ws.lifecycle.label} pipeline</h3>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            {ws.currentStage
              ? current >= 0
                ? `Stage ${current + 1} of ${ws.lifecycle.stages.length}`
                : "Stage not in this template"
              : "Stage not declared"}
          </span>
        </div>
        <ol className="space-y-1.5">
          {ws.lifecycle.stages.map((stage, i) => {
            const isCurrent = i === current;
            const isPast = current >= 0 && i < current;
            return (
              <li
                key={stage}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                  isCurrent
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    isCurrent
                      ? "bg-violet-500/30 text-violet-100"
                      : isPast
                        ? "bg-slate-700 text-slate-300"
                        : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-xs ${
                    isCurrent ? "text-violet-100" : isPast ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {stage}
                </span>
                {isCurrent && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-violet-300">
                    Current
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          Stages are a description of where the work is, never a permission. Advancing a stage is an
          act performed by the capability that owns the transition and receipted there.
        </p>
      </div>
    </div>
  );
}

function AreaLinks({
  ws,
  area,
  personaId,
  isAdmin,
  hiddenLinkIds,
  forbiddenCodexSlugs,
}: {
  ws: { links: PartnerWorkspaceLink[] };
  area: PartnerWorkspaceLink["area"];
  personaId?: string;
  isAdmin?: boolean;
  /** Link ids to omit from THIS mount only — the workspace's own link list is untouched. */
  hiddenLinkIds?: string[];
  /** codexSlug values to omit from THIS mount only — see the prop's doc comment on PartnerProgrammesTabProps. */
  forbiddenCodexSlugs?: string[];
}) {
  const links = ws.links.filter(
    (l) => l.area === area && !hiddenLinkIds?.includes(l.id) && !forbiddenCodexSlugs?.includes(l.codexSlug),
  );
  if (links.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {links.map((l) => (
        // isAdmin deliberately not forwarded — see DeepLinkCard's own doc comment.
        <DeepLinkCard key={l.id} link={l} personaId={personaId} />
      ))}
    </div>
  );
}

// ─── Research programme left-nav (2026-07-29 restructure) ───────────────────

/** Decorative only — a generic icon per `workspaceType`, never an invented
 *  per-workspace field. Mirrors the Laboratory → Experiments sidebar's
 *  icon+label row shape (`components/composer/InvariantExperimentLab.tsx`). */
const WORKSPACE_TYPE_ICON: Record<WorkspaceType, React.ComponentType<{ className?: string }>> = {
  "research-programme": Target,
  experiment: FlaskConical,
  cohort: Users,
  "student-project": GraduationCap,
  // Venture kind never reaches this nav (it keeps its own horizontal
  // selector), but the union requires every member.
  pilot: Target,
  "venture-programme": Target,
};

/**
 * Restrained colour accents (2026-07-29 correction — operator: "it's all a bit
 * monochromatic... use some colour... just to break up the monotony... not
 * too much, just some accents and tones"). REUSED, not invented: these are the
 * exact hex values of the AgentiQ Liquid Glass interpretation's field-sector
 * tokens (`services/representation/interpretations/agentiqLiquidGlass.ts` —
 * `field.reasoning` / `field.knowledge` / `field.consequence` /
 * `field.intelligence`), the platform's own "bright, maximally separable
 * hues" set, already curated there for distinguishing categorical sectors.
 * `field.order` (emerald) is added the same way (2026-08-25, for the OCSGA
 * section below) — same interpretation file, same provenance, not invented.
 * This surface is not representation-adopted (no `RepresentationProvider` /
 * `var(--rep-*)` here), so the hex values are read directly as a scoped
 * exception to the slate house style (CLAUDE.md "Canonical Surface Styling")
 * rather than through the CSS-variable path an adopted surface would use.
 * Scope is deliberately narrow: the Programme Command Center's metric cards
 * and the Overview subsection headers beneath it — never the left nav (which
 * stays pixel-matched to the Laboratory sidebar) and never a wholesale
 * re-theme.
 */
const FIELD_ACCENT = {
  reasoning: "#818CF8", // field.reasoning — indigo
  intelligence: "#38BDF8", // field.intelligence — sky
  knowledge: "#C084FC", // field.knowledge — purple
  consequence: "#FBBF24", // field.consequence — amber
  order: "#34D399", // field.order — emerald
} as const;

/** One accent per left-nav section, so a programme's Command Center and its
 *  Overview subsections carry a hue tied to which section it belongs to —
 *  Autonomi/Lehigh/MFE/CS Capstone/OCSGA each read as a distinct place. */
const NAV_SECTION_ACCENT: Record<ResearchWorkspaceNavSection, string> = {
  autonomi: FIELD_ACCENT.reasoning,
  lehigh: FIELD_ACCENT.knowledge,
  "mfe-capstone": FIELD_ACCENT.consequence,
  "cs-capstone": FIELD_ACCENT.intelligence,
  ocsga: FIELD_ACCENT.order,
};

const TITLE_OVERRIDE_STORAGE_KEY = "research_workspace_title_overrides_v1";

/** localStorage-only (CLAUDE.md "State Management Boundaries" — UX reactivity,
 *  never a source of truth): the Lehigh/MFE/CS Capstone titles are casual
 *  placeholders the operator may rename inline; Autonomi's items never offer
 *  the control (`titleEditable` is false). No server persistence exists yet —
 *  a rename here is this browser's own override, not a platform-wide edit. */
function loadTitleOverrides(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TITLE_OVERRIDE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * The research programme left-nav. STRUCTURALLY MIRRORS the Laboratory →
 * Experiments sidebar (`components/composer/InvariantExperimentLab.tsx`) —
 * not just visually, but the same scroll/collapse/truncation behaviour
 * (operator correction, 2026-07-29: "the exact same formatting as that...
 * separation between the menu on the left with scrolling as need be and
 * collapsibility... labels are truncated as need be so that they all stay
 * consistent"):
 *   - outer rail: `border-r border-slate-800 bg-slate-900/40 overflow-y-auto
 *     transition-all duration-200`, collapsing `w-56` ↔ `w-8` — identical
 *     classes to the Laboratory sidebar's own rail.
 *   - collapsed state: a vertical icon-only strip (all items flattened,
 *     section grouping dropped) with an expand chevron — same shape as the
 *     Laboratory sidebar's collapsed rail.
 *   - expanded state: a header row (title + collapse chevron) then
 *     `space-y-3` sections, each `space-y-1` items, each label `truncate`d —
 *     same classes, same structure.
 * The colour accent (`NAV_SECTION_ACCENT`) and the inline-rename affordance
 * are additive to this shape, not deviations from it — the base scroll/
 * collapse/truncate mechanics are unchanged from the Laboratory reference.
 */
function ResearchProgrammeNav({
  workspaces,
  activeId,
  onSelect,
}: {
  workspaces: WorkspaceView[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setOverrides(loadTitleOverrides());
  }, []);

  const sections = useMemo(
    () =>
      RESEARCH_NAV_SECTIONS.map((section) => ({
        ...section,
        items: workspaces.filter((w) => w.navSection === section.id),
      })).filter((section) => section.items.length > 0),
    [workspaces],
  );

  function startEdit(w: WorkspaceView) {
    setEditingId(w.id);
    setDraft(overrides[w.id] ?? w.chipLabel);
  }

  function saveEdit(id: string) {
    const trimmed = draft.trim();
    const next = { ...overrides };
    if (trimmed.length > 0) next[id] = trimmed;
    else delete next[id];
    setOverrides(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TITLE_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
    }
    setEditingId(null);
  }

  return (
    <div
      className={`h-full flex-shrink-0 self-stretch overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm transition-all duration-200 ${
        collapsed ? "w-8" : "w-56"
      }`}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <button
            onClick={() => setCollapsed(false)}
            title="Expand programme nav"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {sections.flatMap((section) => section.items).map((item) => {
            const Icon = WORKSPACE_TYPE_ICON[item.workspaceType];
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  setCollapsed(false);
                }}
                title={overrides[item.id] ?? item.chipLabel}
                className={`flex h-6 w-6 items-center justify-center rounded transition ${
                  isActive ? "bg-violet-500/20 text-violet-200" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Programmes</h3>
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse programme nav"
              className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.id}>
                <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {section.label}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = WORKSPACE_TYPE_ICON[item.workspaceType];
                    const isActive = item.id === activeId;
                    const isEditing = editingId === item.id;
                    const displayLabel = overrides[item.id] ?? item.chipLabel;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${item.navDepth * 14}px` }}
                      >
                        {isEditing ? (
                          <div className="flex flex-1 items-center gap-1">
                            <input
                              autoFocus
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(item.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="w-full rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                            />
                            <button
                              onClick={() => saveEdit(item.id)}
                              title="Save"
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-emerald-400 hover:bg-slate-800/60"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              title="Cancel"
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-800/60"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => onSelect(item.id)}
                              title={displayLabel}
                              className={`flex flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                                isActive
                                  ? "bg-violet-500/20 text-violet-200"
                                  : "bg-white/5 text-slate-300 hover:bg-white/10"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="truncate">{displayLabel}</span>
                            </button>
                            {item.titleEditable && (
                              <button
                                onClick={() => startEdit(item)}
                                title="Rename (this browser only)"
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── The tab ─────────────────────────────────────────────────────────────────

/** Narrows the tier-3 prop to a real surface — an unknown value opens Overview
 *  rather than rendering nothing, so a mistyped config degrades visibly. */
function asSubSurface(value: string | undefined): SubSurface | null {
  if (!value) return null;
  return (SUB_SURFACES as readonly string[]).includes(value) ? (value as SubSurface) : "overview";
}

// ─── Tier 0 — Administration (the internal programme space) ──────────────────

interface WorkspaceSpineResponse {
  ok?: boolean;
  viewerTier?: string;
  workspace?: {
    experimentClass?: string;
    participation?: { domain?: string; roles?: string[]; memberCount?: number };
    workingGroups?: Array<{ id: string; label: string; channelCount: number }>;
    invariants?: {
      canonVersion?: string;
      resolvedAt?: string;
      references?: Array<{ invariantId: string; seedId: string | null; statement: string; status: string; canonicalTerm: string }>;
      unresolved?: string[];
    } | null;
    milestones?: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
  };
  tier0?: {
    referenceIssues?: string[];
    blockers?: Array<{ id: string; title: string; status: string }>;
    decisions?: Array<{ agreementId: string; label: string; status: string; agentRef: string | null }>;
  } | null;
}

/**
 * The internal programme space. Everything here is RESOLVED through the
 * ExperimentWorkspace spine — reference integrity, the invariants the
 * workspace's own text resolves to (with provenance), the projected decisions,
 * and the two workspace-local concerns (milestones, blockers).
 *
 * Honesty rule (as everywhere on this tab): an empty section says it is empty
 * and why. Milestones and blockers read empty until the Phase 2 migration is
 * applied — that is a real state, not a loading artifact.
 */
function WorkspaceAdministration({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ready"; data: WorkspaceSpineResponse } | { kind: "error"; message: string }>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch(`/api/venture/workspace/${encodeURIComponent(workspaceId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) {
            setState({
              kind: "error",
              message: res.status === 403 ? "Workspace membership required" : `Spine unavailable (${res.status})`,
            });
          }
          return;
        }
        const data = (await res.json()) as WorkspaceSpineResponse;
        if (!cancelled) setState({ kind: "ready", data });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Spine unreachable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (state.kind === "loading") {
    return <div className={`${PANEL} p-4 text-xs text-slate-400`}>Resolving the workspace spine…</div>;
  }
  if (state.kind === "error") {
    return <div className={`${PANEL} p-4 text-xs text-rose-300`}>{state.message}</div>;
  }

  const { workspace, tier0 } = state.data;
  const invariants = workspace?.invariants ?? null;
  const milestones = workspace?.milestones ?? [];
  const blockers = tier0?.blockers ?? [];
  const decisions = tier0?.decisions ?? [];
  const issues = tier0?.referenceIssues ?? [];

  return (
    <div className="space-y-4">
      <div className={`${PANEL} p-4`}>
        <h3 className="text-sm font-semibold text-slate-100">Internal programme space</h3>
        <p className="mt-1 text-xs text-slate-400">
          Tier 0 — internal assessment, posture and risk. Never shared with the counterparty. The
          shared workspace views are Tier 2 — open to a{" "}
          <span className="text-slate-300">{workspace?.participation?.domain ?? "—"}</span> grant
          holding one of{" "}
          <span className="text-slate-300">
            {(workspace?.participation?.roles ?? []).join(", ") || "—"}
          </span>
          , scoped to this specific workspace. Rendered from the spine response, not restated here.
        </p>
        {!isAdmin && (
          <p className="mt-2 text-xs text-amber-300">
            You are viewing this without platform admin — the server returns no Tier 0 content.
          </p>
        )}
      </div>

      {/* Reference integrity — the spine's own self-check. */}
      <div className={`${PANEL} p-4`}>
        <h3 className="text-sm font-semibold text-slate-100">Reference integrity</h3>
        {issues.length === 0 ? (
          <p className="mt-1 text-xs text-emerald-300">
            Every declared reference resolves against the substrate.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-300">
            {issues.map((i, n) => (
              <li key={n}>{i}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Resolved invariants — with provenance, never a stored id list. */}
      <div className={`${PANEL} p-4`}>
        <h3 className="text-sm font-semibold text-slate-100">Governing invariants</h3>
        <p className="mt-1 text-[10px] text-slate-500">
          Resolved from the workspace&apos;s own text at read time — never stored on the workspace.
          {invariants?.canonVersion ? ` Canon ${invariants.canonVersion}.` : ""}
        </p>
        {!invariants || (invariants.references ?? []).length === 0 ? (
          <p className="mt-2 text-xs italic text-slate-500">
            No invariant resolved from this workspace&apos;s text.
            {invariants && (invariants.unresolved ?? []).length > 0
              ? ` ${(invariants.unresolved ?? []).length} concept(s) named but not governed by canon.`
              : ""}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {(invariants.references ?? []).map((r) => (
              <li key={r.invariantId} className="text-xs text-slate-300">
                <span className="text-slate-500">{r.seedId ?? r.invariantId}</span> · {r.statement}
                <span className="ml-1 text-[10px] text-slate-500">
                  (via &ldquo;{r.canonicalTerm}&rdquo;, {r.status})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The two workspace-local concerns. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`${PANEL} p-4`}>
          <h3 className="text-sm font-semibold text-slate-100">Milestones</h3>
          {milestones.length === 0 ? (
            <p className="mt-1 text-xs italic text-slate-500">None recorded.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {milestones.map((m) => (
                <li key={m.id}>
                  {m.title} <span className="text-slate-500">· {m.status}</span>
                  {m.dueDate ? <span className="text-slate-500"> · due {m.dueDate}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`${PANEL} p-4`}>
          <h3 className="text-sm font-semibold text-slate-100">Blockers</h3>
          {blockers.length === 0 ? (
            <p className="mt-1 text-xs italic text-slate-500">None recorded.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {blockers.map((b) => (
                <li key={b.id}>
                  {b.title} <span className="text-slate-500">· {b.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Projected, not stored. */}
      <div className={`${PANEL} p-4`}>
        <h3 className="text-sm font-semibold text-slate-100">Decisions</h3>
        <p className="mt-1 text-[10px] text-slate-500">
          Projected from Constitutional Agreements — the workspace keeps no decision store.
        </p>
        {decisions.length === 0 ? (
          <p className="mt-2 text-xs italic text-slate-500">
            No agreement yet names one of this workspace&apos;s agents.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {decisions.map((d) => (
              <li key={d.agreementId}>
                {d.label} <span className="text-slate-500">· {d.status}</span>
                {d.agentRef ? <span className="text-slate-500"> · {d.agentRef}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── The joined evidence chain (Slice B) ─────────────────────────────────────

/**
 * ONE mapping, and it is the ONLY branch this surface makes about the chain:
 * `state` → a tone. Everything else — every status word, every reason, the
 * standing verdict — is rendered VERBATIM from the server projection.
 *
 * Deriving "eligible" (or any link status) from parts on the client would be a
 * second implementation of a gate the server already owns
 * (`isStandingEligible`, the four independent authority facets), free to drift
 * from it the moment either side changed. That is why nothing below reads a
 * facet name, compares a binding state, or combines two fields.
 *
 * `negative` is deliberately NEUTRAL slate, not rose. A Horizen agent with no
 * metaMe binding is legitimate external evidence — ruling 2 — and painting its
 * five constitutional links red would tell the operator an error occurred when
 * the honest reading is "we looked; there is none". The reason string beside
 * each link is what carries the meaning; `indeterminate` gets amber because
 * "we could not establish this" is the state that genuinely wants attention.
 */
const CHAIN_TONE: Record<ChainLinkState, string> = {
  affirmed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  negative: "border-slate-700 bg-slate-800/50 text-slate-300",
  indeterminate: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

type ChainRow =
  | { ok: true; registryAlias: string; network: string; label: string; chain: EvidenceChainView }
  | { ok: false; registryAlias: string; network: string; label: string; reason: string; detail: string };

type ChainState =
  | { kind: "loading" }
  | { kind: "ready"; rows: ChainRow[] }
  | { kind: "error"; message: string };

function ChainStatus({ label, status, state, detail }: { label: string; status: string; state: ChainLinkState; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-slate-200">{label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{detail}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${CHAIN_TONE[state]}`}>{status}</span>
    </div>
  );
}

/**
 * The demonstrable object: Horizen agent identity + Horizen proof/validation +
 * DVN ingestion receipt + passport-backed delegation → attributable
 * constitutional evidence.
 *
 * NO raw identifier of any tier is rendered — not the persona/passport/grant/
 * agent-DID (T0), and not the four T2 commitments either. The commitments show
 * as presence only; `tests/horizen-evidence-chain.test.ts` scans this
 * component's own source for every one of them.
 */
function EvidenceChainPanel({
  workspaceId,
  personaId,
  differentiatorStatement,
}: {
  workspaceId: string;
  personaId?: string;
  /** From the registry's optional field — rendered verbatim, never invented. */
  differentiatorStatement?: string | null;
}) {
  const [state, setState] = useState<ChainState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const res = await personaFetch(
          `/api/venture/workspace/${encodeURIComponent(workspaceId)}/evidence-chain`,
          { cache: "no-store", personaIdHint: personaId },
        );
        if (!res.ok) {
          if (!cancelled) {
            setState({
              kind: "error",
              message:
                res.status === 403
                  ? "Your access grant is not scoped to this workspace."
                  : `Evidence chain unavailable (${res.status})`,
            });
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) setState({ kind: "ready", rows: (data?.chains ?? []) as ChainRow[] });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Evidence chain unreachable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, personaId]);

  if (state.kind === "loading") {
    return <div className={`${PANEL} p-4 text-xs text-slate-400`}>Joining the evidence chain…</div>;
  }
  if (state.kind === "error") {
    return <div className={`${PANEL} p-4 text-xs text-rose-300`}>{state.message}</div>;
  }
  if (state.rows.length === 0) {
    // A workspace that ingests no external agent evidence. An honest absence,
    // distinct from a failed read above — the two must never read alike.
    return null;
  }

  return (
    <div className="space-y-3">
      <div className={`${PANEL} p-4`}>
        <h3 className="text-sm font-semibold text-slate-100">Attributable constitutional evidence</h3>
        {differentiatorStatement && (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{differentiatorStatement}</p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Partner agent identity + partner proof/validation + the DVN ingestion receipt +
          passport-backed delegation, joined into one record. Every status below is derived
          server-side from the binding record; identifiers are held server-side and surface only as
          status and commitment presence.
        </p>
      </div>

      {state.rows.map((row) => (
        <div key={`${row.network}:${row.registryAlias}`} className={`${PANEL} p-4`}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-medium text-slate-100">{row.label}</h4>
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              {row.registryAlias} · {row.network}
            </span>
          </div>

          {!row.ok ? (
            <p className="text-xs text-amber-300">
              Partner read failed ({row.reason}) — {row.detail}. This is an unread agent, not an
              agent without evidence.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Standing — the verdict, always with the reason the binding
                  resolution itself gave. An "ineligible" with no reason is only
                  diagnosable from a SQL console. */}
              <div className={`rounded-lg border px-3 py-2 ${CHAIN_TONE[row.chain.standing.state]}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-medium">Standing eligibility: {row.chain.standing.status}</p>
                  <span className="text-[10px] uppercase tracking-wide opacity-70">
                    {row.chain.standing.reasonCode}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed opacity-90">{row.chain.standing.reason}</p>
              </div>

              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {row.chain.links.map((l) => (
                  <ChainStatus key={l.id} label={l.label} status={l.status} state={l.state} detail={l.detail} />
                ))}
              </div>

              {/*
                Pulse and Verifiable PnL — two INDEPENDENT status cards
                (operator direction, 2026-08-07), deliberately separate from
                the seven links above (those are the ratified constitutional
                chain; these are partner-capability status). Neither is
                derived from the other — an agent can be fully Pulse-enrolled
                while Verifiable PnL still reads "not registered", and that is
                not a contradiction to resolve, it is the actual state.
              */}
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                <ChainStatus
                  label={row.chain.pulseStatus.label}
                  status={row.chain.pulseStatus.status}
                  state={row.chain.pulseStatus.state}
                  detail={row.chain.pulseStatus.detail}
                />
                <ChainStatus
                  label={row.chain.verifiablePnlStatus.label}
                  status={row.chain.verifiablePnlStatus.status}
                  state={row.chain.verifiablePnlStatus.state}
                  detail={row.chain.verifiablePnlStatus.detail}
                />
              </div>

              {/* The partner's own public record — chain data, no metaMe identifier. */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <MetricCard label="Binding state">{row.chain.bindingState}</MetricCard>
                <MetricCard label="Token id" detail={`chain ${row.chain.agent.chainId}`}>
                  {row.chain.agent.tokenId}
                </MetricCard>
                <MetricCard label="Identity class" detail={row.chain.agent.erc8004IdentityChain}>
                  {row.chain.agent.identityClass}
                </MetricCard>
                <MetricCard label="Agent card">{row.chain.agent.agentCardStatus}</MetricCard>
              </div>

              {/* Four instants, never collapsed into "now" (ruling 4). */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <MetricCard label="Action occurred">
                  {row.chain.temporal.actionOccurredAt ?? <NotYetWired />}
                </MetricCard>
                <MetricCard label="Proof recorded">
                  {row.chain.temporal.proofRecordedAt ?? <NotYetWired />}
                </MetricCard>
                <MetricCard label="Ingested">{row.chain.temporal.ingestedAt}</MetricCard>
                <MetricCard label="Receipt written">
                  {row.chain.temporal.receiptCreatedAt ?? <NotYetWired />}
                </MetricCard>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Commitments held</p>
                <p className="mt-1 text-[11px] text-slate-300">
                  Principal {row.chain.commitments.principal ? "✓" : "—"} · Passport{" "}
                  {row.chain.commitments.passport ? "✓" : "—"} · Delegation{" "}
                  {row.chain.commitments.delegation ? "✓" : "—"} · Agent binding{" "}
                  {row.chain.commitments.agentBinding ? "✓" : "—"}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Recorded as one-way commitments and withheld from this surface — the receipt
                  carries them, the screen does not.
                </p>
              </div>

              {!row.chain.agent.correlationVerified && row.chain.agent.correlationNotes.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-[10px] text-amber-300">
                  {row.chain.agent.correlationNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function PartnerProgrammesTab({ personaId, isAdmin, initialSurface, workspaceDomain, workspaceVisibility, lockedWorkspaceId, hiddenLinkIds, forbiddenCodexSlugs }: PartnerProgrammesTabProps) {
  const kind = asWorkspaceKind(workspaceDomain);
  const visibility = asVisibility(workspaceVisibility);
  const copy = KIND_COPY[kind];
  const accessDomain = ACCESS_DOMAIN[kind];
  // Cohort isolation (Amendment G, 2026-07-28 ruling): this picker must not
  // even LIST a workspace the caller cannot open (MS-9 — a control that cannot
  // act must not render). The tab-group gate above already required a grant in
  // this Lab's domain to reach the component at all; this narrows WHICH
  // workspace(s) within that domain the grant actually scopes. Domain-neutral
  // by construction — the same decision, both Labs.
  const access = useParticipationAccess(personaId);
  const allWorkspaces = useMemo<WorkspaceView[]>(
    () =>
      kind === "research"
        ? listResearchWorkspaces().map(researchView)
        : listPartnerWorkspaces().map(ventureView),
    [kind],
  );
  const grantedScopes = scopesGrantedIn(access, accessDomain, Boolean(isAdmin));
  const workspaces = useMemo(() => {
    // PUBLIC VISIBILITY (IRL OS — Experiment Membership & Artifact Workspace
    // Restoration, 2026-09-02, spec items 1/5/13): a workspace an admin has
    // explicitly declared `researchVisibility === 'public'` is visible to
    // EVERY caller, grant or none — mirrors the server-side resolver
    // (`getParticipantResearchWorkspaceAccess`,
    // services/passport/participationAccess.ts). No workspace in the
    // registry declares `'public'` today, so this is currently a no-op for
    // every existing entrance — it only ever WIDENS what an admin-authored
    // `public` declaration reaches, never a grant-independent default.
    const scoped =
      grantedScopes === "all"
        ? allWorkspaces
        : allWorkspaces.filter(
            (w) => grantedScopes.includes(w.id) || w.researchVisibility === "public",
          );
    // Locking NARROWS further — a caller whose grant does not reach
    // `lockedWorkspaceId` still lands on the honest empty state below, never
    // on an unscoped workspace this prop tried to force open.
    return lockedWorkspaceId ? scoped.filter((w) => w.id === lockedWorkspaceId) : scoped;
    // `grantedScopes` is a fresh array each render when scoped; key off its
    // content so the memo does not thrash and `activeId` stays stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWorkspaces, grantedScopes === "all" ? "all" : grantedScopes.join("|"), lockedWorkspaceId]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // activeId tracks the SCOPED list, not the full registry — a caller must
  // never land on a workspace they cannot open just because it's first in
  // the registry.
  useEffect(() => {
    if (!activeId && workspaces.length > 0) setActiveId(workspaces[0].id);
    else if (activeId && !workspaces.some((w) => w.id === activeId)) {
      setActiveId(workspaces[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces]);
  // The visibility CLAMP (see PUBLIC_SURFACES). A public entrance that asks
  // for a private area falls back to Overview rather than opening it, so a
  // config mistake degrades to the public surface instead of leaking one.
  const requestedSurface = asSubSurface(initialSurface);
  const menuSurface =
    requestedSurface && surfaceAllowed(requestedSurface, visibility, kind)
      ? requestedSurface
      : requestedSurface
        ? "overview"
        : null;
  const [surface, setSurface] = useState<SubSurface>(menuSurface ?? "overview");
  // The tier-3 row keeps this component mounted and swaps the prop, so state
  // initialised once would stick on whichever surface was opened first.
  useEffect(() => {
    if (menuSurface) setSurface(menuSurface);
  }, [menuSurface]);
  const [collabView, setCollabView] = useState<CollabView>("invitations");
  const [agreements, setAgreements] = useState<AgreementsState>({ kind: "loading" });

  const ws = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null,
    [workspaces, activeId],
  );

  // Open Actions — the one real derivation: open constitutional agreements
  // from the live CRP-003a route. Any failure → the honest unwired state.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await personaFetch("/api/constitutional/agreement", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        if (Array.isArray(data?.agreements)) setAgreements({ kind: "ready", rows: data.agreements as AgreementRow[] });
        else setAgreements({ kind: "unwired" });
      } catch {
        if (alive) setAgreements({ kind: "unwired" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!ws) {
    // Honest, distinct empty states (gaps are reported, not dropped) — an
    // empty registry, a not-yet-loaded grant, and a genuinely unscoped grant
    // are three different facts and must not read as the same message.
    if (!isAdmin && !access.loaded) {
      return <div className="p-8 text-center text-sm text-slate-500">Checking your workspace access…</div>;
    }
    if (!isAdmin && allWorkspaces.length > 0) {
      return <div className="p-8 text-center text-sm text-slate-500">{copy.unscopedHint}</div>;
    }
    return <div className="p-8 text-center text-sm text-slate-500">{copy.emptyRegistry}</div>;
  }

  const openAgreements = agreements.kind === "ready" ? agreements.rows.filter((r) => r.status !== "authorized") : [];
  const ownerName = layerOwnerDisplayName(ws.ownerAgentId);
  // The Programme Command Center's colour accent (2026-07-29 correction) —
  // research kind only, tied to the active workspace's left-nav section.
  // `null` for venture (no nav section concept) or a research workspace whose
  // ancestry resolves none (does not occur in the shipped registry).
  const commandAccent: string | null =
    kind === "research" && ws.navSection ? NAV_SECTION_ACCENT[ws.navSection] : null;

  return (
    // RESEARCH kind gets a bounded, independently-scrolling row — the SAME
    // `h-full overflow-hidden` shape the Laboratory → Experiments sidebar's
    // own wrapper uses (`components/composer/InvariantExperimentLab.tsx`), so
    // the left nav and the content column each scroll on their own rather
    // than the whole page growing (2026-07-29 correction — genuine parity,
    // not just matching classNames on the nav in isolation). VENTURE kind is
    // untouched: same `flex gap-4 p-4` it always had.
    <div className={kind === "research" ? "flex h-full gap-4 overflow-hidden" : "flex gap-4 p-4"}>
      {/* Programme picker — RESEARCH kind gets the grouped left-hand nav
          (mirrors the Laboratory → Experiments sidebar, 2026-07-29
          restructure); VENTURE kind is unaffected and keeps its horizontal
          selector inline below (rendered inside the flex-1 column so its
          existing `space-y-4` sibling spacing is unchanged). */}
      {kind === "research" && !lockedWorkspaceId && (
        <div className="flex h-full flex-shrink-0 flex-col gap-2">
          {/* "My Experiments" (IRL OS — Experiment Membership & Artifact
              Workspace Restoration, spec item 3): a plain label over the
              existing programme nav, not a new list — `workspaces` is
              already exactly "public experiments + this caller's own
              entitled experiments, nothing else" (see the `workspaces` memo
              above), so labelling it is the whole change. No duplicated
              state between this and Participation: both read the same
              underlying grant/visibility resolver
              (`getParticipantResearchWorkspaceAccess`,
              services/passport/participationAccess.ts; the server-side
              projection at GET /api/participation/my-experiments). */}
          <span className="flex-shrink-0 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            My Experiments
          </span>
          <div className="min-h-0 flex-1">
            <ResearchProgrammeNav workspaces={workspaces} activeId={ws.id} onSelect={setActiveId} />
          </div>
        </div>
      )}
      <div className={kind === "research" ? "min-w-0 flex-1 space-y-4 overflow-y-auto p-4" : "min-w-0 flex-1 space-y-4"}>
      {/* Workspace selector + Command Center — omitted for the Journey surface
          (operator UI review, 2026-07-31): the Guided Journey Runtime is its
          own lightweight capability, not a workspace panel, and does not
          need the Pilot/Programme Command Center chrome above it. Also
          omitted whenever `lockedWorkspaceId` is set (2026-08-01) — a locked
          mount is ITSELF a bare Guided Journey Runtime surface for the
          Validation Programme journey, composing one of the eight research
          views directly rather than a workspace panel with its own picker. */}
      {surface !== "journey" && !lockedWorkspaceId && (
      <>
      {/* Workspace selector — derived from the registry (single source).
          VENTURE ONLY: research's programme picker is the left nav above. */}
      {kind !== "research" && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">{copy.selectorLabel}</span>
        {workspaces.map((w) => (
          <button
            key={w.id}
            onClick={() => setActiveId(w.id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              w.id === ws.id
                ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            {w.chipLabel}
          </button>
        ))}
      </div>
      )}

      {/* Command Center — the surface's own name is visible, per the 2026-07-28
          representation ruling: "Workspace" must have a real UI referent.
          `commandAccent` (2026-07-29 correction) tints every metric card with
          this programme's nav-section colour — restrained (a top hairline +
          a faint wash, see MetricCard), and `null`/absent for venture. */}
      <div className={`${PANEL} p-4`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-100">
            {copy.surfaceName[visibility]} — {copy.commandCenter}
          </h2>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">{ws.contextLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricCard label="Health" accent={commandAccent}>
            <NotYetWired />
          </MetricCard>
          <MetricCard
            label="Current Phase"
            detail={ws.phaseLabel ? "from the workspace registry" : undefined}
            accent={commandAccent}
          >
            {ws.phaseLabel ?? <NotYetWired />}
          </MetricCard>
          <MetricCard label="Next Milestone" accent={commandAccent}>
            <NotYetWired />
          </MetricCard>
          <MetricCard label="Owner" detail={ws.ownerAgentId ?? undefined} accent={commandAccent}>
            {ownerName ?? <NotYetWired />}
          </MetricCard>
          <MetricCard label={copy.counterpartyLabel} accent={commandAccent}>
            {ws.counterpartyValue ?? <NotYetWired />}
          </MetricCard>
          {ws.extraMetrics.map((m) => (
            <MetricCard key={m.label} label={m.label} detail={m.detail} accent={commandAccent}>
              {m.value}
            </MetricCard>
          ))}
          <MetricCard
            label="Open Actions"
            detail={agreements.kind === "ready" ? "open constitutional agreements (proposed/accepted)" : undefined}
            accent={commandAccent}
          >
            {agreements.kind === "loading" && <span className="text-xs text-slate-500">Loading…</span>}
            {agreements.kind === "ready" && <span>{openAgreements.length}</span>}
            {agreements.kind === "unwired" && <NotYetWired />}
          </MetricCard>
          <MetricCard label="Technical Blockers" accent={commandAccent}>
            <NotYetWired />
          </MetricCard>
          <MetricCard label="Last Sync" accent={commandAccent}>
            <NotYetWired />
          </MetricCard>
        </div>
      </div>
      </>
      )}

      {/* Sub-surface navigation — omitted when the tier-3 menu owns it. */}
      {menuSurface === null && (
      <div className="flex flex-wrap gap-1.5">
        {KIND_SURFACES[kind]
          .filter((s) => s !== "administration" && surfaceAllowed(s, visibility, kind))
          .filter((s) => !ADMIN_ONLY_SURFACES.includes(s) || isAdmin)
          .map((s) => (
          <button
            key={s}
            onClick={() => setSurface(s)}
            className={`rounded-md border px-3 py-1.5 text-xs transition ${
              surface === s
                ? "border-violet-500/50 bg-violet-500/10 text-violet-200"
                : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            {surfaceLabel(s, kind)}
          </button>
        ))}
      </div>
      )}

      {/* ── Overview ──
          Subsection panels below carry a restrained left-border accent +
          heading dot in `commandAccent` (2026-07-29 correction — "the
          subsections underneath the standard Programme Command Center — a
          little bit more use of colour... not too much, just some accents
          and tones"). `commandAccent` is `null` for venture, so these render
          exactly as before there. */}
      {surface === "overview" && (
        <div className="space-y-4">
          <div className={`${PANEL} p-4`} style={commandAccent ? { borderLeftColor: commandAccent, borderLeftWidth: 2 } : undefined}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <AccentDot color={commandAccent} />
              Objectives
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-slate-300">
              {ws.objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
          <div className={`${PANEL} p-4`} style={commandAccent ? { borderLeftColor: commandAccent, borderLeftWidth: 2 } : undefined}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <AccentDot color={commandAccent} />
              Layer Owners
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              The ratified agent division of labour — encoded as data in the workspace registry.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ws.layers.map((layer) => {
                const owner = ws.layerOwners[layer] ?? null;
                return (
                  <div key={layer} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{LAYER_LABELS[layer]}</p>
                    <p className="mt-0.5 text-xs text-slate-200">
                      {owner ? layerOwnerDisplayName(owner) : <span className="italic text-slate-500">No owner assigned</span>}
                    </p>
                    {owner && <p className="text-[10px] text-slate-500">{owner}</p>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Contacts — fluid prose, deliberately not a formal escalation
              matrix (operator instruction). Rendered entirely from the
              registry's `contacts` field (partner facts come only from the
              registry) — the tab holds no partner name literally, so this
              renders nothing for a workspace that declares no contacts and
              needs no change when the next partner workspace is added. The
              Relationship Builder link below stays the contact surface of
              record for anything beyond this short roster note. */}
          {ws.contacts.length > 0 && (
            <div className={`${PANEL} p-4`} style={commandAccent ? { borderLeftColor: commandAccent, borderLeftWidth: 2 } : undefined}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <AccentDot color={commandAccent} />
                Contacts
              </h3>
              <div className="mt-2 space-y-1.5">
                {ws.contacts.map((c) => (
                  <p key={c.name} className="text-xs text-slate-300">
                    <span className="text-slate-100">{c.name}</span>
                    {c.role ? <> — {c.role}</> : null}
                  </p>
                ))}
              </div>
            </div>
          )}
          <AreaLinks ws={ws} area="overview" personaId={personaId} isAdmin={isAdmin} forbiddenCodexSlugs={forbiddenCodexSlugs} />
        </div>
      )}

      {/* ── Collaborate — the Locker + invitations + peer exchange, scoped to
             the venture-lab access domain (the IRL pattern, venture instance). ── */}
      {surface === "collaborate" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {COLLAB_VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setCollabView(v)}
                className={`rounded-md border px-2.5 py-1 text-[11px] transition ${
                  collabView === v
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                {COLLAB_LABELS[v]}
              </button>
            ))}
          </div>
          {collabView === "invitations" && (
            <div className={`${PANEL} p-3`}>
              <p className="mb-2 text-[11px] text-slate-500">
                Bounded bearer invitations for the <span className="text-slate-300">{accessDomain}</span>{" "}
                access domain — invite participants with a role and an optional auto-opened peer
                channel. Who may actually issue is derived server-side from the caller&apos;s own
                grants (delegated invitation authority); this surface only offers what that
                authority allows.
              </p>
              <StewardParticipationTab initialDomain={accessDomain} />
            </div>
          )}
          {collabView === "peer-exchange" && (
            <div className={`${PANEL} p-3`}>
              <p className="mb-2 text-[11px] text-slate-500">
                QubeTalk Peer Exchange, filtered to channels opened from the{" "}
                <span className="text-slate-300">{accessDomain}</span> domain. Same store as the
                Locker&apos;s canonical inbox — this is a filter, not a second inbox.
              </p>
              <QubeTalkInboxTab domainFilter={accessDomain} />
            </div>
          )}
          {collabView === "locker" && (
            <div className={`${PANEL} p-3`}>
              <p className="mb-2 text-[11px] text-slate-500">
                The holder-owned encrypted Locker (canonical, unfiltered — locker items are
                holder-scoped, not workspace-scoped).
              </p>
              <LockerTab />
            </div>
          )}
        </div>
      )}

      {/* ── Journey (PRD-GJR-001, Guided Journey Runtime) ── */}
      {surface === "journey" && (
        <div className={`${PANEL} overflow-hidden`} style={{ minHeight: 520 }}>
          <PilotJourneyTab personaId={personaId} isAdmin={isAdmin} isPartner />
        </div>
      )}

      {/* ── Steward — the Bureau's own Review Queue, mounted here ── */}
      {surface === "steward" && isAdmin && (
        <div className={`${PANEL} overflow-hidden`} style={{ minHeight: 420 }}>
          <PassportBureauStewardTab />
        </div>
      )}

      {/* ── Operate ── */}
      {surface === "operate" && (
        <div className="space-y-4">
          <div className={`${PANEL} p-4`}>
            <h3 className="text-sm font-semibold text-slate-100">Constitutional Agreements</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              The workspace&apos;s operational substrate — agreements gating delegated execution (CFI-002 / the 409 gate).
            </p>
            <div className="mt-3 space-y-1.5">
              {agreements.kind === "loading" && <p className="text-xs text-slate-500">Loading…</p>}
              {agreements.kind === "unwired" && <NotYetWired />}
              {agreements.kind === "ready" && agreements.rows.length === 0 && (
                <p className="text-xs italic text-slate-500">No agreements yet — form one from the Financial Services Suite.</p>
              )}
              {agreements.kind === "ready" &&
                agreements.rows.map((a) => (
                  <div key={a.agreementId} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                    <div>
                      <p className="text-xs text-slate-200">{a.displayLabel}</p>
                      <p className="text-[10px] text-slate-500">
                        {a.capabilityRef ?? "—"} · {a.selectedAgentRef ?? "—"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        a.status === "authorized"
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                          : "border-amber-500/30 bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
            </div>
          </div>
          <AreaLinks ws={ws} area="operate" personaId={personaId} isAdmin={isAdmin} forbiddenCodexSlugs={forbiddenCodexSlugs} />
        </div>
      )}

      {/* ── Evidence ── */}
      {surface === "evidence" && (
        <div className="space-y-4">
          <div className={`${PANEL} p-4`}>
            <p className="text-xs text-slate-400">
              Workspace evidence is DVN-anchored receipts — the anchor of record. A workspace-scoped
              receipt filter (receipts tagged to this workspace) is <span className="italic text-slate-500">not yet wired</span>;
              until it is, the canonical receipt surfaces below are the evidence record.
            </p>
          </div>
          {/* The joined evidence chain. Renders only for a workspace whose
              registry declares reference agents — the route returns an empty
              list otherwise, so the research entrance shares this component
              without inheriting a venture-only panel. */}
          <EvidenceChainPanel
            workspaceId={ws.id}
            personaId={personaId}
            differentiatorStatement={ws.differentiatorStatement}
          />
          <AreaLinks ws={ws} area="evidence" personaId={personaId} isAdmin={isAdmin} hiddenLinkIds={hiddenLinkIds} forbiddenCodexSlugs={forbiddenCodexSlugs} />
        </div>
      )}

      {/* ── Communicate ── */}
      {surface === "communicate" && (
        <div className="space-y-4">
          <div className={`${PANEL} p-4`}>
            <p className="text-xs text-slate-400">
              Partner communications run through the relationship layer (owner:{" "}
              {layerOwnerDisplayName(ws.layerOwners.relationship ?? null) ?? "unassigned"}) on the existing
              surfaces below — this workspace links, it does not fork them.
            </p>
          </div>
          <AreaLinks ws={ws} area="communicate" personaId={personaId} isAdmin={isAdmin} forbiddenCodexSlugs={forbiddenCodexSlugs} />
        </div>
      )}

      {/* ── Pipeline (SPEC §7) ── */}
      {surface === "pipeline" && <PipelinePanel ws={ws} />}

      {/* ── Review — the IRL-REVIEW-001 front end (SPEC §7) ── */}
      {surface === "review" && (
        <div className="space-y-4">
          <BoundaryNote surface="review" />
          <div className={`${PANEL} p-4`}>
            <h3 className="text-sm font-semibold text-slate-100">Independent Review</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Review packages, reviewers, rubric, decisions, contested items and review receipts are
              produced by the IRL-REVIEW-001 capability. This view is its workspace entrance — the
              capability is mounted at its own home below, never reimplemented here.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              A reviewer inspects, comments, submits a structured decision and raises objections.
              Reviewers never write to source assets, and review is evidence — not ratification.
            </p>
          </div>
          <AreaLinks ws={ws} area="operate" personaId={personaId} isAdmin={isAdmin} forbiddenCodexSlugs={forbiddenCodexSlugs} />
        </div>
      )}

      {/* ── Working Materials (SPEC §7, §9) ── */}
      {surface === "working-materials" && (
        <div className="space-y-4">
          <BoundaryNote surface="working-materials" />
          <div className={`${PANEL} p-4`}>
            <h3 className="text-sm font-semibold text-slate-100">Working Materials</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Mutable drafts, notes, source packs, notebooks, code branches and unresolved
              decisions. Nothing here is the record: promotion into the Locker requires a governed
              freeze and a content commitment, and this surface cannot perform one.
            </p>
            <p className="mt-2 text-xs italic text-slate-500">
              A workspace-scoped materials store is not yet wired — the working surfaces below are
              where this programme&apos;s materials live today.
            </p>
          </div>
          <AreaLinks ws={ws} area="operate" personaId={personaId} isAdmin={isAdmin} forbiddenCodexSlugs={forbiddenCodexSlugs} />
        </div>
      )}

      {/* ── Locker — authoritative artefacts only (SPEC §7, §9) ── */}
      {surface === "locker" && (
        <div className="space-y-3">
          <BoundaryNote surface="locker" />
          <div className={`${PANEL} p-3`}>
            <p className="mb-2 text-[11px] text-slate-500">
              The holder-owned encrypted Locker (canonical, unfiltered — locker items are
              holder-scoped, not workspace-scoped).
            </p>
            <LockerTab />
          </div>
        </div>
      )}

      {/* ── QubeTalk — deliberation only (SPEC §7, §9) ── */}
      {surface === "qubetalk" && (
        <div className="space-y-3">
          <BoundaryNote surface="qubetalk" />
          <div className={`${PANEL} p-3`}>
            <p className="mb-2 text-[11px] text-slate-500">
              QubeTalk Peer Exchange, filtered to channels opened from the{" "}
              <span className="text-slate-300">{accessDomain}</span> domain. Same store as the
              Locker&apos;s canonical inbox — this is a filter, not a second inbox.
            </p>
            <QubeTalkInboxTab domainFilter={accessDomain} />
          </div>
        </div>
      )}

      {/* ── Participants (SPEC §7) ── */}
      {surface === "participants" && (
        <div className="space-y-3">
          <BoundaryNote surface="participants" />
          <div className={`${PANEL} p-3`}>
            <p className="mb-2 text-[11px] text-slate-500">
              People, institutions, roles, invitation status and scope. Bounded bearer invitations
              for the <span className="text-slate-300">{accessDomain}</span> access domain — who may
              actually issue one, into which domain, and scoped to which programmes is derived
              server-side from the caller&apos;s OWN grants. This surface only offers what that
              authority already allows.
            </p>
            {ws.institutions.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {ws.institutions.map((inst) => (
                  <span
                    key={inst}
                    className="rounded-full border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-300"
                  >
                    {inst}
                  </span>
                ))}
              </div>
            )}
            <StewardParticipationTab initialDomain={accessDomain} />
          </div>
        </div>
      )}

      {/* ── Administration (Tier 0 — internal programme space) ── */}
      {surface === "administration" && (
        <WorkspaceAdministration workspaceId={ws.id} isAdmin={isAdmin === true} />
      )}
      </div>
    </div>
  );
}

export default PartnerProgrammesTab;
