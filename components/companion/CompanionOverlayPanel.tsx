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
 * returns: `'github-repo'`, `'financial-context'`, or (operator-directed, 2026-07-25)
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
  FinancialContextOverlayCard,
  GenericOverlayCard,
} from "@/services/companion/overlayComposition";
import type { CompanionSearchResult } from "@/types/companionSearch";

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
  shape: "github-repo" | "financial-context" | "generic" | null;
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

/**
 * "What does metaMe already know about this page" — rendered on EVERY shape.
 *
 * Operator-directed 2026-07-25 ("would this apply generally or just github?"
 * — generally). Previously only the generic unmapped-domain card showed
 * registry hits, so the broadest capability sat on the least specific shape.
 * Server-side this is one `resolveRelatedMatches` for all shapes; here it is
 * one component, so the three cards cannot drift in how they present it.
 *
 * Always rendered, including empty — unlike the optional shape-specific
 * sections. "No matches" is a real, useful answer to "is any of my registry
 * related to this page", and silently omitting the panel would read as the
 * feature being absent rather than as a genuine negative.
 */
function RelatedInRegistry({ matches }: { matches: CompanionSearchResult[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Related in the registry
      </div>
      {matches.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {matches.map((m, i) => (
            <li key={`${m.ref}-${i}`} className="truncate text-xs text-slate-200">
              {m.title}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-xs text-slate-500">No registry or research matches for this page.</div>
      )}
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

      <RelatedInRegistry matches={card.relatedMatches ?? []} />
    </div>
  );
}

/**
 * The unmapped-domain fallback (operator-directed, 2026-07-25). Renders on
 * ANY page the domain→shape table has no dedicated dashboard for. Shows only
 * what's genuinely true here: the persona's OWN standing/delegations (not
 * page-specific — they're identical to the same panels on `FinancialContextCard`,
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

      <RelatedInRegistry matches={card.relatedMatches ?? []} />

      <div className="text-[11px] leading-snug text-slate-600">
        No dedicated overlay is built for this kind of page yet. Right-click anywhere on it and choose
        &ldquo;Pull Across → metaMe&rdquo; to bring it into an Intent or Venture.
      </div>
    </div>
  );
}

function FinancialContextCard({
  card,
  domain,
  personaIdHint,
}: {
  card: FinancialContextOverlayCard;
  domain: string | null;
  /** Threaded through solely to build capability deep-links — the SAME hint
   *  the panel already uses for `personaFetch`, so the link and the data it
   *  came from resolve the same persona. */
  personaIdHint: string;
}) {
  const score = card.standing.score as { score?: number } | null;
  // P4: capabilities render grouped by the module that surfaces them. The
  // flat `card.matchedCapabilities` is retained on the wire for any other
  // consumer, but this panel reads `card.modules` — grouping is the point.

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

      {/* P4 — CAPABILITY MODULES (SPEC-CDR-001 §7.1).
         The capability rows that shipped 2026-07-24 are now rendered INSIDE
         the `financial-intelligence` module rather than as a standalone list:
         one rendering model, never parallel "legacy rows" and "new modules"
         (operator, P4-3). A module appears only because the resolved Domain
         Profile named it — never inferred from the overlay context, and
         governance modules never by default (P4-2).

         The composer already omits an executable module with no matched
         capabilities, so an unpopulated registry still renders exactly
         today's card rather than an empty header. */}
      {card.modules.map((mod) => (
        <div
          key={mod.moduleId}
          className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {mod.label}
            </div>
            {/* D-11, the VISUAL half of the firewall. `Shadow` names the
               actual constitutional state; governance modules are context
               only. An authoritative module carries no chip -- it is the
               unmarked case. */}
            {mod.posture === "shadow-only" ? (
              <span
                title="Visible for context; not authorized or executable from this surface."
                className="shrink-0 rounded-sm border border-amber-900/60 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-300"
              >
                Shadow
              </span>
            ) : mod.posture === "non-executable" ? (
              <span
                title="Visible for context; not authorized or executable from this surface."
                className="shrink-0 rounded-sm border border-slate-800 bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-400"
              >
                Context
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">{mod.summary}</p>
          {mod.capabilities.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {mod.capabilities.map((cap) => (
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
                      <span
                        className="block truncate font-mono text-[10px] text-slate-600"
                        title={cap.briefUrl}
                      >
                        {cap.briefUrl.split("/").pop()}
                      </span>
                    )
                  ) : null}
                  {/* The way IN — but ONLY where the module's posture permits
                     an action at all (D-11, behavioural half). A shadow-only
                     or governance module renders NO control here: not a
                     disabled one, since a disabled button still implies the
                     action exists (operator, P4-4). `route` is
                     identifier-free static metadata; the persona is attached
                     HERE, at render, exactly as CompanionSearchPanel does. */}
                  {mod.allowsAction && cap.route ? (
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
          ) : null}
        </div>
      ))}

      <RelatedInRegistry matches={card.relatedMatches ?? []} />
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

  /**
   * Ask the extension to re-observe the ACTIVE TAB before re-reading.
   *
   * WHY THIS EXISTS: this panel is a web page inside the extension side
   * panel's iframe — it has no `chrome.*` access, so on its own it can only
   * re-fetch the STORED observation. That made Refresh a no-op whenever the
   * stored row was wrong or stale: it faithfully re-read the same bad row,
   * which the operator correctly read as "Refresh doesn't work" (three
   * rounds, 2026-07-25). The extension's `sidepanel.html` parent IS an
   * extension document and can do the hop; it validates our origin strictly
   * before relaying (see `extension/companion-observer/sidepanel.js`).
   *
   * Degrades cleanly OUTSIDE the extension (plain web embed, no parent, or
   * an older extension without the bridge): nothing answers, the timeout
   * fires, and we fall through to the same plain re-fetch Refresh always
   * did. So this never makes the button worse than before, only better where
   * the bridge exists — no surface detection needed.
   */
  const requestFreshObservation = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined" || window.parent === window) return;

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        resolve();
      };
      const onMessage = (event: MessageEvent) => {
        // The reply comes from the extension page hosting this iframe. We
        // can't hardcode its chrome-extension:// origin, so we verify it is
        // our own parent and carries the expected marker — and it conveys
        // only a boolean, never data we render.
        if (event.source !== window.parent) return;
        if ((event.data as { type?: string } | null)?.type !== "metame-companion:reobserve-done") return;
        finish();
      };
      const timer = setTimeout(finish, 1200);
      window.addEventListener("message", onMessage);
      window.parent.postMessage({ type: "metame-companion:request-reobserve" }, "*");
    });
  }, []);

  /** Refresh button handler: re-observe first (best effort), then re-read. */
  const refresh = useCallback(async () => {
    await requestFreshObservation();
    await load();
  }, [requestFreshObservation, load]);

  useEffect(() => {
    void load();
  }, [load]);

  // The observation this reads is refreshed by the content script on every
  // page load/tab switch, but this panel itself only ever fetched once on
  // mount -- navigating to a new page while the panel stayed open required
  // clicking Refresh manually (same class of gap as the Workspace Inbox,
  // 2026-07-24). Poll silently while mounted instead.
  useEffect(() => {
    // Guards against overlapping cycles: setInterval fires on schedule
    // regardless of whether the previous cycle finished, so a slow round-trip
    // would otherwise stack requests indefinitely and look like a hang.
    let inFlight = false;
    let cancelled = false;

    const interval = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      // Re-observe first, same as Refresh. Polling that only re-READ could
      // never notice you'd moved to a different page while the panel stayed
      // open — the stored observation simply doesn't change on its own. The
      // content script's identical-payload suppression means a poll on an
      // unchanged page costs no write, so this stays cheap.
      void (async () => {
        try {
          await requestFreshObservation();
          if (!cancelled) await load({ silent: true });
        } finally {
          inFlight = false;
        }
      })();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [requestFreshObservation, load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">Overlay</div>
          <button
            type="button"
            onClick={() => void refresh()}
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
          ) : data.shape === "financial-context" && data.card?.shape === "financial-context" ? (
            <FinancialContextCard card={data.card} domain={data.domain} personaIdHint={personaIdHint} />
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
