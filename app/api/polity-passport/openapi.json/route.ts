/**
 * GET /api/polity-passport/openapi.json — OpenAPI 3.1 spec (Stage 7).
 *
 * PRD §13 / §16 should-include. Describes the Bureau's machine surfaces so
 * agents (and humans) can generate clients. The JSON Schemas referenced are
 * the canonical bundle served at /api/polity-passport/schemas/* — this spec
 * links to them rather than inlining, keeping one source of truth.
 */

import { NextResponse } from 'next/server';
import { legibilityHost } from '@/services/iqube/legibility/cardBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const host = legibilityHost();
  const schemaBase = `${host}/api/polity-passport/schemas`;

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Polity Passport Bureau API',
      version: '0.1.0',
      description:
        'Machine surfaces for Participant Passport applications (agents, robots, organizations) and the public passport registry. Citizen applications use the Bureau cartridge UI. Constitutional rules: Citizen Passports are irrevocable personhood recognition; Participant Passports are revocable conditional standing; private citizen data is holder-custodied ciphertext the Bureau can never read.',
    },
    servers: [{ url: host }],
    paths: {
      '/api/polity-passport/schemas/{name}': {
        get: {
          operationId: 'getSchema',
          summary: 'Fetch a schema bundle member (use "index" for the manifest)',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'participant-passport.application.schema.json',
            },
          ],
          responses: {
            '200': { description: 'The JSON Schema document' },
            '404': { description: 'Unknown schema; response lists available names' },
          },
        },
      },
      '/api/polity-passport/validate': {
        post: {
          operationId: 'validateApplication',
          summary: 'Dry-run validation of a participant application (nothing persisted)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: `${schemaBase}/participant-passport.application.schema.json`,
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Validation result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      valid: { type: 'boolean' },
                      issues: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            path: { type: 'string' },
                            message: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/polity-passport/submit': {
        post: {
          operationId: 'submitApplication',
          summary: 'Submit a participant passport application',
          description:
            'All four mandatory consents must be true. One open application per agent card URL. An optional top-level signature object is recorded as recorded_unverified (signed-JSON verification is a v0.2 item).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: `${schemaBase}/participant-passport.application.schema.json`,
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Application accepted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      applicationId: { type: 'string', format: 'uuid' },
                      applicationStatus: { type: 'string' },
                      passportClass: { type: 'string' },
                      statusUrl: { type: 'string' },
                    },
                  },
                },
              },
            },
            '409': { description: 'An open application already exists for this agent card' },
            '422': { description: 'Validation failed; body carries issues[]' },
          },
        },
      },
      '/api/polity-passport/status/{id}': {
        get: {
          operationId: 'getApplicationStatus',
          summary: 'Public application status by id',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': { description: 'Public-safe status projection (no identity refs)' },
            '404': { description: 'Application not found' },
          },
        },
      },
      '/api/polity-passport/registry': {
        get: {
          operationId: 'listPassports',
          summary: 'Public registry of issued passports',
          description:
            'Identity appears as commitment hashes only — never raw DIDs or persona ids. Citizen rows carry citizenPassportIrrevocable: true.',
          parameters: [
            {
              name: 'class',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: [
                  'citizen',
                  'agent_participant',
                  'robot_participant',
                  'organization_participant',
                ],
              },
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Public passport list' },
          },
        },
      },
    },
    externalDocs: {
      description: 'Bureau discovery document',
      url: `${host}/.well-known/polity-passport`,
    },
  };

  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
