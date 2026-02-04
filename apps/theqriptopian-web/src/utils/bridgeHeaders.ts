import { getCurrentPersonaId } from "./articleSharing";

const ENV_PERSONA = import.meta.env.VITE_LVB_BRIDGE_PERSONA_ID || "test-persona-admin";
const ENV_TENANT = import.meta.env.VITE_LVB_BRIDGE_TENANT_ID || "agq-tenant";
const ENV_DEV_OVERRIDE = import.meta.env.VITE_LVB_BRIDGE_DEV_OVERRIDE || "true";

export interface BridgeHeaderContext {
  personaId: string;
  tenantId: string;
  devOverride?: string;
}

export function getBridgeHeaderContext(): BridgeHeaderContext {
  const personaFromStorage = getCurrentPersonaId();
  const tenantFromStorage = typeof window !== "undefined"
    ? window.localStorage.getItem("currentTenantId") || window.sessionStorage.getItem("currentTenantId") || undefined
    : undefined;

  return {
    personaId: personaFromStorage || ENV_PERSONA,
    tenantId: tenantFromStorage || ENV_TENANT,
    devOverride: ENV_DEV_OVERRIDE,
  };
}
