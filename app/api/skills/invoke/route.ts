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
  venice_video_gen: { name: "Venice Video Gen", provenance: "first_party_curated", composite: 82, badge: "A", hydrate: true },
};

// OpenAI Videos API (REST — SDK v4.x doesn't include this resource yet)
const OPENAI_VIDEOS_URL = "https://api.openai.com/v1/videos";

// Venice Video API
const VENICE_VIDEO_BASE = "https://api.venice.ai/api/v1/video";
const VENICE_DEFAULT_MODEL = process.env.VENICE_VIDEO_MODEL || "wan-2.5-preview-text-to-video";
const VENICE_MODELS_URL = "https://api.venice.ai/api/v1/models?type=video";
const VENICE_QUOTE_URL = "https://api.venice.ai/api/v1/video/quote";

const VENICE_PREFERRED_TEXT_TO_VIDEO_MODELS = [
  process.env.VENICE_VIDEO_MODEL,
  "wan-2.5-preview-text-to-video",
  "wan-2.2-a14b-text-to-video",
  "wan-2.6-text-to-video",
  "kling-2.6-pro-text-to-video",
  "kling-2.5-turbo-pro-text-to-video",
  "ltx-2-19b-full-text-to-video",
  "longcat-distilled-text-to-video",
  "longcat-text-to-video",
  "veo3.1-fast-text-to-video",
  "veo3-full-text-to-video",
].filter((value): value is string => Boolean(value));

// Which skill IDs route to Venice vs OpenAI
const VENICE_SKILL_IDS = new Set(["venice_video_gen"]);

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  const res = await fetch(OPENAI_VIDEOS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errType = data?.error?.type ? ` [${data.error.type}]` : "";
    const msg = data?.error?.message || `Sora API ${res.status}: ${res.statusText}`;
    throw new Error(`(${res.status}${errType}) ${msg}`);
  }

  return data;
}

/**
 * Queue a Venice video generation job.
 * POST /api/v1/video/queue — returns { model, queue_id }
 */
async function createVeniceJob(
  apiKey: string,
  prompt: string,
  seconds: number,
  aspectRatio: string,
  model?: string,
): Promise<{ queue_id: string; model: string }> {
  const dur = seconds <= 5 ? "5s" : "10s"; // Venice supports 5s or 10s
  const candidateModels = await resolveVeniceVideoModels(apiKey, model);
  const errors: string[] = [];

  for (const veniceModel of candidateModels) {
    const quote = await quoteVeniceVideo(apiKey, veniceModel, dur, aspectRatio);
    if (!quote.ok) {
      errors.push(`${veniceModel}: ${quote.error}`);
      continue;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(`${VENICE_VIDEO_BASE}/queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: veniceModel,
        prompt,
        duration: dur,
        aspect_ratio: aspectRatio,
        resolution: "720p",
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const rawText = await res.text().catch(() => "");
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText || null;
    }

    if (!res.ok) {
      const msg =
        (typeof data?.error?.message === "string" && data.error.message) ||
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.error === "string" && data.error) ||
        (typeof data === "string" && data) ||
        `Venice API ${res.status}: ${res.statusText}`;
      errors.push(`${veniceModel}: (${res.status}) ${msg}`);
      continue;
    }

    if (!data?.queue_id) {
      errors.push(`${veniceModel}: Venice API returned no queue_id`);
      continue;
    }

    return { queue_id: data.queue_id, model: data.model || veniceModel };
  }

  throw new Error(errors.length > 0 ? errors.slice(0, 3).join(" | ") : "No compatible Venice text-to-video model accepted this request");
}

async function resolveVeniceVideoModels(apiKey: string, requestedModel?: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(VENICE_MODELS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return [requestedModel || VENICE_DEFAULT_MODEL];
    }

    const data = await res.json().catch(() => null);
    const availableIds = Array.isArray(data?.data)
      ? data.data
          .map((entry: any) => (typeof entry?.id === "string" ? entry.id : null))
          .filter((id: string | null): id is string => Boolean(id))
      : [];

    if (availableIds.length === 0) {
      return [requestedModel || VENICE_DEFAULT_MODEL];
    }

    const candidateIds = requestedModel
      ? [requestedModel, ...VENICE_PREFERRED_TEXT_TO_VIDEO_MODELS]
      : VENICE_PREFERRED_TEXT_TO_VIDEO_MODELS;
    const ordered: string[] = [];

    for (const candidate of candidateIds) {
      if (availableIds.includes(candidate) && !ordered.includes(candidate)) {
        ordered.push(candidate);
      }
    }

    for (const id of availableIds) {
      if (id.includes("-text-to-video") && !ordered.includes(id)) {
        ordered.push(id);
      }
    }

    if (ordered.length === 0) {
      ordered.push(requestedModel || VENICE_DEFAULT_MODEL);
    }

    return ordered;
  } finally {
    clearTimeout(timeout);
  }
}

async function quoteVeniceVideo(
  apiKey: string,
  model: string,
  duration: "5s" | "10s",
  aspectRatio: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(VENICE_QUOTE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        duration,
        aspect_ratio: aspectRatio,
        resolution: "720p",
      }),
      signal: controller.signal,
    });
    const rawText = await res.text().catch(() => "");
    if (res.ok) {
      return { ok: true };
    }
    return { ok: false, error: rawText || `quote ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
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

    const isVenice = VENICE_SKILL_IDS.has(skill_id);
    const apiKey = isVenice ? process.env.VENICE_API_KEY : process.env.OPENAI_API_KEY;
    let videoUrl: string | null = null;
    let mode: "live" | "simulation" = "simulation";
    let generationMetadata: Record<string, unknown> = {};
    let generationId: string | null = null;
    let provider: "venice" | "openai" = isVenice ? "venice" : "openai";
    let veniceModel: string | null = null;

    if (apiKey && (isVenice || apiKey.startsWith("sk-"))) {
      try {
        if (isVenice) {
          // Venice path
          const vJob = await createVeniceJob(apiKey, prompt, duration, aspect_ratio, body.venice_model);
          generationId = vJob.queue_id;
          veniceModel = vJob.model;
          mode = "live";
          generationMetadata = { provider: "venice", model: veniceModel, queue_id: generationId };
        } else {
        console.log(`[SkillInvoke] Attempting live Sora generation for: "${prompt.substring(0, 60)}..."`);
        const job = await createSoraJob(apiKey, prompt, duration, aspect_ratio);
        generationId = job.id || null;
        console.log(`[SkillInvoke] Sora job created: ${generationId}, status: ${job.status}`);

        if (job.status === "completed") {
          // Immediate completion (rare) — serve via proxy
          videoUrl = `/api/skills/video/${generationId}`;
          mode = "live";
          generationMetadata = {
            provider: "openai",
            model: "sora-2",
            generation_id: generationId,
            completed_immediately: true,
          };
        } else {
          // Job accepted (queued / in_progress) — return immediately.
          // Do NOT poll inline: Amplify Lambda timeout (~30s) is too short
          // for Sora generation (1-3 min). Client shows "in progress" UI
          // and user can re-check via the video proxy endpoint.
          mode = "live";
          generationMetadata = {
            provider: "openai",
            model: "sora-2",
            generation_id: generationId,
            job_status: job.status,
            note: "Generation submitted. Video will be available at /api/skills/video/<id> once complete.",
          };
        }
        } // end Sora else
      } catch (soraError: any) {
        // API key exists but Sora call failed (no access, quota, etc.) — fall to simulation
        const errMsg = soraError.message || String(soraError);
        const label = isVenice ? "Venice" : "Sora";
        console.warn(`[SkillInvoke] ${label} API failed, falling back to simulation: ${errMsg}`);
        mode = "simulation";
        generationMetadata = {
          note: `${label} API unavailable — ${errMsg}`,
          fallback: true,
        };
      }
    } else {
      // No API key
      mode = "simulation";
      generationMetadata = {
        note: isVenice
          ? "Simulation mode — set VENICE_API_KEY for live Venice video generation"
          : "Simulation mode — set OPENAI_API_KEY with Sora access for live generation",
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

    console.log(`[SkillInvoke] ${skill.name} invoked (${mode}/${provider}) — ${invocationId}${generationId ? ` [${provider}:${generationId}]` : ""}`);

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
      provider,
      venice_model: veniceModel || undefined,
      generation_metadata: generationMetadata,
      fallback_reason: mode === "simulation" && generationMetadata?.note ? String(generationMetadata.note) : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SkillInvoke] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
