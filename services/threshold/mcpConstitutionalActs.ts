/**
 * MCP-completable constitutional rituals for OCSGA / Boundary Research.
 * Writes reuse canonical reciprocal-exchange services and require explicit
 * principal assent. T0 identifiers are resolved internally and never returned.
 */
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScopedSession } from '@/services/threshold/gatewaySession';
import { resolvePersonaIdByPublicRef } from '@/services/identity/personaReferences';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { depositArtifact, declareFreeze, signInstrument, getExchangeView, listMyExchanges, resolveExchangeActingPrincipal, type DepositArtifactInput } from '@/services/research/reciprocalExchange';
import { constitutionalRuntime } from '@/services/ctp/constitutionalRuntime';
import '@/services/ctp/primitives/exchangeArtifactConfirm';
import { listOwnedPersonaIds } from '@/services/identity/passportPrincipal';
import { persistDelegationGrant } from '@/services/delegation/delegationGrantStore';
import { FREEZE_DECLARATION_TEXT, EXCHANGE_INSTRUMENT_CLAUSES } from '@/types/reciprocalExchange';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { AgentRoleId, HandoffPayload, PolicyEnvelope } from '@/types/orchestration';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import { getLegibilitySource } from '@/services/iqube/legibility/registry';

type PrincipalResolution = { ok: true; personaId: string; authProfileId: string | null } | { ok: false; error: string };
async function resolveMcpPrincipal(admin: SupabaseClient, session: ScopedSession): Promise<PrincipalResolution> {
  const personaId = await resolvePersonaIdByPublicRef(admin, session.principalPublicRef);
  if (!personaId) return { ok: false, error: 'Could not resolve the session principal to a real persona. Nothing can be written until this resolves.' };
  const authProfileResult = await resolveOwnerAuthProfileId(personaId);
  return { ok: true, personaId, authProfileId: authProfileResult.ok ? authProfileResult.value : null };
}
async function resolveOwnedPersonaIds(admin: SupabaseClient, personaId: string, authProfileId: string | null): Promise<string[]> {
  if (!authProfileId) return [personaId];
  const owned = await listOwnedPersonaIds(admin, authProfileId).catch(() => null);
  return owned?.ok ? owned.personaIds : [personaId];
}
async function resolveActiveExchangeId(admin: SupabaseClient, personaId: string, authProfileId: string | null): Promise<{ ok: true; exchangeId: string } | { ok: false; error: string }> {
  const mine = await listMyExchanges(admin, await resolveOwnedPersonaIds(admin, personaId, authProfileId));
  if (!mine.ok) return { ok: false, error: `Could not read this principal's Reciprocal Artifact Exchange membership: ${mine.error}` };
  if (!mine.exchanges.length) return { ok: false, error: 'No Reciprocal Artifact Exchange exists for this principal yet — nothing to deposit into, freeze, or sign.' };
  return { ok: true, exchangeId: mine.exchanges[0].id };
}
export async function resolveExchangeWriteAuthority(admin: SupabaseClient, session: ScopedSession): Promise<{ ok: true; personaId: string; exchangeId: string } | { ok: false; error: string }> {
  const principal = await resolveMcpPrincipal(admin, session); if (!principal.ok) return principal;
  const active = await resolveActiveExchangeId(admin, principal.personaId, principal.authProfileId); if (!active.ok) return active;
  const acting = await resolveExchangeActingPrincipal(admin, { exchangeId: active.exchangeId, activePersonaId: principal.personaId, authProfileId: principal.authProfileId });
  if (!acting.ok) return { ok: false, error: 'Could not resolve which bound party this session corresponds to on the discovered exchange.' };
  return { ok: true, personaId: acting.personaId, exchangeId: active.exchangeId };
}
function requireMcpEligibleStage(stageId: string): { ok: true } | { ok: false; error: string } {
  const stage = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === stageId);
  if (!stage) return { ok: false, error: `Unknown journey stage: ${stageId}` };
  if (!stage.completionChannels?.includes('mcp')) return { ok: false, error: `Stage '${stageId}' (${stage.label}) has not been declared MCP-eligible. It can only be completed through its native surface.` };
  return { ok: true };
}
function requireExplicitConsent(args: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  return args.declarationConfirmed === true ? { ok: true } : { ok: false, error: 'declarationConfirmed must be explicitly true. Show your principal the exact declaration text for this act and obtain their explicit assent BEFORE calling this tool — never infer consent from the surrounding conversation.' };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function candidateIQubeId(artifact: { sourceReference?: unknown; storageReference?: unknown }): string | null {
  for (const value of [artifact.sourceReference, artifact.storageReference]) {
    if (typeof value !== 'string') continue;
    const raw = value.trim();
    if (UUID_RE.test(raw)) return raw;
    const match = raw.match(/(?:iqube:|\/iqubes\/)([0-9a-f-]{36})(?:$|[/?#])/i);
    if (match && UUID_RE.test(match[1])) return match[1];
  }
  return null;
}
async function artifactRegistryReference(artifact: { id: string; sourceReference?: unknown; storageReference?: unknown }) {
  const iqubeId = candidateIQubeId(artifact);
  if (!iqubeId) return { artifactId: artifact.id, registryReference: { availability: 'not-declared' as const, reason: 'The exchange artifact does not declare a canonical iQube identifier.' } };
  const source = await getLegibilitySource(iqubeId, { allowPrivate: true }).catch(() => null);
  if (!source) return { artifactId: artifact.id, registryReference: { iqubeId, availability: 'not-registered' as const, reason: 'The declared iQube identifier is not present in the canonical legibility registry.' } };
  return { artifactId: artifact.id, registryReference: { iqubeId, availability: 'registered' as const, payloadInterface: 'read_accessible_iqube_text' as const, visibilityState: source.visibility_state } };
}
export async function getExchangeStateForMcp(admin: SupabaseClient, session: ScopedSession) {
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  const view = await getExchangeView(admin, { exchangeId: authority.exchangeId, personaId: authority.personaId });
  if (!view.ok) return { ok: false as const, error: view.error };
  const rawArtifacts = (view.view as { artifacts?: Array<{ id: string; sourceReference?: unknown; storageReference?: unknown }> }).artifacts ?? [];
  const artifactRegistryReferences = await Promise.all(rawArtifacts.map(artifactRegistryReference));
  return { ok: true as const, exchangeId: authority.exchangeId, view: view.view, artifactRegistryReferences, registrySemantics: 'Exchange artifact ids and iQube ids are distinct namespaces. A registry reference is reported as registered only after canonical registry resolution succeeds.', freezeDeclarationText: FREEZE_DECLARATION_TEXT, exchangeInstrumentClauses: EXCHANGE_INSTRUMENT_CLAUSES };
}

export interface DepositArtifactMcpArgs { declarationConfirmed: boolean; title: string; artifactClass: string; description?: string; sourceType: DepositArtifactInput['sourceType']; sourceReference: string; contentHash: string; repositoryCommit?: string; storageReference?: string; mimeType?: string; ownershipDeclaration: string; rightsForExchange: string; }
export async function depositExchangeArtifactViaMcp(admin: SupabaseClient, session: ScopedSession, args: DepositArtifactMcpArgs) {
  const eligible = requireMcpEligibleStage('create-deposit'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>); if (!consent.ok) return consent;
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  if (!args.title?.trim() || !args.artifactClass?.trim() || !args.sourceReference?.trim() || !args.contentHash?.trim()) return { ok: false as const, error: 'title, artifactClass, sourceReference and contentHash are all required.' };
  if (!args.ownershipDeclaration?.trim() || !args.rightsForExchange?.trim()) return { ok: false as const, error: 'ownershipDeclaration and rightsForExchange are both required — the deposit is a constitutional declaration, not just a file upload.' };
  const result = await depositArtifact(admin, { exchangeId: authority.exchangeId, personaId: authority.personaId, title: args.title, artifactClass: args.artifactClass, description: args.description, sourceType: args.sourceType, sourceReference: args.sourceReference, contentHash: args.contentHash, repositoryCommit: args.repositoryCommit, storageReference: args.storageReference, mimeType: args.mimeType, ownershipDeclaration: args.ownershipDeclaration, rightsForExchange: args.rightsForExchange, originChannel: 'mcp', agentRef: session.agentAlias });
  return result.ok ? { ok: true as const, exchangeId: authority.exchangeId, artifact: result.artifact, replaced: result.replaced } : { ok: false as const, error: result.error };
}

export async function confirmOperatorAssistedArtifactViaMcp(admin: SupabaseClient, session: ScopedSession, args: Record<string, unknown>) {
  const eligible = requireMcpEligibleStage('create-deposit'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args); if (!consent.ok) return consent;
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  const artifactId = typeof args.artifactId === 'string' ? args.artifactId.trim() : '';
  if (!artifactId) return { ok: false as const, error: 'artifactId is required.' };
  const result = await constitutionalRuntime.execute({ primitiveId: 'ctp.exchange.artifact.confirm', version: '1.0.0', channel: 'mcp', actor: { personaId: authority.personaId, agentRef: session.agentAlias }, input: { exchangeId: authority.exchangeId, artifactId }, context: { admin } });
  return result.ok ? { ok: true as const, exchangeId: authority.exchangeId, artifact: result.output, receipt: result.receipt } : { ok: false as const, error: result.error.message };
}
export async function declareArtifactFreezeViaMcp(admin: SupabaseClient, session: ScopedSession, args: Record<string, unknown>) {
  const eligible = requireMcpEligibleStage('freeze'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args); if (!consent.ok) return consent;
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  const result = await declareFreeze(admin, { exchangeId: authority.exchangeId, personaId: authority.personaId, originChannel: 'mcp' });
  return result.ok ? { ok: true as const, exchangeId: authority.exchangeId, attestation: result.attestation } : { ok: false as const, error: result.error };
}
export async function signExchangeInstrumentViaMcp(admin: SupabaseClient, session: ScopedSession, args: Record<string, unknown>) {
  const eligible = requireMcpEligibleStage('sign'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args); if (!consent.ok) return consent;
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  const result = await signInstrument(admin, { exchangeId: authority.exchangeId, personaId: authority.personaId, originChannel: 'mcp' });
  return result.ok ? { ok: true as const, exchangeId: authority.exchangeId, attestation: result.attestation } : { ok: false as const, error: result.error };
}
export async function establishDelegationViaMcp(admin: SupabaseClient, session: ScopedSession, args: Record<string, unknown>) {
  const eligible = requireMcpEligibleStage('delegate'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args); if (!consent.ok) return consent;
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  const role = typeof args.agentRole === 'string' ? args.agentRole as AgentRoleId : 'research-agent';
  const policyEnvelope = args.policyEnvelope as PolicyEnvelope | undefined;
  const handoff = args.handoff as HandoffPayload | undefined;
  const grant = await persistDelegationGrant(admin, { principalPersonaId: authority.personaId, agentRef: session.agentAlias, role, scope: ['research.exchange.read', 'research.exchange.write'], policyEnvelope, handoff });
  if (!grant.ok) return { ok: false as const, error: grant.error };
  const eventId = `evt_${createHash('sha256').update(`${authority.exchangeId}:${grant.grant.id}`).digest('hex').slice(0, 24)}`;
  await emitOrchestrationEvent(admin, { id: eventId, eventType: 'delegation.established', exchangeId: authority.exchangeId, agentRole: role, createdAt: new Date().toISOString() }).catch(() => undefined);
  const receipt = await createActivityReceipt({ activityType: 'research.exchange.delegation', principalPersonaId: authority.personaId, summary: 'Bounded research-exchange delegation established through MCP after explicit principal assent.', metadata: { exchangeId: authority.exchangeId, delegationGrantId: grant.grant.id, agentRole: role } }).catch(() => null);
  return { ok: true as const, exchangeId: authority.exchangeId, delegationGrant: grant.grant, receipt };
}
