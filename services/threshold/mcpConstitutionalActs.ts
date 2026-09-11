/**
 * mcpConstitutionalActs.ts — MCP-completable constitutional rituals for the
 * OCSGA / Boundary Research Journey Spine.
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
  if (args.declarationConfirmed !== true) return { ok: false, error: 'declarationConfirmed must be explicitly true. Show your principal the exact declaration text for this act and obtain their explicit assent BEFORE calling this tool — never infer consent from the surrounding conversation.' };
  return { ok: true };
}
export async function getExchangeStateForMcp(admin: SupabaseClient, session: ScopedSession) {
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  const view = await getExchangeView(admin, { exchangeId: authority.exchangeId, personaId: authority.personaId });
  if (!view.ok) return { ok: false as const, error: view.error };
  return { ok: true as const, exchangeId: authority.exchangeId, view: view.view, freezeDeclarationText: FREEZE_DECLARATION_TEXT, exchangeInstrumentClauses: EXCHANGE_INSTRUMENT_CLAUSES };
}
export interface DepositArtifactMcpArgs { declarationConfirmed: boolean; title: string; artifactClass: string; description?: string; sourceType: DepositArtifactInput['sourceType']; sourceReference: string; contentHash: string; repositoryCommit?: string; storageReference?: string; mimeType?: string; ownershipDeclaration: string; rightsForExchange: string; }
export async function depositExchangeArtifactViaMcp(admin: SupabaseClient, session: ScopedSession, args: DepositArtifactMcpArgs) {
  const eligible = requireMcpEligibleStage('create-deposit'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>); if (!consent.ok) return consent;
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  if (!args.title?.trim() || !args.artifactClass?.trim() || !args.sourceReference?.trim() || !args.contentHash?.trim()) return { ok: false as const, error: 'title, artifactClass, sourceReference and contentHash are all required.' };
  if (!args.ownershipDeclaration?.trim() || !args.rightsForExchange?.trim()) return { ok: false as const, error: 'ownershipDeclaration and rightsForExchange are both required — the deposit is a constitutional declaration, not just a file upload.' };
  const result = await depositArtifact(admin, { exchangeId: authority.exchangeId, personaId: authority.personaId, title: args.title, artifactClass: args.artifactClass, description: args.description, sourceType: args.sourceType, sourceReference: args.sourceReference, contentHash: args.contentHash, repositoryCommit: args.repositoryCommit, storageReference: args.storageReference, mimeType: args.mimeType, ownershipDeclaration: args.ownershipDeclaration, rightsForExchange: args.rightsForExchange, originChannel: 'mcp', agentRef: session.agentAlias });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, exchangeId: authority.exchangeId, artifact: result.artifact, replaced: result.replaced };
}
export interface ConfirmOperatorAssistedArtifactMcpArgs { declarationConfirmed: boolean; }
export async function confirmOperatorAssistedArtifactViaMcp(admin: SupabaseClient, session: ScopedSession, args: ConfirmOperatorAssistedArtifactMcpArgs) {
  const eligible = requireMcpEligibleStage('create-deposit'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>); if (!consent.ok) return consent;
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  const principal = await resolveMcpPrincipal(admin, session); if (!principal.ok) return principal;
  const outcome = await constitutionalRuntime.execute(admin, 'ctp.exchange.artifact.confirm', { channel: 'mcp', channelSessionRef: session.agentAlias ?? null, callerPersonaId: principal.personaId, callerAuthProfileId: principal.authProfileId }, { exchangeId: authority.exchangeId, agentRef: session.agentAlias });
  if (!outcome.ok) return { ok: false as const, error: outcome.refusal.reason };
  return { ok: true as const, exchangeId: authority.exchangeId, artifact: outcome.result };
}
export function fingerprintExchangeArtifact(args: { content?: string; contentBase64?: string }): { ok: true; contentHash: string } | { ok: false; error: string } {
  if ((args.content && args.contentBase64) || (!args.content && !args.contentBase64)) return { ok: false, error: 'Provide exactly one of content or contentBase64.' };
  const buf = args.contentBase64 ? Buffer.from(args.contentBase64, 'base64') : Buffer.from(String(args.content), 'utf8');
  return { ok: true, contentHash: createHash('sha256').update(buf).digest('hex') };
}
export interface DeclareArtifactFreezeMcpArgs { declarationConfirmed: boolean; }
export async function declareArtifactFreezeViaMcp(admin: SupabaseClient, session: ScopedSession, args: DeclareArtifactFreezeMcpArgs) {
  const eligible = requireMcpEligibleStage('freeze-attestation'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>); if (!consent.ok) return consent;
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  const result = await declareFreeze(admin, { exchangeId: authority.exchangeId, personaId: authority.personaId, actorType: 'principal', originChannel: 'mcp', agentRef: session.agentAlias });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, exchangeId: authority.exchangeId, attestation: result.attestation };
}
export interface SignExchangeInstrumentMcpArgs { declarationConfirmed: boolean; }
export async function signExchangeInstrumentViaMcp(admin: SupabaseClient, session: ScopedSession, args: SignExchangeInstrumentMcpArgs) {
  const eligible = requireMcpEligibleStage('exchange-ready'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>); if (!consent.ok) return consent;
  const authority = await resolveExchangeWriteAuthority(admin, session); if (!authority.ok) return authority;
  const result = await signInstrument(admin, { exchangeId: authority.exchangeId, personaId: authority.personaId, actorType: 'principal', originChannel: 'mcp', agentRef: session.agentAlias });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, exchangeId: authority.exchangeId, attestation: result.attestation, exchangeStatus: result.exchange.status, originChannelNote: "This is an authenticated-principal MCP attestation, not a wallet signature — it satisfies the Exchange Instrument stage on the same terms a native browser signature would, labelled honestly as origin_channel='mcp'." };
}
const MCP_DELEGATION_TRUST_BAND = 'L1_EXPERIMENTAL';
const MCP_DELEGATION_ALLOWED_ACTIONS = ['knowledge_retrieval'];
const MCP_DELEGATION_ALLOWED_SURFACES = ['irl-cartridge'];
const MCP_DELEGATION_FORBIDDEN_ACTIONS = ['write_to_aigency_pack','access_supabase_service_role','push_to_registry_live','read_wallet_credentials','modify_other_persona','read_sovereign_iqube'];
const MCP_DELEGATION_TTL_HOURS = 8;
const MCP_DELEGATION_MAX_ACTIONS = 20;
export interface EstablishDelegationMcpArgs { declarationConfirmed: boolean; agentRootDid: string; purpose: string; }
export async function establishDelegationViaMcp(admin: SupabaseClient, session: ScopedSession, args: EstablishDelegationMcpArgs) {
  const eligible = requireMcpEligibleStage('delegation-establish'); if (!eligible.ok) return eligible;
  const consent = requireExplicitConsent(args as unknown as Record<string, unknown>); if (!consent.ok) return consent;
  if (!args.agentRootDid?.trim()) return { ok: false as const, error: 'agentRootDid is required.' };
  if (!args.purpose?.trim()) return { ok: false as const, error: 'purpose is required — the delegation must name why authority is being delegated.' };
  const principal = await resolveMcpPrincipal(admin, session); if (!principal.ok) return principal;
  const agentRootDid = args.agentRootDid.trim();
  const expiresAt = new Date(Date.now() + MCP_DELEGATION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const handoffId = `handoff_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const envelope: PolicyEnvelope = { tenant_id: 'default', persona_id: principal.personaId, allowed_surfaces: MCP_DELEGATION_ALLOWED_SURFACES, forbidden_actions: MCP_DELEGATION_FORBIDDEN_ACTIONS, disclosure_class: 'tenant', requires_guardian_approval: false, cartridge_scope: MCP_DELEGATION_ALLOWED_SURFACES[0] };
  const handoff: HandoffPayload = { handoff_id: handoffId, from_agent: 'aigent-z', to_agent: agentRootDid as AgentRoleId, reason: `Bounded delegation granted via Threshold MCP for OCSGA Boundary Research. Purpose: ${args.purpose}. Trust band: ${MCP_DELEGATION_TRUST_BAND}.`, user_context_summary: `Persona ${principal.personaId} granted MCP-originated delegation to ${agentRootDid}. Allowed: ${MCP_DELEGATION_ALLOWED_ACTIONS.join(', ')}. Expires: ${expiresAt}.`, journey_state_summary: { persona_id: principal.personaId, journey_stage: 'acolyte', experience_depth: 'codex', active_cartridge: 'irl-cartridge', active_codex: 'irl-cartridge', blocked_reasons: [], next_likely_step: null, session_id: handoffId }, policy_envelope: envelope, open_tasks: MCP_DELEGATION_ALLOWED_ACTIONS, return_conditions: ['task_complete','session_end','policy_escalation','user_exit'], timestamp: new Date().toISOString() };
  await persistDelegationGrant({ grantId: handoffId, personaId: principal.personaId, agentRootDid, tenantId: 'default', trustBand: MCP_DELEGATION_TRUST_BAND, allowedActions: MCP_DELEGATION_ALLOWED_ACTIONS, allowedSurfaces: MCP_DELEGATION_ALLOWED_SURFACES, forbiddenActions: MCP_DELEGATION_FORBIDDEN_ACTIONS, disclosureClass: 'tenant', maxActions: MCP_DELEGATION_MAX_ACTIONS, spendAutonomy: 'low', showReceipts: true, curatedSkillsOnly: true, explainBeforeActing: true, handoff, expiresAt });
  await emitOrchestrationEvent({ event_id: `delg_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, timestamp: new Date().toISOString(), event_type: 'z_delegated', from_role: 'aigent-z', to_role: 'aigent-c', reason: `MCP-originated bounded delegation: ${args.purpose}`, journey_stage: 'acolyte', active_cartridge: 'irl-cartridge', active_codex: 'irl-cartridge', receipt_eligible: true, metadata: { persona_id: principal.personaId, agent_root_did: agentRootDid, trust_band: MCP_DELEGATION_TRUST_BAND, allowed_actions: MCP_DELEGATION_ALLOWED_ACTIONS, expires_at: expiresAt, origin_channel: 'mcp' } });
  const receipt = await createActivityReceipt({ personaId: principal.personaId, activeCartridge: 'irl-cartridge', actionType: 'agent_delegated', summary: `Bounded delegation granted via Threshold MCP to ${agentRootDid} for OCSGA Boundary Research (trust band: ${MCP_DELEGATION_TRUST_BAND}, purpose: ${args.purpose})`, agentsInvoked: [agentRootDid], contextShared: ['agent_root_did','trust_band','purpose'] }).catch(() => null);
  return { ok: true as const, grantId: handoffId, agentRootDid, trustBand: MCP_DELEGATION_TRUST_BAND, allowedActions: MCP_DELEGATION_ALLOWED_ACTIONS, expiresAt, receiptId: receipt?.id ?? null, note: 'This is the safe-floor bound (L1_EXPERIMENTAL, knowledge_retrieval only). For a broader grant, use the native Delegate surface in IRL OS.' };
}
