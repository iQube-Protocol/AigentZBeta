/**
 * TabRenderer Component
 * 
 * Dynamically renders tab content based on tab type:
 * - 'static': Renders hardcoded component
 * - 'dynamic': Fetches data from API and renders with component
 * - 'liquid-ui': Renders Liquid UI template
 */

"use client";

import React from "react";
import { CodexTab } from "@/types/codex";
import type { DeviceType } from "@/app/types/knytLiquidUI";
import { AlertCircle } from "lucide-react";
import { liquidTemplateRegistry } from "./liquidTemplates/registry";

// Import static tab components
import { ScrollsTab } from "./tabs/ScrollsTab";
import { CharactersTab } from "./tabs/CharactersTab";
import { LoreTab } from "./tabs/LoreTab";
import { DigiTerraTab } from "./tabs/DigiTerraTab";
import { TerraTab } from "./tabs/TerraTab";
import { OrderTab } from "./tabs/OrderTab";
import { QriptopiaTab } from "./tabs/QriptopiaTab";
import { FeaturesTab } from "./tabs/FeaturesTab";
import { PennyDropsTab } from "./tabs/PennyDropsTab";
import { Kn0wdZTab } from "./tabs/Kn0wdZTab";
import { QriptoScrollsTab } from "./tabs/QriptoScrollsTab";
import { PlaceholderTab } from "./tabs/PlaceholderTab";
import { AgentiqCartridgeTab } from "./tabs/AgentiqCartridgeTab";
import { PackBrowserTab } from "./tabs/PackBrowserTab";
import { MarketaTab } from "./tabs/MarketaTab";
import { KnytTab } from "./tabs/KnytTab";
import { MoneyPennyTab } from "./tabs/MoneyPennyTab";
import { NakamotoTab } from "./tabs/NakamotoTab";
import { ExperienceDashboardTab } from "./tabs/ExperienceDashboardTab";
import { InvestorDirectoryTab } from "./tabs/InvestorDirectoryTab";
import { ArtifactTraceabilityTab } from "./tabs/ArtifactTraceabilityTab";
import { FactoryIntakeTab } from "./tabs/FactoryIntakeTab";
import { RegistrySupplyTab } from "./tabs/RegistrySupplyTab";
import KnytRuntimeSurface from "./tabs/KnytRuntimeSurface";
import { KnytTreasuryTab } from "./tabs/KnytTreasuryTab";
import { KnytAlphaTab } from "./tabs/KnytAlphaTab";
import { AgentiQOSTab } from "./tabs/AgentiQOSTab";
import { RelationshipBuilderTab } from "./tabs/RelationshipBuilderTab";
import { AlphaProgrammeTab } from "./tabs/AlphaProgrammeTab";
import { AlphaDocsTab } from "./tabs/AlphaDocsTab";
import { MarketaPartnersAdminTab } from "@/app/(shell)/marketa/components/MarketaPartnersAdminTab";
import { MarketaMyCampaignTab } from "@/app/(shell)/marketa/components/MarketaMyCampaignTab";
import { MarketaProposeTab } from "@/app/(shell)/marketa/components/MarketaProposeTab";
import { MarketaApprovalQueueTab } from "@/app/(shell)/marketa/components/MarketaApprovalQueueTab";
import { MarketaCampaignDashboardTab } from "@/app/(shell)/marketa/components/MarketaCampaignDashboardTab";
import { MarketaCampaignOpsTab } from "@/app/(shell)/marketa/components/MarketaCampaignOpsTab";
import { MarketaMyPacksTab } from "@/app/(shell)/marketa/components/MarketaMyPacksTab";
import { MarketaMyReportsTab } from "@/app/(shell)/marketa/components/MarketaMyReportsTab";

interface TabRendererProps {
  tab: CodexTab;
  codexId: string;
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  isAdmin?: boolean;
  isPartner?: boolean;
  partnerId?: string;
  issueSlug?: string;
  previewDevice?: DeviceType;
  /** Rendering shell — forwarded to tab components that generate cross-cartridge links. */
  shell?: 'embed' | 'viewer';
}

// Component registry for static tabs
const componentRegistry: Record<string, React.ComponentType<any>> = {
  ScrollsTab,
  CharactersTab,
  LoreTab,
  DigiTerraTab,
  TerraTab,
  OrderTab,
  QriptopiaTab,
  FeaturesTab,
  PennyDropsTab,
  Kn0wdZTab,
  QriptoScrollsTab,
  AgentiqCartridgeTab,
  MarketaTab,
  KnytTab,
  NakamotoTab,
  PlaceholderTab,
  MoneyPennyTab,
  ExperienceDashboardTab,
  InvestorDirectoryTab,
  ArtifactTraceabilityTab,
  FactoryIntakeTab,
  RegistrySupplyTab,
  KnytRuntimeSurface,
  KnytTreasuryTab,
  KnytAlphaTab,
  AgentiQOSTab,
  RelationshipBuilderTab,
  AlphaProgrammeTab,
  AlphaDocsTab,
  MarketaPartnersAdminTab,
  MarketaMyCampaignTab,
  MarketaProposeTab,
  MarketaApprovalQueueTab,
  MarketaCampaignDashboardTab,
  MarketaCampaignOpsTab,
  MarketaMyPacksTab,
  MarketaMyReportsTab,
  RewardsTab: PlaceholderTab,
  DocsTab: PlaceholderTab,
  APITab: PlaceholderTab,
  TutorialsTab: PlaceholderTab,
};

export function TabRenderer({ tab, codexId, theme, density, personaId, isAdmin, isPartner, partnerId, issueSlug, previewDevice, shell }: TabRendererProps) {
  // Handle static tabs
  if (tab.type === 'static') {
    const componentName = tab.config.component;
    if (!componentName) {
      return (
        <div className="p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-amber-400" />
          <p className="text-amber-400">No component specified for static tab</p>
        </div>
      );
    }

    const Component = componentRegistry[componentName];
    if (!Component) {
      return (
        <div className="p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-400" />
          <p className="text-red-400">Component not found: {componentName}</p>
          <p className="text-sm text-slate-500 mt-2">
            Available components: {Object.keys(componentRegistry).join(', ')}
          </p>
        </div>
      );
    }

    return (
      <Component
        theme={theme}
        density={density}
        personaId={personaId}
        isAdmin={isAdmin}
        isPartner={isPartner}
        partnerId={partnerId}
        issueSlug={issueSlug}
        forcedDevice={previewDevice}
        tabSlug={tab.slug}
        codexId={codexId}
        shell={shell}
        {...tab.config.props}
      />
    );
  }

  // Handle dynamic tabs (fetch data from API)
  if (tab.type === 'dynamic') {
    const packId = tab.config.props?.packId as string | undefined;
    const collectionId = tab.config.props?.collectionId as string | undefined;
    const defaultPath = tab.config.props?.defaultPath as string | undefined;
    const componentName = tab.config.component;
    const dataSource = tab.config.dataSource;

    if (packId) {
      return (
        <PackBrowserTab
          packId={packId}
          collectionId={collectionId}
          defaultPath={defaultPath}
          theme={theme}
        />
      );
    }

    if (componentName && componentRegistry[componentName]) {
      const Component = componentRegistry[componentName];
      return (
        <Component
          theme={theme}
          density={density}
          personaId={personaId}
          issueSlug={issueSlug}
          forcedDevice={previewDevice}
          dataSource={dataSource}
          {...tab.config.props}
        />
      );
    }

    return (
      <PlaceholderTab
        title={tab.label}
        description={`Dynamic content from ${tab.config.dataSource || 'API'}`}
        theme={theme}
      />
    );
  }

  // Handle liquid-ui tabs
  if (tab.type === 'liquid-ui') {
    const packId = tab.config.props?.packId as string | undefined;
    const collectionId = tab.config.props?.collectionId as string | undefined;
    const defaultPath = tab.config.props?.defaultPath as string | undefined;
    const liquidTemplate = tab.config.liquidTemplate as string | undefined;
    const dataSource = tab.config.dataSource as string | undefined;

    if (packId) {
      return (
        <PackBrowserTab
          packId={packId}
          collectionId={collectionId}
          defaultPath={defaultPath}
          theme={theme}
        />
      );
    }

    const Template = liquidTemplate ? liquidTemplateRegistry[liquidTemplate] : undefined;
    if (Template) {
      return (
        <Template
          theme={theme}
          density={density}
          personaId={personaId}
          issueSlug={issueSlug}
          forcedDevice={previewDevice}
          dataSource={dataSource}
          {...tab.config.props}
        />
      );
    }

    return (
      <PlaceholderTab
        title={tab.label}
        description={`Liquid UI template: ${tab.config.liquidTemplate || 'Not specified'}`}
        theme={theme}
      />
    );
  }

  // Fallback for unknown tab types
  return (
    <div className="p-8 text-center">
      <AlertCircle className="w-8 h-8 mx-auto mb-4 text-amber-400" />
      <p className="text-amber-400">Unknown tab type: {tab.type}</p>
    </div>
  );
}
