/**
 * API Route: Get Content by Section
 * GET /api/content/section/[section]
 * 
 * Returns live content from the database for any section
 * Supports optional tab query parameter for tabbed sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPremiumContent } from '@/lib/contentFlags';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Valid sections
const VALID_SECTIONS = [
  'home-hero',
  'latest-news', 
  'second-hero',
  'pennydrops',
  'scrolls',
  '21knowdz',
  'staybull'
];

function normalizeIssueSlug(raw: string | null): string {
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

function issueNumberFromSlug(issueSlug: string): number {
  const match = issueSlug.match(/^issue-(\d{1,2})$/);
  if (!match) return 1;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : 1;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { section: string } }
) {
  try {
    const section = params.section;
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab');
    const issue = normalizeIssueSlug(searchParams.get('issue'));
    const issueNumber = issueNumberFromSlug(issue);
    
    // Validate section
    if (!VALID_SECTIONS.includes(section)) {
      return NextResponse.json({ 
        error: `Invalid section: ${section}. Valid sections: ${VALID_SECTIONS.join(', ')}`
      }, { status: 400,  });
    }

    console.log(`[Content/${section}] Fetching content from database${tab ? ` (tab: ${tab})` : ''} (issue: ${issue})`);
    
    const basePlacement: Record<string, any> = { section };
    if (tab) basePlacement.tab = tab;

    // Prefer issue-scoped content, but remain backward compatible:
    // if the DB doesn't have issue placement yet, fall back to unscoped.
    const issuePlacement = { ...basePlacement, issue };

    const runQuery = async (placement: Record<string, any>) => {
      return supabase
        .from('content')
        .select('*')
        .contains('placement', placement)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50);
    };

    const runQueryByIssueRef = async (placement: Record<string, any>) => {
      const issueRefCandidates = [
        String(issueNumber),
        `#${issueNumber}`,
        issue,
      ];

      return supabase
        .from('content')
        .select('*')
        .contains('placement', placement)
        .in('issue_ref', issueRefCandidates)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50);
    };

    let { data: content, error } = await runQuery(issuePlacement);

    if (!error && (!content || content.length === 0)) {
      const byIssueRefResult = await runQueryByIssueRef(basePlacement);
      content = byIssueRefResult.data;
      error = byIssueRefResult.error;

      if (!error && (!content || content.length === 0)) {
        const fallbackResult = await runQuery(basePlacement);
        content = fallbackResult.data;
        error = fallbackResult.error;
      }
    }

    if (error) {
      console.error(`[Content/${section}] Database error:`, error);
      return NextResponse.json({ 
        error: 'Failed to fetch content',
        details: error.message
      }, { status: 500,  });
    }

    console.log(`[Content/${section}] Found ${content?.length || 0} published items`);

    // Sort by position if available
    const sortedContent = (content || []).sort((a: any, b: any) => {
      const posA = a.placement?.position || 999;
      const posB = b.placement?.position || 999;
      return posA - posB;
    });

    // Transform to match Liquid UI format expected by frontend
    const transformedContent = sortedContent.map((item: any) => {
      const placement = item.placement || {};
      const modalities = item.modalities || {};
      
      // Determine badge based on section/tab
      let badge = 'ARTICLE';
      if (section === 'pennydrops') badge = 'Q¢';
      else if (placement.tab === 'metaknyts') badge = 'METAKNYTS';
      else if (placement.tab === 'synthsims') badge = 'SYNTHSIMS';
      else if (placement.tab === 'dev' || placement.tab === 'developer') badge = 'DEV';
      else if (placement.tab === 'creative') badge = 'CREATIVE';
      else if (placement.tab === 'exec' || placement.tab === 'executive') badge = 'EXEC';
      else if (section === 'latest-news') badge = 'NEWS';
      else if (section === 'home-hero' || section === 'second-hero') badge = 'HERO';
      
      const isPremium = isPremiumContent({
        id: item.id,
        tags: item.tags || [],
        badge,
        isPremium: Boolean(item.is_premium ?? item.isPremium ?? item.premium),
      });

      return {
        id: item.id,
        content_id: item.id,
        slug: item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: item.title,
        subtitle: item.excerpt,
        excerpt: item.excerpt,
        status: item.status,
        tags: item.tags || [],
        badge,
        isPremium,
        // Image from thumbnail or cover field (fallbacks keep legacy content visible)
        image: item.thumbnail || item.cover_image_url || item.cover_image_uri || item.image,
        imageScale: placement.imageScale || 100,
        imageX: placement.imageX || 50,
        imageY: placement.imageY || 50,
        position: placement.position || 1,
        // Pass through modalities from database
        modalities: {
          read: modalities.read ? {
            available: true,
            text: modalities.read.text,
            duration: modalities.read.duration || '5 min read',
          } : undefined,
          watch: modalities.watch ? {
            available: true,
            video_url: modalities.watch.video_url,
            duration: modalities.watch.duration,
            type: 'hosted',
          } : undefined,
          listen: modalities.listen ? {
            available: true,
            audio_url: modalities.listen.audio_url,
            duration: modalities.listen.duration,
          } : undefined,
          link: modalities.link ? {
            available: true,
            url: modalities.link.url,
            allow_embed: modalities.link.allow_embed,
          } : undefined,
        },
        contentBlocks: [],
        created_at: item.created_at,
        published_at: item.published_at
      };
    });

    return NextResponse.json({
      content: transformedContent,
      count: transformedContent.length,
      section,
      tab: tab || null,
      issue,
      source: 'database',
      timestamp: new Date().toISOString(),
      debug: {
        query_section: section,
        query_tab: tab,
        query_issue: issue,
        total_found: content?.length || 0,
        sample_ids: transformedContent.slice(0, 3).map((item: any) => ({ id: item.id, title: item.title.slice(0, 30) }))
      }
    });

  } catch (error) {
    console.error('[Content] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500,  });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
