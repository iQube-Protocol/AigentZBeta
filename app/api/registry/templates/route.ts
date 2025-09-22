import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Minimal Supabase REST client using fetch so we avoid adding a new dependency.
function buildUrl(base: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, base.endsWith('/') ? base : base + '/');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

export async function GET(request: NextRequest) {
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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

    // Filters using correct PostgREST syntax: column=operator.value
    // name ilike with wildcards must be provided as: name=ilike.*term*
    if (search) qp['name'] = `ilike.*${search}*`;
    if (type) qp['iqube_type'] = `eq.${type}`;
    if (instance) qp['instance_type'] = `eq.${instance}`;
    if (businessModel) qp['business_model'] = `eq.${businessModel}`;

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
      price: typeof r.price === 'number' ? r.price : (r.price_usd ?? null),
      blakqubeLabels: r.blakqube_labels || r.blakqubeLabels || [],
      metaExtras: r.metaqube_extras || null,
      visibility: r.visibility || 'public',
      userId: r.user_id || null,
      createdAt: r.created_at,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
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
