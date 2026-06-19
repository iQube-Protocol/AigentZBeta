/**
 * Dynamic Codex Embed Route
 *
 * Supports multiple codexes via slug parameter:
 * - /triad/embed/codex/knyt
 * - /triad/embed/codex/qripto
 * - /triad/embed/codex/aigentiq
 *
 * Query params:
 * - tab | initialTab
 * - theme | mode
 * - density
 * - personaId
 */

"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const CodexPanelDynamic = dynamic(
  () => import("@/app/triad/components/CodexPanelDynamic"),
  { ssr: false }
);
import { useCodexEmbedAuthBridge } from "../_lib/useCodexEmbedAuthBridge";

const readFirst = (searchParams: URLSearchParams | null, keys: string[]) => {
  if (!searchParams) return undefined;
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value && value.trim().length > 0) return value.trim();
  }
  return undefined;
};

const normalizeTheme = (raw?: string): "light" | "dark" => {
  const value = (raw || "").toLowerCase();
  if (["light", "0", "false", "off", "day"].includes(value)) return "light";
  return "dark";
};

const normalizeDensity = (raw?: string): "narrow" | "wide" => {
  const value = (raw || "").toLowerCase();
  if (["narrow", "compact"].includes(value)) return "narrow";
  return "wide";
};

function DynamicCodexContent() {
  const params = useParams<{ codexSlug: string }>();
  const searchParams = useSearchParams();

  const routeSlug = (params?.codexSlug || "knyt").trim();
  const codexOverride = readFirst(searchParams, ["codex", "codexId"]);
  const rawCodex = codexOverride || routeSlug;
  // Most cartridges are stored with a `-codex` suffix on their id (e.g. "knyt-codex"),
  // but newer ones use `-cartridge` (e.g. "agentiq-os-cartridge"). If the caller
  // already supplied a value with a recognised suffix, pass it through unchanged.
  const hasKnownSuffix = rawCodex.endsWith("-codex") || rawCodex.endsWith("-cartridge");
  const codexId = hasKnownSuffix ? rawCodex : `${rawCodex}-codex`;

  const tab = readFirst(searchParams, ["tab", "initialTab", "tabSlug", "section"]);
  const autoActivate = readFirst(searchParams, ["autoActivate", "activate"]);
  const theme = normalizeTheme(readFirst(searchParams, ["theme", "mode", "colorMode", "appearance"]));
  const density = normalizeDensity(readFirst(searchParams, ["density", "layoutDensity"]));
  const queryPersonaId = readFirst(searchParams, ["personaId"]);
  const queryAuthProfileId = readFirst(searchParams, [
    "authProfileId",
    "auth_profile_id",
    "profileId",
    "aaAuthProfileId",
  ]);
  const queryIsAdmin = searchParams?.get("isAdmin") === "true" || searchParams?.get("admin") === "1";
  const queryIsPartner = searchParams?.get("isPartner") === "true" || searchParams?.get("partner") === "1";
  // Stub passthrough — IAM service will resolve isInvestor server-side from
  // the persona; the URL param is only for optimistic gating like isAdmin/isPartner.
  const queryIsInvestor = searchParams?.get("isInvestor") === "true" || searchParams?.get("investor") === "1";
  const queryPartnerId = readFirst(searchParams, ["partnerId", "partner_id"]);
  const { personaId, isAdmin } = useCodexEmbedAuthBridge({
    initialPersonaId: queryPersonaId,
    initialAuthProfileId: queryAuthProfileId,
    initialIsAdmin: queryIsAdmin || undefined,
  });

  return (
    <CodexPanelDynamic
      key={codexId}
      codexId={codexId}
      theme={theme}
      density={density}
      initialTab={tab}
      autoActivate={autoActivate}
      personaId={personaId}
      isAdmin={isAdmin}
      isPartner={queryIsPartner || undefined}
      isInvestor={queryIsInvestor || undefined}
      partnerId={queryPartnerId || undefined}
      useDefaults={true}
    />
  );
}

export default function CodexEmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full bg-slate-900">
          <div className="text-white">Loading Codex...</div>
        </div>
      }
    >
      <DynamicCodexContent />
    </Suspense>
  );
}
