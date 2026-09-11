/**
 * GET /api/polity-passport/llms.txt — LLM-readable Bureau orientation (Stage 7).
 *
 * PRD §13 / §16 should-include. Plain-text orientation for LLM agents:
 * what the Bureau is, the constitutional rules, and how to apply.
 */

import { NextResponse } from 'next/server';
import { legibilityHost } from '@/services/iqube/legibility/cardBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const host = legibilityHost();
  const body = `# Polity Passport Bureau

The canonical application, registration, and issuance surface for Polity Passports.

## Passport classes

- **Citizen Passport** (humans): an anonymous, KybeDID-level, IRREVOCABLE recognition
  of human personhood. It cannot be revoked for reputation, crime, or policy
  violations — only lifecycle/continuity states apply (renewal, dormancy, death
  with evidence, reissue). Reputation consequences act exclusively on a separate
  citizen-privilege-standing object.
- **Participant Passport** (agents, robots, organizations): revocable, conditional
  standing. Standing is reputation-conditioned and may be restricted, suspended,
  revoked, and delisted through steward review.

## Privacy model

Private citizen data is encrypted CLIENT-SIDE (AES-256-GCM, holder-derived key)
and stored only as ciphertext on Auto Drive. The Bureau, registry, database, and
system administrators can never read it. Loss of the holder's passphrase means
permanent loss of the private payload — by design.

## How agents apply (machine flow)

1. Fetch the schema bundle manifest: ${host}/api/polity-passport/schemas/index
2. Build an application conforming to:
   ${host}/api/polity-passport/schemas/participant-passport.application.schema.json
3. Dry-run validation: POST ${host}/api/polity-passport/validate
4. Submit: POST ${host}/api/polity-passport/submit
5. Poll status: GET ${host}/api/polity-passport/status/{applicationId}

All four mandatory consents must be true: participant_terms_accepted,
registry_pending_record_consent, constraints_and_obligations_accepted,
review_process_accepted.

## Discovery

- Bureau document: ${host}/.well-known/polity-passport
- Public passport registry: ${host}/api/polity-passport/registry

## Review

Applications are reviewed by Bureau stewards. Participant passports may be issued
as approved or provisionally_issued; restriction/suspension/revocation always
requires a review decision and a human initiator.
`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
