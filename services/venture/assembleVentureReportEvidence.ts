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

export interface NarrativeGap {
  /** Unique identifier for this gap. */
  id: string;
  /** Category of the gap (major_pivot, unresolved_blocker, strategy_shift, milestone_missed). */
  category: 'major_pivot' | 'unresolved_blocker' | 'strategy_shift' | 'milestone_missed' | 'context_change';
  /** Human-readable title of the gap. */
  title: string;
  /** Detailed description of what's missing or changed. */
  description: string;
  /** Domain/area affected. */
  domain: string;
  /** How critical is this gap to explain (1-5 scale). */
  criticalityLevel: 1 | 2 | 3 | 4 | 5;
  /** Evidence items that would help fill this gap. */
  relatedEvidenceIds: string[];
  /** Suggested narrative for explaining this gap in reintroduction. */
  suggestedNarrative?: string;
}

export interface ReintroductionBundle extends EvidenceBundle {
  /** Narrative gaps — information gaps between prior understanding and current state. */
  narrativeGaps: NarrativeGap[];
  /** How aligned is the current state with likely prior understanding (0-1). */
  narrativeAlignment: number;
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
 * Assemble evidence for a venture reintroduction from all platform-native sources
 * plus narrative gap analysis.
 * Called when operator opens the VentureReintroductionBriefLayout deliberation panel.
 *
 * @param ventureId — the iQube or venture slug being reintroduced
 * @param personaId — operator gathering evidence
 * @param lastInteractionDate — ISO date when audience last meaningfully interacted
 * @returns ReintroductionBundle with artifacts, gaps, and alignment score
 */
export async function assembleVentureReintroductionEvidence(
  ventureId: string,
  personaId: string,
  lastInteractionDate?: string,
): Promise<ReintroductionBundle> {
  // First gather the base evidence
  const baseBundle = await assembleVentureReportEvidence(ventureId, personaId);

  // Then analyze narrative gaps based on what's changed since last interaction
  const narrativeGaps = lastInteractionDate
    ? analyzeNarrativeGaps(baseBundle.artifacts, lastInteractionDate, ventureId)
    : [];

  // Calculate alignment — how well current state aligns with prior expectations
  const narrativeAlignment = calculateNarrativeAlignment(baseBundle.artifacts, narrativeGaps);

  return {
    ...baseBundle,
    narrativeGaps,
    narrativeAlignment,
  };
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

// ─── Narrative Gap Analysis (Reintroduction-Specific) ────────────────────────

/**
 * Analyze narrative gaps — information gaps between prior understanding and current state.
 * Identifies evidence items that represent major changes, pivots, or unresolved blockers
 * that have emerged since the last meaningful interaction.
 */
function analyzeNarrativeGaps(
  artifacts: ReportEvidenceItem[],
  lastInteractionDate: string,
  ventureId: string,
): NarrativeGap[] {
  const gaps: NarrativeGap[] = [];
  let gapIdCounter = 1;

  const lastInteractionTime = new Date(lastInteractionDate).getTime();

  // Group artifacts by domain
  const artifactsByDomain = new Map<string, ReportEvidenceItem[]>();
  artifacts.forEach((a) => {
    const domain = a.domain || 'other';
    if (!artifactsByDomain.has(domain)) {
      artifactsByDomain.set(domain, []);
    }
    artifactsByDomain.get(domain)!.push(a);
  });

  // Detect major pivots — projects/initiatives that shifted or were abandoned
  const pivotEvidence = artifacts.filter(
    (a) =>
      (a.state === 'blocked' || a.sourceType === 'venture_objective') &&
      a.occurredAt &&
      new Date(a.occurredAt).getTime() > lastInteractionTime,
  );

  if (pivotEvidence.length > 0) {
    gaps.push({
      id: `gap-${gapIdCounter++}`,
      category: 'major_pivot',
      title: 'Strategy or Initiative Changes',
      description: `Since last interaction on ${lastInteractionDate}, there have been ${pivotEvidence.length} significant changes to initiatives or strategic direction.`,
      domain: 'strategy',
      criticalityLevel: 4,
      relatedEvidenceIds: pivotEvidence.map((e) => e.id),
      suggestedNarrative: `We've made some important strategic shifts. Let me walk you through what changed and why.`,
    });
  }

  // Detect unresolved blockers — items stuck in blocked state
  const blockedEvidence = artifacts.filter((a) => a.state === 'blocked');
  if (blockedEvidence.length > 0) {
    gaps.push({
      id: `gap-${gapIdCounter++}`,
      category: 'unresolved_blocker',
      title: 'Unresolved Blockers',
      description: `There are ${blockedEvidence.length} items currently blocked or at risk. These should be explained proactively.`,
      domain: 'risk',
      criticalityLevel: 5,
      relatedEvidenceIds: blockedEvidence.map((e) => e.id),
      suggestedNarrative: `We're actively working through some blockers. Here's what's holding us up and our plan to resolve it.`,
    });
  }

  // Detect missing outcomes — planned items with low confidence
  const lowConfidenceOutcomes = artifacts.filter(
    (a) =>
      a.sourceType === 'venture_objective' &&
      a.state === 'in_progress' &&
      (a.confidence === undefined || a.confidence < 0.7),
  );

  if (lowConfidenceOutcomes.length > 0) {
    gaps.push({
      id: `gap-${gapIdCounter++}`,
      category: 'milestone_missed',
      title: 'Milestone Confidence Gaps',
      description: `${lowConfidenceOutcomes.length} objectives are in progress but with low certainty. These represent areas where outcomes are less certain than expected.`,
      domain: 'execution',
      criticalityLevel: 3,
      relatedEvidenceIds: lowConfidenceOutcomes.map((e) => e.id),
      suggestedNarrative: `Some milestones we expected to hit more confidently are in flux. Here's where we are and what we're learning.`,
    });
  }

  // Detect new capability activations — significant new abilities since last interaction
  const newCapabilities = artifacts.filter(
    (a) =>
      a.sourceType === 'capability_activation' &&
      a.state === 'activated' &&
      a.occurredAt &&
      new Date(a.occurredAt).getTime() > lastInteractionTime,
  );

  if (newCapabilities.length > 0) {
    gaps.push({
      id: `gap-${gapIdCounter++}`,
      category: 'context_change',
      title: 'New Capabilities Added',
      description: `${newCapabilities.length} new capabilities have been activated since your last interaction. These expand what we're now able to do.`,
      domain: 'capability',
      criticalityLevel: 2,
      relatedEvidenceIds: newCapabilities.map((e) => e.id),
      suggestedNarrative: `We've expanded our capabilities significantly. Let me show you what new things we can now do.`,
    });
  }

  return gaps;
}

/**
 * Calculate narrative alignment score — how well does current state align with
 * what was likely understood at the time of last interaction?
 */
function calculateNarrativeAlignment(
  artifacts: ReportEvidenceItem[],
  gaps: NarrativeGap[],
): number {
  // Start at 1.0 (fully aligned)
  let alignment = 1.0;

  // Each high-criticality gap reduces alignment
  const criticalGaps = gaps.filter((g) => g.criticalityLevel >= 4).length;
  alignment -= criticalGaps * 0.15;

  // Blocked items also reduce alignment
  const blockedCount = artifacts.filter((a) => a.state === 'blocked').length;
  alignment -= Math.min(blockedCount * 0.05, 0.2);

  // In-progress items with low confidence reduce alignment slightly
  const uncertainInProgress = artifacts.filter(
    (a) =>
      a.state === 'in_progress' &&
      (a.confidence === undefined || a.confidence < 0.6),
  ).length;
  alignment -= Math.min(uncertainInProgress * 0.03, 0.1);

  // Return alignment clamped to [0, 1]
  return Math.max(0, Math.min(1.0, alignment));
}
