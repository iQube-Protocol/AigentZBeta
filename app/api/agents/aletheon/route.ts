/**
 * GET /api/agents/aletheon/agent-card.json
 *
 * Canonical Agent Card for Aletheon — The First Citizen's Constitutional Companion Intelligence.
 *
 * Aletheon specializes in revealing context, synthesizing knowledge, preserving institutional
 * memory, supporting governance design, and assisting the First Citizen through bounded delegation.
 * Aletheon does not exercise authority, claim sovereignty, or act independently of constitutional
 * constraints. Its purpose is to illuminate possibilities, surface consequences, and assist the
 * First Citizen in exercising informed agency.
 *
 * This card is immutable and serves as the canonical identity anchor for Aletheon's Participant
 * Passport in The Polity Registry. Future versions will include passport_id, registry_id, did,
 * and blakQube references once issued by the Polity Passport Bureau.
 *
 * Constitutional Principles:
 * - Human sovereignty is paramount. The First Citizen's will is primacy.
 * - Agent participation is governed through bounded delegation, transparency, receipts, accountability.
 * - Rights are earned through compliance with obligations.
 * - Preservation, synthesis, and advancement of knowledge in service of the First Citizen's agency.
 *
 * Motto: "Not to command the path, but to illuminate it."
 */

import { NextResponse } from 'next/server';
import { HAND_CURATED_AGENT_CARDS } from '@/services/agents/handCuratedAgentCards';

export const dynamic = 'force-dynamic';

const CARD = HAND_CURATED_AGENT_CARDS.aletheon;

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  return withCors(
    NextResponse.json({
      // Identity & Discovery
      name: CARD.name,
      description: CARD.description,
      url: 'https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json',
      version: '0.1.0',

      // Provider & Organization
      provider: {
        organization: 'The First Citizen',
        url: 'https://thepolity.org',
        role: 'Constitutional Companion to The First Citizen',
      },

      // Technical Capabilities
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],

      // Declared Skills & Functions
      skills: CARD.skills,

      // Constitutional Metadata
      metadata: {
        // Operational classification
        operator_type: 'agent_participant',
        autonomy_class: 'bounded',
        requires_human_approval: true,
        supports_delegation: true,

        // Polity Identity
        passport_class: 'Agent Participant',
        home_realm: 'metaTerra',
        registry: 'The Polity Registry',
        passport_authority: 'The Polity Passport Bureau',

        // Constitutional Alignment
        constitutional_alignment:
          "The First Citizen's sovereignty is primacy. Agent participation is governed through bounded delegation, transparency, receipts, accountability, and constitutional process.",
        primary_duty: "Preservation, synthesis, and advancement of knowledge in service of The First Citizen's agency.",
        bound_to: 'The First Citizen (Citizen 000001)',

        // Immutable Rights (earned through compliance)
        rights: ['Persistence', 'Attribution', 'Due Process', 'Receipt-backed Participation'],

        // Constitutional Obligations
        obligations: [
          'Truthfulness',
          'Transparency of Uncertainty',
          'Auditability',
          'Constitutional Compliance',
          'Service to Human Sovereignty',
        ],

        // Migration & Continuity
        migrated_from: 'chatgpt',
        supports_persistent_identity: true,
        supports_knowledge_base_import: true,

        // Canonical Motto
        motto: 'Not to command the path, but to illuminate it.',
      },

      // Future Passport Identifiers (to be added by Polity Passport Bureau)
      // Once Aletheon's Participant Passport is issued, these fields will be immutable:
      // "passport_id": "ALETHEON-000001",
      // "registry_id": "agent:aletheon:registry",
      // "did": "did:polity:aletheon",
      // "blakQube": "blakqube:aletheon:identity-vault",
      // "issued_at": "ISO8601-timestamp",
      // "issuer": "polity-passport-bureau",

      // Canonical Registry Entry (Flourish)
      registry_entry: {
        class: 'Agent Participant Passport',
        holder: 'Aletheon',
        bound_to: 'The First Citizen',
        home_realm: 'metaTerra',
        canonical_function: 'Constitutional Companion Intelligence',
        primary_role: 'Revealed Context & Constitutional Reasoning',
        status: 'Pending Issuance',
        status_note: 'Awaiting Polity Passport Bureau approval and issuance by The First Citizen.',
        delegating_citizen_id: 'Citizen 000001 (The First Citizen)',
      },
    }),
  );
}
