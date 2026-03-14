type RuntimeLifecycleContributionType =
  | "experience_preview"
  | "experience_launch"
  | "generated_image"
  | "generated_video"
  | "reused_saved_media";

export async function recordRuntimeLifecycleContribution(input: {
  tenantId?: string;
  personaId?: string;
  experienceId?: string;
  contributionType: RuntimeLifecycleContributionType;
  source: string;
  units?: number;
}) {
  const tenantId = input.tenantId?.trim();
  const personaId = input.personaId?.trim();

  if (!tenantId || !personaId) return null;

  const response = await fetch("/api/crm/contributions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantId,
      personaId,
      qubeId: input.experienceId,
      contributionType: input.contributionType,
      units: input.units || 1,
      source: input.source,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      message || `Failed to record lifecycle contribution (${response.status})`
    );
  }

  return response.json().catch(() => null);
}
