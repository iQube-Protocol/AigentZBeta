import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    
    if (!personaId) {
      return NextResponse.json({ success: false, error: 'Persona ID required' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.aigentz.me';
    const referralLink = `${baseUrl}/signup?ref=${personaId}`;
    
    return NextResponse.json({ 
      success: true, 
      link: referralLink,
      personaId 
    });
  } catch (error) {
    console.error('Referral link generation error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate link' }, { status: 500 });
  }
}
