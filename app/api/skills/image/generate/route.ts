import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const VENICE_IMAGES_URL = "https://api.venice.ai/api/v1/images/generations";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const VENICE_IMAGE_MODEL = process.env.VENICE_IMAGE_MODEL || "fluently-xl";

type ProviderId = "openai" | "venice";
type Orientation = "portrait" | "landscape";

function resolveImageSize(orientation: Orientation) {
  return orientation === "portrait" ? "1024x1536" : "1536x1024";
}

async function requestImageGeneration(
  providerId: ProviderId,
  prompt: string,
  orientation: Orientation,
) {
  const apiKey = providerId === "venice" ? process.env.VENICE_API_KEY : process.env.OPENAI_API_KEY;
  const endpoint = providerId === "venice" ? VENICE_IMAGES_URL : OPENAI_IMAGES_URL;
  const model = providerId === "venice" ? VENICE_IMAGE_MODEL : OPENAI_IMAGE_MODEL;

  if (!apiKey) {
    return {
      ok: false as const,
      mode: "simulation" as const,
      error: `${providerId === "venice" ? "VENICE_API_KEY" : "OPENAI_API_KEY"} not configured`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size: resolveImageSize(orientation),
        n: 1,
        response_format: "b64_json",
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
        `${providerId} image API ${res.status}: ${res.statusText}`;
      return { ok: false as const, mode: "simulation" as const, error: msg };
    }

    const image = Array.isArray(data?.data) ? data.data[0] : null;
    const b64 = typeof image?.b64_json === "string" ? image.b64_json : null;
    const url = typeof image?.url === "string" ? image.url : null;

    if (!b64 && !url) {
      return {
        ok: false as const,
        mode: "simulation" as const,
        error: `${providerId} image API returned no image payload`,
      };
    }

    return {
      ok: true as const,
      mode: "live" as const,
      image_url: b64 ? `data:image/png;base64,${b64}` : url,
      model,
    };
  } catch (error) {
    return {
      ok: false as const,
      mode: "simulation" as const,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      provider_id = "venice",
      portrait_prompt,
      landscape_prompt,
      experience_id,
    } = body as {
      provider_id?: ProviderId;
      portrait_prompt?: string;
      landscape_prompt?: string;
      experience_id?: string;
    };

    const prompts: Array<{ orientation: Orientation; prompt: string }> = [];
    if (typeof portrait_prompt === "string" && portrait_prompt.trim()) {
      prompts.push({ orientation: "portrait", prompt: portrait_prompt.trim() });
    }
    if (typeof landscape_prompt === "string" && landscape_prompt.trim()) {
      prompts.push({ orientation: "landscape", prompt: landscape_prompt.trim() });
    }

    if (prompts.length === 0) {
      return NextResponse.json({ ok: false, error: "At least one image prompt is required." }, { status: 400 });
    }

    const results = await Promise.all(
      prompts.map(async ({ orientation, prompt }) => {
        const result = await requestImageGeneration(provider_id, prompt, orientation);
        return {
          orientation,
          prompt,
          ...result,
        };
      })
    );

    const live = results.filter((item) => item.ok);
    const simulated = results.filter((item) => !item.ok);

    return NextResponse.json({
      ok: live.length > 0,
      provider: provider_id,
      experience_id: experience_id || null,
      mode: simulated.length > 0 && live.length === 0 ? "simulation" : "live",
      images: results,
      fallback_reason:
        simulated.length > 0 && live.length === 0
          ? simulated.map((item) => `${item.orientation}: ${item.error}`).join(" | ")
          : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
