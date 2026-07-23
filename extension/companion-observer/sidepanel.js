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
 */
document.getElementById('companionFrame').src = COMPANION_EMBED_URL;
