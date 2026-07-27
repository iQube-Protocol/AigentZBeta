/**
 * Capability-completion canaries — CCR-001 §21.
 *
 * CCR-001's Law: *"Every material computational capability must conclude in a
 * versioned artifact that preserves its behavioural definition, operating
 * location, invocation method, reproduction conditions, discovered invariants
 * and executable proofs."* A law with no canary is doctrine, and this repo's
 * own retrospective (IRL-017 §2.3) found that **the gap was enforcement, not
 * doctrine** — three same-day defects all violated an ALREADY-canonical
 * invariant. So the standard ships with its enforcement in the same change.
 *
 * These run against the FIRST completion artifact —
 * `codexes/packs/agentiq/updates/2026-07-27_companion-menu-system-invariants.md`
 * — and against the schema itself. The artifact's markdown is the source of
 * truth (CFS-049 §5); the machine-readable shape is DERIVED from it by
 * `parseCompletionArtifact`, so these canaries read exactly the bytes an
 * operator reads. There is no JSON mirror to go stale.
 *
 * IMPLEMENTED HERE: CAN-CCR-2, -3, -4, -5, -8, and the disk-resolution HALF of
 * CAN-CCR-7.
 *
 * DEFERRED, and honestly named rather than faked (a canary that passes while
 * the defect is present is worse than no canary — this repo was bitten twice
 * by exactly that this week):
 *  - **CAN-CCR-1** (no PRD closed without a completion artifact). Needs
 *    machine-readable PRD lifecycle metadata. PRD status today is prose in a
 *    bolded line (`**… Status: RATIFIED …**`) in
 *    `codexes/packs/irl/foundation/PRD-*.md`, with no completion state and no
 *    artifact link. Would need: a PRD front-matter or table field carrying
 *    `status` and `completionArtifact`, then a canary asserting no PRD reaches
 *    a closed status without a resolvable artifact path.
 *  - **CAN-CCR-6** (a new defect maps to an existing invariant or creates a
 *    candidate). Needs PR-level defect metadata. The PR template now CARRIES
 *    the question (§13.2, shipped in this change) but nothing machine-reads a
 *    merged PR body in test time. Would need: the PR-brief ingestion path
 *    (`codexes/packs/aigency/items/build_/`) to emit the mapping as data, then
 *    a canary over that data.
 *  - **CAN-CCR-7** (an artifact must remain ATTACHED to the live capability —
 *    a stale artifact is a constitutional defect). Only its dangling-reference
 *    half is implementable now, and is implemented below. Detecting an artifact
 *    that has gone stale *relative to shipped behaviour* needs a content
 *    commitment recorded at registration and re-derived at check time — i.e.
 *    CFS-032 Phase 4 registry linkage, which is not in this pass's scope.
 *
 * NOT IMPLEMENTED, DELIBERATELY: CCR-001 §9's six-stage invariant lifecycle. It
 * conflicts with `FINDING_LIFECYCLE` in `types/research.ts`, whose ORDER is
 * pinned constitutional data (`inv.constitutional.078`). CCR-001 §25 records
 * this as an OPEN OPERATOR DECISION; the last canary in this file pins the
 * decision OPEN so a future change cannot resolve it by accident.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readSource } from './_lib/sourceAuthority';
import {
  parseCompletionArtifact,
  validateCompletionArtifact,
  declaredProofPaths,
  readsAsBehaviour,
} from '../services/constitutional/capabilityCompletionArtifact';
import {
  CAPABILITY_COMPLETION_SCHEMA_VERSION,
  COMPLETION_LIFECYCLE,
  INVARIANT_PROVENANCE_KINDS,
  INVARIANT_STATUSES,
  EVIDENCED_STATUSES,
  UNEVIDENCED_PROVENANCE,
  mapCompletionStage,
  type CapabilityCompletionArtifact,
} from '../types/capabilityCompletion';
// Pinned canon, read never written — `types/research.ts` is not modified here.
import { FINDING_LIFECYCLE } from '../types/research';

const ARTIFACT_PATH =
  'codexes/packs/agentiq/updates/2026-07-27_companion-menu-system-invariants.md';
const TEMPLATE_PATH =
  'codexes/packs/aigency/items/build_/templates/CAPABILITY_COMPLETION_ARTIFACT_TEMPLATE.md';

const source = readSource(ARTIFACT_PATH);
const artifact = parseCompletionArtifact(source);

/** Deep clone so a mutation control cannot leak into the next assertion. */
const clone = (): CapabilityCompletionArtifact =>
  JSON.parse(JSON.stringify(artifact)) as CapabilityCompletionArtifact;

/** The first backticked token of a list item — the path, not the gloss. */
const firstRef = (item: string): string | null => /`([^`]+)`/.exec(item)?.[1] ?? null;

const resolves = (repoRelative: string): boolean =>
  existsSync(join(process.cwd(), repoRelative));

// ───────────────────────────────────────────────────────────────────────────
// The artifact parses, and parses to something real
// ───────────────────────────────────────────────────────────────────────────

describe('the reference completion artifact (CCR-001 §17, the Companion menu system)', () => {
  it('parses and validates against capability-completion-artifact/v1.0', () => {
    const result = validateCompletionArtifact(artifact);
    expect(
      result.valid,
      `artifact is not constitutionally complete:\n${result.issues
        .map((i) => `  ${i.canary ? `[${i.canary}] ` : ''}${i.path}: ${i.message}`)
        .join('\n')}`,
    ).toBe(true);
  });

  it('parses the menu-system invariants as a complete MS-n run (guards a vacuous parse)', () => {
    // Every canary below is quantified over the parsed invariants. If the
    // parser silently returned [], they would all pass on nothing — the exact
    // false-green this file exists to prevent.
    //
    // WRITTEN AS A SHAPE, NOT A FROZEN LIST. This was `toEqual(['MS-1'..'MS-9'])`
    // and broke the moment MS-10 was legitimately added (2026-07-27) — an
    // exact list turns "the artifact grew" into "a canary failed", which is
    // noise, and re-pinning it to MS-10 would only move the same brittleness
    // to MS-11. What actually guards against a vacuous parse is that the ids
    // form a CONTIGUOUS RUN FROM MS-1 with no gaps and no duplicates: a parser
    // returning [], a subset, or garbage all fail that, while adding the next
    // invariant passes.
    const ids = artifact.reproductionInvariants.map((i) => i.id);
    expect(ids.length, 'no menu-system invariant parsed — every check below would be vacuous')
      .toBeGreaterThanOrEqual(9);
    expect(
      ids,
      'the parsed invariant ids must be a contiguous MS-1..MS-n run — a gap or a duplicate means the parse dropped or double-counted a section',
    ).toEqual(ids.map((_, i) => `MS-${i + 1}`));
    for (const inv of artifact.reproductionInvariants) {
      expect(inv.statement.length, `${inv.id} parsed no statement`).toBeGreaterThan(30);
    }
  });

  it('declares the identity the registry can join on (CFS-032 linkage)', () => {
    expect(artifact.schemaVersion).toBe(CAPABILITY_COMPLETION_SCHEMA_VERSION);
    expect(artifact.identity.capabilityId).toBe('companion-menu-system');
    expect(artifact.identity.artifactPath).toBe(ARTIFACT_PATH);
    expect(artifact.identity.governingDocuments).toContain('CCR-001');
  });

  it('states a boundary that can be violated — including what it does NOT own (§7.6)', () => {
    // Six of the nine defects were two things owning one thing. `doesNotOwn`
    // is the field that would have named the rule being broken, so an artifact
    // that omits it has recorded an unfalsifiable boundary.
    expect(artifact.boundary.owns.length).toBeGreaterThan(0);
    expect(artifact.boundary.doesNotOwn.length).toBeGreaterThan(0);
    expect(artifact.boundary.externalAuthorities.length).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CAN-CCR-2 — no validated invariant without provenance (CCR-INV-4)
// ───────────────────────────────────────────────────────────────────────────

describe('CAN-CCR-2 — every evidenced invariant retains its provenance', () => {
  it('each invariant names a §8 provenance kind', () => {
    for (const inv of artifact.reproductionInvariants) {
      expect(
        INVARIANT_PROVENANCE_KINDS as readonly string[],
        `${inv.id} carries provenance '${inv.provenance}', which is not in the §8 vocabulary`,
      ).toContain(inv.provenance);
    }
  });

  it('no validated or canonical invariant is left at the unevidenced kind', () => {
    for (const inv of artifact.reproductionInvariants) {
      if (!EVIDENCED_STATUSES.includes(inv.status)) continue;
      expect(
        inv.provenance,
        `${inv.id} claims status '${inv.status}' while its provenance is '${UNEVIDENCED_PROVENANCE}' — "we learned this somehow" is not provenance`,
      ).not.toBe(UNEVIDENCED_PROVENANCE);
      expect(
        inv.defect.length,
        `${inv.id} claims status '${inv.status}' but records no development-derived defect (§7.8)`,
      ).toBeGreaterThan(20);
    }
  });

  it('the validator REFUSES an evidenced invariant whose provenance was stripped', () => {
    // Negative control. Without this, the two assertions above would pass on a
    // parser that never populated `provenance` at all.
    const broken = clone();
    broken.reproductionInvariants[3].provenance = UNEVIDENCED_PROVENANCE;
    const result = validateCompletionArtifact(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.canary === 'CAN-CCR-2' && i.message.includes('MS-4'))).toBe(
      true,
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CAN-CCR-3 — no ratified invariant without enforcement (CCR-INV-5)
// ───────────────────────────────────────────────────────────────────────────

describe('CAN-CCR-3 — every canonical invariant is enforceable', () => {
  it('each canonical invariant names at least one executable proof', () => {
    const canonical = artifact.reproductionInvariants.filter((i) => i.status === 'canonical');
    // Guard the guard: if statuses stopped parsing, this set would be empty and
    // the loop would assert nothing. A LOWER BOUND, not an exact count — the
    // nine ratified at the time this canary shipped are the floor, and a new
    // invariant must not be able to fail this check merely by existing (it is
    // caught by the per-invariant assertion below instead, which is the part
    // that actually enforces CCR-INV-5).
    expect(canonical.length, 'no canonical invariant parsed — the check would be vacuous')
      .toBeGreaterThanOrEqual(9);
    for (const inv of canonical) {
      expect(
        inv.canaries.length,
        `${inv.id} is canonical but names no canary — a ratified invariant that nothing tests is a slogan`,
      ).toBeGreaterThan(0);
    }
  });

  it('the validator REFUSES a canonical invariant with no proof', () => {
    const broken = clone();
    broken.reproductionInvariants[0].canaries = [];
    const result = validateCompletionArtifact(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.canary === 'CAN-CCR-3' && i.message.includes('MS-1'))).toBe(
      true,
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CAN-CCR-4 — capability, not code location (CCR-INV-7)
// ───────────────────────────────────────────────────────────────────────────

describe('CAN-CCR-4 — the artifact describes behaviour, not merely where the code is', () => {
  it('the behavioural capability statement reads as behaviour', () => {
    expect(
      readsAsBehaviour(artifact.behaviouralCapabilityStatement),
      `the statement reads as a location list:\n${artifact.behaviouralCapabilityStatement}`,
    ).toBe(true);
  });

  it('the statement is not simply the Location section restated', () => {
    // The specific failure CCR-INV-7 names: an artifact that answers "where is
    // it" and calls that an answer to "what does it do".
    for (const item of artifact.location.sourcePaths) {
      const path = firstRef(item);
      if (!path) continue;
      expect(
        artifact.behaviouralCapabilityStatement,
        `the behavioural statement names the source path ${path} — that is location, not capability`,
      ).not.toContain(path);
    }
  });

  it('the validator REFUSES a statement made of code references', () => {
    const broken = clone();
    broken.behaviouralCapabilityStatement =
      'Implemented in `app/(embed)/triad/embed/companion/page.tsx`, ' +
      '`app/components/codex/CodexCopilotLayer.tsx` and `services/companion/companionNavigation.ts`.';
    const result = validateCompletionArtifact(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.canary === 'CAN-CCR-4')).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CAN-CCR-5 — no broken proof reference
// ───────────────────────────────────────────────────────────────────────────

describe('CAN-CCR-5 — every reference the artifact makes resolves on disk', () => {
  it('every declared canary file exists', () => {
    const paths = declaredProofPaths(artifact);
    expect(paths.length, 'no proof paths parsed — the check would be vacuous').toBeGreaterThan(2);
    for (const p of paths) {
      expect(resolves(p), `${p} is named as a proof but does not resolve on disk`).toBe(true);
    }
  });

  it('every source path the artifact locates the capability at exists', () => {
    // A doc naming a moved or deleted module is stale, and a stale artifact is
    // a constitutional defect (CCR-INV-11).
    // Lower bound for the same reason as the invariant-count guard above: this
    // exists to prove the parse is not empty, and an artifact that legitimately
    // names another module must not fail merely for naming it. The per-path
    // `resolves` assertion below is what actually enforces CCR-INV-11.
    const paths = artifact.location.sourcePaths.map(firstRef).filter((p): p is string => !!p);
    expect(paths.length, 'no source paths parsed').toBeGreaterThanOrEqual(4);
    for (const p of paths) {
      expect(resolves(p), `Location names ${p}, which does not resolve on disk`).toBe(true);
    }
  });

  it('every path-shaped Commons evidence reference exists', () => {
    const refs = artifact.commons.evidenceRefs.filter((r) => r.includes('/'));
    expect(refs.length, 'no path-shaped evidence references parsed').toBeGreaterThan(0);
    for (const r of refs) {
      expect(resolves(r), `Commons evidence names ${r}, which does not resolve on disk`).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CAN-CCR-7 (partial) — the artifact stays ATTACHED to the live capability
// ───────────────────────────────────────────────────────────────────────────

describe('CAN-CCR-7 (dangling-reference half) — no capability points at a Brief that is not there', () => {
  it('every briefUrl declared for registration resolves on disk', () => {
    // CFS-032's `briefUrl` is the single pointer from a registered capability
    // to its Brief. A dangling pointer is the crudest form of detachment, and
    // it is checkable today; the content-drift half needs a registration-time
    // commitment and is deferred (see the file header).
    const script = readSource('scripts/register-ccb-capabilities.ts');
    const urls = [...script.matchAll(/briefUrl:\s*"([^"]+)"/g)].map((m) => m[1]);
    // Lower bound, not an exact count: the guard exists so the loop below
    // cannot pass vacuously on a parse failure, and a canary that also freezes
    // the number fails on legitimate growth. Registering a new capability with
    // a brief (companion-menu-system, 2026-07-27) broke the exact-count form.
    expect(urls.length, 'no briefUrl parsed from the registration script').toBeGreaterThanOrEqual(3);
    for (const u of urls) {
      expect(resolves(u), `a capability is registered with briefUrl ${u}, which does not exist`).toBe(
        true,
      );
    }
  });

  it('the reference artifact is registered in the pack collection that surfaces it', () => {
    // An artifact nobody can reach is detached in the way that matters to a
    // reader (CFS-049 §5).
    const collections = readSource('codexes/packs/agentiq/collections.json');
    expect(JSON.parse(collections)).toBeTruthy();
    expect(collections).toContain('updates/2026-07-27_companion-menu-system-invariants.md');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CAN-CCR-8 — Commons publication preserves lineage (CCR-INV-10)
// ───────────────────────────────────────────────────────────────────────────

describe('CAN-CCR-8 — publication preserves lineage, and only governed proof enters', () => {
  it('the Commons record classifies itself and names its evidence', () => {
    // Principle 5 (Horizen audit Amendment E §E.3): a submission without
    // evidence references, a claim scope and an evidence posture is REFUSED.
    expect(artifact.commons.proofClass).toBe('constitutional');
    expect(artifact.commons.claimScope.length).toBeGreaterThan(40);
    expect(artifact.commons.evidenceRefs.length).toBeGreaterThan(0);
  });

  it('lineage traces back to the capability and the artifact that produced it', () => {
    expect(
      artifact.commons.lineage.capabilityId,
      'the Commons lineage names a different capability than the artifact does — a published proof would be untraceable to its source',
    ).toBe(artifact.identity.capabilityId);
    expect(
      artifact.commons.lineage.artifactPath,
      'the Commons lineage names a different artifact path than the identity block does',
    ).toBe(artifact.identity.artifactPath);
    expect(
      artifact.commons.lineage.sourceReferences.length,
      'publication drops the sources it was derived from',
    ).toBeGreaterThan(0);
  });

  it('nothing claims a publication that cannot have happened', () => {
    // `MetaCommonsResource` is not built (Horizen Phase 0 audit). An artifact
    // claiming `published: true` today would be asserting an approval no code
    // path can have written.
    expect(
      artifact.commons.published,
      'the artifact claims it is published, but the Commons resource model does not exist yet — no code path can have written that record',
    ).toBe(false);
    expect(
      artifact.commons.approvalRecordRef,
      'an ApprovalRecord is claimed for a submission that was never made',
    ).toBeNull();
  });

  it('the validator REFUSES lineage that has drifted from the identity', () => {
    const broken = clone();
    broken.commons.lineage.capabilityId = 'metame-companion';
    const result = validateCompletionArtifact(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.canary === 'CAN-CCR-8')).toBe(true);
  });

  it('the validator REFUSES a publication with no ApprovalRecord', () => {
    const broken = clone();
    broken.commons.published = true;
    const result = validateCompletionArtifact(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.canary === 'CAN-CCR-8')).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Schema / template parity, and the open decision held open
// ───────────────────────────────────────────────────────────────────────────

describe('capability-completion-artifact/v1.0 — schema discipline', () => {
  it('refuses a document of any other schema version rather than coercing it', () => {
    const broken = clone() as unknown as { schemaVersion: string };
    broken.schemaVersion = 'capability-completion-artifact/v2.0';
    const result = validateCompletionArtifact(broken);
    expect(result.valid).toBe(false);
    expect(result.issues[0].path).toBe('schemaVersion');
  });

  it('refuses a non-object outright', () => {
    for (const bad of [null, undefined, 'artifact', 42, []]) {
      expect(validateCompletionArtifact(bad).valid).toBe(false);
    }
  });

  it('pins the §8 provenance vocabulary', () => {
    // An independent restatement of the ratified set — the same idiom the
    // domain-profile canaries use for RATIFIED_SEEDS. Widening the vocabulary
    // widens what may count as evidence, so it must be a deliberate change.
    expect([...INVARIANT_PROVENANCE_KINDS]).toEqual([
      'regression-derived',
      'integration-derived',
      'pre-release-intercepted',
      'adversarially-derived',
      'formally-derived',
      'cross-capability-recurrence',
      'proposed',
    ]);
  });

  it('the template and the parser agree on every machine-read section', () => {
    // A docs-file mirror that cannot be derived, so it gets a parity canary
    // (CLAUDE.md, source-of-truth parity rule). If the template renames a
    // heading the parser reads, artifacts authored from it would parse to
    // empty and validate as incomplete for no visible reason.
    const MACHINE_READ_SECTIONS = [
      'Capability identity',
      'Behavioural capability statement',
      'Purpose',
      'Location',
      'Invocation',
      'Capability boundary',
      'Implementation freedom',
      'Reproduction procedure',
      'Modification rules',
      'Known hazards',
      'Operational evidence',
      'Commons publication record',
    ];
    const SUBSECTIONS = ['Surfaces', 'Source paths', 'Owns', 'Does not own', 'Dependencies', 'External authorities'];
    const template = readSource(TEMPLATE_PATH);
    const parser = readSource('services/constitutional/capabilityCompletionArtifact.ts');

    for (const heading of MACHINE_READ_SECTIONS) {
      expect(template, `the template has no '## ${heading}' section`).toContain(`## ${heading}`);
      expect(parser, `the parser never looks for '${heading}'`).toContain(`'${heading}'`);
      expect(source, `the reference artifact has no '## ${heading}' section`).toContain(
        `## ${heading}`,
      );
    }
    for (const sub of SUBSECTIONS) {
      expect(template, `the template has no '### ${sub}' sub-section`).toContain(`### ${sub}`);
      expect(parser, `the parser never looks for '${sub}'`).toContain(`'${sub}'`);
    }
  });

  it('the source lifecycle vocabulary stays the seed crystal\'s own', () => {
    // The crystal's vocabulary is the SOURCE value an artifact carries. CCR-001
    // adds its own ladder alongside (see the "map, don't unify" block below)
    // rather than widening this one.
    expect(
      [...INVARIANT_STATUSES],
      "the source lifecycle vocabulary has drifted from the seed crystal's proposed|validated|canonical",
    ).toEqual(['proposed', 'validated', 'canonical']);
    // The resolution is recorded in the file, so the next reader need not infer it.
    expect(readSource('types/capabilityCompletion.ts')).toContain(
      'RESOLVED BY MAPPING, NOT UNIFICATION',
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Ruling 1 (operator, 2026-07-27) — "map, don't unify"
// ───────────────────────────────────────────────────────────────────────────

describe('§9 lifecycle — the two ladders MAP and are never unified', () => {
  it('FINDING_LIFECYCLE is not rewritten, extended or re-ordered', () => {
    // This canary also supplies enforcement that was CLAIMED but absent:
    // `types/research.ts` says the lifecycle order is "pinned by canary" and,
    // until this ruling, nothing pinned it. An inert mechanism is a defect
    // (MS-7) — and this one guards constitutional data whose ORDER is its
    // meaning (`inv.constitutional.078`).
    expect(
      [...FINDING_LIFECYCLE],
      'FINDING_LIFECYCLE has been rewritten, extended or re-ordered — it is pinned canon, and CCR-001 maps onto it rather than changing it',
    ).toEqual(['observed', 'replicated', 'canonized-as-invariant']);
  });

  it('neither ladder absorbs the other', () => {
    // If CCR-001's stages started appearing in the research ladder (or the
    // reverse), the mapping would have quietly become a merge.
    const research = new Set<string>(FINDING_LIFECYCLE);
    const SHARED = 'observed'; // the one word both vocabularies legitimately use
    // Symmetric: overlap is the defect, and the message must not guess which
    // ladder the stage was added to — either direction is the same unification.
    const overlap = [...COMPLETION_LIFECYCLE].filter((s) => s !== SHARED && research.has(s));
    expect(
      overlap,
      `${overlap.join(', ')} appears in BOTH COMPLETION_LIFECYCLE and FINDING_LIFECYCLE — the ladders are being unified rather than mapped`,
    ).toEqual([]);
  });

  it('the projection onto the crystal is total, so a new stage cannot be undecided', () => {
    for (const stage of COMPLETION_LIFECYCLE) {
      const projected = mapCompletionStage(stage);
      expect(
        projected === null || (INVARIANT_STATUSES as readonly string[]).includes(projected),
        `stage '${stage}' projects to '${projected}', which is not a crystal status`,
      ).toBe(true);
    }
    // `deprecated` asserts NO crystal status: the crystal has none, and
    // inventing one would be exactly the unification the ruling forbids.
    const DRIFT = 'the projection onto the crystal has been redefined — a stage now means something different to the seed vocabulary than it did when the ruling was made';
    expect(mapCompletionStage('deprecated'), DRIFT).toBeNull();
    expect(mapCompletionStage('ratified'), DRIFT).toBe('canonical');
    expect(mapCompletionStage('candidate'), DRIFT).toBe('proposed');
  });

  it('the reference artifact carries BOTH values, and they agree', () => {
    // Carrying the source value alongside is the whole mechanism (Amendment B
    // §B.4's `sourceLifecycle` pattern). An artifact that carried only one
    // would make the mapping inert.
    for (const inv of artifact.reproductionInvariants) {
      expect(inv.completionStage, `${inv.id} carries no completion stage`).toBeDefined();
      expect(
        mapCompletionStage(inv.completionStage!),
        `${inv.id}: stage '${inv.completionStage}' does not project onto status '${inv.status}'`,
      ).toBe(inv.status);
    }
  });

  it('a stage that contradicts its source status is refused', () => {
    // Carrying both values only helps if disagreement between them is an error.
    const broken = clone();
    broken.reproductionInvariants[2].completionStage = 'candidate';
    const result = validateCompletionArtifact(broken);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.path.includes('completionStage') && i.message.includes('MS-3')),
    ).toBe(true);
  });
});
