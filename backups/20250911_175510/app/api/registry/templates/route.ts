import { NextRequest, NextResponse } from 'next/server';
import { IQubeTemplate } from '../../../../types/registry';
import { getStore, setStore } from './store';
import { getSupabaseServer } from '../../_lib/supabaseServer';

function applyFilters(items: IQubeTemplate[], params: URLSearchParams): IQubeTemplate[] {
  const search = params.get('search') || '';
  const type = params.get('type') || '';
  const instance = params.get('instance') || '';
  const businessModel = params.get('businessModel') || '';

  return items.filter(t => {
    if (search) {
      const s = search.toLowerCase();
      if (!t.name.toLowerCase().includes(s) && !t.description.toLowerCase().includes(s)) return false;
    }
    if (type && t.iQubeType && t.iQubeType !== (type as any)) return false;
    if (instance && t.iQubeInstanceType && t.iQubeInstanceType !== (instance as any)) return false;
    if (businessModel && t.businessModel && t.businessModel !== (businessModel as any)) return false;
    return true;
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    if (supabase) {
      const params = request.nextUrl.searchParams;
      let query = supabase.from('iqube_templates').select(
        'id,name,description,iqube_type,instance_type,business_model,price,version,provenance,parent_template_id,blakqube_labels,metaqube_extras,sensitivity_score,accuracy_score,verifiability_score,risk_score,created_at'
      );
      const search = params.get('search');
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }
      const type = params.get('type');
      if (type) query = query.eq('iqube_type', type);
      const instance = params.get('instance');
      if (instance) query = query.eq('instance_type', instance);
      const businessModel = params.get('businessModel');
      if (businessModel) query = query.eq('business_model', businessModel);
      const sort = params.get('sort'); // 'newest' | 'oldest'
      query = query.order('created_at', { ascending: sort === 'oldest' });

      const { data, error, status } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: status || 500 });

      const mapped: IQubeTemplate[] = (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        iQubeType: r.iqube_type || undefined,
        iQubeInstanceType: r.instance_type || undefined,
        businessModel: r.business_model || undefined,
        price: r.price ?? undefined,
        version: r.version ?? undefined,
        provenance: r.provenance ?? undefined,
        parentTemplateId: r.parent_template_id ?? undefined,
        blakqubeLabels: r.blakqube_labels ?? undefined,
        metaExtras: r.metaqube_extras ?? undefined,
        sensitivityScore: r.sensitivity_score ?? 0,
        accuracyScore: r.accuracy_score,
        verifiabilityScore: r.verifiability_score,
        riskScore: r.risk_score,
        createdAt: r.created_at,
      }));
      return NextResponse.json(mapped, { status: 200 });
    }

    // Fallback to in-memory store
    const items = getStore();
    const filtered = applyFilters(items, request.nextUrl.searchParams);
    return NextResponse.json(filtered, { status: 200 });
  } catch (error) {
    console.error('GET /api/registry/templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const required: Array<keyof IQubeTemplate> = ['name', 'description', 'accuracyScore', 'verifiabilityScore', 'riskScore'];
    for (const key of required) {
      if (body[key] === undefined || body[key] === null) {
        return NextResponse.json({ error: `Missing field: ${key}` }, { status: 400 });
      }
    }

    const supabase = getSupabaseServer();
    if (supabase) {
      const payload: any = {
        name: body.name,
        description: body.description,
        iqube_type: body.iQubeType ?? null,
        instance_type: body.iQubeInstanceType ?? 'template',
        business_model: body.businessModel ?? null,
        price: body.price ?? null,
        version: body.version ?? '1.0',
        parent_template_id: body.parentTemplateId ?? null,
        blakqube_labels: body.blakqubeLabels ?? null,
        metaqube_extras: body.metaExtras ?? null,
        sensitivity_score: body.sensitivityScore ?? 0,
        accuracy_score: body.accuracyScore,
        verifiability_score: body.verifiabilityScore,
        risk_score: body.riskScore,
      };
      // Compute provenance if parent provided
      if (payload.parent_template_id) {
        const { data: parentRow } = await supabase
          .from('iqube_templates')
          .select('provenance')
          .eq('id', payload.parent_template_id)
          .single();
        payload.provenance = (parentRow?.provenance ?? 0) + 1;
      } else {
        payload.provenance = 0;
      }
      const { data, error, status } = await supabase.from('iqube_templates').insert(payload).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: status || 500 });
      const created: IQubeTemplate = {
        id: data.id,
        name: data.name,
        description: data.description,
        iQubeType: data.iqube_type || undefined,
        iQubeInstanceType: data.instance_type || undefined,
        businessModel: data.business_model || undefined,
        price: data.price ?? undefined,
        version: data.version ?? undefined,
        provenance: data.provenance ?? undefined,
        parentTemplateId: data.parent_template_id ?? undefined,
        blakqubeLabels: data.blakqube_labels ?? undefined,
        metaExtras: data.metaqube_extras ?? undefined,
        sensitivityScore: data.sensitivity_score ?? 0,
        accuracyScore: data.accuracy_score,
        verifiabilityScore: data.verifiability_score,
        riskScore: data.risk_score,
        createdAt: data.created_at,
      };
      return NextResponse.json(created, { status: 201 });
    }

    // Fallback to in-memory store
    const items = getStore();
    const id = `template-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    const next: IQubeTemplate = {
      id,
      createdAt,
      name: body.name,
      description: body.description,
      iQubeType: body.iQubeType,
      iQubeInstanceType: body.iQubeInstanceType ?? 'template',
      businessModel: body.businessModel,
      price: body.price,
      version: body.version ?? '1.0',
      provenance: body.parentTemplateId ? 1 : 0,
      parentTemplateId: body.parentTemplateId,
      blakqubeLabels: body.blakqubeLabels,
      sensitivityScore: body.sensitivityScore ?? 0,
      accuracyScore: body.accuracyScore,
      verifiabilityScore: body.verifiabilityScore,
      riskScore: body.riskScore,
    };

    setStore([next, ...items]);
    return NextResponse.json(next, { status: 201 });
  } catch (error) {
    console.error('POST /api/registry/templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
