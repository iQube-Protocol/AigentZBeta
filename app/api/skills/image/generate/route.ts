import { NextRequest, NextResponse } from "next/server";
import { StorageAdapterFactory } from "@/services/content/storageAdapter";

export const runtime = "nodejs";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const VENICE_IMAGES_URL = "https://api.venice.ai/api/v1/image/generate";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const VENICE_IMAGE_MODEL = process.env.VENICE_IMAGE_MODEL || "venice-sd35";
const VENICE_IMAGE_MODEL_FALLBACKS = [
  process.env.VENICE_IMAGE_MODEL,
  "venice-sd35",
  "hidream",
  "flux-2-pro",
].filter((value): value is string => Boolean(value));
const GENERATED_MEDIA_BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  "content-assets",
  "assets",
  "codex-lite",
].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

type ProviderId = "openai" | "venice";
type Orientation = "portrait" | "landscape";

function resolveImageSize(orientation: Orientation) {
  return orientation === "portrait" ? "1024x1280" : "1280x1024";
}

function resolveVeniceDimensions(orientation: Orientation) {
  return orientation === "portrait"
    ? { width: 1024, height: 1280 }
    : { width: 1280, height: 1024 };
}

function dataUrlToBuffer(value: string) {
  const match = value.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  const [, contentType, base64] = match;
  const binary = Buffer.from(base64, "base64");
  return {
    contentType,
    data: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength),
  };
}

function arrayBufferToDataUrl(data: ArrayBuffer, contentType: string) {
  const base64 = Buffer.from(data).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

async function persistGeneratedAsset(options: {
  providerId: ProviderId;
  orientation: Orientation;
  experienceId?: string | null;
  model: string;
  contentType: string;
  data: ArrayBuffer;
}) {
  const adapter = StorageAdapterFactory.getAdapter("supabase");
  const safeModel = options.model.replace(/[^a-zA-Z0-9._-]/g, "_");
  const extension = options.contentType.includes("jpeg")
    ? "jpg"
    : options.contentType.includes("webp")
    ? "webp"
    : "png";
  const path = `generated/${options.providerId}/images/${options.experienceId || "studio"}/${options.orientation}-${Date.now()}-${safeModel}.${extension}`;
  const errors: string[] = [];

  for (const bucket of GENERATED_MEDIA_BUCKET_CANDIDATES) {
    try {
      const uploaded = await adapter.upload(bucket, path, options.data, {
        contentType: options.contentType,
        upsert: true,
        cacheControl: "31536000",
      });

      return uploaded.publicUrl || adapter.getPublicUrl(bucket, path);
    } catch (error) {
      errors.push(`${bucket}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(errors.join(" | "));
}

async function normalizeImageAssetUrl(
  providerId: ProviderId,
  experienceId: string | null | undefined,
  orientation: Orientation,
  model: string,
  value: string,
) {
  if (value.startsWith("data:")) {
    const parsed = dataUrlToBuffer(value);
    if (!parsed) return value;
    try {
      return await persistGeneratedAsset({
        providerId,
        orientation,
        experienceId,
        model,
        contentType: parsed.contentType,
        data: parsed.data,
      });
    } catch {
      return value;
    }
  }

  if (/^https?:\/\//i.test(value)) {
    const remote = await fetch(value, { cache: "no-store" });
    if (!remote.ok) {
      throw new Error(`Failed to fetch generated image asset (${remote.status})`);
    }
    const contentType = remote.headers.get("content-type") || "image/png";
    const data = await remote.arrayBuffer();
    try {
      return await persistGeneratedAsset({
        providerId,
        orientation,
        experienceId,
        model,
        contentType,
        data,
      });
    } catch {
      return value;
    }
  }

  return value;
}

function extractImageUrlFromJson(data: any): string | null {
  const candidates = [
    data?.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null,
    data?.data?.[0]?.url,
    data?.data?.[0]?.image_url,
    data?.data?.[0]?.base64 ? `data:image/png;base64,${data.data[0].base64}` : null,
    data?.images?.[0]?.url,
    data?.images?.[0]?.image_url,
    data?.images?.[0]?.base64 ? `data:image/png;base64,${data.images[0].base64}` : null,
    typeof data?.images?.[0] === "string" ? `data:image/png;base64,${data.images[0]}` : null,
    typeof data?.image === "string" ? data.image : null,
    typeof data?.image_url === "string" ? data.image_url : null,
    typeof data?.url === "string" ? data.url : null,
    typeof data?.output?.url === "string" ? data.output.url : null,
  ];

  return candidates.find((value): value is string => typeof value === "string" && value.length > 0) || null;
}

async function requestImageGeneration(
  providerId: ProviderId,
  prompt: string,
  orientation: Orientation,
  experienceId?: string | null,
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
    const veniceDims = resolveVeniceDimensions(orientation);
    const modelsToTry = providerId === "venice" ? VENICE_IMAGE_MODEL_FALLBACKS : [model];
    const errors: string[] = [];

    for (const candidateModel of modelsToTry) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          providerId === "venice"
            ? {
                model: candidateModel,
                prompt,
                width: veniceDims.width,
                height: veniceDims.height,
                format: "png",
                return_binary: false,
                safe_mode: false,
              }
            : {
                model: candidateModel,
                prompt,
                size: resolveImageSize(orientation),
                n: 1,
                response_format: "b64_json",
              }
        ),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") || "";
      if (res.ok && (contentType.startsWith("image/") || contentType.startsWith("application/octet-stream"))) {
        const buffer = await res.arrayBuffer();
        const normalizedContentType = contentType.startsWith("image/") ? contentType : "image/png";
        let imageUrl: string;
        try {
          imageUrl = await persistGeneratedAsset({
            providerId,
            orientation,
            experienceId,
            model: candidateModel,
            contentType: normalizedContentType,
            data: buffer,
          });
        } catch {
          imageUrl = arrayBufferToDataUrl(buffer, normalizedContentType);
        }
        return {
          ok: true as const,
          mode: "live" as const,
          image_url: imageUrl,
          model: candidateModel,
        };
      }

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
        errors.push(`${candidateModel}: ${msg}`);
        continue;
      }

      const url = extractImageUrlFromJson(data);
      if (!url) {
        errors.push(`${candidateModel}: ${providerId} image API returned no image payload (${contentType || "unknown content type"})`);
        continue;
      }

      return {
        ok: true as const,
        mode: "live" as const,
        image_url: await normalizeImageAssetUrl(providerId, experienceId, orientation, candidateModel, url),
        model: candidateModel,
      };
    }

    return {
      ok: false as const,
      mode: "simulation" as const,
      error: errors.join(" | ") || `${providerId} image generation failed`,
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
        const result = await requestImageGeneration(provider_id, prompt, orientation, experience_id);
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
