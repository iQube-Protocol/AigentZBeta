import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js'

// Minimal Supabase REST client using fetch so we avoid adding a new dependency.
function buildUrl(base: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, base.endsWith('/') ? base : base + '/');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}



export async function GET(request: NextRequest) {
  try {
    //Supabase configuration
    const url = process.env.SUPABASE_URL;
    
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials HERE' },
        { status: 500 }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(url, serviceKey)
    
    
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
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
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
      version: r.version || '1',
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
    // Supabase configuration
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    // Initialize Supabase client (optional, kept for parity)
    const supabase = createClient(url, serviceKey);

    const body = await request.json();

    // Basic validation
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    const {
      name,
      description = '',
      iQubeType,
      iQubeInstanceType,
      businessModel,
      version = '1',
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

    // Validate optional userId as UUID
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cleanUserId = typeof userId === 'string' && uuidRe.test(userId) ? userId : undefined;
    const cleanVisibility = visibility === 'private' ? 'private' : 'public';

    // Build new template payload for DB
    const newTemplate: any = {
      id: uuidv4(),
      name,
      description,
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
      visibility: cleanVisibility,
      ...(cleanUserId ? { user_id: cleanUserId } : {}),
      created_at: new Date().toISOString(),
    };

    // If there is a parent, fetch its provenance to compute ours
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
        newTemplate.provenance = 1;
      }
    } else {
      newTemplate.provenance = 0;
    }

    const endpoint = buildUrl(url, 'rest/v1/iqube_templates');

    // Try inserting full payload
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

    // If insertion fails due to unknown columns, retry without optional columns
    if (!res.ok) {
      const text = await res.text();
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

    const mapped = {
      id: created.id,
      name: created.name,
      description: created.description || '',
      iQubeType: created.iqube_type || undefined,
      iQubeInstanceType: created.instance_type || undefined,
      businessModel: created.business_model || undefined,
      version: created.version || '1',
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

export async function PUT(request: NextRequest) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    // accept id in body or as query param
    const id = (body?.id as string) || request.nextUrl?.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing template id' }, { status: 400 });
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(id)) {
      return NextResponse.json({ error: 'Invalid id format' }, { status: 400 });
    }

    // allow callers to pass updates either as { updates: {...} } or directly in body (excluding id)
    const candidateUpdates = body?.updates && typeof body.updates === 'object'
      ? body.updates
      : { ...body };
    delete candidateUpdates.id;

    // map frontend keys -> DB columns
    const keyMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      iQubeType: 'iqube_type',
      iQubeInstanceType: 'instance_type',
      businessModel: 'business_model',
      version: 'version',
      parentTemplateId: 'parent_template_id',
      sensitivityScore: 'sensitivity_score',
      accuracyScore: 'accuracy_score',
      verifiabilityScore: 'verifiability_score',
      riskScore: 'risk_score',
      blakqubeLabels: 'blakqube_labels',
      metaExtras: 'metaqube_extras',
      visibility: 'visibility',
      userId: 'user_id',
      price: 'price', // adjust if your schema uses price_usd
    };

    const payload: any = {};
    for (const [k, v] of Object.entries(candidateUpdates || {})) {
      const mapped = keyMap[k];
      if (mapped) payload[mapped] = v;
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // if parent_template_id is being set/changed, recompute provenance similar to POST
    if (payload.parent_template_id) {
      const parentEndpoint = buildUrl(url, 'rest/v1/iqube_templates', {
        select: 'provenance',
        id: `eq.${payload.parent_template_id}`,
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
        payload.provenance = (parentRow?.provenance ?? 0) + 1;
      } else {
        payload.provenance = 1;
      }
    }

    const endpoint = buildUrl(url, 'rest/v1/iqube_templates', { id: `eq.${id}` });
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Supabase error: ${res.status} ${text}` }, { status: 500 });
    }

    const [updated] = await res.json();
    if (!updated) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const mapped = {
      id: updated.id,
      name: updated.name,
      description: updated.description || '',
      iQubeType: updated.iqube_type || undefined,
      iQubeInstanceType: updated.instance_type || undefined,
      businessModel: updated.business_model || undefined,
      version: updated.version || '1.0',
      parentTemplateId: updated.parent_template_id || undefined,
      provenance: typeof updated.provenance === 'number' ? updated.provenance : 0,
      sensitivityScore: updated.sensitivity_score ?? 0,
      accuracyScore: updated.accuracy_score ?? 0,
      verifiabilityScore: updated.verifiability_score ?? 0,
      riskScore: updated.risk_score ?? 0,
      blakqubeLabels: updated.blakqube_labels || [],
      metaExtras: updated.metaqube_extras || [],
      visibility: updated.visibility || 'public',
      userId: updated.user_id || null,
      price: typeof updated.price === 'number' ? updated.price : (updated.price_usd ?? null),
      createdAt: updated.created_at,
    };

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
    }

    // accept id in body or as query param
    let id: string | null = null;
    try {
      const body = await request.json().catch(() => ({}));
      id = (body?.id as string) || null;
    } catch {
      id = null;
    }
    id = id || request.nextUrl?.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing template id' }, { status: 400 });
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(id)) {
      return NextResponse.json({ error: 'Invalid id format' }, { status: 400 });
    }

    const endpoint = buildUrl(url, 'rest/v1/iqube_templates', { id: `eq.${id}` });
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Supabase error: ${res.status} ${text}` }, { status: 500 });
    }

    const [deleted] = await res.json();
    if (!deleted) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const mapped = {
      id: deleted.id,
      name: deleted.name,
      description: deleted.description || '',
      iQubeType: deleted.iqube_type || undefined,
      iQubeInstanceType: deleted.instance_type || undefined,
      businessModel: deleted.business_model || undefined,
      version: deleted.version || '1.0',
      parentTemplateId: deleted.parent_template_id || undefined,
      provenance: typeof deleted.provenance === 'number' ? deleted.provenance : 0,
      sensitivityScore: deleted.sensitivity_score ?? 0,
      accuracyScore: deleted.accuracy_score ?? 0,
      verifiabilityScore: deleted.verifiability_score ?? 0,
      riskScore: deleted.risk_score ?? 0,
      blakqubeLabels: deleted.blakqube_labels || [],
      metaExtras: deleted.metaqube_extras || [],
      visibility: deleted.visibility || 'public',
      userId: deleted.user_id || null,
      price: typeof deleted.price === 'number' ? deleted.price : (deleted.price_usd ?? null),
      createdAt: deleted.created_at,
    };

    return NextResponse.json(mapped, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

