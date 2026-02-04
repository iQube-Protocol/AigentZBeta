"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Target, Timer, Layers } from "lucide-react";
import type { SmartContentQube } from "@/types/smartContent";
import type { WalletUIComponent } from "@/app/types/knytLiquidUI";
import { SmartContentCard, useSmartTriad } from "@/app/components/content";

type ExperienceQube = {
  id: string;
  name: string;
  description?: string;
  configuration?: Record<string, any>;
};

interface QriptopianReadingSprintTemplateProps {
  experience?: ExperienceQube;
  packet?: Record<string, any> | null;
  theme?: "light" | "dark";
  personaId?: string;
  mediaVariantOverridesEnabled?: boolean;
  mediaRatioOverrides?: Record<string, import("@/types/smartContent").MediaRatio>;
}

const fetchContent = async (id: string): Promise<SmartContentQube | null> => {
  const res = await fetch(`/api/content/smart/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data || null;
};

export function QriptopianReadingSprintTemplate({
  experience,
  packet,
  theme = "dark",
  mediaVariantOverridesEnabled,
  mediaRatioOverrides,
}: QriptopianReadingSprintTemplateProps) {
  const { actions } = useSmartTriad();
  const [feature, setFeature] = useState<SmartContentQube | null>(null);
  const [supporting, setSupporting] = useState<SmartContentQube[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = experience?.configuration || {};
  const intent = config.intent_timebox || {};
  const contentConfig = config.content_selection || {};
  const walletConfig = config.wallet_rewards || {};
  const copilotConfig = config.copilot_output || {};

  const packetIntent = packet?.intent?.constraints || {};
  const workingSet = packet?.context?.working_set || {};
  const templateId = packet?.ui?.primary_template || "qripto-reading-sprint";
  const selectionReason = packet?.ui?.template_selection?.reason;

  const featureId = workingSet.feature_item_id || contentConfig.feature_item_id;
  const supportingIds = useMemo(() => {
    if (Array.isArray(workingSet.supporting_item_ids)) {
      return workingSet.supporting_item_ids;
    }
    if (Array.isArray(contentConfig.supporting_item_ids)) {
      return contentConfig.supporting_item_ids;
    }
    return [];
  }, [workingSet.supporting_item_ids, contentConfig.supporting_item_ids]);

  const goal = packetIntent.goal || intent.goal || "Reading sprint";
  const timeAvailable = packetIntent.time_available || intent.time_available || "15";
  const depth = packetIntent.depth || intent.depth || "overview";
  const issueSlug = packetIntent.issue_slug || contentConfig.issue_slug || "issue-1";

  const unlockPrice = Number(walletConfig.unlock_price || 0);
  const rewardAmount = Number(walletConfig.reward_amount || 0);
  const requiresConnect = walletConfig.require_wallet_connect !== false;
  const getRatioOverride = (variant?: string) =>
    variant && mediaVariantOverridesEnabled ? mediaRatioOverrides?.[variant] : undefined;

  const gates = useMemo(() => {
    const list = [];
    if (requiresConnect) list.push("connect");
    if (unlockPrice > 0) list.push("pay");
    return list;
  }, [requiresConnect, unlockPrice]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!featureId && supportingIds.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [featureItem, ...supportItems] = await Promise.all([
          featureId ? fetchContent(featureId) : Promise.resolve(null),
          ...supportingIds.map((id: string) => fetchContent(id)),
        ]);

        if (!active) return;
        setFeature(featureItem);
        setSupporting(supportItems.filter(Boolean) as SmartContentQube[]);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load experience content");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [featureId, supportingIds]);

  const handleOpen = async (content: SmartContentQube) => {
    await actions.loadContent(content.id);
    actions.setViewerModality("read");
    actions.setActiveDrawer("contentViewer");
  };

  const handlePurchase = async (content: SmartContentQube) => {
    await actions.loadContent(content.id);
    // Open Liquid UI SmartWallet instead of Layered SmartWallet
    const walletUI: WalletUIComponent[] = [];
    
    // Add balance card
    walletUI.push('wallet_card.balance');
    
    // Add unlock card if there's a price
    if (content.pricingModel?.tiers?.some((tier) => (tier.amount ?? 0) > 0)) {
      walletUI.push('wallet_card.unlock_offer');
    }
    
    // Add permission card for consent
    walletUI.push('wallet_card.confirm_action');
    
    // Set wallet UI and open in narrow mode
    actions.setWalletUI(walletUI);
    actions.setWalletDrawerMode('narrow');
    actions.openWallet('compact');
  };

  const isDark = theme === "dark";
  const cardClass = isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200";
  const textClass = isDark ? "text-white" : "text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border ${cardClass} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-300">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Qriptopian Reading Sprint
            </div>
            <h1 className={`mt-2 text-2xl font-semibold ${textClass}`}>
              {experience?.name || "Reading Sprint"}
            </h1>
            {experience?.description && (
              <p className={`mt-1 text-sm ${mutedClass}`}>{experience.description}</p>
            )}
          </div>
          <div className="text-xs text-slate-300 text-right">
            <div className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
              Issue {issueSlug}
            </div>
            <div className={`mt-2 rounded-full border border-slate-700 px-3 py-1 text-[11px] ${mutedClass}`}>
              {templateId}
            </div>
            {selectionReason && <div className={`mt-2 text-[11px] ${mutedClass}`}>{selectionReason}</div>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1">
            <Target className="h-3.5 w-3.5 text-indigo-300" />
            Goal: {goal}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1">
            <Timer className="h-3.5 w-3.5 text-indigo-300" />
            {timeAvailable} mins
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1">
            <Layers className="h-3.5 w-3.5 text-indigo-300" />
            Depth: {depth}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reading sprint content...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            {feature ? (
              <SmartContentCard
                content={feature}
                variant="featured"
                templateVariant="featured"
                device="desktop"
                useTemplateRatioOverrides={mediaVariantOverridesEnabled}
                mediaRatioOverride={getRatioOverride("featured")}
                onSelect={handleOpen}
                onPurchase={handlePurchase}
                isOwned={actions.checkOwnership(feature.id)}
              />
            ) : (
              <div className={`rounded-xl border ${cardClass} p-4 text-sm ${mutedClass}`}>
                Feature article not available.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {supporting.length > 0 ? (
                supporting.map((item) => (
                  <SmartContentCard
                    key={item.id}
                    content={item}
                    variant="compact"
                    templateVariant="compact"
                    device="desktop"
                    useTemplateRatioOverrides={mediaVariantOverridesEnabled}
                    mediaRatioOverride={getRatioOverride("compact")}
                    onSelect={handleOpen}
                    onPurchase={handlePurchase}
                    isOwned={actions.checkOwnership(item.id)}
                  />
                ))
              ) : (
                <div className={`rounded-xl border ${cardClass} p-4 text-sm ${mutedClass}`}>
                  Supporting items will appear here.
                </div>
              )}
            </div>
          </div>

          <aside className={`rounded-2xl border ${cardClass} p-5 space-y-4`}>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400">Wallet Gates</div>
              <div className={`mt-1 text-sm ${textClass}`}>
                {gates.length ? gates.join(" + ") : "None"}
              </div>
              <div className={`mt-2 text-xs ${mutedClass}`}>
                Unlock: {unlockPrice > 0 ? `${unlockPrice} Qc` : "Free"} / Reward:{" "}
                {rewardAmount > 0 ? `${rewardAmount} Qc` : "None"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400">Copilot Outputs</div>
              <ul className={`mt-2 space-y-2 text-sm ${textClass}`}>
                {Array.isArray(copilotConfig.outputs) && copilotConfig.outputs.length > 0 ? (
                  copilotConfig.outputs.map((output: string) => <li key={output}>{output}</li>)
                ) : (
                  <li className={mutedClass}>No outputs configured</li>
                )}
              </ul>
            </div>
            <div className={`rounded-xl border ${isDark ? "border-slate-700 bg-slate-900/60" : "border-slate-200"} p-4`}>
              <div className={`text-xs ${mutedClass}`}>Sprint checklist</div>
              <ul className={`mt-2 space-y-2 text-sm ${textClass}`}>
                <li>1. Open the feature article</li>
                <li>2. Read with preview + unlock</li>
                <li>3. Capture copilot takeaways</li>
                <li>4. Save the takeaways card</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
