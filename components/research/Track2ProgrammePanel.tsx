"use client";

/**
 * Track 2 — the guided operator workflow (operator ruling, 2026-08-02).
 *
 *   > "The operator must not need to run curl commands."
 *
 * ── What this panel is ─────────────────────────────────────────────────────
 *
 * A ROUTER with three hands. It renders the eleven-stage programme the server
 * derives (`/api/research/track2/[experimentId]`) and, for the five pieces the
 * operator named as missing a front end, it provides the control inline:
 *
 *   · guided crystal assignment (dry run, then admit with a rationale)
 *   · freeze-artifact provisioning
 *   · the freeze act itself
 *   · clear readiness remedies, carried verbatim from the readiness engine
 *   · (relationship creation lives on the invariant detail surface, where the
 *     invariant is — not duplicated here)
 *
 * Every other stage NAMES its existing surface and sends the operator there.
 * Re-implementing Corpus Scout review or candidate promotion inside a workflow
 * panel would be the parallel-implementation defect this programme was written
 * to avoid — and the second copy would be the stale one.
 *
 * ── What it does not decide ────────────────────────────────────────────────
 *
 * No rule is evaluated here. Eligibility, cycle guards, staleness, signatory
 * shape and every refusal come from the server; this panel renders the server's
 * own words. `dryRun` defaults on, the freeze requires an explicit
 * confirmation, and the content hash submitted for a freeze is the one the
 * operator was shown — never one this component recomputed.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { PROVENANCE_CLASSES } from "@/services/corpusScout/types";
import { findDuplicateCandidates, type DuplicateGroup } from "@/services/corpusScout/intelligence";
import { findRegistryEntry, type SourceTier } from "@/services/corpusScout/institutionalRegistry";
import {
  RECOMMENDATION_TO_REVIEW_DECISION,
  type AdmissionRecommendation,
  type RecommendedAdmissionClass,
} from "@/services/corpusScout/admissionRecommendation";

const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 p-4";

interface Stage {
  id: string;
  ordinal: number;
  label: string;
  does: string;
  capability: string;
  surface: string;
  workKind: "scientific" | "governance";
  actor: string;
  status: "complete" | "in-progress" | "not-started" | "blocked" | "unknown";
  detail: string;
  remedies: string[];
}

interface Programme {
  experimentId: string;
  crystalDomain: string;
  stages: Stage[];
  currentStageId: string;
  nextActions: string[];
  derivationNote: string;
}

interface RatifiedBoundary {
  domain: string;
  label: string;
  boundary: string;
  exclusions: string[];
  ratificationText: string | null;
  ratifiedBy: string | null;
  ratifiedAt: string | null;
  declarationHash: string;
  immutable: boolean;
  amendedBy: string;
}

interface Execution {
  wouldFreezeSucceed: boolean;
  nextAct: string;
  preconditions: { name: string; satisfied: boolean; detail: string; remedy: string | null }[];
}

interface AssignmentOutcome {
  invariantId: string;
  admitted: boolean;
  written: boolean;
  refusals: string[];
  detail: string;
  priorDomains: string[];
}

const STATUS_ICON: Record<Stage["status"], React.ReactNode> = {
  complete: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  "in-progress": <Circle className="h-3.5 w-3.5 text-amber-300" />,
  "not-started": <Circle className="h-3.5 w-3.5 text-slate-600" />,
  blocked: <ShieldAlert className="h-3.5 w-3.5 text-rose-300" />,
  unknown: <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />,
};

/** `unknown` is never rendered as a failure — it means the signal could not be
 *  read, which is different from both "not started" and "blocked". */
const STATUS_LABEL: Record<Stage["status"], string> = {
  complete: "complete",
  "in-progress": "in progress",
  "not-started": "not started",
  blocked: "blocked",
  unknown: "not observable from here",
};

export function Track2ProgrammePanel({ experimentId = "EXP-P1" }: { experimentId?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programme, setProgramme] = useState<Programme | null>(null);
  /*
   * The acquisition domain is a DIFFERENT namespace from the crystal domain
   * (the route says so explicitly and refuses to guess one from the other).
   * The review queue below reads candidate sources in the acquisition domain,
   * so it must come from the server's answer — never be inferred here.
   */
  const [acquisitionDomain, setAcquisitionDomain] = useState<string | null>(null);
  /*
   * FUTURE STAGES ARE COLLAPSED (Al + EXP agent, 2026-08-02).
   *
   *   > "several later steps display warnings like 'Nothing here has
   *   >  failed...'. Technically correct, but they make the screen noisy.
   *   >  I'd collapse Steps 5-11 until their prerequisites are met."
   *
   * Not hidden — collapsed, with the count and a toggle. A stage the operator
   * cannot act on yet is context; a stage they can act on is the work. Any
   * stage that is COMPLETE stays visible whatever its ordinal, because
   * concealing finished work would misreport progress in the other direction.
   */
  const [showAllStages, setShowAllStages] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}`, {
        cache: "no-store",
      });
      const d = await res.json().catch(() => null);
      if (!d?.requestSucceeded) {
        throw new Error(d?.error || `the Track 2 programme could not be read (HTTP ${res.status})`);
      }
      setProgramme(d.programme as Programme);
      setAcquisitionDomain(typeof d.acquisitionDomain === "string" ? d.acquisitionDomain : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "the Track 2 programme could not be read");
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className={PANEL}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">
            Track 2 — corpus acquisition to frozen crystal
          </h3>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {error}
          </div>
        )}

        {programme && (
          <>
            <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] text-slate-300">
              <div className="text-slate-500">crystal domain</div>
              <div className="font-mono text-slate-200">{programme.crystalDomain}</div>
              <div className="mt-1.5 text-slate-500">next</div>
              <ul className="space-y-0.5">
                {programme.nextActions.map((a, i) => (
                  <li key={i} className="text-slate-200">
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            <ol className="space-y-2">
              {programme.stages.map((s) => {
                const current = programme.stages.find((x) => x.id === programme.currentStageId);
                // Locked = later than where the work is, and not itself done.
                // A completed stage is never concealed, whatever its ordinal.
                const locked = !!current && s.ordinal > current.ordinal && s.status !== "complete";
                if (locked && !showAllStages) return null;
                return (
                <li
                  key={s.id}
                  className={`rounded-lg border p-2.5 text-[11px] ${
                    s.id === programme.currentStageId
                      ? "border-slate-700 bg-slate-950"
                      : "border-slate-800 bg-slate-900/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{STATUS_ICON[s.status]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-slate-100">
                          {s.ordinal}. {s.label}
                        </span>
                        <span className="text-slate-500">{STATUS_LABEL[s.status]}</span>
                        <span
                          className={
                            s.workKind === "governance" ? "text-violet-300" : "text-cyan-300"
                          }
                        >
                          {s.workKind}
                        </span>
                      </div>
                      <div className="text-slate-400">{s.does}</div>
                      <div className="mt-0.5 text-slate-500">{s.detail}</div>
                      {s.remedies.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {s.remedies.map((r, i) => (
                            <li
                              key={i}
                              className="rounded border border-amber-500/20 bg-amber-500/5 p-1.5 text-amber-100"
                            >
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-1 text-[10px] text-slate-600">
                        {s.surface} · {s.actor}
                      </div>
                      <div className="text-[10px] font-mono text-slate-700">{s.capability}</div>

                      {/* STAGE 2 IS WHERE THE WORK IS (EXP agent, 2026-08-02:
                          "What happens when you click Review & Admit?").

                          It reported "41 sources await a human decision" and
                          offered nothing to decide with — orchestration built,
                          operator workflow missing. The queue below calls the
                          EXISTING review route; no admission rule, no
                          ingestion trigger and no status mapping is
                          reimplemented here. */}
                      {s.id === "review-and-admit" && (
                        <CorpusReviewQueue
                          acquisitionDomain={acquisitionDomain}
                          onDone={() => void load()}
                        />
                      )}
                      {/* STAGE 8 IS LOCKED UNTIL ITS PREREQUISITES ARE REAL
                          (Al, 2026-08-02).

                            68 promoted invariants with no recorded evidence
                            provenance + validation not started + relationships
                            not started = Stage 8 is not the next act.

                          Collapsing the stage was not enough: a steward who
                          expands "show all stages" still met an invariant-ID
                          textarea, and pasting IDs there would BYPASS
                          provenance classification, validation and
                          relationship review entirely. A control that can
                          circumvent the stages before it is not a convenience,
                          it is a hole in the ladder.

                          The control now renders only when every earlier stage
                          is complete. Otherwise the card names the stage that
                          IS the next act, so the surface routes the operator
                          to Stage 5 instead of inviting them into Stage 8. */}
                      {s.id === "assign-to-crystal" &&
                        (() => {
                          const blockers = programme.stages.filter(
                            (x) => x.ordinal < s.ordinal && x.status !== "complete",
                          );
                          if (blockers.length === 0) {
                            return <AssignmentControl experimentId={experimentId} onDone={() => void load()} />;
                          }
                          const next = blockers[0];
                          return (
                            <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-100">
                              <strong className="font-medium">Assignment is not the next act.</strong>{" "}
                              {blockers.length === 1 ? "One earlier stage is" : `${blockers.length} earlier stages are`}{" "}
                              incomplete, starting with <strong>{next.ordinal}. {next.label}</strong> — {next.detail}.
                              <div className="mt-1 text-amber-200/80">
                                No control is offered here because assigning now would admit invariants that have not
                                been through provenance classification, validation and relationship review. This is a
                                closed gate, not a missing feature.
                              </div>
                            </div>
                          );
                        })()}
                      {s.id === "freeze" && (
                        <FreezeControl experimentId={experimentId} onDone={() => void load()} />
                      )}
                    </div>
                  </div>
                </li>
                );
              })}
            </ol>

            {(() => {
              const current = programme.stages.find((x) => x.id === programme.currentStageId);
              const lockedCount = current
                ? programme.stages.filter((x) => x.ordinal > current.ordinal && x.status !== "complete").length
                : 0;
              if (lockedCount === 0) return null;
              return (
                <button
                  onClick={() => setShowAllStages((v) => !v)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-800/60"
                >
                  <Lock className="h-3 w-3" />
                  {showAllStages
                    ? `Hide the ${lockedCount} stage(s) that unlock later`
                    : `${lockedCount} remaining stage(s) unlock automatically — show them`}
                </button>
              );
            })()}

            <div className="mt-2 text-[10px] text-slate-600">{programme.derivationNote}</div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * STAGE 2 — the steward review queue (EXP agent + Al, 2026-08-02).
 *
 * ── The gap this closes ────────────────────────────────────────────────────
 *
 *   > "Step 2 currently reports '41 awaiting review' but provides no steward
 *   >  review surface. The Track 2 programme must open the pending Corpus
 *   >  Scout queue so I can review, admit, reject or defer each candidate."
 *
 * Everything downstream of this stage is downstream of these decisions, so an
 * unactionable Stage 2 made the whole programme unactionable.
 *
 * ── What is NOT here ───────────────────────────────────────────────────────
 *
 * No decision logic. The decision vocabulary, the status mapping and the
 * hand-off to the Ingestion Broker all live in
 * `POST /api/corpus-scout/candidates/[sourceId]/review`, which already
 * implements PRD-ICA-001 §6/§8/§9 — approval and ingestion are ONE reviewer
 * action there, and a second copy of that rule here would be the stale one.
 * This component collects a decision and a rationale and posts them.
 *
 * ── Defer is not in the ratified vocabulary ────────────────────────────────
 *
 * Al asked for Admit / Reject / Defer. §8's eleven statuses contain no
 * `deferred`: a source either carries a decision or remains `pending_review`.
 * Leaving it pending IS defer’s effect, and that is what "Leave pending" does —
 * it records nothing and changes nothing, which is exactly why it is not
 * dressed up as a governance act. A real deferral (with its own status,
 * rationale and receipt) is an amendment to PRD-ICA-001 §8 and to the column’s
 * enum, not a button a UI may invent. Reported, not fabricated.
 */
function CorpusReviewQueue({
  acquisitionDomain,
  onDone,
}: {
  acquisitionDomain: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CandidateSource[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recommendations, setRecommendations] = useState<AdmissionRecommendation[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsErr, setRecsErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!acquisitionDomain) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await personaFetch(
        `/api/corpus-scout/candidates?campaignDomain=${encodeURIComponent(acquisitionDomain)}` +
          `&reviewWorkflowStatus=pending_review`,
        { cache: "no-store" },
      );
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `the review queue could not be read (HTTP ${res.status})`);
      setRows((d.candidates ?? []) as CandidateSource[]);
      // A selection is over rows that were in the queue when it was made. After
      // a reload the decided ones have LEFT, so carrying the set forward would
      // hold ids that are no longer selectable and silently understate what a
      // subsequent batch would touch.
      setSelected(new Set());
      // A stale recommendation set is worse than none — a source that just
      // left the queue (decided) or a newly-admitted source's freshly-computed
      // lineage would make an old recommendation set wrong in either
      // direction. Cleared on every reload; the operator re-prepares.
      setRecommendations(null);
    } catch (e) {
      // Unreadable is not empty. An empty list here would read as "nothing to
      // review" on the one surface whose job is to show what is.
      setRows(null);
      setErr(e instanceof Error ? e.message : "the review queue could not be read");
    } finally {
      setLoading(false);
    }
  }, [acquisitionDomain]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  /*
   * PREPARE RECOMMENDATIONS (Track 2 Stage 2, 2026-08-03 operator correction).
   *
   * Calls the read-only `/api/corpus-scout/candidates/prepare-recommendations`
   * route, which aggregates the platform's EXISTING invariant lineage back
   * onto each pending source (`services/corpusScout/admissionRecommendation.ts`
   * — no fresh domain guess, no write). This state holds the PREPARED
   * recommendations only; nothing is admitted until the steward ratifies a
   * cohort below, which posts through the SAME governed `bulk-review` route
   * every manual batch already uses.
   */
  const prepareRecommendations = useCallback(async () => {
    if (!acquisitionDomain) return;
    setRecsLoading(true);
    setRecsErr(null);
    try {
      const res = await personaFetch(
        `/api/corpus-scout/candidates/prepare-recommendations?campaignDomain=${encodeURIComponent(acquisitionDomain)}`,
        { cache: "no-store" },
      );
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `recommendations could not be prepared (HTTP ${res.status})`);
      setRecommendations((d.recommendations ?? []) as AdmissionRecommendation[]);
    } catch (e) {
      setRecommendations(null);
      setRecsErr(e instanceof Error ? e.message : "recommendations could not be prepared");
    } finally {
      setRecsLoading(false);
    }
  }, [acquisitionDomain]);

  /*
   * THE WHOLE CANON, AS A FILE (operator, 2026-08-02).
   *
   *   > "a link to download the json for all the sources in the canon so I can
   *   >  provide the list to Al to assist in filtering"
   *
   * DELIBERATELY NOT the review queue. The queue is the sources awaiting a
   * decision; the canon is every source discovery has produced, whatever its
   * status — filtering advice about a corpus cannot be given from a view that
   * has already dropped the rejected and the admitted.
   *
   * The list projection truncates `normalizedText` to stay under the response
   * cap, so the export SAYS SO in its own envelope. A file that looks complete
   * and is not is worse than one that declares its edges — whoever reads this
   * downstream is entitled to know which fields are whole.
   */
  const exportCanon = useCallback(async () => {
    if (!acquisitionDomain) return;
    setExporting(true);
    setExportErr(null);
    try {
      const res = await personaFetch(
        `/api/corpus-scout/candidates?campaignDomain=${encodeURIComponent(acquisitionDomain)}`,
        { cache: "no-store" },
      );
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `the source canon could not be read (HTTP ${res.status})`);
      const candidates = (d.candidates ?? []) as CandidateSource[];
      const envelope = {
        acquisitionDomain,
        exportedAt: new Date().toISOString(),
        sourceCount: candidates.length,
        byReviewStatus: candidates.reduce<Record<string, number>>((acc, c) => {
          const k = (c as unknown as { reviewWorkflowStatus?: string }).reviewWorkflowStatus ?? "unknown";
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
        completeness:
          "normalizedText is TRUNCATED in this export — the list projection caps it to keep the response " +
          "under the serverless payload limit. normalizedTextChars carries each source's true length. Every " +
          "other field is whole. Nothing has been filtered out: this is every candidate source in the domain, " +
          "at every review status.",
        candidates,
      };
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `corpus-canon-${acquisitionDomain}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : "the source canon could not be exported");
    } finally {
      setExporting(false);
    }
  }, [acquisitionDomain]);

  /*
   * Search over what has been READ, never a second query. A server-side filter
   * would be a parallel implementation of a list this component already holds,
   * and the two would answer differently the moment either changed. Matches
   * across the fields a reviewer actually recognises a source by.
   */
  const q = query.trim().toLowerCase();
  const visible = !rows
    ? null
    : q === ""
      ? rows
      : rows.filter((r) =>
          [r.title, r.issuer ?? "", r.canonicalUrl, r.campaignSubDomain ?? "", r.authors.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(q),
        );

  /*
   * EXACT-DUPLICATE GROUPS, ON THE SURFACE THAT DECIDES (2026-08-03).
   *
   * `findDuplicateCandidates` has existed since Phase 3 and CorpusScoutTab
   * renders it — but the Track 2 review queue, which is where the operator
   * actually decides these forty sources, did not. Admitting both members of a
   * byte-identical pair ingests the same document twice as two evidence rows,
   * and nothing downstream would tell them apart. The SAME function is called
   * here; the grouping is not re-derived (inv.engineering.037).
   */
  const duplicateGroups: DuplicateGroup[] = useMemo(
    () =>
      findDuplicateCandidates(
        (rows ?? []).map((r) => ({
          sourceId: r.sourceId,
          artifactHash: r.artifactHash,
          // The list projection does not carry normalizedTextHash, so this
          // axis genuinely cannot be checked here. Passing null is the honest
          // input — never the artifact hash standing in for it.
          normalizedTextHash: null,
          canonicalUrl: r.canonicalUrl,
        })),
      ),
    [rows],
  );
  const duplicateSourceIds = useMemo(
    () => new Set(duplicateGroups.flatMap((g) => g.sourceIds)),
    [duplicateGroups],
  );
  /** sourceId → row, for the recommendation cohorts to resolve a title/warning
   *  context without re-fetching what `load()` already holds. */
  const rowsById = useMemo(() => new Map((rows ?? []).map((r) => [r.sourceId, r])), [rows]);

  /*
   * ISSUER GROUPS — the shape a batch actually has.
   *
   * The case for bulk is a run of sources from ONE institution where the
   * constitutional judgment is the same for all of them. Grouping by issuer is
   * that case made selectable, and the tier is read from the ratified
   * Institutional Registry (`findRegistryEntry`, keyed by domain + pillar +
   * institution — never institution alone, which would return one pillar's
   * tradition when the source belongs to another). An issuer with no registry
   * entry gets `null`, reported as undeclared rather than assumed
   * authoritative — the same fail-closed posture `assessRegistryDiversity`
   * takes.
   */
  const issuerGroups = useMemo(() => {
    const groups = new Map<string, { issuer: string; tier: SourceTier | null; sourceIds: string[] }>();
    for (const r of visible ?? []) {
      const issuer = r.issuer?.trim();
      if (!issuer) continue;
      const entry = r.campaignSubDomain
        ? findRegistryEntry(r.campaignDomain, r.campaignSubDomain, issuer)
        : null;
      const g = groups.get(issuer) ?? { issuer, tier: entry?.tier ?? null, sourceIds: [] };
      g.sourceIds.push(r.sourceId);
      groups.set(issuer, g);
    }
    return [...groups.values()]
      .filter((g) => g.sourceIds.length > 1)
      .sort((a, b) => b.sourceIds.length - a.sourceIds.length || a.issuer.localeCompare(b.issuer));
  }, [visible]);

  const selectedRows = (rows ?? []).filter((r) => selected.has(r.sourceId));
  const toggle = (sourceId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });

  if (!acquisitionDomain) {
    return (
      <div className="mt-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-400">
        The acquisition domain was not returned by the programme read, so the review queue cannot be opened
        against a domain this surface is sure of. Refresh; if it persists, the Track 2 route is not answering.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-slate-800 bg-slate-900/40 p-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-[11px] font-medium text-slate-200"
      >
        <span>{open ? "Hide the review queue" : "Open the review queue"}</span>
        <span className="font-mono text-[10px] text-slate-500">{acquisitionDomain}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> reading the queue…
            </div>
          )}
          {err && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[11px] text-rose-200">
              {err}
            </div>
          )}
          {rows !== null && (
            <div className="flex flex-wrap items-center gap-2">
              {/* `type="search"` gives the browser's own clear affordance, and
                  autoComplete/spellCheck off keeps the browser from putting a
                  remembered value into a box whose only job is to HIDE rows —
                  a filter nobody typed is indistinguishable from an empty
                  queue. */}
              <input
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search title, issuer, author, URL, sub-domain"
                className="min-w-[12rem] flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
              />
              {q !== "" && (
                <button
                  onClick={() => setQuery("")}
                  className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60"
                >
                  Clear search
                </button>
              )}
              <button
                onClick={() => void exportCanon()}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Download the whole canon (JSON)
              </button>
            </div>
          )}
          {exportErr && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[11px] text-rose-200">
              {exportErr}
            </div>
          )}
          {rows !== null && visible !== null && q !== "" && (
            <div className="text-[10px] text-slate-500">
              {visible.length} of {rows.length} awaiting-decision source(s) match. The search filters this queue
              only — the download is always the whole canon, every status included.
            </div>
          )}
          {/*
            A SEARCH THAT MATCHES NOTHING MUST SAY SO (operator, 2026-08-02,
            14:33: "After I admit the first entry I can't scroll through or
            access the rest ... I need to exit the modal and return").

            With a filter active and no matches, the list rendered NOTHING —
            no rows, no explanation, no way back except unmounting the surface.
            An empty result and an empty queue looked identical, and the
            control that caused it was a text box the operator may not have
            put text into.
          */}
          {rows !== null && visible !== null && visible.length === 0 && rows.length > 0 && (
            <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-100">
              No source matches “{query}”. {rows.length} source(s) are still awaiting a decision — the search is
              hiding them, nothing has been removed. A source you have just decided will not appear here: it has
              left the queue.
              <button
                onClick={() => setQuery("")}
                className="ml-2 rounded border border-amber-500/30 px-2 py-0.5 text-amber-100 hover:bg-amber-500/10"
              >
                Show all {rows.length}
              </button>
            </div>
          )}
          {rows !== null && rows.length === 0 && !loading && (
            <div className="text-[11px] text-slate-400">
              No source is awaiting a decision in this domain. This is a read of the queue, not an assumption —
              sources already decided are not shown here. The canon download still returns every source.
            </div>
          )}
          {/*
            THE QUEUE SCROLLS ITSELF.

            Forty cards rendered inline are only reachable if every ancestor
            happens to let the page grow — inside the cartridge embed that is
            not something this surface can assume, and the operator could not
            reach past the first entries without unmounting and remounting the
            stage. A bounded, self-scrolling region depends on nothing above it.
          */}
          {duplicateGroups.length > 0 && (
            <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-100">
              <strong className="font-medium">
                {duplicateGroups.length} exact-duplicate group(s) in this queue.
              </strong>{" "}
              Byte- or URL-identical only — paraphrases and revised editions are NOT detected, and that judgment
              stays yours. Admitting more than one member of a group ingests the same document twice.
              <ul className="mt-1 space-y-0.5">
                {duplicateGroups.map((g) => (
                  <li key={`${g.matchType}:${g.key}`} className="font-mono text-[10px] text-amber-200/80">
                    {g.matchType}: {g.sourceIds.join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rows !== null && rows.length > 0 && (
            <div className="rounded border border-slate-700 bg-slate-950/40 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-200">
                  Machine-recommended cohorts
                </span>
                <button
                  onClick={() => void prepareRecommendations()}
                  disabled={recsLoading}
                  className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
                >
                  {recsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {recommendations ? "Refresh recommendations" : "Prepare recommendations"}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Aggregates the corpus&rsquo;s EXISTING invariant lineage and this source&rsquo;s own recorded quality
                signals into a proposed admission class and sub-domain per pending source. Writes nothing — the
                steward still ratifies each cohort explicitly below, through the same governed route a manual batch
                uses.
              </p>
              {recsErr && (
                <div className="mt-1.5 rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[11px] text-rose-200">
                  {recsErr}
                </div>
              )}
              {recommendations && (
                <RecommendationCohorts
                  recommendations={recommendations}
                  rowsById={rowsById}
                  duplicateSourceIds={duplicateSourceIds}
                  onDone={() => {
                    void load();
                    onDone();
                  }}
                />
              )}
            </div>
          )}

          {rows !== null && visible !== null && visible.length > 0 && (
            <BulkAdmissionControl
              visible={visible}
              selected={selected}
              selectedRows={selectedRows}
              duplicateSourceIds={duplicateSourceIds}
              issuerGroups={issuerGroups}
              onSelectAllVisible={() => setSelected(new Set(visible.map((r) => r.sourceId)))}
              onSelectIssuer={(ids) => setSelected(new Set(ids))}
              onClearSelection={() => setSelected(new Set())}
              onDone={() => {
                void load();
                onDone();
              }}
            />
          )}

          <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
          {visible?.map((r) => (
            <CandidateReviewCard
              key={r.sourceId}
              row={r}
              selected={selected.has(r.sourceId)}
              onToggleSelected={() => toggle(r.sourceId)}
              isDuplicate={duplicateSourceIds.has(r.sourceId)}
              onDecided={() => {
                void load();
                onDone();
              }}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The fields the list projection returns. `normalizedText` is truncated by the
 *  server (Lambda response cap) — `normalizedTextChars` carries the true
 *  length, so a preview is never mistaken for the whole document. */
interface CandidateSource {
  sourceId: string;
  title: string;
  issuer: string | null;
  authors: string[];
  publicationDate: string | null;
  canonicalUrl: string;
  campaignDomain: string;
  campaignSubDomain: string | null;
  acquisitionMethod: string;
  licenseStatus: string;
  provenanceClass: string | null;
  extractionStatus: string;
  extractionWarnings: string[];
  structuralTags: string[];
  pageCount: number | null;
  fileSizeBytes: number | null;
  artifactHash: string | null;
  normalizedText: string;
  normalizedTextChars?: number;
  duplicateOfSourceId: string | null;
  retrievedAt: string | null;
}

/** §9's decisions, with what each one ACTUALLY does — the two that hand the
 *  source to the Ingestion Broker are marked, because "approve" and "approve
 *  and ingest" are not the same act and the operator is choosing between
 *  them. Taken from APPROVED_FOR_INGESTION, not restated from memory. */
const DECISIONS: {
  value: string;
  label: string;
  kind: "admit" | "reject";
  consequence: string;
}[] = [
  {
    value: "approve_exp_p1",
    label: "Admit — EXP-P1",
    kind: "admit",
    consequence: "Hands the source to the Ingestion Broker as EXP-P1 evidence. This is the admission that feeds the crystal.",
  },
  {
    value: "approve_general_finance",
    label: "Admit — general finance",
    kind: "admit",
    consequence: "Hands the source to the Ingestion Broker as general financial evidence, outside the EXP-P1 lane.",
  },
  {
    value: "approve_reference_only",
    label: "Admit — reference only",
    kind: "admit",
    consequence: "Recorded as admitted for reference. NOT ingested — it will not become evidence.",
  },
  {
    value: "reject_out_of_domain",
    label: "Reject — out of domain",
    kind: "reject",
    consequence: "Outside the ratified acquisition domain.",
  },
  {
    value: "reject_low_substance",
    label: "Reject — low substance",
    kind: "reject",
    consequence: "Too little substantive content to ground an invariant.",
  },
  {
    value: "reject_provenance",
    label: "Reject — provenance",
    kind: "reject",
    consequence: "The source’s provenance cannot be established to the standard the corpus requires.",
  },
  {
    value: "reject_access_or_license",
    label: "Reject — access or licence",
    kind: "reject",
    consequence: "Access or licensing forbids using this source as corpus evidence.",
  },
];

/**
 * IS THIS A TITLE, OR IS IT WHAT THE CRAWLER FOUND WHERE A TITLE SHOULD BE?
 *
 * ── The finding (Al, 2026-08-02, reviewing the canon export) ───────────────
 *
 *   > "BIS titles are duplicated as 'survey of the users of BIS research'
 *   >  CFTC titles appear only as 'PDF' ... I would not admit any CFTC
 *   >  document until the title is resolved."
 *
 * Titles come from the discovery crawler's LINK TEXT, falling back to the URL
 * basename (`deriveTitleFromUrl`). Both are frequently not the document's
 * name — a link labelled "PDF" yields the title "PDF". Rendered plainly, that
 * looks like bibliographic metadata and invites an admission decision made on
 * nothing.
 *
 * This does not repair the title — it cannot, and guessing one would be worse.
 * It marks the ones that are visibly not titles so the steward inspects
 * before deciding, which is the judgement Al actually made by hand.
 */
function titleLooksUnresolved(row: CandidateSource): string | null {
  const t = (row.title ?? "").trim();
  if (!t) return "No title was captured at all.";
  if (/^(pdf|document|download|file|link|here|view)$/i.test(t)) {
    return `“${t}” is link text, not a document title.`;
  }
  // The URL basename fallback — the crawler had no link text to use.
  try {
    const base = decodeURIComponent(new URL(row.canonicalUrl).pathname.split("/").filter(Boolean).pop() ?? "");
    if (base && base.toLowerCase() === t.toLowerCase()) {
      return "This title is the URL filename — no document title was found.";
    }
  } catch {
    // An unparseable URL tells us nothing either way; say nothing.
  }
  if (t.length < 12) return `“${t}” is too short to be a document title.`;
  return null;
}

/**
 * A governance-relevant field and whether it was actually captured.
 *
 * Al's point is that a steward should not have to INFER: a blank row and a row
 * whose publication date genuinely was never extracted look identical, and
 * only one of them is a reason to hesitate. So absence is rendered, not
 * omitted.
 *
 * Fields Corpus Scout does not capture at all today — regulation/programme,
 * document type, jurisdiction, and Corpus Scout's own relevance rationale —
 * are deliberately NOT listed here. Rendering a permanently-empty row for each
 * would be noise pretending to be rigour; they are named once, below the
 * captured fields, as what the pipeline does not yet produce.
 */
function bibliographicFields(row: CandidateSource): { label: string; value: string | null }[] {
  return [
    { label: "Institution", value: row.issuer },
    { label: "Published", value: row.publicationDate },
    { label: "Authors", value: row.authors.length > 0 ? row.authors.join(", ") : null },
    { label: "Pages", value: row.pageCount !== null ? String(row.pageCount) : null },
    { label: "Licence", value: row.licenseStatus && row.licenseStatus !== "unknown" ? row.licenseStatus : null },
  ];
}

/**
 * A GOVERNED batch admission (Track 2 Stage 2, 2026-08-03).
 *
 *   > Stage 2 holds tens of sources and offered only a per-source form.
 *
 * Deciding forty sources one at a time is not more rigorous than deciding them
 * together — past a certain count it is less, because the reviewer stops
 * reading. This control makes the batch an EXPLICIT act with one stated
 * rationale and one receipt, rather than forty unreceipted repetitions.
 *
 * It relaxes nothing. The route it posts to loops the SAME
 * `applyCandidateReviewDecision` the single-source route calls, so every
 * refusal is identical. What this component adds is the two-step posture the
 * crystal-assignment control already uses:
 *
 *   1. INSPECT (`dryRun: true`, the server's own default) — reports what each
 *      source's status is now and what the batch WOULD do to it, writing
 *      nothing.
 *   2. RECORD — enabled only after an inspection has been seen and a rationale
 *      entered. Never the first thing a click can do.
 *
 * Per-source outcomes are rendered individually, including ingestion failures,
 * so a batch is never summarised as "succeeded" when a member did not.
 */
function BulkAdmissionControl({
  visible,
  selected,
  selectedRows,
  duplicateSourceIds,
  issuerGroups,
  onSelectAllVisible,
  onSelectIssuer,
  onClearSelection,
  onDone,
  initialDecision,
  initialProvenanceClass,
  initialNotes,
}: {
  visible: CandidateSource[];
  selected: Set<string>;
  selectedRows: CandidateSource[];
  duplicateSourceIds: Set<string>;
  issuerGroups: { issuer: string; tier: SourceTier | null; sourceIds: string[] }[];
  onSelectAllVisible: () => void;
  onSelectIssuer: (sourceIds: string[]) => void;
  onClearSelection: () => void;
  onDone: () => void;
  /*
   * PRESELECTION, for a caller that already knows what this batch should be
   * (the machine-recommended cohorts, `RecommendationCohorts` below). Nothing
   * here changes the write path or its refusals — a preselected decision is
   * still just the `decision` state's initial value, still requires the SAME
   * Inspect-then-Record steps, and the operator can change it before either
   * click. Manual bulk-admission callers omit these and get the pre-existing
   * blank-start behaviour unchanged.
   */
  initialDecision?: string;
  initialProvenanceClass?: string;
  initialNotes?: string;
}) {
  const [decision, setDecision] = useState(initialDecision ?? "");
  const [provenanceClass, setProvenanceClass] = useState(initialProvenanceClass ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  const chosen = DECISIONS.find((d) => d.value === decision) ?? null;
  const requiresProvenanceClass = chosen?.consequence.includes("Ingestion Broker") ?? false;
  // An inspection is only an inspection OF the current selection and decision.
  // Changing either invalidates it, so the record button re-locks rather than
  // letting a stale dry run authorise a different act.
  const inspection =
    result && result.dryRun && result.decision === decision && result.requested === selected.size ? result : null;

  const selectedDuplicates = selectedRows.filter((r) => duplicateSourceIds.has(r.sourceId));

  const post = useCallback(
    async (dryRun: boolean) => {
      if (selected.size === 0 || !chosen) return;
      setBusy(true);
      setErr(null);
      try {
        const res = await personaFetch("/api/corpus-scout/candidates/bulk-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceIds: [...selected],
            decision: chosen.value,
            notes: notes.trim(),
            provenanceClass: provenanceClass || undefined,
            dryRun,
          }),
        });
        const d = await res.json().catch(() => null);
        if (!d?.ok) throw new Error(d?.error || `the batch was not processed (HTTP ${res.status})`);
        setResult(d as BulkResult);
        if (!dryRun) onDone();
      } catch (e) {
        setErr(
          e instanceof Error
            ? e.message
            : "the batch was not processed — every source in it is still at whatever status it already had",
        );
      } finally {
        setBusy(false);
      }
    },
    [selected, chosen, notes, provenanceClass, onDone],
  );

  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-200">
          {selected.size} selected of {visible.length} shown
        </span>
        <button
          onClick={onSelectAllVisible}
          className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-slate-300 hover:bg-slate-800/60"
        >
          Select all shown
        </button>
        {selected.size > 0 && (
          <button
            onClick={onClearSelection}
            className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-slate-300 hover:bg-slate-800/60"
          >
            Clear selection
          </button>
        )}
      </div>

      {issuerGroups.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-500">by institution:</span>
          {issuerGroups.map((g) => (
            <button
              key={g.issuer}
              onClick={() => onSelectIssuer(g.sourceIds)}
              title={
                g.tier
                  ? `${g.issuer} — ${g.tier} in the ratified Institutional Registry`
                  : `${g.issuer} — no tier declared in the ratified Institutional Registry for this pillar. Undeclared is never counted as an authority.`
              }
              className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800/60"
            >
              {g.issuer} ({g.sourceIds.length})
              <span className={g.tier === "institutional-authority" ? " text-emerald-300" : " text-slate-500"}>
                {" "}
                {g.tier ?? "tier undeclared"}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected.size === 0 ? (
        <p className="mt-1 text-[10px] text-slate-500">
          Tick sources to decide them together under one rationale and one receipt. Each is still recorded
          individually, through the same route and the same refusals as a single decision.
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {selectedDuplicates.length > 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-100">
              {selectedDuplicates.length} selected source(s) belong to an exact-duplicate group. Admitting more than
              one member ingests the same document twice — this is not blocked, because only you can say which copy
              is canonical.
            </div>
          )}
          <select
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value);
              setResult(null);
            }}
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200"
          >
            <option value="">— one decision, applied to every selected source —</option>
            {DECISIONS.filter((d) => d.value !== "mark_duplicate").map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          {chosen && <div className="text-[10px] text-slate-400">{chosen.consequence}</div>}
          {requiresProvenanceClass && (
            <select
              value={provenanceClass}
              onChange={(e) => {
                setProvenanceClass(e.target.value);
                setResult(null);
              }}
              className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200"
            >
              <option value="">
                — provenance class (required; every source in the batch is admitted under this one class) —
              </option>
              {PROVENANCE_CLASSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="rationale (required to record — written onto every source in the batch and carried on the receipt)"
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => void post(true)}
              disabled={busy || !chosen || (requiresProvenanceClass && !provenanceClass)}
              className="rounded border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-slate-200 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Inspect (writes nothing)"}
            </button>
            <button
              onClick={() => void post(false)}
              disabled={busy || !inspection || !notes.trim()}
              title={
                !inspection
                  ? "Inspect the batch first — the record button only unlocks against an inspection of this exact selection and decision"
                  : !notes.trim()
                    ? "A rationale is required to record"
                    : undefined
              }
              className="rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 text-emerald-200 disabled:opacity-50"
            >
              Record {selected.size} decision(s)
            </button>
          </div>
        </div>
      )}

      {err && <div className="mt-1.5 rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>}

      {result && (
        <div className="mt-2 space-y-1 rounded border border-slate-800 bg-slate-950 p-2">
          <div className={result.dryRun ? "text-slate-300" : "text-emerald-200"}>
            {result.dryRun
              ? `Inspection — ${result.requested} source(s) would be recorded as this decision. Nothing has been written.`
              : `${result.written} of ${result.requested} recorded.`}
            {!result.dryRun && result.ingestionFailures > 0 && (
              <span className="text-amber-200">
                {" "}
                {result.ingestionFailures} admitted WITHOUT becoming evidence — the Ingestion Broker hand-off failed.
              </span>
            )}
            {!result.dryRun && (
              <span className={result.receiptWritten ? " text-slate-400" : " text-amber-200"}>
                {" "}
                {result.receiptWritten ? "Batch receipt written." : (result.receiptWarning ?? "No batch receipt.")}
              </span>
            )}
          </div>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {result.outcomes.map((o) => (
              <li
                key={o.sourceId}
                className={o.ingested === false || (!o.decided && !result.dryRun) ? "text-amber-200" : "text-slate-400"}
              >
                <span className="font-mono text-[10px]">{o.sourceId}</span> — {o.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * MACHINE-RECOMMENDED COHORTS (Track 2 Stage 2, 2026-08-03 operator
 * correction — "prepare the decision, don't just execute one the operator
 * already made").
 *
 * Groups the prepared `AdmissionRecommendation`s by (admission class,
 * primary sub-domain) — the same shape the operator asked for: "EXP-P1
 * evidence — market integrity: 8", "Reference only: 5", etc. Each cohort maps
 * to exactly ONE `bulk-review` POST when ratified, because every member
 * already shares one recommended decision; the sub-domain is display context,
 * not something `bulk-review` accepts or needs.
 *
 * NO WRITE happens here. Ratifying a cohort renders the EXISTING
 * `BulkAdmissionControl` (preseeded, never auto-submitted) — the same
 * Inspect-then-Record steps, the same refusals, the same route. A `manual
 * review required` cohort offers NO ratify control at all: there is no
 * decision to preseed, so the steward decides those individually below.
 */
function RecommendationCohorts({
  recommendations,
  rowsById,
  duplicateSourceIds,
  onDone,
}: {
  recommendations: AdmissionRecommendation[];
  rowsById: Map<string, CandidateSource>;
  duplicateSourceIds: Set<string>;
  onDone: () => void;
}) {
  // A source may be MOVED to a different EXISTING cohort (never a fabricated
  // one — the move selector only ever offers cohort keys the recommendation
  // pass itself produced) or REMOVED from cohort ratification entirely (it
  // stays in the ordinary per-source queue below, to be decided by hand).
  const [moves, setMoves] = useState<Map<string, string>>(new Map());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const naturalCohortKey = useCallback(
    (r: AdmissionRecommendation) => `${r.admissionClass}::${r.primarySubDomain ?? ""}`,
    [],
  );

  const cohortMeta = useMemo(() => {
    const m = new Map<string, { admissionClass: RecommendedAdmissionClass; primarySubDomain: string | null }>();
    for (const r of recommendations) {
      const key = naturalCohortKey(r);
      if (!m.has(key)) m.set(key, { admissionClass: r.admissionClass, primarySubDomain: r.primarySubDomain });
    }
    return m;
  }, [recommendations, naturalCohortKey]);

  const cohorts = useMemo(() => {
    const groups = new Map<string, AdmissionRecommendation[]>();
    for (const r of recommendations) {
      if (excluded.has(r.sourceId)) continue;
      const key = moves.get(r.sourceId) ?? naturalCohortKey(r);
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return [...groups.entries()]
      .map(([key, members]) => {
        const meta = cohortMeta.get(key)!;
        return { key, admissionClass: meta.admissionClass, primarySubDomain: meta.primarySubDomain, members };
      })
      .sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));
  }, [recommendations, moves, excluded, naturalCohortKey, cohortMeta]);

  const allCohortKeys = useMemo(() => [...cohortMeta.keys()], [cohortMeta]);

  if (cohorts.length === 0) {
    return <p className="mt-1.5 text-[10px] text-slate-500">No pending source produced a recommendation.</p>;
  }

  return (
    <div className="mt-2 space-y-1.5">
      {cohorts.map((c) => (
        <CohortCard
          key={c.key}
          cohortKey={c.key}
          admissionClass={c.admissionClass}
          primarySubDomain={c.primarySubDomain}
          members={c.members}
          rowsById={rowsById}
          duplicateSourceIds={duplicateSourceIds}
          allCohortKeys={allCohortKeys}
          onMoveSource={(sourceId, targetKey) => setMoves((prev) => new Map(prev).set(sourceId, targetKey))}
          onExcludeSource={(sourceId) => setExcluded((prev) => new Set(prev).add(sourceId))}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

const REVIEW_TIER_LABEL: Record<AdmissionRecommendation["reviewTier"], string> = {
  "auto-include": "auto-include",
  "needs-review": "needs review",
  exception: "exception",
};

function CohortCard({
  cohortKey,
  admissionClass,
  primarySubDomain,
  members,
  rowsById,
  duplicateSourceIds,
  allCohortKeys,
  onMoveSource,
  onExcludeSource,
  onDone,
}: {
  cohortKey: string;
  admissionClass: RecommendedAdmissionClass;
  primarySubDomain: string | null;
  members: AdmissionRecommendation[];
  rowsById: Map<string, CandidateSource>;
  duplicateSourceIds: Set<string>;
  allCohortKeys: string[];
  onMoveSource: (sourceId: string, targetCohortKey: string) => void;
  onExcludeSource: (sourceId: string) => void;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const memberIds = useMemo(() => members.map((m) => m.sourceId).join(","), [members]);
  const rows = useMemo(
    () => members.map((m) => rowsById.get(m.sourceId)).filter((r): r is CandidateSource => Boolean(r)),
    [members, rowsById],
  );
  // Selection defaults to "every member" and re-defaults whenever the cohort's
  // OWN membership changes (a move or exclusion elsewhere) — a stale
  // selection from before a move would silently under- or over-state what
  // "Record" is about to touch.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.sourceId)));
  useEffect(() => {
    setSelected(new Set(memberIds ? memberIds.split(",") : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds]);

  const avgConfidence = members.reduce((sum, m) => sum + m.confidence, 0) / members.length;
  const tierCounts = members.reduce(
    (acc, m) => {
      acc[m.reviewTier] += 1;
      return acc;
    },
    { "auto-include": 0, "needs-review": 0, exception: 0 } as Record<AdmissionRecommendation["reviewTier"], number>,
  );

  if (admissionClass === "manual review required") {
    return (
      <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-100">
        <strong className="font-medium">{members.length} source(s) need manual review</strong> — the recommendation
        pass offers no decision for these; a canonical-copy choice, a borderline extraction, or an unverifiable
        artifact hash all require a steward's own judgement. Decide these individually in the queue below.
        <ul className="mt-1 space-y-0.5">
          {members.map((m) => (
            <li key={m.sourceId} className="font-mono text-[10px] text-amber-200/80">
              {rowsById.get(m.sourceId)?.title ?? m.sourceId} — {m.warnings.join(" ") || "see rationale"}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const suggestedNotes =
    `Machine-recommended batch — ${members.length} source(s) recommended '${admissionClass}'` +
    (primarySubDomain ? ` (sub-domain '${primarySubDomain}')` : "") +
    ` by the Track 2 admission-recommendation pass, average confidence ${avgConfidence.toFixed(2)}. ` +
    `Reviewed and ratified by the steward before recording.`;

  return (
    <div className="rounded border border-slate-700 bg-slate-950/60 p-2 text-[11px]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="font-medium text-slate-100">
          {admissionClass}
          {primarySubDomain ? ` — ${primarySubDomain}` : ""}: {members.length}
        </span>
        <span className="text-[10px] text-slate-500">
          avg confidence {avgConfidence.toFixed(2)} · {tierCounts["auto-include"]} auto-include ·{" "}
          {tierCounts["needs-review"]} needs review · {tierCounts.exception} exception
        </span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          <ul className="space-y-1">
            {members.map((m) => (
              <li key={m.sourceId} className="flex flex-wrap items-start justify-between gap-2 rounded border border-slate-800 bg-slate-950 p-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-slate-200">{rowsById.get(m.sourceId)?.title ?? m.sourceId}</div>
                  <div className="text-[10px] text-slate-500">
                    confidence {m.confidence.toFixed(2)} · {REVIEW_TIER_LABEL[m.reviewTier]}
                    {m.provisional ? " · PROVISIONAL (no corpus lineage)" : ""}
                    {duplicateSourceIds.has(m.sourceId) ? " · in a duplicate group" : ""}
                  </div>
                  {m.warnings.length > 0 && (
                    <div className="text-[10px] text-amber-200">{m.warnings.join(" ")}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) onMoveSource(m.sourceId, e.target.value);
                    }}
                    className="rounded border border-slate-800 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-300"
                    aria-label={`move ${m.sourceId} to a different cohort`}
                  >
                    <option value="">move to…</option>
                    {allCohortKeys
                      .filter((k) => k !== cohortKey)
                      .map((k) => (
                        <option key={k} value={k}>
                          {k.replace("::", " — ") || "(uncategorised)"}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => onExcludeSource(m.sourceId)}
                    title="Decide this source individually instead — remove it from cohort ratification"
                    className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800/60"
                  >
                    remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <BulkAdmissionControl
            visible={rows}
            selected={selected}
            selectedRows={rows.filter((r) => selected.has(r.sourceId))}
            duplicateSourceIds={duplicateSourceIds}
            // Institution chips are the manual-selection control's own
            // organising axis; a cohort is already organised by the
            // recommendation, so re-surfacing them here would offer a second,
            // conflicting way to reshape a selection this card already made.
            issuerGroups={[]}
            onSelectAllVisible={() => setSelected(new Set(rows.map((r) => r.sourceId)))}
            onSelectIssuer={() => {}}
            onClearSelection={() => setSelected(new Set())}
            initialDecision={RECOMMENDATION_TO_REVIEW_DECISION[admissionClass] ?? ""}
            initialNotes={suggestedNotes}
            onDone={onDone}
          />
        </div>
      )}
    </div>
  );
}

interface BulkResult {
  dryRun: boolean;
  decision: string;
  requested: number;
  decided: number;
  written: number;
  ingestionFailures: number;
  receiptWritten: boolean;
  receiptWarning: string | null;
  outcomes: {
    sourceId: string;
    priorStatus: string | null;
    decided: boolean;
    written: boolean;
    ingested: boolean | null;
    detail: string;
  }[];
}

function CandidateReviewCard({
  row,
  selected,
  onToggleSelected,
  isDuplicate,
  onDecided,
}: {
  row: CandidateSource;
  selected: boolean;
  onToggleSelected: () => void;
  isDuplicate: boolean;
  onDecided: () => void;
}) {
  const [decision, setDecision] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [provenanceClass, setProvenanceClass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ label: string; ingestionFailed: boolean; ingestionError?: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const chosen = DECISIONS.find((d) => d.value === decision) ?? null;
  // The two decisions PRD-ICA-001 §6/§11 hand to the Ingestion Broker are the
  // ones whose consequence text says so — read from the same copy the
  // reviewer sees rather than restating the vocabulary
  // (services/corpusScout/reviewDecision.ts::INGESTING_DECISIONS is the
  // server-side authority; this is UI-only, not a second rule).
  const requiresProvenanceClass = chosen?.consequence.includes("Ingestion Broker") ?? false;

  const submit = useCallback(async () => {
    if (!chosen || !notes.trim()) return;
    if (requiresProvenanceClass && !provenanceClass) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await personaFetch(
        `/api/corpus-scout/candidates/${encodeURIComponent(row.sourceId)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: chosen.value,
            notes: notes.trim(),
            provenanceClass: provenanceClass || undefined,
          }),
        },
      );
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `the decision was not recorded (HTTP ${res.status})`);
      // `ok: true` reports the DECISION was recorded — it says nothing about
      // whether ingestion (the actual evidence hand-off) succeeded. Checking
      // only the outer `ok` here previously let an ingestion failure pass as
      // a plain success (2026-08-03 fix — see reviewDecision.ts's module doc).
      const ingestion = d.ingestion as { ok: boolean; error?: string } | undefined;
      setDone({
        label: chosen.label,
        ingestionFailed: Boolean(ingestion && !ingestion.ok),
        ingestionError: ingestion && !ingestion.ok ? ingestion.error : undefined,
      });
      onDecided();
    } catch (e) {
      // A failed decision leaves the source PENDING and says so — the operator
      // must never be left thinking they decided something they did not.
      setErr(e instanceof Error ? e.message : "the decision was not recorded — this source is still pending");
    } finally {
      setBusy(false);
    }
  }, [chosen, notes, provenanceClass, requiresProvenanceClass, row.sourceId, onDecided]);

  if (done) {
    if (done.ingestionFailed) {
      return (
        <div className="rounded border border-amber-600/50 bg-amber-950/20 p-2 text-[11px] text-amber-100">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          {row.title} — recorded as {done.label}, but the Ingestion Broker hand-off FAILED: {done.ingestionError}.
          This source is no longer pending review, and it is not yet evidence — it left the queue without becoming
          the thing its own decision label claims.
        </div>
      );
    }
    return (
      <div className="rounded border border-emerald-800/50 bg-emerald-950/20 p-2 text-[11px] text-emerald-200">
        <CheckCircle2 className="mr-1 inline h-3 w-3" />
        {row.title} — {done.label}. Recorded with your rationale.
      </div>
    );
  }

  return (
    <div
      className={`rounded border bg-slate-950/60 p-2 text-[11px] ${
        selected ? "border-emerald-800/60" : "border-slate-800"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`select ${row.title} for a batch decision`}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-100">{row.title}</div>
          {isDuplicate && (
            <div className="mt-0.5 text-[10px] text-amber-200">
              In an exact-duplicate group — another source in this queue is byte- or URL-identical.
            </div>
          )}
        </div>
      </div>
      {(() => {
        const unresolved = titleLooksUnresolved(row);
        return unresolved ? (
          <div className="mt-1 rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-[11px] text-amber-100">
            <strong className="font-medium">The title is unresolved.</strong> {unresolved} Corpus Scout takes
            titles from the link text it followed, or from the URL when there was none — neither is the
            document&rsquo;s own name. Open the source and confirm what this document is before admitting it.
          </div>
        ) : null;
      })()}
      {/* Every governance-relevant field, INCLUDING the ones with no value.
          A blank row and a row whose date was never extracted look identical
          otherwise, and only one of them is a reason to hesitate. */}
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
        {bibliographicFields(row).map((f) => (
          <React.Fragment key={f.label}>
            <dt className="text-slate-500">{f.label}</dt>
            <dd className={f.value ? "text-slate-300" : "text-slate-600 italic"}>
              {f.value ?? "not captured"}
            </dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="mt-0.5 text-[10px] text-slate-500">
        {row.campaignDomain}
        {row.campaignSubDomain ? ` / ${row.campaignSubDomain}` : ""} · acquired via {row.acquisitionMethod} ·
        licence {row.licenseStatus} · extraction {row.extractionStatus}
        {row.pageCount !== null ? ` · ${row.pageCount}pp` : ""}
      </div>
      <a
        href={row.canonicalUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-0.5 block truncate font-mono text-[10px] text-cyan-300 hover:underline"
      >
        {row.canonicalUrl}
      </a>

      {/* Warnings the retrieval and inspection steps already produced. Shown
          on the decision surface because they are what a reviewer is meant to
          weigh, and they were previously only visible to a curl caller. */}
      {row.extractionWarnings.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {row.extractionWarnings.map((w, i) => (
            <li key={i} className="rounded border border-amber-500/20 bg-amber-500/5 p-1 text-amber-100">
              {w}
            </li>
          ))}
        </ul>
      )}
      {row.duplicateOfSourceId && (
        <div className="mt-1 rounded border border-amber-500/20 bg-amber-500/5 p-1 text-amber-100">
          Already flagged as a duplicate of <span className="font-mono">{row.duplicateOfSourceId}</span>.
        </div>
      )}
      {row.structuralTags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {row.structuralTags.map((t) => (
            <span key={t} className="rounded border border-slate-800 px-1 py-0.5 text-[10px] text-slate-400">
              {t}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 text-[10px] text-slate-400 underline-offset-2 hover:underline"
      >
        {expanded ? "Hide extracted text" : "Preview extracted text"}
      </button>
      {expanded && (
        <div className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-950 p-1.5 text-[10px] leading-relaxed text-slate-400">
          {row.normalizedText || "(no text was extracted)"}
          {typeof row.normalizedTextChars === "number" &&
            row.normalizedTextChars > row.normalizedText.length && (
              <div className="mt-1 text-slate-600">
                Preview only — {row.normalizedText.length} of {row.normalizedTextChars} characters. The full text
                is held server-side; this list is truncated to stay under the response cap.
              </div>
            )}
        </div>
      )}

      <div className="mt-2 space-y-1.5">
        {/* Said once, plainly, rather than rendered as five empty rows.
            A steward is entitled to know the difference between "this document
            has no jurisdiction" and "we never extract jurisdiction". */}
        <p className="text-[10px] leading-relaxed text-slate-600">
          Corpus Scout does not yet capture regulation or programme, document type, jurisdiction, or its own
          reason for believing this source is relevant. Those are absent from every row, not just this one —
          judge from the title, the issuer and the extracted text.
        </p>
        <select
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
        >
          <option value="">— choose a decision —</option>
          {DECISIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        {chosen && <div className="text-[10px] text-slate-400">{chosen.consequence}</div>}
        {requiresProvenanceClass && (
          <select
            value={provenanceClass}
            onChange={(e) => setProvenanceClass(e.target.value)}
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
          >
            <option value="">— provenance class (required — the Ingestion Broker refuses without one) —</option>
            {PROVENANCE_CLASSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="rationale (required — recorded on the source as the reviewer's note)"
          className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => void submit()}
            disabled={busy || !chosen || !notes.trim() || (requiresProvenanceClass && !provenanceClass)}
            className={`rounded border px-2.5 py-1 text-[11px] disabled:opacity-50 ${
              chosen?.kind === "reject"
                ? "border-rose-800 bg-rose-900/30 text-rose-200"
                : "border-emerald-800 bg-emerald-900/30 text-emerald-200"
            }`}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Record decision"}
          </button>
          <span className="text-[10px] text-slate-500">
            Leave pending — take no action. There is no ratified `deferred` status; a source with no decision
            stays in this queue, which is what deferring means here.
          </span>
        </div>
        {err && (
          <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Guided crystal assignment. Dry run is the DEFAULT and the only thing the
 * first button does — the server also defaults `dryRun` to true, so a forgotten
 * flag inspects rather than writes. The admit button is disabled until a dry
 * run has been seen and a rationale entered.
 */
function AssignmentControl({ experimentId, onDone }: { experimentId: string; onDone: () => void }) {
  const [idsText, setIdsText] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    dryRun: boolean;
    admitted: number;
    refused: number;
    written: number;
    notFound: string[];
    outcomes: AssignmentOutcome[];
    receiptWritten: boolean;
    receiptWarning?: string;
  } | null>(null);

  const invariantIds = idsText
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const run = useCallback(
    async (dryRun: boolean) => {
      setBusy(true);
      setErr(null);
      try {
        const res = await personaFetch(
          `/api/research/crystal/${encodeURIComponent(experimentId)}/assign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invariantIds, dryRun, ...(dryRun ? {} : { rationale }) }),
          },
        );
        const d = await res.json().catch(() => null);
        if (!d?.requestSucceeded) throw new Error(d?.error || `assignment failed (HTTP ${res.status})`);
        setResult(d);
        if (!dryRun) onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "the assignment could not be evaluated");
      } finally {
        setBusy(false);
      }
    },
    [experimentId, invariantIds, rationale, onDone],
  );

  const dryRunSeen = result?.dryRun === true;

  return (
    <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2">
      <textarea
        value={idsText}
        onChange={(e) => {
          setIdsText(e.target.value);
          setResult(null);
        }}
        rows={2}
        placeholder="invariant ids, whitespace or comma separated"
        className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
      />
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        placeholder="why these invariants are admitted (required to write — recorded on the assignment receipt)"
        className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
      />
      <div className="flex gap-1.5">
        <button
          onClick={() => void run(true)}
          disabled={busy || invariantIds.length === 0}
          className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Dry run"}
        </button>
        <button
          onClick={() => void run(false)}
          disabled={busy || !dryRunSeen || !rationale.trim() || (result?.admitted ?? 0) === 0}
          className="rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 text-[11px] text-emerald-200 disabled:opacity-50"
        >
          Admit to crystal
        </button>
      </div>

      {err && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[11px] text-rose-200">{err}</div>
      )}

      {result && (
        <div className="space-y-1 text-[11px]">
          <div className="text-slate-300">
            {result.dryRun ? "DRY RUN — nothing written. " : "Written. "}
            {result.admitted} admitted · {result.refused} refused
            {!result.dryRun && ` · ${result.written} context row(s) written`}
            {!result.dryRun && (
              <span className={result.receiptWritten ? " text-emerald-300" : " text-amber-200"}>
                {result.receiptWritten ? " · receipted" : " · RECEIPT FAILED"}
              </span>
            )}
          </div>
          {result.receiptWarning && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-100">
              {result.receiptWarning}
            </div>
          )}
          {result.notFound.length > 0 && (
            <div className="text-amber-200">not found: {result.notFound.join(", ")}</div>
          )}
          <ul className="space-y-1">
            {result.outcomes.map((o) => (
              <li
                key={o.invariantId}
                className={`rounded border p-1.5 ${
                  o.admitted ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"
                }`}
              >
                <span className="font-mono text-slate-400">{o.invariantId}</span>{" "}
                <span className={o.admitted ? "text-emerald-300" : "text-amber-200"}>
                  {o.admitted ? "admitted" : o.refusals.join(", ")}
                </span>
                <div className="text-slate-500">{o.detail}</div>
                <div className="text-[10px] text-slate-600">
                  prior domains: {o.priorDomains.join(", ") || "none"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The freeze ceremony.
 *
 * THE BOUNDARY IS RENDERED, NEVER TYPED. The server reads it from the ratified
 * declaration and returns it as immutable text; the operator confirms this
 * exact boundary. There is no field here that can change it — a different
 * boundary requires a formal amendment to the domain declaration.
 *
 * THE HASH SUBMITTED IS THE ONE SHOWN. The freeze posts the `contentHash` the
 * preview returned, and the server recomputes and refuses a mismatch. Nothing
 * here recomputes or substitutes a hash.
 */
function FreezeControl({ experimentId, onDone }: { experimentId: string; onDone: () => void }) {
  const [operatorRef, setOperatorRef] = useState("");
  const [reviewerRef, setReviewerRef] = useState("");
  const [rationale, setRationale] = useState("");
  const [boundaryAcknowledged, setBoundaryAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<RatifiedBoundary | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [frozen, setFrozen] = useState<{ receiptId: string | null; invariantCount: number } | null>(null);

  const call = useCallback(
    async (path: string, body: Record<string, unknown>, successField: "ok" | "requestSucceeded") => {
      const res = await personaFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!d?.[successField]) {
        // The server's own words win. A mismatch refusal names both hashes.
        throw new Error(
          [d?.error, d?.currentContentHash ? `current: ${d.currentContentHash}` : null]
            .filter(Boolean)
            .join(" — ") || `request failed (HTTP ${res.status})`,
        );
      }
      return d as Record<string, unknown>;
    },
    [],
  );

  const runPreview = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setFrozen(null);
    try {
      const d = await call(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze-preview`,
        {
          operatorRef,
          reviewerRef: reviewerRef || undefined,
          freezeRationale: rationale,
          ratifiedAt: new Date().toISOString(),
          // domainBoundary is deliberately NOT sent — the route refuses it.
        },
        "ok",
      );
      const pkg = d.package as { contentHash: string; eligibleForRatification: boolean };
      setBoundary(d.ratifiedBoundary as RatifiedBoundary);
      setContentHash(pkg.contentHash);
      setEligible(pkg.eligibleForRatification);
      setExecution(d.execution as Execution);
      setBoundaryAcknowledged(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the freeze preview could not be built");
    } finally {
      setBusy(false);
    }
  }, [call, experimentId, operatorRef, reviewerRef, rationale]);

  const provision = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await call(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze`,
        { action: "provision" },
        "requestSucceeded",
      );
      await runPreview();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the artifact could not be provisioned");
    } finally {
      setBusy(false);
    }
  }, [call, experimentId, runPreview, onDone]);

  const freeze = useCallback(async () => {
    if (!contentHash) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await call(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze`,
        {
          action: "freeze",
          confirm: true,
          contentHash,
          signedBy: [operatorRef, reviewerRef].filter(Boolean),
          freezeRationale: rationale,
        },
        "requestSucceeded",
      );
      setFrozen({
        receiptId: (d.receiptId as string | null) ?? null,
        invariantCount: Number(d.invariantCount ?? 0),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the freeze was refused");
    } finally {
      setBusy(false);
    }
  }, [call, experimentId, contentHash, operatorRef, reviewerRef, rationale, onDone]);

  return (
    <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="grid gap-1.5 sm:grid-cols-2">
        <input
          value={operatorRef}
          onChange={(e) => setOperatorRef(e.target.value)}
          placeholder="operator reference (T2-safe, never a persona UUID)"
          className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
        />
        <input
          value={reviewerRef}
          onChange={(e) => setReviewerRef(e.target.value)}
          placeholder="reviewer reference (optional)"
          className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
        />
      </div>
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        placeholder="why this freeze, now — the ratifying words"
        className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
      />

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => void runPreview()}
          disabled={busy || !operatorRef.trim() || !rationale.trim()}
          className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Preview package"}
        </button>
        <button
          onClick={() => void provision()}
          disabled={busy}
          className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300 disabled:opacity-50"
        >
          Provision artifact
        </button>
        <button
          onClick={() => void freeze()}
          disabled={
            busy ||
            !contentHash ||
            !boundaryAcknowledged ||
            eligible !== true ||
            execution?.wouldFreezeSucceed !== true
          }
          className="flex items-center gap-1 rounded border border-violet-800 bg-violet-900/30 px-2.5 py-1 text-violet-200 disabled:opacity-50"
        >
          <Lock className="h-3 w-3" /> Freeze
        </button>
      </div>

      {err && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>
      )}

      {boundary && (
        <div className="rounded border border-slate-700 bg-slate-950 p-2">
          <div className="mb-1 text-slate-500">
            Ratified domain boundary — <span className="text-slate-300">immutable</span>, read from the
            declaration. You confirm it; you do not reproduce it.
          </div>
          <div className="text-slate-200">{boundary.boundary}</div>
          {boundary.exclusions.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-slate-400">
              {boundary.exclusions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
          <div className="mt-1 text-[10px] text-slate-600">
            ratified by {boundary.ratifiedBy ?? "—"} on {boundary.ratifiedAt ?? "—"} · declaration{" "}
            <span className="font-mono">{boundary.declarationHash.slice(0, 16)}…</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-600">{boundary.amendedBy}</div>
          <label className="mt-1.5 flex items-center gap-1.5 text-slate-200">
            <input
              type="checkbox"
              checked={boundaryAcknowledged}
              onChange={(e) => setBoundaryAcknowledged(e.target.checked)}
            />
            I ratify this exact boundary
          </label>
        </div>
      )}

      {contentHash && (
        <div className="text-slate-400">
          content commitment <span className="font-mono text-slate-200">{contentHash.slice(0, 24)}…</span> ·
          evidence eligible:{" "}
          <span className={eligible ? "text-emerald-300" : "text-amber-200"}>{String(eligible)}</span>
        </div>
      )}

      {execution && (
        <ul className="space-y-0.5">
          {execution.preconditions.map((p) => (
            <li key={p.name} className={p.satisfied ? "text-slate-500" : "text-amber-200"}>
              {p.satisfied ? "✓" : "○"} {p.name} — {p.detail}
              {p.remedy && <div className="text-[10px] text-slate-500">{p.remedy}</div>}
            </li>
          ))}
        </ul>
      )}

      {frozen && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-200">
          Frozen — {frozen.invariantCount} invariant(s) committed. Receipt{" "}
          <span className="font-mono">{frozen.receiptId ?? "—"}</span>. Publication as canonical is a separate
          act and is out of scope for EXP-P1.
        </div>
      )}
    </div>
  );
}
