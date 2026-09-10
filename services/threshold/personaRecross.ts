import type { ScopedSession } from './gatewaySession';
import { createPersonaSwitchHandshake } from './gatewaySession';
import { getActivePersonaByPublicRef } from '@/services/identity/getActivePersona';
import { containsRawIdentifier, personaPublicRef } from '@/services/identity/personaReferences';
import { getAgreement } from '@/services/constitutional/constitutionalAgreement';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listVisiblePersonaInventory, type PersonaInventoryRow } from '@/services/wallet/personaInventory';
import { CONSTITUTIONAL_ROOT_CAPABILITIES } from './serviceRegistry';
import { normalizeThresholdScope } from './requireThresholdSession';

export type AvailablePersona = {
  personaPublicRef: string;
  displayLabel: string;
  fioHandle: string | null;
  appOrigin: string | null;
  status: string;
  isCurrent: boolean;
};

export function projectAvailablePersona(row: PersonaInventoryRow, currentRef: string): AvailablePersona {
  const publicRef = personaPublicRef(row.id);
  return {
    personaPublicRef: publicRef,
    displayLabel: row.display_name || row.fio_handle || 'Unnamed persona',
    // This is the owner/delegate's bounded self-inventory, not public discovery.
    fioHandle: row.fio_handle || null,
    appOrigin: row.app_origin || null,
    status: row.status,
    isCurrent: publicRef === currentRef,
  };
}

export function rootScopeForTarget(isAdmin: boolean): string[] {
  return normalizeThresholdScope(
    CONSTITUTIONAL_ROOT_CAPABILITIES.filter((capability) => capability !== 'content.asset.upload' || isAdmin),
  );
}

export function selectAvailablePersona(
  rows: PersonaInventoryRow[],
  targetRef: string,
  currentRef: string,
): PersonaInventoryRow | null {
  if (!targetRef || containsRawIdentifier(targetRef) || targetRef === currentRef) return null;
  return rows.find((row) => personaPublicRef(row.id) === targetRef) ?? null;
}

async function inventoryForSession(session: ScopedSession): Promise<{
  activePersona: NonNullable<Awaited<ReturnType<typeof getActivePersonaByPublicRef>>>;
  rows: PersonaInventoryRow[];
} | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const activePersona = await getActivePersonaByPublicRef(session.principalPublicRef).catch(() => null);
  if (!activePersona) return null;
  const rows = await listVisiblePersonaInventory(admin, { callerAuthProfileId: activePersona.authProfileId }).catch(() => []);
  // A session only gets discovery if its exact bound persona is still visible
  // under the canonical wallet ownership policy.
  if (!rows.some((row) => personaPublicRef(row.id) === session.principalPublicRef)) return null;
  return { activePersona, rows };
}

export async function getPersonaState(session: ScopedSession) {
  const inventory = await inventoryForSession(session);
  const current = inventory?.rows.find((row) => personaPublicRef(row.id) === session.principalPublicRef) ?? null;
  const agreement = session.agreementId ? await getAgreement(session.agreementId) : null;
  return {
    principalPublicRef: session.principalPublicRef,
    displayLabel: current?.display_name || current?.fio_handle || null,
    fioHandle: current?.fio_handle || null,
    personaResolved: Boolean(inventory?.activePersona && current),
    agreement: session.agreementId
      ? { agreementRef: session.agreementId, status: agreement?.status ?? 'unresolved' }
      : null,
    currentScope: [...session.scope],
    switchRequiresReauthorization: true as const,
  };
}

export async function listAvailablePersonas(session: ScopedSession): Promise<AvailablePersona[] | null> {
  const inventory = await inventoryForSession(session);
  if (!inventory) return null;
  return inventory.rows.map((row) => projectAvailablePersona(row, session.principalPublicRef));
}

export async function requestPersonaSwitch(
  session: ScopedSession,
  input: { personaPublicRef: string; codeChallenge: string; state: string },
  origin: string,
): Promise<{ ok: true; authorizeUrl: string; expiresAt: string } | { ok: false; error: string }> {
  const targetRef = input.personaPublicRef.trim();
  const oauthState = input.state;
  if (!oauthState.trim()) return { ok: false, error: 'state is required for persona re-crossing.' };
  if (!targetRef || containsRawIdentifier(targetRef)) {
    return { ok: false, error: 'personaPublicRef must be a T2 Polity Public Reference; raw persona identifiers are refused.' };
  }
  if (targetRef === session.principalPublicRef) return { ok: false, error: 'That persona is already bound to this crossing.' };
  const inventory = await inventoryForSession(session);
  if (!inventory) return { ok: false, error: 'The current persona binding could not be resolved.' };
  const targetRow = selectAvailablePersona(inventory.rows, targetRef, session.principalPublicRef);
  if (!targetRow) return { ok: false, error: 'That persona is not available to this principal.' };
  const target = await getActivePersonaByPublicRef(targetRef).catch(() => null);
  if (!target || target.personaId !== targetRow.id) return { ok: false, error: 'The target persona is not active.' };

  const prepared = await createPersonaSwitchHandshake({
    source: session,
    targetPrincipalPublicRef: targetRef,
    requestedScope: rootScopeForTarget(target.cartridgeFlags.isAdmin),
    pkceChallenge: input.codeChallenge,
    oauthState,
  });
  if ('error' in prepared) return { ok: false, error: prepared.error };
  return {
    ok: true,
    authorizeUrl: `${origin}/threshold/switch-persona#code=${encodeURIComponent(prepared.handshakeCode)}`,
    expiresAt: prepared.expiresAt,
  };
}

/** Browser-authorized owner check shared by inspection and approval. */
export async function resolveOwnedSwitchTarget(authProfileId: string, sourceRef: string, targetRef: string) {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const rows = await listVisiblePersonaInventory(admin, { callerAuthProfileId: authProfileId }).catch(() => []);
  const source = rows.find((row) => personaPublicRef(row.id) === sourceRef) ?? null;
  const target = rows.find((row) => personaPublicRef(row.id) === targetRef) ?? null;
  return source && target ? { source, target } : null;
}
