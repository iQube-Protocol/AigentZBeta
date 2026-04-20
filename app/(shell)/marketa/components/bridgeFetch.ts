import { DEFAULT_PERSONA, DEFAULT_TENANT } from "@/types/marketaCampaigns";

const BRIDGE_BASE = "/api/marketa/lvb/bridge";

/**
 * Proxy Supabase storage URLs through our own origin to avoid
 * OpaqueResponseBlocking / CORS issues in <video> and <img> elements.
 */
export function storageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.includes("supabase.co/storage")) {
    return `/api/marketa/media?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function bridgeHeaders(personaId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-tenant-id": DEFAULT_TENANT,
    "x-persona-id": personaId || DEFAULT_PERSONA,
  };
}

export async function bridgeGet<T = unknown>(
  action: string,
  params: Record<string, string> = {},
  personaId: string = DEFAULT_PERSONA
): Promise<T> {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${BRIDGE_BASE}?${qs}`, {
    headers: bridgeHeaders(personaId),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bridge GET ${action} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function bridgePost<T = unknown>(
  action: string,
  body: unknown,
  personaId: string = DEFAULT_PERSONA
): Promise<T> {
  const res = await fetch(`${BRIDGE_BASE}?action=${action}`, {
    method: "POST",
    headers: bridgeHeaders(personaId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Bridge POST ${action} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function trackEngagement(payload: {
  campaign_id: string;
  event_type: "sequence_view" | "asset_click" | "cta_click" | "share_completed";
  sequence_day: number;
  asset_ref?: string;
  persona_id: string;
}): Promise<void> {
  try {
    await fetch("/api/engagement/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personaId: payload.persona_id,
        eventType: "marketa_partner_event",
        contentId: payload.campaign_id,
        contentType: "campaign_sequence",
        metadata: {
          tenant_id: DEFAULT_TENANT,
          campaign_id: payload.campaign_id,
          event_type: payload.event_type,
          sequence_day: payload.sequence_day,
          asset_ref: payload.asset_ref,
        },
      }),
    });
  } catch {
    // non-critical — swallow tracking errors
  }
}
