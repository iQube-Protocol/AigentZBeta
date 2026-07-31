/**
 * capabilityCompletionArtifact — the DERIVATION and VALIDATION half of CCR-001,
 * schema `capability-completion-artifact/v2.0`.
 *
 * EXTENDS `services/constitutional/capabilityRegistry.ts` (CFS-032) rather than
 * standing beside it. That registry remains the acceptance ceremony and
 * `briefUrl` remains the single pointer to a capability's document; this module
 * only reads that document and says whether it is constitutionally complete.
 * Nothing here registers, accepts, or accrues Standing — there is one
 * acceptance path and it is not this one.
 *
 * THE MARKDOWN IS THE SOURCE OF TRUTH (CFS-049 §5). `parseCompletionArtifact`
 * DERIVES the machine-readable shape from the Brief's markdown twin; there is
 * deliberately no hand-authored JSON mirror to drift against it
 * (`inv.engineering.036` / `inv.engineering.037`). This is also why the
 * completion canaries can be trusted: they read the same bytes an operator
 * reads.
 *
 * PURE — string in, object out. No fs, no network, no Supabase. Disk-resolution
 * of proof references (`CAN-CCR-5`) belongs to the canary, which already has a
 * source-reading helper (`tests/_lib/sourceAuthority`); duplicating a reader
 * here would be a second way to answer one question.
 *
 * Parsing discipline: a section that cannot be found yields an EMPTY value and
 * a validation issue — never a plausible-looking default. A completion artifact
 * that silently validated against fabricated content would be worse than no
 * artifact at all, which is the `CS-001` stale-handoff defect class.
 */

import {
  CAPABILITY_COMPLETION_SCHEMA_VERSION,
  COMMONS_PROOF_CLASSES,
  COMPLETION_LIFECYCLE,
  EMISSION_KINDS,
  EVIDENCED_STATUSES,
  INVARIANT_PROVENANCE_KINDS,
  INVARIANT_STATUSES,
  UNEVIDENCED_PROVENANCE,
  mapCompletionStage,
  type CapabilityCompletionArtifact,
  type CapabilityEmission,
  type CommonsProofClass,
  type CompletionIssue,
  type CompletionStage,
  type CompletionValidationResult,
  type EmissionKind,
  type InvariantProvenance,
  type InvariantStatus,
  type ReproductionInvariant,
} from '@/types/capabilityCompletion';

// ---------------------------------------------------------------------------
// Markdown readers (pure, deliberately small)
// ---------------------------------------------------------------------------

/** Split a document into its `## ` sections, in document order. */
function sections(md: string): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = [];
  const lines = md.split('\n');
  let heading: string | null = null;
  let buf: string[] = [];
  for (const line of lines) {
    const m = /^##\s+(.*\S)\s*$/.exec(line);
    if (m) {
      if (heading !== null) out.push({ heading, body: buf.join('\n') });
      heading = m[1];
      buf = [];
    } else if (heading !== null) {
      buf.push(line);
    }
  }
  if (heading !== null) out.push({ heading, body: buf.join('\n') });
  return out;
}

/** The body of the first `## ` section whose heading starts with `prefix`. */
function sectionBody(md: string, prefix: string): string | null {
  const lowered = prefix.toLowerCase();
  const hit = sections(md).find((s) => s.heading.toLowerCase().startsWith(lowered));
  return hit ? hit.body : null;
}

/** The body of a `### ` sub-section within a section body. */
function subsectionBody(body: string, prefix: string): string | null {
  const lowered = prefix.toLowerCase();
  const parts = body.split(/^###\s+/m).slice(1);
  const hit = parts.find((p) => p.split('\n')[0].trim().toLowerCase().startsWith(lowered));
  if (!hit) return null;
  return hit.split('\n').slice(1).join('\n');
}

/** Top-level `- ` / `1. ` list items, de-marked and trimmed. Nested items are
 *  folded into their parent so a two-level list reads as one entry. */
function listItems(body: string | null): string[] {
  if (!body) return [];
  const out: string[] = [];
  for (const raw of body.split('\n')) {
    const top = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(raw);
    if (top) {
      out.push(top[1].trim());
      continue;
    }
    // A continuation or nested line belongs to the item above it.
    if (out.length && /^\s+\S/.test(raw)) out[out.length - 1] += ` ${raw.trim()}`;
  }
  return out.filter((s) => s.length > 0);
}

/** The first prose paragraph of a body — the statement, not the bullet list. */
function firstParagraph(body: string | null): string {
  if (!body) return '';
  const para: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) {
      if (para.length) break;
      continue;
    }
    if (/^(?:[-*]|\d+\.)\s/.test(line) || line.startsWith('#') || line.startsWith('|')) {
      if (para.length) break;
      continue;
    }
    para.push(line);
  }
  return para.join(' ').trim();
}

/** `| Field | Value |` rows as a lower-cased-key map. Header/separator rows are
 *  skipped; a duplicate key keeps the FIRST value (documents read top-down). */
function tableMap(body: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!body) return out;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    if (/^\|[\s:|-]+\|$/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const key = cells[0].replace(/[`*]/g, '').trim().toLowerCase();
    if (!key || key === 'field') continue;
    if (!(key in out)) out[key] = cells[1].trim();
  }
  return out;
}

/** Strip markdown emphasis/code marks from a scalar cell value. */
function plain(value: string | undefined): string {
  return (value ?? '').replace(/[`*]/g, '').trim();
}

/** Split a cell holding several backticked or comma-separated references. */
function refList(value: string | undefined): string[] {
  const raw = value ?? '';
  const ticked = [...raw.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  if (ticked.length) return ticked;
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^none$/i.test(s));
}

/** A `- **Label:** value` field, including any continuation lines beneath it. */
function labelledField(body: string, label: string): string | null {
  const lines = body.split('\n');
  const head = new RegExp(`^[-*]\\s+\\*\\*${label}:?\\*\\*\\s*(.*)$`, 'i');
  for (let i = 0; i < lines.length; i++) {
    const m = head.exec(lines[i].trim());
    if (!m) continue;
    const parts = [m[1].trim()];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (/^\s*$/.test(next)) break;
      if (/^[-*]\s+\*\*/.test(next.trim())) break;
      if (/^#{1,6}\s/.test(next)) break;
      parts.push(next.trim());
    }
    return parts.join(' ').trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// §7.7–7.9 — invariant sections
// ---------------------------------------------------------------------------

/** `## <ID> — <short name>` where ID looks like `MS-4`, `CCR-INV-9`, `INV-12`. */
const INVARIANT_HEADING = /^([A-Z][A-Z0-9]{0,7}(?:-[A-Z]{1,6})?-\d+)\s+[—–-]\s+(.+)$/;

/** Repo-relative proof paths named inside an "Enforced by" field. */
function proofPaths(text: string): string[] {
  const ticked = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  const paths = ticked.filter((t) => /^[\w./()[\]-]+\.(test|spec)\.[cm]?tsx?$/.test(t));
  return [...new Set(paths)];
}

function parseInvariants(md: string): ReproductionInvariant[] {
  const out: ReproductionInvariant[] = [];
  for (const { heading, body } of sections(md)) {
    const m = INVARIANT_HEADING.exec(heading);
    if (!m) continue;
    const enforcedBy = labelledField(body, 'Enforced by') ?? '';
    const provenanceRaw = plain(labelledField(body, 'Provenance') ?? '').toLowerCase();
    const statusRaw = plain(labelledField(body, 'Status') ?? '').toLowerCase();
    const stageRaw = plain(labelledField(body, 'Stage') ?? '').toLowerCase();
    out.push({
      id: m[1],
      statement: firstParagraph(body),
      provenance: provenanceRaw as InvariantProvenance,
      defect: labelledField(body, 'Broke it') ?? '',
      canaries: proofPaths(enforcedBy),
      status: statusRaw as InvariantStatus,
      // Absent is legitimate — an artifact may record only the source value.
      ...(stageRaw ? { completionStage: stageRaw as CompletionStage } : {}),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// §7.6a — emissions
// ---------------------------------------------------------------------------

/** `- **kind** \`ref\` — what triggers it`. The kind is validated, not assumed. */
const EMISSION_ITEM = /^\*\*([a-z-]+)\*\*\s+`([^`]+)`\s*[—–-]\s*(\S[\s\S]*)$/;

/** An explicit "nothing is emitted" marker — parsed to an EMPTY list, which is
 *  a different state from an absent section and is checked differently. */
const EMISSION_NONE = /^none\b/i;

/**
 * Parse the `### Emits` list items. A malformed line yields an entry with an
 * empty `kind`, which validation then reports — it is never silently dropped,
 * because a dropped line would turn "wrote it wrong" into "emits nothing",
 * which is the exact conflation this section exists to prevent.
 */
function parseEmissions(items: string[]): CapabilityEmission[] {
  const out: CapabilityEmission[] = [];
  for (const item of items) {
    if (EMISSION_NONE.test(item.trim())) continue;
    const m = EMISSION_ITEM.exec(item.trim());
    if (!m) {
      out.push({ kind: '' as EmissionKind, ref: '', trigger: item.trim() });
      continue;
    }
    out.push({ kind: m[1] as EmissionKind, ref: m[2].trim(), trigger: m[3].trim() });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/**
 * Derive the `capability-completion-artifact/v2.0` shape from a Brief's
 * markdown twin. Returns the shape unvalidated — run
 * `validateCompletionArtifact` on the result. A missing section produces an
 * empty field (which validation then reports), never an invented one.
 */
export function parseCompletionArtifact(markdown: string): CapabilityCompletionArtifact {
  const identityTable = tableMap(sectionBody(markdown, 'Capability identity'));
  const boundary = sectionBody(markdown, 'Capability boundary');
  const location = sectionBody(markdown, 'Location');
  const commonsTable = tableMap(sectionBody(markdown, 'Commons publication record'));
  const emitsBody = boundary ? subsectionBody(boundary, 'Emits') : null;
  const rationaleBody = boundary ? subsectionBody(boundary, 'Emission rationale') : null;

  return {
    schemaVersion: CAPABILITY_COMPLETION_SCHEMA_VERSION,
    identity: {
      capabilityId: plain(identityTable['capability id']),
      displayLabel: plain(identityTable['display label']),
      artifactVersion: plain(identityTable['artifact version']),
      date: plain(identityTable['date']),
      governingDocuments: refList(identityTable['governing documents']),
      artifactPath: plain(identityTable['artifact path']),
    },
    behaviouralCapabilityStatement: firstParagraph(
      sectionBody(markdown, 'Behavioural capability statement'),
    ),
    purpose: firstParagraph(sectionBody(markdown, 'Purpose')),
    location: {
      surfaces: listItems(location ? subsectionBody(location, 'Surfaces') : null),
      sourcePaths: listItems(location ? subsectionBody(location, 'Source paths') : null),
    },
    invocation: listItems(sectionBody(markdown, 'Invocation')),
    boundary: {
      owns: listItems(boundary ? subsectionBody(boundary, 'Owns') : null),
      doesNotOwn: listItems(boundary ? subsectionBody(boundary, 'Does not own') : null),
      dependencies: listItems(boundary ? subsectionBody(boundary, 'Dependencies') : null),
      externalAuthorities: listItems(
        boundary ? subsectionBody(boundary, 'External authorities') : null,
      ),
      // `null` is LOAD-BEARING: an absent section is "forgotten" and must stay
      // distinguishable from an empty one ("none"). Never coalesce it to [].
      emits: emitsBody === null ? null : parseEmissions(listItems(emitsBody)),
      emissionRationale: firstParagraph(rationaleBody) || null,
    },
    implementationFreedom: firstParagraph(sectionBody(markdown, 'Implementation freedom')),
    reproductionInvariants: parseInvariants(markdown),
    reproductionProcedure: listItems(sectionBody(markdown, 'Reproduction procedure')),
    modificationRules: listItems(sectionBody(markdown, 'Modification rules')),
    knownHazards: listItems(sectionBody(markdown, 'Known hazards')),
    operationalEvidence: listItems(sectionBody(markdown, 'Operational evidence')),
    commons: {
      proofClass: plain(commonsTable['proof class']).toLowerCase() as CommonsProofClass,
      claimScope: plain(commonsTable['claim scope']),
      evidenceRefs: refList(commonsTable['evidence references']),
      approvalRecordRef: /^none\b/i.test(plain(commonsTable['approval record']))
        ? null
        : plain(commonsTable['approval record']) || null,
      published: /^(yes|true)$/i.test(plain(commonsTable['published'])),
      lineage: {
        capabilityId: plain(commonsTable['lineage — capability'] ?? commonsTable['lineage - capability']),
        artifactPath: plain(commonsTable['lineage — artifact'] ?? commonsTable['lineage - artifact']),
        sourceReferences: refList(
          commonsTable['lineage — sources'] ?? commonsTable['lineage - sources'],
        ),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Validation — CCR-INV-12, "completion claims must be machine-verifiable"
// ---------------------------------------------------------------------------

/**
 * A behavioural statement must describe BEHAVIOUR, not merely name files
 * (CCR-INV-7 / `CAN-CCR-4`). The test is structural rather than semantic: a
 * statement whose content is mostly paths, or which names no observable
 * behaviour at all, is refused. A short sentence of prose passes; a list of
 * modules does not.
 */
export function readsAsBehaviour(statement: string): boolean {
  const text = statement.trim();
  if (text.length < 40) return false;
  const codeRefs = [...text.matchAll(/`[^`]+`/g)].map((m) => m[0]);
  const codeChars = codeRefs.reduce((n, r) => n + r.length, 0);
  // More than half the statement being code references means it is a location
  // list wearing a sentence's clothes.
  if (codeChars * 2 > text.length) return false;
  // The prose remainder must itself be substantial, not a caption.
  const prose = text.replace(/`[^`]+`/g, ' ').replace(/\s+/g, ' ').trim();
  return prose.split(' ').filter((w) => w.length > 2).length >= 12;
}

function isNonEmpty(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Validate a derived artifact against `CAPABILITY_COMPLETION_SCHEMA_VERSION`
 * (`capability-completion-artifact/v2.0` at the time of writing; the constant is
 * the source of truth, never this comment).
 * PURE. Accumulates every fault with a path, in the
 * `participantApplicationValidator` idiom — one call reports the whole
 * document's state rather than the first thing wrong with it.
 */
export function validateCompletionArtifact(input: unknown): CompletionValidationResult {
  const issues: CompletionIssue[] = [];
  const push = (path: string, message: string, canary?: CompletionIssue['canary']) =>
    issues.push(canary ? { path, message, canary } : { path, message });

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [{ path: '$', message: 'artifact must be an object' }] };
  }
  const a = input as Partial<CapabilityCompletionArtifact>;

  // Version first — a document of another version is refused, never coerced.
  if (a.schemaVersion !== CAPABILITY_COMPLETION_SCHEMA_VERSION) {
    push('schemaVersion', `must be '${CAPABILITY_COMPLETION_SCHEMA_VERSION}'`);
    return { valid: false, issues };
  }

  // §7.1 identity
  const id = a.identity;
  if (!id || typeof id !== 'object') {
    push('identity', 'missing identity block (§7.1)');
  } else {
    for (const field of ['capabilityId', 'displayLabel', 'artifactVersion', 'date', 'artifactPath'] as const) {
      if (!isNonEmpty(id[field])) push(`identity.${field}`, `missing (§7.1)`);
    }
    if (isNonEmpty(id.date) && !/^\d{4}-\d{2}-\d{2}$/.test(id.date!)) {
      push('identity.date', 'must be an ISO date (YYYY-MM-DD)');
    }
    if (!Array.isArray(id.governingDocuments) || id.governingDocuments.length === 0) {
      push('identity.governingDocuments', 'names no governing document (§7.1)');
    }
  }

  // §7.2 behavioural capability statement — CCR-INV-7 / CAN-CCR-4
  if (!isNonEmpty(a.behaviouralCapabilityStatement)) {
    push('behaviouralCapabilityStatement', 'missing (§7.2)', 'CAN-CCR-4');
  } else if (!readsAsBehaviour(a.behaviouralCapabilityStatement!)) {
    push(
      'behaviouralCapabilityStatement',
      'reads as a list of code locations, not a statement of behaviour (CCR-INV-7)',
      'CAN-CCR-4',
    );
  }

  if (!isNonEmpty(a.purpose)) push('purpose', 'missing (§7.3)');
  if (!isNonEmpty(a.implementationFreedom)) {
    push('implementationFreedom', 'missing (§7.7 / CCR-INV-8)');
  }

  // §7.4 / §7.5
  if (!a.location || a.location.surfaces.length === 0) {
    push('location.surfaces', 'names no operating surface (§7.4)');
  }
  if (!a.location || a.location.sourcePaths.length === 0) {
    push('location.sourcePaths', 'names no source path (§7.4)');
  }
  if (!Array.isArray(a.invocation) || a.invocation.length === 0) {
    push('invocation', 'states no invocation route (§7.5)');
  }

  // §7.6 boundary — `doesNotOwn` is the field that names the defect class
  const b = a.boundary;
  if (!b) {
    push('boundary', 'missing capability boundary (§7.6)');
  } else {
    if (b.owns.length === 0) push('boundary.owns', 'claims no ownership (§7.6)');
    if (b.doesNotOwn.length === 0) {
      push('boundary.doesNotOwn', 'states nothing it does NOT own — the boundary is unfalsifiable (§7.6)');
    }

    // §7.6a / CB-3 — CAN-CCR-9. Three states, held apart:
    //   absent  → "forgotten"  → REFUSED
    //   []      → "none"       → valid ONLY with a rationale
    //   [...]   → "these"      → each entry must be well-formed
    // An optional field would let all three collapse into one, which is the
    // failure this extension exists to eliminate (operator ruling 2026-07-27).
    if (!Array.isArray(b.emits)) {
      push(
        'boundary.emits',
        'declares no Emits section — an omitted field reads as "forgotten", which is indistinguishable from "none" and "unknown" (§7.6a / CB-3)',
        'CAN-CCR-9',
      );
    } else if (b.emits.length === 0) {
      if (!isNonEmpty(b.emissionRationale ?? '')) {
        push(
          'boundary.emissionRationale',
          'emits nothing and says nothing about why — an empty list with no rationale is "unknown", not "none" (§7.6a)',
          'CAN-CCR-9',
        );
      }
    } else {
      b.emits.forEach((e, i) => {
        const at = `boundary.emits[${i}]`;
        if (!(EMISSION_KINDS as readonly string[]).includes(e.kind)) {
          push(
            `${at}.kind`,
            `emission ${i} carries no emission kind (got '${e.kind ?? ''}') — expected one of ${EMISSION_KINDS.join(', ')}`,
            'CAN-CCR-9',
          );
        }
        if (!isNonEmpty(e.ref)) {
          push(`${at}.ref`, `emission ${i} names no reference — a receipt type, store, format or log prefix`, 'CAN-CCR-9');
        }
        if (!isNonEmpty(e.trigger)) {
          push(`${at}.trigger`, `emission ${i} names no triggering act — an emission nobody writes is a wish`, 'CAN-CCR-9');
        }
      });
    }
  }

  // §7.7–7.9 invariants
  const invs = a.reproductionInvariants;
  if (!Array.isArray(invs) || invs.length === 0) {
    push('reproductionInvariants', 'no reproduction invariant recorded (§7.7 / CCR-INV-1)');
  } else {
    const seen = new Set<string>();
    invs.forEach((inv, i) => {
      const at = `reproductionInvariants[${i}]`;
      if (!isNonEmpty(inv.id)) push(`${at}.id`, 'missing id');
      else if (seen.has(inv.id)) push(`${at}.id`, `duplicate invariant id '${inv.id}'`);
      else seen.add(inv.id);

      const label = inv.id || `#${i}`;
      if (!isNonEmpty(inv.statement)) push(`${at}.statement`, `${label} states no rule`);

      if (!(INVARIANT_PROVENANCE_KINDS as readonly string[]).includes(inv.provenance)) {
        push(
          `${at}.provenance`,
          `${label} carries no §8 provenance kind (got '${inv.provenance ?? ''}')`,
          'CAN-CCR-2',
        );
      }
      if (!(INVARIANT_STATUSES as readonly string[]).includes(inv.status)) {
        push(`${at}.status`, `${label} carries no status (got '${inv.status ?? ''}')`);
      }

      // Map, don't unify (operator ruling 2026-07-27). CCR-001's ladder is
      // carried ALONGSIDE the crystal status; when both are present they must
      // agree under the one-way projection. A stage that contradicts its source
      // value is the drift that unification would have hidden.
      if (inv.completionStage !== undefined) {
        if (!(COMPLETION_LIFECYCLE as readonly string[]).includes(inv.completionStage)) {
          push(
            `${at}.completionStage`,
            `${label} carries stage '${inv.completionStage}', which is not on CCR-001's completion ladder`,
          );
        } else {
          const projected = mapCompletionStage(inv.completionStage as CompletionStage);
          if (projected !== null && projected !== inv.status) {
            push(
              `${at}.completionStage`,
              `${label} is at stage '${inv.completionStage}', which projects to '${projected}', but its source status is '${inv.status}'`,
            );
          }
        }
      }

      // CAN-CCR-2 — no validated invariant without provenance.
      if (EVIDENCED_STATUSES.includes(inv.status) && inv.provenance === UNEVIDENCED_PROVENANCE) {
        push(
          `${at}.provenance`,
          `${label} is '${inv.status}' but its provenance is '${UNEVIDENCED_PROVENANCE}' — an evidenced invariant must name how it came to be known (CCR-INV-4)`,
          'CAN-CCR-2',
        );
      }
      // An evidenced, regression-class invariant must name the defect that proved it.
      if (EVIDENCED_STATUSES.includes(inv.status) && !isNonEmpty(inv.defect)) {
        push(
          `${at}.defect`,
          `${label} is '${inv.status}' but records no development-derived defect (§7.8)`,
          'CAN-CCR-2',
        );
      }
      // CAN-CCR-3 — no ratified invariant without enforcement.
      if (inv.status === 'canonical' && (!Array.isArray(inv.canaries) || inv.canaries.length === 0)) {
        push(
          `${at}.canaries`,
          `${label} is canonical but names no executable proof — a ratified invariant must be enforceable (CCR-INV-5)`,
          'CAN-CCR-3',
        );
      }
    });
  }

  // §7.10–7.13
  if (!Array.isArray(a.reproductionProcedure) || a.reproductionProcedure.length === 0) {
    push('reproductionProcedure', 'no reproduction procedure (§7.10 / CCR-INV-1)');
  }
  if (!Array.isArray(a.modificationRules) || a.modificationRules.length === 0) {
    push('modificationRules', 'no modification rules (§7.11)');
  }
  if (!Array.isArray(a.knownHazards) || a.knownHazards.length === 0) {
    push('knownHazards', 'no known hazards recorded (§7.12) — write "None" explicitly if there are none');
  }
  if (!Array.isArray(a.operationalEvidence) || a.operationalEvidence.length === 0) {
    push('operationalEvidence', 'no operational evidence (§7.13)');
  }

  // §7.14 Commons — CCR-INV-10, Amendment E §E.3 Principle 5, CAN-CCR-8
  const c = a.commons;
  if (!c) {
    push('commons', 'missing Commons publication record (§7.14)', 'CAN-CCR-8');
  } else {
    if (!(COMMONS_PROOF_CLASSES as readonly string[]).includes(c.proofClass)) {
      push('commons.proofClass', `not one of the four native proof classes (got '${c.proofClass ?? ''}')`);
    }
    if (!isNonEmpty(c.claimScope)) {
      push('commons.claimScope', 'a submission without a claim scope is refused (Principle 5)');
    }
    if (!Array.isArray(c.evidenceRefs) || c.evidenceRefs.length === 0) {
      push('commons.evidenceRefs', 'a submission that cannot name its evidence cannot enter (Principle 5)');
    }
    if (c.published && !isNonEmpty(c.approvalRecordRef ?? '')) {
      push(
        'commons.approvalRecordRef',
        'published without an ApprovalRecord — no code path may write a commons record without one (Amendment E §E.3.4)',
        'CAN-CCR-8',
      );
    }
    // CAN-CCR-8 — publication preserves lineage.
    const lin = c.lineage;
    if (!lin || !isNonEmpty(lin.capabilityId) || !isNonEmpty(lin.artifactPath)) {
      push('commons.lineage', 'publication must preserve lineage back to the capability and its artifact', 'CAN-CCR-8');
    } else {
      if (a.identity && isNonEmpty(a.identity.capabilityId) && lin.capabilityId !== a.identity.capabilityId) {
        push('commons.lineage.capabilityId', `lineage names '${lin.capabilityId}' but the artifact is '${a.identity.capabilityId}'`, 'CAN-CCR-8');
      }
      if (a.identity && isNonEmpty(a.identity.artifactPath) && lin.artifactPath !== a.identity.artifactPath) {
        push('commons.lineage.artifactPath', `lineage names '${lin.artifactPath}' but the artifact is '${a.identity.artifactPath}'`, 'CAN-CCR-8');
      }
      if (!Array.isArray(lin.sourceReferences) || lin.sourceReferences.length === 0) {
        push('commons.lineage.sourceReferences', 'publication drops the sources it was derived from', 'CAN-CCR-8');
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

/** Every proof path the artifact claims, de-duplicated — the input to
 *  `CAN-CCR-5`'s disk-resolution check. */
export function declaredProofPaths(artifact: CapabilityCompletionArtifact): string[] {
  return [...new Set(artifact.reproductionInvariants.flatMap((i) => i.canaries))];
}

/**
 * Every emission of a given kind the artifact claims, de-duplicated — the input
 * to `CAN-CCR-9`'s resolution check.
 *
 * The resolution itself lives in the canary, not here, for the same reason
 * `CAN-CCR-5`'s does: this module is PURE, and resolving a receipt type means
 * reading `services/receipts/activityReceiptService.ts` off disk. A second
 * source reader here would be a second way to answer one question.
 */
export function declaredEmissionRefs(
  artifact: CapabilityCompletionArtifact,
  kind: EmissionKind,
): string[] {
  const emits = artifact.boundary?.emits;
  if (!Array.isArray(emits)) return [];
  return [...new Set(emits.filter((e) => e.kind === kind).map((e) => e.ref))];
}
