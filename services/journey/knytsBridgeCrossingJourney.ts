/**
 * The KNYTS Bridge — Crossing Journey (Guided Journey Runtime, PRD-GJR-001).
 *
 * The public-facing campaign that carries a KNYT community member across the
 * Threshold into the Polity: browse Crossing Stories, claim a Passport, tell
 * your own crossing by remixing one, and see it become consequential.
 * Operator framing: "every crossing builds the bridge."
 *
 * ── Why this ladder has three stages, not the campaign's seven ─────────────
 *
 * The campaign's own narrative has seven public beats — HOMECOMING, VIEW,
 * ORIENT, PASSPORT, REMIX, STAND, BUY — but a JourneyDefinition stage is a
 * unit of TRACKED, EVIDENCED PROGRESS (Journey Guidance Principle, §5.1:
 * button clicked != stage complete; authoritative state + receipt = stage
 * complete). Three of the seven have no such fact to track, by design:
 *
 *   HOMECOMING and VIEW are deliberately browsable without a session at all
 *     (a visitor sees Crossing Stories and the weekly challenge before ever
 *     claiming a Passport) — there is nothing to gate or complete.
 *   ORIENT is not a distinct act either. It is the explanation a visitor
 *     receives AT the Passport gate, not a separate thing they do beforehand
 *     — so it is this journey's `passport` stage's own `companion.before`
 *     text, exactly the pattern every existing stage in this codebase
 *     already uses for its "here is what is about to happen" narration
 *     (see horizenMoneyPennyJourney.ts's `claim` stage). Inventing a
 *     separate ORIENT stage with no completion evidence of its own would
 *     either stay permanently non-COMPLETE (blocking everything after it,
 *     per resolveJourneyState.ts) or require fabricating an "acknowledged"
 *     receipt nothing in this build actually writes — the fail-faithful
 *     discipline this module is bound by rules that out.
 *   BUY is a deep-link to the existing KNYT Store tabs (out of this
 *     journey's scope entirely — no new commerce code, per the approved
 *     plan) — there is no KNYTS-Bridge-specific fact to evidence there
 *     either.
 *
 * So the tracked ladder is exactly the three acts with real, checkable
 * evidence: claim your Passport, tell your crossing, see it become
 * consequential. HOMECOMING/VIEW/BUY are rendered as free (non-gated)
 * sections of the public front door (app/bridge/knyts/page.tsx) around this
 * ladder, never as JourneyDefinition stages with nothing to evidence.
 */

import type { JourneyDefinition } from '@/types/journey';

export const KNYTS_BRIDGE_CAMPAIGN_ID = 'knyts-bridge-crossing';

export const KNYTS_BRIDGE_CROSSING_JOURNEY: JourneyDefinition = {
  id: 'knyts-bridge-crossing',
  version: '1.0.0',
  label: 'The KNYTS Bridge',
  partner: 'knyt',
  destination: 'knyt-pulse',
  subjectRef: 'visitor',
  stages: [
    {
      id: 'passport',
      label: 'Passport',
      description: 'Claiming your Passport is the actual constitutional crossing — everything before it was browsing.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'passport-bureau-apply',
          note: 'The existing Polity Passport application/sign-in surface — never a campaign-specific fork.',
        },
      ],
      prerequisites: [],
      permittedActions: ['claim-passport'],
      completionEvidence: ['personaAuthenticated'],
      receiptTypes: [],
      companion: {
        before:
          'The KNYTS Bridge is one path into the Polity — a constitutional home for people and their agents ' +
          'in the emerging Constitutional Internet. Telling your own crossing is something you do as ' +
          'yourself, so claiming your Passport is the one step between browsing and crossing.',
        complete: 'Your Passport is active. You are ready to tell your own crossing.',
      },
      nextStageId: 'remix',
    },
    {
      id: 'remix',
      label: 'Remix',
      description: 'Tell your crossing by remixing an existing Crossing Story into your own article or story.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'knyts-bridge-mycanvas-remix',
          note: 'The existing myCanvas Remix flow (RemixDialog + MyCanvasTab), campaign-tagged — never a forked remix UI.',
        },
      ],
      prerequisites: ['passport'],
      permittedActions: ['remix-crossing-story', 'publish-to-pulse'],
      completionEvidence: ['crossingPublished'],
      receiptTypes: [],
      companion: {
        before: 'Remix any Crossing Story into your own article or story, then publish it to KNYT Pulse.',
        complete: 'Your crossing is published to KNYT Pulse. Share it — every crossing builds the bridge.',
      },
      nextStageId: 'stand',
    },
    {
      id: 'stand',
      label: 'Stand',
      description: 'Become consequential within the Polity — every share, reaction and remix of your crossing counts.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'knyts-bridge-stand',
          note: 'Thin read-only projection over existing KNYT signal counts — see services/journey/knytsBridgeStand.ts.',
        },
      ],
      prerequisites: ['remix'],
      permittedActions: ['share-crossing'],
      completionEvidence: ['crossingHasConsequence'],
      receiptTypes: [],
      companion: {
        before: 'Share your crossing. Every action on it — a reaction, a share, a remix of your own — is a consequence you caused.',
        complete: 'Your crossing has consequence in the Polity.',
      },
    },
  ],
};
