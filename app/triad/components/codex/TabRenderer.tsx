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
import type { CodexTab } from "@/types/codex";
import type { DeviceType } from "@/app/types/knytLiquidUI";
import { AlertCircle } from "lucide-react";
import { liquidExperienceRenderer } from "./liquidTemplates/liquidExperienceRenderer";

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
import { QriptoPapersTab } from "./tabs/QriptoPapersTab";
import { PlaceholderTab } from "./tabs/PlaceholderTab";
import { IframeTab } from "./tabs/IframeTab";
import { AgentiqCartridgeTab } from "./tabs/AgentiqCartridgeTab";
import { PackBrowserTab } from "./tabs/PackBrowserTab";
import { MarketaTab } from "./tabs/MarketaTab";
import { KnytTab } from "./tabs/KnytTab";
import { MoneyPennyTab } from "./tabs/MoneyPennyTab";
import { NakamotoTab } from "./tabs/NakamotoTab";
import { ExperienceDashboardTab } from "./tabs/ExperienceDashboardTab";
import { AdminAccessRequestsTab } from "./tabs/AdminAccessRequestsTab";
import { Persona360InspectorTab } from "./tabs/Persona360InspectorTab";
import { AigentMeWelcomeTab } from "./tabs/AigentMeWelcomeTab";
import { AigentMeWelcomeSplitTab } from "./tabs/AigentMeWelcomeSplitTab";
import { ActivationsTab } from "./tabs/ActivationsTab";
import { MyCanvasTab } from "./tabs/MyCanvasTab";
import { MyWorkbenchTab } from "./tabs/MyWorkbenchTab";
import { MyWorkspaceTab } from "./tabs/MyWorkspaceTab";
import { MyCartridgeTab } from "./tabs/MyCartridgeTab";
import { MyLedgerTab } from "./tabs/MyLedgerTab";
import { PersonalCartridgeTab } from "./tabs/PersonalCartridgeTab";
import { CartridgeCatalogueAdminTab } from "./tabs/CartridgeCatalogueAdminTab";
import { InvestorDirectoryTab } from "./tabs/InvestorDirectoryTab";
import { ArtifactTraceabilityTab } from "./tabs/ArtifactTraceabilityTab";
import { FactoryIntakeTab } from "./tabs/FactoryIntakeTab";
import { RegistrySupplyTab } from "./tabs/RegistrySupplyTab";
import KnytRuntimeSurface from "./tabs/KnytRuntimeSurface";
import { KnytRuntimeTab } from "./tabs/KnytRuntimeTab";
import { KnytTreasuryTab } from "./tabs/KnytTreasuryTab";
import { KnytQuestsTab } from "./tabs/KnytQuestsTab";
import { KnytAlphaTab } from "./tabs/KnytAlphaTab";
import { AgentiQOSTab } from "./tabs/AgentiQOSTab";
import { RelationshipBuilderTab } from "./tabs/RelationshipBuilderTab";
import { AlphaProgrammeTab } from "./tabs/AlphaProgrammeTab";
import { AlphaDocsTab } from "./tabs/AlphaDocsTab";
import { PlanPriceConfigAdminTab } from "./tabs/PlanPriceConfigAdminTab";
import { MarketaPartnersAdminTab } from "@/app/(shell)/marketa/components/MarketaPartnersAdminTab";
import { MarketaMyCampaignTab } from "@/app/(shell)/marketa/components/MarketaMyCampaignTab";
import { MarketaProposeTab } from "@/app/(shell)/marketa/components/MarketaProposeTab";
import { MarketaApprovalQueueTab } from "@/app/(shell)/marketa/components/MarketaApprovalQueueTab";
import { MarketaCampaignDashboardTab } from "@/app/(shell)/marketa/components/MarketaCampaignDashboardTab";
import { MarketaCampaignOpsTab } from "@/app/(shell)/marketa/components/MarketaCampaignOpsTab";
import { MarketaMyPacksTab } from "@/app/(shell)/marketa/components/MarketaMyPacksTab";
import { MarketaMyReportsTab } from "@/app/(shell)/marketa/components/MarketaMyReportsTab";
import MarketaLaunchOpsTab from "@/app/(shell)/marketa/components/MarketaLaunchOpsTab";
import MarketaActivationEngineTab from "@/app/(shell)/marketa/components/activation/MarketaActivationEngineTab";
import MarketaQubeTalk from "@/app/(shell)/marketa/components/MarketaQubeTalk";
import { MarketaReportsTab } from "@/app/(shell)/marketa/components/MarketaReportsTab";
import { MarketaPublishTab } from "@/app/(shell)/marketa/components/MarketaPublishTab";
import { VentureLabGrowthMatrixTab } from "./tabs/VentureLabGrowthMatrixTab";
import { VentureLabPortfolioTab } from "./tabs/VentureLabPortfolioTab";
import { FounderOfficeTab } from "./tabs/FounderOfficeTab";
import { FinancialServicesTab } from "./tabs/FinancialServicesTab";
import { VentureFunnelTab } from "./tabs/VentureFunnelTab";
import { QriptopianEditTab } from "./tabs/QriptopianEditTab";
import { QriptopianAdminTab } from "./tabs/QriptopianAdminTab";
import { QriptoAffiliatesPartnersTab } from "./tabs/QriptoAffiliatesPartnersTab";
import { QriptoCommunityCorrespondentTab } from "./tabs/QriptoCommunityCorrespondentTab";
import { QriptoPulseTab } from "./tabs/QriptoPulseTab";
import { QriptoPulseAdminTab } from "./tabs/QriptoPulseAdminTab";
import { KnytStoreEpisodesTab } from "./tabs/KnytStoreEpisodesTab";
import { KnytStoreCardsTab } from "./tabs/KnytStoreCardsTab";
import { KnytStoreBundlesTab } from "./tabs/KnytStoreBundlesTab";
import { KnytStoreInvestorTab } from "./tabs/KnytStoreInvestorTab";
import { KnytStoreAdminTab } from "./tabs/KnytStoreAdminTab";
import { KnytTasksRewardsAdminTab } from "./tabs/KnytTasksRewardsAdminTab";
import { KnytTreasuryAdminTab } from "./tabs/KnytTreasuryAdminTab";
import { KnytCodexAdminTab } from "./tabs/KnytCodexAdminTab";
import { KnytShelfTab } from "./tabs/KnytShelfTab";
import { KnytInvestorDashboardTab } from "./tabs/KnytInvestorDashboardTab";
import { KnytInvestmentsAdminTab } from "./tabs/KnytInvestmentsAdminTab";
import { KnytCommunityContentTab } from "./tabs/KnytCommunityContentTab";
import { KnytCommunityContentAdminTab } from "./tabs/KnytCommunityContentAdminTab";
import { AigentMissionsBoardTab } from "./tabs/AigentMissionsBoardTab";
import { AigentCOSTab } from "./tabs/AigentCOSTab";
import { DevPersonaTab } from "./tabs/DevPersonaTab";
import { BoundedDelegationTab } from "./tabs/BoundedDelegationTab";
import { DevMissionBoardTab } from "./tabs/DevMissionBoardTab";
import { NanOSBridgeTab } from "./tabs/NanOSBridgeTab";
import { DevRegistryTab } from "./tabs/DevRegistryTab";
import { IQubeRegistryBrowseTab } from "./tabs/IQubeRegistryBrowseTab";
import { IQubeRegistryHealthTab } from "./tabs/IQubeRegistryHealthTab";
import { IQubeRegistryMintsTab } from "./tabs/IQubeRegistryMintsTab";
import { IQubeRegistryCanonizationTab } from "./tabs/IQubeRegistryCanonizationTab";
import { IQubeRegistryReceiptsTab } from "./tabs/IQubeRegistryReceiptsTab";
import { IQubeRegistryVocabularyTab } from "./tabs/IQubeRegistryVocabularyTab";
import { IQubeRegistryDocsTab } from "./tabs/IQubeRegistryDocsTab";
import { IQubeRegistryIntakeTab } from "./tabs/IQubeRegistryIntakeTab";
import { InvariantRegistryTab } from "./tabs/InvariantRegistryTab";
import InvariantExperimentLab from "@/components/composer/InvariantExperimentLab";
import PublishedReportsTab from "@/components/composer/PublishedReportsTab";
import CapabilityPipelineTab from "@/components/composer/CapabilityPipelineTab";
import IRLDashboardTab from "@/components/composer/IRLDashboardTab";
import IRLResearchCopilotTab from "@/components/composer/IRLResearchCopilotTab";
import InvariantFieldExplorerTab from "@/components/composer/InvariantFieldExplorerTab";
import { PassportBureauApplyTab } from "./tabs/PassportBureauApplyTab";
import { PassportBureauStewardTab } from "./tabs/PassportBureauStewardTab";
import { PassportRegistryTab } from "./tabs/PassportRegistryTab";
import { LockerTab } from "./tabs/LockerTab";
import { ParticipationStandingTab } from "./tabs/ParticipationStandingTab";
import { StewardParticipationTab } from "./tabs/StewardParticipationTab";
import { IRLWelcomeTab } from "./tabs/IRLWelcomeTab";
import { PassportDoctrineTab } from "./tabs/PassportDoctrineTab";
import { PassportEnsTab } from "./tabs/PassportEnsTab";
import { PassportBeingTab } from "./tabs/PassportBeingTab";
import { HumanMobilityServicesTab } from "./tabs/HumanMobilityServicesTab";
import { MobilityDoctrineTab } from "./tabs/MobilityDoctrineTab";
import { MobilityActivationsTab } from "./tabs/MobilityActivationsTab";
import { MobilityWorkstreamShellTab } from "./tabs/MobilityWorkstreamShellTab";
import { MobilityHousingTab } from "./tabs/MobilityHousingTab";
import { MobilityEducationTab } from "./tabs/MobilityEducationTab";
import { MobilityRelocationTab } from "./tabs/MobilityRelocationTab";
import { MobilityBusinessTab } from "./tabs/MobilityBusinessTab";
import { MobilityEconomicTab } from "./tabs/MobilityEconomicTab";
import { MobilityFamilyTab } from "./tabs/MobilityFamilyTab";
import { MobilityCaseManagementTab } from "./tabs/MobilityCaseManagementTab";
import { MobilityIESTab } from "./tabs/MobilityIESTab";
import { StandingCartridgeTab } from "./tabs/StandingCartridgeTab";
import { MobilitySRBTab } from "./tabs/MobilitySRBTab";
import { RefRuntimeTab } from "./tabs/RefRuntimeTab";
import { RefStudioTab } from "./tabs/RefStudioTab";
import { RefAigentTab } from "./tabs/RefAigentTab";
import { GovernanceConstitutionTab } from "./tabs/GovernanceConstitutionTab";
import { GovernanceRolesTab } from "./tabs/GovernanceRolesTab";
import { GovernanceDecisionLogTab } from "./tabs/GovernanceDecisionLogTab";
import { GovernanceAuthorityMatrixTab } from "./tabs/GovernanceAuthorityMatrixTab";
import { GovernanceReceiptsTab } from "./tabs/GovernanceReceiptsTab";
import { DevCommandCenterTab } from "./tabs/DevCommandCenterTab";
import { ComposerStudio } from "@/components/composer/ComposerStudio";
import { MetaMeStudioTab } from "./tabs/MetaMeStudioTab";
import { PersonalExperienceMatrixTab } from "./tabs/PersonalExperienceMatrixTab";
import { ExperienceAlignmentTab } from "./tabs/ExperienceAlignmentTab";
import { MetaMeStrategyTab } from "./tabs/MetaMeStrategyTab";
import { MetaMeStatusTab } from "./tabs/MetaMeStatusTab";
import { MetaMeNbeTab } from "./tabs/MetaMeNbeTab";
import { MetaMeAnalysisTab } from "./tabs/MetaMeAnalysisTab";
import { MetaMeRuntimeSettingsTab } from "./tabs/MetaMeRuntimeSettingsTab";
import { MetaMePulseAdminTab } from "./tabs/MetaMePulseAdminTab";
import { TAB_TEMPLATES, type TabTemplateProps } from "./tabTemplates/registry";
import type { CartridgeTabTemplateId } from "@/types/ventureQube";

interface TabRendererProps {
  tab: CodexTab;
  codexId: string;
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  isAdmin?: boolean;
  isPartner?: boolean;
  isInvestor?: boolean;
  partnerId?: string;
  issueSlug?: string;
  previewDevice?: DeviceType;
  /** Rendering shell — forwarded to tab components that generate cross-cartridge links. */
  shell?: 'embed' | 'viewer';
}

// Component registry for static tabs
//
// `TabRendererFallback` is a no-op placeholder used when a tab acts
// purely as a parent container — it has no content of its own, just
// holds subTabs that render via the tier-3 sub-tab mechanism in
// CodexPanelDynamic. The fallback renders a thin "pick a sub-tab"
// hint when somehow no subTab is selected (which the panel should
// auto-resolve to subTabs[0]). Registered as a real component so the
// "Component not found" error doesn't fire on KNYT order group's
// admin parent tab or any future parent-only tab — bug surfaced
// 2026-05-26 when an operator landed on /knyt-codex/order.
function TabRendererFallback() {
  return (
    <div className="p-8 text-center text-slate-500 text-sm">
      Select a sub-tab to continue.
    </div>
  );
}

const componentRegistry: Record<string, React.ComponentType<any>> = {
  TabRendererFallback,
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
  QriptoPapersTab,
  AgentiqCartridgeTab,
  MarketaTab,
  KnytTab,
  NakamotoTab,
  PlaceholderTab,
  IframeTab,
  MoneyPennyTab,
  ExperienceDashboardTab,
  AdminAccessRequestsTab,
  Persona360InspectorTab,
  AigentMeWelcomeTab,
  AigentMeWelcomeSplitTab,
  ActivationsTab,
  MyCanvasTab,
  MyWorkbenchTab,
  MyWorkspaceTab,
  MyCartridgeTab,
  MyLedgerTab,
  PersonalCartridgeTab,
  CartridgeCatalogueAdminTab,
  InvestorDirectoryTab,
  ArtifactTraceabilityTab,
  FactoryIntakeTab,
  RegistrySupplyTab,
  KnytRuntimeSurface,
  KnytRuntimeTab,
  KnytTreasuryTab,
  KnytQuestsTab,
  KnytAlphaTab,
  AgentiQOSTab,
  RelationshipBuilderTab,
  AlphaProgrammeTab,
  AlphaDocsTab,
  PlanPriceConfigAdminTab,
  MarketaPartnersAdminTab,
  MarketaMyCampaignTab,
  MarketaProposeTab,
  MarketaApprovalQueueTab,
  MarketaCampaignDashboardTab,
  MarketaCampaignOpsTab,
  MarketaMyPacksTab,
  MarketaMyReportsTab,
  MarketaLaunchOpsTab,
  MarketaActivationEngineTab,
  MarketaQubeTalk,
  MarketaReportsTab,
  MarketaPublishTab,
  VentureLabGrowthMatrixTab,
  VentureLabPortfolioTab,
  FounderOfficeTab,
  FinancialServicesTab,
  VentureFunnelTab,
  QriptopianEditTab,
  QriptopianAdminTab,
  QriptoAffiliatesPartnersTab,
  QriptoCommunityCorrespondentTab,
  QriptoPulseTab,
  QriptoPulseAdminTab,
  KnytStoreEpisodesTab,
  KnytStoreCardsTab,
  KnytStoreBundlesTab,
  KnytStoreInvestorTab,
  KnytStoreAdminTab,
  KnytTasksRewardsAdminTab,
  KnytTreasuryAdminTab,
  KnytCodexAdminTab,
  KnytCommunityContentTab,
  KnytCommunityContentAdminTab,
  KnytShelfTab,
  KnytInvestorDashboardTab,
  KnytInvestmentsAdminTab,
  AigentMissionsBoardTab,
  AigentCOSTab,
  DevPersonaTab,
  BoundedDelegationTab,
  DevMissionBoardTab,
  NanOSBridgeTab,
  DevRegistryTab,
  IQubeRegistryBrowseTab,
  IQubeRegistryHealthTab,
  IQubeRegistryMintsTab,
  IQubeRegistryCanonizationTab,
  IQubeRegistryReceiptsTab,
  IQubeRegistryVocabularyTab,
  IQubeRegistryDocsTab,
  IQubeRegistryIntakeTab,
  InvariantRegistryTab,
  InvariantExperimentLab,
  PublishedReportsTab,
  CapabilityPipelineTab,
  IRLDashboardTab,
  IRLResearchCopilotTab,
  InvariantFieldExplorerTab,
  PassportBureauApplyTab,
  PassportBureauStewardTab,
  PassportRegistryTab,
  LockerTab,
  ParticipationStandingTab,
  StewardParticipationTab,
  IRLWelcomeTab,
  PassportDoctrineTab,
  PassportEnsTab,
  PassportBeingTab,
  HumanMobilityServicesTab,
  MobilityDoctrineTab,
  MobilityActivationsTab,
  MobilityWorkstreamShellTab,
  MobilityHousingTab,
  MobilityEducationTab,
  MobilityRelocationTab,
  MobilityBusinessTab,
  MobilityEconomicTab,
  MobilityFamilyTab,
  MobilityCaseManagementTab,
  MobilityIESTab,
  StandingCartridgeTab,
  MobilitySRBTab,
  RefRuntimeTab,
  RefStudioTab,
  RefAigentTab,
  GovernanceConstitutionTab,
  GovernanceRolesTab,
  GovernanceDecisionLogTab,
  GovernanceAuthorityMatrixTab,
  GovernanceReceiptsTab,
  DevCommandCenterTab,
  ComposerStudio,
  MetaMeStudioTab,
  PersonalExperienceMatrixTab,
  ExperienceAlignmentTab,
  MetaMeStrategyTab,
  MetaMeStatusTab,
  MetaMeNbeTab,
  MetaMeAnalysisTab,
  MetaMeRuntimeSettingsTab,
  MetaMePulseAdminTab,
  RewardsTab: PlaceholderTab,
  DocsTab: PlaceholderTab,
  APITab: PlaceholderTab,
  TutorialsTab: PlaceholderTab,
};

export function TabRenderer({ tab, codexId, theme, density, personaId, isAdmin, isPartner, isInvestor, partnerId, issueSlug, previewDevice, shell }: TabRendererProps) {
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
        isInvestor={isInvestor}
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

  // Handle template tabs — Phase 5 of the myCartridge PRD §22.
  //
  // Cartridge-agnostic templates dispatched from TAB_TEMPLATES. The
  // wizard (Phase 6) writes `tab.config.templateId` to select which
  // template renders; `tab.config.props` carries the per-tab config
  // payload that the template consumes (metrics, actions, etc.).
  //
  // The cartridge slug is derived from `codexId` (the parent codex's
  // id is the canonical slug for the cartridge). Permissions are
  // forwarded from the parent props so templates can render owner-
  // gated UI without re-querying the spine.
  if (tab.type === 'template') {
    const templateId = tab.config.templateId as CartridgeTabTemplateId | undefined;
    if (!templateId) {
      return (
        <div className="p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-amber-400" />
          <p className="text-amber-400">No templateId specified for template tab</p>
        </div>
      );
    }
    const Template = TAB_TEMPLATES[templateId];
    if (!Template) {
      return (
        <div className="p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-400" />
          <p className="text-red-400">Template not found: {templateId}</p>
          <p className="text-sm text-slate-500 mt-2">
            Available templates: {Object.keys(TAB_TEMPLATES).join(', ')}
          </p>
        </div>
      );
    }
    const templateProps: TabTemplateProps = {
      cartridgeSlug: codexId,
      personaId,
      theme,
      density,
      shell,
      permissions: {
        isAdmin,
        isPartner,
      },
      config: tab.config.props,
    };
    return <Template {...templateProps} />;
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

    // Resolve through the named rendering seam (CFS-007, Law VI) — the
    // adapter owns template resolution + context binding; this component
    // owns only JSX instantiation.
    const rendered = liquidTemplate
      ? liquidExperienceRenderer.render(
          { surface: liquidTemplate, props: { issueSlug, dataSource, ...tab.config.props } },
          { theme, density, personaId, device: previewDevice },
        )
      : null;
    if (rendered) {
      const { Component } = rendered;
      return <Component {...rendered.props} />;
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
