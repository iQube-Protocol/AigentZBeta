/**
 * API Route: Get Content by Section
 * GET /api/content/section/[section]
 * 
 * Returns live content from the database for any section
 * Supports optional tab query parameter for tabbed sections
 */

import { NextRequest, NextResponse } from 'next/server';
import fallbackContent from '@/qriptopian-content-export.json';
import { isPremiumContent } from '@/app/triad/components/codex/utils/contentFlags';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

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

// Map legacy section names to smart_content target_section values published via CartridgePublishPanel
const SMART_SECTION_MAP: Record<string, string[]> = {
  'home-hero':   ['features', 'home-hero'],
  'latest-news': ['features', 'latest-news'],
  'second-hero': ['features', 'second-hero'],
  'pennydrops':  ['pennydrops'],
  'scrolls':     ['scrolls'],
  '21knowdz':    ['kn0wdz', '21knowdz'],
  'staybull':    ['rewards', 'staybull'],
};

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

type FallbackItem = {
  id: string;
  title: string;
  excerpt?: string;
  slug?: string;
  status?: string;
  tags?: string[];
  thumbnail?: string;
  cover_image_url?: string;
  cover_image_uri?: string;
  image?: string;
  placement?: Record<string, any>;
  modalities?: Record<string, any>;
  published_at?: string;
  created_at?: string;
  issue_ref?: string;
  is_premium?: boolean;
  isPremium?: boolean;
  premium?: boolean;
};

function filterFallbackContent(
  section: string,
  tab: string | null,
  issue: string,
  issueNumber: number,
  includeArchived: boolean
) {
  const data = Array.isArray(fallbackContent) ? (fallbackContent as FallbackItem[]) : [];
  if (data.length === 0) return [];
  const issueRefCandidates = [String(issueNumber), `#${issueNumber}`, issue];
  return data.filter((item) => {
    const placement = item.placement || {};
    if (placement.section !== section) return false;
    if (tab && placement.tab && placement.tab !== tab) return false;
    if (item.issue_ref && !issueRefCandidates.includes(item.issue_ref)) return false;
    if (!includeArchived && item.status === 'archived') return false;
    return true;
  });
}

function resolveBadge(section: string, placementTab?: string): string {
  if (section === 'pennydrops') return 'Q¢';
  if (placementTab === 'metaknyts') return 'METAKNYTS';
  if (placementTab === 'synthsims') return 'SYNTHSIMS';
  if (placementTab === 'dev' || placementTab === 'developer') return 'DEV';
  if (placementTab === 'creative') return 'CREATIVE';
  if (placementTab === 'exec' || placementTab === 'executive') return 'EXEC';
  if (section === 'latest-news') return 'NEWS';
  if (section === 'home-hero' || section === 'second-hero') return 'HERO';
  return 'ARTICLE';
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function normalizePricing(item: any) {
  const marketData = item.market_data || item.marketData || {};
  const pricingModel = item.pricing_model || item.pricingModel || marketData.pricing_model || marketData.pricingModel || {};
  const metadata = item.metadata || {};
  const metadataPricing = metadata.pricing || {};
  const paymentMetadata = item.payment_metadata || item.paymentMetadata || metadata.payment || {};

  const tierAmount = Array.isArray(pricingModel?.tiers)
    ? pricingModel.tiers.find((tier: any) => toPositiveNumber(tier?.amount) !== null)?.amount
    : undefined;
  const amount =
    toPositiveNumber(item.price_amount) ??
    toPositiveNumber(item.price?.amount) ??
    toPositiveNumber(metadataPricing.amount) ??
    toPositiveNumber(metadataPricing.priceAmount) ??
    toPositiveNumber(paymentMetadata.priceAmount) ??
    toPositiveNumber(tierAmount) ??
    null;

  const price = amount !== null
    ? {
        amount,
        currency: 'Q¢',
        paymentType: metadataPricing.paymentType || paymentMetadata.paymentType || 'one-time',
      }
    : undefined;

  return {
    pricingModel,
    metadata,
    paymentMetadata,
    price,
    accessPolicy: item.access_policy || item.accessPolicy || metadata.accessPolicy || null,
  };
}

function mapSectionItem(item: any, section: string) {
  const placement = item.placement || {};
  const modalities = item.modalities || {};
  const badge = resolveBadge(section, placement.tab);
  const pricing = normalizePricing(item);

  const isPremium = isPremiumContent({
    id: item.id,
    pricingModel: pricing.pricingModel,
    metadata: pricing.metadata,
    paymentMetadata: pricing.paymentMetadata,
    price: pricing.price,
    accessPolicy: pricing.accessPolicy,
    requiresMembership: Boolean(item.requires_membership || item.requiresMembership),
  });

  return {
    id: item.id,
    content_id: item.id,
    slug: item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: item.title,
    subtitle: item.excerpt,
    excerpt: item.excerpt,
    status: item.status || 'published',
    tags: item.tags || [],
    badge,
    isPremium,
    price: pricing.price,
    pricingModel: pricing.pricingModel,
    paymentMetadata: pricing.paymentMetadata,
    accessPolicy: pricing.accessPolicy,
    metadata: pricing.metadata,
    image: item.thumbnail || item.cover_image_url || item.cover_image_uri || item.image,
    imageScale: placement.imageScale || 100,
    imageX: placement.imageX || 50,
    imageY: placement.imageY || 50,
    position: placement.position || 1,
    modalities: {
      read: modalities.read
        ? {
            available: true,
            text: modalities.read.text,
            duration: modalities.read.duration || '5 min read',
          }
        : undefined,
      watch: modalities.watch
        ? {
            available: true,
            video_url: modalities.watch.video_url,
            duration: modalities.watch.duration,
            type: 'hosted',
            loop: modalities.watch.loop ?? modalities.watch.loop_video ?? false,
          }
        : undefined,
      listen: modalities.listen
        ? {
            available: true,
            audio_url: modalities.listen.audio_url,
            duration: modalities.listen.duration,
          }
        : undefined,
      link: modalities.link
        ? {
            available: true,
            url: modalities.link.url,
            allow_embed: modalities.link.allow_embed,
          }
        : undefined,
    },
    contentBlocks: [],
    created_at: item.created_at,
    published_at: item.published_at,
  };
}

async function fetchSmartContentForSection(
  supabase: ReturnType<typeof getSupabaseServer>,
  section: string,
): Promise<any[]> {
  if (!supabase) return [];
  const smartSections = SMART_SECTION_MAP[section];
  if (!smartSections?.length) return [];

  try {
    const { data, error } = await supabase
      .from('smart_content_qubes')
      .select('id,title,slug,description,cover_image_uri,status,created_at,updated_at,structure_data,layout_hints')
      .eq('tenant_id', 'qriptopian')
      .eq('status', 'published')
      .in('layout_hints->>section', smartSections)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      excerpt: row.description || '',
      slug: row.slug,
      status: 'published',
      tags: [],
      thumbnail: row.cover_image_uri || '',
      cover_image_url: row.cover_image_uri || '',
      cover_image_uri: row.cover_image_uri || '',
      placement: { section },
      modalities: { read: { text: row.structure_data?.body, duration: '5 min read' } },
      published_at: row.updated_at || row.created_at,
      created_at: row.created_at,
      _source: 'smart_content',
    }));
  } catch {
    return [];
  }
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
    const scope = searchParams.get('scope');
    const includeArchived = scope === 'codex' || searchParams.get('includeArchived') === 'true';
    const statusFilter = includeArchived ? ['published', 'archived'] : ['published'];

    const supabase = getSupabaseServer();
    const hasSupabase = Boolean(supabase);
    
    // Validate section
    if (!VALID_SECTIONS.includes(section)) {
      return NextResponse.json({ 
        error: `Invalid section: ${section}. Valid sections: ${VALID_SECTIONS.join(', ')}`
      }, { status: 400,  });
    }

    if (!hasSupabase) {
      const fallback = filterFallbackContent(section, tab, issue, issueNumber, includeArchived);
      const fallbackContent = fallback.length > 0 ? fallback : [];
      const transformedContent = fallbackContent.map((item: any) => mapSectionItem(item, section));

      return NextResponse.json({
        content: transformedContent,
        count: transformedContent.length,
        section,
        tab: tab || null,
        issue,
        source: fallback.length > 0 ? 'fallback' : 'unconfigured',
        timestamp: new Date().toISOString(),
        warning: fallback.length > 0 ? 'Supabase not configured; using fallback content' : 'Supabase not configured',
      });
    }

    console.log(`[Content/${section}] Fetching content from database${tab ? ` (tab: ${tab})` : ''} (issue: ${issue}, scope: ${includeArchived ? 'codex' : 'live'})`);
    
    const basePlacement: Record<string, any> = { section };
    if (tab) basePlacement.tab = tab;

    // Prefer issue-scoped content, but remain backward compatible:
    // if the DB doesn't have issue placement yet, fall back to unscoped.
    const issuePlacement = { ...basePlacement, issue };

    const runQuery = async (placement: Record<string, any>) => {
      return supabase!
        .from('content')
        .select('*')
        .contains('placement', placement)
        .in('status', statusFilter)
        .order('created_at', { ascending: false })
        .limit(50);
    };

    const runQueryByIssueRef = async (placement: Record<string, any>) => {
      const issueRefCandidates = [
        String(issueNumber),
        `#${issueNumber}`,
        issue,
      ];

      return supabase!
        .from('content')
        .select('*')
        .contains('placement', placement)
        .in('issue_ref', issueRefCandidates)
        .in('status', statusFilter)
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
      const fallback = filterFallbackContent(section, tab, issue, issueNumber, includeArchived);
      const transformedFallback = fallback.map((item: any) => mapSectionItem(item, section));

      return NextResponse.json({
        content: transformedFallback,
        count: transformedFallback.length,
        section,
        tab: tab || null,
        issue,
        source: fallback.length > 0 ? 'fallback' : 'error',
        timestamp: new Date().toISOString(),
        warning: error.message || 'Failed to fetch content',
      });
    }

    console.log(`[Content/${section}] Found ${content?.length || 0} items`);

    // Sort by position if available
    const sortedContent = (content || []).sort((a: any, b: any) => {
      const posA = a.placement?.position || 999;
      const posB = b.placement?.position || 999;
      return posA - posB;
    });

    if (!content || content.length === 0) {
      const fallback = filterFallbackContent(section, tab, issue, issueNumber, includeArchived);
      if (fallback.length > 0) {
        const transformedFallback = fallback.map((item: any) => mapSectionItem(item, section));

        return NextResponse.json({
          content: transformedFallback,
          count: transformedFallback.length,
          section,
          tab: tab || null,
          issue,
          source: 'fallback',
          timestamp: new Date().toISOString(),
          warning: 'No database content found; using fallback content',
        });
      }
    }

    // Fetch smart_content articles published via CartridgePublishPanel and merge
    const smartItems = await fetchSmartContentForSection(supabase, section);
    const legacyIds = new Set((sortedContent || []).map((c: any) => c.id));
    const dedupedSmartItems = smartItems.filter(s => !legacyIds.has(s.id));

    const allContent = [...(sortedContent || []), ...dedupedSmartItems];

    // Transform to match Liquid UI format expected by frontend
    const transformedContent = allContent.map((item: any) => mapSectionItem(item, section));

    return NextResponse.json({
      content: transformedContent,
      count: transformedContent.length,
      section,
      tab: tab || null,
      issue,
      source: dedupedSmartItems.length > 0 ? 'database+smart_content' : 'database',
      timestamp: new Date().toISOString(),
      debug: {
        query_section: section,
        query_tab: tab,
        query_issue: issue,
        total_found: content?.length || 0,
        smart_content_found: dedupedSmartItems.length,
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
