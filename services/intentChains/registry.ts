/**
 * Intent Chain Template Registry — load, validate, and look up templates.
 *
 * Templates live as JSON files under services/intentChains/templates/ and
 * are loaded once on first access into an in-memory map. Validation
 * enforces:
 *   - Step IDs are unique within a template
 *   - `next` and branch `next` refs resolve to existing step IDs
 *   - Per-kind required configs are present (compose has `compose`, rpc
 *     has `rpc`, etc.)
 *   - No cycles in the default `next` graph (branches can reroute back)
 *   - cost_qc is an integer ≥ 0 when present
 *
 * Spec: codexes/packs/agentiq/items/AGENTIQ_INTENT_CHAINS_SPEC.md
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ChainTemplate, ChainStep, ChainStepKind } from '@/types/intentChains';

interface RegistryEntry {
  template: ChainTemplate;
  loaded_at: string;
  source_path: string;
}

let _registry: Map<string, RegistryEntry> | null = null;
let _loadWarnings: string[] = [];

const TEMPLATE_DIR = join(process.cwd(), 'services', 'intentChains', 'templates');

// ── Loader ──────────────────────────────────────────────────────────────

export function loadRegistry(force = false): Map<string, RegistryEntry> {
  if (_registry && !force) return _registry;

  _registry = new Map();
  _loadWarnings = [];

  let files: string[] = [];
  try {
    files = readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.json'));
  } catch (err) {
    _loadWarnings.push(`template_dir_unreadable: ${(err as Error).message}`);
    return _registry;
  }

  for (const file of files) {
    const path = join(TEMPLATE_DIR, file);
    try {
      const raw = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(raw) as ChainTemplate;
      const errors = validateTemplate(parsed);
      if (errors.length > 0) {
        _loadWarnings.push(`${file}: ${errors.join('; ')}`);
        continue;
      }
      _registry.set(parsed.id, {
        template: parsed,
        loaded_at: new Date().toISOString(),
        source_path: path,
      });
    } catch (err) {
      _loadWarnings.push(`${file}: parse_failed: ${(err as Error).message}`);
    }
  }

  return _registry;
}

// ── Lookup ──────────────────────────────────────────────────────────────

export function getTemplate(id: string): ChainTemplate | null {
  const reg = loadRegistry();
  const entry = reg.get(id);
  return entry ? entry.template : null;
}

export function listTemplates(): Array<{ id: string; label: string; version: string; cost_qc: number }> {
  const reg = loadRegistry();
  return Array.from(reg.values()).map((e) => ({
    id: e.template.id,
    label: e.template.label,
    version: e.template.version,
    cost_qc: e.template.cost_qc ?? 0,
  }));
}

export function getLoadWarnings(): string[] {
  loadRegistry();
  return [..._loadWarnings];
}

// ── Validation ──────────────────────────────────────────────────────────

const KIND_REQUIRES: Record<ChainStepKind, keyof ChainStep> = {
  compose: 'compose',
  rpc: 'rpc',
  approve: 'approve',
  scheduled: 'scheduled',
  wait: 'wait',
};

export function validateTemplate(t: ChainTemplate): string[] {
  const errors: string[] = [];

  if (!t.id || typeof t.id !== 'string') errors.push('missing_or_invalid_id');
  if (!t.version || typeof t.version !== 'string') errors.push('missing_or_invalid_version');
  if (!t.label || typeof t.label !== 'string') errors.push('missing_or_invalid_label');
  if (!Array.isArray(t.steps) || t.steps.length === 0) {
    errors.push('missing_steps');
    return errors;
  }

  // Step ID uniqueness
  const stepIds = new Set<string>();
  for (const step of t.steps) {
    if (!step.id) {
      errors.push('step_missing_id');
      continue;
    }
    if (stepIds.has(step.id)) errors.push(`duplicate_step_id: ${step.id}`);
    stepIds.add(step.id);
  }

  // Per-step shape
  for (const step of t.steps) {
    if (!step.id || !step.label || !step.actor || !step.kind) {
      errors.push(`step_${step.id ?? '?'}_missing_required_fields`);
      continue;
    }
    const requiredConfigKey = KIND_REQUIRES[step.kind];
    if (!requiredConfigKey || !(requiredConfigKey in step) || !(step as unknown as Record<string, unknown>)[requiredConfigKey]) {
      errors.push(`step_${step.id}_missing_${requiredConfigKey}_config`);
    }
  }

  // Ref resolution: every non-null `next` and branch `next` must point at an existing step
  for (const step of t.steps) {
    if (step.next !== null && step.next !== undefined && !stepIds.has(step.next)) {
      errors.push(`step_${step.id}_next_unresolved: ${step.next}`);
    }
    for (const branch of step.branches ?? []) {
      if (branch.next && !stepIds.has(branch.next)) {
        errors.push(`step_${step.id}_branch_next_unresolved: ${branch.next}`);
      }
      if (!branch.next && !branch.terminate) {
        errors.push(`step_${step.id}_branch_missing_next_or_terminate`);
      }
    }
    if (step.kind === 'approve' && step.approve?.on_reject_next && !stepIds.has(step.approve.on_reject_next)) {
      errors.push(`step_${step.id}_on_reject_next_unresolved: ${step.approve.on_reject_next}`);
    }
    if (step.kind === 'wait' && step.wait?.on_timeout_next && !stepIds.has(step.wait.on_timeout_next)) {
      errors.push(`step_${step.id}_on_timeout_next_unresolved: ${step.wait.on_timeout_next}`);
    }
  }

  // Cycle detection on the default `next` graph (branches can legitimately reroute back, so exempt them)
  if (errors.length === 0) {
    const cyclePath = detectCycle(t.steps);
    if (cyclePath) errors.push(`cycle_in_default_next_graph: ${cyclePath.join(' → ')}`);
  }

  // Cost
  if (t.cost_qc !== undefined) {
    if (!Number.isInteger(t.cost_qc) || t.cost_qc < 0) errors.push('cost_qc_must_be_non_negative_integer');
  }

  return errors;
}

function detectCycle(steps: ChainStep[]): string[] | null {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function visit(id: string): string[] | null {
    if (stack.has(id)) {
      // Cycle found — return path slice from the repeat
      const start = path.indexOf(id);
      return path.slice(start).concat(id);
    }
    if (visited.has(id)) return null;
    stack.add(id);
    path.push(id);
    const step = byId.get(id);
    if (step && step.next) {
      const found = visit(step.next);
      if (found) return found;
    }
    stack.delete(id);
    visited.add(id);
    path.pop();
    return null;
  }

  for (const step of steps) {
    const found = visit(step.id);
    if (found) return found;
  }
  return null;
}

// ── Test helper ─────────────────────────────────────────────────────────

/** Reset cached registry — for unit tests. Not exported for production callers. */
export function _resetForTest(): void {
  _registry = null;
  _loadWarnings = [];
}
