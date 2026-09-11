/**
 * POST /api/skills/coherent-bundle — Invariant-Coherent Bundle Generation
 * (Studio skill). Operationalizes the EXP-001-proven capability: one invariant
 * substrate -> mutually-coherent assets, coherent by construction, with a
 * cheap deterministic coherence score fed back into the invariant engine.
 *
 * Actions:
 *   • default / { action:'generate' } — build the bundle (video plan + article
 *     from one shared brief). Spine-gated ONLY — a commercial Studio service,
 *     NOT experiment-quota-gated (generation does not spend judge credits).
 *     Emits receipts + operational tiering + invariant-engine feedback.
 *   • { action:'judge' } — the SEPARATE, opt-in fidelity judge over an already
 *     produced bundle. Metered via checkExperimentQuota (it spends credits).
 *     Never invoked by 'generate'; never mandatory.
 *   • { action:'redraft-article' } — remediation: re-draft the companion
 *     article from the same brief.
 *
 * T2-safe receipts: scores, counts, verdicts — never a persona identifier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { citeInvariants } from '@/services/invariants/grounding';
import { recordConsequence } from '@/services/invariants/lifecycle';
import { checkExperimentQuota } from '@/services/billing/experimentQuota';
import {
  providerAvailable,
  isAllowedExperimentModel,
  EXPERIMENT_MODEL_OPTIONS,
  type ExperimentProvider,
} from '@/services/experiments/llm';
import {
  buildCoherentBundle,
  type BundleAssetKind,
  type BundleCoherenceScore,
} from '@/services/skills/coherentBundleSkill';
import { judgeBundleFidelity, type JudgementReport, type JudgeDocument } from '@/services/skills/bundleJudgement';
import { draftArticleFromBrief } from '@/services/skills/videoArticleSkill';
import { alignArticleToBrief } from '@/services/content/alignmentService';
import type { VideoInvariantBrief, GroundingRef } from '@/services/video/invariantVideoBrief';
import { tierStudioArtifact, type StudioEvidenceFields } from '@/services/composer/studioArtifactTiering';
import type { ContentDirection, ConstitutionalCta, ConstitutionalDuration } from '@/services/skills/constitutionalVideoSkill';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Max foregrounded invariants we feed 'confirmed' consequence to per run. */
const FEEDBACK_CAP = 40;

/** Built-in coherence score -> T2-safe evidence for the artifact record. */
function builtInEvidence(coherence: BundleCoherenceScore, ref: string | null): StudioEvidenceFields {
  return {
    kind: 'coherence',
    method: 'coherence-score/built-in',
    ref,
    score: coherence.composite,
    pass: coherence.pass,
    detail: {
      briefCoherence: coherence.briefCoherence?.constitutionalScore ?? null,
      grammarViolations: coherence.grammar?.violations ?? undefined,
      articleAlignment: coherence.articleAlignment?.score ?? null,
    },
    judgedBy: null,
  };
}

/** Opt-in judgement -> T2-safe evidence. */
function judgeEvidence(report: JudgementReport, ref: string | null): StudioEvidenceFields {
  const counts = { preserved: 0, weakened: 0, contradicted: 0, absent: 0 };
  for (const v of report.perInvariant) counts[v.verdict] += 1;
  return {
    kind: 'experiment',
    method: 'judge/optional',
    ref,
    score: report.score,
    pass: report.pass,
    detail: { verdictCounts: counts, coherence: report.coherence?.coherence ?? null },
    judgedBy: report.judgedBy,
  };
}

function isProvider(v: unknown): v is ExperimentProvider {
  return v === 'anthropic' || v === 'openai' || v === 'venice';
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  const action = typeof body.action === 'string' ? body.action : 'generate';

  // ── Opt-in judge (metered — spends credits) ──
  if (action === 'judge') {
    const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
    const client = getSupabaseServer();
    if (!client && !isAdmin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    if (client) {
      const q = await checkExperimentQuota(client, persona.personaId, new Date(), isAdmin, 'SKILL-BUNDLE-JUDGE');
      if (!q.allowed) {
        return NextResponse.json({ ok: false, error: 'forbidden', message: q.reason ?? 'Judging spends credits — access required' }, { status: 403 });
      }
    }
    const provider = body.provider;
    if (!isProvider(provider) || !providerAvailable(provider)) {
      return NextResponse.json({ ok: false, error: 'provider must be an available anthropic|openai|venice' }, { status: 400 });
    }
    const model = typeof body.model === 'string' ? body.model : undefined;
    if (model && !isAllowedExperimentModel(provider, model)) {
      return NextResponse.json({ ok: false, error: 'model not allowed for provider' }, { status: 400 });
    }
    const documents = Array.isArray(body.documents) ? (body.documents as JudgeDocument[]) : [];
    const invariantIds = Array.isArray(body.invariant_ids) ? (body.invariant_ids as string[]) : [];
    if (documents.length === 0 || invariantIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'documents[] and invariant_ids[] are required' }, { status: 400 });
    }
    try {
      const report = await judgeBundleFidelity(provider, documents, invariantIds, model);
      const receipt = await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: 'studio',
        actionType: 'experience_render_validated',
        summary: `bundle judgement (opt-in) — score ${report.score} ${report.pass ? 'pass' : 'review'}, ${report.invariantCount} invariants, ${report.hallucinationFlags} untraceable`,
        contextShared: ['coherent-bundle', 'judgement'],
      }).catch(() => null);
      const tier = await tierStudioArtifact({
        kind: 'studio.bundle.judgement.completed',
        title: 'Bundle judgement',
        evaluation: judgeEvidence(report, receipt?.id ?? null),
      });
      return NextResponse.json({ ok: true, report, judgementReceiptId: receipt?.id ?? null, studioArtifactRecordId: tier.artifactRecordId ?? null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'judgement_failed';
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  // ── Remediation: re-draft the companion article from the same brief ──
  if (action === 'redraft-article') {
    const brief = body.brief as VideoInvariantBrief | undefined;
    if (!brief || !Array.isArray(brief.segments)) {
      return NextResponse.json({ ok: false, error: 'brief is required to redraft the article' }, { status: 400 });
    }
    try {
      const article = await draftArticleFromBrief(brief, typeof body.productionTitle === 'string' ? body.productionTitle : undefined, body.useLlm ?? true);
      const alignment = article.body
        ? alignArticleToBrief(brief.segments.map((s) => ({ index: s.index, beat: s.beat })), article.body)
        : null;
      return NextResponse.json({ ok: true, article, alignment });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'redraft_failed';
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  // ── Generate (default) — spine-gated, NOT quota-gated ──
  if (!Array.isArray(body.groundings) || body.groundings.length === 0) {
    return NextResponse.json({ ok: false, error: 'groundings must be a non-empty array' }, { status: 400 });
  }
  if (typeof body.contentDirection?.subject !== 'string' || !body.contentDirection.subject.trim()) {
    return NextResponse.json({ ok: false, error: 'contentDirection.subject is required — the bundle is a blank canvas' }, { status: 400 });
  }
  const assets = Array.isArray(body.assets) ? (body.assets as BundleAssetKind[]) : [];
  if (assets.length === 0) {
    return NextResponse.json({ ok: false, error: 'assets must name at least one asset kind' }, { status: 400 });
  }

  try {
    const bundle = await buildCoherentBundle({
      groundings: body.groundings as GroundingRef[],
      contentDirection: body.contentDirection as ContentDirection,
      assets,
      video: body.video as { durationSeconds: ConstitutionalDuration; cta: ConstitutionalCta } | undefined,
      articleSections: typeof body.articleSections === 'number' ? body.articleSections : undefined,
      productionTitle: typeof body.productionTitle === 'string' ? body.productionTitle : undefined,
      useLlm: body.useLlm,
    });

    const foregrounded = bundle.coherence.foregroundedInvariantIds;
    // Reach (Law XII): a production that consumes invariants is adoption.
    void citeInvariants(foregrounded).catch(() => {});

    const receipt = await createActivityReceipt({
      personaId: persona.personaId,
      activeCartridge: 'studio',
      actionType: 'artifact_created',
      summary: `coherent bundle — assets=${assets.join('+')} composite=${bundle.coherence.composite ?? 'n/a'} ${bundle.coherence.pass ? 'pass' : 'review'} invariants=${foregrounded.length} — "${bundle.brief.continuityBlock.slice(0, 60)}"`,
      contextShared: ['coherent-bundle', 'generate'],
    }).catch(() => null);

    // Invariant-engine feedback (the operator's "score rides along as
    // feedback"): a PASSING coherent bundle confirms its foregrounded
    // invariants. Confirmed-only, bounded, fire-and-forget — a failed
    // generation is evidence about the generator, never against the invariant.
    const invariantFeedback = body.invariantFeedback !== false;
    if (invariantFeedback && bundle.coherence.pass) {
      for (const id of foregrounded.slice(0, FEEDBACK_CAP)) {
        void recordConsequence(id, 'confirmed', {
          ref: receipt?.id ?? undefined,
          note: `coherent bundle produced — composite=${bundle.coherence.composite ?? 'n/a'}`,
        }).catch(() => {});
      }
    }

    const tier = await tierStudioArtifact({
      kind: 'studio.bundle.coherent.completed',
      title: bundle.videoPlan?.contentDirection.subject.slice(0, 120) ?? (body.contentDirection.subject as string).slice(0, 120),
      prompt: body.contentDirection.subject,
      brief: bundle.brief.continuityBlock,
      segments: bundle.segmentCount,
      evaluation: builtInEvidence(bundle.coherence, receipt?.id ?? null),
    });

    return NextResponse.json({
      ok: true,
      bundleReceiptId: receipt?.id ?? null,
      studioArtifactRecordId: tier.artifactRecordId ?? null,
      ...bundle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'coherent_bundle_failed';
    console.error('[api/skills/coherent-bundle] generate failed:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
