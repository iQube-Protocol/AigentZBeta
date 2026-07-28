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
  RESEARCH_WORKSPACE_LAYERS,
} from "@/services/research/researchWorkspace";
import { StewardParticipationTab } from "./StewardParticipationTab";
import dynamic from "next/dynamic";
import { LockerTab } from "./LockerTab";
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
const SUB_SURFACES = ["overview", "collaborate", "operate", "evidence", "communicate", "administration"] as const;
type SubSurface = (typeof SUB_SURFACES)[number];
const SUB_LABELS: Record<SubSurface, string> = {
  overview: "Overview",
  collaborate: "Collaborate",
  operate: "Operate",
  evidence: "Evidence",
  communicate: "Communicate",
  administration: "Administration",
};

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
}

// ─── The two Labs, as configuration rather than branches ─────────────────────

type WorkspaceKind = "venture" | "research";

/** The participation access domain each Lab's workspaces are gated by. */
const ACCESS_DOMAIN: Record<WorkspaceKind, string> = {
  venture: "venture-lab",
  research: "research-lab",
};

/** Operator-facing language per Lab. Labels only — no gate, no data. */
const KIND_COPY: Record<WorkspaceKind, {
  surfaceName: string;
  selectorLabel: string;
  commandCenter: string;
  counterpartyLabel: string;
  unscopedHint: string;
  emptyRegistry: string;
}> = {
  venture: {
    surfaceName: "Partner Workspace",
    selectorLabel: "Partner",
    commandCenter: "Pilot Command Center",
    counterpartyLabel: "Partner",
    unscopedHint:
      "Your venture-lab access isn’t scoped to a pilot yet — ask your steward to scope your invitation to a specific pilot.",
    emptyRegistry: "No partner workspaces registered.",
  },
  research: {
    surfaceName: "Research Workspace",
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
  /** Current phase; null → "Not yet wired" (research has no phase model yet). */
  phaseLabel: string | null;
  ownerAgentId: PartnerLayerOwnerId;
  layers: PartnerWorkspaceLayer[];
  layerOwners: Partial<Record<PartnerWorkspaceLayer, PartnerLayerOwnerId | null>>;
  objectives: string[];
  links: PartnerWorkspaceLink[];
  /** Extra, honestly-derived metric cards for this Lab. */
  extraMetrics: { label: string; value: string; detail?: string }[];
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
    extraMetrics: [],
  };
}

function researchView(ws: ReturnType<typeof listResearchWorkspaces>[number]): WorkspaceView {
  const label = researchWorkspaceLabel(ws);
  const experiments = researchWorkspaceExperiments(ws);
  return {
    id: ws.id,
    chipLabel: label,
    contextLabel: `${label} · Invariant Research Lab`,
    counterpartyValue: ws.seriesId,
    // The research registry declares no phase: a venture pilot's
    // exploration→evidence ladder is not the lifecycle of a validation series,
    // and asserting one would be an invention. "Not yet wired" is the honest
    // state, the same discipline the venture metrics already follow.
    phaseLabel: null,
    ownerAgentId: ws.ownerAgentId,
    layers: RESEARCH_WORKSPACE_LAYERS,
    layerOwners: ws.layerOwners,
    objectives: researchWorkspaceObjectives(ws),
    links: ws.links,
    extraMetrics: [
      {
        label: "Experiments",
        value: String(experiments.length),
        detail: "members of this series (registry-derived)",
      },
    ],
  };
}

// ─── Small presentational pieces ─────────────────────────────────────────────

function NotYetWired() {
  return <span className="text-xs italic text-slate-500">Not yet wired</span>;
}

function MetricCard({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className={`${PANEL} px-3 py-2.5`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-200">{children}</div>
      {detail && <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>}
    </div>
  );
}

function DeepLinkCard({ link, personaId, isAdmin }: { link: PartnerWorkspaceLink; personaId?: string; isAdmin?: boolean }) {
  const href = buildCodexUrl(link.codexSlug, {
    tab: link.tab,
    personaId,
    isAdmin,
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

function AreaLinks({ ws, area, personaId, isAdmin }: { ws: { links: PartnerWorkspaceLink[] }; area: PartnerWorkspaceLink["area"]; personaId?: string; isAdmin?: boolean }) {
  const links = ws.links.filter((l) => l.area === area);
  if (links.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {links.map((l) => (
        <DeepLinkCard key={l.id} link={l} personaId={personaId} isAdmin={isAdmin} />
      ))}
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

export function PartnerProgrammesTab({ personaId, isAdmin, initialSurface, workspaceDomain }: PartnerProgrammesTabProps) {
  const kind = asWorkspaceKind(workspaceDomain);
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
  const workspaces = useMemo(
    () =>
      grantedScopes === "all"
        ? allWorkspaces
        : allWorkspaces.filter((w) => grantedScopes.includes(w.id)),
    // `grantedScopes` is a fresh array each render when scoped; key off its
    // content so the memo does not thrash and `activeId` stays stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allWorkspaces, grantedScopes === "all" ? "all" : grantedScopes.join("|")],
  );
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
  const menuSurface = asSubSurface(initialSurface);
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

  return (
    <div className="space-y-4 p-4">
      {/* Workspace selector — derived from the registry (single source). */}
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

      {/* Command Center — the surface's own name is visible, per the 2026-07-28
          representation ruling: "Workspace" must have a real UI referent. */}
      <div className={`${PANEL} p-4`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-100">
            {copy.surfaceName} — {copy.commandCenter}
          </h2>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">{ws.contextLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricCard label="Health">
            <NotYetWired />
          </MetricCard>
          <MetricCard label="Current Phase" detail={ws.phaseLabel ? "from the workspace registry" : undefined}>
            {ws.phaseLabel ?? <NotYetWired />}
          </MetricCard>
          <MetricCard label="Next Milestone">
            <NotYetWired />
          </MetricCard>
          <MetricCard label="Owner" detail={ws.ownerAgentId}>
            {ownerName}
          </MetricCard>
          <MetricCard label={copy.counterpartyLabel}>
            {ws.counterpartyValue ?? <NotYetWired />}
          </MetricCard>
          {ws.extraMetrics.map((m) => (
            <MetricCard key={m.label} label={m.label} detail={m.detail}>
              {m.value}
            </MetricCard>
          ))}
          <MetricCard
            label="Open Actions"
            detail={agreements.kind === "ready" ? "open constitutional agreements (proposed/accepted)" : undefined}
          >
            {agreements.kind === "loading" && <span className="text-xs text-slate-500">Loading…</span>}
            {agreements.kind === "ready" && <span>{openAgreements.length}</span>}
            {agreements.kind === "unwired" && <NotYetWired />}
          </MetricCard>
          <MetricCard label="Technical Blockers">
            <NotYetWired />
          </MetricCard>
          <MetricCard label="Last Sync">
            <NotYetWired />
          </MetricCard>
        </div>
      </div>

      {/* Sub-surface navigation — omitted when the tier-3 menu owns it. */}
      {menuSurface === null && (
      <div className="flex flex-wrap gap-1.5">
        {SUB_SURFACES.filter((s) => s !== "administration").map((s) => (
          <button
            key={s}
            onClick={() => setSurface(s)}
            className={`rounded-md border px-3 py-1.5 text-xs transition ${
              surface === s
                ? "border-violet-500/50 bg-violet-500/10 text-violet-200"
                : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            {SUB_LABELS[s]}
          </button>
        ))}
      </div>
      )}

      {/* ── Overview ── */}
      {surface === "overview" && (
        <div className="space-y-4">
          <div className={`${PANEL} p-4`}>
            <h3 className="text-sm font-semibold text-slate-100">Objectives</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-slate-300">
              {ws.objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
          <div className={`${PANEL} p-4`}>
            <h3 className="text-sm font-semibold text-slate-100">Layer Owners</h3>
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
          <AreaLinks ws={ws} area="overview" personaId={personaId} isAdmin={isAdmin} />
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
          <AreaLinks ws={ws} area="operate" personaId={personaId} isAdmin={isAdmin} />
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
          <AreaLinks ws={ws} area="evidence" personaId={personaId} isAdmin={isAdmin} />
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
          <AreaLinks ws={ws} area="communicate" personaId={personaId} isAdmin={isAdmin} />
        </div>
      )}

      {/* ── Administration (Tier 0 — internal programme space) ── */}
      {surface === "administration" && (
        <WorkspaceAdministration workspaceId={ws.id} isAdmin={isAdmin === true} />
      )}
    </div>
  );
}

export default PartnerProgrammesTab;
