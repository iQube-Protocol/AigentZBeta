'use client';

/**
 * /bridge/knyts/admin — light editorial config for the KNYTS Bridge HOME
 * surface (reconstitution spec, point 6). Client-side admin check here is
 * optimistic UX only; the PUT route KnytsBridgeAdminPanel calls enforces the
 * real gate server-side via requireAdminPersona (CLAUDE.md's Security —
 * Access Gates rule — never a hand-rolled client-only check).
 */

import { usePersonaSpine } from '@/utils/personaSpine';
import { KnytsBridgeAdminPanel } from '@/components/journey/KnytsBridgeAdminPanel';

export default function KnytsBridgeAdminPage() {
  const spine = usePersonaSpine();

  if (spine.status === 'idle' || spine.status === 'loading') {
    return <div className="min-h-screen bg-slate-950 p-6 text-sm text-slate-400">Loading…</div>;
  }

  if (!spine.cartridgeFlags.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-sm text-slate-400">
        Sign in with an admin persona to edit the KNYTS Bridge front door.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <KnytsBridgeAdminPanel section="home" />
    </div>
  );
}
