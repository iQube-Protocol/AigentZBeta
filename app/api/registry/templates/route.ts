import { NextRequest, NextResponse } from 'next/server';

// Minimal Supabase REST client using fetch so we avoid adding a new dependency.
function buildUrl(base: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, base.endsWith('/') ? base : base + '/');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

export async function GET(request: NextRequest) {
  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
    }

    const search = request.nextUrl.searchParams.get('search') || '';
    const type = request.nextUrl.searchParams.get('type') || '';
    const instance = request.nextUrl.searchParams.get('instance') || '';
    const businessModel = request.nextUrl.searchParams.get('businessModel') || '';
    const sort = request.nextUrl.searchParams.get('sort'); // newest|oldest

    // Base select
    const qp: Record<string, string> = {
      select: '*',
      order: `created_at.${sort === 'oldest' ? 'asc' : 'desc'}`,
    };

    // Filters using PostgREST syntax
    if (search) qp['name.ilike'] = `%${search}%`;
    if (type) qp['iqube_type.eq'] = type;
    if (instance) qp['instance_type.eq'] = instance;
    if (businessModel) qp['business_model.eq'] = businessModel;

    const endpoint = buildUrl(url, 'rest/v1/iqube_templates', qp);
    const res = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Supabase error: ${res.status} ${text}` }, { status: 500 });
    }
    const rows = await res.json();

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
      blakqubeLabels: r.blakqube_labels || r.blakqubeLabels || [],
      metaExtras: r.metaqube_extras || null,
      createdAt: r.created_at,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
