/**
 * CompanionOverlayPanel — Constitutional Overlay UI (Companion popup, fourth surface).
 *
 * PRD-MMC-IMPL-002 Increment 2, Step 2 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * Surface-agnostic (`personaIdHint` only), `personaFetch`-only (CLAUDE.md
 * PARAMOUNT client-spine-fetch rule) against `GET /api/companion/overlay`.
 * Gated on the server's own domain→shape resolution — this component never
 * classifies a domain itself, it only renders whatever shape the server
 * returns: `'github-repo'`, `'banking'`, or (operator-directed, 2026-07-25)
 * `'generic'` for a real, currently-granted domain with no dedicated
 * dashboard. The honest "No overlay available for this page" empty state is
 * now reached only for a genuine consent gap (no observation shared, no
 * domain observed, or the grant was revoked) — never for an unmapped domain,
 * since that case now gets the generic card instead.
 *
 * Styling: canonical slate house style only (`border-slate-800` /
 * `bg-slate-900/40`, no white hairlines).
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { personaFetch } from "@/utils/personaSpine";
import { buildCodexUrl } from "@/utils/codex-nav";
import type {
  OverlayCard,
  GithubRepoOverlayCard,
  BankingOverlayCard,
  GenericOverlayCard,
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
  shape: "github-repo" | "banking" | "generic" | null;
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

/**
 * The unmapped-domain fallback (operator-directed, 2026-07-25). Renders on
 * ANY page the domain→shape table has no dedicated dashboard for. Shows only
 * what's genuinely true here: the persona's OWN standing/delegations (not
 * page-specific — they're identical to the same panels on `BankingCard`,
 * just no longer withheld on a page with no shape) plus a best-effort
 * registry/research match using the page's own title. The "Pull Across" hint
 * is TEXT, not a button — there is no message path from this side-panel UI
 * to the context-menu-only capture flow, so a button here would be a
 * fabricated affordance that does nothing on click.
 */
function GenericCard({ card, domain }: { card: GenericOverlayCard; domain: string | null }) {
  const score = card.standing.score as { score?: number } | null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {domain ?? "This page"}
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

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Related in the registry
        </div>
        {card.titleMatches.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {card.titleMatches.map((m, i) => (
              <li key={`${m.ref}-${i}`} className="truncate text-xs text-slate-200">
                {m.title}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-1 text-xs text-slate-500">No registry or research matches for this page.</div>
        )}
      </div>

      <div className="text-[11px] leading-snug text-slate-600">
        No dedicated overlay is built for this kind of page yet. Right-click anywhere on it and choose
        &ldquo;Pull Across → metaMe&rdquo; to bring it into an Intent or Venture.
      </div>
    </div>
  );
}

function BankingCard({
  card,
  domain,
  personaIdHint,
}: {
  card: BankingOverlayCard;
  domain: string | null;
  /** Threaded through solely to build capability deep-links — the SAME hint
   *  the panel already uses for `personaFetch`, so the link and the data it
   *  came from resolve the same persona. */
  personaIdHint: string;
}) {
  const score = card.standing.score as { score?: number } | null;
  // Optional on the card type — an older server response (or an empty
  // registry) simply yields no capability section.
  const matched = card.matchedCapabilities ?? [];

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

      {/* Constitutional capabilities relevant to a banking-shaped page
         (operator-approved 2026-07-24). Rendered only when the server
         actually matched something — same precedent as `researchMatches`
         above: an optional list-shaped section is omitted, not shown empty.
         An unpopulated registry (or an unapplied migration) therefore looks
         exactly like today's card, never a broken or error state. */}
      {matched.length > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Constitutional capabilities
          </div>
          <ul className="mt-2 space-y-2">
            {matched.map((cap) => (
              <li key={cap.capabilityId} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-slate-200">{cap.displayLabel}</span>
                  <span className="shrink-0 rounded-sm border border-slate-800 bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {cap.standingBand}
                  </span>
                </div>
                {cap.description ? (
                  <p className="text-[11px] leading-snug text-slate-500">{cap.description}</p>
                ) : null}
                {/* briefUrl may be a published Artifact URL or a repo path —
                   same two-case handling as MySoftwareTab's registered
                   capabilities list; a path is shown as plain text, never a
                   dead link. */}
                {cap.briefUrl ? (
                  cap.briefUrl.startsWith("http") ? (
                    <a
                      href={cap.briefUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-violet-400 hover:text-violet-300"
                    >
                      Read the brief
                    </a>
                  ) : (
                    <span className="block truncate font-mono text-[10px] text-slate-600" title={cap.briefUrl}>
                      {cap.briefUrl.split("/").pop()}
                    </span>
                  )
                ) : null}
                {/* The way IN. A registered capability with no route to its
                   operating surface is a label, not an affordance (operator,
                   2026-07-25: "I now see the capability but what can be done
                   with them?"). `route` is identifier-free static metadata
                   from CAPABILITY_ROUTES; the persona is attached HERE, at
                   render, exactly as CompanionSearchPanel does. Deep-links to
                   the existing surface — the Companion never forks it. */}
                {cap.route ? (
                  <a
                    href={buildCodexUrl(cap.route.slug, {
                      tab: cap.route.tab,
                      personaId: personaIdHint,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1 text-center text-[11px] text-slate-200 transition-colors hover:bg-slate-900"
                  >
                    {cap.route.label} →
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CompanionOverlayPanel({ personaIdHint }: CompanionOverlayPanelProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverlayResponse | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setStatus((prev) => (prev === "ready" ? prev : "loading"));
        setError(null);
      }
      try {
        const res = await personaFetch(OVERLAY_ENDPOINT, { personaIdHint, cache: "no-store" });
        if (!res.ok) {
          if (!opts?.silent) {
            setError(await readErrorMessage(res, `Failed to load overlay (${res.status}).`));
            setStatus("error");
          }
          return;
        }
        const body = (await res.json()) as OverlayResponse;
        setData(body);
        setStatus("ready");
      } catch (err) {
        if (!opts?.silent) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      }
    },
    [personaIdHint],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // The observation this reads is refreshed by the content script on every
  // page load/tab switch, but this panel itself only ever fetched once on
  // mount -- navigating to a new page while the panel stayed open required
  // clicking Refresh manually (same class of gap as the Workspace Inbox,
  // 2026-07-24). Poll silently while mounted instead.
  useEffect(() => {
    const interval = setInterval(() => {
      void load({ silent: true });
    }, 5000);
    return () => clearInterval(interval);
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
            <BankingCard card={data.card} domain={data.domain} personaIdHint={personaIdHint} />
          ) : data.shape === "generic" && data.card?.shape === "generic" ? (
            <GenericCard card={data.card} domain={data.domain} />
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
