/**
 * linkedinProfile — fetch a public LinkedIn profile as text for the Standing
 * Core wizard's fact extractor.
 *
 * Per the LinkedIn integration spec: LinkedIn OAuth (OIDC) only returns
 * identity + headline; experience/education/skills are NOT exposed via standard
 * OAuth. The depth our extractor needs comes from a third-party profile-data
 * provider keyed on the member's PUBLIC profile URL.
 *
 * PROVIDER-AGNOSTIC: the provider is configured via env, not hard-coded — the
 * original choice (Proxycurl/Nubela) shut down in 2026, so this must not be
 * coupled to any single vendor. Set:
 *   LINKEDIN_ENRICH_URL  — endpoint template; use {url} where the encoded
 *                          public profile URL goes (default appends ?url=...).
 *   LINKEDIN_ENRICH_KEY  — bearer token for the provider.
 * Back-compat: if a provider with a Proxycurl-compatible JSON shape is used,
 * PROXYCURL_API_KEY is still honoured as the key.
 *
 * When NOTHING is configured, callers fall back to the manual profile-text
 * paste (always available). Server-only; the key never reaches the browser.
 *
 * NOTE on response shape: the mapper below expects a Proxycurl-compatible JSON
 * body (experiences[]/education[]/skills[]/certifications[]/summary). A provider
 * with a different schema needs `profileToText` adjusted (or a thin proxy that
 * normalises to this shape) — that's the only code that changes per provider.
 */

export type LinkedInFetch =
  | { ok: true; text: string }
  | { ok: false; reason: 'no-provider' | 'bad-url' | 'fetch-failed'; error?: string };

function enrichKey(): string | undefined {
  return process.env.LINKEDIN_ENRICH_KEY || process.env.PROXYCURL_API_KEY || undefined;
}

export function isEnrichConfigured(): boolean {
  return !!enrichKey();
}

function buildEndpoint(publicUrl: string): string {
  const encoded = encodeURIComponent(publicUrl);
  const template = process.env.LINKEDIN_ENRICH_URL;
  if (template) {
    return template.includes('{url}')
      ? template.replace('{url}', encoded)
      : `${template}${template.includes('?') ? '&' : '?'}url=${encoded}`;
  }
  // Back-compat default (the original Proxycurl v2 endpoint). Only reached when
  // a key is set but no explicit URL — kept so an existing config keeps working
  // if the vendor (or a drop-in successor) is reachable.
  return `https://nubela.co/proxycurl/api/v2/linkedin?url=${encoded}&use_cache=if-present`;
}

function looksLikeLinkedInUrl(url: string): boolean {
  return /linkedin\.com\/(in|pub|profile)\//i.test(url);
}

interface EnrichDate { year?: number; month?: number; day?: number }
interface EnrichExperience { title?: string; company?: string; description?: string; starts_at?: EnrichDate; ends_at?: EnrichDate | null }
interface EnrichEducation { degree_name?: string; field_of_study?: string; school?: string }
interface EnrichCertification { name?: string; authority?: string }
interface EnrichProfile {
  summary?: string;
  headline?: string;
  occupation?: string;
  experiences?: EnrichExperience[];
  education?: EnrichEducation[];
  skills?: string[];
  certifications?: EnrichCertification[];
}

/** Concatenate an enriched profile into the text our VSP extractor consumes. */
function profileToText(p: EnrichProfile): string {
  const yr = (d?: EnrichDate | null) => (d?.year ? String(d.year) : '');
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
  const key = enrichKey();
  if (!key) return { ok: false, reason: 'no-provider' };
  if (!publicUrl || !looksLikeLinkedInUrl(publicUrl)) return { ok: false, reason: 'bad-url' };
  try {
    const res = await fetch(buildEndpoint(publicUrl), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, reason: 'fetch-failed', error: `enrich ${res.status}` };
    const profile = (await res.json()) as EnrichProfile;
    const text = profileToText(profile);
    if (!text.trim()) return { ok: false, reason: 'fetch-failed', error: 'empty profile' };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, reason: 'fetch-failed', error: err instanceof Error ? err.message : String(err) };
  }
}
