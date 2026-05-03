"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Compass, Film, ShieldCheck, Swords, Loader2, Map } from "lucide-react";
import SmartContentCard from "@/app/components/content/SmartContentCard";
import { useSmartTriad } from "@/app/components/content/SmartTriadProvider";
import type { SmartContentQube } from "@/types/smartContent";

type ExperienceQube = {
  id: string;
  name: string;
  description?: string;
  configuration?: Record<string, any>;
};

interface KnytStageTemplateProps {
  experience?: ExperienceQube;
  packet?: Record<string, any> | null;
  theme?: "light" | "dark";
  personaId?: string;
  contentObjects?: SmartContentQube[];
  contentObject?: SmartContentQube;
}

const fetchContent = async (id: string): Promise<SmartContentQube | null> => {
  const res = await fetch(`/api/content/smart/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data || null;
};

function useTemplateContent({
  experience,
  packet,
  contentObjects,
  contentObject,
}: Pick<KnytStageTemplateProps, "experience" | "packet" | "contentObjects" | "contentObject">) {
  const [items, setItems] = useState<SmartContentQube[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workingSet = packet?.context?.working_set || {};
  const contentSelection = experience?.configuration?.content_selection || {};
  const featureId = workingSet.feature_item_id || contentSelection.feature_item_id;
  const supportingIds = useMemo(() => {
    if (Array.isArray(workingSet.supporting_item_ids)) return workingSet.supporting_item_ids;
    if (Array.isArray(contentSelection.supporting_item_ids)) return contentSelection.supporting_item_ids;
    return [] as string[];
  }, [workingSet.supporting_item_ids, contentSelection.supporting_item_ids]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        if (Array.isArray(contentObjects) && contentObjects.length > 0) {
          if (active) setItems(contentObjects);
          return;
        }

        if (contentObject) {
          if (active) setItems([contentObject]);
          return;
        }

        const ids = [featureId, ...supportingIds].filter(Boolean) as string[];
        if (ids.length === 0) {
          if (active) setItems([]);
          return;
        }

        const data = await Promise.all(ids.map((id) => fetchContent(id)));
        if (!active) return;
        setItems(data.filter(Boolean) as SmartContentQube[]);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load content");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [featureId, supportingIds, contentObjects, contentObject]);

  return { items, loading, error };
}

function TemplateFrame({
  icon,
  title,
  subtitle,
  templateId,
  theme,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  templateId: string;
  theme: "light" | "dark";
  children: ReactNode;
}) {
  const isDark = theme === "dark";
  const panelClass = isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200";
  const textClass = isDark ? "text-white" : "text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${panelClass} p-5`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-300">
              {icon}
              KNYT Liquid UI
            </div>
            <div className={`mt-2 text-lg font-semibold ${textClass}`}>{title}</div>
            <div className={`mt-1 text-sm ${mutedClass}`}>{subtitle}</div>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs ${isDark ? "border-slate-700 text-slate-300" : "border-slate-300 text-slate-700"}`}>
            {templateId}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function TemplateBody({
  loading,
  error,
  emptyMessage,
  children,
}: {
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading template content...
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>;
  }

  return children || <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">{emptyMessage}</div>;
}

function useTemplateActions() {
  const { actions, state } = useSmartTriad();

  return {
    open: async (content: SmartContentQube) => {
      // Defence-in-depth gate at the template-action level.
      // The cartridge surfaces (Scrolls, Characters, Lore) all route clicks
      // through here. Any codex-shaped content (mk_ep* master ids or
      // codex_media_assets UUIDs) is treated as gated unless owned.
      const id = content?.id;
      const isCodexAsset = !!id && (
        /^mk_ep\d{1,4}_/i.test(id) ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );
      const isOwned = !!id && actions.checkOwnership(id);
      if (isCodexAsset && !isOwned) {
        // Route to purchase flow instead of opening the viewer. For anon users
        // openWallet routes to the wallet drawer where they can sign in; the
        // pending content stays loaded so the purchase modal can pick it up.
        await actions.loadContent(content.id);
        actions.openWallet("full");
        return;
      }
      await actions.loadContent(content.id);
      actions.setViewerModality("read");
      actions.setActiveDrawer("contentViewer");
    },
    purchase: async (content: SmartContentQube) => {
      await actions.loadContent(content.id);
      actions.openWallet("full");
    },
    isOwned: (contentId: string) => actions.checkOwnership(contentId),
  };
}

export function KnytDualPosterStageTemplate({
  experience,
  packet,
  theme = "dark",
  contentObjects,
  contentObject,
}: KnytStageTemplateProps) {
  const { items, loading, error } = useTemplateContent({ experience, packet, contentObjects, contentObject });
  const { open, purchase, isOwned } = useTemplateActions();
  const primary = items[0];
  const secondaries = items.slice(1, 5);

  return (
    <TemplateFrame
      icon={<Compass className="h-4 w-4 text-indigo-400" />}
      title={experience?.name || "Dual Poster Stage"}
      subtitle={experience?.description || "Featured character with a collectible rail."}
      templateId="knyt:dual_poster_stage_v1"
      theme={theme}
    >
      <TemplateBody loading={loading} error={error} emptyMessage="No character content available for this stage.">
        {primary ? (
          <div className="grid gap-4 lg:grid-cols-[1.75fr_1fr]">
            <SmartContentCard content={primary} variant="poster2" device="desktop" onSelect={open} onPurchase={purchase} isOwned={isOwned(primary.id)} />
            <div className="grid grid-cols-2 gap-3">
              {secondaries.map((item) => (
                <SmartContentCard key={item.id} content={item} variant="poster3" device="desktop" onSelect={open} onPurchase={purchase} isOwned={isOwned(item.id)} />
              ))}
            </div>
          </div>
        ) : null}
      </TemplateBody>
    </TemplateFrame>
  );
}

export function KnytMotionStageTemplate({
  experience,
  packet,
  theme = "dark",
  contentObjects,
  contentObject,
}: KnytStageTemplateProps) {
  const { items, loading, error } = useTemplateContent({ experience, packet, contentObjects, contentObject });
  const { open, purchase, isOwned } = useTemplateActions();
  const stage = items[0];
  const clips = items.slice(1, 9);

  return (
    <TemplateFrame
      icon={<Film className="h-4 w-4 text-indigo-400" />}
      title={experience?.name || "Motion Stage"}
      subtitle={experience?.description || "Cinematic stage with quick-access clip strip."}
      templateId="knyt:motion_stage_v1"
      theme={theme}
    >
      <TemplateBody loading={loading} error={error} emptyMessage="No motion content available for this stage.">
        {stage ? (
          <div className="space-y-4">
            <SmartContentCard content={stage} variant="hero" heroHeight="short" device="desktop" onSelect={open} onPurchase={purchase} isOwned={isOwned(stage.id)} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {clips.map((item) => (
                <SmartContentCard key={item.id} content={item} variant="thumbnailRect" device="desktop" onSelect={open} onPurchase={purchase} isOwned={isOwned(item.id)} />
              ))}
            </div>
          </div>
        ) : null}
      </TemplateBody>
    </TemplateFrame>
  );
}

export function KnytQuestHudHubTemplate({
  experience,
  packet,
  theme = "dark",
  contentObjects,
  contentObject,
}: KnytStageTemplateProps) {
  const { items, loading, error } = useTemplateContent({ experience, packet, contentObjects, contentObject });
  const { open, purchase, isOwned } = useTemplateActions();

  return (
    <TemplateFrame
      icon={<ShieldCheck className="h-4 w-4 text-indigo-400" />}
      title={experience?.name || "Quest HUD Hub"}
      subtitle={experience?.description || "Progress rail with objectives and rewards context."}
      templateId="knyt:quest_hud_hub_v1"
      theme={theme}
    >
      <TemplateBody loading={loading} error={error} emptyMessage="No quest-linked content available right now.">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-3 md:grid-cols-2">
            {items.slice(0, 6).map((item) => (
              <SmartContentCard key={item.id} content={item} variant="standard" device="desktop" onSelect={open} onPurchase={purchase} isOwned={isOwned(item.id)} />
            ))}
          </div>
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-300">
              <Swords className="h-4 w-4 text-indigo-400" />
              Active Objectives
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>• Complete a reading sprint</li>
              <li>• Watch one motion chapter</li>
              <li>• Claim balance reward</li>
            </ul>
          </aside>
        </div>
      </TemplateBody>
    </TemplateFrame>
  );
}

export function KnytRealmBridgeMapTemplate({
  experience,
  packet,
  theme = "dark",
  contentObjects,
  contentObject,
}: KnytStageTemplateProps) {
  const { items, loading, error } = useTemplateContent({ experience, packet, contentObjects, contentObject });
  const { open, purchase, isOwned } = useTemplateActions();

  return (
    <TemplateFrame
      icon={<Map className="h-4 w-4 text-indigo-400" />}
      title={experience?.name || "Realm Bridge Map"}
      subtitle={experience?.description || "Realm-focused map rail with related content cards."}
      templateId="knyt:realm_bridge_map_v1"
      theme={theme}
    >
      <TemplateBody loading={loading} error={error} emptyMessage="No realm content is mapped yet.">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs uppercase tracking-wider text-slate-300">
            Realm rail is active. Select an item to open the connected viewer.
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.slice(0, 9).map((item) => (
              <SmartContentCard key={item.id} content={item} variant="standard" device="desktop" onSelect={open} onPurchase={purchase} isOwned={isOwned(item.id)} />
            ))}
          </div>
        </div>
      </TemplateBody>
    </TemplateFrame>
  );
}
