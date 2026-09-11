/**
 * Intent chain reference resolution.
 *
 * Step configs can reference values via three scopes:
 *   - $nbe.X     — read from the originating NBE's metadata (kept on the
 *                  chain row's `context.__nbe` slot at dispatch time)
 *   - $prev.X    — read from the most recently completed step's outcome
 *                  metadata (kept on `context.__prev` after each advance)
 *   - $chain.X   — read from the chain's context map (any prior write)
 *
 * v1: shallow paths only. `$chain.foo` resolves; `$chain.foo.bar` doesn't.
 * (Extending to dotted paths is mechanical when needed.)
 */

import type { ChainRefScope } from '@/types/intentChains';

const REF_PATTERN = /^\$(nbe|prev|chain)\.([A-Za-z_][A-Za-z0-9_]*)$/;

export interface RefContext {
  /** Chain context map, including __nbe / __prev slots written by the advancer. */
  context: Record<string, unknown>;
}

/**
 * Resolve a single ref like `$prev.artifact_id` against the chain context.
 * Returns undefined if the ref doesn't parse or the slot/key isn't found.
 * Pass-through for non-ref strings (returns the original value).
 */
export function resolveRef(value: unknown, ctx: RefContext): unknown {
  if (typeof value !== 'string') return value;
  const match = REF_PATTERN.exec(value);
  if (!match) return value;
  const scope = match[1] as ChainRefScope;
  const key = match[2];
  const slot = scopeSlot(ctx.context, scope);
  if (!slot) return undefined;
  return slot[key];
}

/** Walk an object recursively and replace any $scope.key string with its resolved value. */
export function resolveRefsInObject(
  input: Record<string, unknown>,
  ctx: RefContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'string') {
      out[k] = resolveRef(v, ctx);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? resolveRefsInObject(item as Record<string, unknown>, ctx)
          : typeof item === 'string'
            ? resolveRef(item, ctx)
            : item,
      );
    } else if (v && typeof v === 'object') {
      out[k] = resolveRefsInObject(v as Record<string, unknown>, ctx);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function scopeSlot(
  context: Record<string, unknown>,
  scope: ChainRefScope,
): Record<string, unknown> | undefined {
  if (scope === 'chain') return context;
  if (scope === 'nbe') return context.__nbe as Record<string, unknown> | undefined;
  if (scope === 'prev') return context.__prev as Record<string, unknown> | undefined;
  return undefined;
}

/**
 * Evaluate a branch predicate against the current event outcome + chain
 * context. v1 supports a deliberately tiny grammar:
 *
 *   outcome.X                     truthy check on outcome.X
 *   $chain.X == true | false      equality on chain context
 *   $chain.X                      truthy check on chain context value
 *   decision == 'confirm'         equality on string literal (single-quoted)
 *   decision == 'reject'          equality on string literal
 *
 * Returns true if matched, false if not. Anything not parseable returns
 * false (safe default — fall through to step.next).
 */
export function evaluateBranch(
  predicate: string,
  outcome: Record<string, unknown>,
  ctx: RefContext,
): boolean {
  const p = predicate.trim();
  // Equality form: <ref> == <literal>
  const eq = /^(\$?\w+(?:\.\w+)?)\s*==\s*(true|false|'([^']*)'|"([^"]*)")$/.exec(p);
  if (eq) {
    const lhs = readSide(eq[1], outcome, ctx);
    const rhsRaw = eq[2];
    const rhs = rhsRaw === 'true' ? true : rhsRaw === 'false' ? false : (eq[3] ?? eq[4] ?? '');
    return lhs === rhs;
  }
  // Truthy form: <ref>
  const truthy = readSide(p, outcome, ctx);
  return Boolean(truthy);
}

function readSide(
  side: string,
  outcome: Record<string, unknown>,
  ctx: RefContext,
): unknown {
  if (side.startsWith('outcome.')) {
    return outcome[side.slice('outcome.'.length)];
  }
  if (side.startsWith('$')) {
    return resolveRef(side, ctx);
  }
  // bare identifier → check outcome first, then chain context
  if (outcome[side] !== undefined) return outcome[side];
  return ctx.context[side];
}
