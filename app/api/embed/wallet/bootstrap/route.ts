import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCallerAuthProfileId } from "@/services/wallet/personaRepo";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type PersonaRecord = {
  id: string;
  tenant_id: string;
  auth_profile_id: string | null;
  display_name: string;
  fio_handle: string;
  fio_domain: string | null;
  avatar_uri: string | null;
  reputation_score: number | null;
  reputation_bucket: number | null;
  world_id_status: string | null;
  default_identity_state: string | null;
  status: string;
  created_at: string;
};

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function createEventMeta(source: string) {
  const eventId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    eventId,
    source,
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const eventMeta = createEventMeta("embed-wallet-bootstrap");
    const authProfileId = await getCallerAuthProfileId(request);
    const { searchParams } = new URL(request.url);

    const requestedPersonaId = toText(searchParams.get("personaId"));
    const requestedTenantId = toText(searchParams.get("tenantId"));
    const requestedAgentId = toText(searchParams.get("agentId"));
    const requestedAgentName = toText(searchParams.get("agentName"));
    const requestedFioHandle = toText(searchParams.get("fioHandle"));

    let personas: PersonaRecord[] = [];
    if (authProfileId) {
      let query = supabase
        .from("personas")
        .select(
          "id,tenant_id,auth_profile_id,display_name,fio_handle,fio_domain,avatar_uri,reputation_score,reputation_bucket,world_id_status,default_identity_state,status,created_at"
        )
        .eq("auth_profile_id", authProfileId)
        .order("created_at", { ascending: false })
        .limit(25);

      if (requestedTenantId) {
        query = query.eq("tenant_id", requestedTenantId);
      }

      const { data } = await query;
      personas = (data || []) as PersonaRecord[];
    }

    const activePersona =
      personas.find((persona) => persona.id === requestedPersonaId) || personas[0] || null;

    const personaId = activePersona?.id || requestedPersonaId;
    const tenantId = activePersona?.tenant_id || requestedTenantId;

    const agent = {
      id: requestedAgentId || personaId || "embed-agent",
      name: requestedAgentName || activePersona?.display_name || "Embed User",
      fioHandle: requestedFioHandle || activePersona?.fio_handle || null,
    };

    return NextResponse.json({
      ok: true,
      personaId: personaId || null,
      tenantId: tenantId || null,
      authProfileId: authProfileId || null,
      agent,
      persona: activePersona
        ? {
            id: activePersona.id,
            tenantId: activePersona.tenant_id,
            displayName: activePersona.display_name,
            fioHandle: activePersona.fio_handle,
            fioDomain: activePersona.fio_domain,
            avatarUri: activePersona.avatar_uri,
            reputationScore: activePersona.reputation_score ?? 0,
            reputationBucket: activePersona.reputation_bucket ?? 0,
            worldIdStatus: activePersona.world_id_status,
            defaultIdentityState: activePersona.default_identity_state,
            status: activePersona.status,
          }
        : null,
      trust: {
        level: authProfileId ? "verified" : "unverified",
        signals: authProfileId
          ? ["Auth profile verified", "Persona context resolved"]
          : ["Auth profile unavailable", "Using fallback embed context"],
      },
      event_meta: eventMeta,
    });
  } catch (error) {
    console.error("[EmbedWalletBootstrap] Failed to resolve context", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to resolve embed wallet context",
      },
      { status: 500 }
    );
  }
}
