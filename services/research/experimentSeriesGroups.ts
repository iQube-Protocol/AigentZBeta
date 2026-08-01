/**
 * experimentSeriesGroups — the series/section grouping for research-lab
 * experiment CHECKBOXES (e.g. the steward's "Experiments this invitation
 * grants" list), derived from the SAME sidebar sections the Laboratory →
 * Experiments navigator uses (components/composer/InvariantExperimentLab.tsx),
 * never a hand-duplicated copy (inv.engineering.036, operator instruction
 * 2026-08-01: "these experiments in the invite should be grouped into
 * clusters like they are in the lab so they are easier to find").
 *
 * Only sections containing at least one EXPERIMENT_REGISTRY-mapped item are
 * kept — cross-cutting Lab capabilities with no experiment id (Discovery,
 * Independent Review, Acceptance Tests, Outputs, Exchange) have nothing to
 * assign an invitation scope to and are correctly absent here.
 */

import { SECTIONS, expIdForTab } from '@/components/composer/InvariantExperimentLab';

export interface ExperimentSeriesGroup {
  title: string;
  experimentIds: string[];
}

/**
 * The series groups, in the Lab's own sidebar order. Recomputed on each call
 * (SECTIONS itself is a module-level constant already finalized by the
 * registry-completeness guard by the time any consumer imports it) — cheap
 * enough that memoizing would be premature.
 */
export function deriveExperimentSeriesGroups(): ExperimentSeriesGroup[] {
  const groups: ExperimentSeriesGroup[] = [];
  for (const section of SECTIONS) {
    const experimentIds: string[] = [];
    for (const item of section.items) {
      const expId = expIdForTab(item.id);
      if (expId) experimentIds.push(expId);
    }
    if (experimentIds.length > 0) groups.push({ title: section.title, experimentIds });
  }
  return groups;
}

/**
 * Bucket a flat `{id, label}` scope list into the series groups above, in
 * group order, with an honest "Other" bucket for anything the grouping does
 * not name — so a future experiment or scope this module doesn't yet know
 * about is never silently dropped from the invitation form.
 */
export function groupAssignableScopesBySeries<T extends { id: string }>(
  scopes: T[],
): Array<{ title: string; scopes: T[] }> {
  const groups = deriveExperimentSeriesGroups();
  const byId = new Map(scopes.map((s) => [s.id, s] as const));
  const used = new Set<string>();
  const out: Array<{ title: string; scopes: T[] }> = [];
  for (const group of groups) {
    const matched = group.experimentIds.map((id) => byId.get(id)).filter((s): s is T => !!s);
    matched.forEach((s) => used.add(s.id));
    if (matched.length > 0) out.push({ title: group.title, scopes: matched });
  }
  const remaining = scopes.filter((s) => !used.has(s.id));
  if (remaining.length > 0) out.push({ title: 'Other', scopes: remaining });
  return out;
}
