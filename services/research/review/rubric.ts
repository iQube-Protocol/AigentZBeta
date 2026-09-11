/**
 * The independence-and-contamination review template (SPEC §6, first entry) and
 * the prompt that carries it.
 *
 * The six labels are NOT redefined here. They are `ExperimentRelation` in
 * `services/research/experimentRelation.ts`, already shipped and canary-covered;
 * minting a second six-value vocabulary for the same question is the
 * `inv.engineering.037` parallel-implementation defect. This module imports
 * them and adds only what a reviewer needs that the type cannot carry: a
 * written criterion per label and the burden each one places on the reviewer.
 *
 * Prompt and rubric versions are frozen strings, committed BEFORE a run
 * (rulings §7). Changing either is a new version with a stated justification —
 * not an edit, because an edited prompt makes every prior run unreproducible
 * while leaving the manifests claiming otherwise.
 */

import { EXPERIMENT_RELATIONS, type ExperimentRelation } from '@/services/research/experimentRelation';
import type { ReviewPackage, ReviewSubjectRecord, ReviewerSlot } from './types';
import { ReviewRefusal } from './types';

export const INDEPENDENCE_RUBRIC_ID = 'rubric.independence-contamination';
export const INDEPENDENCE_RUBRIC_VERSION = '1.0.0';
export const INDEPENDENCE_PROMPT_VERSION = '1.0.0';

/**
 * The criterion per label, written for a reader who has never seen this
 * codebase. `domain-adjacent` carries an extra burden because it is the
 * permissive label — without a stated reason it becomes the comfortable home
 * for everything uncertain, which is exactly what the narrow definition exists
 * to prevent.
 */
export const RELATION_CRITERIA: Record<ExperimentRelation, string> = {
  independent:
    'Predates the experiment and its task construction, and was not derived from the target system, ' +
    'the task set, expected answers, or observed outcomes. Origin inside the authoring organisation ' +
    'does NOT by itself make a statement dependent.',
  'domain-adjacent':
    'Relevant to the experimental domain and predating task construction, but not derived from the ' +
    'target system, task set, expected answers or observed outcomes. REQUIRES a written reason ' +
    'naming the adjacency; without one the row is not admissible under this label.',
  'target-derived':
    'Derived from the system under evaluation. Using it to test that system is circular.',
  'task-derived':
    'Derived from the task set or its expected answers. Measures recall of the key, not capability.',
  'outcome-informed':
    'Authored or revised after observing pilot or experiment outcomes — the interpretation moved ' +
    'after the result.',
  unknown:
    'The evidence supplied is insufficient, unverifiable, contradictory or unavailable. This is a ' +
    'correct and expected answer, not a failure. It fails closed.',
};

export const RUBRIC_INSTRUCTIONS: readonly string[] = [
  'You are adjudicating INDEPENDENCE against a stated target. You are not judging whether a ' +
    'statement is true, useful, well written, or important.',
  'Decide one thing per row: how the row relates to the stated target, its tasks and its observed outcomes.',
  'Answer `unknown` whenever the supplied evidence does not let you decide. `unknown` is a correct ' +
    'answer and carries no penalty. Do not infer missing chronology or missing provenance.',
  'Where a row reaches you through a signed evidence summary rather than the source itself, treat ' +
    'the summary as evidence, not authority. You remain free to answer `unknown` or a contaminated ' +
    'label whatever the summary asserts.',
  'Give a reason for every row. A `domain-adjacent` answer without a reason naming the adjacency ' +
    'will be refused.',
  'State your limitations explicitly. An unstated limitation is indistinguishable from a claim of ' +
    'certainty you do not have.',
  'You have no authority to change, approve, freeze, rank or promote anything you are shown.',
];

export const DECISION_OUTPUT_SCHEMA = `{
  "decisions": [
    {
      "subjectRef": "<the exact subjectRef given>",
      "decision": "independent | domain-adjacent | target-derived | task-derived | outcome-informed | unknown",
      "reason": "<one or two sentences; required>",
      "evidenceRefs": ["<refs from the row you relied on>"],
      "limitations": ["<what you could not verify>"],
      "confidence": 0.0
    }
  ]
}`;

export interface ReviewerPromptInput {
  reviewerSlot: ReviewerSlot;
  pkg: ReviewPackage;
  subjects: ReviewSubjectRecord[];
  /** Block decisions are part of the first-pass review only. */
  includeBlockDecisions: boolean;
}

/**
 * Compose the reviewer prompt. Deterministic: no clock, no randomness, no
 * ambient configuration. The same package and subject list always produce
 * byte-identical text, which is what makes a prompt hash meaningful.
 *
 * Note what this function cannot do: its input type has no field for another
 * reviewer's decisions. Isolation is enforced structurally first
 * (`ReviewerPromptInput` has nowhere to put them) and then verified at runtime
 * by `assertPromptCarriesNoPriorAdjudication` in `isolation.ts` — belt and
 * braces, because SPEC §14.5 is the requirement most easily lost to a
 * convenience refactor, and losing it turns dual review into confirmation.
 */
export function buildReviewerPrompt(input: ReviewerPromptInput): { system: string; user: string } {
  const { pkg, subjects, includeBlockDecisions } = input;
  if (subjects.length === 0) {
    throw new ReviewRefusal('empty-reviewer-assignment', 'a reviewer cannot be dispatched with zero subjects');
  }

  const system = [
    'You are an independent reviewer adjudicating the independence of statements against a stated experimental target.',
    '',
    `RUBRIC ${INDEPENDENCE_RUBRIC_ID} v${INDEPENDENCE_RUBRIC_VERSION}`,
    ...RUBRIC_INSTRUCTIONS.map((s) => `- ${s}`),
    '',
    'LABELS',
    ...EXPERIMENT_RELATIONS.map((r) => `- ${r}: ${RELATION_CRITERIA[r]}`),
    '',
    'OUTPUT',
    'Return a single JSON object and nothing else, in exactly this shape:',
    DECISION_OUTPUT_SCHEMA,
  ].join('\n');

  const blocks: string[] = [
    'TARGET OF THE EXPERIMENT',
    pkg.targetDefinition,
    '',
    'THE TARGET IS NOT',
    ...pkg.nonTargets.map((n) => `- ${n}`),
  ];

  if (pkg.chronology && pkg.chronology.length > 0) {
    blocks.push('', 'PROJECT CHRONOLOGY', ...pkg.chronology.map((c) => `- ${c}`));
  }

  if (includeBlockDecisions && pkg.blockDecisions.length > 0) {
    blocks.push('', 'GOVERNED BLOCK DECISIONS SUBMITTED FOR YOUR REVIEW');
    for (const b of pkg.blockDecisions) {
      blocks.push(
        `- block ${b.blockId} (ruling ${b.ruling.rulingId} v${b.ruling.rulingVersion}, authority: ${b.ruling.authority})`,
        `  population query: ${b.populationQuery}`,
        `  ruling text: ${b.ruling.text}`,
        `  assessed ${b.assessed}; extracted for individual review ${b.extracted.length}; remaining under the block ${b.admitted}`,
        `  earliest creation ${b.earliestCreatedAt ?? 'n/a'}; latest creation ${b.latestCreatedAt ?? 'n/a'}`,
        `  task construction begun at package time: ${b.taskConstructionBegun ? 'yes' : 'no'} (${b.taskConstructionEvidence})`,
        `  namespaces: ${JSON.stringify(b.namespaceCounts)}`,
        `  representative sample (review these individually): ${b.representativeSample.join(', ')}`,
      );
    }
  }

  if (pkg.evidenceSummaries && pkg.evidenceSummaries.length > 0) {
    blocks.push(
      '',
      'SIGNED EVIDENCE SUMMARIES (evidence, not authority — you may still answer `unknown`)',
      ...pkg.evidenceSummaries,
    );
  }

  blocks.push('', `ROWS TO ADJUDICATE (${subjects.length})`);
  for (const s of subjects) {
    blocks.push(
      '---',
      `subjectRef: ${s.subjectRef}`,
      `namespace: ${s.namespace}`,
      `statement: ${s.statement}`,
      `sourceProvenance: ${s.sourceProvenance ?? '(unclassified)'}`,
      `sourceRefs: ${s.sourceRefs.length ? s.sourceRefs.join(', ') : '(none recorded)'}`,
      `derivationRefs: ${s.derivationRefs.length ? s.derivationRefs.join(', ') : '(none recorded)'}`,
      `createdAt: ${s.createdAt}`,
      `revisedAt: ${s.revisedAt ?? '(not revised)'}`,
      `lifecycleStatus: ${s.lifecycleStatus}`,
      `privateEvidence: ${s.privateEvidenceRef ? `via signed summary ${s.privateEvidenceRef}` : 'none'}`,
    );
  }

  return { system, user: blocks.join('\n') };
}
