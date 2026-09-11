/**
 * QubeTalk <-> ContactGraph resolution for an EXISTING relationship channel
 * (QubeTalk Fast-Follow: "close the messaging loop end-to-end").
 *
 * Closes the smallest missing connection identified by the seam audit: a
 * `passport_peer_channels` relationship already carries a real, resolved
 * counterparty (`counterpartyRef`, a Polity Public Reference — RelationshipQube
 * is personhood-bound, per peerChannel.ts's own header). This module is the
 * ONE place that bridges "this relationship's counterparty" to "their
 * ContactGraph entry" — get-or-create is idempotent (mirrors
 * `resolveOrCreateContactPersonByPersonhoodRef`'s own contract), never a
 * name-based guess (the personhood ref itself is the deterministic key).
 *
 * SCOPE BOUNDARY (documented, not silently assumed): this only resolves
 * ContactGraph entries for counterparties who ARE real platform personas
 * (RelationshipQube's own requirement — `passport_peer_channels` is
 * personhood-bound by construction, isPublicRefLike-checked at creation).
 * A purely off-platform ContactGraph contact (no linked platform persona)
 * has no RelationshipQube home yet — that is a genuine, separate
 * architectural question (extending the relationship model to cover
 * off-platform contacts), flagged to the operator as a candidate
 * architectural refinement rather than solved here, per the explicit
 * "do not start another architecture pass" instruction governing this
 * increment.
 */

import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { resolveOrCreateContactPersonByPersonhoodRef } from '@/services/contactGraph/contactPersons';
import { getOrCreateContactPersonaByLabel, listContactPersonas } from '@/services/contactGraph/contactPersonas';
import { listContactEndpoints } from '@/services/contactGraph/contactEndpoints';
import type { PeerResult } from '@/services/qubetalk/peerChannel';
import type { ContactEndpoint, ContactPersona, ContactPerson } from '@/types/contactGraph';

const DEFAULT_CONTEXT_LABEL = 'General';

export interface ChannelContactResolution {
  contactPerson: ContactPerson;
  personas: Array<ContactPersona & { endpoints: ContactEndpoint[] }>;
}

/**
 * Resolve (get-or-create) the ContactGraph entry for a channel's
 * counterparty, and return every persona/endpoint the caller has on file
 * for them — the data a message composer needs to offer "send via
 * Discord/email/etc." alongside the always-available native transport.
 */
export async function resolveContactPersonForChannel(
  callerPersonaId: string,
  counterpartyRef: string,
  counterpartyDisplayLabel: string,
): Promise<PeerResult<ChannelContactResolution>> {
  const owner = await resolveOwnerAuthProfileId(callerPersonaId);
  if (!owner.ok) return owner;

  const person = await resolveOrCreateContactPersonByPersonhoodRef(owner.value, counterpartyRef, counterpartyDisplayLabel);
  if (!person.ok) return person;

  const personas = await listContactPersonas(owner.value, person.value.id);
  if (!personas.ok) return personas;

  // A freshly-created ContactPerson has no persona/context yet — seed the
  // default one so the composer always has somewhere to attach an endpoint,
  // mirroring reconciliation.ts's own DEFAULT_CONTEXT_LABEL convention.
  let personaList = personas.value;
  if (personaList.length === 0) {
    const seeded = await getOrCreateContactPersonaByLabel(owner.value, person.value.id, DEFAULT_CONTEXT_LABEL);
    if (seeded.ok) personaList = [seeded.value];
  }

  const withEndpoints: Array<ContactPersona & { endpoints: ContactEndpoint[] }> = [];
  for (const persona of personaList) {
    const endpoints = await listContactEndpoints(owner.value, persona.id);
    withEndpoints.push({ ...persona, endpoints: endpoints.ok ? endpoints.value : [] });
  }

  return { ok: true, value: { contactPerson: person.value, personas: withEndpoints } };
}
