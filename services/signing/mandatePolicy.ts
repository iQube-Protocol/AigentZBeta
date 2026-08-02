/**
 * Mandate policy — how long a signing request stays valid, stated once.
 *
 * ── Why this is a policy module and not a number in a service call ─────────
 *
 * The principal registration mandate's window lived as a bare `600` inside
 * `registerCeremony.ts`, beside a `900` for the agent invocation that follows
 * it. Nothing said which was deliberate, nothing said they were related, and
 * nobody noticed that the leg a HUMAN has to complete — find the wallet,
 * unlock it, read the payload, decide — had the tighter window while the
 * machine leg had the looser one. Five consecutive mandates expired unsigned.
 *
 * A validity window on a mandate is a governance parameter: it bounds how long
 * an authorisation may be exercised. Bounding authority is exactly the kind of
 * decision that must be visible and attributed, not tuned in passing by
 * whoever is fixing a UI bug. So it lives here, with who approved it and why.
 *
 * ── Operator approval, 2026-08-02 ──────────────────────────────────────────
 *
 *   > "Ten minutes is too short for a diagnostic and human-signing workflow,
 *   >  especially while the system is still being commissioned. I would widen
 *   >  it, but explicitly as an operator-approved governance change. A sensible
 *   >  initial value is: 30 minutes … Record the TTL as a mandate-policy
 *   >  parameter rather than burying it in UI code."
 *
 * Thirty minutes is bounded and covers what the act actually requires:
 * notification delay, wallet unlocking, review of the mandate, ONE failed
 * attempt and a retry, and ordinary network latency. It is not "long enough to
 * be safe" — it is long enough to be completed once, honestly, by a person.
 */

/**
 * A principal mandate: the operator's own key, exercising their own authority.
 *
 * This is the leg a human performs. Operator-approved at 30 minutes
 * (2026-08-02); widening it further is another governance decision, not a
 * convenience change.
 */
export const PRINCIPAL_MANDATE_TTL_SECONDS = 1800;

/**
 * An agent invocation: a bounded-custody key released under a mandate the
 * operator has ALREADY signed.
 *
 * ── Corrected 2026-08-02, from evidence ────────────────────────────────────
 *
 * This was 900s on my reasoning that "the authority question is settled by the
 * time this exists, so its window only has to cover the operator noticing and
 * approving a step whose consequence they already accepted — no discovery, no
 * unlocking, no first reading."
 *
 * That was wrong, and the first run through the ceremony proved it. The
 * operator signed the mandate, the invocation was created, and it LAPSED
 * before they approved it — because the second leg is performed by the same
 * human, in the same wallet, needing the same navigation. Nothing about it is
 * faster than the first; it is simply second.
 *
 * A window that assumes the operator is already looking at the surface is a
 * window that only works when nothing else happens. Matched to the principal
 * leg: both are human acts, both get the same time.
 */
export const AGENT_INVOCATION_TTL_SECONDS = 1800;

/**
 * The record of who set these and why, carried as data so a receipt or an
 * agent package can quote the approval rather than paraphrase it.
 */
export const MANDATE_TTL_POLICY = {
  ratifiedAt: '2026-08-02',
  ratifiedBy: 'operator',
  principalSeconds: PRINCIPAL_MANDATE_TTL_SECONDS,
  agentSeconds: AGENT_INVOCATION_TTL_SECONDS,
  rationale:
    'A mandate window bounds how long an authorisation may be exercised, so it is a governance ' +
    'parameter rather than a tuning constant. The principal leg is performed by a person and must ' +
    'cover notification delay, wallet unlocking, review of the mandate, one failed attempt and a ' +
    'retry, and ordinary network latency — 30 minutes. The agent leg was 15 minutes on the assumption ' +
    'that it is approved immediately; the first real run showed it is the same human doing the same ' +
    'navigation a second time, and it lapsed. Both human legs now get the same window.',
} as const;

/**
 * The human leg must never be given less time than the machine leg that
 * follows it. Exported so the invariant is checkable rather than remembered.
 */
export function humanLegIsNotTighterThanMachineLeg(): boolean {
  return PRINCIPAL_MANDATE_TTL_SECONDS >= AGENT_INVOCATION_TTL_SECONDS;
}
