/**
 * Workflow Templates API
 * 
 * GET /api/workflow/templates - Get all workflow templates
 * GET /api/workflow/templates?category=X - Get templates by category
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getWorkflowTemplates,
  getTemplatesByCategory,
  getTemplateById
} from '../../../../lib/workflows/templates';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const templateId = searchParams.get('id');

    if (templateId) {
      // Get specific template
      const template = getTemplateById(templateId);
      
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ template });
    }

    if (category) {
      // Get templates by category
      const templates = getTemplatesByCategory(category as any);
      return NextResponse.json({ templates });
    }

    // Get all templates
    const templates = getWorkflowTemplates();

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('[TEMPLATES API] Error getting templates:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to get templates' },
      { status: 500 }
    );
  }
}

