/**
 * Reminders API
 * 
 * GET /api/workflow/reminders - Get reminders (upcoming, overdue, stats)
 * PUT /api/workflow/reminders - Update reminder status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isQuotaExceededError } from '@/lib/ai-provider';
import {
  getUpcomingReminders,
  getOverdueReminders,
  getReminderStats,
  updateReminderStatus
} from '../../../../lib/workflows/reminders';

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
    const type = searchParams.get('type') || 'upcoming';
    const days = parseInt(searchParams.get('days') || '7');

    if (type === 'stats') {
      const stats = await getReminderStats(session.user.id);
      return NextResponse.json({ stats });
    }

    if (type === 'overdue') {
      const reminders = await getOverdueReminders(session.user.id);
      return NextResponse.json({ reminders });
    }

    // Default: upcoming reminders
    const reminders = await getUpcomingReminders(session.user.id, days);
    return NextResponse.json({ reminders });
  } catch (error: any) {
    console.error('[REMINDERS API] Error getting reminders:', error);
    
    // Check if it's a quota error
    if (isQuotaExceededError(error)) {
      console.warn('⚠️ Gemini API quota exceeded')
      return NextResponse.json(
        {
          success: false,
          error: 'AI_QUOTA_EXCEEDED',
          message: 'AI service is temporarily unavailable. Please try again in a moment.',
        },
        { status: 200 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to get reminders' },
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
    const { reminderId, status } = body;

    if (!reminderId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: reminderId, status' },
        { status: 400 }
      );
    }

    const success = await updateReminderStatus(reminderId, session.user.id, status);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update reminder' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true,
      reminderId,
      status
    });
  } catch (error: any) {
    console.error('[REMINDERS API] Error updating reminder:', error);
    
    // Check if it's a quota error
    if (isQuotaExceededError(error)) {
      console.warn('⚠️ Gemini API quota exceeded')
      return NextResponse.json(
        {
          success: false,
          error: 'AI_QUOTA_EXCEEDED',
          message: 'AI service is temporarily unavailable. Please try again in a moment.',
        },
        { status: 200 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to update reminder' },
      { status: 500 }
    );
  }
}

