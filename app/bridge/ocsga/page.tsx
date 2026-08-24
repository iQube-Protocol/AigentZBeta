'use client';

/**
 * /bridge/ocsga — Ian's real invitation URL for the OCSGA × Constitutional
 * Computing Research Collaboration (SPEC-JS-001 §14).
 *
 * A deliberately minimal standalone page — no admin panel, no floating
 * copilot, no bridge sign-in hosting apparatus (see the "Known gap" note
 * below). It mounts ONE thing: IanJourneyTab, which itself is a thin
 * wrapper around the shared JourneyRunSurface runner every journey in this
 * codebase uses. Nothing on this page is a new capability — see
 * services/journey/journeySurfaceRegistry.ts's "Ian Boundary Research
 * journey" section for the full reuse map.
 *
 * Known gap (named, not silently worked around): this page assumes the
 * visitor already has a metaMe session (a persona exists and is signed in)
 * — the same posture the admin diagnostic viewer had. It does NOT host
 * Passport sign-in itself the way app/bridge/knyts/page.tsx and
 * app/bridge/ci/page.tsx do (usePassportSignInHost + PassportConnectPanel)
 * for a completely fresh, zero-session first-touch visitor. If Ian's real
 * invitation must support that case, wiring the same sign-in-hosting
 * pattern those two pages already use is a bounded, known follow-on — not
 * built in this pass.
 */

import { useEffect, useState } from 'react';
import { IanJourneyTab } from '@/app/triad/components/codex/tabs/IanJourneyTab';

export default function OcsgaJourneyPage() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('currentPersonaId');
      if (stored) setPersonaId(stored);
    } catch {
      /* storage unavailable — stays signed-out */
    }
  }, []);

  return (
    <div className="h-screen bg-slate-950 text-slate-100">
      <IanJourneyTab personaId={personaId} />
    </div>
  );
}
