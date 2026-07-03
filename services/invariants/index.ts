/**
 * The Invariant Service (CFS-003a) — canonical export surface.
 *
 * The runtime authority over the invariant substrate (CFS-001/002/003).
 * Everything else consumes this module; nothing else reads the invariant
 * tables directly. Extend by composition — do not fork, and do not build
 * parallel resolvers (same discipline as the Identity & Access Spine).
 *
 * Constitutional anchor:
 *   codexes/packs/polity-core/constitutional-records/invariant-intelligence.md
 */

export {
  insertInvariant,
  getInvariantById,
  getInvariantsByIds,
  listInvariants,
  upsertContext,
  listContexts,
  listEdgesForInvariants,
  upsertOntologyClass,
  listOntologyClasses,
  type CreateInvariantInput,
  type ListInvariantsFilter,
  type AddContextInput,
  type AddEdgeInput,
  type CreateOntologyClassInput,
} from './store';

export {
  traverse,
  wouldCreateCycle,
  reasoningPath,
  dependencyClosure,
} from './graph';

export {
  normalizeStatement,
  similarity,
  findDuplicates,
  type DuplicateCandidate,
} from './comparison';

export {
  createCollection,
  getCollection,
  listCollections,
  addMembers,
  removeMember,
  listMembers,
  type CreateCollectionInput,
} from './collections';

export {
  aggregateConfidence,
  aggregateStanding,
  checkCoherence,
  composeManifest,
  publishInvariantQube,
  getInvariantQube,
  listInvariantQubes,
  deriveInvariantQubePublicRef,
  type CoherenceResult,
  type PublishInvariantQubeInput,
  type PublishInvariantQubeResult,
} from './publish';

export {
  canonicalizeStatement,
  discoverInvariant,
  validateInvariant,
  canonizeInvariant,
  transitionInvariant,
  computeStandingScore,
  recomputeStanding,
  recordConsequence,
  recordUsage,
  addEdge,
  mergeInvariants,
  type CanonicalFormResult,
  type DiscoverInvariantResult,
  type ValidationVerdict,
} from './lifecycle';
