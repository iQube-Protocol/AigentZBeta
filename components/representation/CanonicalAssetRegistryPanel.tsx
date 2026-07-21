"use client";

/**
 * CanonicalAssetRegistryPanel — the Canonical Asset Registry read surface
 * (CFS-022a §2, the P1 registry). READ-ONLY.
 *
 * Renders every canonical asset that exists today as a first-class constitutional
 * object: the Bearing Instrument (A1), metaVitruvian (A2), and the ratified CCF
 * interpretation + its palette / typography / material views (A3–A4), each with
 * its standing band, governing invariants, provenance source, and lifecycle
 * state. Consumes /api/constitutional/canonical-assets (admin-gated), the in-situ
 * projection of the same descriptors the Composition engine retrieves.
 *
 * Consumes ONLY representation roles (`var(--rep-*)`) so it reskins with the IRL
 * dashboard when the interpretation flips — never hardcodes a look. Uses
 * experimentGet (spine-authed personaFetch) like every other IRL panel.
 */

import React, { useEffect, useState } from "react";
import { Layers, Loader2, ShieldCheck } from "lucide-react";
import { experimentGet } from "@/components/composer/experimentStepFetch";

interface RegistryAsset {
  id: string;
  ref: string;
  kind: string;
  displayLabel: string;
  versionStatus: string;
  standing: number;
  standingBand: string;
  reach: number;
  ratificationRequired: boolean;
  governingInvariants: string[];
  provenanceSource: string;
  contentCommitment: string | null;
  lifecycleState: string;
  dependencies: string[];
}

const BAND_ROLE: Record<string, string> = {
  foundational: "var(--rep-standing-foundational)",
  canonical: "var(--rep-standing-canonical)",
  validated: "var(--rep-standing-validated)",
  experimental: "var(--rep-standing-experimental)",
};

export function CanonicalAssetRegistryPanel() {
  const [assets, setAssets] = useState<RegistryAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await experimentGet("/api/constitutional/canonical-assets");
        if (!alive) return;
        if (!data?.ok || !Array.isArray(data.assets)) {
          setError(data?.error ?? "unexpected response");
          return;
        }
        setAssets(data.assets as RegistryAsset[]);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--rep-border-subtle)",
        background: "var(--rep-surface-raised)",
      }}
    >
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4" style={{ color: "var(--rep-accent-geometry)" }} />
        <h3
          className="text-sm font-semibold text-[var(--rep-ink-body)]"
          style={{ fontFamily: "var(--rep-type-title)" }}
        >
          Canonical Asset Registry
        </h3>
        {assets && (
          <span className="text-[10px] uppercase tracking-wide text-[var(--rep-ink-muted)]">
            {assets.length} assets · read-only
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--rep-ink-muted)]">
        The frozen assets the Composition engine retrieves (CFS-022a §2) — each a first-class
        constitutional object with standing, authority, and provenance.
      </p>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--rep-ink-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading registry…
        </div>
      )}
      {error && (
        <div className="mt-3 text-xs text-[var(--rep-standing-experimental)]">
          {error === "forbidden" ? "forbidden — the registry requires an admin persona" : error}
        </div>
      )}

      {assets && (
        <div className="mt-3 space-y-2">
          {assets.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border p-2.5"
              style={{ borderColor: "var(--rep-border-subtle)", background: "var(--rep-surface-base)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-medium text-[var(--rep-ink-body)] truncate">
                    {a.displayLabel}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "var(--rep-surface-raised)", color: "var(--rep-ink-muted)" }}
                  >
                    {a.kind}
                  </span>
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0"
                  style={{ color: BAND_ROLE[a.standingBand] ?? "var(--rep-ink-muted)" }}
                >
                  {a.ratificationRequired && <ShieldCheck className="h-3 w-3" />}
                  {a.standingBand}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--rep-ink-muted)]">
                <span className="font-mono">{a.ref}</span>
                <span>
                  {a.lifecycleState} · {a.versionStatus} · reach {a.reach} · {a.provenanceSource}
                </span>
              </div>
              {a.governingInvariants.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.governingInvariants.map((inv) => (
                    <span key={inv} className="font-mono text-[9.5px] text-[var(--rep-ink-muted)]">
                      {inv}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
