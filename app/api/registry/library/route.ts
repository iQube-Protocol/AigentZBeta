import { NextRequest, NextResponse } from 'next/server';

// Library API - handles user's private iQube library
export async function GET(request: NextRequest) {
  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Fetch user's library references
    const endpoint = `${url}/rest/v1/user_library?user_id=eq.${userId}&select=*,iqube_templates(*)`;
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

    const libraryItems = await res.json();
    return NextResponse.json(libraryItems);
  } catch (error: any) {
    console.error('Error fetching library:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
    }

    const body = await request.json();
    let { userId, templateId } = body as { userId?: string; templateId?: string };

    if (!templateId) {
      return NextResponse.json({ error: 'templateId required' }, { status: 400 });
    }

    // Validate userId as UUID; allow DEV_USER_ID fallback
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const devUser = process.env.DEV_USER_ID;
    if (!userId || !uuidRe.test(userId)) {
      if (devUser && uuidRe.test(devUser)) {
        userId = devUser;
      } else {
        return NextResponse.json({ error: 'valid userId (uuid) required' }, { status: 400 });
      }
    }

    // Check if already in library
    const checkEndpoint = `${url}/rest/v1/user_library?user_id=eq.${userId}&template_id=eq.${templateId}`;
    const checkRes = await fetch(checkEndpoint, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
    });

    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (existing.length > 0) {
        return NextResponse.json({ message: 'Already in library' }, { status: 200 });
      }
    }

    // Add to library
    const libraryEntry = {
      user_id: userId,
      template_id: templateId,
      added_at: new Date().toISOString(),
    };

    const insertEndpoint = `${url}/rest/v1/user_library`;
    const insertRes = await fetch(insertEndpoint, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(libraryEntry),
    });

    if (!insertRes.ok) {
      const text = await insertRes.text();
      return NextResponse.json({ error: `Failed to add to library: ${text}` }, { status: 500 });
    }

    const created = await insertRes.json();
    return NextResponse.json(created[0]);
  } catch (error: any) {
    console.error('Error adding to library:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
