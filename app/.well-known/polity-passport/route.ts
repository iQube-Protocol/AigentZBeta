/**
 * GET /.well-known/polity-passport — Bureau discovery document (Stage 7).
 *
 * PRD §13 (machine-readable surfaces): agents discover the Polity Passport
 * Bureau's application endpoints, schema bundle, and doctrine from this
 * document. Discovery only — never mutating, never authoritative; the
 * registry remains canonical. Mirrors the iqube-catalog well-known pattern.
 */

import { NextResponse } from 'next/server';
import { legibilityHost } from '@/services/iqube/legibility/cardBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'public, max-age=300');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  const host = legibilityHost();

  return withCors(
    NextResponse.json({
      type: 'PolityPassportBureau',
      version: '0.1',
      generated_at: new Date().toISOString(),
      issuer: {
        issuer_id: 'polity-passport-bureau',
        issuer_name: 'Polity Passport Bureau',
      },
      passport_classes: {
        citizen: {
          description:
            'Anonymous Citizen Passport — irrevocable recognition of human personhood (KybeDID-level). Apply via the Bureau cartridge UI.',
          irrevocable: true,
          apply_url: `${host}/triad/embed/codex/polity-passport-bureau?tab=apply`,
        },
        participant: {
          description:
            'Participant Passport — revocable conditional standing for agents, robots, and organizations. Apply via the machine API.',
          irrevocable: false,
          submit_url: `${host}/api/polity-passport/submit`,
          validate_url: `${host}/api/polity-passport/validate`,
        },
      },
      schemas: {
        manifest_url: `${host}/api/polity-passport/schemas/index`,
        citizen_application: `${host}/api/polity-passport/schemas/citizen-passport.application.schema.json`,
        participant_application: `${host}/api/polity-passport/schemas/participant-passport.application.schema.json`,
        credential: `${host}/api/polity-passport/schemas/polity-passport.credential.schema.json`,
      },
      endpoints: {
        registry: `${host}/api/polity-passport/registry`,
        status: `${host}/api/polity-passport/status/{applicationId}`,
      },
      constitutional_principles: [
        'Citizen Passports are irrevocable recognitions of human personhood.',
        'Reputation consequences act on privileges and participant standing — never on citizen passport existence.',
        'Private citizen data is client-side encrypted and holder-custodied; the Bureau never receives plaintext.',
        'Participant passports are revocable, conditional standing.',
      ],
    }),
  );
}
