/**
 * Workflow History API
 * 
 * GET /api/workflow/history - Get workflow execution history
 * GET /api/workflow/history?stats=true - Get workflow statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getWorkflowHistory,
  getWorkflowStats,
  getWorkflowExecution
} from '../../../../lib/workflows/history';

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
    const stats = searchParams.get('stats') === 'true';
    const executionId = searchParams.get('executionId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (stats) {
      // Get workflow statistics
      const statistics = await getWorkflowStats(session.user.id);
      return NextResponse.json({ stats: statistics });
    }

    if (executionId) {
      // Get specific execution
      const execution = await getWorkflowExecution(executionId, session.user.id);
      
      if (!execution) {
        return NextResponse.json(
          { error: 'Execution not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ execution });
    }

    // Get workflow history
    const history = await getWorkflowHistory(session.user.id, limit);

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('[HISTORY API] Error getting workflow history:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to get workflow history' },
      { status: 500 }
    );
  }
}

