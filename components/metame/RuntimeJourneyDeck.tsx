"use client";

/**
 * RuntimeJourneyDeck — User-facing journey card framework
 *
 * COD-401: Base card framework
 * COD-402: Goals card
 * COD-403: Journey/Stage card
 * COD-404: Matrix status card
 * COD-405: Next Best Experience card
 * COD-406: Why This Now card
 * COD-407: Unlocks Ahead card
 * COD-408: Active Guide / Handoff card
 * COD-409: KNYT recognition flow
 */

import { useEffect, useState } from "react";
import { ArrowRight, Compass, Layers, Lightbulb, Lock, Sparkles, Target, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CardData = {
  goals: { summary: string; strategy_name: string; segments: string[] } | null;
  stage: {
    current_stage: string;
    current_depth: string;
    next_stage: string | null;
    completed_count: number;
    active_at: string | null;
  } | null;
  matrix: {
    current_stage: string | null;
    available_depths: string[];
    current_depth: string | null;
    progress_pct: number;
  } | null;
  nbe: {
    disposition: string;
    next_depth: string | null;
    experience_id: string;
    cta: string | null;
  } | null;
  why: { rationale: string; source: string } | null;
  unlocks: {
    next_stage: string | null;
    next_depth: string | null;
    hint: string;
  } | null;
  handoff: {
    active_agent: string;
    reason: string;
    stage: string | null;
  };
};

type DeckData = {
  persona_id: string;
  has_journey: boolean;
  knyt_recognition: { recognized: boolean; stage?: string; message: string };
  cards: CardData;
};

const DISPOSITION_STYLES: Record<string, string> = {
  act: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  ask: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  wait: "border-slate-600 bg-slate-800/60 text-slate-400",
  escalate: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  deny: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  acolyte: "Acolyte",
  keta: "Keta",
  keji: "Keji",
  first: "First",
  zero: "Zero",
};

function Card({ icon, title, children }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {title}
      </div>
      <div className="text-sm text-slate-200">{children}</div>
    </div>
  );
}

interface RuntimeJourneyDeckProps {
  personaId: string;
  onNBEAction?: (experienceId: string, disposition: string) => void;
  className?: string;
}

export function RuntimeJourneyDeck({ personaId, onNBEAction, className = "" }: RuntimeJourneyDeckProps) {
  const [data, setData] = useState<DeckData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personaId) return;
    setLoading(true);
    fetch(`/api/runtime/journey/cards?personaId=${encodeURIComponent(personaId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [personaId]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 text-slate-400 text-sm ${className}`}>
        Loading your journey…
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400 ${className}`}>
        Journey data unavailable. Please try again.
      </div>
    );
  }

  const { knyt_recognition: rec, cards, has_journey } = data;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* COD-409 — KNYT recognition banner */}
      {rec.recognized && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 flex items-center gap-3">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
          <div>
            <div className="text-xs font-semibold text-violet-300">
              {STAGE_LABELS[rec.stage ?? ""] ?? rec.stage}
            </div>
            <div className="text-xs text-slate-300">{rec.message}</div>
          </div>
        </div>
      )}

      {!has_journey && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-6 text-center">
          <Compass className="h-8 w-8 mx-auto mb-2 text-slate-500" />
          <div className="text-sm text-slate-300 font-semibold">Begin Your Journey</div>
          <div className="text-xs text-slate-400 mt-1">{rec.message}</div>
        </div>
      )}

      {has_journey && (
        <div className="grid gap-3 md:grid-cols-2">
          {/* COD-402 — Goals card */}
          {cards.goals && (
            <Card icon={<Target className="h-3.5 w-3.5" />} title="Your Goals">
              <div>{cards.goals.summary}</div>
              {cards.goals.segments.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {cards.goals.segments.map((s) => (
                    <Badge key={s} variant="outline" className="border-slate-700 text-slate-400 text-[11px]">{s}</Badge>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* COD-403 — Stage card */}
          {cards.stage && (
            <Card icon={<Compass className="h-3.5 w-3.5" />} title="Your Journey">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-violet-500/40 text-violet-300 capitalize">
                  {STAGE_LABELS[cards.stage.current_stage] ?? cards.stage.current_stage}
                </Badge>
                <span className="text-xs text-slate-400">{cards.stage.current_depth}</span>
                {cards.stage.next_stage && (
                  <>
                    <ArrowRight className="h-3 w-3 text-slate-600" />
                    <span className="text-xs text-slate-500 capitalize">
                      {STAGE_LABELS[cards.stage.next_stage] ?? cards.stage.next_stage}
                    </span>
                  </>
                )}
              </div>
              {cards.stage.completed_count > 0 && (
                <div className="text-xs text-slate-400 mt-1">
                  {cards.stage.completed_count} experience{cards.stage.completed_count !== 1 ? "s" : ""} completed
                </div>
              )}
            </Card>
          )}

          {/* COD-404 — Matrix status card */}
          {cards.matrix && (
            <Card icon={<Layers className="h-3.5 w-3.5" />} title="Your Progress">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${cards.matrix.progress_pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{cards.matrix.progress_pct}%</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {cards.matrix.available_depths.map((d) => (
                  <Badge key={d} variant="outline"
                    className={`text-[11px] ${d === cards.matrix!.current_depth
                      ? "border-violet-500/60 text-violet-300"
                      : "border-slate-700 text-slate-500"}`}>
                    {d}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* COD-405 — NBE card */}
          {cards.nbe && (
            <Card icon={<Zap className="h-3.5 w-3.5" />} title="Next Step">
              <div className="space-y-2">
                <Badge variant="outline"
                  className={`capitalize ${DISPOSITION_STYLES[cards.nbe.disposition] ?? "border-slate-700 text-slate-300"}`}>
                  {cards.nbe.disposition}
                </Badge>
                {cards.nbe.cta && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNBEAction?.(cards.nbe!.experience_id, cards.nbe!.disposition)}
                      className="h-7 text-xs"
                    >
                      {cards.nbe.cta}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* COD-406 — Why card */}
          {cards.why && (
            <Card icon={<Lightbulb className="h-3.5 w-3.5" />} title="Why This Now">
              <div className="text-slate-300">{cards.why.rationale}</div>
            </Card>
          )}

          {/* COD-407 — Unlocks card */}
          {cards.unlocks && (
            <Card icon={<Lock className="h-3.5 w-3.5" />} title="Unlocks Ahead">
              <div className="text-slate-300 text-xs">{cards.unlocks.hint}</div>
              {(cards.unlocks.next_stage || cards.unlocks.next_depth) && (
                <div className="flex gap-1 mt-1.5">
                  {cards.unlocks.next_depth && (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[11px]">
                      {cards.unlocks.next_depth}
                    </Badge>
                  )}
                  {cards.unlocks.next_stage && (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[11px] capitalize">
                      {STAGE_LABELS[cards.unlocks.next_stage] ?? cards.unlocks.next_stage}
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* COD-408 — Handoff card */}
          <Card icon={<Users className="h-3.5 w-3.5" />} title="Your Guide">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-slate-600 text-slate-300 text-[11px]">
                {cards.handoff.active_agent}
              </Badge>
              <span className="text-xs text-slate-400">{cards.handoff.reason}</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default RuntimeJourneyDeck;
