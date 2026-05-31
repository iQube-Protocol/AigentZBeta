import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { CacheManager, CDNCache, CacheInvalidation } from '../../../utils/cache';
import { withMetrics, BusinessMetrics, HealthMetrics } from '../../../utils/metrics';
import { getStore } from './store';

// Minimal Supabase REST client using fetch so we avoid adding a new dependency.
function buildUrl(base: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, base.endsWith('/') ? base : base + '/');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

const getHandler = async (req: Request) => {
    const fetchMode = req.headers.get('sec-fetch-mode');
    const fetchDest = req.headers.get('sec-fetch-dest');
    const accept = req.headers.get('accept') || '';
    if ((fetchMode === 'navigate' || fetchDest === 'document') && accept.includes('text/html')) {
      const url = new URL(req.url);
      return NextResponse.redirect(new URL('/registry', url));
    }

    // Generate cache key from request parameters
    const url = new URL(req.url);
    // Parse pagination early for fallback responses
    const rawPage = parseInt(url.searchParams.get('page') || '1');
    const rawLimit = parseInt(url.searchParams.get('limit') || '12');
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 12;
    const cacheKey = CacheManager.generateKey(
      'registry:templates',
      Object.fromEntries(url.searchParams)
    );

    // Check for conditional request
    const ifNoneMatch = req.headers.get('if-none-match');

    // Fetch data with caching
    const fetchData = async () => {
      // Check multiple environment variable patterns for Supabase configuration
      const supabaseUrl = process.env.SUPABASE_URL || 
                  process.env.NEXT_PUBLIC_SUPABASE_URL ||
                  'https://bsjhfvctmduxhohtllly.supabase.co'; // Fallback to known URL
      
      const anonKey = process.env.SUPABASE_ANON_KEY || 
                      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                      process.env.SUPABASE_SERVICE_ROLE_KEY ||
                      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M'; // Fallback to known anon key
      
      if (!supabaseUrl || !anonKey) {
        // Enhanced error message with debugging info
        const envInfo = {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: !!process.env.VERCEL,
          NETLIFY: !!process.env.NETLIFY
        };
        
        throw new Error(`Supabase env not configured: ${JSON.stringify(envInfo)}`);
      }

      const search = url.searchParams.get('search') || '';
      const type = url.searchParams.get('type') || '';
      const category = url.searchParams.get('category') || '';
      const instance = url.searchParams.get('instance') || '';
      const businessModel = url.searchParams.get('businessModel') || '';
      const sort = url.searchParams.get('sort'); // newest|oldest
      const forceFallback = url.searchParams.get('forceFallback') === '1';
      
      // Pagination parameters
      const offset = (page - 1) * limit;

      // Base select with pagination
      const qp: Record<string, string> = {
        select: '*',
        order: `created_at.${sort === 'oldest' ? 'asc' : 'desc'}`,
        limit: limit.toString(),
        offset: offset.toString(),
      };

      // Filters using correct PostgREST syntax: column=operator.value
      // name ilike with wildcards must be provided as: name=ilike.*term*
      if (search) qp['name'] = `ilike.*${search}*`;
      if (type) qp['iqube_type'] = `eq.${type}`;
      if (instance) qp['instance_type'] = `eq.${instance}`;
      if (businessModel) qp['business_model'] = `eq.${businessModel}`;

      let rows: any[] = [];
      let totalCount = 0;
      if (!forceFallback) {
        const endpoint = buildUrl(supabaseUrl, 'rest/v1/iqube_templates', qp);
        const res = await fetch(endpoint, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: 'application/json',
            // Add Prefer header for count
            Prefer: 'count=exact',
          },
          cache: 'no-store',
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Supabase error: ${res.status} ${text}`);
        }
        // Get total count from response headers
        totalCount = parseInt(res.headers.get('content-range')?.split('/')[1] || '0');
        rows = await res.json();
      }

      // Map DB rows to frontend IQubeTemplate shape
      const mapped = (rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        iQubeType: r.iqube_type || undefined,
        iQubeInstanceType: r.instance_type || undefined,
        businessModel: r.business_model || undefined,
        version: r.version || '1.0',
        provenance: typeof r.provenance === 'number' ? r.provenance : 0,
        sensitivityScore: r.sensitivity_score ?? r.sensitivityScore ?? 0,
        accuracyScore: r.accuracy_score ?? r.accuracyScore ?? 0,
        verifiabilityScore: r.verifiability_score ?? r.verifiabilityScore ?? 0,
        riskScore: r.risk_score ?? r.riskScore ?? 0,
        price: typeof r.price === 'number' ? r.price : (r.price_usd ?? null),
        blakqubeLabels: r.blakqube_labels || r.blakqubeLabels || [],
        metaExtras: r.metaqube_extras || null,
        visibility: r.visibility || 'public',
        userId: r.user_id || null,
        createdAt: r.created_at,
      }));

      // If Supabase returns empty but local store has seed templates, fall back
      if (mapped.length === 0) {
        const items = getStore();
        const fallbackFiltered = items
          .filter(t => {
            if (search) {
              const s = search.toLowerCase();
              if (!t.name.toLowerCase().includes(s) && !t.description.toLowerCase().includes(s)) return false;
            }
            if (type && t.iQubeType && t.iQubeType !== type) return false;
            if (category && !((t as any).metaExtras || []).some((x: { k: string; v: string }) => x?.k === 'category' && x?.v === category)) return false;
            if (instance && t.iQubeInstanceType && t.iQubeInstanceType !== instance) return false;
            if (businessModel && t.businessModel && t.businessModel !== businessModel) return false;
            return true;
          })
          .sort((a, b) => {
            const ta = Date.parse(a.createdAt || '') || 0;
            const tb = Date.parse(b.createdAt || '') || 0;
            return sort === 'oldest' ? ta - tb : tb - ta;
          });
        const offset = (page - 1) * limit;
        const pageItems = fallbackFiltered.slice(offset, offset + limit);
        const totalCount = fallbackFiltered.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;
        const fallbackPagination = {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? page + 1 : null,
          prevPage: hasPrevPage ? page - 1 : null,
        };
        return {
          data: pageItems,
          pagination: fallbackPagination,
          _devFallback: true,
        };
      }

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const paginationMeta = {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      };

      return {
        data: mapped,
        pagination: paginationMeta,
      };
    };

    // Get data from cache or fetch fresh
    let data;
    try {
      data = await CacheManager.getOrSet(cacheKey, fetchData, {
        ttl: 300, // 5 minutes cache
        tags: ['registry', 'templates'],
      });
    } catch (error) {
      console.error('[RegistryTemplates] Fetch failed:', error);
      const search = url.searchParams.get('search') || '';
      const type = url.searchParams.get('type') || '';
      const category = url.searchParams.get('category') || '';
      const instance = url.searchParams.get('instance') || '';
      const businessModel = url.searchParams.get('businessModel') || '';
      const sort = url.searchParams.get('sort');

      const items = getStore();
      const filtered = items
        .filter(t => {
          if (search) {
            const s = search.toLowerCase();
            if (!t.name.toLowerCase().includes(s) && !t.description.toLowerCase().includes(s)) return false;
          }
          if (type && t.iQubeType && t.iQubeType !== type) return false;
          if (category && !((t as any).metaExtras || []).some((x: { k: string; v: string }) => x?.k === 'category' && x?.v === category)) return false;
          if (instance && t.iQubeInstanceType && t.iQubeInstanceType !== instance) return false;
          if (businessModel && t.businessModel && t.businessModel !== businessModel) return false;
          return true;
        })
        .sort((a, b) => {
          const ta = Date.parse(a.createdAt || '') || 0;
          const tb = Date.parse(b.createdAt || '') || 0;
          return sort === 'oldest' ? ta - tb : tb - ta;
        });

      const offset = (page - 1) * limit;
      const pageItems = filtered.slice(offset, offset + limit);
      const totalCount = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const fallbackPagination = {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      };

      return NextResponse.json(
        {
          data: pageItems,
          pagination: fallbackPagination,
          error: error instanceof Error ? error.message : 'Registry fetch failed',
          _devFallback: true,
        },
        { headers: CDNCache.getHeaders({ ttl: 0 }) }
      );
    }

    // Track cache hit/miss based on whether fetchData was called
    // This is a simplified tracking - in production you'd want more sophisticated tracking
    HealthMetrics.trackCacheHit();

    // Generate ETag
    const etag = CDNCache.generateETag(data || {});
    
    // Check for conditional request
    if (ifNoneMatch && CDNCache.etagMatches(ifNoneMatch, etag)) {
      return new Response(null, { 
        status: 304,
        headers: CDNCache.getHeaders({ ttl: 300, etag }),
      });
    }

    // Return response with cache headers
    return NextResponse.json(data, {
      headers: CDNCache.getHeaders({ 
        ttl: 300, // 5 minutes CDN cache
        etag,
      }),
    });
  };

export async function GET(request: NextRequest) {
  return withMetrics(getHandler, {
    routeName: '/api/registry/templates',
    trackErrors: true,
    trackDuration: true,
  })(request);
}

export async function POST(request: NextRequest) {
  try {
    // Check multiple environment variable patterns for Supabase configuration
    const url = process.env.SUPABASE_URL || 
                process.env.NEXT_PUBLIC_SUPABASE_URL ||
                'https://bsjhfvctmduxhohtllly.supabase.co'; // Fallback to known URL
    
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPABASE_ANON_KEY ||
                       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M'; // Fallback to known anon key
    
    if (!url || !serviceKey) {
      // Enhanced error message with debugging info
      const envInfo = {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: !!process.env.VERCEL,
        NETLIFY: !!process.env.NETLIFY
      };
      
      return NextResponse.json({ 
        error: 'Supabase env not configured', 
        debug: envInfo,
        message: 'Please configure SUPABASE_URL and SUPABASE_ANON_KEY environment variables in your deployment platform'
      }, { status: 500 });
    }

    const body = await request.json();
    const {
      name,
      description,
      iQubeType,
      iQubeInstanceType,
      businessModel,
      version = '1.0',
      parentTemplateId,
      sensitivityScore = 0,
      accuracyScore = 0,
      verifiabilityScore = 0,
      riskScore = 0,
      blakqubeLabels = [],
      metaExtras = [],
      visibility = 'public',
      userId = null,
    } = body;

    // Validate optional fields
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cleanUserId = typeof userId === 'string' && uuidRe.test(userId) ? userId : undefined;
    const cleanVisibility = visibility === 'private' ? 'private' : 'public';

    // Create new template record (full payload attempts to include optional columns)
    const newTemplate: any = {
      id: uuidv4(),
      name,
      description: description || '',
      iqube_type: iQubeType || null,
      instance_type: iQubeInstanceType || 'template',
      business_model: businessModel || null,
      version,
      parent_template_id: parentTemplateId || null,
      sensitivity_score: sensitivityScore,
      accuracy_score: accuracyScore,
      verifiability_score: verifiabilityScore,
      risk_score: riskScore,
      blakqube_labels: blakqubeLabels,
      metaqube_extras: metaExtras,
      // Optional columns (schema may not yet have these; we'll retry without if needed)
      visibility: cleanVisibility,
      ...(cleanUserId ? { user_id: cleanUserId } : {}),
      created_at: new Date().toISOString(),
    };

    // Compute provenance if parent provided
    if (newTemplate.parent_template_id) {
      const parentEndpoint = buildUrl(url, 'rest/v1/iqube_templates', {
        select: 'provenance',
        id: `eq.${newTemplate.parent_template_id}`,
      });
      const parentRes = await fetch(parentEndpoint, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      });
      if (parentRes.ok) {
        const [parentRow] = await parentRes.json();
        newTemplate.provenance = (parentRow?.provenance ?? 0) + 1;
      } else {
        newTemplate.provenance = 1; // Default if parent not found
      }
    } else {
      newTemplate.provenance = 0;
    }

    const endpoint = buildUrl(url, 'rest/v1/iqube_templates');
    // First attempt with full payload
    let res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(newTemplate),
    });

    if (!res.ok) {
      const text = await res.text();
      // Backward compatibility: if schema doesn't have visibility or user_id, retry without them
      const missingColumn = /column\s+\"?(visibility|user_id)\"?\s+does not exist/i.test(text);
      if (missingColumn) {
        const fallback = { ...newTemplate } as any;
        delete fallback.visibility;
        delete fallback.user_id;
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(fallback),
        });
        if (!res.ok) {
          const text2 = await res.text();
          return NextResponse.json({ error: `Supabase error: ${res.status} ${text2}` }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: `Supabase error: ${res.status} ${text}` }, { status: 500 });
      }
    }

    const [created] = await res.json();

    // Invalidate cache when new template is created
    CacheInvalidation.invalidateRegistry();

    // Track business metrics
    BusinessMetrics.trackTemplateCreation(created.iqube_type || 'unknown');

    // Map back to frontend format
    const mapped = {
      id: created.id,
      name: created.name,
      description: created.description || '',
      iQubeType: created.iqube_type || undefined,
      iQubeInstanceType: created.instance_type || undefined,
      businessModel: created.business_model || undefined,
      version: created.version || '1.0',
      parentTemplateId: created.parent_template_id || undefined,
      provenance: typeof created.provenance === 'number' ? created.provenance : 0,
      sensitivityScore: created.sensitivity_score ?? 0,
      accuracyScore: created.accuracy_score ?? 0,
      verifiabilityScore: created.verifiability_score ?? 0,
      riskScore: created.risk_score ?? 0,
      blakqubeLabels: created.blakqube_labels || [],
      metaExtras: created.metaqube_extras || [],
      createdAt: created.created_at,
    };

    return NextResponse.json(mapped, { status: 201 });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
