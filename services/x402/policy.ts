export type EscrowInput = {
  intent: string;
  amountQcent: bigint; // amount in q¢ (integer)
};

export function shouldEscrow(input: EscrowInput): boolean {
  const mode = (process.env.X402_SETTLEMENT_MODE || 'immediate').toLowerCase();
  if (mode === 'escrow') return true;
  const minStr = process.env.X402_ESCROW_MIN_QCENT;
  const min = minStr ? BigInt(minStr) : null;
  if (min && input.amountQcent >= min) return true;
  // Future: add risk scoring per intent/identity
  return false;
}
