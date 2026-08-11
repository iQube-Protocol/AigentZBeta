'use client';

/**
 * ConstitutionalAgentFieldEntrySurface — PERSONIFY's SUPPORTING surface for
 * the "shape your story with aigentMe" ceremony (evolved from ACT's primary
 * surface, 2026-08-11; simplified again 2026-08-11, integration pass).
 *
 * Connect Claude MOVED into MyCanvasTab's own rail (app/triad/components/
 * codex/tabs/MyCanvasTab.tsx, gated on campaignTag === CI_BRIDGE_CAMPAIGN_ID)
 * — this component no longer renders it. The "Meet aigentMe" LANDING CARD
 * is gone too, per operator instruction ("remove the current bottom-page
 * Connect Claude and Meet aigentMe cards"): aigentMe is entered through the
 * canonical Explore metaMe / metaMe cartridge route, not a redundant second
 * entry point here.
 *
 * What remains — and is still genuinely needed — is the mechanism ITSELF:
 * the real, embedded aigentMe/metaMe surface paired with the role/authority
 * question, wrapped in the SAME LayoutShell capsule chrome Horizen's
 * Threshold Guide uses for its own aigentMe disposition question
 * (components/metame/welcome/layouts/LayoutShell.tsx, mirroring
 * MoneyPennyFocusLayout.tsx's usage) — reusing the proven grammar rather
 * than inventing a third questionnaire design. With the landing card gone,
 * there is nothing left to gate this behind, so it renders unconditionally:
 * left is the real embedded aigentMe surface, right is the role/authority
 * question. Completing the question still fulfills PERSONIFY's
 * `agentRelationshipStarted` evidence, unchanged by this simplification.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { ConstitutionalAgentDispositionSurface } from '@/components/journey/ConstitutionalAgentDispositionSurface';
import { LayoutShell } from '@/components/metame/welcome/layouts/LayoutShell';

interface Props {
  personaId?: string;
}

/** The real, focused aigentMe/metaMe surface — reuses the shared
 *  Focused/Full contract (utils/codex-nav.ts) exactly like KNYTS' own
 *  Delegate stage, so aigentMe actually helps shape the story. */
function MeetAigentMeEmbed({ personaId }: { personaId?: string }) {
  const src = buildCodexUrl('metame-codex', {
    tab: 'aigent-me',
    personaId,
    shell: 'embed',
    suppressCopilot: true,
  });

  return <iframe src={src} title="Meet aigentMe" className="h-full w-full rounded-2xl border border-slate-800 bg-slate-950" />;
}

export function ConstitutionalAgentFieldEntrySurface({ personaId }: Props) {
  return (
    <div className="flex h-[28rem] flex-col gap-3 lg:h-[26rem] lg:flex-row">
      <div className="min-h-0 flex-1">
        <MeetAigentMeEmbed personaId={personaId} />
      </div>
      <div className="min-h-0 flex-1">
        <LayoutShell
          surfaceId="ci-bridge-personify-disposition"
          disTemplateId="ci-bridge-personify-disposition-v1"
          headerIcon={<Sparkles className="h-3.5 w-3.5" />}
          headerEyebrow="aigentMe"
          headerTitle="Shape your story"
          body={<ConstitutionalAgentDispositionSurface />}
        />
      </div>
    </div>
  );
}

export default ConstitutionalAgentFieldEntrySurface;
