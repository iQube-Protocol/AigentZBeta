/**
 * fsPlaceholderVideo — the ONE verified, already-published Studio video
 * reused as a temporary placeholder across every Financial Sovereignty
 * lesson video slot (CFS critical layout correction, 2026-09-03, positive
 * invariant P7: "a verified, approved Studio video as a clearly labelled
 * temporary placeholder where the final video is unavailable").
 *
 * This is the SAME asset already published and verified for exactly this
 * purpose on the `moneypenny-financial-basics` (C-15) editorial section —
 * confirmed live via `GET /api/journey/knyts-bridge/editorial-config?section=
 * moneypenny-financial-basics` on 2026-09-03: an existing metaMe Studio
 * (OpenAI/Sora-generated) cinematic clip depicting the Polity Passport,
 * already reused there as "a working placeholder for layout/upload/
 * placement/publication/playback verification, not as MoneyPenny-specific
 * instruction" (see that section's own shortCopy for full provenance).
 * Reusing the identical, already-verified URL here — never a new/guessed
 * one — extends that same precedent to the FS lesson sections.
 *
 * Every FS stage's own `videoUrl` (via `fsBridgeSectionKey`,
 * knyts_bridge_editorial_config) still takes precedence when an admin sets
 * one through native Admin -> Bridges — this constant is ONLY the fallback
 * used while that field is empty, never a value written back into it.
 */

export const FS_PLACEHOLDER_VIDEO_URL =
  'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-assets/generated/openai/videos/video_6a3ed21fd6108191b432206323a3b7e8050676f82e5688ca.mp4';

/** No dedicated poster exists for this clip (same as its C-15 usage, which
 *  also carries posterUrl: null) — the <video> element's own first frame
 *  stands in, exactly as it already does on moneypenny-financial-basics. */
export const FS_PLACEHOLDER_VIDEO_POSTER_URL: string | null = null;

export const FS_PLACEHOLDER_VIDEO_LABEL = 'Placeholder video — financial-services lesson in production.';
