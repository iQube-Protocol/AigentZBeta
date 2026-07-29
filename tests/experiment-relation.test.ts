import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXPERIMENT_RELATIONS,
  CONTAMINATING_RELATIONS,
  isConfirmatoryEligible,
  ineligibilityReason,
  provenanceStratum,
  PROVENANCE_STRATA,
  SOURCE_PROVENANCE_SYNONYM,
  decideEligibility,
  GENERAL_CONSTITUTIONAL_NAMESPACES,
  INVARIANT_SELECTION_MODES,
  standingAffectsReachability,
  standingMayGateEligibility,
} from '@/services/research/experimentRelation';
import { PROVENANCE_CLASSES } from '@/services/corpusScout/types';

const REPO = join(__dirname, '..');

describe('experiment-relative independence — exclude self-reference, not internal knowledge', () => {
  it('admits INTERNAL doctrine that is independent of the target', () => {
    // The ruling's central correction. The constitutional corpus is itself
    // substantially internally derived; a blanket internal exclusion would make
    // constitutional invariants untestable by construction.
    expect(
      isConfirmatoryEligible('independent'),
      'internal-but-independent must be admissible',
    ).toBe(true);
    const d = decideEligibility({
      invariantId: 'inv.constitutional.001',
      relation: 'independent',
      evidenceProvenance: 'platform-doctrine',
      namespace: 'constitutional',
    });
    expect(d.eligible).toBe(true);
    expect(d.stratum).toBe('C');
    expect(d.reason).toBeNull();
  });

  it('EXCLUDES externally-sourced material that was tailored to the tasks', () => {
    // The converse, and the reason source provenance cannot be the gate:
    // impeccable origin, contaminated relationship.
    const d = decideEligibility({
      invariantId: 'inv.finance.900',
      relation: 'task-derived',
      evidenceProvenance: 'external-established',
      namespace: 'finance',
    });
    expect(d.eligible).toBe(false);
    expect(d.stratum).toBe('T');
    expect(d.reason).toMatch(/task set|expected answers/i);
  });

  it('treats `unknown` as ineligible — fails closed, never open', () => {
    expect(isConfirmatoryEligible('unknown')).toBe(false);
    expect(ineligibilityReason('unknown')).toMatch(/not yet reviewed/i);
    // An unreviewed corpus must yield a small visible crystal, never a large
    // quietly-contaminated one.
    expect(EXPERIMENT_RELATIONS).toContain('unknown');
  });

  it('admits exactly two relations and no more', () => {
    const eligible = EXPERIMENT_RELATIONS.filter(isConfirmatoryEligible).slice().sort();
    expect(eligible).toEqual(['domain-adjacent', 'independent']);
    // Every non-admitted relation must carry a stated reason — a bare `false`
    // tells an operator nothing about what to fix.
    for (const r of EXPERIMENT_RELATIONS) {
      if (isConfirmatoryEligible(r)) continue;
      expect(ineligibilityReason(r), `${r} must state why`).toBeTruthy();
      expect(String(ineligibilityReason(r)).length).toBeGreaterThan(20);
    }
    expect(Object.keys(CONTAMINATING_RELATIONS).sort()).toEqual(
      EXPERIMENT_RELATIONS.filter((r) => !isConfirmatoryEligible(r)).slice().sort(),
    );
  });
});

describe('provenance strata C/D/I/T', () => {
  it('checks contamination BEFORE source, so a clean origin cannot launder a loop', () => {
    // Order is the ruling's own. If source were checked first, an external
    // target-derived invariant would land in D and enter the confirmatory set.
    expect(
      provenanceStratum({
        relation: 'target-derived',
        evidenceProvenance: 'external-established',
        namespace: 'constitutional',
      }),
    ).toBe('T');
  });

  it('splits domain material by where its EVIDENCE came from', () => {
    const base = { relation: 'independent' as const, namespace: 'finance' };
    expect(provenanceStratum({ ...base, evidenceProvenance: 'external-established' })).toBe('D');
    expect(provenanceStratum({ ...base, evidenceProvenance: 'platform-derived' })).toBe('I');
    // Unclassified evidence is not external, so it cannot claim stratum D.
    expect(provenanceStratum({ ...base, evidenceProvenance: null })).toBe('I');
  });

  it('routes general-constitutional namespaces to C regardless of evidence class', () => {
    for (const ns of ['constitutional', 'reasoning', 'polity']) {
      for (const ev of PROVENANCE_CLASSES) {
        expect(
          provenanceStratum({ relation: 'independent', evidenceProvenance: ev, namespace: ns }),
          `${ns}/${ev}`,
        ).toBe('C');
      }
    }
    // …and a domain namespace never lands in C.
    for (const ns of ['finance', 'commercialisation']) {
      expect(
        provenanceStratum({ relation: 'independent', evidenceProvenance: 'platform-doctrine', namespace: ns }),
      ).not.toBe('C');
    }
  });

  it('every stratum is reachable — a partition nothing lands in is not a partition', () => {
    const reached = new Set([
      provenanceStratum({ relation: 'independent', evidenceProvenance: 'platform-doctrine', namespace: 'constitutional' }),
      provenanceStratum({ relation: 'independent', evidenceProvenance: 'external-empirical', namespace: 'finance' }),
      provenanceStratum({ relation: 'independent', evidenceProvenance: 'platform-derived', namespace: 'finance' }),
      provenanceStratum({ relation: 'outcome-informed', evidenceProvenance: 'external-empirical', namespace: 'finance' }),
    ]);
    expect([...reached].sort()).toEqual([...PROVENANCE_STRATA].sort());
  });
});

describe('no parallel source-provenance vocabulary (inv.engineering.037)', () => {
  it('maps the ruling\'s source names onto the SHIPPED ProvenanceClass', () => {
    // The ruling names a source-provenance axis. It already exists as
    // ProvenanceClass. Minting a second one would be the parallel-implementation
    // defect, so the module records a synonym map instead.
    for (const [rulingName, shipped] of Object.entries(SOURCE_PROVENANCE_SYNONYM)) {
      if (shipped === null) continue;
      expect(PROVENANCE_CLASSES, `${rulingName} → ${shipped}`).toContain(shipped);
    }
  });

  it('leaves genuinely-unmapped values NULL rather than inventing an equivalence', () => {
    // `observational-derived` and `synthetic` draw distinctions the shipped
    // vocabulary does not. A false mapping would be worse than a visible gap,
    // because it would silently assign them an experimental population.
    expect(SOURCE_PROVENANCE_SYNONYM['observational-derived']).toBeNull();
    expect(SOURCE_PROVENANCE_SYNONYM['synthetic']).toBeNull();
  });

  it('does not redeclare ProvenanceClass values as its own type', () => {
    const src = readFileSync(join(REPO, 'services/research/experimentRelation.ts'), 'utf-8');
    // A second `export type ...Provenance =` union over the same five values is
    // the exact duplication this module exists to avoid.
    expect(src).not.toMatch(/export type SourceProvenance\s*=/);
    expect(src).toMatch(/import type \{ ProvenanceClass \}/);
  });
});

describe('the snapshot records reality and cannot repair it', () => {
  it('the exporter has no promotion, validation or standing-repair path', () => {
    const src = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
    // "The snapshot should record reality, not repair or promote it."
    // No write back to the corpus, and no flag that could alter a lifecycle
    // field. Scoped to SUPABASE writes specifically — a blanket /\.update\(/
    // also matches createHash().update(), which is a hash call, not a write,
    // and a canary that cries wolf gets loosened rather than heeded.
    expect(src).not.toMatch(/from\(['"]invariants['"]\)[\s\S]{0,120}?\.(update|upsert|insert|delete)\(/);
    expect(src).not.toMatch(/admin\s*\.\s*from\([^)]*\)\s*\.\s*(update|upsert|insert|delete)\(/);
    expect(src).not.toMatch(/times_validated\s*[:=]\s*\d/);
    expect(src).not.toMatch(/status\s*[:=]\s*['"]validated['"]/);
  });

  it('declares finance inside the EXP-P1 boundary', () => {
    const src = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
    const block = src.slice(src.indexOf('EXP_P1_NAMESPACES'), src.indexOf('SNAPSHOT_COLUMNS'));
    expect(block).toMatch(/'finance'/);
    expect(block).toMatch(/'commercialisation'/);
  });

  it('carries the lifecycle, provenance and standing fields the manifest needs', () => {
    const src = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
    for (const col of ['status', 'provenance', 'times_validated', 'times_contradicted', 'standing', 'reach', 'created_at', 'updated_at']) {
      expect(src, `snapshot must carry ${col}`).toMatch(new RegExp(`'${col}'`));
    }
    for (const field of ['export_timestamp', 'environment', 'eligibility_rule_version', 'corpus_row_count', 'namespace_counts', 'status_counts', 'stratum_counts', 'snapshot_sha256', 'decisions']) {
      expect(src, `manifest must carry ${field}`).toMatch(new RegExp(field));
    }
  });

  it('records EXCLUSIONS too, not only inclusions', () => {
    // "Record every inclusion and exclusion decision […] including its reason
    // and provenance stratum." An exclusion that leaves no trace is
    // indistinguishable from an invariant nobody considered.
    const src = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
    expect(src).toMatch(/decisions\.push\(/);
    const push = src.slice(src.indexOf('decisions.push('), src.indexOf('decisions.push(') + 400);
    expect(push).toMatch(/eligible/);
    expect(push).toMatch(/reason/);
    expect(push).toMatch(/stratum/);
  });

  it('pages the corpus read rather than relying on an implicit row cap', () => {
    const src = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
    // A freeze that silently truncated at 1000 rows would hash a partial corpus
    // and every downstream artifact would inherit the omission.
    expect(src).toMatch(/\.range\(/);
  });
});

describe('the Seed Corpus is not the crystal', () => {
  it('the seed file is marked as bootstrap material, not authoritative', () => {
    const seed = JSON.parse(
      readFileSync(join(REPO, 'codexes/packs/irl/foundation/canonical-invariants.seed.json'), 'utf-8'),
    );
    const note = String(seed.authority_note ?? '');
    expect(note.length, 'seed must carry an authority_note').toBeGreaterThan(40);
    expect(note).toMatch(/not the authoritative|bootstrap/i);
    expect(note).toMatch(/must not be used directly as an experimental freeze/i);
  });

  it('the seed already contains proposed members — so `proposed` was never disqualifying', () => {
    const seed = JSON.parse(
      readFileSync(join(REPO, 'codexes/packs/irl/foundation/canonical-invariants.seed.json'), 'utf-8'),
    );
    const proposed = seed.invariants.filter((i: { status?: string }) => i.status === 'proposed');
    // This is the fact that refutes "proposed invariants cannot be in the
    // crystal" on its own, and it is pinned so the claim cannot resurface.
    expect(proposed.length).toBeGreaterThan(0);
    const statuses = new Set(seed.invariants.map((i: { status?: string }) => i.status));
    expect(statuses.size, 'the corpus is mixed-status by construction').toBeGreaterThan(1);
  });
});

describe('rulings of 2026-07-28 — what must NOT drift', () => {
  it('ProvenanceClass stays at five values — an experiment must not amend canon', () => {
    // "Do not expand ProvenanceClass merely to satisfy this experiment. That
    // would turn an experiment implementation into a canon amendment."
    expect([...PROVENANCE_CLASSES].sort()).toEqual([
      'external-empirical', 'external-established',
      'platform-derived', 'platform-doctrine', 'platform-hypothesized',
    ]);
  });

  it('A/B/C is marked superseded as an EXP-P1 eligibility gate, and kept', () => {
    const src = readFileSync(join(REPO, 'services/research/experimentalPopulations.ts'), 'utf-8');
    expect(src).toMatch(/SUPERSEDED FOR EXP-P1 CRYSTAL vP1 ELIGIBILITY/);
    expect(src).toMatch(/RE-SCOPED, NOT RETIRED/);
    // Kept live: it is still the historical record and a stratified view.
    expect(src).toMatch(/export const POPULATION_BY_EVIDENCE_PROVENANCE/);
  });

  it('`domain-adjacent` cannot be admitted without an explicit reviewer reason', () => {
    // The permissive label carries a burden `independent` does not, or it
    // becomes a home for uncertain material.
    const src = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
    expect(src).toMatch(/REQUIRES_INCLUSION_REASON/);
    expect(src).toMatch(/missingReason/);
    const gate = src.slice(src.indexOf('const eligible = inDomain'), src.indexOf('const eligible = inDomain') + 200);
    expect(gate).toMatch(/!missingReason/);
  });

  it('exports five artifacts, and hashes the relations file alongside the crystal', () => {
    const src = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
    // Assert the actual write targets rather than pattern-matching extensions —
    // the five artifacts are five writeFileSync calls, so count and name them.
    const writes = [...src.matchAll(/writeFileSync\(`\$\{base\}([^`]*)`/g)].map((m) => m[1]);
    expect(writes.sort()).toEqual(
      ['.exclusions.json', '.json', '.manifest.json', '.relations.json', '.sha256'].sort(),
    );
    expect(src).toMatch(/relations_sha256/);
  });

  it('the review record carries reviewer, timestamp and source refs', () => {
    const src = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
    for (const f of ['reviewer', 'reviewed_at', 'source_refs', 'inclusion_reason']) {
      expect(src, `decision must record ${f}`).toMatch(new RegExp(f));
    }
  });

  it('survey mode reports an UPPER BOUND and never infers a relationship', () => {
    const src = readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
    const survey = src.slice(src.indexOf('if (SURVEY)'), src.indexOf('if (DRY_RUN)'));
    expect(survey).toMatch(/UPPER BOUND/);
    expect(survey).toMatch(/awaiting independence review/);
    // Survey must not write, and must not assign a relation to anything.
    expect(survey).not.toMatch(/writeFileSync/);
    expect(survey).not.toMatch(/relations\[[^\]]*\]\s*=/);
  });
});

describe('selection mode is arm treatment, never an eligibility gate', () => {
  it('offers exactly the three ruled modes', () => {
    expect([...INVARIANT_SELECTION_MODES].sort()).toEqual([
      'experiment-fixed-population', 'experiment-stratified', 'runtime-standing',
    ]);
  });

  it('keeps runtime-standing as a legal TREATMENT, not a defect', () => {
    // Arm B is the live runtime; stripping its ranking would destroy the
    // ecological validity the arm exists to provide.
    expect(standingAffectsReachability('runtime-standing')).toBe(true);
    expect(standingAffectsReachability('experiment-fixed-population')).toBe(false);
    expect(standingAffectsReachability('experiment-stratified')).toBe(false);
  });

  it('forbids Standing from gating eligibility in EVERY mode', () => {
    for (const m of INVARIANT_SELECTION_MODES) {
      expect(standingMayGateEligibility(m), m).toBe(false);
    }
    // And eligibility genuinely does not read Standing: a zero-Standing,
    // zero-validation, `proposed` invariant is admitted on relation alone.
    expect(
      decideEligibility({
        invariantId: 'inv.finance.001',
        relation: 'independent',
        evidenceProvenance: 'platform-derived',
        namespace: 'finance',
      }).eligible,
    ).toBe(true);
  });

  it('does not read the mode from the environment', () => {
    const src = readFileSync(join(REPO, 'services/research/experimentRelation.ts'), 'utf-8');
    // "No hidden environment-based behavior" — a selection rule that varies
    // with ambient config is unreproducible.
    expect(src).not.toMatch(/process\.env/);
  });

  it('leaves the live runtime default untouched', () => {
    const grounding = readFileSync(join(REPO, 'services/invariants/grounding.ts'), 'utf-8');
    // rankByStanding stays standing-primary; the product is not changed to suit
    // the experiment.
    expect(grounding).toMatch(/function rankByStanding/);
    expect(grounding).toMatch(/if \(b\.standing !== a\.standing\) return b\.standing - a\.standing;/);
  });
});

describe('relations scaffold', () => {
  const src = () => readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');

  it('pre-judges nothing — every scaffolded entry starts `unknown`', () => {
    const block = src().slice(src().indexOf('if (SCAFFOLD)'), src().indexOf('if (SURVEY)'));
    expect(block).toMatch(/relationship: 'unknown'/);
    // No other relation may be written by the generator.
    for (const r of ['independent', 'domain-adjacent', 'target-derived']) {
      expect(block, `scaffold must not assign ${r}`).not.toMatch(new RegExp(`relationship: '${r}'`));
    }
  });

  it('preserves decisions already made rather than overwriting them', () => {
    const block = src().slice(src().indexOf('if (SCAFFOLD)'), src().indexOf('if (SURVEY)'));
    // Re-running the scaffold after a partial review must not wipe it.
    expect(block).toMatch(/if \(relations\[key\]\) \{ out\[key\] = relations\[key\]; continue; \}/);
  });

  it('carries a statement preview so review does not need a second lookup', () => {
    const block = src().slice(src().indexOf('if (SCAFFOLD)'), src().indexOf('if (SURVEY)'));
    expect(block).toMatch(/_statement/);
    expect(block).toMatch(/_namespace/);
  });

  it('writes to a SCAFFOLD filename, never over a frozen artifact', () => {
    const block = src().slice(src().indexOf('if (SCAFFOLD)'), src().indexOf('if (SURVEY)'));
    expect(block).toMatch(/relations\.SCAFFOLD\.json/);
    // Must not collide with the hashed `.relations.json` the freeze writes.
    expect(block).not.toMatch(/`crystal-\$\{VERSION\}\.relations\.json`/);
  });
});

describe('QriptoCENT supply constitution (ratified 2026-07-29)', () => {
  const read = (p: string) => readFileSync(join(REPO, p), 'utf-8');
  // Prose canaries match against whitespace-collapsed text: a markdown
  // rewrap is not a semantic change, and a canary that fires on line
  // breaks gets loosened rather than heeded.
  const flat = (p: string) =>
    read(p).replace(/[*>`]/g, '').replace(/\s+/g, ' ');

  it('both etching scripts refuse to run until the issuance constitution is ratified', () => {
    // A Rune's name, divisibility, cap and premine are ALL immutable at etch.
    for (const p of ['scripts/deploy-qct-runes.ts', 'scripts/deploy-qct-runes.js']) {
      const src = read(p);
      expect(src, `${p} must gate the etch`).toMatch(/BITCENT_ISSUANCE_CONSTITUTION_RATIFIED/);
      expect(src, `${p} must refuse, not warn`).toMatch(/process\.exitCode = 1/);
      // The refusal must say the ALLOCATION is incomplete — not that the amount
      // is unknown. 100M is decided; presenting it as open would reopen a
      // settled decision every time someone reads the error.
      expect(src, `${p} must name the allocation as the blocker`).toMatch(/ALLOCATION CONSTITUTION is incomplete/);
      expect(src, `${p} must state the intended amount`).toMatch(/100,000,000/);
      expect(src, `${p} must mark 400M superseded`).toMatch(/SUPERSEDED/);
    }
    // The divergent script keeps its own separate guard.
    expect(read('scripts/deploy-qct-bitcoin.js')).toMatch(/ACKNOWLEDGE_DIVERGENT_TOKENOMICS/);
  });

  it('the deployment guide states the cap is PER DENOMINATION, not protocol-wide', () => {
    const guide = flat('scripts/QCT_RUNES_DEPLOYMENT.md');
    expect(guide).toMatch(/never a protocol-wide cap/i);
    expect(guide).toMatch(/independent/i);
    // The 1B must be attributed to the two named denominations, never presented
    // as a default every future denomination inherits.
    expect(guide).toMatch(/not a default|not an entitlement/i);
    // The intended amount IS decided (100M); what is open is the allocation.
    expect(guide).toMatch(/100,000,000.*intended/);
    expect(guide).toMatch(/SUPERSEDED/);
  });

  it('records Base Q¢ as already holding its 400M against its OWN cap', () => {
    const doc = read('codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md');
    expect(doc).toMatch(/0x46CD79B8f795169FC59D5f1DE1a444c3C39fE7CE/);
    expect(doc).toMatch(/400,000,000/);
    // Capacity is not issuance — the sentence that stops "2 billion exist".
    expect(doc).toMatch(/Capacity is not issuance/);
  });

  it('never asserts a class-wide cap, including the 2B reading', () => {
    const doc = flat('codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md');
    expect(doc).toMatch(/no fixed class-wide maximum supply/i);
    expect(doc).toMatch(/per denomination ≠ per chain/);
    // Both false readings of "2 billion" are named and refuted.
    expect(doc).toMatch(/not a 2-billion cap on the QriptoCENT class/);
  });

  it('scopes the 1B to the two named denominations, not to all future ones', () => {
    const doc = flat('codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md');
    expect(doc).toMatch(/not an automatic entitlement, a default, or a constitutional rule for future denominations/);
    // A future denomination may be governed at another maximum entirely.
    expect(doc).toMatch(/50 million, 100 million, 500 million, 1 billion/);
  });

  it('records 100M B¢ as decided, with the ALLOCATION as what is open', () => {
    const doc = flat('codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md');
    expect(doc).toMatch(/approved in principle/);
    expect(doc).toMatch(/is not the amount/);
    // And the 400M proposal is retired, not held open as an alternative.
    expect(doc).toMatch(/400,000,000 proposal is SUPERSEDED/);
  });
});

describe('triage proposes; only a human decides (EXP-P1 target ruling 2026-07-29)', () => {
  const src = () => readFileSync(join(REPO, 'scripts/export-crystal-snapshot.mjs'), 'utf-8');
  const block = () => src().slice(src().indexOf('if (TRIAGE)'), src().indexOf('if (SCAFFOLD)'));

  it('an unsigned proposal is NOT eligible, however confident it looks', () => {
    // PRD-ICA-001 §6/§11 — approval is a human act, never automatic. Triage
    // writes an empty `reviewer`; the exporter must refuse on that alone.
    const s = src();
    expect(s).toMatch(/const unsigned = relation !== 'unknown' && !String\(reviewer \?\? ''\)\.trim\(\);/);
    expect(s).toMatch(/&& !unsigned;/);
    expect(s).toMatch(/proposed by triage but not signed off/);
  });

  it('triage never writes a reviewer for itself', () => {
    // Self-signing would make the whole gate ceremonial.
    expect(block()).toMatch(/reviewer: ''/);
    expect(block()).not.toMatch(/reviewer: 'triage'/);
    expect(block()).not.toMatch(/reviewer: '[a-z]/i);
  });

  it('holds the TARGET itself for scrutiny, not just the non-target products', () => {
    const s = src();
    // The target is the IRL pipeline. An invariant derived from its own
    // behaviour is the circular case — so pipeline terms must be scrutinised
    // alongside MoneyPenny/CryptoSent, not instead of them.
    for (const t of ['moneypenny', 'cryptosent', 'marketa']) {
      expect(s, `must scrutinise ${t}`).toMatch(new RegExp(`'${t}'`));
    }
    for (const t of ['invariant selection', 'invariant retrieval', 'grounding', 'crystal']) {
      expect(s, `must scrutinise the target term "${t}"`).toMatch(new RegExp(`'${t}'`));
    }
  });

  it('does NOT exclude finance for being finance — it is the test domain', () => {
    const s = src();
    // The ruling's core: finance is a DOMAIN, not the target. No blanket
    // namespace exclusion may appear in the triage.
    expect(block()).not.toMatch(/namespace.*===.*'finance'/);
    expect(s).toMatch(/finance is a test DOMAIN/i);
    // And finance stays inside the boundary.
    expect(s.slice(s.indexOf('EXP_P1_NAMESPACES'), s.indexOf('SCRUTINY_TERMS'))).toMatch(/'finance'/);
  });

  it('proposes only `independent` or `unknown` — never a contaminating verdict', () => {
    // Triage may withhold a presumption. It may not mechanically brand an
    // invariant target-derived; that is a judgement with consequences.
    const b = block();
    expect(b).toMatch(/proposal = 'independent'/);
    expect(b).toMatch(/proposal = 'unknown'/);
    for (const r of ['target-derived', 'task-derived', 'outcome-informed', 'domain-adjacent']) {
      expect(b, `triage must not assign ${r}`).not.toMatch(new RegExp(`proposal = '${r}'`));
    }
  });

  it('preserves decisions already signed off, and records its own signal', () => {
    expect(block()).toMatch(/if \(relations\[key\]\) \{ out\[key\] = relations\[key\]; tally\.preserved \+= 1; continue; \}/);
    expect(block()).toMatch(/_signal/);
    expect(block()).toMatch(/_proposedBy: 'triage'/);
  });

  it('writes to a TRIAGE filename and never over a frozen artifact', () => {
    expect(block()).toMatch(/relations\.TRIAGE\.json/);
    expect(block()).not.toMatch(/`crystal-\$\{VERSION\}\.relations\.json`/);
  });
});
