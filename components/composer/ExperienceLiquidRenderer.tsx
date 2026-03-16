"use client";

import { liquidTemplateRegistry } from "@/app/triad/components/codex/liquidTemplates/registry";
import { LiquidUIPlaceholderTemplate } from "@/app/triad/components/codex/liquidTemplates/LiquidUIPlaceholderTemplate";
import SkillVideoPlayer from "@/components/composer/SkillVideoPlayer";
import SkillImagePlayer from "@/components/composer/SkillImagePlayer";

function CompositionBundleBrief({ packet }: { packet: Record<string, any> }) {
  const composition =
    packet?.composition && typeof packet.composition === "object" ? packet.composition : null;
  if (!composition) return null;

  const articleDraft =
    packet?.article_draft && typeof packet.article_draft === "object" ? packet.article_draft : null;
  const sequencing = Array.isArray(composition.sequencing)
    ? composition.sequencing.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const nextActions = Array.isArray(composition.nextActions)
    ? composition.nextActions.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const blockKinds = Array.isArray(composition.blockKinds)
    ? composition.blockKinds.filter((item: unknown): item is string => typeof item === "string")
    : [];

  return (
    <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">Make Bundle</div>
          <div className="mt-1 text-base font-semibold text-white">
            {typeof composition.label === "string" ? composition.label : "Composed experience"}
          </div>
          {typeof composition.summary === "string" && composition.summary ? (
            <div className="mt-1 text-sm text-slate-300">{composition.summary}</div>
          ) : null}
        </div>
        {typeof composition.media_mode === "string" ? (
          <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200">
            {composition.media_mode}
          </span>
        ) : null}
      </div>

      {blockKinds.length > 0 ? (
        <div className="mt-3 text-xs text-slate-400">Blocks: {blockKinds.join(" · ")}</div>
      ) : null}

      {articleDraft ? (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Article Context</div>
          <div className="mt-1 font-medium text-white">
            {typeof articleDraft.title === "string" && articleDraft.title ? articleDraft.title : "Editorial draft"}
          </div>
          {typeof articleDraft.prompt === "string" && articleDraft.prompt ? (
            <div className="mt-1 text-xs text-slate-400">{articleDraft.prompt}</div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Sequencing</div>
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            {sequencing.map((step) => (
              <div key={step}>{step}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Next Actions</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {nextActions.map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-300"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <>
        <CompositionBundleBrief packet={packet} />
        <SkillVideoPlayer
          skill_id={packet.skill.skill_id}
          prompt={packet.skill.prompt}
          duration={packet.skill.duration}
          aspect_ratio={packet.skill.aspect_ratio}
          style={packet.skill.style}
          creative_pack={packet.skill.creative_pack}
          experience_id={experience.id}
          trust_override={packet.skill.trust_override}
          initial_video_url={packet.skill.video_url}
          initial_receipt={packet.skill.initial_receipt}
          persona_id={personaId}
        />
      </>
    );
  }

  if (templateKey === "skill:image_player_v1" && packet.image_generation) {
    return (
      <>
        <CompositionBundleBrief packet={packet} />
        <SkillImagePlayer
          provider_id={packet.image_generation.provider_id}
          portrait_prompt={packet.image_generation.portrait_prompt}
          landscape_prompt={packet.image_generation.landscape_prompt}
          visual_style={packet.image_generation.visual_style}
          experience_id={experience.id}
          autoInvoke={packet.image_generation.auto_invoke !== false}
          initial_images={packet.image_generation.initial_images}
          initial_receipt={packet.image_generation.initial_receipt}
          persona_id={personaId}
        />
      </>
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
