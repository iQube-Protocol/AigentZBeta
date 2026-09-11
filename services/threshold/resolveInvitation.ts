/**
 * resolveInvitation.ts — resolve a public capability-URL Threshold Link code to
 * its T2-safe metadata (shared by the MCP gateway + the manifest link route).
 * Mirrors /api/public/irl/accession's lookup. Emits NO persona/T0 identifiers —
 * only the invitation's own metadata + a sha256 commitment as the invitationId.
 */

import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { DOMAIN_LABELS, type AccessDomain } from '@/services/passport/participationAccess';
import type { InvitationInfo } from './gateway';

const RESEARCH_CAPS = ['research.read', 'research.submit', 'qubetalk.send'];

export async function resolveInvitation(code: string): Promise<InvitationInfo | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const trimmed = code.trim();

  if (trimmed.startsWith('pinv-')) {
    const codeHash = createHash('sha256').update(trimmed).digest('hex');
    const { data: inv, error } = await admin
      .from('access_invitations')
      .select('access_domain, role, label, status, expires_at')
      .eq('code_hash', codeHash)
      .maybeSingle();
    if (error || !inv) return null;
    const isResearch = inv.access_domain === 'research-lab';
    return {
      invitationId: `pinv:${codeHash.slice(0, 16)}`,
      initiatingService: isResearch ? 'irl' : inv.access_domain,
      institution: inv.label ?? DOMAIN_LABELS[inv.access_domain as AccessDomain] ?? inv.access_domain,
      requestedRole: inv.role,
      requestedCapabilities: isResearch ? RESEARCH_CAPS : [],
      status: inv.status,
      onboarded: inv.status !== 'active',
      expiresAt: inv.expires_at,
    };
  }

  if (trimmed.startsWith('x409-')) {
    const { data: inv, error } = await admin
      .from('x409_invitations')
      .select('label, status')
      .eq('code', trimmed)
      .maybeSingle();
    if (error || !inv) return null;
    return {
      invitationId: `x409:${createHash('sha256').update(trimmed).digest('hex').slice(0, 16)}`,
      initiatingService: 'irl',
      institution: inv.label ?? 'Constitutional Agreement',
      requestedRole: 'Independent Reviewer',
      requestedCapabilities: RESEARCH_CAPS,
      status: inv.status,
      onboarded: inv.status === 'claimed',
      expiresAt: null,
    };
  }
  return null;
}
