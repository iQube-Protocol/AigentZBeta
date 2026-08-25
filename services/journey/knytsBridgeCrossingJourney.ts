/**
 * The KNYTS Bridge — Crossing Journey (Guided Journey Runtime, PRD-GJR-001).
 *
 * The public-facing campaign that carries a KNYT community member across the
 * Threshold into the Polity: browse Crossing Stories, orient to the first
 * constitutional choice, claim a Passport, tell your own crossing by
 * remixing one, see it become consequential, and step into the KNYT
 * cultural economy. Operator framing: "every crossing builds the bridge."
 * Public-facing name: the KNYTS Bridge Threshold Guide. The spine itself
 * (this file) is the Posit Spine — the same constitutional journey grammar
 * Horizen and the Validation Programme use, projected here in Mythos
 * language rather than evidentiary/technical language.
 *
 * ── Reconstitution, 2026-08-09: seven spine nodes, three tracked stages ────
 *
 * v1 of this journey tracked only THREE stages (passport/remix/stand) and
 * rendered HOMECOMING/VIEW/BUY as free page sections around a bespoke
 * layout, on the reasoning that a JourneyDefinition stage is a unit of
 * TRACKED, EVIDENCED PROGRESS (Journey Guidance Principle, §5.1) and those
 * three have nothing to gate or complete. That reasoning about EVIDENCE was
 * correct and is preserved below — HOME/VIEW/ORIENT/BUY still carry an empty
 * `completionEvidence` and can never reach COMPLETE. What changed is the
 * PRESENTATION: the operator's reconstitution instruction is explicit that
 * the public spine must show all seven beats as ONE Posit Spine with one
 * active surface underneath (never a page of stacked sections), so a
 * gate-less stage is now a real spine node that always resolves READY/open
 * rather than a free-floating page section outside the spine entirely.
 *
 * This is safe under resolveJourneyState.ts's actual resolution order
 * (ESTABLISHED COMPLETION EVIDENCE PRECEDES PREREQUISITE GATING, and
 * prerequisites are checked per-stage against ONLY the stages a stage
 * explicitly lists): HOME/VIEW/ORIENT/BUY carry `prerequisites: []` and are
 * never listed as a prerequisite of PASSPORT or anything after it, so their
 * permanent non-completion can never BLOCK the tracked ladder — exactly the
 * defect class the Horizen Journey correction (2026-08-09, cited in
 * resolveJourneyState.ts) already fixed once for Orient before Passport.
 *
 * ORIENT remains a real spine node for direct navigation (a visitor browsing
 * the spine top-to-bottom can stop there), but is NOT inserted as a
 * prerequisite gate in front of Passport — the light explanation it shows is
 * also carried in Passport's own `companion.before` text, so a visitor who
 * jumps straight to Passport (e.g. via the Remix-without-Passport interrupt)
 * still sees the same framing without ORIENT being on their critical path.
 *
 * PASSPORT's completion evidence was strengthened from mere
 * `personaAuthenticated` (signed in) to `citizenPassportUsable` (an actual,
 * usable Polity Citizen Passport — real constitutional presence), reusing
 * the SAME canonical check Horizen's own admission ladder uses
 * (services/identity/passportPrincipal.ts's `loadUsableCitizenPassportForAuthProfile` /
 * `isPassportUsable`) rather than inventing a second, weaker definition of
 * "crossed the Threshold" (inv.engineering.036/037).
 *
 * Delegation is deliberately absent from this ladder (reconstitution spec,
 * point 9): KNYTS is personhood-first — Passport is the constitutional act,
 * and delegating authority to aigentMe happens later, if and when a citizen
 * actually asks for it. The shared runner supports a Delegate stage; this
 * journey does not use it.
 */

import type { JourneyDefinition } from '@/types/journey';

export const KNYTS_BRIDGE_CAMPAIGN_ID = 'knyts-bridge-crossing';

export const KNYTS_BRIDGE_CROSSING_JOURNEY: JourneyDefinition = {
  id: 'knyts-bridge-crossing',
  version: '2.0.0',
  label: 'The KNYTS Bridge',
  partner: 'knyt',
  destination: 'knyt-pulse',
  subjectRef: 'visitor',
  // Journey Runtime copilot invariant (item 1, 2026-08-25) — the SAME
  // agent/accentColor `/bridge/knyts` already mounted by hand
  // (data/codex-configs.ts's KNYT_CODEX.copilot: aigent-kn0w1 / "KNYT
  // Copilot" / amber), now resolved canonically instead of hand-copied.
  copilot: { cartridgeSlug: 'knyt-codex' },
  stages: [
    {
      id: 'home',
      label: 'Home',
      description: 'Cross the Threshold. Come home.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'knyts-bridge-home',
          note: 'Media-rich homecoming surface.',
          props: { section: 'home', ctaStageId: 'view', showCampaignExtras: true },
        },
      ],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'The KNYTS Bridge is one path into the Polity — a constitutional home for people and their agents.',
        complete: '',
      },
    },
    {
      id: 'view',
      label: 'View',
      description: 'See the crossings underway.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [{ mode: 'iframe', ref: 'knyts-bridge-view-pulse', note: 'The canonical KNYT Pulse tab.' }],
      prerequisites: [],
      permittedActions: ['browse-crossings', 'remix-crossing-story'],
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'Follow the stories of those who are crossing. Every crossing builds the bridge.',
        complete: '',
      },
    },
    {
      id: 'orient',
      label: 'Orient',
      description: 'Personhood comes first.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'knyts-bridge-orient',
          note:
            'KnytsBridgeOrientIntro — a thin amber-preset wrapper over the bridge-neutral ' +
            'BridgeOrientSurface CI also composes. No heavy Bureau UI, no server call.',
        },
      ],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'Claiming your Passport is your first constitutional act.',
        complete: '',
      },
    },
    {
      id: 'passport',
      label: 'Passport',
      description: 'Claim your constitutional presence.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'knyts-bridge-passport-room',
          note:
            'State-aware constitutional room, reconstituted onto the CI Passport framework ' +
            '(2026-08-12, KNYTS↔CI parity pass): claim your Passport, then a signal question ' +
            '(what would you like to do in the Polity) before telling your own crossing in Remix.',
        },
      ],
      prerequisites: [],
      permittedActions: ['claim-passport'],
      completionEvidence: ['citizenPassportUsable'],
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
      description: 'Tell your crossing.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'knyts-bridge-mycanvas-remix',
          note: 'myCanvas, deep-linked inside the metaMe/aigentMe environment — campaign-tagged, never a forked remix UI.',
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
      description: 'Quest, contribute and earn Standing.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'iframe',
          ref: 'knyts-bridge-stand',
          note:
            'Standing is the constitutional outcome; Quest is the KNYT mechanic through which you earn ' +
            'it — the canonical KNYT Quests tab, never a bespoke Standing projection.',
        },
      ],
      // Passport determines ELIGIBILITY to enter Stand/Quests (2026-08-12
      // parity pass) — Remix is a separate, optional creative act, not a
      // constitutional requirement to browse or perform Quests. Whether
      // Stand becomes ESTABLISHED/complete is still governed entirely by
      // completionEvidence below; this only changes who may enter.
      prerequisites: ['passport'],
      permittedActions: ['share-crossing'],
      completionEvidence: ['crossingHasConsequence'],
      receiptTypes: [],
      companion: {
        before: 'Share your crossing. Every action on it — a reaction, a share, a remix of your own — is a consequence you caused.',
        complete: 'Your crossing has consequence in the Polity.',
      },
    },
    {
      id: 'choose',
      label: 'Choose',
      description: 'Choose where to go next.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [{ mode: 'component', ref: 'knyts-bridge-choose', note: 'Four destination options for continuing the journey.' }],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'Visit the KNYT Store.',
        complete: '',
      },
    },
  ],
};
