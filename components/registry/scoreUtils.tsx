// Re-export shim — canonical location is components/iqube/scoreUtils.
// Phase C C1 lifted these primitives into components/iqube/ so the
// cartridge surfaces and the legacy /registry page can share them.
// Existing imports from components/registry/scoreUtils continue to
// resolve through this shim until callers are migrated; cleanup
// happens during the Phase C observation window.
export * from "../iqube/scoreUtils";
