/**
 * Admin Codex Embed Page
 *
 * Embeddable admin-mode codex panel for use in the Lovable/admin dashboard.
 * Renders CodexPanelDynamic with admin context enabled.
 *
 * Query params:
 * - codex | codexId | slug: string (defaults to 'knyt-codex')
 * - tab | initialTab: string (optional)
 * - theme | mode: 'light' | 'dark' (optional, default 'dark')
 * - density: 'narrow' | 'wide' (optional, default 'wide')
 * - personaId: string (optional)
 */

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import CodexPanelDynamic from "@/app/triad/components/CodexPanelDynamic";
import { useCodexEmbedAuthBridge } from "../../codex/_lib/useCodexEmbedAuthBridge";

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

function AdminCodexContent() {
  const searchParams = useSearchParams();
  const codexParam = readFirst(searchParams, ["codex", "codexId", "slug"]);
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

  const { personaId } = useCodexEmbedAuthBridge({
    initialPersonaId: queryPersonaId,
    initialAuthProfileId: queryAuthProfileId,
  });

  const codexId = codexParam
    ? codexParam.endsWith("-codex")
      ? codexParam
      : `${codexParam}-codex`
    : "knyt-codex";

  return (
    <CodexPanelDynamic
      codexId={codexId}
      theme={theme}
      density={density}
      initialTab={tab}
      personaId={personaId}
      useDefaults={true}
    />
  );
}

export default function AdminCodexEmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full bg-slate-900">
          <div className="text-white">Loading Admin Codex...</div>
        </div>
      }
    >
      <AdminCodexContent />
    </Suspense>
  );
}
