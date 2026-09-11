import type { ScopedSession } from './gatewaySession';
import { createPersonaSwitchHandshake, newToken } from './gatewaySession';
import { getActivePersonaByPublicRef } from '@/services/identity/getActivePersona';
import { containsRawIdentifier, personaPublicRef } from '@/services/identity/personaReferences';
import { getAgreement } from '@/services/constitutional/constitutionalAgreement';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listVisiblePersonaInventory, type PersonaInventoryRow } from '@/services/wallet/personaInventory';
import { CONSTITUTIONAL_ROOT_CAPABILITIES } from './serviceRegistry';
import { normalizeThresholdScope } from './requireThresholdSession';

export type AvailablePersona = { personaPublicRef: string; displayLabel: string; fioHandle: string | null; appOrigin: string | null; status: string; isCurrent: boolean };

export function projectAvailablePersona(row: PersonaInventoryRow, currentRef: string): AvailablePersona {
  const publicRef = personaPublicRef(row.id);
  return { personaPublicRef: publicRef, displayLabel: row.display_name || row.fio_handle || 'Unnamed persona', fioHandle: row.fio_handle || null, appOrigin: row.app_origin || null, status: row.status, isCurrent: publicRef === currentRef };
}

export function rootScopeForTarget(isAdmin: boolean): string[] { return normalizeThresholdScope(CONSTITUTIONAL_ROOT_CAPABILITIES.filter((capability) => capability !== 'content.asset.upload' || isAdmin)); }
export function selectAvailablePersona(rows: PersonaInventoryRow[], targetRef: string, currentRef: string): PersonaInventoryRow | null { if (!targetRef || containsRawIdentifier(targetRef) || targetRef === currentRef) return null; return rows.find((row) => personaPublicRef(row.id) === targetRef) ?? null; }

async function inventoryForSession(session: ScopedSession): Promise<{ activePersona: NonNullable<Awaited<ReturnType<typeof getActivePersonaByPublicRef>>>; rows: PersonaInventoryRow[] } | null> {
  const admin = getSupabaseServer(); if (!admin) return null;
  const activePersona = await getActivePersonaByPublicRef(session.principalPublicRef).catch(() => null); if (!activePersona) return null;
  const rows = await listVisiblePersonaInventory(admin, { callerAuthProfileId: activePersona.authProfileId }).catch(() => []);
  if (!rows.some((row) => personaPublicRef(row.id) === session.principalPublicRef)) return null;
  return { activePersona, rows };
}

export async function getPersonaState(session: ScopedSession) {
  const inventory = await inventoryForSession(session);
  const current = inventory?.rows.find((row) => personaPublicRef(row.id) === session.principalPublicRef) ?? null;
  const agreement = session.agreementId ? await getAgreement(session.agreementId) : null;
  const activePersonaLabel = current?.display_name || current?.fio_handle || null;
  return {
    activePersonaPublicRef: session.principalPublicRef,
    activePersonaLabel,
    activePersonaFioHandle: current?.fio_handle || null,
    personaResolved: Boolean(inventory?.activePersona && current),
    principalPublicRef: session.principalPublicRef,
    displayLabel: activePersonaLabel,
    fioHandle: current?.fio_handle || null,
    principalPublicRefSemantics: 'compatibility alias for activePersonaPublicRef; this is a persona reference, not a personhood/RootDID reference' as const,
    agreement: session.agreementId ? { agreementRef: session.agreementId, status: agreement?.status ?? 'unresolved' } : null,
    currentScope: [...session.scope],
    switchRequiresReauthorization: true as const,
    personaSpine: 'canonical-wallet-persona-spine' as const,
  };
}

export async function listAvailablePersonas(session: ScopedSession): Promise<AvailablePersona[] | null> { const inventory = await inventoryForSession(session); if (!inventory) return null; return inventory.rows.map((row) => projectAvailablePersona(row, session.principalPublicRef)); }

/**
 * Prepare the constitutional intent only. PKCE verifier/state are owned by the
 * MCP host, so these provisional values MUST be replaced by authorize-init when
 * the host follows the MCP reauthorization challenge. They are deliberately not
 * returned to the model or treated as proof.
 */
export async function requestPersonaSwitch(session: ScopedSession, input: { personaPublicRef: string }, origin: string): Promise<{ ok: true; reauthorizationRequired: true; expiresAt: string } | { ok: false; error: string }> {
  const targetRef = input.personaPublicRef.trim();
  if (!targetRef || containsRawIdentifier(targetRef)) return { ok: false, error: 'personaPublicRef must be a T2 Polity Public Reference; raw persona identifiers are refused.' };
  if (targetRef === session.principalPublicRef) return { ok: false, error: 'That persona is already bound to this crossing.' };
  const inventory = await inventoryForSession(session); if (!inventory) return { ok: false, error: 'The current persona binding could not be resolved.' };
  const targetRow = selectAvailablePersona(inventory.rows, targetRef, session.principalPublicRef); if (!targetRow) return { ok: false, error: 'That persona is not available to this principal.' };
  const target = await getActivePersonaByPublicRef(targetRef).catch(() => null); if (!target || target.personaId !== targetRow.id) return { ok: false, error: 'The target persona is not active.' };

  // Valid-shaped placeholders make the pending row non-authorizable by itself;
  // authorize-init overwrites both with the host-generated values before the
  // human sees/approves the crossing.
  const prepared = await createPersonaSwitchHandshake({
    source: session,
    targetPrincipalPublicRef: targetRef,
    requestedScope: rootScopeForTarget(target.cartridgeFlags.isAdmin),
    pkceChallenge: newToken(32),
    oauthState: `provisional_${newToken(18)}`,
  });
  if ('error' in prepared) return { ok: false, error: prepared.error };
  void origin; // origin remains part of the adapter contract; host OAuth owns navigation.
  return { ok: true, reauthorizationRequired: true, expiresAt: prepared.expiresAt };
}

export async function resolveOwnedSwitchTarget(authProfileId: string, sourceRef: string, targetRef: string) {
  const admin = getSupabaseServer(); if (!admin) return null;
  const rows = await listVisiblePersonaInventory(admin, { callerAuthProfileId: authProfileId }).catch(() => []);
  const source = rows.find((row) => personaPublicRef(row.id) === sourceRef) ?? null; const target = rows.find((row) => personaPublicRef(row.id) === targetRef) ?? null;
  return source && target ? { source, target } : null;
}
