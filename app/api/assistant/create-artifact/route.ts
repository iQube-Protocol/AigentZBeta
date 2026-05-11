/**
 * POST /api/assistant/create-artifact
 *
 * Aigent Me Phase 6 — Artifact Creation (alpha stub).
 * Per PRD v0.2 §12 (Create artifact) and §10 FR10 / FR11.
 *
 * Body:
 *   {
 *     artifactType: 'google-doc'|'gmail-draft'|'calendar-block'|'brief'|
 *                   'post-set'|'image-prompt'|'video-script'|'slide-outline'|
 *                   'venture-report';
 *     title?: string;          // defaults from intent / specialist response
 *     sourceIntentId?: string; // links the artifact to a queued intent
 *     destination?: 'runtime'|'drive'|'gmail'|'cartridge_store';
 *     specialistId?: string;   // when the artifact came from a specialist response
 *   }
 *
 * Alpha behavior:
 *   - Phase 6 ships the structural pipeline + receipt emission.
 *   - destination='runtime' (default) → record an ArtifactRecord-like
 *     summary in an ActivityReceipt + return the synthesised artifact id.
 *     No external write yet; the artifact lives as a receipt-bound record
 *     until Phase 6.b wires Google Workspace OAuth + actual API calls.
 *   - destination='drive'|'gmail'|'cartridge_store' → returns 501 with a
 *     diagnostic naming the deferred work.
 *
 * Privacy:
 *   - personaId from spine.
 *   - The IntentQube + ExperienceQube meta slice supply the context label;
 *     no BlakQube values written to the receipt's context_shared field.
 *   - Every create emits an ActivityReceipt of action_type='artifact_created'.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getIntentQube } from '@/services/iqube/intentQube';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

const VALID_ARTIFACT_TYPES = new Set<string>([
  'google-doc',
  'gmail-draft',
  'calendar-block',
  'brief',
  'post-set',
  'image-prompt',
  'video-script',
  'slide-outline',
  'venture-report',
]);

const VALID_DESTINATIONS = new Set<string>([
  'runtime',
  'drive',
  'gmail',
  'cartridge_store',
]);

const DEFERRED_DESTINATIONS = new Set<string>(['drive', 'gmail', 'cartridge_store']);

interface PostBody {
  artifactType?: string;
  title?: string;
  sourceIntentId?: string;
  destination?: string;
  specialistId?: string;
}

interface CreateArtifactSurface {
  artifactId: string;
  artifactType: string;
  title: string;
  destination: 'runtime';
  status: 'draft';
  receiptId: string | null;
  intentId: string | null;
  message: string;
  createdAt: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  if (!body.artifactType || !VALID_ARTIFACT_TYPES.has(body.artifactType)) {
    return NextResponse.json(
      {
        error: 'invalid-artifactType',
        detail: `artifactType must be one of: ${Array.from(VALID_ARTIFACT_TYPES).join(', ')}`,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const destination = body.destination ?? 'runtime';
  if (!VALID_DESTINATIONS.has(destination)) {
    return NextResponse.json(
      { error: 'invalid-destination' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (DEFERRED_DESTINATIONS.has(destination)) {
    return NextResponse.json(
      {
        error: 'destination-not-implemented',
        detail:
          `destination='${destination}' lands in Phase 6.b alongside Google Workspace OAuth. ` +
          `For alpha, use destination='runtime'.`,
      },
      { status: 501, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    let cartridge = 'metame';
    let derivedTitle = body.title?.trim() || `Untitled ${body.artifactType}`;
    if (body.sourceIntentId) {
      const intent = await getIntentQube(body.sourceIntentId);
      if (intent) {
        cartridge = intent.activeCartridge || cartridge;
        if (!body.title) derivedTitle = `${body.artifactType} for ${intent.intentName}`;
      }
    }

    const createdAt = new Date().toISOString();
    const artifactId = `art_${cryptoRandomId()}`;

    // Emit the receipt. Becomes null if the migration hasn't run yet —
    // the route still returns a useful response so the demo flow stays alive.
    const receipt = await createActivityReceipt({
      personaId: context.personaId,
      intentId: body.sourceIntentId ?? null,
      activeCartridge: cartridge,
      actionType: 'artifact_created',
      summary: `Created ${body.artifactType}: ${derivedTitle}`,
      agentsInvoked: [
        'aigent-me',
        ...(body.specialistId ? [body.specialistId] : []),
      ],
      toolsUsed: ['runtime'],
      iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
      contextShared: ['intent-summary', 'experience-meta-slice'],
      artifactsCreated: [`${body.artifactType}:${derivedTitle}`],
      approvalsGranted: body.sourceIntentId ? [body.sourceIntentId] : [],
    });

    const surface: CreateArtifactSurface = {
      artifactId,
      artifactType: body.artifactType,
      title: derivedTitle,
      destination: 'runtime',
      status: 'draft',
      receiptId: receipt?.id ?? null,
      intentId: body.sourceIntentId ?? null,
      message:
        `Artifact created in the runtime as a draft. ` +
        `Send / share / publish lands in Phase 6.b alongside Google Workspace OAuth — ` +
        `a fresh Approval Card will gate any external action then.`,
      createdAt,
    };

    return NextResponse.json(surface, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/create-artifact] failed: ${msg}`);
    return NextResponse.json(
      { error: 'create-artifact-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

function cryptoRandomId(): string {
  // 10-char URL-safe id; collision-tolerant for alpha. Server-side only.
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
