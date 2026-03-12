import { resolveCurrentPersona } from "@/app/services/personaService";
import { getActivePersona } from "@/services/wallet/personaService";

export type RuntimeIdentityResolution = {
  userId?: string;
  activePersonaId?: string;
  activePersonaName?: string;
  tenantId?: string;
  source: "wallet-active" | "persona-service" | "fallback";
};

export async function resolveRuntimeIdentity(
  fallback: {
    userId?: string;
    tenantId?: string;
  } = {}
): Promise<RuntimeIdentityResolution> {
  try {
    const activePersona = await getActivePersona();
    if (activePersona?.id) {
      return {
        userId: fallback.userId,
        activePersonaId: activePersona.id,
        activePersonaName:
          activePersona.displayName || activePersona.fioHandle || activePersona.id,
        tenantId: activePersona.tenantId || fallback.tenantId,
        source: "wallet-active",
      };
    }
  } catch {
    // Fall through to persona service resolver.
  }

  try {
    const personaId = await resolveCurrentPersona();
    if (personaId) {
      return {
        userId: fallback.userId,
        activePersonaId: personaId,
        activePersonaName: personaId,
        tenantId: fallback.tenantId,
        source: "persona-service",
      };
    }
  } catch {
    // Fall through to fallback.
  }

  return {
    userId: fallback.userId,
    activePersonaId: undefined,
    activePersonaName: undefined,
    tenantId: fallback.tenantId,
    source: "fallback",
  };
}
