/**
 * POST /api/registry/intake/package-skill
 *
 * Skills Ingestion Agent — one-shot endpoint that runs a skill payload through
 * the full intake → classify → package pipeline and returns the packaged asset.
 *
 * This is the "fast lane" for SkillQube ingestion. For full multi-step intake
 * with human review gates, use POST /api/registry/intake instead.
 *
 * Body:
 *   tenantId       string   required
 *   submittedBy    string   required — persona_id of submitter
 *   name           string   required — human-readable skill name
 *   description    string   required
 *   capabilities   string[] optional — declared capability slugs
 *   tags           string[] optional
 *   version        string   optional — defaults to '1.0.0'
 *   license        string   optional — defaults to 'proprietary'
 *   steps          object[] optional — SKILL.md-style step definitions
 *   sourceUri      string   optional — GitHub repo or package reference
 *   force          boolean  optional — skip trust-band gating (admin only)
 *
 * Pipeline: intake.created → source.classified → asset.packaged
 *
 * Phase 4 — Skills Ingestion Agent
 */

import { NextRequest, NextResponse } from "next/server";
import { submitIntake } from "@/services/registry/intakeService";
import { classifySource } from "@/services/registry/classifierService";
import { packageAsset } from "@/services/registry/packagerService";
import { createSource } from "@/services/registry/persistence";
import type { SourceManifest } from "@/types/registryIngestion";

function generateSourceId(): string {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, submittedBy, name, description } = body;

    if (!tenantId || !submittedBy || !name || !description) {
      return NextResponse.json(
        { ok: false, error: "tenantId, submittedBy, name, and description are required" },
        { status: 400 }
      );
    }

    // ── Step 1: Create intake record ──────────────────────────────────────────
    const intakeResult = await submitIntake({
      tenantId,
      submittedBy,
      sourceType: "manual_bundle",
      sourceUri: body.sourceUri ?? null,
      sourcePayload: {
        name,
        description,
        capabilities: body.capabilities ?? [],
        tags: body.tags ?? [],
        steps: body.steps ?? [],
      },
    });

    if (!intakeResult.ok || !intakeResult.intake) {
      return NextResponse.json(
        { ok: false, error: intakeResult.error ?? "Intake creation failed" },
        { status: 422 }
      );
    }

    const intake = intakeResult.intake;

    // ── Step 2: Create source record ──────────────────────────────────────────
    const manifest: SourceManifest = {
      name,
      description,
      version: typeof body.version === "string" ? body.version : "1.0.0",
      license: typeof body.license === "string" ? body.license : "proprietary",
      keywords: Array.isArray(body.tags) ? body.tags : [],
      entrypoint: body.sourceUri ?? "manual",
      dependencies: {},
    };

    const sourceId = generateSourceId();
    await createSource({
      sourceId,
      intakeId: intake.intakeId,
      sourceType: "manual_bundle",
      rawUri: body.sourceUri ?? null,
      manifest,
      fetchedAt: new Date().toISOString(),
    });

    // ── Step 3: Classify ──────────────────────────────────────────────────────
    const classifyResult = await classifySource(
      intake.intakeId,
      "manual_bundle",
      manifest,
      {
        name,
        description,
        capabilities: body.capabilities ?? [],
        steps: body.steps ?? [],
        tags: body.tags ?? [],
      }
    );

    if (!classifyResult.ok || !classifyResult.classification) {
      return NextResponse.json(
        { ok: false, error: classifyResult.error ?? "Classification failed", intakeId: intake.intakeId },
        { status: 422 }
      );
    }

    // ── Step 4: Package ───────────────────────────────────────────────────────
    const packageResult = await packageAsset(
      intake.intakeId,
      sourceId,
      manifest,
      classifyResult.classification,
      {
        name,
        description,
        tags: body.tags ?? [],
        capabilities: body.capabilities ?? [],
        steps: body.steps ?? [],
      }
    );

    if (!packageResult.ok) {
      return NextResponse.json(
        { ok: false, error: packageResult.error ?? "Packaging failed", intakeId: intake.intakeId },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          intakeId: intake.intakeId,
          assetId: packageResult.assetId,
          classification: classifyResult.classification,
          status: "packaged",
          nextStep: `POST /api/registry/assets/${packageResult.assetId}/validate to run validation pipeline`,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[registry/intake/package-skill] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
