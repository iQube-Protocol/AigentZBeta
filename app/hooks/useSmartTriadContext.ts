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
import type { SmartTriadContext, SmartTriadDeepLink, SmartTriadObserverContext, SmartTriadOperation } from "@/types/smartTriadContext";

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

/** L2 corpus refs (PRD §7) — the named domain-corpus surfaces the cartridge's
 *  copilot is grounded on. Labels the model can cite/point at; retrieval
 *  itself flows through the agent's KB. */
function corpusRefsFor(codexId: string): string[] {
  if (codexId === "irl-os-cartridge" || codexId === "irl-cartridge") {
    return [
      "invariant canon (ratified + proposed registry)",
      "experiment records (EXP/IRV/IPV results + Stage-0 calibrations)",
      "Polity Papers corpus",
      "research glossary + platform ontology",
      "lab state (active experiments, participation, publications)",
    ];
  }
  if (codexId === "polity-passport-bureau-cartridge") {
    return [
      "passport lifecycle (apply → issue → claim)",
      "steward workflows (review, invitations, sponsorship)",
      "participation + access-domain model",
      "bounded delegation contracts",
    ];
  }
  if (codexId === "metame-codex") {
    return [
      "metaMe sovereign identity model (personas, wallet, BlakQube)",
      "intent + receipt ledger (myLedger / myWorkspace)",
      "cartridge catalog + cross-cartridge navigation",
    ];
  }
  return [];
}

/** What the copilot can DO on this surface (PRD §7). Labels only — the
 *  mechanisms are the deep-link chips, operation chips, and guidance. */
function capabilitiesFor(codexId: string, isAdmin: boolean): string[] {
  const caps = ["answer from cartridge corpus", "navigate via quick-link chips", "guide onboarding by observed state"];
  if ((codexId === "irl-os-cartridge" || codexId === "irl-cartridge") && isAdmin) {
    caps.push("run admin operations (confirm-gated chips)");
  }
  return caps;
}

/** Admin-only copilot operations per cartridge (Phase 3 Actions). Every route
 *  here is ALREADY admin-gated server-side; the chip is a convenience. */
function operationsFor(codexId: string): SmartTriadOperation[] {
  if (codexId === "irl-os-cartridge" || codexId === "irl-cartridge") {
    return [
      {
        id: "backfill-results",
        label: "Backfill repo records",
        route: "/api/experiments/results/backfill",
        method: "POST",
        confirm: "Publish the repo-bundled records (historical EXP runs + IRV/IPV Stage-0) into the canonical results? Idempotent — already-published entries skip.",
      },
      {
        id: "regenerate-report",
        label: "Regenerate canonical report",
        route: "/api/research/report/regenerate",
        method: "POST",
        body: { scope: "all" },
        confirm: "Regenerate the canonical findings report from the collective record? Saves a new DVN-receipted version (model call).",
      },
      {
        id: "compact-memory",
        label: "Compact memory",
        route: "/api/memory/invariants/compact",
        method: "POST",
        body: { cartridgeId: codexId },
        confirm: "Compact YOUR copilot memory for this cartridge (CFS-045)? Merges near-duplicate memory invariants and retires stale ones — owner-scoped, reversible only by re-learning.",
      },
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
      try {
        const res = await personaFetch("/api/experiments/access", { cache: "no-store" });
        const d = await res.json();
        next.isAdmin = Boolean(d?.isAdmin);
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
      cartridge: { id: codexId, name: cartridgeName, tab: activeTabSlug, corpusRefs: corpusRefsFor(codexId) },
      observer,
      deepLinks: deepLinksFor(codexId),
      // Operations only surface for admins (optimistic; routes re-gate).
      operations: observer.isAdmin ? operationsFor(codexId) : [],
      capabilities: capabilitiesFor(codexId, Boolean(observer.isAdmin)),
    }),
    [codexId, cartridgeName, activeTabSlug, observer],
  );
}
