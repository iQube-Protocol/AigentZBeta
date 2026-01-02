import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204,  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(
  req: NextRequest,
  { params }: { params: { cid: string } }
) {
  try {
    const cid = params.cid;
    
    const { data, error } = await supabase
      .from('pdf_page_manifests')
      .select('*')
      .eq('auto_drive_cid', cid)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Pages not ready or not found' },
        { status: 404,  }
      );
    }

    // Generate URLs for all pages
    const pages = Array.from({ length: data.pages_count }, (_, i) => {
      const n = String(i + 1).padStart(4, '0');
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${data.bucket}/${data.base_path}/p${n}.webp`;
    });

    return NextResponse.json(
      {
        pagesCount: data.pages_count,
        width: data.width,
        pages,
        cached: false,
      },
      { status: 200,  }
    );
  } catch (e: any) {
    console.error('[pdf-pages] Error:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal error' },
      { status: 500,  }
    );
  }
}
