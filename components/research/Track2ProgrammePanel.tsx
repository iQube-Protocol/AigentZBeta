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

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

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
                      {s.id === "assign-to-crystal" && (
                        <AssignmentControl experimentId={experimentId} onDone={() => void load()} />
                      )}
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
          {rows !== null && rows.length === 0 && !loading && (
            <div className="text-[11px] text-slate-400">
              No source is awaiting a decision in this domain. This is a read of the queue, not an assumption —
              sources already decided are not shown here.
            </div>
          )}
          {rows?.map((r) => (
            <CandidateReviewCard
              key={r.sourceId}
              row={r}
              onDecided={() => {
                void load();
                onDone();
              }}
            />
          ))}
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

function CandidateReviewCard({ row, onDecided }: { row: CandidateSource; onDecided: () => void }) {
  const [decision, setDecision] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const chosen = DECISIONS.find((d) => d.value === decision) ?? null;

  const submit = useCallback(async () => {
    if (!chosen || !notes.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await personaFetch(
        `/api/corpus-scout/candidates/${encodeURIComponent(row.sourceId)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: chosen.value, notes: notes.trim() }),
        },
      );
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `the decision was not recorded (HTTP ${res.status})`);
      setDone(chosen.label);
      onDecided();
    } catch (e) {
      // A failed decision leaves the source PENDING and says so — the operator
      // must never be left thinking they decided something they did not.
      setErr(e instanceof Error ? e.message : "the decision was not recorded — this source is still pending");
    } finally {
      setBusy(false);
    }
  }, [chosen, notes, row.sourceId, onDecided]);

  if (done) {
    return (
      <div className="rounded border border-emerald-800/50 bg-emerald-950/20 p-2 text-[11px] text-emerald-200">
        <CheckCircle2 className="mr-1 inline h-3 w-3" />
        {row.title} — {done}. Recorded with your rationale.
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
      <div className="font-medium text-slate-100">{row.title}</div>
      <div className="mt-0.5 text-slate-400">
        {row.issuer || "issuer not recorded"}
        {row.publicationDate ? ` · ${row.publicationDate}` : ""}
        {row.authors.length > 0 ? ` · ${row.authors.join(", ")}` : ""}
      </div>
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
            disabled={busy || !chosen || !notes.trim()}
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
