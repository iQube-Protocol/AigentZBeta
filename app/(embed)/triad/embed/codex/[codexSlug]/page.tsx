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
import CodexPanelDynamic from "@/app/triad/components/CodexPanelDynamic";
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
  const codexId = rawCodex.endsWith("-codex") ? rawCodex : `${rawCodex}-codex`;

  const tab = readFirst(searchParams, ["tab", "initialTab", "tabSlug", "section"]);
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
  const { personaId, isAdmin } = useCodexEmbedAuthBridge({
    initialPersonaId: queryPersonaId,
    initialAuthProfileId: queryAuthProfileId,
    initialIsAdmin: queryIsAdmin || undefined,
  });

  return (
    <CodexPanelDynamic
      codexId={codexId}
      theme={theme}
      density={density}
      initialTab={tab}
      personaId={personaId}
      isAdmin={isAdmin}
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
