/**
 * Locker, RoomQubes and Share Packs — shared domain types.
 * codexes/packs/agentiq/updates/2026-08-25_locker-roomqube-sharepacks-phase1.md
 *
 * Phase 1 scope (spec §19): Locker-native asset registration, RoomQube
 * CRUD + placements + membership + QubeTalk conversation activation, and
 * email Share Packs. Types mirror the spec's §7 data model as closely as
 * this repo's existing conventions allow — see each service file for the
 * exact DB row <-> domain shape mapping.
 *
 * PeerResult<T> is the service-layer return convention this pass adopts
 * (mirroring services/qubetalk/egress.ts's PeerResult<T> on origin/dev —
 * not present in this worktree, see the Phase 1 closeout §0 for why; this
 * is a fresh, compatible definition, not a duplicate of anything that
 * exists locally).
 */

export type PeerResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code?: string };

// ── Asset Record (spec §7.1) ────────────────────────────────────────────

export type AssetClass =
  | 'deck' | 'agreement' | 'report' | 'paper' | 'essay' | 'experiment'
  | 'dataset' | 'image' | 'audio' | 'video' | 'bridge' | 'dynamic-report' | 'other';

export type NativeSystem =
  | 'locker' | 'qriptopian' | 'codex' | 'irl' | 'bridge' | 'venture-workspace' | 'external';

export type LifecycleStatus = 'draft' | 'review' | 'approved' | 'current' | 'superseded' | 'archived';
export type SharingStatus = 'private' | 'internal' | 'confidential' | 'approved-to-share' | 'public';
export type Sensitivity = 'standard' | 'commercial' | 'financial' | 'legal' | 'personal' | 'restricted';

export interface AssetRecord {
  id: string;
  title: string;
  description: string | null;
  assetClass: AssetClass;
  nativeSystem: NativeSystem;
  nativeReference: Record<string, unknown>;
  ventureId: string | null;
  projectId: string | null;
  ownerPersonaId: string;
  owningOrganizationRef: string | null;
  lifecycleStatus: LifecycleStatus;
  sharingStatus: SharingStatus;
  sensitivity: Sensitivity | null;
  aliases: string[];
  tags: string[];
  versionFamilyId: string;
  versionNumber: number;
  supersedesAssetId: string | null;
  contentHash: string | null;
  originalFilename: string | null;
  provenance: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type RenditionKind =
  | 'source' | 'pdf' | 'presentation' | 'web' | 'audio' | 'video' | 'cover' | 'thumbnail' | 'download' | 'other';
export type StorageProviderKind = 'supabase' | 'autonomys' | 'ipfs' | 'external';

export interface AssetRendition {
  id: string;
  assetId: string;
  renditionKind: RenditionKind;
  storageProvider: StorageProviderKind;
  storageUri: string;
  publicUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  isPrimary: boolean;
  createdAt: string;
}

// ── RoomQube (spec §5.5/§7.3) ───────────────────────────────────────────

export type RoomType =
  | 'data-room' | 'research-room' | 'project-room' | 'partner-room'
  | 'board-room' | 'briefing-room' | 'cohort-room' | 'custom';

export type RoomQubeStatus = 'draft' | 'active' | 'archived';
export type RoomMemberRole = 'owner' | 'administrator' | 'contributor' | 'reviewer' | 'viewer' | 'guest';
export type RoomMemberSubjectType = 'person' | 'group' | 'agent';

export interface RoomQube {
  id: string;
  title: string;
  purpose: string;
  roomType: RoomType;
  ventureId: string | null;
  ownerPersonaId: string;
  intendedAudience: string | null;
  defaultAccessPolicy: Record<string, unknown>;
  qubeTalkContext: {
    groupId: string | null;
    conversationId: string | null;
    mode: 'room-thread' | 'topic-channel';
    notificationsEnabled: boolean;
  };
  status: RoomQubeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RoomQubePlacement {
  id: string;
  roomQubeId: string;
  assetId: string;
  labelOverride: string | null;
  descriptionOverride: string | null;
  preferredRenditionId: string | null;
  versionPolicy: { mode: 'follow-current' } | { mode: 'pinned'; versionAssetId: string };
  section: string | null;
  order: number;
  addedByPersonaId: string;
  addedAt: string;
}

export interface RoomQubeMember {
  id: string;
  roomQubeId: string;
  subjectType: RoomMemberSubjectType;
  subjectPersonaId: string | null;
  subjectGroupRef: string | null;
  role: RoomMemberRole;
  invitedByPersonaId: string;
  joinedAt: string | null;
  expiresAt: string | null;
  removedAt: string | null;
}

// ── Share Pack (spec §5.6/§7.4) ─────────────────────────────────────────

export type DeliveryChannel = 'email' | 'qubetalk' | 'link' | 'other';
export type DeliveryMode = 'link' | 'attachment' | 'embedded';
export type AuthorizationState = 'draft' | 'proposed' | 'approved' | 'sent' | 'revoked' | 'expired';

export interface SharePack {
  id: string;
  title: string;
  purpose: string;
  ownerPersonaId: string;
  recipientRefs: string[];
  sourceRoomQubeIds: string[];
  deliveryChannel: DeliveryChannel;
  messageDraft: string | null;
  accessPolicy: Record<string, unknown>;
  authorizationState: AuthorizationState;
  approvedByPersonaId: string | null;
  approvedAt: string | null;
  communicationReceiptId: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface SharePackItem {
  id: string;
  sharePackId: string;
  assetId: string;
  pinnedVersionAssetId: string | null;
  renditionId: string | null;
  deliveryMode: DeliveryMode;
  resolvedHash: string | null;
  order: number;
  accessToken: string;
}
