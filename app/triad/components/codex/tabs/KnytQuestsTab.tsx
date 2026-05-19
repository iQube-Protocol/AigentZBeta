"use client";

import { useCallback } from "react";
import {
  Users,
  Flame,
  Trophy,
  Sparkles,
  Share2,
  BookOpen,
  ArrowRight,
  Crown,
  ScrollText,
  Vote,
  Compass,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tryOpenInMountedCartridge } from "@/services/cartridge/CartridgePresenceRegistry";

interface KnytQuestsTabProps {
  personaId?: string;
}

interface ArchetypeChip {
  slug: string;
  title: string;
  reward: string;
}

const LIVING_CANON_ARCHETYPES: ArchetypeChip[] = [
  { slug: "knyt:observation",          title: "Observation",                  reward: "+0.25 KNYT" },
  { slug: "knyt:lore_note",            title: "Lore Note",                    reward: "+0.75 KNYT" },
  { slug: "knyt:scene_proposal",       title: "Scene Proposal",               reward: "+1 KNYT" },
  { slug: "knyt:character_perspective",title: "Character Perspective",        reward: "+0.5 KNYT" },
  { slug: "knyt:world_report",         title: "World Report",                 reward: "+0.75 KNYT" },
  { slug: "knyt:theory",               title: "Canon Theory Thread",          reward: "0.5 KNYT on acceptance" },
  { slug: "knyt:community_submission", title: "21 Sats Community Submission", reward: "0.5 KNYT on acceptance" },
  { slug: "knyt:correspondent_report", title: "Correspondent Report",         reward: "+1.5 KNYT" },
  { slug: "knyt:dispatch",             title: "Correspondent Dispatch",       reward: "0.75 KNYT on acceptance" },
];

export function KnytQuestsTab({ personaId: _personaId }: KnytQuestsTabProps) {
  // Park the archetype slug for the 21 Sats tab to pre-select on mount,
  // then switch the cartridge to the destination tab. Mirrors the wallet
  // drawer's navigateToKnytTab pattern (SmartWalletDrawer.tsx:1528).
  const openCanonArchetype = useCallback((taskSlug: string) => {
    if (typeof window !== "undefined") {
      (window as unknown as { __knytPendingTaskSlug?: string }).__knytPendingTaskSlug = taskSlug;
    }
    const opened = tryOpenInMountedCartridge({ cartridgeId: "knyt-codex", tab: "living-canon" });
    if (opened && typeof window !== "undefined") {
      // If 21 Sats is already mounted, fire the live event so it re-routes
      // in place — mount-time effects won't re-fire.
      window.dispatchEvent(new CustomEvent("knyt:living-canon-set-branch", { detail: { taskSlug } }));
    }
  }, []);

  const openScrolls = useCallback(() => {
    tryOpenInMountedCartridge({ cartridgeId: "knyt-codex", tab: "scrolls" });
  }, []);

  // Bring-a-Knight and Herald share actions live in the wallet drawer (it
  // owns the share-link issuance flow). From the canonical Quests surface
  // we surface the explanation + reward model; the actual share button is
  // one click away in the wallet.

  return (
    <div className="grid gap-4 p-4 md:p-6">
      {/* Header */}
      <Card className="rounded-xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-purple-200">
            <Crown className="h-5 w-5" />
            KNYT Quests — Order of Metaiye
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-300 space-y-2">
          <p>
            Four task families, one ladder. Each family rewards a different mode of participation —
            from inviting others to join the Order, to sustained engagement with the canon, to
            contributing the lore the Order is built on.
          </p>
          <p className="text-xs text-slate-400">
            Your personal progress, claimable rewards, and next-best action appear in your{" "}
            <span className="text-purple-300">Order</span> tab and{" "}
            <span className="text-purple-300">Wallet</span>. This page is the canonical library —
            what each quest is, how it pays, and where to go.
          </p>
        </CardContent>
      </Card>

      {/* Bring a Knight */}
      <Card className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 to-blue-950/20 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2 text-cyan-200">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Bring a Knight
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
              +2 KNYT per qualified referral
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-slate-300">
            Invite friends to join the Order. When an invited persona makes their first qualifying
            purchase, you earn 2 KNYT. Referrals carry your handle through the signup so the
            attribution returns to you, not the platform.
          </p>
          <p className="text-xs text-slate-400">
            Reward type: <span className="text-cyan-300">BringAKnightQualifiedReferral</span> ·
            Verification: usage-based ·
            Reputation weight: community + entrepreneurial
          </p>
          <p className="text-xs text-slate-500">
            Share your invite from the <span className="text-cyan-300">Wallet → Tasks</span> tab —
            it generates a per-persona link that tracks clicks, signups, and conversions.
          </p>
        </CardContent>
      </Card>

      {/* Knight of Attention */}
      <Card className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-950/30 to-fuchsia-950/20 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2 text-purple-200">
            <span className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" />
              Knight of Attention
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
              +0.5 KNYT per episode · streak bonuses
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-slate-300">
            Complete episodes to earn rewards. Build weekly streaks (2 episodes/week) for bonus
            KNYT on top of the per-episode reward. Streaks compound — the longer you sustain, the
            larger the bonus.
          </p>
          <p className="text-xs text-slate-400">
            Reward types: <span className="text-purple-300">KnightOfAttentionEpisodeComplete</span>,{" "}
            <span className="text-purple-300">WeeklyStreak</span>,{" "}
            <span className="text-purple-300">StreakBonus</span> ·
            Reputation weight: creative + community
          </p>
          <button
            type="button"
            onClick={openScrolls}
            className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Open Episodes
            <ArrowRight className="h-3 w-3" />
          </button>
        </CardContent>
      </Card>

      {/* Herald of the Order */}
      <Card className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-orange-950/20 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2 text-amber-200">
            <span className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Herald of the Order
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
              +0.25 KNYT per click · escalates with signups + conversions
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-slate-300">
            Share canon content — episodes, character pages, lore — and earn when others click,
            sign up, or purchase through your link. The reward ladder rises as attribution
            deepens: click → signup → first purchase.
          </p>
          <p className="text-xs text-slate-400">
            Reward types: <span className="text-amber-300">HeraldCuriosityClicks</span>,{" "}
            <span className="text-amber-300">AudienceSignups</span>,{" "}
            <span className="text-amber-300">ConversionPayingUser</span> ·
            Reputation weight: community + entrepreneurial
          </p>
          <p className="text-xs text-slate-500">
            Issue your Herald link from the <span className="text-amber-300">Wallet → Tasks</span>{" "}
            tab. Targets: 10 clicks · 3 signups for the next ladder rung.
          </p>
        </CardContent>
      </Card>

      {/* Living Canon — 21 Sats */}
      <Card className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-950/30 to-amber-950/20 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2 text-amber-100">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Living Canon — 21 Sats
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
              9 contribution archetypes
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="text-slate-300">
            The Living Canon is the community-authored extension of the 21 Sats world. Three rungs
            of participation — vote on open elections, submit a contribution, or file a
            Correspondent dispatch.
          </p>

          {/* Primary rungs */}
          <div className="grid gap-1.5">
            <button
              type="button"
              onClick={() => openCanonArchetype("knyt:living-canon-vote")}
              className="w-full flex items-center justify-between rounded-lg bg-white/5 hover:bg-white/10 transition px-3 py-2 text-left"
            >
              <span className="flex items-center gap-2 text-xs text-white/80">
                <Vote className="h-3.5 w-3.5 text-amber-300" />
                Vote on open elections
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">
                +21 KNYT
              </span>
            </button>
            <button
              type="button"
              onClick={() => openCanonArchetype("knyt:community_submission")}
              className="w-full flex items-center justify-between rounded-lg bg-white/5 hover:bg-white/10 transition px-3 py-2 text-left"
            >
              <span className="flex items-center gap-2 text-xs text-white/80">
                <ScrollText className="h-3.5 w-3.5 text-cyan-300" />
                Submit a community contribution
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                PoKW
              </span>
            </button>
            <button
              type="button"
              onClick={() => openCanonArchetype("knyt:correspondent_report")}
              className="w-full flex items-center justify-between rounded-lg bg-white/5 hover:bg-white/10 transition px-3 py-2 text-left"
            >
              <span className="flex items-center gap-2 text-xs text-white/80">
                <Compass className="h-3.5 w-3.5 text-violet-300" />
                File a Correspondent dispatch
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">
                Featured
              </span>
            </button>
          </div>

          {/* Archetypes */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
              All archetypes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {LIVING_CANON_ARCHETYPES.map((a) => (
                <button
                  key={a.slug}
                  type="button"
                  onClick={() => openCanonArchetype(a.slug)}
                  className="flex items-center justify-between rounded-md bg-white/[0.03] hover:bg-white/10 transition px-2.5 py-1.5 text-left ring-1 ring-white/5"
                >
                  <span className="text-[11px] text-white/75 truncate">{a.title}</span>
                  <span className="text-[10px] text-amber-300/80 shrink-0 ml-2">{a.reward}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-white/40">
            Each archetype opens the 21 Sats tab with the matching submission schema preloaded.
          </p>
        </CardContent>
      </Card>

      {/* Footer pointer */}
      <Card className="rounded-xl border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm">
        <CardContent className="py-3 text-xs text-slate-400 flex items-start gap-2">
          <Share2 className="h-3.5 w-3.5 mt-0.5 text-slate-500 shrink-0" />
          <span>
            Looking for your personal task progress, claimable rewards, or next-best action? Open
            the <span className="text-slate-200">Order</span> tab or your{" "}
            <span className="text-slate-200">Wallet</span> drawer.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
