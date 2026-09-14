/**
 * services/vela/velaUnderwritingPartyBinding.ts — Use Case Zero build-order
 * item 10b. Proves: `recordUnderwritingPartyBinding` writes the row exactly
 * as specified (fail-closed on a missing admin client / write error / thrown
 * exception); `resolvePartyBindingForViewer`'s anti-enumeration property (a
 * missing binding and a wrong-persona binding resolve the SAME
 * `{ authorized: false }` shape); and the two operator-mandated
 * non-spoofability properties verbatim:
 *
 *   1. "changing partyLabel=A in the request/query must not make Persona B
 *      resolve as Party A"
 *   2. "the same persona must not inherit a party binding from a different
 *      requestRef"
 *
 * plus a third proof that the same persona bound to TWO DIFFERENT party
 * labels on the SAME requestRef (via two separate rows) both resolve
 * correctly — proving the deliberately narrow UNIQUE(request_ref,
 * party_label) constraint (never (request_ref, authority_persona_id)) is not
 * accidentally undermined by a lookup that assumes one binding per persona.
 *
 * Reuses `tests/_lib/fakeSupabase.ts` (Extend, Don't Duplicate) rather than
 * hand-rolling a second in-memory Postgrest fake.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createFakeSupabase, type FakeTables } from './_lib/fakeSupabase';

let currentAdmin: { from: (table: string) => unknown } | null = null;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => currentAdmin,
}));

import {
  recordUnderwritingPartyBinding,
  resolvePartyBindingForViewer,
  type RecordUnderwritingPartyBindingInput,
} from '@/services/vela/velaUnderwritingPartyBinding';

const TABLE = 'vela_underwriting_party_bindings';

function bindingInput(overrides: Partial<RecordUnderwritingPartyBindingInput> = {}): RecordUnderwritingPartyBindingInput {
  return {
    requestRef: 'req-1',
    applicationId: 'app-1',
    partyLabel: 'party-a',
    partyNamespaceRef: 'ns-ref-a',
    authorityPrincipalId: 'principal-a',
    authorityPersonaId: 'persona-a',
    flowOwnerPersonaId: 'persona-a',
    ...overrides,
  };
}

let tables: FakeTables;

beforeEach(() => {
  const fake = createFakeSupabase();
  currentAdmin = fake.admin;
  tables = fake.tables;
});

describe('recordUnderwritingPartyBinding', () => {
  it('writes a row with every field mapped, defaulting bindingType to CONTRIBUTOR', async () => {
    const result = await recordUnderwritingPartyBinding(bindingInput({ bindingEvidenceRef: 'evidence-ref-1' }));
    expect(result).not.toBeNull();
    expect(tables[TABLE]).toHaveLength(1);
    const row = tables[TABLE][0];
    expect(row.request_ref).toBe('req-1');
    expect(row.application_id).toBe('app-1');
    expect(row.party_label).toBe('party-a');
    expect(row.party_namespace_ref).toBe('ns-ref-a');
    expect(row.authority_principal_id).toBe('principal-a');
    expect(row.authority_persona_id).toBe('persona-a');
    expect(row.flow_owner_persona_id).toBe('persona-a');
    expect(row.binding_type).toBe('CONTRIBUTOR');
    expect(row.binding_evidence_ref).toBe('evidence-ref-1');
  });

  it('defaults bindingEvidenceRef to null when absent — never fabricated', async () => {
    await recordUnderwritingPartyBinding(bindingInput());
    expect(tables[TABLE][0].binding_evidence_ref).toBeNull();
  });

  it('fails closed to null when the admin client is unavailable', async () => {
    currentAdmin = null;
    const result = await recordUnderwritingPartyBinding(bindingInput());
    expect(result).toBeNull();
  });

  it('fails closed to null (never throws) when the insert itself errors', async () => {
    currentAdmin = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'unique_violation' } }),
          }),
        }),
      }),
    };
    const result = await recordUnderwritingPartyBinding(bindingInput());
    expect(result).toBeNull();
  });

  it('fails closed to null (never throws) when the client throws synchronously', async () => {
    currentAdmin = {
      from: () => {
        throw new Error('boom');
      },
    };
    await expect(recordUnderwritingPartyBinding(bindingInput())).resolves.toBeNull();
  });
});

describe('resolvePartyBindingForViewer — anti-enumeration', () => {
  it('authorizes when the binding names exactly this viewer persona', async () => {
    await recordUnderwritingPartyBinding(bindingInput({ requestRef: 'req-1', partyLabel: 'party-a', authorityPersonaId: 'persona-a', flowOwnerPersonaId: 'persona-a' }));
    const result = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-a', viewerPersonaId: 'persona-a' });
    expect(result).toEqual({ authorized: true, flowOwnerPersonaId: 'persona-a' });
  });

  it('denies with the SAME shape when no binding exists for (requestRef, partyLabel) at all', async () => {
    const result = await resolvePartyBindingForViewer({ requestRef: 'req-does-not-exist', partyLabel: 'party-a', viewerPersonaId: 'persona-a' });
    expect(result).toEqual({ authorized: false });
  });

  it('denies with the SAME shape when a binding exists but names a DIFFERENT persona', async () => {
    await recordUnderwritingPartyBinding(bindingInput({ requestRef: 'req-1', partyLabel: 'party-a', authorityPersonaId: 'persona-a', flowOwnerPersonaId: 'persona-a' }));
    const result = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-a', viewerPersonaId: 'persona-b' });
    expect(result).toEqual({ authorized: false });
    // Anti-enumeration: the denial for "wrong persona" is byte-identical to
    // the denial for "no such party" above — no extra field, no message.
    expect(Object.keys(result)).toEqual(['authorized']);
  });

  it('fails closed to denied when the admin client is unavailable', async () => {
    currentAdmin = null;
    const result = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-a', viewerPersonaId: 'persona-a' });
    expect(result).toEqual({ authorized: false });
  });

  it('fails closed to denied (never throws) on a query error', async () => {
    currentAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: { message: 'connection reset' } }),
            }),
          }),
        }),
      }),
    };
    const result = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-a', viewerPersonaId: 'persona-a' });
    expect(result).toEqual({ authorized: false });
  });

  it('fails closed to denied (never throws) when the client throws synchronously', async () => {
    currentAdmin = {
      from: () => {
        throw new Error('boom');
      },
    };
    await expect(
      resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-a', viewerPersonaId: 'persona-a' }),
    ).resolves.toEqual({ authorized: false });
  });
});

describe('non-spoofability — operator-mandated, verbatim', () => {
  it('changing partyLabel=A in the request/query must not make Persona B resolve as Party A', async () => {
    await recordUnderwritingPartyBinding(
      bindingInput({ requestRef: 'req-1', partyLabel: 'party-a', authorityPersonaId: 'persona-a', flowOwnerPersonaId: 'persona-a' }),
    );
    const asPersonaB = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-a', viewerPersonaId: 'persona-b' });
    expect(asPersonaB).toEqual({ authorized: false });

    // Persona A, the REAL bound authority, still resolves correctly — the
    // gate is precise, not merely fail-closed for everyone.
    const asPersonaA = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-a', viewerPersonaId: 'persona-a' });
    expect(asPersonaA).toEqual({ authorized: true, flowOwnerPersonaId: 'persona-a' });
  });

  it('the same persona must not inherit a party binding from a different requestRef', async () => {
    await recordUnderwritingPartyBinding(
      bindingInput({ requestRef: 'req-1', partyLabel: 'party-a', authorityPersonaId: 'persona-a', flowOwnerPersonaId: 'persona-a' }),
    );
    // No binding recorded for req-2 at all.
    const crossRequest = await resolvePartyBindingForViewer({ requestRef: 'req-2', partyLabel: 'party-a', viewerPersonaId: 'persona-a' });
    expect(crossRequest).toEqual({ authorized: false });

    // The SAME persona resolves correctly on the request it IS actually
    // bound to — proving the denial above is requestRef-scoped, not a
    // blanket failure of the fixture.
    const sameRequest = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-a', viewerPersonaId: 'persona-a' });
    expect(sameRequest).toEqual({ authorized: true, flowOwnerPersonaId: 'persona-a' });
  });

  it('the same persona bound to TWO DIFFERENT party labels on the SAME requestRef (two separate rows) both resolve correctly', async () => {
    await recordUnderwritingPartyBinding(
      bindingInput({ requestRef: 'req-1', partyLabel: 'party-a', authorityPersonaId: 'persona-a', flowOwnerPersonaId: 'persona-a' }),
    );
    await recordUnderwritingPartyBinding(
      bindingInput({ requestRef: 'req-1', partyLabel: 'party-b', authorityPersonaId: 'persona-a', flowOwnerPersonaId: 'persona-a' }),
    );
    expect(tables[TABLE]).toHaveLength(2);

    const asPartyA = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-a', viewerPersonaId: 'persona-a' });
    expect(asPartyA).toEqual({ authorized: true, flowOwnerPersonaId: 'persona-a' });

    const asPartyB = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-b', viewerPersonaId: 'persona-a' });
    expect(asPartyB).toEqual({ authorized: true, flowOwnerPersonaId: 'persona-a' });

    // A label neither row was bound under still denies cleanly.
    const asPartyC = await resolvePartyBindingForViewer({ requestRef: 'req-1', partyLabel: 'party-c', viewerPersonaId: 'persona-a' });
    expect(asPartyC).toEqual({ authorized: false });
  });
});
