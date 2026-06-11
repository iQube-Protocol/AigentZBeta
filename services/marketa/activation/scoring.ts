import type { CandidateAgentInput, CandidateScores, ScoreWeights } from './types';
import { classifyCandidate } from './classification';
import { DEFAULT_MARKETA_SCORE_WEIGHTS } from './defaults';
import { cleanRevenueScreen } from './policy';
import { clampScore } from './text';

function baseScore(count: number, unit = 15, max = 85): number {
  return clampScore(Math.min(max, count * unit));
}

export function calculateOverallPriorityScore(
  scores: Omit<CandidateScores, 'overallPriorityScore'>,
  weights: ScoreWeights = DEFAULT_MARKETA_SCORE_WEIGHTS,
): number {
  const positive =
    scores.strategicFitScore * weights.strategicFitScore +
    scores.aigentmeFitScore * weights.aigentmeFitScore +
    scores.marketaMultiplierScore * weights.marketaMultiplierScore +
    scores.cleanRevenuePotentialScore * weights.cleanRevenuePotentialScore +
    scores.trustReadinessScore * weights.trustReadinessScore +
    scores.passportReadinessScore * weights.passportReadinessScore;
  const penalty = scores.riskScore * weights.riskScore;
  return clampScore(positive - penalty);
}

export function scoreCandidate(
  input: CandidateAgentInput,
  weights: ScoreWeights = DEFAULT_MARKETA_SCORE_WEIGHTS,
): CandidateScores {
  const classification = classifyCandidate(input);
  const screen = cleanRevenueScreen(input);
  const capabilities = input.capabilities ?? [];
  const urls = [input.agentCardUrl, input.mcpServerUrl, input.openapiUrl, input.repositoryUrl, input.websiteUrl, input.sourceUrl]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const strategicFitScore = baseScore(classification.strategicLanes.length + classification.verticals.length, 10, 95);
  const aigentmeFitScore = classification.strategicLanes.includes('aigentme_chief_of_staff')
    ? clampScore(55 + capabilities.length * 5)
    : baseScore(capabilities.length, 8, 60);
  const marketaMultiplierScore = classification.strategicLanes.includes('media_communications_public_affairs')
    ? clampScore(55 + capabilities.length * 4)
    : baseScore((input.targetUsers ?? []).length, 8, 55);
  const cleanRevenuePotentialScore = screen.status === 'rejected'
    ? 10
    : clampScore(
        25 +
        (classification.legalTrack === 'high_yield_legal' || classification.legalTrack === 'both' ? 25 : 0) +
        (classification.topBottomRelevance.supportsExecMobility ? 20 : 0) +
        (classification.strategicLanes.includes('agentic_ai_blockchain_infrastructure') ? 15 : 0) +
        (classification.verticals.includes('founder_operator_services') ? 10 : 0),
      );
  const trustReadinessScore = clampScore(
    20 +
    urls.length * 8 +
    (input.operatorName ? 15 : 0) +
    (input.agentCardUrl ? 15 : 0) +
    (input.repositoryUrl ? 8 : 0),
  );
  const passportReadinessScore = clampScore(
    15 +
    (input.agentCardUrl ? 25 : 0) +
    (input.mcpServerUrl ? 15 : 0) +
    (input.openapiUrl ? 15 : 0) +
    (input.operatorName ? 15 : 0) +
    (capabilities.length > 0 ? 10 : 0),
  );
  const technicalIntegrationScore = clampScore(
    10 +
    (input.mcpServerUrl ? 25 : 0) +
    (input.openapiUrl ? 25 : 0) +
    (input.repositoryUrl ? 20 : 0) +
    (input.agentCardUrl ? 20 : 0),
  );
  const policyAlignmentScore = screen.status === 'likely_clean'
    ? 85
    : screen.status === 'needs_review'
      ? 55
      : 20;
  const riskScore = clampScore(screen.riskFlags.length * 18 + screen.policyFlags.length * 8);

  const partial = {
    strategicFitScore,
    aigentmeFitScore,
    marketaMultiplierScore,
    cleanRevenuePotentialScore,
    trustReadinessScore,
    passportReadinessScore,
    technicalIntegrationScore,
    policyAlignmentScore,
    riskScore,
  };

  return {
    ...partial,
    overallPriorityScore: calculateOverallPriorityScore(partial, weights),
  };
}
