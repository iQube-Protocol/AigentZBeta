/**
 * TrustScoringService — computes a numeric trust score and assigns a TrustBand.
 *
 * Trust factors:
 * - provenanceQuality:       Is origin known and verifiable?
 * - licenseClarity:          Is license clearly identified and compatible?
 * - maintenancePosture:      Is the source actively maintained?
 * - dependencyRisk:          How well are dependencies managed? (inverted: 1 = low risk)
 * - privilegeFootprint:      How minimal is the privilege requirement? (inverted: 1 = minimal)
 * - validationPassQuality:   How well did validation stages pass?
 * - reproducibility:         Is execution deterministic and reproducible?
 * - wrapperIsolationQuality: How well is the asset isolated in its wrapper?
 *
 * Hard caps from validation results are applied after scoring.
 */

import {
  createTrustScore,
  updateAsset,
  getAsset,
  getValidation,
  listArtifactsForValidation,
} from "./persistence";
import { emitReceipt } from "./receiptEmitter";
import {
  TrustBand,
  TrustFactors,
  TrustScore,
  trustBandFromScore,
  applyTrustCaps,
  PolicyClass,
  WrapperStrategy,
  ValidationStageResult,
} from "@/types/registryIngestion";

function generateId(): string {
  return `score_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Factor weights — must sum to 1.0 */
const WEIGHTS: Record<keyof TrustFactors, number> = {
  provenanceQuality:      0.15,
  licenseClarity:         0.20,
  maintenancePosture:     0.10,
  dependencyRisk:         0.10,
  privilegeFootprint:     0.15,
  validationPassQuality:  0.20,
  reproducibility:        0.05,
  wrapperIsolationQuality: 0.05,
};

export interface ScorerResult {
  ok: boolean;
  score?: TrustScore;
  error?: string;
}

export async function scoreAsset(
  assetId: string,
  validationId: string,
  actorId: string
): Promise<ScorerResult> {
  const [asset, validation] = await Promise.all([
    getAsset(assetId),
    getValidation(validationId),
  ]);

  if (!asset) return { ok: false, error: `Asset not found: ${assetId}` };
  if (!validation) return { ok: false, error: `Validation not found: ${validationId}` };

  const artifacts = await listArtifactsForValidation(validationId);
  const factors = computeFactors(asset, validation.stagesCompleted, artifacts);
  const numericScore = computeNumericScore(factors);
  const baseBand = trustBandFromScore(numericScore);

  // Collect caps from validation artifacts
  const caps = [
    validation.trustBandCap,
    ...artifacts.map((a) => a.capTrustBand),
  ].filter((c): c is TrustBand => !!c);

  const trustBand = applyTrustCaps(baseBand, caps);

  const explanation = buildExplanation(factors, numericScore, baseBand, trustBand, caps);

  const score = await createTrustScore({
    scoreId: generateId(),
    assetId,
    validationId,
    trustBand,
    numericScore,
    factors,
    explanation,
    computedBy: "system",
  });

  // Update asset trust band
  await updateAsset(assetId, { trustBand });

  await emitReceipt({
    eventType: "trust.assigned",
    actorId,
    tenantId: asset.tenantId ?? "system",
    assetId,
    payload: {
      scoreId: score.scoreId,
      trustBand,
      numericScore,
      factors,
    },
  });

  return { ok: true, score };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor computation
// ─────────────────────────────────────────────────────────────────────────────

function computeFactors(
  asset: { policyClass: PolicyClass; wrapperStrategy: WrapperStrategy; metadata: Record<string, unknown>; capabilities: unknown[] },
  stages: ValidationStageResult[],
  artifacts: Array<{ stage: string; passed?: boolean; capTrustBand?: TrustBand }>
): TrustFactors {
  const manifest = (asset.metadata?.sourceManifest ?? {}) as Record<string, unknown>;

  // provenanceQuality: has repository + author
  const hasRepo = typeof manifest.repository === "string" && manifest.repository.length > 0;
  const hasAuthor = typeof manifest.author === "string" && manifest.author.length > 0;
  const provenanceQuality = hasRepo && hasAuthor ? 1.0 : hasRepo || hasAuthor ? 0.6 : 0.2;

  // licenseClarity: license detected and non-empty
  const licenseArtifact = artifacts.find((a) => a.stage === "license_check");
  const licenseClarity = licenseArtifact?.passed ? 1.0 : licenseArtifact ? 0.0 : 0.3;

  // maintenancePosture: has version pinned
  const hasVersion = typeof manifest.version === "string" && manifest.version.trim().length > 0;
  const maintenancePosture = hasVersion ? 0.7 : 0.3;

  // dependencyRisk: few dependencies is lower risk (inverted)
  const deps = (manifest.dependencies as Record<string, string>) ?? {};
  const depCount = Object.keys(deps).length;
  const dependencyRisk = depCount === 0 ? 1.0 : depCount <= 5 ? 0.8 : depCount <= 20 ? 0.6 : 0.4;

  // privilegeFootprint: based on policy class (inverted — lower privilege = higher score)
  const privilegeMap: Record<PolicyClass, number> = {
    read_only: 1.0,
    network_limited: 0.8,
    sandbox_exec: 0.6,
    browser_operator: 0.5,
    secret_bound: 0.4,
    human_approval_required: 0.3,
  };
  const privilegeFootprint = privilegeMap[asset.policyClass] ?? 0.5;

  // validationPassQuality: fraction of stages that passed
  const passed = stages.filter((s) => s.status === "passed").length;
  const total = stages.length || 1;
  const validationPassQuality = passed / total;

  // reproducibility: version pinned
  const reprArtifact = artifacts.find((a) => a.stage === "reproducibility");
  const reproducibility = reprArtifact?.passed ? 1.0 : 0.3;

  // wrapperIsolationQuality: based on wrapper strategy
  const wrapperMap: Record<WrapperStrategy, number> = {
    http: 0.7,
    cli_container: 0.9,
    mcp: 0.7,
    browser: 0.6,
    skill: 0.9,
    workflow: 0.8,
  };
  const wrapperIsolationQuality = wrapperMap[asset.wrapperStrategy] ?? 0.7;

  return {
    provenanceQuality,
    licenseClarity,
    maintenancePosture,
    dependencyRisk,
    privilegeFootprint,
    validationPassQuality,
    reproducibility,
    wrapperIsolationQuality,
  };
}

function computeNumericScore(factors: TrustFactors): number {
  const raw = (Object.keys(WEIGHTS) as Array<keyof TrustFactors>).reduce((sum, key) => {
    return sum + factors[key] * WEIGHTS[key] * 100;
  }, 0);
  return Math.round(Math.max(0, Math.min(100, raw)) * 100) / 100;
}

function buildExplanation(
  factors: TrustFactors,
  numeric: number,
  base: TrustBand,
  final: TrustBand,
  caps: TrustBand[]
): string {
  const lines = [
    `Numeric score: ${numeric}/100`,
    `Base band: ${base}${final !== base ? ` → capped to ${final}` : ""}`,
  ];
  if (caps.length > 0) {
    lines.push(`Caps applied: ${caps.join(", ")}`);
  }
  lines.push("Factor breakdown:");
  for (const [k, v] of Object.entries(factors)) {
    lines.push(`  ${k}: ${(v * 100).toFixed(0)}%`);
  }
  return lines.join("\n");
}
