'use client';

/**
 * ConstitutionalAgentFieldEntrySurface — PERSONIFY's SUPPORTING-tools
 * surface (evolved from ACT's primary surface, 2026-08-11; rebuilt onto the
 * shared BridgeContentCapsule shell the same day).
 *
 * Repositioned, not rebuilt in spirit: PERSONIFY's primary surface is
 * ConstitutionalInternetBridgePersonifyMyCanvas ("Tell your Constitutional
 * story"); this component's two original sibling paths are preserved as
 * OPTIONAL supporting tools underneath it, neither of which is delegation —
 * now hydrated as the capsule's two rail cards:
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
 *       ceremony (unchanged), PAIRED with the real, focused aigentMe/metaMe
 *       surface (the same embed pattern KNYTS' own Delegate stage uses —
 *       utils/codex-nav.ts's focused/focusedNavDepth contract) so aigentMe
 *       can actually help shape the person's story instead of the ceremony
 *       floating in an otherwise-empty viewport. The person remains author.
 *
 * The capsule's persistent strip carries the governing rule regardless of
 * which rail card is active: "Context may cross before authority does" /
 * "Connected agent ≠ delegated agent." Neither path requires the other;
 * either alone completes PERSONIFY's `agentRelationshipStarted` evidence
 * (an OR, not a checklist — unchanged by this evolution).
 */

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { buildCodexUrl } from '@/utils/codex-nav';
import { ConstitutionalAgentDispositionSurface } from '@/components/journey/ConstitutionalAgentDispositionSurface';
import { BridgeContentCapsule, type BridgeCapsuleRailCard } from '@/components/journey/BridgeContentCapsule';
import { ActivateClaudeChip } from '@/components/shared/ActivateClaudeChip';

interface Props {
  personaId?: string;
}

const FIELD_ENTRY_RAIL: BridgeCapsuleRailCard[] = [
  { id: 'connect', label: 'Connect Claude', aspect: 'compact' },
  { id: 'aigentme', label: 'Meet aigentMe', aspect: 'compact' },
];

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
 *  Delegate stage, so aigentMe actually helps shape the story rather than
 *  the disposition ceremony above floating in an empty viewport. */
function MeetAigentMeEmbed({ personaId }: { personaId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const src = buildCodexUrl('metame-codex', {
    tab: 'aigent-me',
    personaId,
    shell: 'embed',
    suppressCopilot: true,
    focused: !expanded,
    focusedNavDepth: expanded ? undefined : 1,
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-end">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-none border-none cursor-pointer p-0"
        >
          {expanded ? 'Focus view' : 'Explore metaMe ↗'}
        </button>
      </div>
      <iframe
        src={src}
        title="Meet aigentMe"
        className="h-[16rem] w-full rounded-md border border-slate-800 bg-slate-950"
      />
    </div>
  );
}

export function ConstitutionalAgentFieldEntrySurface({ personaId }: Props) {
  return (
    <BridgeContentCapsule
      railCards={FIELD_ENTRY_RAIL}
      allowFullscreen={false}
      renderViewport={(activeId) => {
        if (activeId === 'aigentme') {
          return (
            <div className="space-y-3 p-3">
              <ConstitutionalAgentDispositionSurface />
              <MeetAigentMeEmbed personaId={personaId} />
            </div>
          );
        }
        return (
          <div className="p-3">
            <ActivateClaudeChip
              checkConnected={checkClaudeConnected}
              recordConnected={recordClaudeConnected}
              context="your Constitutional story"
            />
          </div>
        );
      }}
      renderStrip={(activeId) => (
        <p className="text-[11px] text-slate-500">
          {activeId === 'aigentme' ? (
            <>
              <Sparkles className="mr-1 inline h-3 w-3 text-indigo-300" /> aigentMe helps shape your story — you
              remain the author.
            </>
          ) : (
            'Context may cross before authority does. Connected agent ≠ delegated agent.'
          )}
        </p>
      )}
    />
  );
}

export default ConstitutionalAgentFieldEntrySurface;
