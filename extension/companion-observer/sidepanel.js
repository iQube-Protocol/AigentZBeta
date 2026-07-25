/**
 * metaMe Companion — side panel host page script.
 * (PRD-MMC-IMPL-001 §7 follow-up: docked overlay instead of a new tab.)
 *
 * Points the iframe at the real Companion embed page. Identity resolution
 * happens the SAME way it already does for any other tab on this origin —
 * the iframe shares dev-beta.aigentz.me's own localStorage/cookies with any
 * other tab the operator has open on that origin (iframes are not a separate
 * storage partition from same-origin top-level tabs), so
 * `useCodexEmbedAuthBridge`'s existing localStorage fallback picks up the
 * active persona without this script needing to pass anything extra.
 *
 * RUNTIME REGISTRATION (SPEC-MMC-003 §3.6, 2026-07-25): the one thing this
 * script DOES pass is which Companion surface is hosting the embed. Without
 * it the page hardcoded `surface: 'web-embed'` into `resolveCompanionContext`
 * even when it was mounted inside the extension's docked side panel, so the
 * runtime could not distinguish the two — the exact gap §0.5 named
 * ('extension-sidebar' reserved in `types/companion.ts`, never used). The
 * param is validated by the receiving page against the canonical
 * `COMPANION_SURFACE_KINDS` list (`parseCompanionSurfaceKind`); an absent or
 * unknown value falls back to 'web-embed' exactly as before.
 */
document.getElementById('companionFrame').src =
  `${COMPANION_EMBED_URL}?surface=${encodeURIComponent(COMPANION_SURFACE_SIDEBAR)}`;
