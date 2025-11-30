/**
 * CRM Admin Categories API
 * 
 * GET /api/crm/admin/categories - List admin domain categories
 */

import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/services/crm/crmDataAccess';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Get specific category by slug
    if (slug) {
      const category = await db.getAdminCategoryBySlug(slug);
      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: category,
      });
    }

    // List all categories
    const categories = await db.listAdminCategories(activeOnly);

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    console.error('[CRM API] GET /admin/categories error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin categories' },
      { status: 500 }
    );
  }
}
