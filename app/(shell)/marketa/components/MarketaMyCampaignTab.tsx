"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  ArrowLeft, Sparkles, Megaphone, Calendar, Zap, CheckCircle2,
  RefreshCw, Clock, Info, ChevronRight,
} from "lucide-react";
import { SequenceDayCard } from "./SequenceDayCard";
import { PartnerJourneySteps } from "./PartnerJourneySteps";
import { VideoModal, VideoItem } from "@agentiq/smarttriad";
import { CampaignCatalogItem, CampaignDetail, CampaignStatusResult, CAMPAIGN_21_AWAKENINGS_ID, MarketaSequenceItem } from "@/types/marketaCampaigns";
import { bridgeGet, bridgePost, trackEngagement } from "./bridgeFetch";
import { cn } from "@/utils/cn";

interface Props {
  theme?: "dark" | "light";
  partnerId?: string;
  personaId?: string;
  previewCampaignId?: string;
}

type CatalogTab = "available" | "joined";
type DetailTab = "join" | "sequence" | "details" | "status";

const CHANNELS = ["x", "instagram", "tiktok", "linkedin", "newsletter", "youtube", "podcast"] as const;

// ── Theme tokens ─────────────────────────────────────────────────────────────
function t(dark: boolean) {
  return {
    page:    dark ? "text-white/90"                           : "text-black/80",
    sub:     dark ? "text-white/50"                           : "text-black/45",
    muted:   dark ? "text-white/30"                           : "text-black/30",
    card:    dark ? "bg-white/[0.03] border-white/[0.07]"     : "bg-white border-black/[0.08]",
    infoCard:dark ? "bg-rose-500/[0.06] border-rose-500/20"   : "bg-rose-50 border-rose-200",
    featured:dark ? "bg-rose-500/[0.05] border-rose-500/40"   : "bg-rose-50/80 border-rose-400",
    div:     dark ? "border-white/[0.07]"                     : "border-black/[0.07]",
    inp:     dark ? "bg-white/[0.04] border-white/10 text-white/80" : "bg-white border-black/10 text-black/80",
    tabOn:   dark ? "border-b-2 border-white/80 text-white/90 font-semibold" : "border-b-2 border-black/80 text-black/80 font-semibold",
    tabOff:  dark ? "text-white/40 hover:text-white/70"       : "text-black/35 hover:text-black/65",
    catTabOn:dark ? "bg-white/[0.08] text-white/90"           : "bg-black/[0.06] text-black/80",
    catTabOff:dark ? "text-white/50 hover:text-white/80"      : "text-black/40 hover:text-black/70",
    chip:    dark ? "border-white/[0.12] text-white/50"        : "border-black/[0.10] text-black/45",
    btnGhost:dark ? "border-white/[0.12] text-white/60 hover:text-white/90 hover:border-white/25" : "border-black/[0.12] text-black/55 hover:text-black/85",
  };
}

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  return type === "sequence"
    ? <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-rose-500/50 bg-rose-500/20 text-rose-300 font-semibold backdrop-blur-sm">Sequence</span>
    : <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-amber-500/50 bg-amber-500/20 text-amber-300 font-semibold backdrop-blur-sm">One-off</span>;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ joined }: { joined: boolean }) {
  return joined
    ? <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-500/40 text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Joined</span>
    : <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/20 text-white/60 font-medium">Not Joined</span>;
}

// ── Campaign catalog card ─────────────────────────────────────────────────────
function CampaignCard({ c, dark, onView, onJoin }: { c: CampaignCatalogItem; dark: boolean; onView: () => void; onJoin: () => void }) {
  const s = t(dark);
  const is21 = c.id === CAMPAIGN_21_AWAKENINGS_ID;
  return (
    <div className={cn("rounded-2xl border p-5 space-y-4 transition-all", is21 ? s.featured : s.card)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {is21 && <Sparkles className="w-5 h-5 text-rose-400 flex-shrink-0" />}
          <h3 className={cn("font-bold text-base truncate", s.page)}>{c.name}</h3>
        </div>
        <TypeBadge type={c.campaign_type} />
      </div>

      <p className={cn("text-sm leading-relaxed", s.sub)}>{c.description}</p>

      <div className="flex items-center gap-4">
        {c.duration_days && (
          <span className={cn("flex items-center gap-1.5 text-sm", s.sub)}>
            <Calendar className="w-3.5 h-3.5" />
            {c.duration_days} days
          </span>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(c.channels ?? []).slice(0, 5).map((ch) => (
            <span key={ch} className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", s.chip)}>{ch}</span>
          ))}
        </div>
      </div>

      {c.is_joined ? (
        <button onClick={onView} className={cn("w-full text-sm py-2 rounded-xl border font-medium transition-colors", s.btnGhost)}>
          View Status <ChevronRight className="inline w-3.5 h-3.5" />
        </button>
      ) : (
        <div className="flex gap-3">
          <button onClick={onView} className={cn("flex-1 text-sm py-2 rounded-xl border font-medium transition-colors", s.btnGhost)}>
            View Campaign
          </button>
          <button onClick={onJoin} className="flex-1 text-sm py-2 rounded-xl border border-rose-500/50 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold transition-colors flex items-center justify-center gap-1.5 backdrop-blur-sm">
            Join Campaign <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function MarketaMyCampaignTab({ theme = "dark", partnerId, personaId, previewCampaignId }: Props) {
  const dark = theme === "dark";
  const s = t(dark);
  const pid = personaId ?? partnerId ?? "qriptiq@knyt";
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();

  function navigateToTab(slug: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", slug);
    router.push(`${pathname}?${params.toString()}`);
  }

  // catalog
  const [catalog, setCatalog]           = useState<CampaignCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogTab, setCatalogTab]     = useState<CatalogTab>("available");

  // detail
  const [selectedId, setSelectedId]     = useState<string | null>(previewCampaignId ?? null);
  const [detail, setDetail]             = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus]             = useState<CampaignStatusResult | null>(null);
  const [detailTab, setDetailTab]       = useState<DetailTab>("sequence");

  // in-app video player
  const [playerOpen, setPlayerOpen]     = useState(false);
  const [playerItems, setPlayerItems]   = useState<VideoItem[]>([]);
  const [playerIndex, setPlayerIndex]   = useState(0);

  // join form
  const [selChannels, setSelChannels]   = useState<string[]>([]);
  const [startDate, setStartDate]       = useState("");
  const [approved, setApproved]         = useState(false);
  const [joining, setJoining]           = useState(false);
  const [joinErr, setJoinErr]           = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess]   = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load catalog ────────────────────────────────────────────────────────────
  useEffect(() => {
    bridgeGet<{
      available_campaigns?: Array<{ id: string; name: string; description?: string; campaign_type: string; sequence_length?: number; metadata?: { channels?: string[] }; channels?: string[] }>;
      joined_campaigns?: Array<{ campaign_id: string; marketa_campaigns?: { id: string; name: string; description?: string; campaign_type: string; sequence_length?: number } }>;
    }>("campaign_catalog", {}, pid)
      .then(({ available_campaigns = [], joined_campaigns = [] }) => {
        const map = new Map<string, CampaignCatalogItem>();
        for (const c of available_campaigns) {
          map.set(c.id, { id: c.id, name: c.name, description: c.description ?? "", campaign_type: c.campaign_type as CampaignCatalogItem["campaign_type"], duration_days: c.sequence_length, channels: (c.channels ?? (c.metadata as { channels?: string[] })?.channels ?? []), is_joined: false });
        }
        for (const jc of joined_campaigns) {
          const mc = jc.marketa_campaigns;
          if (!mc) continue;
          map.set(mc.id, { id: mc.id, name: mc.name, description: mc.description ?? "", campaign_type: mc.campaign_type as CampaignCatalogItem["campaign_type"], duration_days: mc.sequence_length, channels: [], is_joined: true });
        }
        setCatalog(Array.from(map.values()));
      })
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, [pid]);

  // ── Load detail ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetail(null);
    bridgeGet<{ success: boolean; campaign: CampaignDetail }>("campaign_detail", { campaignId: selectedId }, pid)
      .then(({ campaign }) => {
        setDetail(campaign ?? null);
        const joined = catalog.find((c) => c.id === selectedId)?.is_joined;
        setDetailTab(joined ? "sequence" : "sequence");
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedId, pid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll status ─────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(() => {
    if (!selectedId) return;
    bridgeGet<{ campaign?: { sequence_length?: number }; tenant_config?: { current_day?: number; joined_at?: string; status?: string } | null }>("campaign_status", { campaignId: selectedId }, pid)
      .then(({ campaign, tenant_config }) => {
        setStatus({ is_joined: !!tenant_config, current_day: tenant_config?.current_day ?? 0, total_days: campaign?.sequence_length ?? 22, joined_at: tenant_config?.joined_at ?? null, status: tenant_config?.status ?? "not_joined", delivery_receipts: [] });
      })
      .catch(() => {});
  }, [selectedId, pid]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  // ── Restore partner channel prefs ───────────────────────────────────────────
  useEffect(() => {
    if (!partnerId) return;
    fetch(`/api/avl/partners/${partnerId}`).then((r) => r.json()).then((d) => {
      if (d.ok && d.data?.notes) try {
        const n = JSON.parse(d.data.notes);
        if (Array.isArray(n.preferred_channels)) setSelChannels(n.preferred_channels);
        if (n.campaign_start_date) setStartDate(n.campaign_start_date);
      } catch { /* not json */ }
    }).catch(() => {});
  }, [partnerId]);

  // ── Join ────────────────────────────────────────────────────────────────────
  async function handleJoin() {
    if (!selectedId || joining) return;
    setJoining(true); setJoinErr(null);
    try {
      await bridgePost("join_campaign", { campaignId: selectedId, channels: selChannels, startDate: startDate || new Date().toISOString().split("T")[0], publishingMode: "automation" }, pid);
      setCatalog((prev) => prev.map((c) => c.id === selectedId ? { ...c, is_joined: true } : c));
      if (partnerId) {
        fetch("/api/avl/partners", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: partnerId, outreach_status: "engaged", notes: JSON.stringify({ preferred_channels: selChannels, campaign_start_date: startDate }) }) }).catch(() => {});
      }
      setJoinSuccess(true);
      setDetailTab("sequence");
      fetchStatus();
    } catch (e: unknown) {
      setJoinErr(e instanceof Error ? e.message : "Join failed");
    } finally {
      setJoining(false);
    }
  }

  const isJoined = joinSuccess || status?.is_joined || catalog.find((c) => c.id === selectedId)?.is_joined || false;
  const is21 = selectedId === CAMPAIGN_21_AWAKENINGS_ID;
  const items = (detail?.marketa_sequence_items ?? []).slice().sort((a, b) => a.day_number - b.day_number);
  const explainers = items.filter((i) => i.explainer);
  const days = items.filter((i) => !i.explainer);
  const previewThumbs = items.slice(0, 3).map((i) => i.thumbnail_url).filter(Boolean) as string[];
  const detailTabs: DetailTab[] = isJoined ? ["sequence", "status", "details"] : ["join", "sequence", "details"];

  const available = catalog.filter((c) => !c.is_joined);
  const joined    = catalog.filter((c) => c.is_joined);

  // Only direct video files (Supabase storage or known video extensions) go into the VideoModal playlist
  function isDirectVideo(url: string) {
    return url.includes("supabase.co/storage") || /\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(url);
  }
  function buildPlaylist(sourceItems: MarketaSequenceItem[]) {
    return sourceItems
      .filter((i) => i.cta_url && !i.cta_url.startsWith("smart_content_qubes:") && isDirectVideo(i.cta_url))
      .map((i) => ({ id: i.id, title: `Day ${i.day_number} — ${i.title}`, videoUrl: i.cta_url! }));
  }

  function openPlayer(item: MarketaSequenceItem) {
    const playlist = buildPlaylist(items);
    const idx = playlist.findIndex((v) => v.id === item.id);
    setPlayerItems(playlist);
    setPlayerIndex(idx >= 0 ? idx : 0);
    setPlayerOpen(true);
    trackEngagement({ campaign_id: selectedId!, event_type: "cta_click", sequence_day: item.day_number, asset_ref: item.asset_ref ?? undefined, persona_id: pid });
  }

  // ── CATALOG VIEW ─────────────────────────────────────────────────────────────
  if (!selectedId) {
    return (
      <div className="space-y-5 p-3 sm:p-4 lg:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className={cn("text-xl font-bold", s.page)}>Campaigns</h2>
            <p className={cn("text-sm mt-0.5", s.sub)}>Join coordinated campaigns (sequences) or propose your own one-off campaign</p>
          </div>
          <button
            onClick={() => navigateToTab("propose-campaign")}
            className="flex-shrink-0 flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-rose-500/50 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold transition-colors backdrop-blur-sm"
          >
            + Propose Campaign
          </button>
        </div>

        {/* Journey stepper */}
        <PartnerJourneySteps
          currentStep={joined.length > 0 ? 2 : 1}
          dark={dark}
        />

        {/* Explainer card */}
        <div className={cn("rounded-2xl border p-4 space-y-2", dark ? "bg-white/[0.02] border-white/[0.07]" : "bg-white border-black/[0.07]")}>
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className={cn("text-sm font-semibold", s.page)}>What you&apos;re looking at</span>
          </div>
          <p className={cn("text-xs", s.sub)}>Quick guide to &quot;Campaigns&quot; vs &quot;Content Packs&quot; so it&apos;s easy to navigate.</p>
          <div className={cn("text-xs space-y-1", s.sub)}>
            <p><span className="font-semibold text-white/70">Available</span>: campaigns you can join (not active for you yet).</p>
            <p><span className="font-semibold text-white/70">Joined</span>: campaigns you&apos;ve joined (automation + reporting active).</p>
            <p><span className="font-semibold text-white/70">Sequences</span>: multi-day daily content (e.g. 21 Awakenings). <span className="font-semibold text-white/70">One-off</span>: single campaign with custom assets.</p>
            <p><span className="font-semibold text-white/70">Content Packs</span>: your custom campaign content, built by Marketa AI around your brand. <button onClick={() => navigateToTab("my-packs")} className="text-rose-400 hover:underline">Go to Content Packs →</button></p>
          </div>
        </div>

        {/* Catalog tabs */}
        <div className="flex gap-2">
          {(["available", "joined"] as CatalogTab[]).map((tab) => {
            const count = tab === "available" ? available.length : joined.length;
            return (
              <button key={tab} onClick={() => setCatalogTab(tab)}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                  catalogTab === tab ? s.catTabOn : s.catTabOff
                )}
              >
                {tab === "available" ? <Sparkles className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
              </button>
            );
          })}
        </div>

        {/* Campaign grid */}
        {catalogLoading ? (
          <div className={cn("rounded-2xl border p-10 text-center text-sm", s.card, s.sub)}>Loading campaigns…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(catalogTab === "available" ? available : joined).map((c) => (
              <CampaignCard
                key={c.id} c={c} dark={dark}
                onView={() => setSelectedId(c.id)}
                onJoin={() => { setSelectedId(c.id); setDetailTab("join"); }}
              />
            ))}
            {(catalogTab === "available" ? available : joined).length === 0 && (
              <div className={cn("rounded-2xl border p-10 text-center text-sm", s.card, s.sub)}>
                {catalogTab === "available" ? "No campaigns available yet." : "You haven't joined any campaigns yet."}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-3 sm:p-4 lg:p-5">

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <button onClick={() => { setSelectedId(null); setDetail(null); setJoinSuccess(false); }}
              className={cn("mt-0.5 flex-shrink-0", s.sub, "hover:opacity-80")}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {is21 && <Sparkles className="w-5 h-5 text-rose-400 flex-shrink-0" />}
                <Megaphone className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <h2 className={cn("text-xl font-bold truncate", s.page)}>{detail?.name ?? "Loading…"}</h2>
              </div>
              {detail?.description && (
                <p className={cn("text-sm mt-1 leading-relaxed", s.sub)}>{detail.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {detail && <TypeBadge type={detail.campaign_type} />}
            <StatusBadge joined={isJoined} />
          </div>
        </div>
      </div>

      {detailLoading && <div className={cn("rounded-2xl border p-10 text-center text-sm", s.card, s.sub)}>Loading…</div>}

      {detail && (
        <>
          {/* Welcome card — 21 Awakenings only, not yet joined */}
          {is21 && (
            <div className={cn("rounded-2xl border p-5", s.infoCard)}>
              <div className="flex gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-rose-400" />
                    <h3 className={cn("font-bold text-base", s.page)}>What is 21 Awakenings?</h3>
                  </div>
                  <ul className={cn("space-y-2 text-sm", s.sub)}>
                    <li className="flex items-start gap-2"><Calendar className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />22-day journey with daily short video clips (Day 0–21)</li>
                    <li className="flex items-start gap-2"><span className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0 text-base leading-none">▷</span>Day 0 &amp; Day 1 include special explainer videos</li>
                    <li className="flex items-start gap-2"><span className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0 text-base leading-none">⇄</span>Share-to-earn CTAs with Qriptopian Smart Actions</li>
                    <li className="flex items-start gap-2"><Zap className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />Earn KNYT &amp; Qc rewards for participation</li>
                  </ul>
                </div>
                {previewThumbs.length > 0 && (
                  <div className="flex-shrink-0 space-y-1">
                    <p className={cn("text-xs font-medium", s.muted)}>Preview Days 0–2</p>
                    <div className="flex gap-2">
                      {previewThumbs.map((src, i) => (
                        <img key={i} src={src} alt={`Day ${i}`}
                          className="w-20 h-14 rounded-lg object-cover border border-white/10"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className={cn("flex gap-0 border-b", s.div)}>
            {detailTabs.map((tab) => (
              <button key={tab} onClick={() => setDetailTab(tab)}
                className={cn("px-5 py-2.5 text-sm capitalize transition-colors",
                  detailTab === tab ? s.tabOn : s.tabOff
                )}
              >
                {tab === "join" ? "Join Campaign" : tab === "sequence" ? "Sequence" : tab === "status" ? "Status" : "Details"}
              </button>
            ))}
          </div>

          {/* JOIN TAB */}
          {detailTab === "join" && (
            <div className={cn("rounded-2xl border p-5 space-y-5", s.card)}>
              <h3 className={cn("font-semibold", s.page)}>Join {detail.name}</h3>

              <div className="space-y-2">
                <p className={cn("text-xs font-medium", s.sub)}>Select which channels to publish this campaign to</p>
                <div className="grid grid-cols-2 gap-2">
                  {CHANNELS.map((ch) => (
                    <label key={ch} className={cn("flex items-center gap-2.5 text-sm cursor-pointer rounded-xl border px-3 py-2.5 transition-colors",
                      selChannels.includes(ch)
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                        : cn("border", dark ? "border-white/[0.07]" : "border-black/[0.07]", s.sub)
                    )}>
                      <input type="checkbox" className="accent-rose-500" checked={selChannels.includes(ch)}
                        onChange={(e) => setSelChannels((p) => e.target.checked ? [...p, ch] : p.filter((x) => x !== ch))}
                      />
                      {ch}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className={cn("text-xs font-medium", s.sub)}>When should this campaign start?</p>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className={cn("w-full rounded-xl border px-3 py-2.5 text-sm", s.inp)}
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="accent-rose-500 mt-0.5" checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                <span className={cn("text-xs leading-relaxed", s.sub)}>
                  I confirm I have reviewed all {detail.marketa_sequence_items?.length ?? 22} days of content and approve publishing to my selected channels
                </span>
              </label>

              {joinErr && <p className="text-xs text-rose-400">{joinErr}</p>}

              <button onClick={handleJoin} disabled={joining || selChannels.length === 0 || !approved}
                className="w-full py-3 rounded-xl border border-rose-500/50 bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-300 font-semibold transition-colors backdrop-blur-sm">
                {joining ? "Joining…" : `Join ${detail.name}`}
              </button>
            </div>
          )}

          {/* SEQUENCE TAB */}
          {detailTab === "sequence" && (
            <div className="space-y-5">
              {/* Progress */}
              <div className={cn("rounded-2xl border p-4 space-y-2", s.card)}>
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", s.page)}>Campaign Progress</span>
                  <button onClick={fetchStatus} className={cn("p-1", s.muted)}><RefreshCw className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm", s.sub)}>Day {status?.current_day ?? 0} of {status?.total_days ?? 22}</span>
                  <span className={cn("text-sm font-mono", s.muted)}>
                    {Math.round(((status?.current_day ?? 0) / (status?.total_days || 22)) * 100)}%
                  </span>
                </div>
                <div className={cn("h-2 rounded-full overflow-hidden", dark ? "bg-white/10" : "bg-black/10")}>
                  <div className="h-full rounded-full bg-rose-500 transition-all"
                    style={{ width: `${Math.round(((status?.current_day ?? 0) / (status?.total_days || 22)) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Explainer videos */}
              {explainers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-rose-400" />
                    <span className={cn("text-xs font-bold uppercase tracking-widest", s.muted)}>Explainer Videos</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {explainers.map((item) => (
                      <SequenceDayCard key={item.id} item={item} theme={theme} size="lg"
                        onAssetClick={(i) => trackEngagement({ campaign_id: selectedId, event_type: "asset_click", sequence_day: i.day_number, asset_ref: i.asset_ref ?? undefined, persona_id: pid })}
                        onCtaClick={(i) => trackEngagement({ campaign_id: selectedId, event_type: "cta_click", sequence_day: i.day_number, persona_id: pid })}
                        onPlay={openPlayer}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Daily sequence */}
              {days.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rose-400" />
                    <span className={cn("text-xs font-bold uppercase tracking-widest", s.muted)}>Daily Sequence ({days.length} Days)</span>
                  </div>
                  <div className="space-y-3">
                    {days.map((item) => (
                      <SequenceDayCard key={item.id} item={item} theme={theme} size="lg"
                        onAssetClick={(i) => trackEngagement({ campaign_id: selectedId, event_type: "asset_click", sequence_day: i.day_number, asset_ref: i.asset_ref ?? undefined, persona_id: pid })}
                        onCtaClick={(i) => trackEngagement({ campaign_id: selectedId, event_type: "cta_click", sequence_day: i.day_number, persona_id: pid })}
                        onPlay={openPlayer}
                      />
                    ))}
                  </div>
                </div>
              )}

              {items.length === 0 && !detailLoading && (
                <div className={cn("rounded-2xl border p-10 text-center text-sm", s.card, s.sub)}>No sequence items yet.</div>
              )}
            </div>
          )}

          {/* STATUS TAB */}
          {detailTab === "status" && (
            <div className={cn("rounded-2xl border p-5 space-y-4", s.card)}>
              <h3 className={cn("font-semibold", s.page)}>Campaign Status</h3>
              {!status ? (
                <p className={cn("text-sm", s.sub)}>Loading…</p>
              ) : (
                <div className="space-y-3">
                  <Row dark={dark} label="Status" value={<span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 capitalize">{status.status ?? "active"}</span>} />
                  {status.joined_at && <Row dark={dark} label="Joined" value={<span className={cn("text-xs font-mono", s.muted)}>{new Date(status.joined_at).toLocaleDateString()}</span>} />}
                  <Row dark={dark} label="Progress" value={<span className={cn("text-xs font-mono", s.sub)}>Day {status.current_day} / {status.total_days}</span>} />
                  <div className={cn("h-2 rounded-full overflow-hidden", dark ? "bg-white/10" : "bg-black/10")}>
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.round(((status.current_day ?? 0) / (status.total_days || 22)) * 100)}%` }} />
                  </div>
                  {(status.delivery_receipts ?? []).length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <p className={cn("text-xs font-semibold uppercase tracking-wide", s.muted)}>Recent Deliveries</p>
                      {status.delivery_receipts.map((r, i) => (
                        <div key={i} className={cn("flex justify-between text-xs rounded-lg px-3 py-2 border", s.card)}>
                          <span className={s.sub}>Day {r.day}</span>
                          <span className={s.muted}>{new Date(r.delivered_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DETAILS TAB */}
          {detailTab === "details" && (
            <div className={cn("rounded-2xl border p-5 space-y-3", s.card)}>
              <h3 className={cn("font-semibold", s.page)}>Campaign Details</h3>
              <Row dark={dark} label="Campaign ID" value={<span className={cn("text-xs font-mono break-all", s.muted)}>{detail.id}</span>} />
              <Row dark={dark} label="Type" value={<TypeBadge type={detail.campaign_type} />} />
              <Row dark={dark} label="Status" value={<span className={cn("text-sm capitalize", s.sub)}>{detail.status ?? "draft"}</span>} />
              {detail.duration_days && <Row dark={dark} label="Sequence Length" value={<span className={cn("text-sm", s.sub)}>{detail.duration_days} days (includes Day 0)</span>} />}
              {(detail.channels ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <span className={cn("text-xs", s.muted)}>Channels</span>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.channels.map((ch) => <span key={ch} className={cn("text-xs px-2 py-0.5 rounded-full border", s.chip)}>{ch}</span>)}
                  </div>
                </div>
              )}
              <Row dark={dark} label="Created" value={<span className={cn("text-xs font-mono", s.muted)}>{new Date(detail.created_at).toLocaleDateString()}</span>} />
            </div>
          )}
        </>
      )}

      {/* In-app video player */}
      <VideoModal
        isOpen={playerOpen}
        onClose={() => setPlayerOpen(false)}
        items={playerItems}
        initialIndex={playerIndex}
      />
    </div>
  );
}

function Row({ dark, label, value }: { dark: boolean; label: string; value: React.ReactNode }) {
  const s = t(dark);
  return (
    <div className="flex items-start justify-between gap-4">
      <span className={cn("text-sm flex-shrink-0", s.muted)}>{label}</span>
      <div className="text-right">{value}</div>
    </div>
  );
}
