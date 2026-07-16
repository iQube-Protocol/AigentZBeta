/**
 * Invariant Decision Nodes — registry barrel (CFS-035).
 *
 * Importing this module loads every node module, which triggers each node's
 * `registerNodeMeta(...)` at load time — so the engine's node registry (and the
 * Constitutional Observatory Node View that reads it) sees ALL nodes, not only
 * the ones whose surface happened to run in this instance. The Observatory API
 * imports this barrel for exactly that reason.
 */

export * from './discoveryRanking';
export * from './nbeRanking';
export * from './standingScore';
export * from './journeyProgression';
