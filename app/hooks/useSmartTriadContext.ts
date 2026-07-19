"use client";

/**
 * useSmartTriadContext — assembles the SmartTriadContext (PRD §7, ratified
 * 2026-07-19) for the shell's generic copilot: the active cartridge/tab (L2),
 * the caller's T1-safe observer state (L3 — grants, passport posture,
 * delegation; never a T0 identifier), and the cartridge's deep-link
 * affordances. Observer reads are best-effort: a failed fetch degrades to an
 * empty observer, never blocks the copilot.
 */

import { useEffect, useMemo, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";
import type { SmartTriadContext, SmartTriadDeepLink, SmartTriadObserverContext } from "@/types/smartTriadContext";

/** Per-cartridge deep-link catalogs. IRL tab slugs differ by edition (irl-os-*
 *  public vs irl-* internal) — resolved from the codexId. */
function deepLinksFor(codexId: string): SmartTriadDeepLink[] {
  if (codexId === "irl-os-cartridge" || codexId === "irl-cartridge") {
    const p = codexId === "irl-os-cartridge" ? "irl-os" : "irl";
    return [
      { label: "Claim Passport", tab: `${p}-passport-apply` },
      { label: "Research Access", tab: `${p}-passport-locker` },
      { label: "Delegate Agent", tab: `${p}-passport-delegation` },
      { label: "Run Experiments", tab: `${p}-experiment-lab` },
      { label: "Publications", tab: `${p}-reports` },
    ];
  }
  if (codexId === "polity-passport-bureau-cartridge") {
    return [
      { label: "Apply", tab: "passport-apply" },
      { label: "Delegation", tab: "passport-delegation" },
      { label: "Locker", tab: "passport-locker" },
      { label: "Research Lab", codexSlug: "irl-os-cartridge", codexTab: "irl-os-welcome" },
    ];
  }
  if (codexId === "metame-codex") {
    return [
      { label: "Passport Bureau", codexSlug: "polity-passport-bureau-cartridge" },
      { label: "Research Lab", codexSlug: "irl-os-cartridge", codexTab: "irl-os-welcome" },
    ];
  }
  return [];
}

export function useSmartTriadContext(
  codexId: string,
  cartridgeName: string,
  activeTabSlug: string,
): SmartTriadContext {
  const [observer, setObserver] = useState<SmartTriadObserverContext>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: SmartTriadObserverContext = {};
      try {
        const res = await personaFetch("/api/participation/my-access", { cache: "no-store" });
        const d = await res.json();
        next.authenticated = Boolean(d?.authenticated);
        next.participation = Array.isArray(d?.grants)
          ? d.grants.map((g: { accessDomain?: string; role?: string }) => ({
              domain: String(g.accessDomain ?? ""),
              role: String(g.role ?? ""),
            }))
          : [];
      } catch { /* best-effort */ }
      try {
        const res = await personaFetch("/api/polity-passport/wallet", { cache: "no-store" });
        const d = await res.json();
        const passports = (d?.passportQubes ?? []) as Array<{ passportId?: string; claimedAt?: string | null }>;
        next.passportState = passports.some((p) => p.claimedAt)
          ? "claimed"
          : passports.some((p) => p.passportId)
            ? "issued"
            : "none";
      } catch { /* best-effort */ }
      if (!cancelled) setObserver(next);
    })();
    return () => { cancelled = true; };
    // Re-observe when the cartridge changes; tab switches reuse the snapshot.
  }, [codexId]);

  return useMemo(
    () => ({
      surface: "smart-triad" as const,
      platform: { ontologyVersion: "v1" },
      cartridge: { id: codexId, name: cartridgeName, tab: activeTabSlug },
      observer,
      deepLinks: deepLinksFor(codexId),
    }),
    [codexId, cartridgeName, activeTabSlug, observer],
  );
}
