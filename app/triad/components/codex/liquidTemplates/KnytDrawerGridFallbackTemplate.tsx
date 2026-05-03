"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Loader2 } from "lucide-react";
import type { SmartContentQube } from "@/types/smartContent";
import SmartContentCard from "@/app/components/content/SmartContentCard";
import { useSmartTriad } from "@/app/components/content/SmartTriadProvider";
import { ExperienceContextSidebar } from "@/components/composer/ExperienceContextSidebar";

type ExperienceQube = {
  id: string;
  name: string;
  description?: string;
  configuration?: Record<string, any>;
  metadata?: Record<string, any>;
};

interface KnytDrawerGridFallbackTemplateProps {
  experience?: ExperienceQube;
  packet?: Record<string, any> | null;
  theme?: "light" | "dark";
  personaId?: string;
  contentObjects?: SmartContentQube[];
  contentObject?: SmartContentQube;
  mediaVariantOverridesEnabled?: boolean;
  mediaRatioOverrides?: Record<string, import("@/types/smartContent").MediaRatio>;
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
  contentObjects,
  contentObject,
  mediaVariantOverridesEnabled,
  mediaRatioOverrides,
}: KnytDrawerGridFallbackTemplateProps) {
  const { actions } = useSmartTriad();
  const [items, setItems] = useState<SmartContentQube[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const isDashboard = templateId.includes("drawer_grid_2a");
  const getRatioOverride = (variant?: string) =>
    variant && mediaVariantOverridesEnabled ? mediaRatioOverrides?.[variant] : undefined;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        if (Array.isArray(contentObjects) && contentObjects.length > 0) {
          if (active) {
            setItems(contentObjects);
            setLoading(false);
          }
          return;
        }
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
  }, [featureId, supportingIds, contentObjects]);

  const handleOpen = async (content: SmartContentQube) => {
    // Defence-in-depth gate — codex-shaped content routes to purchase when not owned.
    const id = content?.id;
    const isCodexAsset = !!id && (
      /^mk_ep\d{1,4}_/i.test(id) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
    const isOwned = !!id && actions.checkOwnership(id);
    if (isCodexAsset && !isOwned) {
      await actions.loadContent(content.id);
      actions.openWallet("full");
      return;
    }
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
                      templateVariant="featured"
                      device="desktop"
                      useTemplateRatioOverrides={mediaVariantOverridesEnabled}
                      mediaRatioOverride={getRatioOverride("featured")}
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
                            templateVariant="standard"
                            device="desktop"
                            useTemplateRatioOverrides={mediaVariantOverridesEnabled}
                            mediaRatioOverride={getRatioOverride("standard")}
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

              <ExperienceContextSidebar experience={experience} packet={packet} theme={theme} />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="grid gap-4 md:grid-cols-2">
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <SmartContentCard
                      key={item.id}
                      content={item}
                      templateVariant="grid"
                      device="desktop"
                      variant={index === 0 ? "featured" : "standard"}
                      useTemplateRatioOverrides={mediaVariantOverridesEnabled}
                      mediaRatioOverride={getRatioOverride("grid")}
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
              <ExperienceContextSidebar experience={experience} packet={packet} theme={theme} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
