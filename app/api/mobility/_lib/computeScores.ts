/**
 * Score computation for Mobility Activation Files.
 *
 * Capability Score (0–100): derived from capability_profile completeness +
 * founder/professional indicators.
 *
 * Continuity Score (0–100): derived from continuity_profile anchors —
 * prior schools, communities, networks.
 *
 * Recovery Velocity Class (RV-1 to RV-4): composite of capability +
 * financial runway + professional reactivation indicators.
 *
 * Risk levels (low/medium/high): per-domain risk derived from housing
 * budget/timeline, education deadlines, business complexity.
 */

interface ProfileSnapshot {
  capability_profile?: Record<string, unknown>;
  continuity_profile?: Record<string, unknown>;
  housing_profile?: Record<string, unknown>;
  financial_profile?: Record<string, unknown>;
  [key: string]: unknown;
}

interface Scores {
  capability_score: number;
  continuity_score: number;
  recovery_velocity_class: 'RV-1' | 'RV-2' | 'RV-3' | 'RV-4';
  standing_risk_level: 'low' | 'medium' | 'high';
  housing_risk_level: 'low' | 'medium' | 'high';
  education_risk_level: 'low' | 'medium' | 'high';
  business_continuity_risk: 'low' | 'medium' | 'high';
}

function countKeys(obj: Record<string, unknown> | undefined): number {
  if (!obj) return 0;
  return Object.values(obj).filter(v => v !== null && v !== undefined && v !== '').length;
}

export function computeScores(profile: ProfileSnapshot): Scores {
  const cap = profile.capability_profile as Record<string, unknown> | undefined;
  const con = profile.continuity_profile as Record<string, unknown> | undefined;
  const hou = profile.housing_profile as Record<string, unknown> | undefined;
  const fin = profile.financial_profile as Record<string, unknown> | undefined;

  // Capability score: how many capability fields populated + structured professional profile bonuses
  const capKeys = countKeys(cap);
  const isFounder = !!(cap?.founderExperience || cap?.entrepreneurialHistory || cap?.founderOperator === 'yes');
  const isO1 = !!(cap?.extraordinaryAbility || cap?.o1VisaHistory === 'current' || cap?.o1VisaHistory === 'prior');
  const hasRole = !!(cap?.role);
  const hasSector = !!(cap?.sector);
  // Bonus for a locked professional profile with verified facts
  const profProfile = cap?.professionalProfile as Record<string, unknown> | undefined;
  const hasProfProfile = profProfile?.principalApproved === true;
  const verifiedFactCount = hasProfProfile
    ? (['currentRoles', 'education', 'publications', 'patents', 'awards', 'extraordinaryAbilityIndicators'] as const)
        .reduce((n, k) => n + (Array.isArray(profProfile?.[k]) ? (profProfile![k] as unknown[]).filter((f: unknown) => (f as Record<string, unknown>).principalApproved).length : 0), 0)
    : 0;
  const capScore = Math.min(100,
    capKeys * 6 +
    (isFounder ? 15 : 0) +
    (isO1 ? 15 : 0) +
    (hasRole ? 5 : 0) +
    (hasSector ? 5 : 0) +
    (hasProfProfile ? 10 : 0) +
    Math.min(10, verifiedFactCount * 2),
  );

  // Continuity score: prior community + school + professional anchors
  const conKeys = countKeys(con);
  const hasPriorUK = !!(con?.previousCommunities || con?.previousSchools || con?.geographicFamiliarity);
  const conScore = Math.min(100, conKeys * 10 + (hasPriorUK ? 25 : 0));

  // Recovery velocity: composite
  const rvScore = capScore * 0.6 + conScore * 0.4;
  let recoveryVelocity: 'RV-1' | 'RV-2' | 'RV-3' | 'RV-4';
  if (rvScore >= 75) recoveryVelocity = 'RV-1';
  else if (rvScore >= 50) recoveryVelocity = 'RV-2';
  else if (rvScore >= 25) recoveryVelocity = 'RV-3';
  else recoveryVelocity = 'RV-4';

  // Housing risk: based on budget presence and timeline urgency
  const hasHousingBudget = !!(hou?.housingBudget);
  const hasGuarantor = !!(hou?.guarantorsAvailable);
  const housingRisk: 'low' | 'medium' | 'high' =
    hasHousingBudget && hasGuarantor ? 'low' :
    hasHousingBudget ? 'medium' : 'high';

  // Standing risk: high-profile founder = standing preservation priority
  const standingRisk: 'low' | 'medium' | 'high' =
    isO1 || isFounder ? 'medium' : 'low';

  // Education risk: improved when structured children with target schools are present
  const eduProfile = profile.education_profile as Record<string, unknown> | undefined;
  const children = Array.isArray(eduProfile?.children) ? eduProfile!.children as Record<string, unknown>[] : [];
  const hasStructuredChildren = children.length > 0;
  const hasTargetSchools = children.some(c => !!(c as Record<string, unknown>).targetSchool);
  const educationRisk: 'low' | 'medium' | 'high' =
    hasTargetSchools ? 'medium' :
    hasStructuredChildren ? 'medium' : 'high';

  // Business continuity risk: based on complexity
  const bizProfile = profile.business_profile as Record<string, unknown> | undefined;
  const bizKeys = countKeys(bizProfile);
  const businessRisk: 'low' | 'medium' | 'high' =
    bizKeys === 0 ? 'low' :
    bizKeys < 4 ? 'medium' : 'high';

  return {
    capability_score: Math.round(capScore),
    continuity_score: Math.round(conScore),
    recovery_velocity_class: recoveryVelocity,
    standing_risk_level: standingRisk,
    housing_risk_level: housingRisk,
    education_risk_level: educationRisk,
    business_continuity_risk: businessRisk,
  };
}
