import type { ExperienceQubeData } from "@/services/composer/composerStore";

const FALLBACK_TEMPLATE = "liquidui:drawer_grid_v1";

const TEMPLATE_MAP: Record<string, string> = {
  content_analysis_v1: "liquidui:reader_viewer_v1",
  content_summary_v1: "liquidui:reader_viewer_v1",
  knyt_experience_v1: "knyt:drawer_grid_v1",
};

export function resolveLiquidTemplateId(experience: ExperienceQubeData | null | undefined): string {
  if (!experience) return FALLBACK_TEMPLATE;
  const templateId = experience.template_id;
  return TEMPLATE_MAP[templateId] || FALLBACK_TEMPLATE;
}
