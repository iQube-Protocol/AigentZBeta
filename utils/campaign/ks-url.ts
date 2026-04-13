/**
 * utils/campaign/ks-url.ts
 *
 * Builds tracked Kickstarter URLs for the KNYT Wheel campaign.
 * Each link routes through /api/crm/track/ks which logs the click
 * then redirects to the live Kickstarter campaign page.
 */

/**
 * Returns a server-side tracking URL for a given nakamoto investor ID.
 * The redirect endpoint writes kickstarter_clicked_at and forwards to KS.
 */
export function buildKSTrackingUrl(nakamotoId: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({
    uid: nakamotoId,
    utm_source: 'knyt_wheel',
    utm_medium: 'email',
    utm_campaign: 'knyt_wheel_launch',
    ...extra,
  });
  return `/api/crm/track/ks?${params.toString()}`;
}

/**
 * Returns the canonical Kickstarter destination URL with UTM params for
 * direct use in email templates (bypasses the tracking redirect).
 * Server-side only — reads KICKSTARTER_CAMPAIGN_URL env.
 */
export function buildDirectKSUrl(nakamotoId: string): string {
  const base =
    (typeof process !== 'undefined' && process.env?.KICKSTARTER_CAMPAIGN_URL) ??
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_KS_URL) ??
    '';
  if (!base) return '#ks-url-not-configured';
  const params = new URLSearchParams({
    utm_source: 'knyt_wheel',
    utm_medium: 'email',
    utm_campaign: 'knyt_wheel_launch',
    ref: nakamotoId.slice(0, 8),
  });
  return `${base}?${params.toString()}`;
}
