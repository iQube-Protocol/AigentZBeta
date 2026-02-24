"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Layers, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { DevicePreviewSwitcher, type DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { SmartContentCard } from "@/app/components/content";
import { liquidTemplateRegistry } from "@/app/triad/components/codex/liquidTemplates/registry";
import type { SmartContentQube } from "@/types/smartContent";
import type { IQubeTemplate } from "@/types/registry";

function makeFallbackContent(
  id: string,
  title: string,
  app: "metaKnyts" | "Qriptopian" | "AgentiQ",
  kind: "article" | "series" | "issue"
): SmartContentQube {
  return {
    id,
    type: "SmartContentQube",
    app,
    title,
    slug: id,
    version: 1,
    description: `${title} registry demo content`,
    coverImageUri: "",
    creatorRootDid: "did:iq:demo",
    tenantId: "demo",
    modalities: {
      read: { enabled: true, panels: [], textAssets: [], primaryOn: ["mobile", "desktop"], readingDirection: "ltr", estimatedReadMinutes: 5 },
      watch: { enabled: true, videoAssets: [], primaryOn: ["desktop"], subtitleTracks: [], allowPip: true, allowDownload: false },
      listen: { enabled: false, audioAssets: [], primaryOn: ["mobile"], hasTranscript: false, allowBackground: false },
      interact: { enabled: true, agents: [], tools: [], primaryOn: ["desktop"] },
    },
    structure:
      kind === "article"
        ? { kind: "article", headline: title, byline: "Demo Team", publicationDate: new Date().toISOString() }
        : kind === "issue"
          ? { kind: "issue", collectionId: "demo-collection", section: "registry", position: 1, issueNumber: "1", publicationDate: new Date().toISOString() }
          : { kind: "series", title, description: "Demo series", publishedCount: 3, status: "ongoing", contentIds: [] },
    pricingModel: {
      primaryCurrency: "QCT",
      tiers: [{ kind: "free", amount: 0, currency: "QCT", covers: ["full"] }],
      freePreview: {},
      creatorWalletAddress: "",
      platformFeePercentage: 10,
    },
    identityRequirements: {
      minimumIdentifiability: "anonymous",
      allowedPersonas: [],
      personaOverridesAllowed: true,
      requireHumanProof: false,
      requireAgentDeclare: false,
    },
    reputationRequirements: {
      minBucket: 0,
      minKnowledgeScore: 0,
      minTrustScore: 0,
      warningsOnFailure: true,
      preferredSkillCategories: [],
    },
    rewardOutcomes: {
      engagementRewards: [],
      creatorRoyalties: [],
      questRewards: [],
      rewardHubTenantId: "",
    },
    accessPolicy: {
      entitlementRequired: false,
      entitlementType: "free",
      grantedByTxType: [],
      capabilityTtlSeconds: 86400,
    },
    layoutHints: {
      defaultCard: { shape: "portrait", height: "320px", width: "240px" },
      thumbnail: { size: "medium", floating: false, position: "center" },
      carousels: { enabled: true, groupBy: "none", itemsPerView: 4 },
      responsive: {
        mobile: { layout: "stack" },
        tablet: { layout: "grid" },
        desktop: { layout: "split" },
        tv: { layout: "carousel" },
      },
      iframe: { allowEmbed: true, allowFullscreen: true },
    },
    menuIntegration: {
      preferredDrawers: ["contentViewer"],
      optionalDrawers: ["walletCompact", "agentChat"],
      showWalletSummary: true,
      showLibraryStatus: true,
      showQuestProgress: false,
      allowUserOverrides: true,
    },
    libraryMetadata: {
      category: "Demo",
      tags: ["demo", "registry"],
      recommendedShelf: "Featured",
      expiryModel: "permanent",
      expiryDurationSeconds: null,
      sortPriority: 1,
      featured: true,
      contentRating: "G",
      language: "en",
      additionalLanguages: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "published",
  };
}

const FALLBACK_CONTENTS: SmartContentQube[] = [
  makeFallbackContent("demo-knyt-gate", "KNYT: The First Gate", "metaKnyts", "series"),
  makeFallbackContent("demo-qripto-brief", "Qriptopian Dispatch", "Qriptopian", "article"),
  makeFallbackContent("demo-agentiq-builder", "AigentiQ Builder Notes", "AgentiQ", "issue"),
];

type TemplateGroup = "discovery" | "detail" | "utility";
type TemplateStatusFilter = "all" | "live" | "placeholder";

export default function ContentDemoPage() {
  const [tab, setTab] = useState<"content" | "templates" | "drawer">("content");
  const [contentRegistry, setContentRegistry] = useState<SmartContentQube[]>([]);
  const [templatesRegistry, setTemplatesRegistry] = useState<IQubeTemplate[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateGroup, setTemplateGroup] = useState<TemplateGroup>("discovery");
  const [templateStatusFilter, setTemplateStatusFilter] = useState<TemplateStatusFilter>("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  useEffect(() => {
    let active = true;
    const loadContentRegistry = async () => {
      try {
        const res = await fetch("/api/content/registry");
        const json = await res.json();
        if (active && json?.success && Array.isArray(json.data)) {
          setContentRegistry(json.data);
        }
      } finally {
        if (active) setLoadingContent(false);
      }
    };
    loadContentRegistry();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadTemplateRegistry = async () => {
      try {
        const res = await fetch("/api/registry/templates?type=LiquidUITemplateArchetypeQube&limit=50");
        const json = await res.json();
        let items: IQubeTemplate[] = Array.isArray(json?.data) ? json.data : [];

        if (!items.length) {
          const fallbackRes = await fetch("/api/registry/templates?type=LiquidUITemplateArchetypeQube&limit=50&forceFallback=1");
          const fallbackJson = await fallbackRes.json();
          items = Array.isArray(fallbackJson?.data) ? fallbackJson.data : [];
        }

        if (active) setTemplatesRegistry(items);
      } finally {
        if (active) setLoadingTemplates(false);
      }
    };
    loadTemplateRegistry();
    return () => {
      active = false;
    };
  }, []);

  const registryPool = contentRegistry.length ? contentRegistry : FALLBACK_CONTENTS;

  const groupedTemplates = useMemo(() => {
    const groups: Record<TemplateGroup, IQubeTemplate[]> = {
      discovery: [],
      detail: [],
      utility: [],
    };

    for (const template of templatesRegistry) {
      const liquidId = template.metaExtras?.find((m) => m.k === "liquid_template_id")?.v ?? "";
      const fingerprint = `${template.name} ${template.description ?? ""} ${liquidId}`.toLowerCase();

      if (/(feed|grid|catalog|gallery|list|browse|drawer)/.test(fingerprint)) groups.discovery.push(template);
      else if (/(detail|reader|viewer|player|story|article|checkout|stage)/.test(fingerprint)) groups.detail.push(template);
      else groups.utility.push(template);
    }

    return groups;
  }, [templatesRegistry]);

  const templatesForGroup = groupedTemplates[templateGroup];

  const templateOptions = useMemo(() => {
    return templatesForGroup.filter((template) => {
      if (templateStatusFilter === "all") return true;
      const liquidId = template.metaExtras?.find((m) => m.k === "liquid_template_id")?.v ?? "";
      const isLive = liquidId ? Boolean(liquidTemplateRegistry[liquidId]) : false;
      return templateStatusFilter === "live" ? isLive : !isLive;
    });
  }, [templatesForGroup, templateStatusFilter]);

  useEffect(() => {
    if (!templateOptions.length) {
      setSelectedTemplateId("");
      return;
    }
    if (!selectedTemplateId || !templateOptions.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(templateOptions[0].id);
    }
  }, [templateOptions, selectedTemplateId]);

  const selectedTemplate = templatesRegistry.find((t) => t.id === selectedTemplateId) ?? null;
  const selectedLiquidTemplateId = selectedTemplate?.metaExtras?.find((m) => m.k === "liquid_template_id")?.v ?? null;
  const hasRenderer = selectedLiquidTemplateId ? Boolean(liquidTemplateRegistry[selectedLiquidTemplateId]) : false;

  return (
    <div className="min-h-[calc(100vh-8rem)] rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Demo Gallery</h1>
          <p className="text-sm text-white/60">Smart Content Registry • Smart Templates Registry • Smart Drawer Framework</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList className="mb-6 bg-white/5">
          <TabsTrigger value="content" className="px-4">
            <BookOpen className="mr-2 h-4 w-4" />
            Smart Content Registry
          </TabsTrigger>
          <TabsTrigger value="templates" className="px-4">
            <Layers className="mr-2 h-4 w-4" />
            Smart Templates Registry
          </TabsTrigger>
          <TabsTrigger value="drawer" className="px-4">
            <Sparkles className="mr-2 h-4 w-4" />
            Smart Drawer Framework
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-0 space-y-6">
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 text-sm text-white/70">
              {loadingContent ? "Loading content registry..." : `${registryPool.length} content entries`}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {registryPool.slice(0, 6).map((item, i) => (
                <SmartContentCard
                  key={item.id}
                  content={item}
                  variant={i === 0 ? "featured" : "standard"}
                  onSelect={() => undefined}
                  onPurchase={() => undefined}
                />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-4 text-sm font-semibold text-white/90">Content Card Variants</h3>
            <div className="space-y-4">
              <SmartContentCard content={registryPool[0]} variant="hero" heroHeight="short" onSelect={() => undefined} />
              <div className="grid gap-4 md:grid-cols-2">
                <SmartContentCard content={registryPool[1] ?? registryPool[0]} variant="poster2" onSelect={() => undefined} />
                <SmartContentCard content={registryPool[2] ?? registryPool[0]} variant="poster2" onSelect={() => undefined} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {registryPool.slice(0, 3).map((item) => (
                  <SmartContentCard key={`${item.id}-poster3`} content={item} variant="poster3" onSelect={() => undefined} />
                ))}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="templates" className="mt-0 space-y-4">
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-sm text-white/70">
              {loadingTemplates ? "Loading template registry..." : `${templateOptions.length} templates in current filters`}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Select value={templateGroup} onValueChange={(v) => setTemplateGroup(v as TemplateGroup)}>
                <SelectTrigger className="border-white/15 bg-black/25 text-white">
                  <SelectValue placeholder="Template group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Discovery Templates</SelectItem>
                  <SelectItem value="detail">Detail Templates</SelectItem>
                  <SelectItem value="utility">Utility Templates</SelectItem>
                </SelectContent>
              </Select>

              <Select value={templateStatusFilter} onValueChange={(v) => setTemplateStatusFilter(v as TemplateStatusFilter)}>
                <SelectTrigger className="border-white/15 bg-black/25 text-white">
                  <SelectValue placeholder="Renderer status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All renderers</SelectItem>
                  <SelectItem value="live">Live renderers</SelectItem>
                  <SelectItem value="placeholder">Placeholder renderers</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="border-white/15 bg-black/25 text-white">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white/90">{selectedTemplate?.name || "Template Preview"}</h3>
                <p className="truncate text-xs text-white/60">
                  {selectedLiquidTemplateId ? `liquid_template_id: ${selectedLiquidTemplateId}` : "No liquid template id"}
                </p>
              </div>
            </div>

            <PreviewFrame
              className="h-[72vh] w-full overflow-hidden"
              defaultDevice="desktop"
              showToolbar
              renderToolbar={(device: DeviceType, onChange) => (
                <div className="flex items-center justify-between px-1 py-2">
                  <div className="text-xs text-white/60">Renderer: {hasRenderer ? "available" : "fallback preview"}</div>
                  <DevicePreviewSwitcher value={device} onChange={onChange} />
                </div>
              )}
            >
              <div className="h-full w-full overflow-auto bg-slate-950 p-4">
                <SmartContentCard
                  content={registryPool[0]}
                  variant={templateGroup === "detail" ? "hero" : templateGroup === "utility" ? "thumbnailRect" : "poster3"}
                  heroHeight="short"
                  onSelect={() => undefined}
                  onPurchase={() => undefined}
                />
              </div>
            </PreviewFrame>
          </section>
        </TabsContent>

        <TabsContent value="drawer" className="mt-0">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 p-0">
            <iframe
              src="/demo/smart-drawer-new?embed=1"
              title="Smart Drawer Framework"
              className="h-[80vh] w-full border-0 bg-black"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
