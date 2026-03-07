import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/skills/invoke
 *
 * Invokes a registered skill (e.g., Sora Video Gen) through the SkillWrapper
 * sandbox pattern. When OPENAI_API_KEY is configured, calls the real Sora
 * Videos API. Falls back to simulation mode if the key is missing or the
 * account lacks Sora access.
 *
 * Request body:
 * {
 *   skill_id: string,           // e.g. "sora_video_gen_curated"
 *   prompt: string,             // video description
 *   duration?: number,          // seconds (5-20, clamped)
 *   aspect_ratio?: string,      // "16:9" | "9:16" | "1:1"
 *   style?: string,             // "cinematic" | "animation" | "comic" | "photorealistic"
 *   creative_pack?: string,     // optional creative pack context
 *   experience_id?: string,     // owning ExperienceQube ID
 *   tenant_id?: string,
 * }
 */

export const runtime = "nodejs";

// Skill registry (mirrors /api/skills/registry scoring)
const SKILL_REGISTRY: Record<string, { name: string; provenance: string; composite: number; badge: string; hydrate: boolean }> = {
  sora_video_gen_curated: { name: "Sora Video Gen (Curated)", provenance: "first_party_curated", composite: 79, badge: "A", hydrate: true },
  sora_video_gen_community: { name: "Sora Video Gen (Community)", provenance: "community", composite: 52, badge: "C", hydrate: false },
};

// OpenAI Videos API (REST — SDK v4.x doesn't include this resource yet)
const OPENAI_VIDEOS_URL = "https://api.openai.com/v1/videos";

// Map aspect_ratio to Sora size strings (supported: 1280x720, 720x1280, 1792x1024, 1024x1792)
const ASPECT_TO_SIZE: Record<string, string> = {
  "16:9": "1280x720",
  "9:16": "720x1280",
  "1:1":  "1280x720",  // no square option — default to landscape
};

// Poll interval and max wait for video generation
const POLL_INTERVAL_MS = 10_000;  // 10 seconds (docs recommend 10-20s)
const MAX_POLL_MS = 300_000;      // 5 minutes

/**
 * Start a Sora video generation job.
 * Uses multipart/form-data as per OpenAI Videos API spec.
 */
async function createSoraJob(
  apiKey: string,
  prompt: string,
  seconds: number,
  aspectRatio: string,
): Promise<{ id: string; status: string; progress: number; [k: string]: unknown }> {
  const size = ASPECT_TO_SIZE[aspectRatio] || ASPECT_TO_SIZE["16:9"];
  // Sora only supports 4, 8, or 12 second videos — snap to nearest
  const VALID_SECONDS = [4, 8, 12];
  const snappedSeconds = VALID_SECONDS.reduce((prev, curr) =>
    Math.abs(curr - seconds) < Math.abs(prev - seconds) ? curr : prev
  );

  const form = new FormData();
  form.append("model", "sora-2");
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("seconds", String(snappedSeconds));

  const res = await fetch(OPENAI_VIDEOS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.error?.message || `Sora API ${res.status}: ${res.statusText}`;
    throw new Error(msg);
  }

  return data;
}

/**
 * Poll GET /v1/videos/{video_id} until status is completed, failed, or timeout.
 * Statuses: queued → in_progress → completed | failed
 */
async function pollSoraJob(
  apiKey: string,
  videoId: string,
): Promise<{ status: string; progress: number; error_msg: string | null; raw: Record<string, unknown> }> {
  const start = Date.now();

  while (Date.now() - start < MAX_POLL_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${OPENAI_VIDEOS_URL}/${videoId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.error?.message || `Poll error ${res.status}`;
      return { status: "failed", progress: 0, error_msg: msg, raw: data || {} };
    }

    const status: string = data?.status || "unknown";
    const progress: number = data?.progress ?? 0;
    console.log(`[SoraPoll] ${videoId} → ${status} ${progress}% (${Math.round((Date.now() - start) / 1000)}s)`);

    if (status === "completed") {
      return { status: "completed", progress: 100, error_msg: null, raw: data };
    }

    if (status === "failed") {
      const errMsg = data?.error?.message || "Generation failed";
      return { status: "failed", progress, error_msg: errMsg, raw: data };
    }

    // queued / in_progress — keep polling
  }

  return { status: "timeout", progress: 0, error_msg: "Generation timed out (5 min). Use generation_id to check later.", raw: {} };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      skill_id,
      prompt,
      duration = 10,
      aspect_ratio = "16:9",
      style = "cinematic",
      creative_pack,
      experience_id,
      tenant_id = "qripto-codex",
    } = body;

    if (!skill_id) {
      return NextResponse.json({ ok: false, error: "skill_id is required" }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ ok: false, error: "prompt is required" }, { status: 400 });
    }

    const skill = SKILL_REGISTRY[skill_id];
    if (!skill) {
      return NextResponse.json({ ok: false, error: `Unknown skill: ${skill_id}` }, { status: 404 });
    }

    // Gate check — only hydrate-passing skills can invoke without override
    const trustOverride = body.trust_override === true;
    if (!skill.hydrate && !trustOverride) {
      return NextResponse.json({
        ok: false,
        error: `Skill ${skill_id} (Badge ${skill.badge}, composite ${skill.composite}) does not pass hydration gate (requires 60). Set trust_override=true to proceed.`,
        gate_blocked: true,
        skill_badge: skill.badge,
        skill_composite: skill.composite,
      }, { status: 403 });
    }

    const invocationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startedAt = new Date().toISOString();

    // Check for real OPENAI_API_KEY
    const apiKey = process.env.OPENAI_API_KEY;
    let videoUrl: string | null = null;
    let mode: "live" | "simulation" = "simulation";
    let generationMetadata: Record<string, unknown> = {};
    let generationId: string | null = null;

    if (apiKey && apiKey.startsWith("sk-")) {
      // Attempt live Sora API call
      try {
        console.log(`[SkillInvoke] Attempting live Sora generation for: "${prompt.substring(0, 60)}..."`);
        const job = await createSoraJob(apiKey, prompt, duration, aspect_ratio);
        generationId = job.id || null;
        console.log(`[SkillInvoke] Sora job created: ${generationId}, status: ${job.status}`);

        if (job.status === "completed") {
          // Immediate completion (rare) — serve via proxy
          videoUrl = `/api/skills/video/${generationId}`;
          mode = "live";
          generationMetadata = {
            model: "sora-2",
            generation_id: generationId,
            completed_immediately: true,
          };
        } else {
          // Poll for completion (queued / in_progress)
          const result = await pollSoraJob(apiKey, generationId!);

          if (result.status === "completed") {
            // Video content available via GET /v1/videos/{id}/content — proxy it
            videoUrl = `/api/skills/video/${generationId}`;
            mode = "live";
            generationMetadata = {
              model: "sora-2",
              generation_id: generationId,
              poll_status: result.status,
            };
          } else if (result.status === "timeout") {
            // Generation started but hasn't finished — return generation_id for client to poll
            mode = "live";
            generationMetadata = {
              model: "sora-2",
              generation_id: generationId,
              poll_status: "timeout",
              note: result.error_msg,
            };
          } else {
            // Failed — fall back to simulation with error info
            mode = "simulation";
            generationMetadata = {
              note: `Sora generation failed: ${result.error_msg}`,
              generation_id: generationId,
              sora_error: result.error_msg,
              raw: result.raw,
            };
          }
        }
      } catch (soraError: any) {
        // API key exists but Sora call failed (no access, quota, etc.) — fall to simulation
        const errMsg = soraError.message || String(soraError);
        console.warn(`[SkillInvoke] Sora API failed, falling back to simulation: ${errMsg}`);
        mode = "simulation";
        generationMetadata = {
          note: `Sora API unavailable — ${errMsg}`,
          fallback: true,
        };
      }
    } else {
      // No API key
      mode = "simulation";
      generationMetadata = {
        note: "Simulation mode — set OPENAI_API_KEY with Sora access for live generation",
      };
    }

    const completedAt = new Date().toISOString();

    // Build invocation receipt
    const receipt = {
      receipt_id: `rcpt_skill_${invocationId}`,
      receipt_type: "skill.invoked",
      tenant_id,
      timestamp: completedAt,
      payload: {
        invocation_id: invocationId,
        skill_id,
        skill_name: skill.name,
        skill_badge: skill.badge,
        skill_composite: skill.composite,
        provenance: skill.provenance,
        prompt: prompt.substring(0, 200),
        duration,
        aspect_ratio,
        style,
        creative_pack: creative_pack || null,
        experience_id: experience_id || null,
        mode,
        video_url: videoUrl || null,
        generation_id: generationId,
        started_at: startedAt,
        completed_at: completedAt,
        trust_override: trustOverride,
      },
    };

    console.log(`[SkillInvoke] ${skill.name} invoked (${mode}) — ${invocationId}${generationId ? ` [sora:${generationId}]` : ""}`);

    return NextResponse.json({
      ok: true,
      invocation_id: invocationId,
      skill_id,
      skill_name: skill.name,
      skill_badge: skill.badge,
      skill_composite: skill.composite,
      mode,
      video_url: videoUrl || null,
      generation_id: generationId,
      prompt,
      duration,
      aspect_ratio,
      style,
      creative_pack: creative_pack || null,
      experience_id: experience_id || null,
      started_at: startedAt,
      completed_at: completedAt,
      receipt,
      generation_metadata: generationMetadata,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SkillInvoke] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
