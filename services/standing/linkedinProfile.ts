/**
 * linkedinProfile — fetch a person's public professional profile as text for
 * the Standing Core wizard's fact extractor.
 *
 * LinkedIn OAuth (OIDC) only returns identity + headline; experience/education
 * come from a third-party profile-data provider. PROVIDER-AGNOSTIC by env —
 * the original choice (Proxycurl/Nubela) shut down in 2026 after a LinkedIn
 * lawsuit, so this must not be coupled to any single vendor.
 *
 * Supported providers (first configured wins):
 *   1. NinjaPear (the Proxycurl founder's successor; public-sourced, does NOT
 *      scrape LinkedIn). Keyed on WORK EMAIL (best match) or name + company —
 *      NOT a LinkedIn URL. Set:
 *        NINJAPEAR_API_KEY   — bearer token
 *        NINJAPEAR_BASE_URL  — optional, default https://nubela.co
 *   2. Generic URL provider — any endpoint that takes a public profile URL and
 *      returns profile JSON. Set:
 *        LINKEDIN_ENRICH_URL — endpoint template with {url} placeholder
 *        LINKEDIN_ENRICH_KEY — bearer token (PROXYCURL_API_KEY honoured as alias)
 *
 * When nothing is configured, callers fall back to the manual profile-text
 * paste (always available). Server-only; keys never reach the browser.
 *
 * The text mapper is DEFENSIVE: it pulls common fields under several plausible
 * names and, for an unfamiliar shape, flattens the JSON to readable text — the
 * downstream VSP fact-extractor reads free text, so it tolerates any provider.
 */

export interface ProfileQuery {
  url?: string;
  workEmail?: string;
  name?: string;
  company?: string;
}

export type LinkedInFetch =
  | { ok: true; text: string; provider: string }
  | { ok: false; reason: 'no-provider' | 'insufficient-input' | 'fetch-failed'; error?: string };

function ninjapearKey(): string | undefined {
  return process.env.NINJAPEAR_API_KEY || undefined;
}
function genericKey(): string | undefined {
  return process.env.LINKEDIN_ENRICH_KEY || process.env.PROXYCURL_API_KEY || undefined;
}

export function isEnrichConfigured(): boolean {
  return !!ninjapearKey() || !!genericKey();
}

function looksLikeLinkedInUrl(url: string): boolean {
  return /linkedin\.com\/(in|pub|profile)\//i.test(url);
}

// ── Defensive profile → text ───────────────────────────────────────────────
type AnyRec = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const firstStr = (o: AnyRec, keys: string[]): string => {
  for (const k of keys) { const v = str(o?.[k]); if (v) return v; }
  return '';
};
const asArray = (o: AnyRec, keys: string[]): AnyRec[] => {
  for (const k of keys) { const v = o?.[k]; if (Array.isArray(v)) return v as AnyRec[]; }
  return [];
};
function yearOf(v: unknown): string {
  if (v && typeof v === 'object' && 'year' in (v as AnyRec)) return str((v as AnyRec).year);
  const s = str(v);
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : s;
}

function profileToText(p: AnyRec): string {
  const parts: string[] = [];
  const name = firstStr(p, ['name', 'full_name', 'fullName']) ||
    [firstStr(p, ['first_name', 'firstName', 'given_name']), firstStr(p, ['last_name', 'lastName', 'family_name'])].filter(Boolean).join(' ');
  if (name) parts.push(`Name: ${name}`);
  const headline = firstStr(p, ['headline', 'occupation', 'title', 'job_title', 'jobTitle']);
  if (headline) parts.push(`Headline: ${headline}`);
  const location = firstStr(p, ['location', 'location_name', 'city', 'country', 'country_full_name']);
  if (location) parts.push(`Location: ${location}`);
  const summary = firstStr(p, ['summary', 'bio', 'about', 'description']);
  if (summary) parts.push(summary);

  for (const e of asArray(p, ['experiences', 'experience', 'positions', 'work_history', 'jobHistory', 'job_history'])) {
    const head = [firstStr(e, ['title', 'role', 'position']), firstStr(e, ['company', 'company_name', 'organization', 'org'])].filter(Boolean).join(' @ ');
    const start = yearOf(e.starts_at ?? e.start_date ?? e.startDate ?? e.start);
    const endRaw = e.ends_at ?? e.end_date ?? e.endDate ?? e.end;
    const span = head ? `(${start}${start || endRaw ? '–' : ''}${endRaw ? yearOf(endRaw) : 'present'})` : '';
    const line = [head && `${head} ${span}`.trim(), firstStr(e, ['description', 'summary'])].filter(Boolean).join('\n');
    if (line) parts.push(line);
  }
  for (const ed of asArray(p, ['education', 'schools', 'educations'])) {
    const line = ['Education:', firstStr(ed, ['degree_name', 'degree']), firstStr(ed, ['field_of_study', 'field']) && `– ${firstStr(ed, ['field_of_study', 'field'])}`, firstStr(ed, ['school', 'institution', 'name']) && `@ ${firstStr(ed, ['school', 'institution', 'name'])}`].filter(Boolean).join(' ');
    if (line.length > 'Education:'.length) parts.push(line);
  }
  const skills = (p.skills ?? p.skill_list) as unknown;
  if (Array.isArray(skills) && skills.length) parts.push(`Skills: ${skills.map(str).filter(Boolean).join(', ')}`);
  for (const c of asArray(p, ['certifications', 'certs'])) {
    const line = `Certification: ${[firstStr(c, ['name', 'title']), firstStr(c, ['authority', 'issuer', 'organization'])].filter(Boolean).join(' – ')}`;
    if (line.length > 'Certification: '.length) parts.push(line);
  }

  // Unfamiliar shape — flatten readable scalars so the LLM extractor still has
  // something to work with rather than returning empty.
  if (parts.length <= 1) {
    const flat: string[] = [];
    const walk = (obj: unknown, prefix = '') => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj as AnyRec)) {
        if (typeof v === 'string' || typeof v === 'number') flat.push(`${prefix}${k}: ${v}`);
        else if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) flat.push(`${prefix}${k}: ${v.join(', ')}`);
        else if (v && typeof v === 'object' && prefix.length < 24) walk(v, `${prefix}${k}.`);
      }
    };
    walk(p);
    if (flat.length) parts.push(flat.slice(0, 200).join('\n'));
  }

  return parts.filter((s) => s && s.trim()).join('\n\n');
}

// ── Provider calls ──────────────────────────────────────────────────────────
async function callJson(endpoint: string, key: string): Promise<{ ok: true; body: AnyRec } | { ok: false; error: string }> {
  try {
    const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    if (!res.ok) return { ok: false, error: `enrich ${res.status}` };
    const body = (await res.json()) as AnyRec;
    return { ok: true, body };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchViaNinjaPear(key: string, q: ProfileQuery): Promise<LinkedInFetch> {
  const base = (process.env.NINJAPEAR_BASE_URL || 'https://nubela.co').replace(/\/$/, '');
  const params = new URLSearchParams();
  if (q.workEmail) params.set('work_email', q.workEmail.trim());
  else if (q.name && q.company) { params.set('name', q.name.trim()); params.set('company', q.company.trim()); }
  else return { ok: false, reason: 'insufficient-input', error: 'NinjaPear needs a work email (best) or name + company.' };

  const r = await callJson(`${base}/api/v1/employee/profile?${params.toString()}`, key);
  if (!r.ok) return { ok: false, reason: 'fetch-failed', error: r.error };
  const text = profileToText(r.body);
  if (!text.trim()) return { ok: false, reason: 'fetch-failed', error: 'empty profile' };
  return { ok: true, text, provider: 'ninjapear' };
}

async function fetchViaGenericUrl(key: string, url: string): Promise<LinkedInFetch> {
  if (!url || !looksLikeLinkedInUrl(url)) {
    return { ok: false, reason: 'insufficient-input', error: 'Provide a LinkedIn profile URL (e.g. https://www.linkedin.com/in/your-handle).' };
  }
  const template = process.env.LINKEDIN_ENRICH_URL;
  const encoded = encodeURIComponent(url);
  const endpoint = template
    ? (template.includes('{url}') ? template.replace('{url}', encoded) : `${template}${template.includes('?') ? '&' : '?'}url=${encoded}`)
    : `https://nubela.co/proxycurl/api/v2/linkedin?url=${encoded}&use_cache=if-present`; // legacy default
  const r = await callJson(endpoint, key);
  if (!r.ok) return { ok: false, reason: 'fetch-failed', error: r.error };
  const text = profileToText(r.body);
  if (!text.trim()) return { ok: false, reason: 'fetch-failed', error: 'empty profile' };
  return { ok: true, text, provider: 'generic-url' };
}

/**
 * Fetch a profile via the first configured provider. NinjaPear (email/name+
 * company keyed) takes precedence; otherwise a generic URL provider.
 */
export async function fetchProfile(q: ProfileQuery): Promise<LinkedInFetch> {
  const npKey = ninjapearKey();
  if (npKey) return fetchViaNinjaPear(npKey, q);
  const genKey = genericKey();
  if (genKey) return fetchViaGenericUrl(genKey, q.url ?? '');
  return { ok: false, reason: 'no-provider' };
}
