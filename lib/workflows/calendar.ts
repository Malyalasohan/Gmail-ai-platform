/**
 * Calendar Integration
 * 
 * Extracts meeting and event information from emails and creates calendar events.
 */

import { generateText } from '../ai-provider';
import { createServiceClient } from '../supabase/server';

export interface CalendarEvent {
  id: string;
  userId: string;
  emailId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  type: 'meeting' | 'interview' | 'deadline' | 'event';
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Date;
  emailSubject?: string;
  emailFrom?: string;
}

export interface ExtractedEvent {
  title: string;
  description: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  type: 'meeting' | 'interview' | 'deadline' | 'event';
  confidence: number; // 0-1
}

/**
 * Extract calendar events from email
 */
export async function extractCalendarEvents(
  emailSubject: string,
  emailBody: string,
  emailFrom: string
): Promise<ExtractedEvent[]> {
  console.log('[CALENDAR] Extracting events from email');

  const prompt = `Extract all meeting, interview, and event information from this email.

SUBJECT: ${emailSubject}
FROM: ${emailFrom}

BODY:
${emailBody.substring(0, 2000)} ${emailBody.length > 2000 ? '...' : ''}

Look for:
- Meeting invitations
- Interview schedules
- Event dates and times
- Location information
- Attendees/participants
- Duration

Respond with ONLY a JSON array (no markdown, no explanation):
[
  {
    "title": "Event title",
    "description": "Event details",
    "location": "Location (if mentioned)",
    "startTime": "ISO date string",
    "endTime": "ISO date string",
    "attendees": ["email1@example.com"],
    "type": "meeting|interview|deadline|event",
    "confidence": 0.9
  }
]

If no events found, return: []`;

  try {
    const response = await generateText(prompt, { temperature: 0.2 });
    const events = JSON.parse(response);

    console.log('[CALENDAR] Extracted events:', events.length);

    return events.map((e: any) => ({
      title: e.title,
      description: e.description,
      location: e.location,
      startTime: new Date(e.startTime),
      endTime: new Date(e.endTime),
      attendees: e.attendees,
      type: e.type,
      confidence: e.confidence
    }));
  } catch (error) {
    console.error('[CALENDAR] Failed to extract events:', error);
    return [];
  }
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(
  userId: string,
  emailId: string,
  event: ExtractedEvent,
  emailSubject: string,
  emailFrom: string
): Promise<CalendarEvent> {
  const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const calendarEvent: CalendarEvent = {
    id: eventId,
    userId,
    emailId,
    title: event.title,
    description: event.description,
    location: event.location,
    startTime: event.startTime,
    endTime: event.endTime,
    attendees: event.attendees,
    type: event.type,
    status: 'pending',
    createdAt: new Date(),
    emailSubject,
    emailFrom
  };

  console.log('[CALENDAR] Creating event:', {
    id: eventId,
    title: event.title,
    startTime: event.startTime
  });

  try {
    const supabase = createServiceClient();
    
    await supabase
      .from('calendar_events')
      .insert({
        id: calendarEvent.id,
        user_id: userId,
        email_id: emailId,
        title: calendarEvent.title,
        description: calendarEvent.description,
        location: calendarEvent.location,
        start_time: calendarEvent.startTime,
        end_time: calendarEvent.endTime,
        attendees: calendarEvent.attendees,
        type: calendarEvent.type,
        status: calendarEvent.status,
        created_at: calendarEvent.createdAt,
        email_subject: emailSubject,
        email_from: emailFrom
      });

    console.log('[CALENDAR] Event created:', eventId);
  } catch (error) {
    console.error('[CALENDAR] Failed to save event:', error);
  }

  return calendarEvent;
}

/**
 * Get upcoming events
 */
export async function getUpcomingEvents(userId: string, days: number = 30): Promise<CalendarEvent[]> {
  try {
    const supabase = createServiceClient();
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .gte('start_time', new Date().toISOString())
      .lte('start_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    if (error || !data) {
      console.error('[CALENDAR] Failed to get upcoming events:', error);
      return [];
    }

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      emailId: row.email_id,
      title: row.title,
      description: row.description,
      location: row.location,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      attendees: row.attendees,
      type: row.type,
      status: row.status,
      createdAt: new Date(row.created_at),
      emailSubject: row.email_subject,
      emailFrom: row.email_from
    }));
  } catch (error) {
    console.error('[CALENDAR] Error getting upcoming events:', error);
    return [];
  }
}

/**
 * Get today's events
 */
export async function getTodaysEvents(userId: string): Promise<CalendarEvent[]> {
  try {
    const supabase = createServiceClient();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .order('start_time', { ascending: true });

    if (error || !data) {
      console.error('[CALENDAR] Failed to get today\'s events:', error);
      return [];
    }

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      emailId: row.email_id,
      title: row.title,
      description: row.description,
      location: row.location,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      attendees: row.attendees,
      type: row.type,
      status: row.status,
      createdAt: new Date(row.created_at),
      emailSubject: row.email_subject,
      emailFrom: row.email_from
    }));
  } catch (error) {
    console.error('[CALENDAR] Error getting today\'s events:', error);
    return [];
  }
}

/**
 * Update event status
 */
export async function updateEventStatus(
  eventId: string,
  userId: string,
  status: 'pending' | 'confirmed' | 'cancelled'
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('calendar_events')
      .update({ status })
      .eq('id', eventId)
      .eq('user_id', userId);

    if (error) {
      console.error('[CALENDAR] Failed to update event status:', error);
      return false;
    }

    console.log('[CALENDAR] Event status updated:', eventId, status);
    return true;
  } catch (error) {
    console.error('[CALENDAR] Error updating event status:', error);
    return false;
  }
}

/**
 * Auto-generate calendar events from email
 */
export async function autoGenerateCalendarEvents(
  userId: string,
  emailId: string,
  emailSubject: string,
  emailBody: string,
  emailFrom: string
): Promise<CalendarEvent[]> {
  console.log('[CALENDAR] Auto-generating events for email:', emailId);

  try {
    // Extract events
    const events = await extractCalendarEvents(emailSubject, emailBody, emailFrom);

    // Filter high-confidence events
    const highConfidenceEvents = events.filter(e => e.confidence >= 0.7);

    console.log('[CALENDAR] Found high-confidence events:', highConfidenceEvents.length);

    // Create calendar events
    const calendarEvents: CalendarEvent[] = [];
    for (const event of highConfidenceEvents) {
      const calendarEvent = await createCalendarEvent(userId, emailId, event, emailSubject, emailFrom);
      calendarEvents.push(calendarEvent);
    }

    return calendarEvents;
  } catch (error) {
    console.error('[CALENDAR] Failed to auto-generate events:', error);
    return [];
  }
}

/**
 * Get calendar statistics
 */
export async function getCalendarStats(userId: string): Promise<{
  total: number;
  upcoming: number;
  today: number;
  thisWeek: number;
  byType: Record<string, number>;
}> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'cancelled');

    if (error || !data) {
      return { total: 0, upcoming: 0, today: 0, thisWeek: 0, byType: {} };
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const stats = {
      total: data.length,
      upcoming: data.filter(e => new Date(e.start_time) >= now).length,
      today: data.filter(e => new Date(e.start_time) >= today && new Date(e.start_time) < tomorrow).length,
      thisWeek: data.filter(e => new Date(e.start_time) >= now && new Date(e.start_time) <= nextWeek).length,
      byType: {} as Record<string, number>
    };

    // Count by type
    data.forEach(e => {
      stats.byType[e.type] = (stats.byType[e.type] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('[CALENDAR] Error getting calendar stats:', error);
    return { total: 0, upcoming: 0, today: 0, thisWeek: 0, byType: {} };
  }
}

