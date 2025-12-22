/**
 * Admin API: Test Autonomys Connection
 * 
 * GET /api/admin/codex/test-autonomys
 * 
 * Tests connectivity to Autonomys Auto-Drive API
 */

import { NextRequest, NextResponse } from 'next/server';
import { testAutonomysConnection } from '../../../../../server/services/autonomysContentService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    console.log('[TestAutonomys] Testing Autonomys connection...');
    
    // Check if API key is set
    const apiKey = process.env.AUTONOMYS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'AUTONOMYS_API_KEY environment variable not set',
      }, { status: 500 });
    }
    
    console.log('[TestAutonomys] API key found (length:', apiKey.length, ')');
    
    // Test connection
    const result = await testAutonomysConnection();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Autonomys connection successful',
        apiKeyLength: apiKey.length,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        apiKeyLength: apiKey.length,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[TestAutonomys] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
