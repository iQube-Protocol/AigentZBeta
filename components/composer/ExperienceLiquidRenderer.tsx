"use client";

import { liquidTemplateRegistry } from "@/app/triad/components/codex/liquidTemplates/registry";
import { LiquidUIPlaceholderTemplate } from "@/app/triad/components/codex/liquidTemplates/LiquidUIPlaceholderTemplate";
import SkillVideoPlayer from "@/components/composer/SkillVideoPlayer";
import SkillImagePlayer from "@/components/composer/SkillImagePlayer";

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

  if (!packet) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
        Waiting for the experience packet...
      </div>
    );
  }

  // Skill-backed experience: render SkillVideoPlayer
  if (templateKey === "skill:video_player_v1" && packet.skill) {
    return (
      <SkillVideoPlayer
        skill_id={packet.skill.skill_id}
        prompt={packet.skill.prompt}
        duration={packet.skill.duration}
        aspect_ratio={packet.skill.aspect_ratio}
        style={packet.skill.style}
        creative_pack={packet.skill.creative_pack}
        experience_id={experience.id}
        trust_override={packet.skill.trust_override}
      />
    );
  }

  if (templateKey === "skill:image_player_v1" && packet.image_generation) {
    return (
      <SkillImagePlayer
        provider_id={packet.image_generation.provider_id}
        portrait_prompt={packet.image_generation.portrait_prompt}
        landscape_prompt={packet.image_generation.landscape_prompt}
        visual_style={packet.image_generation.visual_style}
        experience_id={experience.id}
        autoInvoke={packet.image_generation.auto_invoke !== false}
      />
    );
  }

  // Standard Liquid UI template resolution
  const Template = templateKey ? liquidTemplateRegistry[templateKey] : undefined;
  const fallbackTemplate =
    liquidTemplateRegistry["liquidui:drawer_grid_2a"] ||
    liquidTemplateRegistry["liquidui:drawer_grid_v1"] ||
    liquidTemplateRegistry["knyt:drawer_grid_v1"];
  const useFallback = !Template || Template === LiquidUIPlaceholderTemplate;
  const ResolvedTemplate = useFallback ? fallbackTemplate : Template;

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
