/**
 * /api/invariants/discovery — Invariant Discovery Engine (CFS-048 Phase 0).
 *
 * GET  ?domain=financial-services  → { evidence[], candidates[] }
 * POST { action }                  → admin/steward-gated:
 *        add-evidence  { domain, title, sourceKind, content, sourceRef? }
 *        extract       { domain }   — run constitutional discovery → candidates
 *        promote       { candidateId } — land candidate as `proposed` in canon
 *        reject        { candidateId }
 *
 * The discovery workspace is a LABORATORY surface — admin-gated (the internal
 * IRL edition). Promotion never canonises; it lands at `proposed` for the
 * validation harness (inv.reasoning.337).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  addEvidence,
  listEvidence,
  listCandidates,
  runConstitutionalDiscovery,
  compareSubDomains,
  compressDomainInvariants,
  materializeCompressionEdges,
  suggestParents,
  suggestClassification,
  promoteCandidate,
  linkPromotedParents,
  rejectCandidate,
  type EvidenceKind,
} from '@/services/invariants/discoveryEngine';
import { suggestProvenanceClass } from '@/services/invariants/provenanceSuggestion';
import {
  DISCOVERY_DOMAINS,
  DEFAULT_DISCOVERY_DOMAIN,
  discoveryDomain,
  discoveryNamespace,
  subDomainPresets,
} from '@/services/invariants/discoveryDomains';
import { listInvariants, getInvariantById, updateInvariant } from '@/services/invariants/store';
import {
  CLASSIFICATION_CHECKS,
  PERMITTED_UNCLASSIFIED_USES,
  RESTRICTED_INVARIANT_USES,
  buildClassificationQueue,
  canUseInvariantFor,
  applyProvenanceReclassification,
  deriveFieldOrigin,
} from '@/services/research/experimentalPopulations';
import { personaPublicRef } from '@/services/identity/personaReferences';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Domain list, default, and sub-domain presets are DERIVED from the Discovery
// Domain Registry (PRD-IDE-002). They used to be hand-maintained literals here
// AND in two client surfaces — three copies of one list, the stale-duplicate
// defect `tests/source-of-truth-parity.test.ts` exists to catch.
const DEFAULT_DOMAIN = DEFAULT_DISCOVERY_DOMAIN;

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const params = new URL(req.url).searchParams;
  const domain = params.get('domain')?.trim() || DEFAULT_DOMAIN;
  const subDomain = params.get('subDomain')?.trim() || null;
  const namespace = discoveryNamespace(domain);
  const [evidence, candidates, promoted] = await Promise.all([
    listEvidence(admin, domain, subDomain),
    listCandidates(admin, domain, subDomain),
    // The classification queue's input. Scoped to the domain's namespace, which
    // is what `promoteCandidate` resolved when it landed the record — so the
    // namespace check below compares like with like.
    listInvariants({ namespace, limit: 200 }).catch(() => [] as Awaited<ReturnType<typeof listInvariants>>),
  ]);
  // "Safe should not become finished" (operator ruling 2026-07-28). Promotion is
  // fail-closed — every promoted invariant lands unclassified, in NO population.
  // That is correct and deliberately unchanged; what it must not be is invisible.
  const classificationQueue = buildClassificationQueue(
    promoted.map((inv) => ({
      id: inv.id, statement: inv.statement, namespace: inv.namespace,
      status: inv.status, provenance: inv.provenance as Record<string, unknown> | null,
    })),
    // The Discovery Domain Registry is the authority on domain → namespace; the
    // queue never forks that mapping.
    (record) => {
      const recordDomain = (record.provenance?.domain ?? null) as string | null;
      return recordDomain ? discoveryNamespace(recordDomain) : null;
    },
  );
  const registered = discoveryDomain(domain);
  return NextResponse.json(
    {
      ok: true,
      domain,
      subDomain,
      subDomainPresets: subDomainPresets(domain),
      // The registry, projected for the surface's domain picker + the
      // observed-domain legend a horizontal domain's recurrence scores need.
      domains: DISCOVERY_DOMAINS.map((d) => ({ key: d.key, label: d.label, kind: d.kind })),
      domainKind: registered?.kind ?? null,
      domainDefinition: registered?.definition ?? null,
      observedIn: registered ? [...registered.observedIn] : [],
      // BOUNDED PAYLOAD (2026-07-28 regression: "Commercialisation docs are now
      // showing FS docs").
      //
      // This list carried every evidence row's FULL `content`. Acquired
      // institutional documents run to 200k chars each, and a 1.3M-char World
      // Bank report chunks into several rows — so once the operator ingested a
      // real corpus, the response blew the Lambda 6MB cap and returned an EMPTY
      // body. The client's `JSON.parse` then threw ("unexpected end of data at
      // line 1 column 1"), `load()` bailed before `setEvidence`, and the panel
      // went on rendering the PREVIOUS domain's rows under the new domain's
      // heading — Financial Services evidence displayed as Commercialisation.
      // The cross-domain contamination was never a domain-resolution bug; the
      // read model was correct and the transport was too large to arrive.
      //
      // The surface renders only `content.length`, so the content itself is
      // dead weight on this route. Sending the LENGTH instead is exactly the
      // same fix already applied to the candidate-sources list, and it is
      // confined to this projection: `listDomainEvidence` still returns full
      // content to extraction, compare, and compression, which genuinely need
      // the text.
      evidence: evidence.map(({ content, ...rest }) => ({
        ...rest,
        contentChars: content.length,
        content: '',
      })),
      candidates,
      classificationQueue,
      // The six checks are carried from the ruling's own list rather than
      // restated in the client (inv.engineering.036), and the prohibition is
      // reported as the GATE'S OWN reason strings — not prose written beside
      // it that could drift from what the gate actually refuses.
      classificationChecks: CLASSIFICATION_CHECKS,
      unclassifiedProhibitions: RESTRICTED_INVARIANT_USES.map((use) => {
        const gate = canUseInvariantFor({ provenance: null, status: 'proposed' }, use);
        return { use, reason: gate.allowed ? null : gate.reason };
      }),
      permittedUnclassifiedUses: PERMITTED_UNCLASSIFIED_USES,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    domain?: string;
    subDomain?: string;
    title?: string;
    sourceKind?: EvidenceKind;
    content?: string;
    sourceRef?: string;
    candidateId?: string;
    parentInvariantIds?: string[];
    // The classify / suggest-classification fields. Declared rather than read
    // off an undeclared property, so the shape this route accepts is readable
    // in one place.
    invariantId?: string;
    to?: string;
    rationale?: string;
    evidenceRefs?: unknown;
    // Declared (2026-08-30 incident) alongside the other classify fields —
    // never a defaulted/inferred value; applyProvenanceReclassification
    // refuses anything but one of the two ratified dispositions.
    classDisposition?: string;
    acceptedRecommendation?: unknown;
  };
  const domain = body.domain?.trim() || DEFAULT_DOMAIN;
  const subDomain = body.subDomain?.trim() || null;

  switch (body.action) {
    case 'add-evidence': {
      const r = await addEvidence(admin, {
        domain,
        subDomain: subDomain ?? undefined,
        title: String(body.title ?? ''),
        sourceKind: (body.sourceKind ?? 'other'),
        content: String(body.content ?? ''),
        sourceRef: body.sourceRef,
        personaId: persona.personaId,
      });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'extract': {
      const r = await runConstitutionalDiscovery(admin, domain, { subDomain });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'compare': {
      // Cross-sub-domain compression → earned domain-level candidates (Phase 2).
      const r = await compareSubDomains(admin, domain);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'compress-domain': {
      // Recursive compression — PROPOSE the derivation structure (roots vs
      // derived, with typed parent edges) among the domain's earned invariants.
      // Proposals only — nothing is inserted into the graph here.
      const r = await compressDomainInvariants(admin, domain);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'materialize-edges': {
      // OPERATOR-CONFIRMED materialisation of a derived candidate's proposed
      // typed edges into the invariant graph (child + parents must be promoted).
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const r = await materializeCompressionEdges(admin, body.candidateId);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'suggest-parents': {
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const suggestions = await suggestParents(admin, body.candidateId);
      return NextResponse.json({ ok: true, suggestions });
    }
    case 'promote': {
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const parentIds = Array.isArray(body.parentInvariantIds) ? body.parentInvariantIds.filter((x) => typeof x === 'string') : [];
      const r = await promoteCandidate(admin, body.candidateId, { personaId: persona.personaId }, parentIds);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'link-parents': {
      // Retro-link an already-promoted sub-domain invariant to its domain parents.
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const parentIds = Array.isArray(body.parentInvariantIds) ? body.parentInvariantIds.filter((x) => typeof x === 'string') : [];
      const r = await linkPromotedParents(admin, body.candidateId, parentIds);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'reject': {
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const r = await rejectCandidate(admin, body.candidateId);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'suggest-classification': {
      // PRE-POPULATION for the classify form (operator, 2026-07-28: "the URL
      // and rationale for inclusion was provided with the sources… use that to
      // pre-populate these fields rather than having the operator re-enter
      // them from scratch"). Modelled on `suggest-parents`, deliberately:
      //
      //  · A POST ACTION, not an enrichment of the GET's classificationQueue.
      //    That GET already blew the Lambda 6MB cap once and had to be bounded
      //    (see the BOUNDED PAYLOAD note above) — folding each entry's resolved
      //    source titles, reviewer notes and acquisition claims back into it
      //    would push text into the exact response that failed, and would do
      //    the resolution work for every queue entry including the ones the
      //    operator never opens. `suggest-parents` has the same shape: fired
      //    on demand when a panel opens, for ONE record.
      //  · A SUGGESTION, not an act. It writes nothing and does not submit.
      //    The operator's submit stays the constitutional act (PRD-ICA-001
      //    §6/§11), and every refusal in applyProvenanceReclassification
      //    still runs on it — an accepted suggestion that resolved only
      //    repo-internal citations is still refused on the way into
      //    Population A.
      //
      //  · `classSuggestion` (operator direction, 2026-08-05: "the steward
      //    should never begin with a blank form when the substrate can
      //    derive a reasonable proposal") — a REVIEWABLE proposal of the
      //    class itself, on top of `suggestion`'s existing evidence/rationale
      //    pre-fill. This does NOT relax `suggestClassification`'s own
      //    restraint (it still reports `recordedProvenanceClass` as context
      //    only, never preselecting) — it is a SEPARATE, explicitly reviewed
      //    layer the steward must still Accept, Edit or Reject; nothing here
      //    writes a class. `null` when there is no resolved evidence to
      //    reason from at all — never a guess.
      const invariantId = typeof body.invariantId === 'string' ? body.invariantId.trim() : '';
      if (!invariantId) return NextResponse.json({ ok: false, error: 'invariantId required' }, { status: 400 });
      const invariant = await getInvariantById(invariantId);
      if (!invariant) return NextResponse.json({ ok: false, error: `invariant '${invariantId}' not found` }, { status: 404 });
      const suggestion = await suggestClassification(admin, invariantId, invariant.provenance);
      const classResult = await suggestProvenanceClass({ id: invariantId, statement: invariant.statement }, suggestion);
      return NextResponse.json({
        ok: true,
        suggestion,
        classSuggestion: classResult.ok ? classResult.suggestion : null,
        classSuggestionError: classResult.ok ? null : classResult.error,
      });
    }
    case 'classify': {
      // THE EXIT FROM `unclassified` (operator, 2026-07-28: the same block the
      // Financial Services cross-referenced invariants hit).
      //
      // `CLASSIFICATION_CHECKS` has always NAMED `applyProvenanceReclassification`
      // as the way to satisfy the provenance check, and that function has always
      // refused a class change without evidence refs and a rationale. What did
      // not exist was any CALLER: no route action, no UI control, anywhere in the
      // codebase. So the steward queue could be rendered and never cleared, and
      // every promoted invariant stayed in NO experimental population — barred
      // from canon entry, ratification, and confirmatory treatment — with no
      // door out. A checklist whose only satisfying act is unreachable is
      // doctrine, not machinery (Composed Liveness, corollary 4).
      //
      // This action is the door. It does NOT relax a single rule: the refusals
      // (unratified class, no evidence refs, blank rationale, no-op reclass, and
      // the anti-laundering check that a move into Population A must cite at
      // least one non-repo-internal source) all still run inside
      // applyProvenanceReclassification. The route only supplies a caller and
      // persists the bag the function returns, preserving the append-only
      // reclassification log so the prior class and the evidence that moved it
      // both stay readable.
      const invariantId = typeof body.invariantId === 'string' ? body.invariantId.trim() : '';
      const to = typeof body.to === 'string' ? body.to : '';
      const rationale = typeof body.rationale === 'string' ? body.rationale : '';
      const evidenceRefs = Array.isArray(body.evidenceRefs)
        ? (body.evidenceRefs as unknown[]).filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        : [];
      // THE CONSTITUTIONAL ACT, DECLARED (2026-08-30, "Classify Provenance
      // completed by omission" incident). No default, no inference from a
      // client-omitted field — `applyProvenanceReclassification` itself
      // refuses anything but one of the two ratified dispositions, so an
      // absent/garbled value here is passed through UNCHANGED and lets that
      // ONE authoritative refusal speak, rather than this route guessing or
      // silently defaulting on its behalf.
      const classDisposition = typeof body.classDisposition === 'string' ? body.classDisposition : '';
      const acceptedRecommendationRaw = body.acceptedRecommendation as Record<string, unknown> | undefined;
      const acceptedRecommendation = acceptedRecommendationRaw
        ? {
            suggestedClass: typeof acceptedRecommendationRaw.suggestedClass === 'string' ? acceptedRecommendationRaw.suggestedClass : '',
            confidence: typeof acceptedRecommendationRaw.confidence === 'number' ? acceptedRecommendationRaw.confidence : NaN,
            primarySource: typeof acceptedRecommendationRaw.primarySource === 'string' ? acceptedRecommendationRaw.primarySource : null,
            supportingSources: Array.isArray(acceptedRecommendationRaw.supportingSources)
              ? (acceptedRecommendationRaw.supportingSources as unknown[]).filter((s): s is string => typeof s === 'string')
              : [],
            reason: typeof acceptedRecommendationRaw.reason === 'string' ? acceptedRecommendationRaw.reason : '',
          }
        : undefined;
      if (!invariantId) {
        return NextResponse.json({ ok: false, error: 'invariantId required' }, { status: 400 });
      }

      const invariant = await getInvariantById(invariantId);
      if (!invariant) {
        return NextResponse.json({ ok: false, error: `invariant '${invariantId}' not found` }, { status: 404 });
      }

      // WHERE THE SUBMITTED FIELDS CAME FROM. Once the form is pre-populated,
      // "the steward cited these URLs" and "the steward accepted the URLs the
      // system offered" stop being the same statement — and this log is read
      // later as the record of a human act. The distinction is DERIVED HERE by
      // recomputing the suggestion and comparing, never taken from the client:
      // a client-asserted `fieldOrigin` could claim 'operator' for a field it
      // pre-filled, which is precisely the fact this records.
      //
      // Fail-open on the ANNOTATION only. If the suggestion cannot be
      // recomputed, the classification still proceeds and `fieldOrigin` reads
      // as 'operator'/'operator'; a broken convenience must never block a
      // constitutional act. The gate itself stays fail-closed below.
      const fieldOrigin = deriveFieldOrigin(
        { evidenceRefs, rationale },
        await suggestClassification(admin, invariantId, invariant.provenance).catch(() => null),
      );

      const result = applyProvenanceReclassification(invariant.provenance, {
        to: to as Parameters<typeof applyProvenanceReclassification>[1]['to'],
        evidenceRefs,
        rationale,
        fieldOrigin,
        classDisposition: classDisposition as Parameters<typeof applyProvenanceReclassification>[1]['classDisposition'],
        ...(acceptedRecommendation ? { acceptedRecommendation } : {}),
        // WHO attested it. `actor` is documented as "a T2-safe commitment or
        // an agent id, NEVER a raw T0 id" — and this bag is durable, widely
        // read invariant provenance, so the raw personaId must not go in it.
        // personaPublicRef is the level-2 Polity Public Reference (the same
        // derivation the DVN pipeline uses), which is exactly this exposure
        // class.
        actor: personaPublicRef(persona.personaId),
        at: new Date().toISOString(),
      });
      if (!result.ok) {
        // The function's refusals are the ruling speaking. Surface the reason
        // verbatim rather than a generic 400 — a steward who cited only
        // repo-internal material needs to be told exactly that.
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }

      const updated = await updateInvariant(invariantId, { provenance: result.provenance });
      return NextResponse.json({
        ok: true,
        invariantId,
        from: result.from,
        to: result.to,
        namespace: updated.namespace,
      });
    }
    default:
      return NextResponse.json({ ok: false, error: 'action must be one of: add-evidence, extract, compare, compress-domain, materialize-edges, suggest-parents, promote, link-parents, reject, suggest-classification, classify' }, { status: 400 });
  }
}
