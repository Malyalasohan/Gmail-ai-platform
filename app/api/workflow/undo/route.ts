/**
 * Undo API
 * 
 * GET /api/workflow/undo - Get undoable actions
 * POST /api/workflow/undo - Undo an action
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getUserUndoableActions,
  undoAction
} from '../../../../lib/workflows/undo';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const actions = await getUserUndoableActions(session.user.id);

    return NextResponse.json({ actions });
  } catch (error: any) {
    console.error('[UNDO API] Error getting undoable actions:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to get undoable actions' },
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
    const { actionId } = body;

    if (!actionId) {
      return NextResponse.json(
        { error: 'Missing required field: actionId' },
        { status: 400 }
      );
    }

    const success = await undoAction(actionId, session.user.id, session.accessToken);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to undo action. It may have expired or already been undone.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true,
      actionId
    });
  } catch (error: any) {
    console.error('[UNDO API] Error undoing action:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to undo action' },
      { status: 500 }
    );
  }
}

