/**
 * POST /api/access-gateway/logout — alias for /api/access-gateway/revoke
 * (PRD-PAG-001 §2.1 names both /logout and /revoke on the human adapter's
 * endpoint set; they are the same status-flip act in Phase 1).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export { POST, OPTIONS } from '../revoke/route';
