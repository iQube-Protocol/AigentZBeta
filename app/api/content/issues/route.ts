import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

type IssueOption = {
  slug: string;
  label: string;
  count: number;
};

function normalizeIssueValue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 0 || raw > 12) return null;
    return `issue-${raw}`;
  }
  const cleaned = String(raw).trim().toLowerCase();
  const match = cleaned.match(/^issue[-\s#]*?(\d{1,2})$/i) || cleaned.match(/^#?(\d{1,2})$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 0 || n > 12) return null;
  return `issue-${n}`;
}

function issueNumberFromSlug(slug: string): number {
  const match = slug.match(/issue-(\d{1,2})/i);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ issues: [], warning: 'Supabase not configured' });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const includeArchived = scope === 'codex' || searchParams.get('includeArchived') === 'true';
    const statusFilter = includeArchived ? ['published', 'archived'] : ['published'];

    const { data, error } = await supabase
      .from('content')
      .select('issue_ref, placement, status')
      .in('status', statusFilter);

    if (error) {
      return NextResponse.json(
        { issues: [], error: error.message },
        { status: 500 }
      );
    }

    const counts = new Map<string, number>();

    (data || []).forEach((row: any) => {
      const placementIssue = normalizeIssueValue(row?.placement?.issue);
      const issueRef = normalizeIssueValue(row?.issue_ref);
      const rowIssues = new Set<string>();

      if (placementIssue) rowIssues.add(placementIssue);
      if (issueRef) rowIssues.add(issueRef);

      for (const slug of rowIssues) {
        counts.set(slug, (counts.get(slug) || 0) + 1);
      }
    });

    const issues: IssueOption[] = Array.from(counts.entries())
      .map(([slug, count]) => ({
        slug,
        label: `#${issueNumberFromSlug(slug)}`,
        count,
      }))
      .sort((a, b) => issueNumberFromSlug(a.slug) - issueNumberFromSlug(b.slug));

    return NextResponse.json({ issues });
  } catch (error: any) {
    return NextResponse.json(
      { issues: [], error: error?.message || 'Failed to load issues' },
      { status: 500 }
    );
  }
}
