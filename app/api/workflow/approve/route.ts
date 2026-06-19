/**
 * Workflow Approval API
 * 
 * POST /api/workflow/approve - Approve a workflow
 * POST /api/workflow/reject - Reject a workflow
 * GET /api/workflow/approve - Get pending approvals
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  approveWorkflow,
  rejectWorkflow,
  getPendingApprovals
} from '../../../../lib/workflows/approval';
import { executeApprovedWorkflow } from '../../../../lib/workflows/automation';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get pending approvals
    const approvals = await getPendingApprovals(session.user.id);

    return NextResponse.json({ approvals });
  } catch (error: any) {
    console.error('[APPROVAL API] Error getting approvals:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to get approvals' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { approvalId, action } = body;

    if (!approvalId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: approvalId, action' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Approve the workflow
      const approved = await approveWorkflow(approvalId, session.user.id);
      
      if (!approved) {
        return NextResponse.json(
          { error: 'Failed to approve workflow' },
          { status: 400 }
        );
      }

      // Execute the approved workflow
      const result = await executeApprovedWorkflow(
        approvalId,
        session.user.id,
        session.accessToken
      );

      return NextResponse.json({ 
        success: true,
        approved: true,
        execution: result
      });
    } else if (action === 'reject') {
      // Reject the workflow
      const rejected = await rejectWorkflow(approvalId, session.user.id);
      
      if (!rejected) {
        return NextResponse.json(
          { error: 'Failed to reject workflow' },
          { status: 400 }
        );
      }

      return NextResponse.json({ 
        success: true,
        rejected: true
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[APPROVAL API] Error processing approval:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to process approval' },
      { status: 500 }
    );
  }
}

