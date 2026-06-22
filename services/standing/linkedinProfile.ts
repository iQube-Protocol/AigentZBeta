/**
 * linkedinProfile — fetch a public LinkedIn profile as text for the Standing
 * Core wizard's fact extractor.
 *
 * Per the LinkedIn integration spec (2026-06-22): LinkedIn OAuth (OIDC) only
 * returns identity + headline; experience/education/skills are NOT exposed via
 * standard OAuth. The documented path to that depth is Proxycurl, keyed on the
 * member's PUBLIC profile URL — which is all we need (no OAuth/access-token
 * plumbing, no cross-project Supabase read).
 *
 * Gated on PROXYCURL_API_KEY. When unset, callers fall back to the manual
 * profile-text paste. Server-only; the key never reaches the browser.
 */

export type LinkedInFetch =
  | { ok: true; text: string }
  | { ok: false; reason: 'no-key' | 'bad-url' | 'fetch-failed'; error?: string };

export function isProxycurlConfigured(): boolean {
  return !!process.env.PROXYCURL_API_KEY;
}

function looksLikeLinkedInUrl(url: string): boolean {
  return /linkedin\.com\/(in|pub|profile)\//i.test(url);
}

interface ProxycurlDate { year?: number; month?: number; day?: number }
interface ProxycurlExperience { title?: string; company?: string; description?: string; starts_at?: ProxycurlDate; ends_at?: ProxycurlDate | null }
interface ProxycurlEducation { degree_name?: string; field_of_study?: string; school?: string }
interface ProxycurlCertification { name?: string; authority?: string }
interface ProxycurlProfile {
  summary?: string;
  headline?: string;
  occupation?: string;
  experiences?: ProxycurlExperience[];
  education?: ProxycurlEducation[];
  skills?: string[];
  certifications?: ProxycurlCertification[];
}

/** Concatenate a Proxycurl profile into the text our VSP extractor consumes. */
function profileToText(p: ProxycurlProfile): string {
  const yr = (d?: ProxycurlDate | null) => (d?.year ? String(d.year) : '');
  const parts: string[] = [];
  if (p.headline || p.occupation) parts.push(`Headline: ${p.headline ?? p.occupation}`);
  if (p.summary) parts.push(p.summary);
  for (const e of p.experiences ?? []) {
    const span = `${yr(e.starts_at)}–${e.ends_at ? yr(e.ends_at) : 'present'}`.replace(/^–/, '');
    const head = [e.title, e.company].filter(Boolean).join(' @ ');
    parts.push([head && `${head} (${span})`, e.description].filter(Boolean).join('\n'));
  }
  for (const ed of p.education ?? []) {
    parts.push(['Education:', ed.degree_name, ed.field_of_study && `– ${ed.field_of_study}`, ed.school && `@ ${ed.school}`].filter(Boolean).join(' '));
  }
  if (p.skills && p.skills.length) parts.push(`Skills: ${p.skills.join(', ')}`);
  for (const c of p.certifications ?? []) {
    parts.push(`Certification: ${[c.name, c.authority].filter(Boolean).join(' – ')}`);
  }
  return parts.filter((s) => s && s.trim()).join('\n\n');
}

export async function fetchLinkedInProfileText(publicUrl: string): Promise<LinkedInFetch> {
  const key = process.env.PROXYCURL_API_KEY;
  if (!key) return { ok: false, reason: 'no-key' };
  if (!publicUrl || !looksLikeLinkedInUrl(publicUrl)) return { ok: false, reason: 'bad-url' };
  try {
    const endpoint = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(publicUrl)}&use_cache=if-present`;
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${key}` },
      // Proxycurl can take a few seconds; the route's maxDuration covers it.
    });
    if (!res.ok) return { ok: false, reason: 'fetch-failed', error: `proxycurl ${res.status}` };
    const profile = (await res.json()) as ProxycurlProfile;
    const text = profileToText(profile);
    if (!text.trim()) return { ok: false, reason: 'fetch-failed', error: 'empty profile' };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, reason: 'fetch-failed', error: err instanceof Error ? err.message : String(err) };
  }
}
