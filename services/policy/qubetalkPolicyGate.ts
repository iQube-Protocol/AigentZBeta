export interface QubeTalkReceiptPolicyContext {
  tenantId?: string;
  personaId?: string;
  rootDid?: string;
  policyTags?: string[];
  requiredIQubes?: string[];
  iqubeRefs?: string[];
  requiresVerifiedPersona?: boolean;
  requiresRootDid?: boolean;
}

export interface QubeTalkPolicyEvaluation {
  allowed: boolean;
  reasons: string[];
  tags: string[];
  smartTriad: {
    requiredIQubes: string[];
    matchedIQubes: string[];
    allowed: boolean;
  };
  diDQube: {
    personaRequired: boolean;
    rootDidRequired: boolean;
    personaPresent: boolean;
    rootDidPresent: boolean;
    rootDidValid: boolean;
    allowed: boolean;
  };
}

function normalizeTags(tags?: string[]): string[] {
  return (tags ?? [])
    .map((tag) => String(tag || '').trim().toLowerCase())
    .filter(Boolean);
}

function isValidRootDid(rootDid?: string): boolean {
  if (!rootDid) return false;
  return /^did:[a-z0-9]+:[A-Za-z0-9._:-]+$/.test(rootDid);
}

export function evaluateQubeTalkReceiptPolicy(
  context: QubeTalkReceiptPolicyContext
): QubeTalkPolicyEvaluation {
  const tags = normalizeTags(context.policyTags);
  const reasons: string[] = [];

  const requiredIQubes = (context.requiredIQubes ?? []).filter(Boolean);
  const iqubeRefs = new Set((context.iqubeRefs ?? []).filter(Boolean));
  const matchedIQubes = requiredIQubes.filter((required) => iqubeRefs.has(required));

  const blockedByTag = tags.includes('deny') || tags.includes('blocked') || tags.includes('forbidden');
  if (blockedByTag) {
    reasons.push('Blocked by policy tag.');
  }

  const hasIQubeRequirements = requiredIQubes.length > 0;
  const missingIQubeCoverage = hasIQubeRequirements && matchedIQubes.length === 0;
  if (missingIQubeCoverage) {
    reasons.push('Required SmartTriad iQube references are missing.');
  }

  const personaRequired =
    Boolean(context.requiresVerifiedPersona) ||
    tags.includes('persona_required') ||
    tags.includes('private');

  const rootDidRequired =
    Boolean(context.requiresRootDid) ||
    tags.includes('did_required') ||
    tags.includes('didqube_root_required') ||
    tags.includes('restricted');

  const personaPresent = Boolean(context.personaId);
  const rootDidPresent = Boolean(context.rootDid);
  const rootDidValid = isValidRootDid(context.rootDid);

  if (personaRequired && !personaPresent) {
    reasons.push('DiDQube persona is required for this receipt policy.');
  }

  if (rootDidRequired && !rootDidPresent) {
    reasons.push('DiDQube Root DID is required for this receipt policy.');
  }

  if (rootDidPresent && !rootDidValid) {
    reasons.push('DiDQube Root DID format is invalid.');
  }

  const smartTriadAllowed = !blockedByTag && !missingIQubeCoverage;
  const didQubeAllowed =
    (!personaRequired || personaPresent) &&
    (!rootDidRequired || (rootDidPresent && rootDidValid));

  return {
    allowed: smartTriadAllowed && didQubeAllowed,
    reasons,
    tags,
    smartTriad: {
      requiredIQubes,
      matchedIQubes,
      allowed: smartTriadAllowed,
    },
    diDQube: {
      personaRequired,
      rootDidRequired,
      personaPresent,
      rootDidPresent,
      rootDidValid,
      allowed: didQubeAllowed,
    },
  };
}
