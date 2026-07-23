"use client";

/**
 * DomainConstitutionPanel — the steward ratification workflow for the
 * Constitutional Discovery amendment (PRD-ICA-001 amendment, RATIFIED
 * 2026-07-23, Phase 1). See `codexes/packs/agentiq/updates/
 * 2026-07-23_prd-ica-001-amendment-constitutional-discovery-domain-architect.md`.
 *
 * Renders the four artifacts Agent 0 (Domain Architect) proposes for a
 * domain, each on the same propose→ratify lifecycle (no auto-ratification):
 *   §2.1 Domain Definition, §2.2 Constitutional Coverage Model (pillars that
 *   CONSTITUTE the domain — Law I, §2.0), §2.3 Constitutional Dependency
 *   Registry (external domains that CONSTRAIN it), §3 Institutional Registry
 *   (generated FROM a ratified pillar — the pillar picker below only offers
 *   pillars that already exist in the Coverage Model).
 *
 * Composed into `CorpusScoutTab.tsx` above the candidate-review workspace —
 * this is upstream of acquisition, not a replacement for it. `onRatifiedPillarsChange`
 * lets the parent wire the ratified pillar keys straight into
 * `assessLaneCoverage()`'s `requiredLanes` parameter (Gap Detection, §6).
 *
 * Phase 2 addition: each ratified pillar also surfaces the §6.1 steward
 * saturation-confirmation gate — a distinct judgment ("is the institutional
 * corpus for this pillar exhausted?") from Gap Detection's algorithmic "≥1
 * approved source" check. `laneCoverageByPillar` (optional) threads the
 * parent's already-computed lane coverage down so the gate shows real
 * context, never a second fetch.
 *
 * Phase 3 addition: each ratified institution with a `seedUrl` gets a "Run
 * discovery" action — triggers Agent B/C (`institutionNavigator.ts` via
 * `/api/corpus-scout/institution-discovery`) to navigate from that seed URL
 * to candidate documents and submit them through the SAME back half every
 * manually-submitted URL goes through. `onDiscoveryComplete` lets the parent
 * refresh its candidate list without this panel owning that fetch.
 *
 * Spine discipline: every call goes through `personaFetch` (CLAUDE.md
 * PARAMOUNT) — never raw fetch. House style: translucent slate
 * (`bg-slate-900/40`, `border-slate-800`).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Loader2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface DefinitionRow { domain: string; purpose: string; status: "proposed" | "ratified" }
interface PillarRow {
  domain: string;
  pillarKey: string;
  pillarLabel: string;
  completenessDefinition: string;
  status: "proposed" | "ratified";
  saturationConfirmed: boolean;
  saturationConfirmedBy: string | null;
  saturationConfirmedAt: string | null;
}
interface DependencyRow { domain: string; dependencyName: string; relationship: string; status: "proposed" | "ratified" }
interface InstitutionRow { domain: string; pillarKey: string; institutionName: string; status: "proposed" | "ratified"; seedUrl: string | null }

interface Constitution {
  domain: string;
  definition: DefinitionRow | null;
  pillars: PillarRow[];
  dependencies: DependencyRow[];
  institutions: InstitutionRow[];
}

export interface DomainConstitutionPanelProps {
  domain: string;
  onRatifiedPillarsChange?: (pillarKeys: string[]) => void;
  /** Gap Detection context (§6) keyed by pillarKey — already computed by the
   *  parent's `assessLaneCoverage()` call, passed down so the §6.1 saturation
   *  action can show "N approved sources" without a second fetch. Optional —
   *  the confirm action itself never depends on this being present. */
  laneCoverageByPillar?: Record<string, { total: number; approved: number }>;
  /** Called after an Agent B/C discovery run submits candidates, so the
   *  parent's candidate list (and therefore lane coverage) refreshes without
   *  this panel needing to own or duplicate that fetch. */
  onDiscoveryComplete?: () => void;
}

function StatusChip({ status }: { status: "proposed" | "ratified" }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
        status === "ratified"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/40 bg-amber-500/10 text-amber-300"
      }`}
    >
      {status}
    </span>
  );
}

export function DomainConstitutionPanel({ domain, onRatifiedPillarsChange, laneCoverageByPillar, onDiscoveryComplete }: DomainConstitutionPanelProps) {
  const [open, setOpen] = useState(true);
  const [constitution, setConstitution] = useState<Constitution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [discoveryBusy, setDiscoveryBusy] = useState<string | null>(null);
  const [discoveryResults, setDiscoveryResults] = useState<Record<string, string>>({});

  const [purposeDraft, setPurposeDraft] = useState("");
  const [pillarKeyDraft, setPillarKeyDraft] = useState("");
  const [pillarLabelDraft, setPillarLabelDraft] = useState("");
  const [pillarDefDraft, setPillarDefDraft] = useState("");
  const [depNameDraft, setDepNameDraft] = useState("");
  const [depRelDraft, setDepRelDraft] = useState("");
  const [instPillarDraft, setInstPillarDraft] = useState("");
  const [instNameDraft, setInstNameDraft] = useState("");
  const [instSeedUrlDraft, setInstSeedUrlDraft] = useState("");

  const load = useCallback(async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/corpus-scout/domain-constitution?domain=${encodeURIComponent(domain)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || `Failed to load (HTTP ${res.status})`);
        return;
      }
      setConstitution(data.constitution as Constitution);
      setPurposeDraft(data.constitution?.definition?.purpose ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!constitution || !onRatifiedPillarsChange) return;
    onRatifiedPillarsChange(constitution.pillars.filter((p) => p.status === "ratified").map((p) => p.pillarKey));
  }, [constitution, onRatifiedPillarsChange]);

  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(action + JSON.stringify(extra));
      try {
        const res = await personaFetch("/api/corpus-scout/domain-constitution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, domain, ...extra }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setError(data?.error || `Action failed (HTTP ${res.status})`);
          return;
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusy(null);
      }
    },
    [domain, load],
  );

  const runDiscovery = useCallback(
    async (pillarKey: string, institutionName: string) => {
      const key = `${pillarKey}:${institutionName}`;
      setDiscoveryBusy(key);
      setDiscoveryResults((prev) => ({ ...prev, [key]: "Running §4/§5 Agent B/C…" }));
      try {
        const res = await personaFetch("/api/corpus-scout/institution-discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, pillarKey, institutionName }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setDiscoveryResults((prev) => ({ ...prev, [key]: data?.error || `Discovery failed (HTTP ${res.status})` }));
          return;
        }
        setDiscoveryResults((prev) => ({
          ...prev,
          [key]: `${data.submitted} candidate(s) submitted from ${data.pagesFetched} page(s) fetched (acquisitionMethod: institutional-registry).`,
        }));
        onDiscoveryComplete?.();
      } catch (e) {
        setDiscoveryResults((prev) => ({ ...prev, [key]: e instanceof Error ? e.message : "Discovery failed" }));
      } finally {
        setDiscoveryBusy(null);
      }
    },
    [domain, onDiscoveryComplete],
  );

  const ratifiedPillarOptions = useMemo(
    () => (constitution?.pillars ?? []).map((p) => ({ key: p.pillarKey, label: p.pillarLabel })),
    [constitution],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading constitutional substrate…
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-1.5 text-left">
        {open ? <ChevronDown className="h-4 w-4 text-violet-300" /> : <ChevronRight className="h-4 w-4 text-violet-300" />}
        <ShieldCheck className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-slate-200">Constitutional substrate — {domain}</h3>
      </button>
      {!open ? null : (
        <>
          <p className="text-[10px] text-slate-500">
            PRD-ICA-001 amendment §2 — Agent 0 (Domain Architect) proposes; a steward ratifies. Nothing here acquires
            documents — this defines the constitutional obligations acquisition is measured against.
          </p>
          {error && <p className="text-xs text-rose-300">{error}</p>}

          {/* Domain Definition (§2.1) */}
          <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">Domain Definition</span>
              {constitution?.definition && <StatusChip status={constitution.definition.status} />}
            </div>
            <textarea
              value={purposeDraft}
              onChange={(e) => setPurposeDraft(e.target.value)}
              rows={2}
              placeholder="What is this domain? e.g. The systems governing the creation, movement, management…"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => void act("propose-definition", { purpose: purposeDraft })}
                disabled={busy !== null || !purposeDraft.trim()}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white disabled:opacity-40"
              >
                {busy?.startsWith("propose-definition") ? <Loader2 className="h-3 w-3 animate-spin" /> : "Propose / update"}
              </button>
              <button
                onClick={() => void act("ratify-definition")}
                disabled={busy !== null || !constitution?.definition || constitution.definition.status === "ratified"}
                className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
              >
                Ratify
              </button>
            </div>
          </div>

          {/* Constitutional Coverage Model (§2.2) */}
          <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
            <span className="text-xs font-semibold text-slate-300">Constitutional Coverage Model — internal pillars</span>
            {(constitution?.pillars ?? []).map((p) => {
              const coverage = laneCoverageByPillar?.[p.pillarKey];
              return (
                <div key={p.pillarKey} className="space-y-1 rounded bg-white/5 px-2 py-1.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-200">{p.pillarLabel}</span>
                    <span className="text-slate-500">{p.completenessDefinition}</span>
                    <StatusChip status={p.status} />
                    {p.status !== "ratified" && (
                      <button
                        onClick={() => void act("ratify-pillar", { pillarKey: p.pillarKey })}
                        disabled={busy !== null}
                        className="ml-auto rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                      >
                        Ratify
                      </button>
                    )}
                  </div>
                  {p.status === "ratified" && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-1">
                      <span className="text-[10px] text-slate-500">
                        §6 Gap Detection:{' '}
                        {coverage
                          ? `${coverage.approved} approved / ${coverage.total} submitted`
                          : 'no coverage data yet'}
                      </span>
                      {p.saturationConfirmed ? (
                        <span className="rounded border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">
                          §6.1 saturation confirmed
                        </span>
                      ) : (
                        <button
                          onClick={() => void act("confirm-saturation", { pillarKey: p.pillarKey })}
                          disabled={busy !== null}
                          className="ml-auto rounded border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-40"
                          title="§6.1 — steward judgment that the Institutional Registry for this pillar is exhausted. Distinct from Gap Detection."
                        >
                          Confirm saturation
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
              <input value={pillarKeyDraft} onChange={(e) => setPillarKeyDraft(e.target.value)} placeholder="pillar key (e.g. banking)" className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500" />
              <input value={pillarLabelDraft} onChange={(e) => setPillarLabelDraft(e.target.value)} placeholder="label (e.g. Banking)" className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500" />
              <input value={pillarDefDraft} onChange={(e) => setPillarDefDraft(e.target.value)} placeholder="completeness definition" className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500" />
            </div>
            <button
              onClick={() => {
                void act("propose-pillar", { pillarKey: pillarKeyDraft, pillarLabel: pillarLabelDraft, completenessDefinition: pillarDefDraft });
                setPillarKeyDraft(""); setPillarLabelDraft(""); setPillarDefDraft("");
              }}
              disabled={busy !== null || !pillarKeyDraft.trim() || !pillarLabelDraft.trim()}
              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white disabled:opacity-40"
            >
              <Plus className="h-3 w-3" /> Propose pillar
            </button>
          </div>

          {/* Constitutional Dependency Registry (§2.3) */}
          <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
            <span className="text-xs font-semibold text-slate-300">Constitutional Dependency Registry — external dependencies</span>
            {(constitution?.dependencies ?? []).map((d) => (
              <div key={d.dependencyName} className="flex flex-wrap items-center gap-2 rounded bg-white/5 px-2 py-1 text-[11px]">
                <span className="font-medium text-slate-200">{d.dependencyName}</span>
                <span className="text-sky-300">{d.relationship}</span>
                <StatusChip status={d.status} />
                {d.status !== "ratified" && (
                  <button
                    onClick={() => void act("ratify-dependency", { dependencyName: d.dependencyName })}
                    disabled={busy !== null}
                    className="ml-auto rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                  >
                    Ratify
                  </button>
                )}
              </div>
            ))}
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
              <input value={depNameDraft} onChange={(e) => setDepNameDraft(e.target.value)} placeholder="dependency (e.g. Contract Law)" className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500" />
              <input value={depRelDraft} onChange={(e) => setDepRelDraft(e.target.value)} placeholder="relationship (e.g. governed by)" className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500" />
            </div>
            <button
              onClick={() => {
                void act("propose-dependency", { dependencyName: depNameDraft, relationship: depRelDraft });
                setDepNameDraft(""); setDepRelDraft("");
              }}
              disabled={busy !== null || !depNameDraft.trim() || !depRelDraft.trim()}
              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white disabled:opacity-40"
            >
              <Plus className="h-3 w-3" /> Propose dependency
            </button>
          </div>

          {/* Institutional Registry (§3) — generated FROM the pillars above */}
          <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
            <span className="text-xs font-semibold text-slate-300">Institutional Registry — per pillar</span>
            {ratifiedPillarOptions.length === 0 ? (
              <p className="text-[10px] italic text-slate-500">Propose a pillar first — institutions attach to an existing pillar.</p>
            ) : (
              <>
                {(constitution?.institutions ?? []).map((i) => (
                  <div key={`${i.pillarKey}-${i.institutionName}`} className="space-y-1 rounded bg-white/5 px-2 py-1.5 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">
                        {ratifiedPillarOptions.find((p) => p.key === i.pillarKey)?.label ?? i.pillarKey}
                      </span>
                      <span className="font-medium text-slate-200">{i.institutionName}</span>
                      <StatusChip status={i.status} />
                      {i.status !== "ratified" && (
                        <button
                          onClick={() => void act("ratify-institution", { pillarKey: i.pillarKey, institutionName: i.institutionName })}
                          disabled={busy !== null}
                          className="ml-auto rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                        >
                          Ratify
                        </button>
                      )}
                    </div>
                    {i.seedUrl ? (
                      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-1">
                        <a href={i.seedUrl} target="_blank" rel="noreferrer" className="truncate text-[10px] text-sky-300 underline">
                          {i.seedUrl}
                        </a>
                        {i.status === "ratified" && (
                          <button
                            onClick={() => void runDiscovery(i.pillarKey, i.institutionName)}
                            disabled={discoveryBusy !== null}
                            className="ml-auto rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300 hover:bg-violet-500/20 disabled:opacity-40"
                            title="§4/§5 Agent B/C — institution-targeted discovery from this seed URL"
                          >
                            {discoveryBusy === `${i.pillarKey}:${i.institutionName}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run discovery"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] italic text-slate-500">No seed URL — not yet eligible for Agent B/C discovery.</p>
                    )}
                    {discoveryResults[`${i.pillarKey}:${i.institutionName}`] && (
                      <p className="border-t border-white/5 pt-1 text-[10px] text-slate-400">
                        {discoveryResults[`${i.pillarKey}:${i.institutionName}`]}
                      </p>
                    )}
                  </div>
                ))}
                <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
                  <select
                    value={instPillarDraft}
                    onChange={(e) => setInstPillarDraft(e.target.value)}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100"
                  >
                    <option value="">— pillar —</option>
                    {ratifiedPillarOptions.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                  <input value={instNameDraft} onChange={(e) => setInstNameDraft(e.target.value)} placeholder="institution (e.g. FATF)" className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500" />
                  <input value={instSeedUrlDraft} onChange={(e) => setInstSeedUrlDraft(e.target.value)} placeholder="seed URL (optional, e.g. publications page)" className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500" />
                </div>
                <button
                  onClick={() => {
                    void act("propose-institution", { pillarKey: instPillarDraft, institutionName: instNameDraft, seedUrl: instSeedUrlDraft });
                    setInstNameDraft(""); setInstSeedUrlDraft("");
                  }}
                  disabled={busy !== null || !instPillarDraft || !instNameDraft.trim()}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" /> Propose institution
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DomainConstitutionPanel;
