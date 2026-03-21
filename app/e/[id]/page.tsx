import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { composerService } from "@/services/composer/composerService";

interface Props {
  params: Promise<{ id: string }>;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.aigentz.me";

function resolveOgImage(experience: Awaited<ReturnType<typeof composerService.getExperienceQube>>): string | null {
  if (!experience) return null;
  const metadata = experience.metadata as Record<string, unknown>;
  const assets = Array.isArray(metadata?.generated_assets) ? metadata.generated_assets : [];
  // Prefer portrait image, then landscape, then any image asset
  for (const orientation of ["portrait", "landscape", null]) {
    for (const asset of assets) {
      if (!asset || typeof asset !== "object") continue;
      const rec = asset as Record<string, unknown>;
      const type = typeof rec.type === "string" ? rec.type : null;
      const assetUrl = typeof rec.asset_url === "string" ? rec.asset_url :
        typeof rec.assetUrl === "string" ? rec.assetUrl :
        typeof rec.image_url === "string" ? rec.image_url : null;
      if (!assetUrl) continue;
      if (type === "image" || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(assetUrl)) {
        if (orientation === null) return assetUrl;
        const assetOrientation = typeof rec.orientation === "string" ? rec.orientation : null;
        if (assetOrientation === orientation) return assetUrl;
      }
    }
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const experience = await composerService.getExperienceQube(id).catch(() => null);

  if (!experience) {
    return {
      title: "Experience not found",
      description: "This experience could not be found.",
    };
  }

  const title = experience.name || "Untitled Experience";
  const description = experience.description || experience.goal || "An interactive experience on iQube Protocol.";
  const ogImage = resolveOgImage(experience);
  const url = `${APP_URL}/e/${id}`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: "iQube Protocol",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function ExperienceSharePage({ params }: Props) {
  const { id } = await params;
  redirect(`/metame/runtime?experienceId=${encodeURIComponent(id)}&intent=play`);
}
