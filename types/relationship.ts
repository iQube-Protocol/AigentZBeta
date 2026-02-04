/**
 * RelationshipQube Type Definitions
 * 
 * Wave layer connections between content particles AND personas.
 * Supports sequences, branches, series, collections, quest paths,
 * and contextual persona relationships.
 * 
 * Relationships can be applied to:
 * - SmartContentQubes (content → content)
 * - Personas (persona → persona, persona → content)
 * - Agents (agent → content, agent → persona)
 */

import type { RelationshipType } from './smartContent';

// =============================================================================
// RELATIONSHIP TARGET TYPES
// =============================================================================

/** Entity types that can participate in relationships */
export type RelationshipEntityType = 
  | 'SmartContentQube'
  | 'Persona'
  | 'Agent'
  | 'Series'
  | 'Collection'
  | 'Quest'
  | 'Shelf';

/** Relationship direction */
export type RelationshipDirection = 'unidirectional' | 'bidirectional';

/** Relationship strength/weight */
export type RelationshipStrength = 'weak' | 'normal' | 'strong' | 'required';

// =============================================================================
// RELATIONSHIP METADATA
// =============================================================================

export interface RelationshipMetadata {
  /** Display label for this relationship */
  label?: string;
  
  /** Description of the relationship */
  description?: string;
  
  /** Sort order within relationship type */
  sortOrder: number;
  
  /** Whether this relationship is featured/highlighted */
  featured: boolean;
  
  /** Custom metadata */
  custom?: Record<string, any>;
}

// =============================================================================
// SEQUENCE RELATIONSHIP (Linear Progression)
// =============================================================================

export interface SequenceRelationship {
  type: 'sequence';
  
  /** Previous item in sequence */
  previousId?: string;
  previousType?: RelationshipEntityType;
  
  /** Next item in sequence */
  nextId?: string;
  nextType?: RelationshipEntityType;
  
  /** Position in sequence (1-indexed) */
  position: number;
  
  /** Total items in sequence (if known) */
  totalInSequence?: number;
  
  /** Sequence identifier (groups related sequences) */
  sequenceId: string;
  
  /** Auto-advance to next after completion */
  autoAdvance: boolean;
  
  /** Delay before auto-advance (seconds) */
  autoAdvanceDelaySeconds?: number;
}

// =============================================================================
// BRANCH RELATIONSHIP (Alternative Paths)
// =============================================================================

export interface BranchRelationship {
  type: 'branch';
  
  /** Branch point (where this branch originates) */
  branchPointId: string;
  branchPointType: RelationshipEntityType;
  
  /** Branch targets (alternative paths) */
  branches: Array<{
    targetId: string;
    targetType: RelationshipEntityType;
    label: string;
    condition?: string; // Optional condition for this branch
    isDefault: boolean;
  }>;
  
  /** Whether user can return to branch point */
  allowReturn: boolean;
  
  /** Branch selection mode */
  selectionMode: 'user' | 'conditional' | 'random';
}

// =============================================================================
// SERIES RELATIONSHIP (Parent-Child Grouping)
// =============================================================================

export interface SeriesRelationship {
  type: 'series';
  
  /** Parent series ID */
  seriesId: string;
  
  /** Series title */
  seriesTitle: string;
  
  /** Position within series */
  positionInSeries: number;
  
  /** Season/volume number (optional) */
  seasonNumber?: number;
  
  /** Episode/chapter number within season */
  episodeNumber?: number;
  
  /** All sibling IDs in this series */
  siblingIds: string[];
  
  /** Series completion percentage for user */
  completionPercentage?: number;
}

// =============================================================================
// COLLECTION RELATIONSHIP (Thematic Grouping)
// =============================================================================

export interface CollectionRelationship {
  type: 'collection';
  
  /** Collection ID */
  collectionId: string;
  
  /** Collection title */
  collectionTitle: string;
  
  /** Collection theme/category */
  theme: string;
  
  /** Position within collection */
  positionInCollection: number;
  
  /** Curator/owner of collection */
  curatorId?: string;
  
  /** Whether collection is public */
  isPublic: boolean;
}

// =============================================================================
// REFERENCE RELATIONSHIP (Cross-Reference)
// =============================================================================

export interface ReferenceRelationship {
  type: 'reference';
  
  /** Referenced entity ID */
  referencedId: string;
  referencedType: RelationshipEntityType;
  
  /** Reference context (why this reference exists) */
  context: string;
  
  /** Reference strength */
  strength: RelationshipStrength;
  
  /** Bidirectional reference */
  bidirectional: boolean;
  
  /** Reference category */
  category: 'seeAlso' | 'relatedTo' | 'inspiredBy' | 'continuedIn' | 'expandedIn' | 'custom';
}

// =============================================================================
// PREREQUISITE RELATIONSHIP (Required Before Access)
// =============================================================================

export interface PrerequisiteRelationship {
  type: 'prerequisite';
  
  /** Required entity ID */
  requiredId: string;
  requiredType: RelationshipEntityType;
  
  /** Requirement type */
  requirementType: 'completed' | 'owned' | 'started' | 'achieved';
  
  /** Whether this is a hard or soft requirement */
  isHard: boolean;
  
  /** Message to show if prerequisite not met */
  blockedMessage?: string;
  
  /** Alternative prerequisites (any of these satisfies) */
  alternatives?: Array<{
    id: string;
    type: RelationshipEntityType;
  }>;
}

// =============================================================================
// QUEST PATH RELATIONSHIP (Journey Progression)
// =============================================================================

export interface QuestPathRelationship {
  type: 'questPath';
  
  /** Quest ID */
  questId: string;
  
  /** Quest title */
  questTitle: string;
  
  /** Step number in quest */
  stepNumber: number;
  
  /** Total steps in quest */
  totalSteps: number;
  
  /** Step objective */
  objective: string;
  
  /** Reward for completing this step */
  stepReward?: {
    amount: number;
    asset: string;
  };
  
  /** Quest completion reward */
  questCompletionReward?: {
    amount: number;
    asset: string;
  };
  
  /** Next step ID */
  nextStepId?: string;
  
  /** Previous step ID */
  previousStepId?: string;
  
  /** Optional/bonus step */
  isOptional: boolean;
}

// =============================================================================
// PLAYLIST RELATIONSHIP (Curated Sequence)
// =============================================================================

export interface PlaylistRelationship {
  type: 'playlist';
  
  /** Playlist ID */
  playlistId: string;
  
  /** Playlist title */
  playlistTitle: string;
  
  /** Position in playlist */
  positionInPlaylist: number;
  
  /** Playlist creator ID */
  creatorId: string;
  
  /** Playlist visibility */
  visibility: 'private' | 'shared' | 'public';
  
  /** Shuffle mode enabled */
  shuffleEnabled: boolean;
  
  /** Repeat mode */
  repeatMode: 'none' | 'one' | 'all';
}

// =============================================================================
// PERSONA RELATIONSHIP (Smart Persona Context)
// =============================================================================

export interface PersonaRelationship {
  type: 'persona';
  
  /** Source persona ID */
  sourcePersonaId: string;
  
  /** Target entity */
  targetId: string;
  targetType: RelationshipEntityType;
  
  /** Relationship kind */
  relationshipKind: 
    | 'creator'      // Persona created this content
    | 'consumer'     // Persona consumed this content
    | 'collaborator' // Persona collaborated on this
    | 'recommender'  // Persona recommended this
    | 'curator'      // Persona curated this into collection
    | 'mentor'       // Persona mentors another persona
    | 'mentee'       // Persona is mentored by another
    | 'peer'         // Peer relationship
    | 'follower'     // Following relationship
    | 'blocked';     // Blocked relationship
  
  /** Relationship established date */
  establishedAt: string;
  
  /** Relationship strength */
  strength: RelationshipStrength;
  
  /** Privacy level */
  privacy: 'private' | 'connections' | 'public';
  
  /** Notes/context */
  notes?: string;
}

// =============================================================================
// UNION TYPE FOR ALL RELATIONSHIPS
// =============================================================================

export type RelationshipData = 
  | SequenceRelationship
  | BranchRelationship
  | SeriesRelationship
  | CollectionRelationship
  | ReferenceRelationship
  | PrerequisiteRelationship
  | QuestPathRelationship
  | PlaylistRelationship
  | PersonaRelationship;

// =============================================================================
// RELATIONSHIP QUBE - MAIN INTERFACE
// =============================================================================

export interface RelationshipQube {
  /** Unique identifier */
  id: string;
  
  /** Type discriminator */
  qubeType: 'RelationshipQube';
  
  /** Source entity */
  sourceId: string;
  sourceType: RelationshipEntityType;
  
  /** Target entity */
  targetId: string;
  targetType: RelationshipEntityType;
  
  /** Relationship type */
  relationshipType: RelationshipType;
  
  /** Direction */
  direction: RelationshipDirection;
  
  /** Relationship-specific data */
  data: RelationshipData;
  
  /** Metadata */
  metadata: RelationshipMetadata;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Created by (root DID) */
  createdBy: string;
  
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  
  /** Status */
  status: 'active' | 'inactive' | 'pending' | 'archived';
}

// =============================================================================
// RELATIONSHIP GRAPH QUERY TYPES
// =============================================================================

export interface RelationshipQuery {
  /** Filter by source */
  sourceId?: string;
  sourceType?: RelationshipEntityType;
  
  /** Filter by target */
  targetId?: string;
  targetType?: RelationshipEntityType;
  
  /** Filter by relationship type */
  relationshipType?: RelationshipType;
  
  /** Filter by status */
  status?: RelationshipQube['status'];
  
  /** Include reverse relationships */
  includeBidirectional?: boolean;
  
  /** Depth for graph traversal */
  depth?: number;
  
  /** Limit results */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
}

export interface RelationshipGraphNode {
  id: string;
  type: RelationshipEntityType;
  label: string;
  metadata?: Record<string, any>;
}

export interface RelationshipGraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: RelationshipType;
  label?: string;
  strength: RelationshipStrength;
}

export interface RelationshipGraph {
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
  rootId: string;
  depth: number;
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

export const defaultRelationshipMetadata: RelationshipMetadata = {
  sortOrder: 0,
  featured: false,
};

/** Create a sequence relationship */
export function createSequenceRelationship(
  sourceId: string,
  sourceType: RelationshipEntityType,
  sequenceId: string,
  position: number,
  options?: {
    previousId?: string;
    nextId?: string;
    totalInSequence?: number;
    autoAdvance?: boolean;
  }
): Partial<RelationshipQube> {
  return {
    sourceId,
    sourceType,
    targetId: sequenceId,
    targetType: 'Series',
    relationshipType: 'sequence',
    direction: 'unidirectional',
    data: {
      type: 'sequence',
      sequenceId,
      position,
      previousId: options?.previousId,
      nextId: options?.nextId,
      totalInSequence: options?.totalInSequence,
      autoAdvance: options?.autoAdvance ?? false,
    } as SequenceRelationship,
    metadata: defaultRelationshipMetadata,
    status: 'active',
  };
}

/** Create a series relationship */
export function createSeriesRelationship(
  contentId: string,
  seriesId: string,
  seriesTitle: string,
  position: number,
  options?: {
    seasonNumber?: number;
    episodeNumber?: number;
    siblingIds?: string[];
  }
): Partial<RelationshipQube> {
  return {
    sourceId: contentId,
    sourceType: 'SmartContentQube',
    targetId: seriesId,
    targetType: 'Series',
    relationshipType: 'series',
    direction: 'unidirectional',
    data: {
      type: 'series',
      seriesId,
      seriesTitle,
      positionInSeries: position,
      seasonNumber: options?.seasonNumber,
      episodeNumber: options?.episodeNumber,
      siblingIds: options?.siblingIds ?? [],
    } as SeriesRelationship,
    metadata: defaultRelationshipMetadata,
    status: 'active',
  };
}

/** Create a persona relationship */
export function createPersonaRelationship(
  sourcePersonaId: string,
  targetId: string,
  targetType: RelationshipEntityType,
  relationshipKind: PersonaRelationship['relationshipKind'],
  options?: {
    strength?: RelationshipStrength;
    privacy?: PersonaRelationship['privacy'];
    notes?: string;
  }
): Partial<RelationshipQube> {
  return {
    sourceId: sourcePersonaId,
    sourceType: 'Persona',
    targetId,
    targetType,
    relationshipType: 'reference', // Persona relationships use reference type
    direction: 'unidirectional',
    data: {
      type: 'persona',
      sourcePersonaId,
      targetId,
      targetType,
      relationshipKind,
      establishedAt: new Date().toISOString(),
      strength: options?.strength ?? 'normal',
      privacy: options?.privacy ?? 'private',
      notes: options?.notes,
    } as PersonaRelationship,
    metadata: defaultRelationshipMetadata,
    status: 'active',
  };
}

/** Create a quest path relationship */
export function createQuestPathRelationship(
  contentId: string,
  questId: string,
  questTitle: string,
  stepNumber: number,
  totalSteps: number,
  objective: string,
  options?: {
    stepReward?: { amount: number; asset: string };
    questCompletionReward?: { amount: number; asset: string };
    nextStepId?: string;
    previousStepId?: string;
    isOptional?: boolean;
  }
): Partial<RelationshipQube> {
  return {
    sourceId: contentId,
    sourceType: 'SmartContentQube',
    targetId: questId,
    targetType: 'Quest',
    relationshipType: 'questPath',
    direction: 'unidirectional',
    data: {
      type: 'questPath',
      questId,
      questTitle,
      stepNumber,
      totalSteps,
      objective,
      stepReward: options?.stepReward,
      questCompletionReward: options?.questCompletionReward,
      nextStepId: options?.nextStepId,
      previousStepId: options?.previousStepId,
      isOptional: options?.isOptional ?? false,
    } as QuestPathRelationship,
    metadata: defaultRelationshipMetadata,
    status: 'active',
  };
}
