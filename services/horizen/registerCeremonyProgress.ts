/**
 * Where an agent's Horizen registration actually stands, as a ladder.
 *
 * ── The defect this closes (operator, 2026-08-02) ──────────────────────────
 *
 *   > "The journey period is not progressing. It's still showing register
 *   >  agent Nakamoto in Horizen. Nothing has progressed. It's not clear what
 *   >  is happening at all … It's kind of completely in the dark as to what's
 *   >  going on. I don't understand why nothing is progressing."
 *
 * The Register stage showed a BUTTON and a transient status line, and nothing
 * else. Between clicks it fell back to `idle` — visually identical whether the
 * operator had never started, had prepared five mandates that expired, or had
 * signed one and was waiting on a broadcast. Every attempt left the surface
 * looking exactly as it did before the attempt, so the only honest conclusion
 * available to the operator was "nothing is happening".
 *
 * This is the same failure the crystal surface had: a state machine with real
 * intermediate stages, rendered as a single verdict. The remedy is the same —
 * show the ladder, say which rung, say what is missing and WHO acts next.
 *
 * ── Derived, never stored ──────────────────────────────────────────────────
 *
 * Computed from facts the panel and the ceremony already hold: whether the
 * principal wallet can sign, which signing requests exist and in what state,
 * whether a transaction has been broadcast, and whether Horizen has issued a
 * tokenId. It is a PROJECTION (`inv.engineering.037`), not a second source of
 * truth — a ladder that could disagree with the ceremony would be one more
 * thing to go stale.
 */

export type RegisterCeremonyStageId =
  | 'WALLET_NOT_READY'
  | 'NOT_STARTED'
  | 'MANDATE_AWAITING_SIGNATURE'
  | 'INVOCATION_AWAITING_APPROVAL'
  | 'BROADCAST_AWAITING_CONFIRMATION'
  | 'REGISTERED';

/** Who has to do the next thing. The question "why is nothing happening" is usually this. */
export type NextActor = 'you' | 'the network' | 'nobody';

export interface RegisterCeremonyStage {
  id: RegisterCeremonyStageId;
  label: string;
  state: 'done' | 'current' | 'pending';
}

export interface RegisterCeremonyProgress {
  stageId: RegisterCeremonyStageId;
  /**
   * The rung's ACHIEVEMENT label — "Mandate signed by you". Correct in a
   * checklist, wrong as a headline.
   */
  label: string;
  /**
   * WHAT IS TRUE RIGHT NOW — "Awaiting your signature".
   *
   * The first version headlined the current rung's achievement label, so the
   * panel read "Mandate signed by you · waiting on you" directly above "A
   * mandate is prepared and waiting for your signature". A rung label states
   * the thing that HAPPENS AT that rung; the current rung is the one that has
   * NOT happened yet. Rendering the two as one sentence claimed the opposite
   * of the state it was reporting.
   */
  headline: string;
  /** What is true right now, in one sentence. */
  meaning: string;
  /** The next act, named as an act — never "please wait". */
  nextAct: string;
  nextActor: NextActor;
  /**
   * Attempts that ran out before completion. Not a failure count and not
   * hidden: five expired mandates are why the operator thinks nothing is
   * happening, and the surface must account for them.
   */
  expiredAttempts: number;
  ladder: RegisterCeremonyStage[];
}

const LADDER: { id: RegisterCeremonyStageId; label: string }[] = [
  { id: 'WALLET_NOT_READY', label: 'Principal wallet ready to sign' },
  { id: 'NOT_STARTED', label: 'Registration mandate prepared' },
  { id: 'MANDATE_AWAITING_SIGNATURE', label: 'Mandate signed by you' },
  { id: 'INVOCATION_AWAITING_APPROVAL', label: "Agent's key invocation approved" },
  { id: 'BROADCAST_AWAITING_CONFIRMATION', label: 'Transaction broadcast to Horizen' },
  { id: 'REGISTERED', label: 'Registered — tokenId issued' },
];

export const REGISTER_CEREMONY_LADDER = LADDER;

export function registerCeremonyProgress(input: {
  /** The principal wallet can actually produce a signature. */
  walletReady: boolean;
  /** A live (unexpired) principal mandate is waiting for a signature. */
  liveMandate: boolean;
  /** A live agent-invocation request is waiting for approval. */
  liveInvocation: boolean;
  /** A transaction has been broadcast and Horizen has not confirmed it yet. */
  broadcastPending: boolean;
  /** Horizen has issued a tokenId for this agent. */
  tokenId: string | null;
  /** Mandates that expired before being completed. */
  expiredAttempts: number;
  /**
   * Agent invocations that lapsed unapproved. A ceremony that reaches this and
   * stops is NOT the same as one never started: the mandate was signed and
   * spent, and only the second approval is missing.
   */
  expiredInvocations?: number;
}): RegisterCeremonyProgress {
  const stageId: RegisterCeremonyStageId = input.tokenId
    ? 'REGISTERED'
    : input.broadcastPending
      ? 'BROADCAST_AWAITING_CONFIRMATION'
      : input.liveInvocation
        ? 'INVOCATION_AWAITING_APPROVAL'
        : input.liveMandate
          ? 'MANDATE_AWAITING_SIGNATURE'
          : !input.walletReady
            ? 'WALLET_NOT_READY'
            : 'NOT_STARTED';

  const at = LADDER.findIndex((s) => s.id === stageId);
  // Reached the agent-key approval and stopped there, rather than never begun.
  const lapsedAfterSigning = stageId === 'NOT_STARTED' && (input.expiredInvocations ?? 0) > 0;

  const detail: Record<
    RegisterCeremonyStageId,
    Pick<RegisterCeremonyProgress, 'headline' | 'meaning' | 'nextAct' | 'nextActor'>
  > = {
    WALLET_NOT_READY: {
      headline: 'Principal wallet not ready',
      meaning: 'Your principal wallet cannot produce a signature yet, so no mandate can be authorised.',
      nextAct: 'Set up or prove control of your principal wallet in the wallet’s Principal Wallet section.',
      nextActor: 'you',
    },
    NOT_STARTED: lapsedAfterSigning
      ? {
          /*
           * A CEREMONY THAT LAPSED IS NOT ONE NEVER STARTED (operator,
           * 2026-08-02: "the page has the flow at mandate signed … otherwise
           * we'll remain stuck here").
           *
           * The mandate was signed and spent; the agent-key approval lapsed
           * behind it. Both are gone, so the stage is correctly NOT_STARTED —
           * but telling the operator "nothing is in flight, no act is
           * part-completed" would deny work they actually did, and leave them
           * looking for a state that no longer exists.
           */
          headline: 'The last attempt lapsed — start again',
          meaning:
            'Your mandate was signed, and the agent-key approval that followed it ran out before being ' +
            'given. Nothing was broadcast and nothing reached Horizen. Neither request can be revived.',
          nextAct: 'Press “Register … in Horizen” to begin again. Both steps are valid for 30 minutes each.',
          nextActor: 'you',
        }
      : {
          headline: 'Not started',
          meaning:
            'No mandate is currently waiting. Nothing is in flight — this agent has not been registered, ' +
            'and no act is part-completed.',
          nextAct: 'Press “Register … in Horizen” to prepare a mandate. It is valid for 30 minutes.',
          nextActor: 'you',
        },
    MANDATE_AWAITING_SIGNATURE: {
      headline: 'Awaiting your signature',
      meaning:
        'A mandate is prepared and waiting for your signature. Nothing has been signed or broadcast, and ' +
        'nothing will be until you sign it.',
      nextAct: 'Open Pending actions in your wallet and sign the mandate with your principal key.',
      nextActor: 'you',
    },
    INVOCATION_AWAITING_APPROVAL: {
      headline: 'Awaiting your approval of the agent key',
      meaning:
        'You have signed the mandate. The agent’s own custodied key now needs your explicit approval to be ' +
        'invoked — the key never reaches you, and this approval only authorises its use.',
      nextAct: 'Open Pending actions and approve the agent’s key invocation.',
      nextActor: 'you',
    },
    BROADCAST_AWAITING_CONFIRMATION: {
      headline: 'Awaiting confirmation from Horizen',
      meaning: 'The registration transaction has been broadcast. Horizen has not confirmed it yet.',
      nextAct: 'Nothing to do — the network decides this one. The stage advances when Horizen confirms.',
      nextActor: 'the network',
    },
    REGISTERED: {
      headline: 'Registered in Horizen',
      meaning: 'Horizen has issued a tokenId. The agent is registered in the ERC-8004 registry.',
      nextAct: 'Nothing — this stage is complete.',
      nextActor: 'nobody',
    },
  };

  return {
    stageId,
    label: LADDER[at].label,
    ...detail[stageId],
    expiredAttempts: input.expiredAttempts,
    ladder: LADDER.map((s, i) => ({
      ...s,
      state: i < at ? 'done' : i === at ? 'current' : 'pending',
    })),
  };
}

/**
 * What contact with Horizen has ACTUALLY occurred (operator, 2026-08-02).
 *
 *   > "Nothing indicates at the moment that we're talking to the Horizen
 *   >  system at all."
 *
 * True, and the surface should say so rather than imply otherwise. Nothing in
 * this ceremony touches Horizen until the operator signs the mandate and
 * approves the key invocation — the transaction is built and broadcast only as
 * a consequence of those two acts. Before then there is no call to report, and
 * inventing a "connecting…" state would be theatre.
 */
export function horizenContact(input: {
  network: string | null;
  broadcastPending: boolean;
  tokenId: string | null;
}): { contacted: boolean; statement: string } {
  const net = input.network ?? 'the configured network';
  if (input.tokenId) {
    return {
      contacted: true,
      statement: `Horizen confirmed this registration on ${net} and issued tokenId ${input.tokenId}.`,
    };
  }
  if (input.broadcastPending) {
    return {
      contacted: true,
      statement: `A transaction has been broadcast to ${net}. Horizen has not confirmed it yet.`,
    };
  }
  return {
    contacted: false,
    statement:
      `No transaction has been sent to Horizen yet, so there is nothing on ${net} to show. ` +
      'The registry is only touched after you sign the mandate and approve the agent key — ' +
      'building or broadcasting anything earlier would act without your authority.',
  };
}

/**
 * Expired attempts, said in a way that does not read as failure.
 *
 * Five expired mandates is not five errors — it is one act attempted five
 * times inside a window that was too short, and the surface that hid them is
 * why the operator concluded nothing was happening.
 */
export function expiredAttemptsNote(count: number): string | null {
  if (count <= 0) return null;
  return (
    `${count} earlier ${count === 1 ? 'mandate' : 'mandates'} ran out before being signed. ` +
    'An expired mandate is never revived and nothing was signed or broadcast by any of them — ' +
    'preparing a fresh one is the whole remedy.'
  );
}
