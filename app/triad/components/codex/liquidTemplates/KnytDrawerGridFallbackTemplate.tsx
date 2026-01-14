"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Loader2 } from "lucide-react";
import type { SmartContentQube } from "@/types/smartContent";
import { SmartContentCard, useSmartTriad } from "@/app/components/content";

type ExperienceQube = {
  id: string;
  name: string;
  description?: string;
  configuration?: Record<string, any>;
};

interface KnytDrawerGridFallbackTemplateProps {
  experience?: ExperienceQube;
  packet?: Record<string, any> | null;
  theme?: "light" | "dark";
  personaId?: string;
}

const fetchContent = async (id: string): Promise<SmartContentQube | null> => {
  const res = await fetch(`/api/content/smart/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data || null;
};

export function KnytDrawerGridFallbackTemplate({
  experience,
  packet,
  theme = "dark",
}: KnytDrawerGridFallbackTemplateProps) {
  const { actions } = useSmartTriad();
  const [items, setItems] = useState<SmartContentQube[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = experience?.configuration || {};
  const intentConfig = config.intent_timebox || {};
  const walletConfig = config.wallet_rewards || {};
  const copilotConfig = config.copilot_output || {};

  const workingSet = packet?.context?.working_set || {};
  const contentConfig = experience?.configuration?.content_selection || {};
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

  const templateId = packet?.ui?.primary_template || "knyt:drawer_grid_v1";
  const selectionReason = packet?.ui?.template_selection?.reason || "TemplateRegistry selection";
  const packetIntent = packet?.intent?.constraints || {};
  const issueSlug = packetIntent.issue_slug || contentConfig.issue_slug || "issue-1";
  const goal = packetIntent.goal || intentConfig.goal || "reading sprint";
  const timeAvailable = packetIntent.time_available || intentConfig.time_available || "15";
  const depth = packetIntent.depth || intentConfig.depth || "overview";
  const unlockPrice = Number(walletConfig.unlock_price || 0);
  const rewardAmount = Number(walletConfig.reward_amount || 0);
  const requiresConnect = walletConfig.require_wallet_connect !== false;
  const isDashboard = templateId.includes("drawer_grid_2a");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const ids = [featureId, ...supportingIds].filter(Boolean) as string[];
        if (ids.length === 0) {
          setItems([]);
          return;
        }

        const data = await Promise.all(ids.map((id) => fetchContent(id)));
        if (!active) return;
        setItems(data.filter(Boolean) as SmartContentQube[]);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load content");
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
    actions.openWallet("full");
  };

  const isDark = theme === "dark";
  const panelClass = isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200";
  const textClass = isDark ? "text-white" : "text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const gates = useMemo(() => {
    const list: string[] = [];
    if (requiresConnect) list.push("connect");
    if (unlockPrice > 0) list.push("pay");
    return list;
  }, [requiresConnect, unlockPrice]);

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border ${panelClass} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-300">
              <LayoutGrid className="h-4 w-4 text-indigo-400" />
              Codex Liquid UI
            </div>
            <div className={`mt-2 text-lg font-semibold ${textClass}`}>
              {experience?.name || "Codex Drawer Grid"}
            </div>
            {experience?.description && (
              <div className={`mt-1 text-sm ${mutedClass}`}>{experience.description}</div>
            )}
          </div>
          <div className="text-xs text-slate-300">
            <div className="rounded-full border border-slate-700 px-3 py-1">
              {templateId}
            </div>
            <div className={`mt-2 text-[11px] ${mutedClass}`}>{selectionReason}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading template content...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : (
        <>
          {isDashboard ? (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                {items.length > 0 ? (
                  <>
                    <SmartContentCard
                      content={items[0]}
                      variant="featured"
                      onSelect={handleOpen}
                      onPurchase={handlePurchase}
                      isOwned={actions.checkOwnership(items[0].id)}
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      {items.slice(1).length > 0 ? (
                        items.slice(1).map((item) => (
                          <SmartContentCard
                            key={item.id}
                            content={item}
                            variant="standard"
                            onSelect={handleOpen}
                            onPurchase={handlePurchase}
                            isOwned={actions.checkOwnership(item.id)}
                          />
                        ))
                      ) : (
                        <div className={`rounded-xl border ${panelClass} p-4 text-sm ${mutedClass}`}>
                          Supporting items will appear here.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={`rounded-xl border ${panelClass} p-4 text-sm ${mutedClass}`}>
                    No content available for this template yet.
                  </div>
                )}
              </div>

              <aside className={`rounded-2xl border ${panelClass} p-5 space-y-4`}>
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-400">Experience Context</div>
                  <div className={`mt-2 text-sm ${textClass}`}>Issue {issueSlug}</div>
                  <div className={`mt-2 text-xs ${mutedClass}`}>Goal: {goal}</div>
                  <div className={`text-xs ${mutedClass}`}>Time: {timeAvailable} mins</div>
                  <div className={`text-xs ${mutedClass}`}>Depth: {depth}</div>
                </div>
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
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.length > 0 ? (
                items.map((item, index) => (
                  <SmartContentCard
                    key={item.id}
                    content={item}
                    variant={index === 0 ? "featured" : "standard"}
                    onSelect={handleOpen}
                    onPurchase={handlePurchase}
                    isOwned={actions.checkOwnership(item.id)}
                  />
                ))
              ) : (
                <div className={`rounded-xl border ${panelClass} p-4 text-sm ${mutedClass}`}>
                  No content available for this template yet.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
