import { NextRequest, NextResponse } from 'next/server';

type SectionResponse = {
  content?: any[];
};

function getCanonicalIssue(raw: string | null): string {
  if (!raw) return 'issue-1';
  const cleaned = raw.trim();
  const match = cleaned.match(/^issue-(\d{1,2})$/i)
    || cleaned.match(/^#?(\d{1,2})$/)
    || cleaned.match(/^issue\s*#?\s*(\d{1,2})$/i);
  if (!match) return 'issue-1';
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 0 || n > 12) return 'issue-1';
  return `issue-${n}`;
}

async function fetchSection(origin: string, section: string, issue: string) {
  const url = new URL(`/api/content/section/${section}`, origin);
  url.searchParams.set('issue', issue);
  url.searchParams.set('scope', 'codex');
  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text();
      return { content: [], error: `Failed section ${section}: ${res.status} ${text}` } as any;
    }
    return (await res.json()) as SectionResponse;
  } catch (error: any) {
    return { content: [], error: error?.message || `Failed section ${section}` } as any;
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const issue = getCanonicalIssue(url.searchParams.get('issue'));

    const origin = url.origin;

    const [homeHero, latestNews, secondHero, pennydrops, scrolls, knowdz] = await Promise.all([
      fetchSection(origin, 'home-hero', issue),
      fetchSection(origin, 'latest-news', issue),
      fetchSection(origin, 'second-hero', issue),
      fetchSection(origin, 'pennydrops', issue),
      fetchSection(origin, 'scrolls', issue),
      fetchSection(origin, '21knowdz', issue),
    ]);

    const warnings = [homeHero, latestNews, secondHero, pennydrops, scrolls, knowdz]
      .map((section: any) => section?.error)
      .filter(Boolean);

    return NextResponse.json({
      issue,
      sections: {
        homeHero: homeHero.content || [],
        latestNews: latestNews.content || [],
        secondHero: secondHero.content || [],
        pennydrops: pennydrops.content || [],
        scrolls: scrolls.content || [],
        knowdz: knowdz.content || [],
      },
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to build Qriptopian home payload', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
