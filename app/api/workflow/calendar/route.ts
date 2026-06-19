/**
 * Calendar Events API
 * 
 * GET /api/workflow/calendar - Get calendar events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isQuotaExceededError } from '../../../../lib/gemini';
import {
  getUpcomingEvents,
  getTodaysEvents,
  getCalendarStats,
  updateEventStatus
} from '../../../../lib/workflows/calendar';

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
    const days = parseInt(searchParams.get('days') || '30');

    if (type === 'stats') {
      const stats = await getCalendarStats(session.user.id);
      return NextResponse.json({ stats });
    }

    if (type === 'today') {
      const events = await getTodaysEvents(session.user.id);
      return NextResponse.json({ events });
    }

    // Default: upcoming events
    const events = await getUpcomingEvents(session.user.id, days);
    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('[CALENDAR API] Error getting events:', error);
    
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
      { error: error.message || 'Failed to get calendar events' },
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
    const { eventId, status } = body;

    if (!eventId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, status' },
        { status: 400 }
      );
    }

    const success = await updateEventStatus(eventId, session.user.id, status);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true,
      eventId,
      status
    });
  } catch (error: any) {
    console.error('[CALENDAR API] Error updating event:', error);
    
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
      { error: error.message || 'Failed to update event' },
      { status: 500 }
    );
  }
}

