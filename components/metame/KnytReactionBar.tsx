"use client";

/**
 * KnytReactionBar
 *
 * Lightweight reaction row for Living Canon publication cards.
 * Supports toggle-mode reactions: spark / like / question / canon_worthy.
 *
 * Props:
 *   publicationId  — knyt_publication_states.id
 *   personaId      — current viewer's persona (null = read-only display)
 *   initialCounts  — optional pre-fetched counts (avoids extra fetch on mount)
 *
 * Optimistically updates the count on click; rolls back on error.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Zap, Heart, HelpCircle, Crown, Loader2 } from "lucide-react";

type ReactionType = "spark" | "like" | "question" | "canon_worthy";

interface ReactionCounts {
  spark: number;
  like: number;
  question: number;
  canon_worthy: number;
}

const REACTION_CONFIG: Record<
  ReactionType,
  { icon: React.ReactNode; label: string; activeClass: string }
> = {
  spark: {
    icon: <Zap className="h-3 w-3" />,
    label: "Spark",
    activeClass: "border-yellow-400/40 bg-yellow-500/15 text-yellow-200",
  },
  like: {
    icon: <Heart className="h-3 w-3" />,
    label: "Like",
    activeClass: "border-pink-400/40 bg-pink-500/15 text-pink-200",
  },
  question: {
    icon: <HelpCircle className="h-3 w-3" />,
    label: "Question",
    activeClass: "border-blue-400/40 bg-blue-500/15 text-blue-200",
  },
  canon_worthy: {
    icon: <Crown className="h-3 w-3" />,
    label: "Canon?",
    activeClass: "border-violet-400/40 bg-violet-500/15 text-violet-200",
  },
};

const REACTION_ORDER: ReactionType[] = ["spark", "like", "question", "canon_worthy"];
const EMPTY_COUNTS: ReactionCounts = { spark: 0, like: 0, question: 0, canon_worthy: 0 };

export interface KnytReactionBarProps {
  publicationId: string;
  personaId?: string | null;
  initialCounts?: ReactionCounts;
}

export function KnytReactionBar({ publicationId, personaId, initialCounts }: KnytReactionBarProps) {
  const [counts, setCounts] = useState<ReactionCounts>(initialCounts ?? EMPTY_COUNTS);
  const [active, setActive] = useState<Set<ReactionType>>(new Set());
  const [loadingType, setLoadingType] = useState<ReactionType | null>(null);
  const [fetched, setFetched] = useState(!!initialCounts);

  const fetchReactions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ publication_id: publicationId });
      if (personaId) params.set("persona_id", personaId);
      const res = await fetch(`/api/codex/knyt/living-canon/react?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCounts(data.counts ?? EMPTY_COUNTS);
      setActive(new Set(data.persona_reactions ?? []));
    } catch {
      // Non-fatal — reactions are decorative
    } finally {
      setFetched(true);
    }
  }, [publicationId, personaId]);

  useEffect(() => {
    if (!fetched) void fetchReactions();
  }, [fetched, fetchReactions]);

  const handleReact = async (type: ReactionType) => {
    if (!personaId || loadingType) return;

    // Optimistic update
    const wasActive = active.has(type);
    const delta = wasActive ? -1 : 1;
    setCounts((prev) => ({ ...prev, [type]: Math.max(0, (prev[type] ?? 0) + delta) }));
    setActive((prev) => {
      const next = new Set(prev);
      wasActive ? next.delete(type) : next.add(type);
      return next;
    });

    setLoadingType(type);
    try {
      const res = await fetch("/api/codex/knyt/living-canon/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publication_id: publicationId, persona_id: personaId, reaction_type: type }),
      });
      if (!res.ok) throw new Error("Reaction failed");
    } catch {
      // Roll back optimistic update
      setCounts((prev) => ({ ...prev, [type]: Math.max(0, (prev[type] ?? 0) - delta) }));
      setActive((prev) => {
        const next = new Set(prev);
        wasActive ? next.add(type) : next.delete(type);
        return next;
      });
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {REACTION_ORDER.map((type) => {
        const cfg = REACTION_CONFIG[type];
        const isActive = active.has(type);
        const isLoading = loadingType === type;
        const count = counts[type] ?? 0;

        return (
          <button
            key={type}
            type="button"
            title={cfg.label}
            onClick={() => void handleReact(type)}
            disabled={!personaId || !!loadingType}
            className={[
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition",
              isActive
                ? cfg.activeClass
                : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10",
              !personaId ? "cursor-default" : "cursor-pointer",
              loadingType && !isLoading ? "opacity-40" : "",
            ].filter(Boolean).join(" ")}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : cfg.icon}
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
