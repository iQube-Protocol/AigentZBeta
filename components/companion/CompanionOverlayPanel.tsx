/**
 * CompanionOverlayPanel — Constitutional Overlay UI (Companion popup, fourth surface).
 *
 * PRD-MMC-IMPL-002 Increment 2, Step 2 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * Surface-agnostic (`personaIdHint` only), `personaFetch`-only (CLAUDE.md
 * PARAMOUNT client-spine-fetch rule) against `GET /api/companion/overlay`.
 * Gated on the server's own domain→shape resolution — this component never
 * classifies a domain itself, it only renders whatever shape (or `null`)
 * the server returns. An unmapped domain renders an honest "No overlay
 * available for this page", never a fabricated generic card.
 *
 * Styling: canonical slate house style only (`border-slate-800` /
 * `bg-slate-900/40`, no white hairlines).
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { personaFetch } from "@/utils/personaSpine";
import type {
  OverlayCard,
  GithubRepoOverlayCard,
  BankingOverlayCard,
} from "@/services/companion/overlayComposition";

const OVERLAY_ENDPOINT = "/api/companion/overlay";

export interface CompanionOverlayPanelProps {
  /** T1 persona hint threaded onto the `personaFetch` call. Never rendered
   *  as text in this component. */
  personaIdHint: string;
}

type OverlayEmptyReason = "no-observation" | "no-domain-observed" | "grant-revoked" | "domain-unmapped" | null;

interface OverlayResponse {
  ok: boolean;
  domain: string | null;
  shape: "github-repo" | "banking" | null;
  card: OverlayCard | null;
  reason: OverlayEmptyReason;
}

const EMPTY_REASON_COPY: Record<Exclude<OverlayEmptyReason, null>, string> = {
  "no-observation":
    "No page context shared yet. Go to Companion → Observer permissions and share “Current tab”, then reopen this tab.",
  "no-domain-observed":
    "“Current tab” isn't shared, so the Overlay can't see what page you're on. Go to Companion → Observer permissions to share it.",
  "grant-revoked":
    "“Current tab” was revoked for this site, so the Overlay has no page context to show.",
  "domain-unmapped": "No overlay available for this page",
};

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function GithubRepoCard({ card, domain }: { card: GithubRepoOverlayCard; domain: string | null }) {
  const score = card.standing.score as { score?: number } | null;
  const topProducer = card.capability.find((p) => p.eligible) ?? card.capability[0];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Repository — {domain}
        </div>
        <div className="mt-2 space-y-1">
          <StatRow label="Standing signal" value={card.standing.hasStandingSignal ? "Active" : "None yet"} />
          {typeof score?.score === "number" ? (
            <StatRow label="Standing score" value={score.score.toFixed(1)} />
          ) : null}
          {topProducer ? (
            <StatRow
              label="Software capability"
              value={`${topProducer.producer.label} (${topProducer.eligible ? "eligible" : "not eligible"})`}
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Linked iQube
        </div>
        {card.registryMatch ? (
          <div className="mt-1 text-xs text-slate-200">{card.registryMatch.title}</div>
        ) : (
          <div className="mt-1 text-xs text-slate-500">No linked iQube found for this repo.</div>
        )}
      </div>

      {card.researchMatches.length > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            IRL references
          </div>
          <ul className="mt-1 space-y-1">
            {card.researchMatches.map((m, i) => (
              <li key={`${m.ref}-${i}`} className="truncate text-xs text-slate-200">
                {m.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BankingCard({ card, domain }: { card: BankingOverlayCard; domain: string | null }) {
  const score = card.standing.score as { score?: number } | null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          QriptoCENT / Wallet — {domain}
        </div>
        <div className="mt-2 space-y-1">
          <StatRow label="Standing signal" value={card.standing.hasStandingSignal ? "Active" : "None yet"} />
          {typeof score?.score === "number" ? (
            <StatRow label="Standing score" value={score.score.toFixed(1)} />
          ) : null}
          <StatRow label="Passport identifiability" value={card.identifiability} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Delegations
        </div>
        <div className="mt-1 space-y-1">
          <StatRow label="Admin" value={card.cartridgeFlags.isAdmin ? "Yes" : "No"} />
          <StatRow label="Partner" value={card.cartridgeFlags.isPartner ? "Yes" : "No"} />
        </div>
      </div>
    </div>
  );
}

export function CompanionOverlayPanel({ personaIdHint }: CompanionOverlayPanelProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverlayResponse | null>(null);

  const load = useCallback(async () => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    setError(null);
    try {
      const res = await personaFetch(OVERLAY_ENDPOINT, { personaIdHint, cache: "no-store" });
      if (!res.ok) {
        setError(await readErrorMessage(res, `Failed to load overlay (${res.status}).`));
        setStatus("error");
        return;
      }
      const body = (await res.json()) as OverlayResponse;
      setData(body);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [personaIdHint]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">Overlay</div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {status === "loading" ? (
          <div className="text-xs text-slate-500">Loading overlay…</div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        ) : null}

        {status === "ready" && data ? (
          data.shape === "github-repo" && data.card?.shape === "github-repo" ? (
            <GithubRepoCard card={data.card} domain={data.domain} />
          ) : data.shape === "banking" && data.card?.shape === "banking" ? (
            <BankingCard card={data.card} domain={data.domain} />
          ) : (
            <div className="text-xs text-slate-500">
              {data.reason ? EMPTY_REASON_COPY[data.reason] : "No overlay available for this page"}
              {data.reason === "domain-unmapped" && data.domain ? ` (${data.domain}).` : data.reason === "domain-unmapped" ? "." : ""}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

export default CompanionOverlayPanel;
