/**
 * ObserverGrantPanel — Observer capability-grant management UI.
 *
 * PRD-MMC-IMPL-001 Increment 4 (capability-grant management UI).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-001-companion-phase2-implementation-plan.md §2.
 * Capability copy sourced from PRD-MMC-001 §4.1's capability-grant table
 * (codexes/packs/irl/foundation/PRD-MMC-001_metame-companion.md).
 *
 * Surface-agnostic: takes only `personaIdHint` as a prop, so a future
 * extension-sidebar surface (PRD-MMC-001 §6 Phase 2+) can mount this exact
 * component unchanged (implementation plan §0.4). This component manages
 * CONSENT GRANTS only — no live-browser observation source exists yet
 * (Increment 3's `BrowserContextObservation` has no producer in this
 * sandbox; that is a separate, environment-specific pass, plan §0.2/§4).
 *
 * Data flow: `personaFetch` ONLY (CLAUDE.md PARAMOUNT client-spine-fetch
 * rule) against the Increment 2 routes:
 *   GET    /api/companion/observer/grants               → list active grants
 *   POST   /api/companion/observer/grants               → grant a capability
 *   DELETE /api/companion/observer/grants/[capability]  → revoke (optionally
 *          scoped by `?site=`)
 * Never a raw `fetch`, never `authedFetchHeaders` — both are forbidden for
 * spine-adjacent routes per CLAUDE.md's documented 2026-05-26 / 2026-07-20
 * incidents. `personaIdHint` is threaded onto every call so every read/write
 * this panel makes resolves the SAME persona.
 *
 * T0/T1 discipline: `personaIdHint` is used ONLY as a `personaFetch` query
 * hint — it is never rendered as visible text or a DOM attribute anywhere
 * in this component, mirroring the identity chip's own pattern of showing
 * `displayLabel`, never a raw persona identifier.
 *
 * Narration discipline (PRD §4.2 "observed, never asserted"): an ungranted
 * capability reads "Not shared" — never "Off" — to avoid implying a
 * default-on baseline that does not exist. `history` carries PRD §4.1's
 * "most sensitive; strongest warning" copy as a VISIBLE warning string on
 * its row, not a tooltip or design note.
 *
 * Styling: canonical slate house style only (CLAUDE.md "Canonical Surface
 * Styling") — `border-slate-800` / `bg-slate-900/40`, no white hairlines.
 *
 * Revocation reuses the existing `ConfirmDialog` primitive (CLAUDE.md "File
 * and Component Discipline") rather than a bespoke modal — a single click
 * plus the confirm/cancel affordance `ConfirmDialog` already provides for
 * every other destructive action in this codebase.
 *
 * Per-site scope (only `current-tab` / `page-document` support it, per
 * `SCOPE_SUPPORT`): since no browser-observation source exists yet to
 * supply the current site's domain automatically (Increment 3's producer is
 * out of scope for this increment), the operator types the domain to grant
 * or revoke explicitly.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { personaFetch } from "@/utils/personaSpine";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  OBSERVER_CAPABILITIES,
  SCOPE_SUPPORT,
  type ObserverCapability,
  type ObserverCapabilityGrant,
  type ObserverCapabilityScope,
} from "@/types/companionObserver";

const GRANTS_ENDPOINT = "/api/companion/observer/grants";

export interface ObserverGrantPanelProps {
  /** T1 persona hint threaded onto every `personaFetch` call. Never
   *  rendered as text or a DOM attribute anywhere in this component. */
  personaIdHint: string;
}

type GrantsByCapability = Record<ObserverCapability, ObserverCapabilityGrant[]>;

interface RevokeTarget {
  capability: ObserverCapability;
  scope: ObserverCapabilityScope;
  siteDomain?: string;
}

interface CapabilityCopy {
  label: string;
  description: string;
  /** Only set for capabilities the PRD marks with stronger-than-default
   *  warning language (currently `history` only). Rendered as a visible
   *  warning string on that row, per PRD §4.1. */
  warning?: string;
}

// PRD-MMC-001 §4.1's capability-grant table, verbatim in substance.
const CAPABILITY_COPY: Record<ObserverCapability, CapabilityCopy> = {
  "current-tab": {
    label: "Current tab",
    description: "Observe the active tab's domain, URL, and title only.",
  },
  selection: {
    label: "Text selection",
    description: "Read your explicit text selection.",
  },
  "page-document": {
    label: "Page document",
    description: "Read the current page or document body for capture / help.",
  },
  downloads: {
    label: "Downloads",
    description: "Access a file you're downloading (e.g. a PDF to capture).",
  },
  clipboard: {
    label: "Clipboard",
    description: "Read and write the clipboard on explicit action.",
  },
  notifications: {
    label: "Notifications",
    description: "Deliver constitutional notifications.",
  },
  history: {
    label: "Navigation history",
    description: "Observe navigation history for continuity across sites.",
    warning:
      "Most sensitive capability — strongest warning. Granting this reveals where you've browsed over time, which can expose sensitive patterns of activity. Grant only if you understand and accept this exposure.",
  },
};

function emptyGrantsByCapability(): GrantsByCapability {
  const next = {} as GrantsByCapability;
  for (const capability of OBSERVER_CAPABILITIES) next[capability] = [];
  return next;
}

function groupGrants(grants: ObserverCapabilityGrant[]): GrantsByCapability {
  const next = emptyGrantsByCapability();
  for (const grant of grants) {
    next[grant.capability] = [...next[grant.capability], grant];
  }
  return next;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

export function ObserverGrantPanel({ personaIdHint }: ObserverGrantPanelProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [grantsByCapability, setGrantsByCapability] = useState<GrantsByCapability>(
    emptyGrantsByCapability(),
  );
  const [pendingKeys, setPendingKeys] = useState<Record<string, boolean>>({});
  const [siteDrafts, setSiteDrafts] = useState<Partial<Record<ObserverCapability, string>>>({});
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);

  const setKeyPending = (key: string, value: boolean) => {
    setPendingKeys((prev) => ({ ...prev, [key]: value }));
  };

  const loadGrants = useCallback(async () => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    setError(null);
    try {
      const res = await personaFetch(GRANTS_ENDPOINT, {
        personaIdHint,
        cache: "no-store",
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, `Failed to load Observer permissions (${res.status}).`));
        setStatus("error");
        return;
      }
      const body = (await res.json()) as { grants: ObserverCapabilityGrant[] };
      setGrantsByCapability(groupGrants(body.grants ?? []));
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [personaIdHint]);

  useEffect(() => {
    void loadGrants();
  }, [loadGrants]);

  const submitGrant = useCallback(
    async (capability: ObserverCapability, scope: ObserverCapabilityScope, siteDomain?: string) => {
      const key = `${capability}:${scope}:${siteDomain ?? ""}`;
      setKeyPending(key, true);
      try {
        const res = await personaFetch(GRANTS_ENDPOINT, {
          method: "POST",
          personaIdHint,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability,
            scope,
            ...(siteDomain ? { siteDomain } : {}),
          }),
        });
        if (!res.ok) {
          setError(await readErrorMessage(res, `Failed to share ${CAPABILITY_COPY[capability].label} (${res.status}).`));
          return;
        }
        const body = (await res.json()) as { grants: ObserverCapabilityGrant[] };
        setGrantsByCapability(groupGrants(body.grants ?? []));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setKeyPending(key, false);
      }
    },
    [personaIdHint],
  );

  const submitRevoke = useCallback(
    async (capability: ObserverCapability, scope: ObserverCapabilityScope, siteDomain?: string) => {
      const key = `${capability}:${scope}:${siteDomain ?? ""}`;
      setKeyPending(key, true);
      try {
        const query = scope === "site" && siteDomain ? `?site=${encodeURIComponent(siteDomain)}` : "";
        const res = await personaFetch(`${GRANTS_ENDPOINT}/${capability}${query}`, {
          method: "DELETE",
          personaIdHint,
        });
        if (!res.ok) {
          setError(await readErrorMessage(res, `Failed to revoke ${CAPABILITY_COPY[capability].label} (${res.status}).`));
          return;
        }
        const body = (await res.json()) as { grants: ObserverCapabilityGrant[] };
        setGrantsByCapability(groupGrants(body.grants ?? []));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setKeyPending(key, false);
      }
    },
    [personaIdHint],
  );

  return (
    <div className="space-y-2">
      {status === "loading" ? (
        <div className="text-xs text-slate-500">Loading Observer permissions…</div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-300">
          {error}
        </div>
      ) : null}

      {status !== "loading"
        ? OBSERVER_CAPABILITIES.map((capability) => {
            const copy = CAPABILITY_COPY[capability];
            const activeGrants = grantsByCapability[capability];
            const globalGrant = activeGrants.find((g) => g.scope === "global");
            const siteGrants = activeGrants.filter((g) => g.scope === "site");
            const supportsSite = SCOPE_SUPPORT[capability].includes("site");
            const isShared = activeGrants.length > 0;
            const globalKey = `${capability}:global:`;
            const globalPending = !!pendingKeys[globalKey];

            return (
              <div
                key={capability}
                className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200">{copy.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{copy.description}</div>
                    {!isShared ? (
                      <div className="mt-1 text-[11px] text-slate-500">Not shared</div>
                    ) : null}
                    {copy.warning ? (
                      <div className="mt-1.5 rounded-sm border border-amber-900/60 bg-amber-950/30 px-2 py-1 text-[10px] text-amber-300">
                        {copy.warning}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={globalPending}
                    onClick={() =>
                      globalGrant
                        ? setRevokeTarget({ capability, scope: "global" })
                        : void submitGrant(capability, "global")
                    }
                    className={
                      globalGrant
                        ? "shrink-0 rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-emerald-300 hover:bg-slate-900 disabled:opacity-50"
                        : "shrink-0 rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900 disabled:opacity-50"
                    }
                  >
                    {globalPending ? "…" : globalGrant ? "Shared — revoke" : "Share"}
                  </button>
                </div>

                {supportsSite ? (
                  <div className="mt-2 border-t border-slate-800 pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">
                      Per-site
                    </div>
                    {siteGrants.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {siteGrants.map((grant) => {
                          const siteKey = `${capability}:site:${grant.siteDomain ?? ""}`;
                          return (
                            <li
                              key={`${capability}-${grant.siteDomain ?? ""}`}
                              className="flex items-center justify-between gap-2 text-[11px] text-slate-300"
                            >
                              <span className="truncate">{grant.siteDomain}</span>
                              <button
                                type="button"
                                disabled={!!pendingKeys[siteKey]}
                                onClick={() =>
                                  setRevokeTarget({
                                    capability,
                                    scope: "site",
                                    siteDomain: grant.siteDomain,
                                  })
                                }
                                className="shrink-0 text-[11px] text-rose-300 hover:text-rose-200 disabled:opacity-50"
                              >
                                {pendingKeys[siteKey] ? "…" : "Revoke"}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={siteDrafts[capability] ?? ""}
                        onChange={(e) =>
                          setSiteDrafts((prev) => ({ ...prev, [capability]: e.target.value }))
                        }
                        placeholder="example.com"
                        className="min-w-0 flex-1 rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const domain = (siteDrafts[capability] ?? "").trim();
                          if (!domain) return;
                          void submitGrant(capability, "site", domain);
                          setSiteDrafts((prev) => ({ ...prev, [capability]: "" }));
                        }}
                        className="shrink-0 rounded-sm border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900"
                      >
                        Share for site
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        : null}

      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke Observer permission"
        description={
          revokeTarget
            ? `Revoke ${CAPABILITY_COPY[revokeTarget.capability].label}${
                revokeTarget.scope === "site" && revokeTarget.siteDomain
                  ? ` for ${revokeTarget.siteDomain}`
                  : " (all sites)"
              }? You can re-share it later.`
            : undefined
        }
        confirmText="Revoke"
        cancelText="Cancel"
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (!revokeTarget) return;
          const { capability, scope, siteDomain } = revokeTarget;
          setRevokeTarget(null);
          void submitRevoke(capability, scope, siteDomain);
        }}
      />
    </div>
  );
}

export default ObserverGrantPanel;
