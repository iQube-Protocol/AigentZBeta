"use client";

import { liquidTemplateRegistry } from "@/app/triad/components/codex/liquidTemplates/registry";
import { LiquidUIPlaceholderTemplate } from "@/app/triad/components/codex/liquidTemplates/LiquidUIPlaceholderTemplate";

type ExperienceQube = {
  id: string;
  name: string;
  description?: string;
  configuration?: Record<string, any>;
};

interface ExperienceLiquidRendererProps {
  experience: ExperienceQube;
  packet: Record<string, any> | null;
  theme?: "light" | "dark";
  personaId?: string;
}

export function ExperienceLiquidRenderer({
  experience,
  packet,
  theme = "dark",
  personaId,
}: ExperienceLiquidRendererProps) {
  const templateKey = packet?.ui?.primary_template as string | undefined;
  const Template = templateKey ? liquidTemplateRegistry[templateKey] : undefined;
  const fallbackTemplate =
    liquidTemplateRegistry["liquidui:drawer_grid_2a"] ||
    liquidTemplateRegistry["liquidui:drawer_grid_v1"] ||
    liquidTemplateRegistry["knyt:drawer_grid_v1"];
  const useFallback = !Template || Template === LiquidUIPlaceholderTemplate;
  const ResolvedTemplate = useFallback ? fallbackTemplate : Template;

  if (!packet) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
        Waiting for the experience packet...
      </div>
    );
  }

  if (!ResolvedTemplate) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-200">
        Liquid UI template not found for {templateKey || "unknown template"}.
      </div>
    );
  }

  return (
    <ResolvedTemplate
      theme={theme}
      personaId={personaId}
      packet={packet}
      experience={experience}
    />
  );
}
