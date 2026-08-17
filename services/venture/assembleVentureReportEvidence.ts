/**
 * assembleVentureReportEvidence — Derive venture-report evidence from six
 * evidence-bearing artifact types with maturity classification.
 *
 * Service routes for:
 * - activity_receipts (competency_token, award, recognition)
 * - deployment_records (contract, API, infrastructure)
 * - capability_registry (service, agent, integration)
 * - ventureCapitalNote (portfolio company snapshot)
 * - codex tabs (KPI/metric exports)
 * - operational context (team, funding, milestones)
 *
 * Canonical schema: evidenceBundle with flat artifact array, each with:
 * sourceId, artifactType, label, description, evidenceCategory
 * (outcome / capability / risk / context), maturityStatus, optional excerpt.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReportEvidenceItem, EvidenceMaturity } from '@/types/deliberativeArtifact';

export interface EvidenceBundle {
  /** Venture identifier being reported on. */
  ventureId: string;
  /** Persona identifier gathering evidence. */
  personaId: string;
  /** Flat array of evidence items assembled from platform sources. */
  artifacts: ReportEvidenceItem[];
  /** Count of items by maturity tier — helps brief show completeness. */
  maturityDistribution: Record<EvidenceMaturity, number>;
  /** Timestamp when this evidence bundle was assembled. */
  assembledAt: string;
}

export type EvidenceCategory = 'outcome' | 'capability' | 'risk' | 'context';

interface EvidenceSource {
  /** Unique ID within source type. */
  id: string;
  /** Type of source (activity_receipt, deployment_record, etc.). */
  type: string;
  /** How mature is this evidence (built, activated, verified_in_use, etc.). */
  maturityStatus: EvidenceMaturity;
  /** Title for display. */
  title: string;
  /** Narrative description. */
  description: string;
  /** Which evidence category this belongs in. */
  category: EvidenceCategory;
  /** Domain/area (product, partnerships, research, commercial, etc.). */
  domain: string;
  /** Timestamp when this artifact was created/observed (if known). */
  occurredAt?: string;
  /** Optional excerpt from the artifact for inline display. */
  excerpt?: string;
  /** Confidence in this evidence (0-1 if uncertain). */
  confidence?: number;
}

/**
 * Assemble evidence for a venture report from all platform-native sources.
 * Called when operator opens the VentureReportBriefLayout deliberation panel.
 *
 * @param ventureId — the iQube or venture slug being reported on
 * @param personaId — operator gathering evidence
 * @returns EvidenceBundle with flat artifact array and maturity distribution
 */
export async function assembleVentureReportEvidence(
  ventureId: string,
  personaId: string,
): Promise<EvidenceBundle> {
  const sb = getSupabaseServer();

  if (!sb) {
    return {
      ventureId,
      personaId,
      artifacts: [],
      maturityDistribution: {
        built: 0,
        activated: 0,
        verified_in_use: 0,
        in_progress: 0,
        planned: 0,
        blocked: 0,
      },
      assembledAt: new Date().toISOString(),
    };
  }

  const [
    activityReceipts,
    deploymentRecords,
    capabilityRegistryItems,
    ventureObjectives,
    operationalContext,
  ] = await Promise.all([
    fetchActivityReceiptEvidence(sb, ventureId, personaId),
    fetchDeploymentRecordEvidence(sb, ventureId, personaId),
    fetchCapabilityRegistryEvidence(sb, ventureId, personaId),
    fetchVentureObjectiveEvidence(sb, ventureId, personaId),
    fetchOperationalContextEvidence(sb, ventureId, personaId),
  ]);

  const allSources = [
    ...activityReceipts,
    ...deploymentRecords,
    ...capabilityRegistryItems,
    ...ventureObjectives,
    ...operationalContext,
  ];

  const artifacts = allSources.map((src) =>
    sourceToReportEvidenceItem(src),
  );

  const maturityDistribution = calculateMaturityDistribution(artifacts);

  return {
    ventureId,
    personaId,
    artifacts,
    maturityDistribution,
    assembledAt: new Date().toISOString(),
  };
}

/**
 * Fetch evidence from activity_receipts table:
 * competency_token, award, recognition items tied to venture.
 */
async function fetchActivityReceiptEvidence(
  sb: SupabaseClient | null,
  ventureId: string,
  personaId: string,
): Promise<EvidenceSource[]> {
  if (!sb) return [];

  try {
    // Query activity_receipts where action_type matches venture context
    // and recipient_persona_id = personaId (access gate)
    const { data, error } = await sb.from('activity_receipts')
      .select(
        'id, action_type, created_at, metadata, recipient_persona_id, actor_agent_slug',
      )
      .eq('recipient_persona_id', personaId)
      .in('action_type', ['competency_token', 'award', 'recognition', 'venture_milestone'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data
      .filter((r) => r && r.metadata && typeof r.metadata === 'object')
      .map((receipt) => ({
        id: receipt.id,
        type: 'activity_receipt',
        maturityStatus: classifyReceiptMaturity(receipt.action_type),
        title: formatReceiptTitle(receipt),
        description: formatReceiptDescription(receipt),
        category: mapReceiptToCategory(receipt.action_type),
        domain: 'operational',
        occurredAt: receipt.created_at,
        confidence: 0.95,
      }));
  } catch {
    return [];
  }
}

/**
 * Fetch evidence from deployment_records table:
 * contract deployments, API endpoints, infrastructure changes.
 */
async function fetchDeploymentRecordEvidence(
  sb: SupabaseClient | null,
  ventureId: string,
  personaId: string,
): Promise<EvidenceSource[]> {
  if (!sb) return [];

  try {
    // deployment_records tied to venture (via iqube_id or venture_id field)
    const { data, error } = await sb.from('deployment_records')
      .select('id, deployment_type, status, deployed_at, metadata')
      .eq('owner_persona_id', personaId)
      .in('deployment_type', ['contract', 'api', 'infrastructure', 'service'])
      .order('deployed_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data.filter((r) => r).map((record) => ({
      id: record.id,
      type: 'deployment_record',
      maturityStatus: classifyDeploymentMaturity(record.status),
      title: `${record.deployment_type}: ${(record.metadata as any)?.name || 'Deployment'}`,
      description: (record.metadata as any)?.summary || 'Deployed to production',
      category: 'capability',
      domain: 'infrastructure',
      occurredAt: record.deployed_at,
      confidence: 0.98,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch evidence from capability_registry:
 * services, agents, integrations the venture uses or has activated.
 */
async function fetchCapabilityRegistryEvidence(
  sb: SupabaseClient | null,
  ventureId: string,
  personaId: string,
): Promise<EvidenceSource[]> {
  if (!sb) return [];

  try {
    // Query capability_activations or the registry directly
    const { data, error } = await sb.from('capability_activations')
      .select(
        'id, capability_id, activated_at, status, metadata',
      )
      .eq('persona_id', personaId)
      .order('activated_at', { ascending: false })
      .limit(30);

    if (error || !data) return [];

    return data.filter((a) => a).map((activation) => ({
      id: activation.id,
      type: 'capability_activation',
      maturityStatus: classifyCapabilityMaturity(activation.status),
      title: (activation.metadata as any)?.capability_name || 'Capability',
      description: (activation.metadata as any)?.description || 'Capability activated',
      category: 'capability',
      domain: 'platform',
      occurredAt: activation.activated_at,
      confidence: 0.9,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch evidence from venture objectives or KPI export:
 * what success metrics the venture is tracking.
 */
async function fetchVentureObjectiveEvidence(
  sb: SupabaseClient | null,
  ventureId: string,
  personaId: string,
): Promise<EvidenceSource[]> {
  if (!sb) return [];

  try {
    // Query venture_objectives or similar table
    const { data, error } = await sb.from('venture_objectives')
      .select('id, title, description, target_value, current_value, deadline, status')
      .eq('venture_id', ventureId)
      .order('deadline', { ascending: true })
      .limit(20);

    if (error || !data) return [];

    return data.filter((o) => o).map((obj) => ({
      id: obj.id,
      type: 'venture_objective',
      maturityStatus: classifyObjectiveMaturity(obj.status),
      title: obj.title,
      description: obj.description || 'Venture objective',
      category: 'outcome',
      domain: 'goals',
      occurredAt: undefined,
      excerpt: `Target: ${obj.target_value}, Current: ${obj.current_value}`,
      confidence: 0.85,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch operational context:
 * team composition, funding milestones, partnership status.
 */
async function fetchOperationalContextEvidence(
  sb: SupabaseClient | null,
  ventureId: string,
  personaId: string,
): Promise<EvidenceSource[]> {
  if (!sb) return [];

  try {
    // Query venture_team, funding_records, partnership_records, etc.
    const { data, error } = await sb.from('venture_team_members')
      .select('id, role, joined_at, status, name')
      .eq('venture_id', ventureId)
      .order('joined_at', { ascending: false })
      .limit(15);

    if (error || !data) return [];

    return data.filter((m) => m).map((member) => ({
      id: member.id,
      type: 'team_member',
      maturityStatus: classifyTeamMemberMaturity(member.status),
      title: `${member.name} (${member.role})`,
      description: `Team member with ${member.role} responsibilities`,
      category: 'context',
      domain: 'team',
      occurredAt: member.joined_at,
      confidence: 0.95,
    }));
  } catch {
    return [];
  }
}

// ─── Maturity Classification Helpers ─────────────────────────────────────────

function classifyReceiptMaturity(actionType: string): EvidenceMaturity {
  const map: Record<string, EvidenceMaturity> = {
    competency_token: 'activated',
    award: 'verified_in_use',
    recognition: 'verified_in_use',
    venture_milestone: 'built',
  };
  return map[actionType] || 'in_progress';
}

function classifyDeploymentMaturity(status: string): EvidenceMaturity {
  const map: Record<string, EvidenceMaturity> = {
    'deployed-live': 'built',
    'deployed-staging': 'activated',
    'in-progress': 'in_progress',
    'planned': 'planned',
    'failed': 'blocked',
  };
  return map[status] || 'in_progress';
}

function classifyCapabilityMaturity(status: string): EvidenceMaturity {
  const map: Record<string, EvidenceMaturity> = {
    'active': 'activated',
    'verified': 'verified_in_use',
    'pending': 'in_progress',
    'disabled': 'blocked',
  };
  return map[status] || 'in_progress';
}

function classifyObjectiveMaturity(status: string): EvidenceMaturity {
  const map: Record<string, EvidenceMaturity> = {
    'achieved': 'built',
    'in_progress': 'in_progress',
    'planned': 'planned',
    'blocked': 'blocked',
    'paused': 'in_progress',
  };
  return map[status] || 'planned';
}

function classifyTeamMemberMaturity(status: string): EvidenceMaturity {
  const map: Record<string, EvidenceMaturity> = {
    'active': 'activated',
    'onboarding': 'in_progress',
    'alumni': 'verified_in_use',
    'inactive': 'blocked',
  };
  return map[status] || 'in_progress';
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatReceiptTitle(receipt: any): string {
  const actionLabel = receipt.action_type
    .split('_')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const agentLabel = receipt.actor_agent_slug
    ? ` from ${receipt.actor_agent_slug}`
    : '';
  return `${actionLabel}${agentLabel}`;
}

function formatReceiptDescription(receipt: any): string {
  const meta = receipt.metadata || {};
  return (meta.description || meta.summary || 'Activity receipt') as string;
}

function mapReceiptToCategory(actionType: string): EvidenceCategory {
  if (actionType === 'venture_milestone') return 'outcome';
  if (actionType === 'competency_token') return 'capability';
  if (actionType === 'award' || actionType === 'recognition') return 'outcome';
  return 'context';
}

function sourceToReportEvidenceItem(src: EvidenceSource): ReportEvidenceItem {
  return {
    id: src.id,
    domain: src.domain,
    title: src.title,
    summary: src.description,
    state: src.maturityStatus,
    occurredAt: src.occurredAt,
    sourceType: src.type,
    sourceRef: src.id,
    confidence: src.confidence,
    disclosure: 'persona',
  };
}

function calculateMaturityDistribution(
  artifacts: ReportEvidenceItem[],
): Record<EvidenceMaturity, number> {
  const dist: Record<EvidenceMaturity, number> = {
    built: 0,
    activated: 0,
    verified_in_use: 0,
    in_progress: 0,
    planned: 0,
    blocked: 0,
  };

  artifacts.forEach((a) => {
    dist[a.state]++;
  });

  return dist;
}
