"use client";

/**
 * KnytLivingCanonTemplate
 *
 * Platform-side rendering for the Living Canon tab (knyt:living_canon_v1).
 *
 * Surfaces:
 *   - Branch selector: Canon / Community / Correspondent
 *   - Publication list per branch with KnytReactionBar on each item
 *   - Sidebar: KnytSubmissionShell (contributor-gated) + KnytStewardReview (steward-gated)
 *   - Correspondent branch: swaps sidebar for KnytCorrespondentHub
 *
 * Data source: /api/codex/knyt/living-canon?branch=<branch>
 */

import React, { useCallback, useEffect, useState } from "react";
import { Layers, Loader2, BookOpen, Users, Radio, RefreshCw } from "lucide-react";
import { BranchLabel, PublicationStateBadge } from "@/components/ui/BranchLabel";
import { KnytReactionBar } from "@/components/metame/KnytReactionBar";
import { KnytRemixButton } from "@/components/metame/KnytRemixButton";
import { KnytSubmissionShell } from "@/components/metame/KnytSubmissionShell";
import { KnytStewardReview } from "@/components/metame/KnytStewardReview";
import { KnytCorrespondentHub } from "@/components/metame/KnytCorrespondentHub";

// ─── Types ───────────────────────────────────────────────────────────────────

type CanonBranch = "canon" | "community" | "correspondent";

interface PublicationItem {
  id: string;
  subject_type: string;
  subject_id: string;
  branch: CanonBranch;
  state: string;
  elevated_at: string | null;
  created_at: string;
  autodrive_cid: string | null;
}

interface BranchData {
  items: PublicationItem[];
  total: number;
}

// ─── Branch config ────────────────────────────────────────────────────────────

const BRANCH_CONFIG: Record<
  CanonBranch,
  { label: string; icon: React.ReactNode; description: string; schemaSlug: string }
> = {
  canon: {
    label: "Canon",
    icon: <BookOpen className="h-3.5 w-3.5" />,
    description: "Immutable canon — elevated by stewards, preserved on-chain.",
    schemaSlug: "knyt:dispatch",
  },
  community: {
    label: "Community",
    icon: <Users className="h-3.5 w-3.5" />,
    description: "Community submissions — vote, react, and contribute.",
    schemaSlug: "knyt:community_submission",
  },
  correspondent: {
    label: "Correspondent",
    icon: <Radio className="h-3.5 w-3.5" />,
    description: "Dispatches from KNYT Correspondents.",
    schemaSlug: "knyt:correspondent_report",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface KnytLivingCanonTemplateProps {
  personaId?: string;
  /** Persona entitlements for submission gating */
  entitlements?: string[];
  /** If true, show steward review panel (caller determines role) */
  isSteward?: boolean;
  theme?: "light" | "dark";
  density?: "narrow" | "wide";
}

// ─── Publication card ─────────────────────────────────────────────────────────

function PublicationCard({
  item,
  personaId,
  entitlements,
  onRemixCreated,
}: {
  item: PublicationItem;
  personaId?: string;
  entitlements?: string[];
  onRemixCreated?: (pubId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <BranchLabel branch={item.branch} />
        <PublicationStateBadge state={item.state as import("@/components/ui/BranchLabel").PublicationState} />
        <span className="text-[11px] text-slate-500 capitalize ml-auto">
          {item.subject_type.replace(/_/g, " ")}
        </span>
      </div>

      <div className="text-[11px] font-mono text-slate-600 truncate select-none">{item.subject_id}</div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <KnytReactionBar
          publicationId={item.id}
          personaId={personaId ?? null}
        />
        <div className="flex items-center gap-2 shrink-0">
          {/* Remix available on canon + community items for authenticated personas */}
          {personaId && item.branch !== "correspondent" && (
            <KnytRemixButton
              publicationId={item.id}
              sourceLabel={`${item.subject_type} (${item.branch})`}
              personaId={personaId}
              entitlements={entitlements ?? []}
              onRemixCreated={onRemixCreated}
            />
          )}
          <span className="text-[10px] text-slate-600">
            {item.elevated_at
              ? new Date(item.elevated_at).toLocaleDateString()
              : new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {item.autodrive_cid && (
        <div className="text-[10px] text-violet-400/60 font-mono truncate">
          ⛓ {item.autodrive_cid}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KnytLivingCanonTemplate({
  personaId,
  entitlements = [],
  isSteward = false,
  theme = "dark",
}: KnytLivingCanonTemplateProps) {
  const [activeBranch, setActiveBranch] = useState<CanonBranch>("canon");
  const [branchData, setBranchData] = useState<BranchData>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [submissionSlug, setSubmissionSlug] = useState<string | null>(null);

  const loadBranch = useCallback(async (branch: CanonBranch) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/codex/knyt/living-canon?branch=${branch}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load branch.");
      const data = await res.json();
      // API returns branch-specific items
      const items: PublicationItem[] =
        data[branch] ?? data.items ?? [];
      setBranchData({ items, total: data.total ?? items.length });
    } catch {
      setBranchData({ items: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBranch(activeBranch);
  }, [activeBranch, loadBranch]);

  const handleBranchChange = (branch: CanonBranch) => {
    setActiveBranch(branch);
    setSubmissionSlug(null);
  };

  const isDark = theme === "dark";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="px-1 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-300/80">
              <Layers className="h-4 w-4 text-amber-400" />
              Living Canon — 21 Sats
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {BRANCH_CONFIG[activeBranch].description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadBranch(activeBranch)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        {/* Branch tabs */}
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {(Object.keys(BRANCH_CONFIG) as CanonBranch[]).map((branch) => {
            const cfg = BRANCH_CONFIG[branch];
            const isActive = activeBranch === branch;
            return (
              <button
                key={branch}
                type="button"
                onClick={() => handleBranchChange(branch)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                  isActive
                    ? branch === "canon"
                      ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                      : branch === "community"
                      ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-200"
                      : "border-amber-400/40 bg-amber-500/15 text-amber-200"
                    : "border-white/10 bg-white/5 text-slate-400 hover:text-white",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Publication list */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading {BRANCH_CONFIG[activeBranch].label}…
            </div>
          ) : branchData.items.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-slate-400">
              No {BRANCH_CONFIG[activeBranch].label} items yet.
              {activeBranch === "community" && personaId && (
                <button
                  type="button"
                  onClick={() => setSubmissionSlug(BRANCH_CONFIG[activeBranch].schemaSlug)}
                  className="ml-2 text-cyan-400 hover:text-cyan-300 transition"
                >
                  Be the first to contribute →
                </button>
              )}
            </div>
          ) : (
            branchData.items.map((item) => (
              <PublicationCard
                key={item.id}
                item={item}
                personaId={personaId}
                entitlements={entitlements}
                onRemixCreated={() => void loadBranch("community")}
              />
            ))
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {activeBranch === "correspondent" && personaId ? (
            <KnytCorrespondentHub
              personaId={personaId}
              onLaunchSubmission={(slug) => setSubmissionSlug(slug)}
            />
          ) : (
            <>
              {/* Contribute button / shell */}
              {personaId && activeBranch !== "canon" && (
                <div>
                  {submissionSlug ? (
                    <KnytSubmissionShell
                      schemaSlug={submissionSlug}
                      personaId={personaId}
                      entitlements={entitlements}
                      onSubmitted={() => {
                        setSubmissionSlug(null);
                        void loadBranch(activeBranch);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setSubmissionSlug(BRANCH_CONFIG[activeBranch].schemaSlug)
                      }
                      className="w-full rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200 text-left transition hover:bg-cyan-500/10"
                    >
                      <div className="font-medium">+ Contribute to {BRANCH_CONFIG[activeBranch].label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Submit to the {activeBranch} branch for review
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Steward review panel */}
              {isSteward && personaId && (
                <KnytStewardReview
                  actorPersonaId={personaId}
                  branch={activeBranch === "canon" ? undefined : activeBranch}
                />
              )}

              {!personaId && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-slate-500">
                  Sign in to vote, react, and contribute.
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
