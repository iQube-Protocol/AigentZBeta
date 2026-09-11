/**
 * Condition Expression Evaluator — Journey Spine adapter to authoritative state.
 *
 * SPEC-JS-001 §1, CLAUDE.md constraint 1: ConditionExpression is NOT a new policy
 * engine. It ONLY maps conditions to existing authoritative sources (settledFacts,
 * receipts, etc.). It never manufactures authorization or permission.
 *
 * The evaluator is the BRIDGE, not the authority. It answers "what truth sources
 * tell us" without deciding "what you're allowed to do" — that remains the
 * responsibility of the owning capability (Passport, Delegation, Constitutional
 * Computing surfaces, etc.).
 */

import type { ConditionExpression } from '@/types/journey';
import type { SettledPredicate } from './settledFacts';

/**
 * Platform state snapshot used for condition evaluation.
 * Values come from authoritative sources, never client-side or Journey Spine.
 */
export interface AuthoritativePlatformState {
  settledFacts: Partial<Record<SettledPredicate, boolean>>;
  receiptsByType: Partial<Record<string, boolean>>;
  customState?: Record<string, unknown>;
}

/**
 * Evaluate a generic condition expression against authoritative platform state.
 *
 * @param condition The expression to evaluate
 * @param state Authoritative state snapshot from real sources
 * @returns true if the condition is satisfied by the state
 * @throws Error if condition references unknown/unmappable sources
 */
export function evaluateCondition(
  condition: ConditionExpression | undefined,
  state: AuthoritativePlatformState
): boolean {
  if (!condition) return true; // No condition = always satisfied

  switch (condition.type) {
    case 'boolean':
      return condition.value === 'true';

    case 'settled-fact':
      if (!condition.value) throw new Error('settled-fact condition missing value');
      const fact = condition.value as SettledPredicate;
      const factValue = state.settledFacts[fact];
      if (factValue === undefined) {
        // Fact not yet computed — treat as false (not yet satisfied)
        // Never invent a fact; always report actual state
        return false;
      }
      return factValue;

    case 'receipt':
      if (!condition.value) throw new Error('receipt condition missing value');
      const receiptExists = state.receiptsByType[condition.value];
      if (receiptExists === undefined) {
        // Receipt type not found in state — treat as false (not yet received)
        return false;
      }
      return receiptExists;

    case 'composite':
      if (!condition.operator || !condition.operands) {
        throw new Error('composite condition missing operator or operands');
      }
      return evaluateComposite(condition.operator, condition.operands, state);

    default:
      throw new Error(`unknown condition type: ${(condition as any).type}`);
  }
}

/**
 * Evaluate a composite (and/or/not) condition.
 */
function evaluateComposite(
  operator: string,
  operands: ConditionExpression[],
  state: AuthoritativePlatformState
): boolean {
  switch (operator) {
    case 'and':
      return operands.every((op) => evaluateCondition(op, state));
    case 'or':
      return operands.some((op) => evaluateCondition(op, state));
    case 'not':
      if (operands.length !== 1) {
        throw new Error('not operator requires exactly one operand');
      }
      return !evaluateCondition(operands[0], state);
    default:
      throw new Error(`unknown composite operator: ${operator}`);
  }
}

/**
 * Validate that a condition does NOT manufacture authorization.
 *
 * This is a sanity check to prevent conditions from referencing computed
 * permissions, inferred access, or other non-authoritative state. The
 * condition must only reference settled facts and receipts — evidence of
 * what has already been constitutionally established.
 *
 * Returns { valid: true } if the condition is safe to use.
 * Returns { valid: false, reason: string } if it references non-authoritative sources.
 */
export function validateConditionIsNonAuthoritativeAdapter(
  condition: ConditionExpression | undefined
): { valid: boolean; reason?: string } {
  if (!condition) return { valid: true };

  if (condition.type === 'settled-fact' || condition.type === 'receipt') {
    // Both settled-fact and receipt are authoritative — safe.
    return { valid: true };
  }

  if (condition.type === 'boolean') {
    return { valid: true };
  }

  if (condition.type === 'composite') {
    // Recursively validate all operands
    if (!condition.operands) {
      return { valid: false, reason: 'composite condition missing operands' };
    }
    for (const operand of condition.operands) {
      const result = validateConditionIsNonAuthoritativeAdapter(operand);
      if (!result.valid) return result;
    }
    return { valid: true };
  }

  return {
    valid: false,
    reason: `unknown condition type: ${(condition as any).type}`,
  };
}

/**
 * Build a simple condition that checks if a settled fact is true.
 * Convenience helper for common pattern.
 */
export function settledFactCondition(fact: SettledPredicate): ConditionExpression {
  return {
    type: 'settled-fact',
    value: fact,
  };
}

/**
 * Build a simple condition that checks if a receipt type exists.
 * Convenience helper for common pattern.
 */
export function receiptCondition(receiptType: string): ConditionExpression {
  return {
    type: 'receipt',
    value: receiptType,
  };
}

/**
 * Build an AND condition from multiple operands.
 */
export function andCondition(
  ...operands: (ConditionExpression | undefined)[]
): ConditionExpression {
  const defined = operands.filter((o): o is ConditionExpression => o !== undefined);
  if (defined.length === 0) return { type: 'boolean', value: 'true' };
  if (defined.length === 1) return defined[0];
  return {
    type: 'composite',
    operator: 'and',
    operands: defined,
  };
}

/**
 * Build an OR condition from multiple operands.
 */
export function orCondition(
  ...operands: (ConditionExpression | undefined)[]
): ConditionExpression {
  const defined = operands.filter((o): o is ConditionExpression => o !== undefined);
  if (defined.length === 0) return { type: 'boolean', value: 'true' };
  if (defined.length === 1) return defined[0];
  return {
    type: 'composite',
    operator: 'or',
    operands: defined,
  };
}

/**
 * Build a NOT condition.
 */
export function notCondition(operand: ConditionExpression): ConditionExpression {
  return {
    type: 'composite',
    operator: 'not',
    operands: [operand],
  };
}
