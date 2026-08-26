/**
 * QubeTalk Communications Membrane — the ONE anchor-branching decision
 * (P0.5 widening, 2026-08-26).
 *
 * `qubetalk_relationship_state` and `qubetalk_conversations` both project
 * over the SAME `QubeTalkRelationshipAnchor` discriminated union, but each
 * table names its two anchor columns differently
 * (`channel_id`/`offplatform_relationship_id` on relationship_state vs
 * `relationship_channel_id`/`offplatform_relationship_id` on conversations).
 * This module is the single place the "which kind, which value" branch is
 * decided — services/qubetalk/relationships.ts and
 * services/qubetalk/conversations.ts each map that to their OWN column
 * names, but neither re-derives the branch itself. No duplicated anchor
 * logic anywhere else in the codebase.
 */

import type { QubeTalkRelationshipAnchor } from '@/types/qubetalk';

export function anchorValue(anchor: QubeTalkRelationshipAnchor): { kind: QubeTalkRelationshipAnchor['kind']; value: string } {
  return anchor.kind === 'peer-channel'
    ? { kind: 'peer-channel', value: anchor.channelId }
    : { kind: 'off-platform', value: anchor.relationshipId };
}

export type { QubeTalkRelationshipAnchor };
