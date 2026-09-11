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
 * - agentSlug (Journey-selected agent, e.g. "nakamoto" — al, 2026-08-04)
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
import { LEGACY_CODEX_SLUGS, resolveLegacyTabSlug } from "@/data/codex-configs";

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
  // Legacy slug aliases (2026-07-13 ccrl→irl migration) — old embed URLs and
  // stored deep links keep resolving to the renamed cartridge.
  const suffixed = hasKnownSuffix ? rawCodex : `${rawCodex}-codex`;
  const codexId = LEGACY_CODEX_SLUGS[suffixed] ?? suffixed;

  const rawTab = readFirst(searchParams, ["tab", "initialTab", "tabSlug", "section"]);
  const tab = rawTab ? resolveLegacyTabSlug(rawTab) : rawTab;
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
  // SECURITY (2026-08-27 addendum — docs/security/2026-08-27_irl-os-containment-breach-audit.md):
  // there is deliberately no `queryIsAdmin` here anymore. `isAdmin` is
  // resolved EXCLUSIVELY by useCodexEmbedAuthBridge's canonical-persona
  // effect (/api/wallet/active-persona); a `?isAdmin=true`/`?admin=1` URL
  // parameter was previously seeded directly into client state and, for an
  // unauthenticated caller, never overwritten.
  const queryIsPartner = searchParams?.get("isPartner") === "true" || searchParams?.get("partner") === "1";
  // Stub passthrough — IAM service will resolve isInvestor server-side from
  // the persona; the URL param is only for optimistic gating like isAdmin/isPartner.
  const queryIsInvestor = searchParams?.get("isInvestor") === "true" || searchParams?.get("investor") === "1";
  const queryPartnerId = readFirst(searchParams, ["partnerId", "partner_id"]);
  // The Journey's selected agent (al, 2026-08-04) — a single named field,
  // read exactly like every other param here, never a generic passthrough.
  // Forwarded to CodexPanelDynamic -> TabRenderer -> the tab component
  // (today, only AigentMeWelcomeSplitTab consumes it); the destination route
  // resolves it through resolveRegistrableAgent and never trusts it directly.
  const queryAgentSlug = readFirst(searchParams, ["agentSlug"]);
  // `?copilot=off` — a HOST that already provides the operator's conversational
  // partner (today: the Guided Journey viewport) suppresses the cartridge's own
  // floating copilot, so only one is on screen (MS-1: one navigation). Absent
  // or any other value keeps it, so every existing embed URL is unaffected.
  const querySuppressCopilot = searchParams?.get("copilot") === "off";
  // `?chrome=focused` — a HOST that already provides the outer navigation
  // frame (today: the Guided Journey viewport) suppresses the destination
  // cartridge's PRIMARY chrome (top-level brand/tab-group header + the group
  // sub-header strip), while the active tab's own local content — including
  // any toolbar/filters it renders itself — is untouched, since TabRenderer
  // mounts it unconditionally either way. Absent or any other value keeps
  // full chrome, so every existing embed URL is unaffected.
  const querySuppressPrimaryChrome = searchParams?.get("chrome") === "focused";
  // `?depth=N` — focused navigation depth (only meaningful when chrome=focused).
  // Defines how many nav tiers above the content to reveal (0=content only,
  // 1=content+domain nav, etc.). Defaults to 0. Forwarded to CodexPanelDynamic
  // as focusedNavDepth.
  const queryFocusedNavDepth = (() => {
    const raw = searchParams?.get("depth");
    if (!raw) return undefined;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) || parsed < 0 ? undefined : parsed;
  })();
  const { personaId, isAdmin } = useCodexEmbedAuthBridge({
    initialPersonaId: queryPersonaId,
    initialAuthProfileId: queryAuthProfileId,
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
      suppressFloatingCopilot={querySuppressCopilot || undefined}
      suppressPrimaryChrome={querySuppressPrimaryChrome || undefined}
      focusedNavDepth={queryFocusedNavDepth}
      agentSlug={queryAgentSlug}
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
