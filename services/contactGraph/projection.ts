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
import { listContactPersons } from '@/services/contactGraph/contactPersons';
import { listContactPersonasForOwner } from '@/services/contactGraph/contactPersonas';
import { listContactEndpointsForPersonas } from '@/services/contactGraph/contactEndpoints';
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

  /*
   * BATCHED projection (People 504 fix, 2026-08-27) — three total queries
   * for the whole page, never one-per-ContactPerson/-Persona. `allOwned`
   * (above) already carries every owned ContactPerson row, so no second
   * per-id `getContactPerson` fetch is needed here; personas and endpoints
   * are each fetched in ONE round trip for every granted id and grouped in
   * memory. See listContactPersonasForOwner/listContactEndpointsForPersonas
   * doc comments for the full incident this replaces (services/contactGraph/
   * projection.ts's per-id loop was the dominant contributor to a live GET
   * /api/contactgraph/people 504 for a persona with a large address book).
   */
  const ownedById = new Map(allOwned.value.map((p) => [p.id, p]));

  const personasResult = await listContactPersonasForOwner(owner.value, grantedIds);
  if (!personasResult.ok) return personasResult;
  const personasByContactPersonId = new Map<string, typeof personasResult.value>();
  for (const persona of personasResult.value) {
    const list = personasByContactPersonId.get(persona.contactPersonId) ?? [];
    list.push(persona);
    personasByContactPersonId.set(persona.contactPersonId, list);
  }

  const allPersonaIds = personasResult.value.map((p) => p.id);
  const endpointsResult = await listContactEndpointsForPersonas(owner.value, allPersonaIds);
  if (!endpointsResult.ok) return endpointsResult;
  const endpointsByPersonaId = new Map<string, typeof endpointsResult.value>();
  for (const endpoint of endpointsResult.value) {
    const list = endpointsByPersonaId.get(endpoint.contactPersonaId) ?? [];
    list.push(endpoint);
    endpointsByPersonaId.set(endpoint.contactPersonaId, list);
  }

  const people: ContactGraphProjectionPersonSummary[] = [];
  for (const contactPersonId of grantedIds) {
    const person = ownedById.get(contactPersonId);
    if (!person) continue;
    const personaList = personasByContactPersonId.get(contactPersonId) ?? [];

    let endpointCount = 0;
    let preferredEndpointPlatform: ContactGraphProjectionPersonSummary['preferredEndpointPlatform'] = null;
    for (const persona of personaList) {
      const endpoints = endpointsByPersonaId.get(persona.id) ?? [];
      endpointCount += endpoints.length;
      const preferred = endpoints.find((e) => e.isPreferred);
      if (preferred) preferredEndpointPlatform = preferred.platform;
    }

    people.push({
      contactPersonId,
      displayName: person.displayName,
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
