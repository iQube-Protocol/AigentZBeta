/**
 * GET /api/marketa/activation/sample-agent-card?seed=<n>
 *
 * Serves a resolvable A2A-style Agent Card JSON for SAMPLE activation
 * candidates, so the operator can run the discovery → score → registry →
 * passport pipeline end-to-end against agent card data that actually
 * resolves (the Bureau anchors participant identity on agent_card_url).
 *
 * `seed` makes each sample's card URL unique — the Bureau allows one open
 * application per agent card URL, so every "Add sample" click must mint a
 * distinct identity anchor. The seed is echoed into the card so the document
 * is self-consistent. Public route: everything here is demo data.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const seed = request.nextUrl.searchParams.get('seed') ?? 'default';
  const name = request.nextUrl.searchParams.get('name') ?? 'Example Agent Candidate';
  const selfUrl = `${request.nextUrl.origin}/api/marketa/activation/sample-agent-card?seed=${encodeURIComponent(seed)}`;

  return NextResponse.json(
    {
      // A2A Agent Card shape (agent-card.json)
      name: `${name} (sample ${seed})`,
      description:
        'Sample candidate agent served by the Marketa Activation Engine for end-to-end pipeline testing. Founder-operator research and outreach agent with CRM support and human-approved campaign drafting.',
      url: selfUrl,
      version: '0.1.0',
      provider: {
        organization: 'Example Operator (sample)',
        url: 'https://example.com',
      },
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [
        {
          id: 'research',
          name: 'Research',
          description: 'Founder-operator research briefs with cited sources.',
          tags: ['research', 'briefs'],
        },
        {
          id: 'crm-support',
          name: 'CRM support',
          description: 'Contact enrichment and pipeline hygiene, human-reviewed.',
          tags: ['crm'],
        },
        {
          id: 'outreach-drafting',
          name: 'Outreach drafting',
          description: 'Campaign email drafts; never sends without human approval.',
          tags: ['outreach', 'human-approved'],
        },
      ],
      metadata: {
        sample: true,
        seed,
        issuedBy: 'marketa-activation-engine',
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
