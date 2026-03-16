type RuntimeLifecycleContributionType =
  | "experience_preview"
  | "experience_launch"
  | "generated_image"
  | "generated_video"
  | "reused_saved_media"
  | "deployment_dispatch";

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

  try {
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
      console.warn("[ComposerLifecycle] CRM contribution failed:", {
        contributionType: input.contributionType,
        tenantId,
        personaId,
        experienceId: input.experienceId,
        status: response.status,
        message,
      });
      return {
        ok: false,
        status: response.status,
        warning: message || `Failed to record lifecycle contribution (${response.status})`,
      };
    }

    return response.json().catch(() => ({ ok: true }));
  } catch (error) {
    console.warn("[ComposerLifecycle] CRM contribution request errored:", {
      contributionType: input.contributionType,
      tenantId,
      personaId,
      experienceId: input.experienceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      warning: error instanceof Error ? error.message : "Failed to record lifecycle contribution",
    };
  }
}
