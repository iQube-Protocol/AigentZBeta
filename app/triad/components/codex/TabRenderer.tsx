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
import { AlertCircle } from "lucide-react";

// Import static tab components
import { ScrollsTab } from "./tabs/ScrollsTab";
import { CharactersTab } from "./tabs/CharactersTab";
import { LoreTab } from "./tabs/LoreTab";
import { DigiTerraTab } from "./tabs/DigiTerraTab";
import { TerraTab } from "./tabs/TerraTab";
import { OrderTab } from "./tabs/OrderTab";
import { QriptopiaTab } from "./tabs/QriptopiaTab";
import { FeaturesTab } from "./tabs/FeaturesTab";
import { PlaceholderTab } from "./tabs/PlaceholderTab";

interface TabRendererProps {
  tab: CodexTab;
  codexId: string;
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
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
  PlaceholderTab,
  QriptoScrollsTab: ScrollsTab, // Reuse for Qripto
  Kn0wdZTab: PlaceholderTab,
  PennyDropsTab: PlaceholderTab,
  RewardsTab: PlaceholderTab,
  DocsTab: PlaceholderTab,
  APITab: PlaceholderTab,
  TutorialsTab: PlaceholderTab,
};

export function TabRenderer({ tab, codexId, theme, density, personaId }: TabRendererProps) {
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

    return <Component theme={theme} density={density} personaId={personaId} {...tab.config.props} />;
  }

  // Handle dynamic tabs (fetch data from API)
  if (tab.type === 'dynamic') {
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
