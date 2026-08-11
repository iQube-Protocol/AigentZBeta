'use client';

/**
 * ConstitutionalAgentFieldEntrySurface — PERSONIFY's SUPPORTING-tools
 * surface (evolved from ACT's primary surface, 2026-08-11).
 *
 * Repositioned, not rebuilt in spirit: PERSONIFY's primary surface is
 * ConstitutionalInternetBridgePersonifyMyCanvas ("Tell your Constitutional
 * story"); this component's two original sibling paths are preserved as
 * OPTIONAL supporting tools underneath it, neither of which is delegation:
 *
 *   (A) Connect Claude — the reusable ActivateClaudeChip
 *       (components/shared/ActivateClaudeChip.tsx), wired to the REAL,
 *       already-working metaMe Threshold MCP endpoint (a standard OAuth 2.1
 *       + PKCE + Dynamic Client Registration crossing that Claude Desktop's
 *       / claude.ai's own "add custom connector" flow speaks directly — see
 *       app/api/threshold/mcp/route.ts, app/threshold/authorize/page.tsx)
 *       via this stage's own connect-agent route for the check/record
 *       calls. A base crossing grants ONLY read/query scope — never
 *       delegation, mandate, Standing, or transaction rights. Completing
 *       this path is a SELF-REPORT ("I've connected — continue"), not a
 *       verified check — see the connect-agent route's own header for why.
 *   (B) Meet aigentMe — the pre-existing ConstitutionalAgentDispositionSurface
 *       ceremony, PAIRED with the real, focused aigentMe/metaMe surface (the
 *       same embed pattern KNYTS' own Delegate stage uses — utils/codex-nav.ts's
 *       focused/focusedNavDepth contract) so aigentMe can actually help shape
 *       the person's story instead of the ceremony floating in an otherwise-
 *       empty viewport. The person remains author.
 *
 * Landing/expanded split (final interaction pass, 2026-08-11): the two
 * supporting tools no longer share one BridgeContentCapsule viewport+rail
 * shell — that shape forced a visitor to select one before seeing either.
 * The LANDING state is now one compact horizontal row (desktop) with both
 * choices visible at once: a self-contained Connect-Claude block (status +
 * CTA + MCP endpoint, all inside ActivateClaudeChip already) beside a
 * Meet-aigentMe entry card. "Connected agent ≠ delegated agent" is quiet
 * supporting copy beneath the row, never a full-width panel of its own.
 * Clicking "Meet aigentMe" swaps to the EXPANDED state: a 50/50 left/right
 * split — left is the real embedded aigentMe surface, right is the
 * role/authority question wrapped in the SAME LayoutShell capsule chrome
 * Horizen's Threshold Guide uses for its own aigentMe disposition question
 * (components/metame/welcome/layouts/LayoutShell.tsx, mirroring
 * MoneyPennyFocusLayout.tsx's usage) — reusing the proven grammar rather
 * than inventing a third questionnaire design. Either path alone still
 * completes PERSONIFY's `agentRelationshipStarted` evidence (an OR, not a
 * checklist — unchanged by this evolution).
 */

import React, { useState } from 'react';
import { ArrowRight, Bot, Sparkles } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { buildCodexUrl } from '@/utils/codex-nav';
import { ConstitutionalAgentDispositionSurface } from '@/components/journey/ConstitutionalAgentDispositionSurface';
import { LayoutShell } from '@/components/metame/welcome/layouts/LayoutShell';
import { ActivateClaudeChip } from '@/components/shared/ActivateClaudeChip';

interface Props {
  personaId?: string;
}

const CONNECT_AGENT_ROUTE = '/api/journey/constitutional-internet-bridge/act/connect-agent';

async function checkClaudeConnected(): Promise<boolean> {
  const res = await personaFetch(CONNECT_AGENT_ROUTE, { cache: 'no-store' });
  const json = await res.json().catch(() => null);
  return Boolean(json?.connected);
}

async function recordClaudeConnected(): Promise<void> {
  await personaFetch(CONNECT_AGENT_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent: 'claude' }),
  });
}

/** The real, focused aigentMe/metaMe surface — reuses the shared
 *  Focused/Full contract (utils/codex-nav.ts) exactly like KNYTS' own
 *  Delegate stage, so aigentMe actually helps shape the story. Always full
 *  ("Explore") when expanded, since it now sits in a dedicated half of the
 *  split rather than a small always-focused thumbnail. */
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
  const [aigentMeOpen, setAigentMeOpen] = useState(false);

  if (aigentMeOpen) {
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
            onDismiss={() => setAigentMeOpen(false)}
            dismissLabel="Back"
            body={<ConstitutionalAgentDispositionSurface />}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
          <p className="mb-2 text-xs font-semibold text-slate-200">Connect Claude</p>
          <ActivateClaudeChip
            checkConnected={checkClaudeConnected}
            recordConnected={recordClaudeConnected}
            context="your Constitutional story"
          />
        </div>
        <button
          type="button"
          onClick={() => setAigentMeOpen(true)}
          className="flex flex-col items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 text-left transition hover:border-indigo-400/30"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Bot className="h-3.5 w-3.5 text-indigo-300" /> Meet aigentMe
          </span>
          <p className="text-xs text-slate-400">
            aigentMe helps shape your story — you remain the author.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300">
            Open aigentMe <ArrowRight className="h-3 w-3" />
          </span>
        </button>
      </div>
      <p className="text-[11px] text-slate-500">Context may cross before authority does. Connected agent ≠ delegated agent.</p>
    </div>
  );
}

export default ConstitutionalAgentFieldEntrySurface;
