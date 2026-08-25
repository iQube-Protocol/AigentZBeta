/**
 * QubeTalk Communications Membrane — the surface-independent capability
 * projection contract (operator-ratified, 2026-08-25, not in v0.2 — see
 * codexes/packs/agentiq/updates/2026-08-25_qubetalk-communications-membrane-expansion-build.md
 * §H for the full ratified invariants this operationalizes).
 *
 * THIS is the architectural seam: no surface (metaMe Runtime, Companion, a
 * cartridge, Marketa) reads qubetalk_participants/relationship_state/groups/
 * conversations directly to build its own view. Every surface calls
 * `requestProjection` and receives a BOUNDED summary — never raw rows, never
 * more than the requested (and granted) scope.
 *
 *   principal ∩ persona ∩ surface ∩ requested projection ∩ requested scope
 *   ∩ delegation ∩ disclosure policy = visible/invocable QubeTalk capability
 *
 * How each term is enforced here:
 *   - principal/persona: `callerPersonaId` is the spine-resolved caller
 *     (the route handler, never this function, does that resolution).
 *   - surface: `request.requestingSurface` is recorded on the RESULT for
 *     surface-continuity provenance — it is read-only input, never a scope
 *     grant (surface non-ownership: a surface's own identity carries no
 *     access of its own).
 *   - requested projection/scope: `evaluateProjectionScope` below.
 *   - delegation: when `request.actingAgentRootDid` is set, every granted
 *     relationship/group is re-checked against agentPolicy.ts's
 *     `resolveEffectiveAgentPolicy` — a scope item the human principal owns
 *     but this Agent has no policy grant for is downgraded to `denied`
 *     (reason 'agent_not_authorized_for_scope'), never silently included.
 *   - disclosure policy: this contract returns SUMMARIES ONLY (open-loop
 *     counts, conversation ids, a display label) — never message bodies.
 *     Actual content still flows through the EXISTING message-read routes
 *     (services/qubetalk/peerChannel.ts), which apply their own gates
 *     unchanged. A projection controls VISIBILITY of relationships/groups,
 *     not content disclosure within one — that split mirrors §16's
 *     "adapters are dumb" principle applied one layer up.
 *
 * Surface continuity in practice: every profile reads the SAME
 * qubetalk_conversations rows via listConversationsForRelationship/Group
 * (conversations.ts) — a 'full' projection and a 'contextual' one scoped to
 * the same single relationship return IDENTICAL conversationIds for it.
 * Nothing here ever mints a second conversation id for the same channel.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { listChannelsForCaller } from '@/services/qubetalk/peerChannel';
import { getOrCreateRelationshipState } from '@/services/qubetalk/relationships';
import { listGroupsCreatedBy, getGroup } from '@/services/qubetalk/groups';
import { listConversationsForRelationship, listConversationsForGroup } from '@/services/qubetalk/conversations';
import { resolveEffectiveAgentPolicy } from '@/services/qubetalk/agentPolicy';
import type {
  QubeTalkProjectionRequest,
  QubeTalkProjectionResult,
  QubeTalkProjectionDenial,
  QubeTalkProjectionRelationshipSummary,
  QubeTalkProjectionGroupSummary,
} from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

interface OwnedScope {
  relationshipChannelIds: string[];
  groupIds: string[];
}

/**
 * Resolves what the CALLING PRINCIPAL actually owns — the ceiling every
 * request is intersected against, regardless of profile. `'all'` in a
 * request only ever expands to this set; it can never reach beyond it.
 */
async function resolveOwnedScope(callerPersonaId: string): Promise<PeerResult<OwnedScope>> {
  const channels = await listChannelsForCaller(callerPersonaId);
  if (!channels.ok) return channels;
  const myRef = personaPublicRef(callerPersonaId);
  const groups = await listGroupsCreatedBy(myRef);
  if (!groups.ok) return groups;
  return {
    ok: true,
    value: {
      relationshipChannelIds: channels.value.map((c) => c.id),
      groupIds: groups.value.map((g) => g.id),
    },
  };
}

/**
 * Deterministic-evidence scope resolution (mirrors conversations.ts's own
 * "no weak inference" discipline): a 'contextual' request MUST name an
 * explicit, bounded list — 'all' is refused for that profile outright
 * (denied wholesale, reason 'not_permitted_for_contextual_profile'), because
 * a cartridge asking for "everything" is exactly the unbounded access this
 * contract exists to prevent. 'full' and 'ambient' may request 'all', which
 * expands to (and is capped at) the owned set.
 */
export function evaluateProjectionScope(
  requested: QubeTalkProjectionRequest,
  owned: OwnedScope,
): { granted: OwnedScope; denied: QubeTalkProjectionDenial[] } {
  const denied: QubeTalkProjectionDenial[] = [];
  const ownedRelSet = new Set(owned.relationshipChannelIds);
  const ownedGroupSet = new Set(owned.groupIds);

  function resolveList(
    requestedIds: string[] | 'all' | undefined,
    ownedIds: string[],
    ownedSet: Set<string>,
  ): { grantedIds: string[]; deniedIds: string[]; contextualAllDenied: string[] } {
    if (requestedIds === undefined) return { grantedIds: [], deniedIds: [], contextualAllDenied: [] };
    if (requestedIds === 'all') {
      if (requested.projection === 'contextual') {
        return { grantedIds: [], deniedIds: [], contextualAllDenied: ownedIds };
      }
      return { grantedIds: ownedIds, deniedIds: [], contextualAllDenied: [] };
    }
    const grantedIds = requestedIds.filter((id) => ownedSet.has(id));
    const deniedIds = requestedIds.filter((id) => !ownedSet.has(id));
    return { grantedIds, deniedIds, contextualAllDenied: [] };
  }

  const rel = resolveList(requested.scope.relationshipChannelIds, owned.relationshipChannelIds, ownedRelSet);
  const grp = resolveList(requested.scope.groupIds, owned.groupIds, ownedGroupSet);

  if (rel.deniedIds.length || grp.deniedIds.length) {
    denied.push({ relationshipChannelIds: rel.deniedIds, groupIds: grp.deniedIds, reason: 'not_owned' });
  }
  if (rel.contextualAllDenied.length || grp.contextualAllDenied.length) {
    denied.push({
      relationshipChannelIds: rel.contextualAllDenied,
      groupIds: grp.contextualAllDenied,
      reason: 'not_permitted_for_contextual_profile',
    });
  }

  return { granted: { relationshipChannelIds: rel.grantedIds, groupIds: grp.grantedIds }, denied };
}

async function filterByAgentDelegation(
  callerPersonaId: string,
  agentRootDid: string,
  granted: OwnedScope,
): Promise<{ granted: OwnedScope; denied: QubeTalkProjectionDenial[] }> {
  const stillGrantedRel: string[] = [];
  const deniedRel: string[] = [];
  for (const channelId of granted.relationshipChannelIds) {
    const resolved = await resolveEffectiveAgentPolicy(callerPersonaId, { relationship: channelId }, agentRootDid);
    const mode = resolved.ok ? resolved.value.mode : 'no_agent';
    if (mode === 'no_agent') deniedRel.push(channelId);
    else stillGrantedRel.push(channelId);
  }
  const stillGrantedGroup: string[] = [];
  const deniedGroup: string[] = [];
  for (const groupId of granted.groupIds) {
    const resolved = await resolveEffectiveAgentPolicy(callerPersonaId, { group: groupId }, agentRootDid);
    const mode = resolved.ok ? resolved.value.mode : 'no_agent';
    if (mode === 'no_agent') deniedGroup.push(groupId);
    else stillGrantedGroup.push(groupId);
  }
  const denied: QubeTalkProjectionDenial[] = [];
  if (deniedRel.length || deniedGroup.length) {
    denied.push({ relationshipChannelIds: deniedRel, groupIds: deniedGroup, reason: 'agent_not_authorized_for_scope' });
  }
  return { granted: { relationshipChannelIds: stillGrantedRel, groupIds: stillGrantedGroup }, denied };
}

export async function requestProjection(
  callerPersonaId: string,
  request: QubeTalkProjectionRequest,
): Promise<PeerResult<QubeTalkProjectionResult>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const owned = await resolveOwnedScope(callerPersonaId);
  if (!owned.ok) return owned;

  let { granted, denied } = evaluateProjectionScope(request, owned.value);

  if (request.actingAgentRootDid) {
    const filtered = await filterByAgentDelegation(callerPersonaId, request.actingAgentRootDid, granted);
    granted = filtered.granted;
    denied = [...denied, ...filtered.denied];
  }

  const callerChannels = await listChannelsForCaller(callerPersonaId);
  const channelById = new Map((callerChannels.ok ? callerChannels.value : []).map((c) => [c.id, c]));

  const relationships: QubeTalkProjectionRelationshipSummary[] = [];
  for (const channelId of granted.relationshipChannelIds) {
    const channel = channelById.get(channelId);
    const state = await getOrCreateRelationshipState(channelId);
    const conversations = await listConversationsForRelationship(channelId);
    relationships.push({
      channelId,
      counterpartyDisplayLabel: channel?.counterpartyLabel ?? channel?.counterpartyRef ?? channelId,
      lastInteractionAt: state.ok ? state.value.lastInteractionAt : null,
      openLoopCount: state.ok ? state.value.openLoops.filter((l) => !l.resolvedAt).length : 0,
      conversationIds: conversations.ok ? conversations.value : [],
    });
  }

  const groups: QubeTalkProjectionGroupSummary[] = [];
  for (const groupId of granted.groupIds) {
    const group = await getGroup(groupId);
    const conversations = await listConversationsForGroup(groupId);
    groups.push({
      groupId,
      name: group.ok ? group.value.name : groupId,
      conversationIds: conversations.ok ? conversations.value : [],
    });
  }

  return {
    ok: true,
    value: {
      profile: request.projection,
      requestingSurface: request.requestingSurface,
      relationships,
      groups,
      publishing: Boolean(request.scope.publishing),
      engagement: Boolean(request.scope.engagement),
      denied,
    },
  };
}
