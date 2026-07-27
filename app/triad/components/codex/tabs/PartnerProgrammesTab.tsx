"use client";

/**
 * PartnerProgrammesTab — the Partner Workspace surface (Venture Lab).
 *
 * COMPOSITION, NOT APPLICATION: this tab orchestrates existing Venture Lab
 * capabilities around a partner pilot. Every partner fact renders from the
 * partnerWorkspace registry (services/venture/partnerWorkspace.ts — the single
 * authoritative list); every capability either MOUNTS an existing component
 * (Collaborate: invitations / peer exchange / locker) or DEEP-LINKS to the
 * capability's existing home via buildCodexUrl (never a bespoke URL).
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
  type PartnerWorkspace,
  type PartnerWorkspaceLink,
} from "@/services/venture/partnerWorkspace";
import { StewardParticipationTab } from "./StewardParticipationTab";
import dynamic from "next/dynamic";
import { LockerTab } from "./LockerTab";

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

const SUB_SURFACES = ["overview", "collaborate", "operate", "evidence", "communicate"] as const;
type SubSurface = (typeof SUB_SURFACES)[number];
const SUB_LABELS: Record<SubSurface, string> = {
  overview: "Overview",
  collaborate: "Collaborate",
  operate: "Operate",
  evidence: "Evidence",
  communicate: "Communicate",
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

function AreaLinks({ ws, area, personaId, isAdmin }: { ws: PartnerWorkspace; area: PartnerWorkspaceLink["area"]; personaId?: string; isAdmin?: boolean }) {
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

export function PartnerProgrammesTab({ personaId, isAdmin }: PartnerProgrammesTabProps) {
  const workspaces = listPartnerWorkspaces();
  const [activeId, setActiveId] = useState<string | null>(workspaces[0]?.id ?? null);
  const [surface, setSurface] = useState<SubSurface>("overview");
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
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        No partner workspaces registered.
      </div>
    );
  }

  const openAgreements = agreements.kind === "ready" ? agreements.rows.filter((r) => r.status !== "authorized") : [];
  const ownerName = layerOwnerDisplayName(ws.ownerAgentId);

  return (
    <div className="space-y-4 p-4">
      {/* Partner selector — derived from the registry (single source). */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Partner</span>
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
            {w.partnerName} · Series {w.series}
          </button>
        ))}
      </div>

      {/* Pilot Command Center */}
      <div className={`${PANEL} p-4`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-100">Pilot Command Center</h2>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            {ws.partnerName} Pilot Series {ws.series} · AgentiQ/metaMe partnership
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricCard label="Pilot Health">
            <NotYetWired />
          </MetricCard>
          <MetricCard label="Current Phase" detail="from the workspace registry">
            {PHASE_LABELS[ws.phase]}
          </MetricCard>
          <MetricCard label="Next Milestone">
            <NotYetWired />
          </MetricCard>
          <MetricCard label="Owner" detail={ws.ownerAgentId}>
            {ownerName}
          </MetricCard>
          <MetricCard label="Partner">{ws.partnerName}</MetricCard>
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

      {/* Sub-surface navigation */}
      <div className="flex flex-wrap gap-1.5">
        {SUB_SURFACES.map((s) => (
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
              {PARTNER_WORKSPACE_LAYERS.map((layer) => {
                const owner = ws.layerOwners[layer];
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
                Bounded bearer invitations for the Venture Lab access domain — invite partner
                participants with a role and an optional auto-opened peer channel.
              </p>
              <StewardParticipationTab initialDomain="venture-lab" />
            </div>
          )}
          {collabView === "peer-exchange" && (
            <div className={`${PANEL} p-3`}>
              <p className="mb-2 text-[11px] text-slate-500">
                QubeTalk Peer Exchange, filtered to channels opened from the Venture Lab domain.
                Same store as the Locker&apos;s canonical inbox — this is a filter, not a second inbox.
              </p>
              <QubeTalkInboxTab domainFilter="venture-lab" />
            </div>
          )}
          {collabView === "locker" && (
            <div className={`${PANEL} p-3`}>
              <p className="mb-2 text-[11px] text-slate-500">
                The holder-owned encrypted Locker (canonical, unfiltered — locker items are
                holder-scoped, not partner-scoped).
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
              The pilot&apos;s operational substrate — agreements gating delegated execution (CFI-002 / the 409 gate).
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
              Pilot evidence is DVN-anchored receipts — the anchor of record. A partner-scoped
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
              {layerOwnerDisplayName(ws.layerOwners.relationship) ?? "unassigned"}) on the existing
              surfaces below — this workspace links, it does not fork them.
            </p>
          </div>
          <AreaLinks ws={ws} area="communicate" personaId={personaId} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}

export default PartnerProgrammesTab;
