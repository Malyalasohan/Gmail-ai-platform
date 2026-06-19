/**
 * Automation Rules API
 * 
 * GET /api/workflow/rules - Get all automation rules
 * POST /api/workflow/rules - Create a new automation rule
 * PUT /api/workflow/rules - Toggle rule enabled status
 * DELETE /api/workflow/rules - Delete a rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAutomationRules,
  createAutomationRuleFromNL,
  toggleRule,
  deleteRule
} from '../../../../lib/workflows/rules';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rules = await getAutomationRules(session.user.id);

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error('[RULES API] Error getting rules:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to get rules' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { rule } = body;

    if (!rule) {
      return NextResponse.json(
        { error: 'Missing required field: rule' },
        { status: 400 }
      );
    }

    // Create rule from natural language
    const newRule = await createAutomationRuleFromNL(session.user.id, rule);

    return NextResponse.json({ 
      success: true,
      rule: newRule
    });
  } catch (error: any) {
    console.error('[RULES API] Error creating rule:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to create rule' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { ruleId, enabled } = body;

    if (!ruleId || enabled === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: ruleId, enabled' },
        { status: 400 }
      );
    }

    const success = await toggleRule(ruleId, session.user.id, enabled);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to toggle rule' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true,
      ruleId,
      enabled
    });
  } catch (error: any) {
    console.error('[RULES API] Error toggling rule:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to toggle rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get('ruleId');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Missing required parameter: ruleId' },
        { status: 400 }
      );
    }

    const success = await deleteRule(ruleId, session.user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete rule' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true,
      ruleId
    });
  } catch (error: any) {
    console.error('[RULES API] Error deleting rule:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to delete rule' },
      { status: 500 }
    );
  }
}

