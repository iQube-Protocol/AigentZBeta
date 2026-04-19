"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Sparkles, Calendar, Zap, CheckCircle2, RefreshCw, Clock, Users, Twitter, Linkedin, Instagram, Mail, Youtube, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SequenceDayCard } from "./SequenceDayCard";
import { CampaignCatalogItem, CampaignDetail, CampaignStatusResult, CAMPAIGN_21_AWAKENINGS_ID } from "@/types/marketaCampaigns";
import { bridgeGet, bridgePost, trackEngagement } from "./bridgeFetch";
import { cn } from "@/utils/cn";

interface Props {
  theme?: "dark" | "light";
  partnerId?: string;
  personaId?: string;
  previewCampaignId?: string;
}

type View = "catalog" | "detail";
type DetailTab = "welcome" | "sequence" | "status" | "details";

const CHANNELS = [
  { id: "x",          label: "X / Twitter",  Icon: Twitter   },
  { id: "linkedin",   label: "LinkedIn",      Icon: Linkedin  },
  { id: "instagram",  label: "Instagram",     Icon: Instagram },
  { id: "newsletter", label: "Newsletter",    Icon: Mail      },
  { id: "youtube",    label: "YouTube",       Icon: Youtube   },
  { id: "podcast",    label: "Podcast",       Icon: Mic       },
];

function t(dark: boolean, key: string) {
  const m: Record<string, string> = {
    card:    dark ? "bg-white/[0.03] border-white/[0.06]" : "bg-black/[0.02] border-black/[0.06]",
    head:    dark ? "text-white/90" : "text-black/80",
    sub:     dark ? "text-white/50" : "text-black/45",
    muted:   dark ? "text-white/30" : "text-black/30",
    label:   dark ? "text-white/70" : "text-black/60",
    div:     dark ? "border-white/[0.06]" : "border-black/[0.06]",
    inp:     dark ? "bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/25" : "bg-black/[0.03] border-black/10 text-black/80",
    tabOn:   dark ? "bg-white/[0.08] text-white/90" : "bg-black/[0.06] text-black/80",
    tabOff:  dark ? "text-white/40 hover:text-white/70" : "text-black/35 hover:text-black/60",
  };
  return m[key] ?? "";
}

function TypeBadge({ type }: { type: string }) {
  const [label, cls] =
    type === "sequence" ? ["Sequence", "bg-violet-500/20 text-violet-400 border-violet-500/20"]
    : type === "wpp"    ? ["Weekly Pack", "bg-sky-500/20 text-sky-400 border-sky-500/20"]
    :                     ["One-off", "bg-amber-500/20 text-amber-400 border-amber-500/20"];
  return <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", cls)}>{label}</span>;
}

export function MarketaMyCampaignTab({ theme = "dark", partnerId, personaId, previewCampaignId }: Props) {
  const dark = theme === "dark";
  const pid = personaId ?? partnerId ?? "qriptiq@knyt";

  const [view, setView]               = useState<View>(previewCampaignId ? "detail" : "catalog");
  const [catalog, setCatalog]         = useState<CampaignCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError]     = useState<string | null>(null);

  const [selectedId, setSelectedId]   = useState<string | null>(previewCampaignId ?? null);
  const [detail, setDetail]           = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus]           = useState<CampaignStatusResult | null>(null);
  const [detailTab, setDetailTab]     = useState<DetailTab>("welcome");

  const [selChannels, setSelChannels] = useState<string[]>([]);
  const [startDate, setStartDate]     = useState("");
  const [joining, setJoining]         = useState(false);
  const [joinErr, setJoinErr]         = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // load catalog
  useEffect(() => {
    bridgeGet<{
      available_campaigns?: Array<{ id: string; name: string; description: string; campaign_type: string; sequence_length?: number; metadata?: { channels?: string[] } }>;
      joined_campaigns?: Array<{ campaign_id: string; status: string; marketa_campaigns?: { id: string; name: string; description: string; campaign_type: string; sequence_length?: number } }>;
    }>("campaign_catalog", {}, pid)
      .then(({ available_campaigns = [], joined_campaigns = [] }) => {
        const map = new Map<string, CampaignCatalogItem>();
        for (const c of available_campaigns) {
          map.set(c.id, {
            id: c.id, name: c.name, description: c.description ?? "",
            campaign_type: c.campaign_type as CampaignCatalogItem["campaign_type"],
            duration_days: c.sequence_length,
            channels: (c.metadata as { channels?: string[] })?.channels ?? [],
            is_joined: false,
          });
        }
        for (const jc of joined_campaigns) {
          const mc = jc.marketa_campaigns;
          if (!mc) continue;
          map.set(mc.id, {
            id: mc.id, name: mc.name, description: mc.description ?? "",
            campaign_type: mc.campaign_type as CampaignCatalogItem["campaign_type"],
            duration_days: mc.sequence_length,
            channels: [],
            is_joined: true,
          });
        }
        setCatalog(Array.from(map.values()));
      })
      .catch((e) => setCatalogError(String(e?.message ?? "Failed to load")))
      .finally(() => setCatalogLoading(false));
  }, [pid]);

  // load detail
  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetail(null);
    setStatus(null);
    bridgeGet<{ success: boolean; campaign: CampaignDetail }>("campaign_detail", { campaignId: selectedId }, pid)
      .then(({ campaign }) => {
        setDetail(campaign ?? null);
        const isJoined = catalog.find((c) => c.id === selectedId)?.is_joined;
        setDetailTab(isJoined || previewCampaignId === selectedId ? "sequence" : "welcome");
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedId, pid]); // eslint-disable-line react-hooks/exhaustive-deps

  // poll status
  const fetchStatus = useCallback(() => {
    if (!selectedId) return;
    bridgeGet<{
      success: boolean;
      campaign?: { sequence_length?: number };
      tenant_config?: { current_day?: number; joined_at?: string; status?: string } | null;
      progress_percentage?: number;
    }>("campaign_status", { campaignId: selectedId }, pid)
      .then(({ campaign, tenant_config }) => {
        setStatus({
          is_joined: !!tenant_config,
          current_day: tenant_config?.current_day ?? 0,
          total_days: campaign?.sequence_length ?? 21,
          joined_at: tenant_config?.joined_at ?? null,
          status: tenant_config?.status ?? "not_joined",
          delivery_receipts: [],
        });
      })
      .catch(() => {});
  }, [selectedId, pid]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  // restore channels from partner notes
  useEffect(() => {
    if (!partnerId) return;
    fetch(`/api/avl/partners/${partnerId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.data?.notes) {
          try {
            const n = JSON.parse(d.data.notes);
            if (Array.isArray(n.preferred_channels)) setSelChannels(n.preferred_channels);
            if (n.campaign_start_date) setStartDate(n.campaign_start_date);
          } catch { /* not json */ }
        }
      })
      .catch(() => {});
  }, [partnerId]);

  async function handleJoin() {
    if (!selectedId || joining) return;
    setJoining(true);
    setJoinErr(null);
    try {
      await bridgePost("join_campaign", { campaignId: selectedId, channels: selChannels, startDate: startDate || new Date().toISOString().split("T")[0], publishingMode: "automation" }, pid);
      setCatalog((prev) => prev.map((c) => c.id === selectedId ? { ...c, is_joined: true } : c));
      if (partnerId) {
        fetch("/api/avl/partners", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: partnerId, outreach_status: "engaged", notes: JSON.stringify({ preferred_channels: selChannels, campaign_start_date: startDate }) }),
        }).catch(() => {});
      }
      setDetailTab("sequence");
      fetchStatus();
    } catch (e: unknown) {
      setJoinErr(e instanceof Error ? e.message : "Join failed");
    } finally {
      setJoining(false);
    }
  }

  function openDetail(id: string) { setSelectedId(id); setView("detail"); }
  function backToCatalog() { setSelectedId(null); setView("catalog"); setDetail(null); setStatus(null); }

  const isJoined = status?.is_joined ?? catalog.find((c) => c.id === selectedId)?.is_joined ?? false;
  const is21     = selectedId === CAMPAIGN_21_AWAKENINGS_ID;
  const items    = (detail?.marketa_sequence_items ?? []).slice().sort((a, b) => a.day_number - b.day_number);
  const explainers = items.filter((i) => i.explainer);
  const days       = items.filter((i) => !i.explainer);
  const tabs: DetailTab[] = isJoined || previewCampaignId === selectedId ? ["sequence", "status", "details"] : ["welcome", "details"];

  // ── DETAIL ────────────────────────────────────────────────────────────────
  if (view === "detail") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={backToCatalog} className={cn("flex items-center gap-1.5 text-sm", t(dark, "sub"), "hover:opacity-80")}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {detail && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {is21 && <Sparkles className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              <span className={cn("font-semibold truncate text-sm", t(dark, "head"))}>{detail.name}</span>
              <TypeBadge type={detail.campaign_type} />
              {isJoined && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Joined</span>}
            </div>
          )}
        </div>

        {detailLoading && <div className={cn("rounded-xl border p-10 text-center text-sm", t(dark, "card"), t(dark, "sub"))}>Loading…</div>}

        {detail && (
          <>
            {/* tab bar */}
            <div className={cn("flex gap-1 border-b", t(dark, "div"))}>
              {tabs.map((tab) => (
                <button key={tab} onClick={() => {
                  setDetailTab(tab);
                  if (tab === "sequence") trackEngagement({ campaign_id: selectedId!, event_type: "sequence_view", sequence_day: 0, persona_id: pid });
                }} className={cn("px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition-colors", detailTab === tab ? t(dark, "tabOn") : t(dark, "tabOff"))}>
                  {tab}
                </button>
              ))}
            </div>

            {/* WELCOME */}
            {detailTab === "welcome" && (
              <div className="space-y-4">
                <div className={cn("rounded-xl border p-4 space-y-2", t(dark, "card"))}>
                  {is21 && <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-rose-400" /><span className={cn("font-semibold text-sm", t(dark, "head"))}>21 Awakenings</span></div>}
                  <p className={cn("text-sm leading-relaxed", t(dark, "sub"))}>{detail.description}</p>
                  {detail.duration_days && <p className={cn("text-xs", t(dark, "muted"))}>{detail.duration_days}-day programme · {detail.channels?.join(", ")}</p>}
                </div>

                {(detail.marketa_partner_rewards ?? []).length > 0 && (
                  <div className={cn("rounded-xl border p-4 space-y-2", t(dark, "card"))}>
                    <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /><span className={cn("text-sm font-semibold", t(dark, "head"))}>Rewards</span></div>
                    {detail.marketa_partner_rewards.map((r) => (
                      <div key={r.id} className={cn("flex justify-between text-sm", t(dark, "sub"))}>
                        <span className="capitalize">{r.trigger.replace(/_/g, " ")}</span>
                        <span className="font-mono text-amber-400">{r.amount} {r.reward_type.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className={cn("rounded-xl border p-4 space-y-4", t(dark, "card"))}>
                  <span className={cn("text-sm font-semibold", t(dark, "head"))}>Join this campaign</span>
                  <div className="grid grid-cols-2 gap-2">
                    {CHANNELS.map(({ id, label, Icon }) => (
                      <label key={id} className={cn("flex items-center gap-2 text-xs cursor-pointer rounded-lg border p-2 transition-colors", t(dark, "card"), selChannels.includes(id) ? "border-rose-500/40 bg-rose-500/10" : "")}>
                        <input type="checkbox" className="accent-rose-500" checked={selChannels.includes(id)} onChange={(e) => setSelChannels((p) => e.target.checked ? [...p, id] : p.filter((x) => x !== id))} />
                        <Icon className="w-3.5 h-3.5 text-rose-400" />
                        <span className={t(dark, "label")}>{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className={cn("text-xs", t(dark, "sub"))}>Start date (optional)</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={cn("w-full rounded-lg border px-3 py-2 text-sm", t(dark, "inp"))} />
                  </div>
                  {joinErr && <p className="text-xs text-rose-400">{joinErr}</p>}
                  <Button onClick={handleJoin} disabled={joining} className="w-full bg-rose-600 hover:bg-rose-500 text-white">
                    {joining ? "Joining…" : "Join Campaign"}
                  </Button>
                </div>
              </div>
            )}

            {/* SEQUENCE */}
            {detailTab === "sequence" && (
              <div className="space-y-4">
                {status && (
                  <div className={cn("rounded-xl border p-3 flex items-center gap-3", t(dark, "card"))}>
                    <div className="flex-1 space-y-1">
                      <p className={cn("text-xs", t(dark, "sub"))}>Day {status.current_day ?? 0} of {status.total_days}</p>
                      <div className={cn("h-1.5 rounded-full overflow-hidden", dark ? "bg-white/10" : "bg-black/10")}>
                        <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${Math.round(((status.current_day ?? 0) / (status.total_days || 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <button onClick={fetchStatus} className={t(dark, "sub")}><RefreshCw className="w-3.5 h-3.5" /></button>
                  </div>
                )}

                {explainers.length > 0 && (
                  <div className="space-y-2">
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", t(dark, "muted"))}>Explainer Videos</p>
                    {explainers.map((item) => (
                      <SequenceDayCard key={item.id} item={item} theme={theme}
                        onAssetClick={(i) => trackEngagement({ campaign_id: selectedId!, event_type: "asset_click", sequence_day: i.day_number, asset_ref: i.asset_ref ?? undefined, persona_id: pid })}
                        onCtaClick={(i) => trackEngagement({ campaign_id: selectedId!, event_type: "cta_click", sequence_day: i.day_number, persona_id: pid })} />
                    ))}
                  </div>
                )}

                {days.length > 0 && (
                  <div className="space-y-2">
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", t(dark, "muted"))}>Daily Sequence</p>
                    {days.map((item) => (
                      <SequenceDayCard key={item.id} item={item} theme={theme}
                        onAssetClick={(i) => trackEngagement({ campaign_id: selectedId!, event_type: "asset_click", sequence_day: i.day_number, asset_ref: i.asset_ref ?? undefined, persona_id: pid })}
                        onCtaClick={(i) => trackEngagement({ campaign_id: selectedId!, event_type: "cta_click", sequence_day: i.day_number, persona_id: pid })} />
                    ))}
                  </div>
                )}

                {items.length === 0 && !detailLoading && (
                  <div className={cn("rounded-xl border p-8 text-center text-sm", t(dark, "card"), t(dark, "sub"))}>No sequence items yet.</div>
                )}
              </div>
            )}

            {/* STATUS */}
            {detailTab === "status" && (
              <div className="space-y-3">
                {!status
                  ? <div className={cn("rounded-xl border p-8 text-center text-sm", t(dark, "card"), t(dark, "sub"))}>Loading status…</div>
                  : <>
                    <div className={cn("rounded-xl border p-4 space-y-3", t(dark, "card"))}>
                      <Row dark={dark} label="Status" value={<span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 capitalize">{status.status ?? "active"}</span>} />
                      {status.joined_at && <Row dark={dark} label="Joined" value={<span className={cn("text-xs font-mono", t(dark, "muted"))}>{new Date(status.joined_at).toLocaleDateString()}</span>} />}
                      <Row dark={dark} label="Progress" value={<span className={cn("text-xs font-mono", t(dark, "label"))}>Day {status.current_day ?? 0} / {status.total_days}</span>} />
                      <div className={cn("h-1.5 rounded-full overflow-hidden", dark ? "bg-white/10" : "bg-black/10")}>
                        <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.round(((status.current_day ?? 0) / (status.total_days || 1)) * 100)}%` }} />
                      </div>
                    </div>
                    {(status.delivery_receipts ?? []).length > 0 && (
                      <div className="space-y-1.5">
                        <p className={cn("text-xs font-semibold uppercase tracking-wide", t(dark, "muted"))}>Deliveries</p>
                        {status.delivery_receipts.map((r, i) => (
                          <div key={i} className={cn("flex items-center justify-between rounded-lg border px-3 py-2", t(dark, "card"))}>
                            <span className={cn("text-xs flex items-center gap-2", t(dark, "sub"))}><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />Day {r.day}</span>
                            <span className={cn("text-xs font-mono", t(dark, "muted"))}>{new Date(r.delivered_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                }
              </div>
            )}

            {/* DETAILS */}
            {detailTab === "details" && (
              <div className={cn("rounded-xl border p-4 space-y-3", t(dark, "card"))}>
                <Row dark={dark} label="Type" value={<TypeBadge type={detail.campaign_type} />} />
                {detail.duration_days && <Row dark={dark} label="Duration" value={<span className={cn("text-xs", t(dark, "sub"))}>{detail.duration_days} days</span>} />}
                {(detail.channels ?? []).length > 0 && (
                  <Row dark={dark} label="Channels" value={
                    <div className="flex flex-wrap gap-1">
                      {detail.channels.map((ch) => <span key={ch} className={cn("text-[10px] px-1.5 py-0.5 rounded border", dark ? "border-white/10 text-white/50" : "border-black/10 text-black/40")}>{ch}</span>)}
                    </div>
                  } />
                )}
                <Row dark={dark} label="Created" value={<span className={cn("text-xs font-mono", t(dark, "muted"))}>{new Date(detail.created_at).toLocaleDateString()}</span>} />
                {(detail.marketa_partner_rewards ?? []).length > 0 && (
                  <div className={cn("border-t pt-3", t(dark, "div"))}>
                    <p className={cn("text-xs font-semibold mb-2", t(dark, "sub"))}>Reward Schedule</p>
                    {detail.marketa_partner_rewards.map((r) => (
                      <div key={r.id} className="flex justify-between text-xs py-1">
                        <span className={cn("capitalize", t(dark, "sub"))}>{r.trigger.replace(/_/g, " ")}</span>
                        <span className="text-amber-400 font-mono">{r.amount} {r.reward_type.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── CATALOG ───────────────────────────────────────────────────────────────
  const joined    = catalog.filter((c) => c.is_joined);
  const available = catalog.filter((c) => !c.is_joined);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className={cn("text-sm font-semibold", t(dark, "head"))}>Campaigns</h3>
        <span className={cn("text-xs flex items-center gap-1", t(dark, "muted"))}><Clock className="w-3 h-3" />{catalog.length} available</span>
      </div>

      {catalogLoading && <div className={cn("rounded-xl border p-10 text-center text-sm", t(dark, "card"), t(dark, "sub"))}>Loading campaigns…</div>}
      {catalogError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{catalogError}</div>}

      {!catalogLoading && !catalogError && (
        <>
          {joined.length > 0 && (
            <div className="space-y-2">
              <p className={cn("text-xs font-semibold uppercase tracking-wide", t(dark, "muted"))}>Joined</p>
              {joined.map((c) => <CampaignCard key={c.id} campaign={c} dark={dark} onSelect={openDetail} />)}
            </div>
          )}
          {available.length > 0 && (
            <div className="space-y-2">
              <p className={cn("text-xs font-semibold uppercase tracking-wide", t(dark, "muted"))}>Available</p>
              {available.map((c) => <CampaignCard key={c.id} campaign={c} dark={dark} onSelect={openDetail} />)}
            </div>
          )}
          {catalog.length === 0 && (
            <div className={cn("rounded-xl border p-10 text-center", t(dark, "card"))}>
              <Users className={cn("w-8 h-8 mx-auto mb-3", t(dark, "muted"))} />
              <p className={cn("text-sm", t(dark, "sub"))}>No campaigns available yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CampaignCard({ campaign, dark, onSelect }: { campaign: CampaignCatalogItem; dark: boolean; onSelect: (id: string) => void }) {
  const is21 = campaign.id === CAMPAIGN_21_AWAKENINGS_ID;
  return (
    <div className={cn("rounded-xl border p-4 space-y-2 transition-all", t(dark, "card"), is21 && (dark ? "border-rose-500/30 bg-rose-500/[0.04]" : "border-rose-500/20"))}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {is21 && <Sparkles className="w-4 h-4 text-rose-400 flex-shrink-0" />}
          <span className={cn("font-medium text-sm truncate", t(dark, "head"))}>{campaign.name}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TypeBadge type={campaign.campaign_type} />
          {campaign.is_joined && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Joined</span>}
        </div>
      </div>
      <p className={cn("text-xs line-clamp-2", t(dark, "sub"))}>{campaign.description}</p>
      <div className="flex items-center justify-between">
        <span className={cn("text-xs", t(dark, "muted"))}>{campaign.duration_days ? `${campaign.duration_days}d · ` : ""}{(campaign.channels ?? []).slice(0, 3).join(", ")}</span>
        <div className="flex gap-2">
          <button onClick={() => onSelect(campaign.id)} className={cn("text-xs px-3 py-1 rounded-lg border transition-colors", dark ? "border-white/10 text-white/60 hover:border-white/20 hover:text-white/90" : "border-black/10 text-black/50 hover:border-black/20")}>View</button>
          {!campaign.is_joined && (
            <button onClick={() => onSelect(campaign.id)} className="text-xs px-3 py-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/20 transition-colors">Join</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ dark, label, value }: { dark: boolean; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={cn("text-xs", t(dark, "sub"))}>{label}</span>
      <div className="flex-shrink-0">{value}</div>
    </div>
  );
}
