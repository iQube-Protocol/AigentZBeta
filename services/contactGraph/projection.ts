/**
 * ContactGraph — the surface-independent capability projection contract
 * (C13: a contained capability reusable by Runtime, Companion, and
 * cartridges, not owned exclusively by aigentMe). Reuses the SAME shared
 * seam as QubeTalk's own projection contract (types/capabilityProjection.ts,
 * services/qubetalk/projection.ts) rather than a second framework.
 *
 *   principal ∩ persona ∩ surface ∩ requested scope ∩ relationship/context
 *   ∩ delegation ∩ disclosure policy = visible ContactGraph projection
 *
 * Disclosure boundary: this contract returns SUMMARIES only (persona
 * labels, endpoint COUNT, one preferred platform) — never raw endpoint
 * identifiers. Actual handles still flow through the existing
 * listContactEndpoints route, which applies its own ownership gate
 * unchanged (mirrors QubeTalk projection.ts's own content/visibility split).
 */

import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { listContactPersons, getContactPerson } from '@/services/contactGraph/contactPersons';
import { listContactPersonas } from '@/services/contactGraph/contactPersonas';
import { listContactEndpoints } from '@/services/contactGraph/contactEndpoints';
import { resolveEffectiveAgentPolicy } from '@/services/qubetalk/agentPolicy';
import type {
  ContactGraphProjectionRequest,
  ContactGraphProjectionResult,
  ContactGraphProjectionDenial,
  ContactGraphProjectionPersonSummary,
} from '@/types/contactGraph';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

/**
 * Deterministic scope resolution — mirrors
 * services/qubetalk/projection.ts's evaluateProjectionScope exactly: a
 * 'contextual' request MUST name an explicit, bounded list of ContactPerson
 * ids; 'all' is refused outright for that profile (a cartridge can never ask
 * for the owner's entire address book). 'full'/'ambient' may request 'all',
 * capped at what the owner actually owns.
 */
export function evaluateContactGraphScope(
  requested: ContactGraphProjectionRequest,
  ownedIds: string[],
): { grantedIds: string[]; denied: ContactGraphProjectionDenial[] } {
  const denied: ContactGraphProjectionDenial[] = [];
  const ownedSet = new Set(ownedIds);
  const requestedIds = requested.scope.contactPersonIds;

  if (requestedIds === undefined) return { grantedIds: [], denied };

  if (requestedIds === 'all') {
    if (requested.projection === 'contextual') {
      denied.push({ contactPersonIds: ownedIds, reason: 'not_permitted_for_contextual_profile' });
      return { grantedIds: [], denied };
    }
    return { grantedIds: ownedIds, denied };
  }

  const grantedIds = requestedIds.filter((id) => ownedSet.has(id));
  const deniedIds = requestedIds.filter((id) => !ownedSet.has(id));
  if (deniedIds.length) denied.push({ contactPersonIds: deniedIds, reason: 'not_owned' });
  return { grantedIds, denied };
}

async function filterByAgentDelegation(
  callerPersonaId: string,
  agentRootDid: string,
  grantedIds: string[],
): Promise<{ grantedIds: string[]; denied: ContactGraphProjectionDenial[] }> {
  const stillGranted: string[] = [];
  const deniedIds: string[] = [];
  for (const contactPersonId of grantedIds) {
    // Reuses QubeTalk's own agent-policy resolver — ContactGraph does not
    // maintain a second delegation-scope vocabulary. A 'participant' scope
    // (the closest existing scope kind to "one contact") governs whether an
    // Agent may see this contact at all.
    const resolved = await resolveEffectiveAgentPolicy(callerPersonaId, { participant: contactPersonId }, agentRootDid);
    const mode = resolved.ok ? resolved.value.mode : 'no_agent';
    if (mode === 'no_agent') deniedIds.push(contactPersonId);
    else stillGranted.push(contactPersonId);
  }
  const denied: ContactGraphProjectionDenial[] = [];
  if (deniedIds.length) denied.push({ contactPersonIds: deniedIds, reason: 'agent_not_authorized_for_scope' });
  return { grantedIds: stillGranted, denied };
}

export async function requestContactGraphProjection(
  callerPersonaId: string,
  request: ContactGraphProjectionRequest,
): Promise<PeerResult<ContactGraphProjectionResult>> {
  const owner = await resolveOwnerAuthProfileId(callerPersonaId);
  if (!owner.ok) return owner;

  const allOwned = await listContactPersons(owner.value);
  if (!allOwned.ok) return allOwned;
  const ownedIds = allOwned.value.map((p) => p.id);

  let { grantedIds, denied } = evaluateContactGraphScope(request, ownedIds);

  if (request.actingAgentRootDid) {
    const filtered = await filterByAgentDelegation(callerPersonaId, request.actingAgentRootDid, grantedIds);
    grantedIds = filtered.grantedIds;
    denied = [...denied, ...filtered.denied];
  }

  const people: ContactGraphProjectionPersonSummary[] = [];
  for (const contactPersonId of grantedIds) {
    const person = await getContactPerson(owner.value, contactPersonId);
    if (!person.ok) continue;
    const personas = await listContactPersonas(owner.value, contactPersonId);
    const personaList = personas.ok ? personas.value : [];

    let endpointCount = 0;
    let preferredEndpointPlatform: ContactGraphProjectionPersonSummary['preferredEndpointPlatform'] = null;
    for (const persona of personaList) {
      const endpoints = await listContactEndpoints(owner.value, persona.id);
      if (!endpoints.ok) continue;
      endpointCount += endpoints.value.length;
      const preferred = endpoints.value.find((e) => e.isPreferred);
      if (preferred) preferredEndpointPlatform = preferred.platform;
    }

    people.push({
      contactPersonId,
      displayName: person.value.displayName,
      personaLabels: personaList.map((p) => p.label),
      endpointCount,
      preferredEndpointPlatform,
    });
  }

  return {
    ok: true,
    value: {
      profile: request.projection,
      requestingSurface: request.requestingSurface,
      people,
      denied,
    },
  };
}
