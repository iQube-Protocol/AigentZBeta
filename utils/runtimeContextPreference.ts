/**
 * runtimeContextPreference
 *
 * Single source of truth for the persisted metaMe Runtime takeover context
 * (which cartridge "owns" the runtime welcome surface). Read by both:
 *   - components/metame/MetaMeRuntimeClient.tsx (the runtime — initial state + live sync)
 *   - app/triad/components/codex/tabs/MetaMeRuntimeSettingsTab.tsx (admin toggle)
 *
 * This does NOT rebuild the takeover inference logic — it only persists which
 * context the runtime defaults to on arrival. The in-runtime ⚡ Play-menu toggle
 * and the admin toggle both flip the same value; the runtime listens for the
 * browser-native `storage` event so a change in one surface (e.g. the admin tab
 * in a sibling document/iframe) updates the live runtime without a reload.
 *
 * Launch default is 'metame'. When the key is unset the runtime falls back to
 * the metaMe sovereign surface.
 */

export type RuntimeContext = "metame" | "knyt";

/** localStorage key — shared verbatim by every consumer. Do not duplicate the literal. */
export const RUNTIME_CONTEXT_PREF_KEY = "metame:runtime-default-context";

/** Launch override default when no preference is stored. */
export const DEFAULT_RUNTIME_CONTEXT: RuntimeContext = "metame";

export function getRuntimeContextPreference(): RuntimeContext {
  if (typeof window === "undefined") return DEFAULT_RUNTIME_CONTEXT;
  try {
    const raw = window.localStorage.getItem(RUNTIME_CONTEXT_PREF_KEY);
    return raw === "metame" || raw === "knyt" ? raw : DEFAULT_RUNTIME_CONTEXT;
  } catch {
    return DEFAULT_RUNTIME_CONTEXT;
  }
}

export function setRuntimeContextPreference(ctx: RuntimeContext): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RUNTIME_CONTEXT_PREF_KEY, ctx);
  } catch {
    /* localStorage unavailable — non-fatal */
  }
}
