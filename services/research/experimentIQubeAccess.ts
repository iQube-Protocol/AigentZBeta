/** Canonical read authority for experiment-native iQubes. */

import type { ActivePersonaContext } from '@/types/access';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveExperimentReviewGrant } from '@/services/passport/participationAccess';

export async function canReadExperimentIQube(
  persona: ActivePersonaContext,
  experimentId: string,
): Promise<boolean> {
  if (persona.cartridgeFlags?.isAdmin === true) return true;
  const admin = getSupabaseServer();
  if (!admin) return false;
  return (await resolveExperimentReviewGrant(admin, persona.personaId, experimentId)) !== null;
}

