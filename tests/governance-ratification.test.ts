/**
 * Ratification-act canaries (operator ruling 2026-07-27: *"I'd say both — an
 * operator performs ratification and a receipt of that is generated"*), and the
 * capture-attachment canaries that close "actions are not pulling over".
 *
 * TWO DEFECTS OF THE SAME SHAPE, which is why they share a file: in both cases
 * a complete mechanism existed and the thing that would have USED it did not,
 * so nothing errored and nothing worked.
 *
 *  1. `createGovernanceReceipt` had ZERO call sites — the DVN pipeline could
 *     anchor a constitutional amendment and no code path ever asked it to. MS-7
 *     (an inert mechanism is a defect even though nothing errors).
 *  2. The capture assign route's attach-to-existing branch resolved a reference
 *     and wrote nothing else, so the captured text landed nowhere while every
 *     UI signal said success. Silent loss, which is worse than an error.
 *
 * What is asserted here is the property that makes each fix real rather than
 * cosmetic: the receipt commits to the document's CONTENT, and the attachment
 * actually writes the content into the target object.
 */

import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

import {
  anchorStatusFromReceipt,
  buildRatificationObject,
  ratifierCommitment,
  RATIFIABLE_ROOTS,
  RATIFICATION_ACTS,
  recordRatification,
  type RatificationPayload,
} from '@/services/governance/governanceRatification';
import { findForbiddenObjectKey } from '@/types/constitutionalObject';
import {
  CONSTITUTIONAL_FRAMEWORKS,
  publishableFrameworks,
  getFrameworkDefinition,
} from '@/services/polity/constitutionalFrameworkRegistry';

const RATIFY_ROUTE = 'app/api/governance/ratify/route.ts';
const ASSIGN_ROUTE = 'app/api/companion/capture/[captureId]/assign/route.ts';
const ACT = 'services/governance/governanceRatification.ts';
const REGISTRY = 'services/polity/constitutionalFrameworkRegistry.ts';
const PUBLISH_ROUTE = 'app/api/polity-core/publish/route.ts';
const HELPER = 'services/governance/governanceReceiptHelper.ts';
const PIPELINE = 'services/dvn/activityReceiptDvnPipeline.ts';
const MIGRATION = 'supabase/migrations/20260825000000_governance_ratifications.sql';
const LEDGER = 'codexes/packs/polity-core/items/AMENDMENT_RECORDS.md';

/**
 * Every source file whose CODE contains `needle`. Repo-wide.
 *
 * Two corrections learned the hard way, both documented in
 * tests/_lib/sourceAuthority.ts's header and both hit while writing this file:
 *
 *  - `--untracked --exclude-standard`, or a brand-new module is invisible to the
 *    canary and "nobody calls the helper" passes on the commit that adds the
 *    caller. An inert canary, on a file about inert mechanisms.
 *  - `stripComments` on the hits, because a module whose header DOCUMENTS the
 *    boundary by naming the forbidden symbol otherwise fails its own canary.
 *    This route's header quotes `GOVERNANCE_DECISIONS` while importing none of
 *    it; the raw grep called that a violation.
 */
function filesContaining(needle: string): string[] {
  let hits: string[];
  try {
    hits = execFileSync(
      'git',
      [
        'grep', '-l', '--untracked', '--exclude-standard', '--fixed-strings', needle,
        '--', 'app', 'services', 'components', 'scripts', 'lib', 'utils',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
  } catch {
    return []; // git grep exits 1 on no match
  }
  return hits.filter((f) => {
    if (!/\.(ts|tsx)$/.test(f)) return true;
    try {
      return stripComments(readSource(f)).includes(needle);
    } catch {
      return true;
    }
  });
}

describe('ratification is an act, and the act is recorded', () => {
  it('the governance receipt helper finally has a caller — and exactly one', () => {
    // The original defect in one assertion. Now stronger than "somebody calls
    // it": the set of callers is PINNED. The ruling forbids ratification being
    // inferred from anything other than the explicit act, so a second caller
    // appearing anywhere is a finding, not a convenience.
    const callers = filesContaining('createGovernanceReceipt(');
    expect(callers, 'no caller — the helper is inert again').toContain(ACT);
    expect(
      callers.filter((f) => f !== ACT && f !== 'services/governance/governanceReceiptHelper.ts'),
      'a second module creates governance receipts — the ratification act must be the only source',
    ).toEqual([]);

    // The action types it emits must be the anchorable ones, or the act is
    // recorded locally and never reaches the chain.
    const act = stripComments(readSource(ACT));
    const pipeline = stripComments(readSource(PIPELINE));
    for (const action of Object.values(RATIFICATION_ACTS)) {
      expect(act, `the act does not emit ${action}`).toContain(action);
      expect(pipeline, `${action} is not DVN-anchorable`).toContain(`'${action}'`);
    }
    expect(stripComments(readSource(HELPER))).toMatch(/GovernanceActionType/);
  });

  it('NO document-write path can emit a governance receipt', () => {
    // The ruling's central correction: "Editing a constitutional document does
    // not constitute ratification and must not automatically emit a governance
    // receipt." Asserted structurally — a module that writes files, or syncs
    // docs, must have no way to reach the governance receipt path.
    const writers = new Set([
      ...filesContaining('writeFileSync'),
      ...filesContaining('fs.writeFile'),
      ...filesContaining('promises.writeFile'),
    ]);
    const receiptEmitters = new Set([
      ...filesContaining('createGovernanceReceipt'),
      ...Object.values(RATIFICATION_ACTS).flatMap((a) => filesContaining(a)),
    ]);
    const overlap = [...writers].filter((f) => receiptEmitters.has(f));
    expect(
      overlap,
      'a file-writing module can emit a governance receipt — a document edit must never ratify',
    ).toEqual([]);

    // And the act itself must not be a file writer: if it could edit the
    // document it ratifies, the hash would attest to bytes it authored.
    const act = stripComments(readSource(ACT));
    expect(/writeFileSync|writeFile\(/.test(act), 'the ratification act writes files').toBe(false);
  });

  it('the record commits to the document CONTENT, version and amendments — not just an id', () => {
    // A receipt attesting that "GD-014 was ratified" without attesting to what
    // GD-014 said is a signature on a blank page: the document could change
    // afterwards and the anchor would still verify.
    const act = stripComments(readSource(ACT));

    // The hash is computed from resolved bytes, and the resolution is checked.
    expect(act, 'the candidate is never resolved from the request path').toMatch(
      /resolveRatificationCandidate/,
    );
    expect(act, 'the resolved document never reaches the record').toMatch(
      /contentHash: document\.contentHash/,
    );

    // MUTATION-DRIVEN DISCIPLINE (2026-07-27): asserting a symbol is PRESENT is
    // not asserting it is USED. Each entry below names a value that must travel
    // from the frozen document into the receipt's affectedAssets.
    //
    // SECOND CORRECTION, same session: the first version of this loop asserted
    // the bare binding `payload.contentHash`, and SURVIVED a mutation that
    // deleted the content hash from the payload entirely — because
    // `payload.contentHashScope`, still present two lines below, contains
    // `payload.contentHash` as a substring. A prefix of a longer identifier is
    // not evidence the identifier is used. The full emitted expression is.
    const assets = act.slice(
      act.indexOf('affectedAssets: ['),
      act.indexOf('authorityBasis: payload.authorityBasis'),
    );
    expect(assets.length, 'could not locate the receipt payload').toBeGreaterThan(100);
    for (const emitted of [
      '`document:${payload.documentPath}`',
      '`document-version:${payload.documentVersion}`',
      '`sha256:${payload.contentHash}`',
      '`hash-scope:${payload.contentHashScope}`',
      '`ratification-kind:${payload.ratificationKind}`',
      'payload.amendmentIds.map(',
      'payload.supersedes.map(',
      'payload.previousContentHash',
      'payload.effectiveAt',
    ]) {
      expect(assets, `the receipt does not carry ${emitted}`).toContain(emitted);
    }
    // And a document that cannot be read is REFUSED, never anchored blind.
    expect(stripComments(readSource(RATIFY_ROUTE))).toMatch(/document-not-ratifiable/);
  });

  it('reads the ratified document through the corpus store, never readFileSync', () => {
    // The first cut hashed the document with `readFileSync(join(process.cwd(),
    // path))`. next.config traces pack JSON only — "The .md bodies are served by
    // the corpus store" — so that read succeeds in the sandbox and returns
    // NOTHING on Lambda. Every ratification in production would have been
    // refused as document-not-ratifiable, with the canaries green.
    for (const file of [ACT, REGISTRY]) {
      const src = stripComments(readSource(file));
      expect(src, `${file} reads pack content through corpusReadPackFile`).toMatch(
        /corpusReadPackFile\(/,
      );
      expect(
        /readFileSync/.test(src),
        `${file} uses readFileSync on pack content — invisible to the Lambda bundle`,
      ).toBe(false);
    }
  });

  it('refuses a ratification with no subject document, and contains the ratifiable roots', () => {
    const route = stripComments(readSource(RATIFY_ROUTE));
    expect(route).toMatch(/document-path-required/);
    const act = stripComments(readSource(ACT));
    expect(act).toMatch(/RATIFIABLE_ROOTS/);
    // Path containment: ratification is an act over constitutional material.
    expect(act, 'no traversal guard').toMatch(/includes\('\.\.'\)/);
    expect(RATIFIABLE_ROOTS.length).toBeGreaterThan(0);
    for (const root of RATIFIABLE_ROOTS) expect(root.startsWith('codexes/packs/')).toBe(true);
  });

  it('is an authority act — admin only, and no ops-token bypass', () => {
    const route = stripComments(readSource(RATIFY_ROUTE));
    expect(route).toMatch(/getActivePersona\(req\)/);
    expect(route).toMatch(/cartridgeFlags\?\.isAdmin/);
    // Unlike the scheduled workspace report, ratification must have a human
    // behind it (Law XI). An ops-token branch here would let a cron ratify.
    expect(
      /ADMIN_OPS_TOKEN/.test(route),
      'the ratification route accepts an ops token — a cron must not be able to ratify',
    ).toBe(false);
  });

  it('reports an unrecorded act or unwritten receipt as a failure, not a success', () => {
    // The act happening while the record does not is precisely the gap being
    // closed. Returning ok:true there would recreate it.
    const route = stripComments(readSource(RATIFY_ROUTE));
    for (const failure of ['ratification-not-recorded', 'receipt-not-written']) {
      expect(route, `${failure} is not reported`).toContain(failure);
      const at = route.indexOf(failure);
      expect(route.slice(at - 200, at + 200), `${failure} is not an ok:false`).toMatch(/ok: false/);
    }
    // Order: the record is persisted BEFORE the receipt, so a receipt failure
    // leaves a visible, retryable act rather than a receipt for nothing.
    //
    // MUTATION-DRIVEN CORRECTION: the first version compared two `indexOf`
    // results directly. A mutation that renamed the table made the first
    // `indexOf` return -1, which is less than anything, so the canary passed on
    // code that no longer persisted the record at all. Both anchors must be
    // FOUND before their order means anything.
    const act = stripComments(readSource(ACT));
    // The anchor is the CONTIGUOUS from→insert pair, so renaming the table does
    // not merely shift the index — it removes the anchor entirely.
    const INSERT = ".from('governance_ratifications')\n    .insert({";
    const insertAt = act.indexOf(INSERT);
    const receiptAt = act.indexOf('createGovernanceReceipt(');
    expect(insertAt, 'the ratification is never inserted into governance_ratifications').toBeGreaterThan(-1);
    expect(receiptAt, 'no governance receipt is created').toBeGreaterThan(-1);
    expect(insertAt, 'the receipt is written before the record is persisted').toBeLessThan(receiptAt);
  });
});

describe('anchor state is OBSERVED, never asserted', () => {
  it('there is no anchor_status column and no anchor value is ever written', () => {
    const sql = readSource(MIGRATION);
    expect(
      /anchor_status/.test(sql.replace(/--[^\n]*/g, '')),
      'the migration stores an anchor status — a value written at insert time is a hope, not an observation',
    ).toBe(false);

    const act = stripComments(readSource(ACT));
    // The observation reads the receipt's REAL status from the receipts table.
    expect(act, 'anchor state is not read from the receipts table').toMatch(
      /\.from\('activity_receipts'\)[\s\S]{0,120}receipt_status/,
    );
    // …and nothing writes an anchorStatus into the row.
    expect(
      /anchor_status:/.test(act),
      'the service writes an anchor status column',
    ).toBe(false);
  });

  it('the two vocabularies are MAPPED, and both are reported', () => {
    // "Map, don't unify" — receipt_status and anchorStatus are different words
    // in different systems. Collapsing them loses which one was observed.
    expect(anchorStatusFromReceipt('local')).toBe('local');
    expect(anchorStatusFromReceipt('dvn_pending')).toBe('submitted');
    expect(anchorStatusFromReceipt('dvn_recorded')).toBe('anchored');
    expect(anchorStatusFromReceipt('dvn_failed')).toBe('failed');
    // An UNOBSERVED anchor is reported as unobserved, never defaulted to
    // 'local' — that default would be an assertion dressed as an observation.
    expect(anchorStatusFromReceipt(null)).toBeNull();
    expect(anchorStatusFromReceipt(undefined)).toBeNull();

    const act = stripComments(readSource(ACT));
    expect(act, 'the receipt status is not returned alongside the mapped one').toMatch(
      /receiptStatus,\s*anchorStatus: anchorStatusFromReceipt\(receiptStatus\)/,
    );
  });
});

describe('a retrospective attestation is never presented as an original one', () => {
  const base: RatificationPayload = {
    decisionId: 'LAW-XVI',
    documentId: 'development-constitution',
    documentTitle: 'Chrysalis Development Constitution (CFS-009)',
    documentVersion: 'Law XVI',
    documentPath: 'codexes/packs/irl/foundation/CFS-009_development-constitution.md',
    frameworkId: 'development-constitution',
    contentHash: 'a'.repeat(64),
    contentCid: null,
    contentHashScope: 'as-recorded',
    amendmentIds: ['XVI'],
    supersedes: [],
    previousContentHash: null,
    ratifiedBy: ratifierCommitment('persona-under-test'),
    authorityBasis: 'Law XI',
    act: 'ratify',
    ratificationKind: 'retrospective',
    ratifiedAt: '2026-07-27T00:00:00.000Z',
    recordedAt: '2026-07-28T00:00:00.000Z',
    effectiveAt: null,
    historicalContentRecoverable: false,
    anchoringIsRetrospective: true,
    receiptId: null,
    domain: 'constitutional',
    summary: 'retrospective attestation',
    publishedAt: null,
  };

  it('the honesty fields the ruling requires all exist and are all enforced', () => {
    const sql = readSource(MIGRATION);
    for (const column of [
      'ratified_at',                      // original ratification date
      'recorded_at',                      // date recorded in the platform
      'content_hash',                     // current document hash
      'content_hash_scope',               // WHICH document that hash is of
      'historical_content_recoverable',   // was the exact historical content recoverable
      'anchoring_is_retrospective',       // is anchoring retrospective
    ]) {
      expect(sql, `the record cannot express ${column}`).toContain(column);
    }
    // The database refuses a retrospective row that does not answer the
    // recoverability question, and refuses an original row that pretends to.
    // MUTATION-DRIVEN CORRECTION: matching the constraint name anywhere let a
    // renamed ADD CONSTRAINT survive, because the paired `DROP CONSTRAINT IF
    // EXISTS` line still carried the old name. The ADD is what enforces.
    for (const constraint of [
      'governance_ratifications_retrospective_honesty_check',
      'governance_ratifications_hash_scope_honesty_check',
    ]) {
      expect(sql, `${constraint} is not actually added`).toMatch(
        new RegExp(`ADD CONSTRAINT ${constraint}`),
      );
    }

    const act = stripComments(readSource(ACT));
    expect(act, "the hash scope is not derived from the ruling's recoverability question").toMatch(
      /contentHashScope: ContentHashScope =[\s\S]{0,200}historicalContentRecoverable === true \? 'as-ratified' : 'as-recorded'/,
    );
  });

  it('REFUSES an attestation that would misrepresent history — behaviourally', async () => {
    // Behavioural, not structural: the act is driven with adversarial input and
    // the refusal is observed. Deliberately reached before any I/O, so it holds
    // with no database — a grep for `originalRatifiedAt` survived a mutation
    // that deleted the guard, because the field name still appeared elsewhere.
    const candidate = {
      frameworkId: null,
      document: {
        id: 'd',
        title: 'D',
        version: '1',
        format: 'markdown' as const,
        body: 'x',
        sourcePath: 'codexes/packs/irl/foundation/x.md',
        contentHash: 'b'.repeat(64),
        byteLength: 1,
      },
    };
    const call = (extra: Record<string, unknown>) =>
      recordRatification({
        personaId: 'persona-under-test',
        decisionId: 'GD-TEST',
        act: 'ratify' as const,
        candidate,
        ...extra,
      });

    // A retrospective attestation with no original date would be recorded under
    // today's date — a historic ratification presented as a new one.
    const noDate = await call({ ratificationKind: 'retrospective', historicalContentRecoverable: false });
    expect(noDate.ok).toBe(false);
    expect(!noDate.ok && noDate.reason).toMatch(/originalRatifiedAt/);

    // …and with no answer to the recoverability question, the hash scope would
    // be manufactured rather than derived.
    const noAnswer = await call({
      ratificationKind: 'retrospective',
      originalRatifiedAt: '2026-07-27T00:00:00.000Z',
    });
    expect(noAnswer.ok).toBe(false);
    expect(!noAnswer.ok && noAnswer.reason).toMatch(/historicalContentRecoverable/);

    // The inverse: an ORIGINAL act must not carry a historical date.
    const backdated = await call({
      ratificationKind: 'original',
      originalRatifiedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(backdated.ok).toBe(false);
    expect(!backdated.ok && backdated.reason).toMatch(/retrospective/);
  });

  it('the object records the attestation as attested, not as ratified', () => {
    const retro = buildRatificationObject(base);
    expect(retro.provenance.source).toBe('attested');
    expect(retro.payload.anchoringIsRetrospective).toBe(true);
    expect(retro.payload.contentHashScope).toBe('as-recorded');

    const original = buildRatificationObject({
      ...base,
      ratificationKind: 'original',
      contentHashScope: 'as-ratified',
      historicalContentRecoverable: null,
      anchoringIsRetrospective: false,
    });
    expect(original.provenance.source).toBe('ratified');
    // The two must be distinguishable from the object alone — a consumer that
    // only sees the object must not be able to mistake one for the other.
    expect(original.provenance.source).not.toBe(retro.provenance.source);
  });

  it('carries no T0 identifier — the ratifying authority is a commitment', () => {
    expect(findForbiddenObjectKey(buildRatificationObject(base))).toBeNull();
    // The commitment is one-way and deterministic.
    expect(ratifierCommitment('p-1')).toBe(ratifierCommitment('p-1'));
    expect(ratifierCommitment('p-1')).not.toBe(ratifierCommitment('p-2'));
    expect(ratifierCommitment('p-1')).not.toContain('p-1');
    expect(ratifierCommitment('p-1')).toMatch(/^[0-9a-f]{16}$/);
    // …and the migration carries no T0 column.
    const sql = readSource(MIGRATION).replace(/--[^\n]*/g, '');
    for (const t0 of ['persona_id', 'personaId', 'auth_profile_id', 'root_did']) {
      expect(sql.includes(t0), `the migration stores ${t0}`).toBe(false);
    }
  });
});

describe('the decision log is a projection, not the event source', () => {
  it('the hardcoded array is read only by its own module and its projection', () => {
    const readers = filesContaining('GOVERNANCE_DECISIONS');
    expect(readers.sort()).toEqual(
      [
        'services/governance/governanceDecisionLog.ts', // the seed itself
        'services/governance/governanceRatification.ts', // the projection
        'services/governance/index.ts', // the barrel re-export (a name, not a read)
      ].sort(),
    );
    // Anything else importing it is new code treating the array as the event
    // source again — the exact regression the ruling forbids.
  });

  it('the projection is derived from the persisted records', () => {
    const act = stripComments(readSource(ACT));
    const fn = act.slice(act.indexOf('export async function projectGovernanceDecisionLog'));
    expect(fn.length, 'the projection function is missing').toBeGreaterThan(100);
    // It must READ the records, not merely be adjacent to them.
    expect(fn, 'the projection does not read the persisted records').toMatch(
      /const records = await listRatifications\(\)/,
    );
    // Seed entries survive, but are flagged as seed — never as evidence that a
    // ratification act occurred.
    expect(fn).toMatch(/provenance: 'seed'/);
    expect(act).toMatch(/provenance: 'ratified'/);
  });

  it('the seed array declares itself seed, so the next reader is warned in place', () => {
    const log = readSource('services/governance/governanceDecisionLog.ts');
    expect(log, 'the array does not declare that it is no longer the event source').toMatch(
      /SEED DATA[\s\S]{0,400}no longer the event source/i,
    );
  });
});

describe('the constitutional framework registry reaches the documents the route could not', () => {
  it('CFS-009 and the Horizen packet are registered — and the publisher has no hardwired imports', () => {
    // The concrete blocker: CFS-009 appeared ZERO times in the publish route.
    for (const id of ['development-constitution', 'horizen-workspace-amendments']) {
      const def = getFrameworkDefinition(id);
      expect(def, `${id} is not in the constitutional framework registry`).toBeTruthy();
      expect(def!.ratificationRequired).toBe(true);
      expect(def!.publicationPolicy.publish).toBe(true);
    }
    expect(publishableFrameworks().map((f) => f.id)).toContain('development-constitution');

    // "Do not special-case CFS-009 or Horizen directly inside the route." The
    // publisher must name NO document — its set comes from the registry.
    const route = stripComments(readSource(PUBLISH_ROUTE));
    expect(route, 'the publisher does not consume the registry').toMatch(/publishableFrameworks\(/);
    for (const id of CONSTITUTIONAL_FRAMEWORKS.map((f) => f.id)) {
      expect(
        route.includes(`'${id}'`) || route.includes(`"${id}"`),
        `the publish route names "${id}" directly — the registry is the only place documents are listed`,
      ).toBe(false);
    }
    // …and the six hardwired framework getters are gone.
    for (const gone of ['getConstitution(', 'getAgentCharter(', 'getDelegationFramework(']) {
      expect(route.includes(gone), `the publish route still hardwires ${gone}`).toBe(false);
    }
  });

  it('a withheld framework says WHY — an unexplained absence is how CFS-009 was lost', () => {
    for (const def of CONSTITUTIONAL_FRAMEWORKS) {
      if (def.publicationPolicy.publish) continue;
      expect(
        def.publicationPolicy.reason && def.publicationPolicy.reason.length > 20,
        `${def.id} is withheld from publication with no stated reason`,
      ).toBeTruthy();
    }
  });

  it('the registry and the constitutional register agree on the current version', () => {
    // PARITY CANARY. The register (AMENDMENT_RECORDS.md) is the source of truth
    // for what version of a constitutional document is current; the registry's
    // declared version is a projection of it. A hand-maintained duplicate with
    // no parity check is the defect class inv.engineering.036/.037 names.
    const ledger = readSource(LEDGER);
    const rows: Array<[string, string]> = [
      ['development-constitution', 'Chrysalis Development Constitution (CFS-009)'],
      ['horizen-workspace-amendments', 'Horizen Workspace Architecture'],
    ];
    for (const [id, ledgerLabel] of rows) {
      const def = getFrameworkDefinition(id)!;
      const row = ledger.split('\n').find((l) => l.includes(ledgerLabel));
      expect(row, `${ledgerLabel} is not on the constitutional register`).toBeTruthy();
      // The registry's declared version must be the version column's value.
      const version = row!.split('|').map((c) => c.trim())[3];
      expect(
        version,
        `registry declares a version for ${id} that the register does not record`,
      ).toBeTruthy();
      // Resolve the declared version off the definition without reading the file
      // (the resolver is async + corpus-backed); the declaration is what drifts.
      const declared = stripComments(readSource(REGISTRY));
      const block = declared.slice(declared.indexOf(`id: '${id}'`));
      expect(
        block.slice(0, 1200),
        `the registry's version for ${id} does not match the register's "${version}"`,
      ).toContain(`'${version}'`);
    }
  });

  it('never publishes a document whose source could not be resolved', () => {
    // An empty or missing body uploaded as canon produces a CID that attests to
    // nothing, and — because the publisher also attaches CIDs to ratification
    // records — would bind a ratification to bytes that were never there.
    // (Added after a mutation that deleted the `continue` survived every other
    // check in this file: nothing else asserted the skip actually skips.)
    const route = stripComments(readSource(PUBLISH_ROUTE));
    const block = route.slice(
      route.indexOf('const doc = await def.sourceResolver()'),
      route.indexOf('const filename'),
    );
    expect(block.length, 'could not locate the resolve branch').toBeGreaterThan(40);
    expect(block, 'an unresolvable source is not detected').toMatch(/if \(!doc\)/);
    expect(block, 'an unresolvable document falls through to upload').toMatch(/\bcontinue;/);
  });

  it('every framework declares a resolver, a policy and a ratification requirement', () => {
    expect(CONSTITUTIONAL_FRAMEWORKS.length).toBeGreaterThan(6);
    const ids = CONSTITUTIONAL_FRAMEWORKS.map((f) => f.id);
    expect(new Set(ids).size, 'duplicate framework ids').toBe(ids.length);
    for (const def of CONSTITUTIONAL_FRAMEWORKS) {
      expect(typeof def.sourceResolver, `${def.id} has no resolver`).toBe('function');
      expect(typeof def.ratificationRequired).toBe('boolean');
      expect(typeof def.publicationPolicy.filename).toBe('function');
      expect(def.publicationPolicy.filename('1.0.0')).toMatch(/^[\w.-]+\.(json|md)$/);
    }
  });

  it('bundled JSON frameworks resolve to hashed documents', async () => {
    const def = getFrameworkDefinition('constitution')!;
    const doc = await def.sourceResolver();
    expect(doc).toBeTruthy();
    expect(doc!.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(doc!.byteLength).toBeGreaterThan(0);
    // The published bytes ARE the hashed bytes — one value, so a CID and a
    // contentHash cannot disagree.
    expect(Buffer.byteLength(doc!.body, 'utf8')).toBe(doc!.byteLength);
    // Byte-for-byte the publisher's historic serialisation, so the CIDs already
    // recorded in autodrive-cids.json stay reproducible from the registry.
    expect(doc!.body.startsWith('{\n  ')).toBe(true);
  });
});

describe('a capture lands IN the object it is attached to', () => {
  it('the attach-to-existing branch writes the content, in each idiom', () => {
    const route = stripComments(readSource(ASSIGN_ROUTE));
    const attachBlock = route.slice(route.indexOf('if (existingId)'), route.indexOf("} else if (destination === 'intent')"));
    expect(attachBlock.length, 'could not locate the attach branch').toBeGreaterThan(200);

    // Intent → a child IntentQube carrying the captured text.
    expect(attachBlock, 'attaching to an intent creates no child').toMatch(/parentIntentId: existingIntent\.id/);
    expect(attachBlock, 'the child carries no captured content').toMatch(/capture\.contentText/);

    // Venture → a signal-evidence item carrying source AND content.
    expect(attachBlock, 'attaching to a venture writes nothing').toMatch(/updateVentureQube\(/);
    expect(attachBlock).toMatch(/signalType: 'companion-capture'/);
    expect(attachBlock).toMatch(/note: capture\.contentText/);
  });

  it('a failed attachment leaves the capture in the Inbox', () => {
    // Silent loss is the defect. If the write fails the capture must NOT be
    // marked assigned, or the operator loses it with no way to retry.
    const route = stripComments(readSource(ASSIGN_ROUTE));
    const attachBlock = route.slice(route.indexOf('if (existingId)'), route.indexOf("} else if (destination === 'intent')"));
    expect(attachBlock).toMatch(/capture-attach-failed/);
    // The failure must return, not fall through to markCapturedObjectAssigned.
    expect(attachBlock).toMatch(/return NextResponse\.json\(/);
    expect(
      attachBlock.indexOf('capture-attach-failed') < route.indexOf('markCapturedObjectAssigned'),
      'the attach failure path runs after the capture is marked assigned',
    ).toBe(true);
  });

  it('the venture note field exists in BOTH the type and the runtime validator', () => {
    // types/ventureQube.ts's own header: "The runtime Zod validator must stay
    // in lockstep with the shapes here." A field in one and not the other is
    // either a type lie or a validation rejection at write time.
    expect(stripComments(readSource('types/ventureQube.ts'))).toMatch(/note\?: string;/);
    expect(stripComments(readSource('services/iqube/ventureQubeSchema.ts'))).toMatch(
      /note: z\.string\(\)\.max\(\d+\)\.optional\(\)/,
    );
  });

  it('both create-new paths remain reachable from the Inbox', () => {
    // The operator's other half: "to add to new projects or projects perhaps
    // inspired via browsing". Attach must not become the only path.
    const panel = stripComments(readSource('components/companion/CaptureInboxPanel.tsx'));
    expect(panel, 'no new-venture affordance').toMatch(/New Venture/);
    expect(panel, 'no new-intent affordance').toMatch(/newIntent/);
  });
});
