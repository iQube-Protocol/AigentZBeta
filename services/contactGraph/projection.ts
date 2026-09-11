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

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
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
  ContactPersona,
  ContactEndpoint,
} from '@/types/contactGraph';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const CONTACT_PERSONS = 'contact_persons';

/** Shared by both the full (ID-list-driven) projection below and the
 *  paginated People-list read: derive endpointCount/preferredEndpointPlatform
 *  for one ContactPerson from its already-fetched ContactPersonas + their
 *  endpoints (both grouped in memory — never a per-person query). One
 *  authoritative derivation, not two copies drifting apart. */
function summarizePersonaEndpoints(
  personaList: ContactPersona[],
  endpointsByPersonaId: Map<string, ContactEndpoint[]>,
): { endpointCount: number; preferredEndpointPlatform: ContactGraphProjectionPersonSummary['preferredEndpointPlatform'] } {
  let endpointCount = 0;
  let preferredEndpointPlatform: ContactGraphProjectionPersonSummary['preferredEndpointPlatform'] = null;
  for (const persona of personaList) {
    const endpoints = endpointsByPersonaId.get(persona.id) ?? [];
    endpointCount += endpoints.length;
    const preferred = endpoints.find((e) => e.isPreferred);
    if (preferred) preferredEndpointPlatform = preferred.platform;
  }
  return { endpointCount, preferredEndpointPlatform };
}

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
    const { endpointCount, preferredEndpointPlatform } = summarizePersonaEndpoints(personaList, endpointsByPersonaId);

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

export interface ContactGraphPeoplePageResult {
  people: ContactGraphProjectionPersonSummary[];
  /** The REAL total (an exact `count`, never `rows fetched`) — the headline
   *  number must never be conflated with how many rows happen to be loaded
   *  client-side. */
  totalCount: number;
  hasMore: boolean;
}

/**
 * Paginated, owner-scoped People-list read — a direct-query counterpart to
 * requestContactGraphProjection for the ONE case that doesn't need its
 * generic ID-list/delegation/consent machinery: the owning principal
 * reading their OWN People list. (This route never carries
 * actingAgentRootDid or a contextual/bounded scope — it is always the owner
 * viewing everything they own.) The full-projection contract above is left
 * completely unchanged for delegated/contextual callers.
 *
 * Root cause this replaces (2026-08-29): the prior read fetched ALL owned
 * ContactPersons in one unbounded `.select()` (services/contactGraph/
 * contactPersons.ts's listContactPersons) and used `result.people.length` as
 * the headline count. PostgREST's hosted default row cap (1,000) silently
 * truncated both the returned rows AND that derived "count" for any owner
 * past that size — surfacing as a suspicious, immovable "1,000 graph
 * people" ceiling. This function instead issues a real
 * `count: 'exact', head: true` query for the total (bounded to a single
 * indexed COUNT, never a full-table fetch) and pages the actual rows via
 * `.range()`, reusing the SAME batched+chunked persona/endpoint reads
 * (listContactPersonasForOwner/listContactEndpointsForPersonas) the full
 * projection uses — just fed one page of ids instead of every owned id.
 */
export async function requestContactGraphPeoplePage(
  ownerAuthProfileId: string,
  opts: { limit: number; offset: number; search?: string },
): Promise<PeerResult<ContactGraphPeoplePageResult>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const search = opts.search?.trim();

  let countQuery = admin
    .from(CONTACT_PERSONS)
    .select('id', { count: 'exact', head: true })
    .eq('owner_auth_profile_id', ownerAuthProfileId);
  let pageQuery = admin
    .from(CONTACT_PERSONS)
    .select('id, display_name')
    .eq('owner_auth_profile_id', ownerAuthProfileId)
    .order('display_name', { ascending: true })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (search) {
    // Escape PostgREST ilike wildcards in the raw search term so a literal
    // '%' or '_' the owner typed is matched literally, not as a wildcard.
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`);
    countQuery = countQuery.ilike('display_name', `%${escaped}%`);
    pageQuery = pageQuery.ilike('display_name', `%${escaped}%`);
  }

  const [{ count, error: countError }, { data: pageRows, error: pageError }] = await Promise.all([countQuery, pageQuery]);
  if (countError) return { ok: false, error: countError.message };
  if (pageError) return { ok: false, error: pageError.message };

  const totalCount = count ?? 0;
  const rows = (pageRows ?? []) as Array<{ id: string; display_name: string }>;
  const pageIds = rows.map((r) => r.id);

  const personasResult = await listContactPersonasForOwner(ownerAuthProfileId, pageIds);
  if (!personasResult.ok) return personasResult;
  const personasByContactPersonId = new Map<string, ContactPersona[]>();
  for (const persona of personasResult.value) {
    const list = personasByContactPersonId.get(persona.contactPersonId) ?? [];
    list.push(persona);
    personasByContactPersonId.set(persona.contactPersonId, list);
  }

  const allPersonaIds = personasResult.value.map((p) => p.id);
  const endpointsResult = await listContactEndpointsForPersonas(ownerAuthProfileId, allPersonaIds);
  if (!endpointsResult.ok) return endpointsResult;
  const endpointsByPersonaId = new Map<string, ContactEndpoint[]>();
  for (const endpoint of endpointsResult.value) {
    const list = endpointsByPersonaId.get(endpoint.contactPersonaId) ?? [];
    list.push(endpoint);
    endpointsByPersonaId.set(endpoint.contactPersonaId, list);
  }

  const people: ContactGraphProjectionPersonSummary[] = rows.map((row) => {
    const personaList = personasByContactPersonId.get(row.id) ?? [];
    const { endpointCount, preferredEndpointPlatform } = summarizePersonaEndpoints(personaList, endpointsByPersonaId);
    return {
      contactPersonId: row.id,
      displayName: row.display_name,
      personaLabels: personaList.map((p) => p.label),
      endpointCount,
      preferredEndpointPlatform,
    };
  });

  return {
    ok: true,
    value: {
      people,
      totalCount,
      hasMore: opts.offset + rows.length < totalCount,
    },
  };
}
