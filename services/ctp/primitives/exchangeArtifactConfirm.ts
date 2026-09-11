/**
 * ctp.exchange.artifact.confirm — the FIRST migrated OCSGA primitive
 * (2026-08-31, "CTP foundation", delivery amendment §3.2 "Slice B — OCSGA
 * first").
 *
 * "The bound principal — directly, or an authorized delegate acting within
 *  an active delegation grant — confirms an operator-assisted artifact as
 *  the principal's own submitted artifact." (charter §4)
 *
 * BINDS, DOES NOT REWRITE (CTP-001A §3): the canonical implementation is the
 * UNMODIFIED `confirmOperatorAssistedArtifact` in
 * `services/research/reciprocalExchange.ts` — the exact function that
 * already correctly performs this transition (membership check, pending-
 * attestation clearing, its own receipt). Every resolution function below
 * reuses that module's own existing resolvers (`resolveExchangeActingPrincipal`,
 * `resolveMembership`, `currentArtifact`) — nothing here re-derives
 * authorization from scratch, and nothing here weakens what that module
 * already enforces: the bound implementation re-checks membership and
 * pending-state independently, so a bug in this primitive's own
 * authorize()/readPriorState() cannot itself cause an unauthorized write.
 *
 * Delegability: TRUE, matching `confirmOperatorAssistedArtifact`'s existing
 * (unmodified) behaviour — it has never required `actorType === 'principal'`
 * the way `declareFreeze`/`signInstrument` do. This primitive does not
 * introduce a NEW restriction that the current implementation does not
 * already enforce (CTP-001A §3 — "only defects... justify changing the
 * underlying service implementation"; this is not a defect).
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  confirmOperatorAssistedArtifact,
  currentArtifact,
  loadExchange,
  resolveExchangeActingPrincipal,
  resolveMembership,
} from '@/services/research/reciprocalExchange';
import type { ExchangeArtifactRecord } from '@/types/reciprocalExchange';
import type { ConstitutionalTransitionPrimitive } from '@/types/ctp';
import { registerPrimitive } from '@/services/ctp/registry';

export interface ExchangeArtifactConfirmInput {
  exchangeId: string;
  /** Set by the MCP channel to the acting agent's own session alias — the
   *  SAME third-identity pattern `confirmOperatorAssistedArtifact` already
   *  accepts; never set by the web channel. */
  agentRef?: string;
}

interface ExchangeArtifactConfirmState {
  exists: boolean;
  pendingPrincipalAttestation: boolean | null;
  artifactId: string | null;
  version: number | null;
}

const PRIMITIVE_ID = 'ctp.exchange.artifact.confirm';
const VERSION = '1.0.0';
const IMPLEMENTATION_REF = 'services/research/reciprocalExchange.ts#confirmOperatorAssistedArtifact';

/** A NAMED-BINDING hash — see types/ctp.ts's own doc comment on
 *  `implementationHash` for exactly what this does and does not prove. */
function namedBindingHash(implementationRef: string, version: string): string {
  return `sha256:${createHash('sha256').update(`${implementationRef}@${version}`).digest('hex')}`;
}

async function priorStateFor(
  admin: SupabaseClient,
  exchangeId: string,
  subjectPersonaId: string,
): Promise<ExchangeArtifactConfirmState> {
  const loaded = await loadExchange(admin, exchangeId);
  if (!loaded.ok) return { exists: false, pendingPrincipalAttestation: null, artifactId: null, version: null };
  const party = resolveMembership(loaded.exchange, subjectPersonaId);
  if (!party) return { exists: false, pendingPrincipalAttestation: null, artifactId: null, version: null };
  const artifact = await currentArtifact(admin, exchangeId, party);
  if (!artifact) return { exists: false, pendingPrincipalAttestation: null, artifactId: null, version: null };
  return {
    exists: true,
    pendingPrincipalAttestation: artifact.pendingPrincipalAttestation,
    artifactId: artifact.id,
    version: artifact.version,
  };
}

export const exchangeArtifactConfirmPrimitive: ConstitutionalTransitionPrimitive<
  ExchangeArtifactConfirmInput,
  ExchangeArtifactRecord
> = {
  primitiveId: PRIMITIVE_ID,
  version: VERSION,
  status: 'ACTIVE',
  domain: 'reciprocal-artifact-exchange',
  description:
    "The bound principal — directly, or an authorized delegate acting on their behalf — confirms an " +
    "operator-assisted artifact as the principal's own submitted artifact, clearing pendingPrincipalAttestation.",
  subjectRequirement: 'PERSONHOOD',
  actorRequirement: ['AUTHORIZED_PRINCIPAL_IDENTITY', 'AUTHORIZED_DELEGATE'],
  delegability: true,
  permittedChannels: ['web', 'mcp'],
  invariantRefs: ['inv.constitutional.361', 'inv.constitutional.369'],

  async resolveParticipants(admin, ctx, input) {
    const resolved = await resolveExchangeActingPrincipal(admin, {
      exchangeId: input.exchangeId,
      activePersonaId: ctx.callerPersonaId,
      authProfileId: ctx.callerAuthProfileId,
    });
    if (!resolved.ok) {
      return { ok: false, reasonCode: 'NOT_A_PARTY', reason: 'The caller is not a bound party of this exchange.' };
    }
    return {
      ok: true,
      participants: {
        subjectPersonaId: resolved.personaId,
        principalPersonaId: resolved.personaId,
        actorPersonaId: ctx.callerPersonaId,
        actorKind: resolved.actorType === 'principal' ? 'principal' : 'delegate',
        delegateGrantRef: null,
      },
    };
  },

  async resolveAuthority(_admin, _participants) {
    // Membership is already verified by resolveParticipants above (charter's
    // own illustrative example for this primitive names exactly this basis:
    // `authority.required_basis: [exchange_party_membership]`). No second,
    // independently-derived authority check is added here.
    return { result: 'VALID', basis: ['exchange_party_membership'] };
  },

  async readPriorState(admin, participants, input) {
    const state = await priorStateFor(admin, input.exchangeId, participants.subjectPersonaId);
    return state as unknown as Record<string, unknown>;
  },

  projectConsequence(priorState) {
    const state = priorState as unknown as ExchangeArtifactConfirmState;
    if (!state.exists) {
      return { effects: ['no artifact on record for this party — nothing to confirm'] };
    }
    if (state.pendingPrincipalAttestation === false) {
      return { effects: ['idempotent no-op — already confirmed'] };
    }
    return {
      effects: [
        'pendingPrincipalAttestation becomes false',
        'principal attribution becomes authoritative',
        'freeze/signature become available for this artifact version',
      ],
      categories: ['evidentiary-attribution'],
    };
  },

  authorize(_participants, _authority, priorState) {
    const state = priorState as unknown as ExchangeArtifactConfirmState;
    if (!state.exists) {
      return { result: 'REFUSED', reasonCode: 'NO_ARTIFACT_ON_RECORD', reason: 'No artifact is on record for this party.' };
    }
    return { result: 'AUTHORIZED' };
  },

  implementationRef: IMPLEMENTATION_REF,
  implementationHash: namedBindingHash(IMPLEMENTATION_REF, VERSION),

  async execute(admin, participants, input) {
    const result = await confirmOperatorAssistedArtifact(admin, {
      exchangeId: input.exchangeId,
      personaId: participants.subjectPersonaId,
      agentRef: input.agentRef,
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, result: result.artifact };
  },

  resultingStateFrom(artifact) {
    return {
      exists: true,
      pendingPrincipalAttestation: artifact.pendingPrincipalAttestation,
      artifactId: artifact.id,
      version: artifact.version,
    };
  },

  realizeConsequence(artifact) {
    // "hash unchanged" — the same fact confirmOperatorAssistedArtifact's own
    // doc comment names as the load-bearing guarantee of this act.
    return { artifactId: artifact.id, contentHash: artifact.contentHash, contentHashUnchanged: true };
  },
};

registerPrimitive(exchangeArtifactConfirmPrimitive);
