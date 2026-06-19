/**
 * Reminder Engine
 * 
 * Extracts deadlines and creates reminders automatically.
 */

import { generateText } from '../ai-provider';
import { createServiceClient } from '../supabase/server';

export interface Reminder {
  id: string;
  userId: string;
  emailId: string;
  type: 'deadline' | 'meeting' | 'invoice' | 'assignment' | 'follow_up' | 'custom';
  title: string;
  description?: string;
  reminderDate: Date;
  status: 'pending' | 'sent' | 'dismissed';
  createdAt: Date;
  emailSubject?: string;
  emailFrom?: string;
}

export interface ExtractedDeadline {
  type: 'deadline' | 'meeting' | 'invoice' | 'assignment' | 'follow_up';
  title: string;
  description: string;
  date: Date;
  confidence: number; // 0-1
}

/**
 * Extract deadlines and important dates from email
 */
export async function extractDeadlines(
  emailSubject: string,
  emailBody: string,
  emailFrom: string
): Promise<ExtractedDeadline[]> {
  console.log('[REMINDERS] Extracting deadlines from email');

  const prompt = `Extract all deadlines, important dates, and time-sensitive information from this email.

SUBJECT: ${emailSubject}
FROM: ${emailFrom}

BODY:
${emailBody.substring(0, 2000)} ${emailBody.length > 2000 ? '...' : ''}

Look for:
- Deadlines (due dates, submission dates)
- Meetings (scheduled times, appointments)
- Invoices (payment due dates)
- Assignments (project due dates)
- Follow-ups (promised dates to get back)
- Any other time-sensitive information

Respond with ONLY a JSON array (no markdown, no explanation):
[
  {
    "type": "deadline|meeting|invoice|assignment|follow_up",
    "title": "Brief title",
    "description": "What needs to be done",
    "date": "ISO date string",
    "confidence": 0.9
  }
]

If no deadlines found, return: []`;

  try {
    const response = await generateText(prompt, { temperature: 0.2 });
    const deadlines = JSON.parse(response);

    console.log('[REMINDERS] Extracted deadlines:', deadlines.length);

    return deadlines.map((d: any) => ({
      type: d.type,
      title: d.title,
      description: d.description,
      date: new Date(d.date),
      confidence: d.confidence
    }));
  } catch (error) {
    console.error('[REMINDERS] Failed to extract deadlines:', error);
    return [];
  }
}

/**
 * Create reminder from deadline
 */
export async function createReminder(
  userId: string,
  emailId: string,
  deadline: ExtractedDeadline,
  emailSubject: string,
  emailFrom: string
): Promise<Reminder> {
  const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const reminder: Reminder = {
    id: reminderId,
    userId,
    emailId,
    type: deadline.type,
    title: deadline.title,
    description: deadline.description,
    reminderDate: deadline.date,
    status: 'pending',
    createdAt: new Date(),
    emailSubject,
    emailFrom
  };

  console.log('[REMINDERS] Creating reminder:', {
    id: reminderId,
    type: deadline.type,
    date: deadline.date
  });

  try {
    const supabase = createServiceClient();
    
    await supabase
      .from('reminders')
      .insert({
        id: reminder.id,
        user_id: userId,
        email_id: emailId,
        type: reminder.type,
        title: reminder.title,
        description: reminder.description,
        reminder_date: reminder.reminderDate,
        status: reminder.status,
        created_at: reminder.createdAt,
        email_subject: emailSubject,
        email_from: emailFrom
      });

    console.log('[REMINDERS] Reminder created:', reminderId);
  } catch (error) {
    console.error('[REMINDERS] Failed to save reminder:', error);
  }

  return reminder;
}

/**
 * Get upcoming reminders for a user
 */
export async function getUpcomingReminders(userId: string, days: number = 7): Promise<Reminder[]> {
  try {
    const supabase = createServiceClient();
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('reminder_date', new Date().toISOString())
      .lte('reminder_date', endDate.toISOString())
      .order('reminder_date', { ascending: true });

    if (error || !data) {
      console.error('[REMINDERS] Failed to get upcoming reminders:', error);
      return [];
    }

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      emailId: row.email_id,
      type: row.type,
      title: row.title,
      description: row.description,
      reminderDate: new Date(row.reminder_date),
      status: row.status,
      createdAt: new Date(row.created_at),
      emailSubject: row.email_subject,
      emailFrom: row.email_from
    }));
  } catch (error) {
    console.error('[REMINDERS] Error getting upcoming reminders:', error);
    return [];
  }
}

/**
 * Get overdue reminders
 */
export async function getOverdueReminders(userId: string): Promise<Reminder[]> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lt('reminder_date', new Date().toISOString())
      .order('reminder_date', { ascending: true });

    if (error || !data) {
      console.error('[REMINDERS] Failed to get overdue reminders:', error);
      return [];
    }

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      emailId: row.email_id,
      type: row.type,
      title: row.title,
      description: row.description,
      reminderDate: new Date(row.reminder_date),
      status: row.status,
      createdAt: new Date(row.created_at),
      emailSubject: row.email_subject,
      emailFrom: row.email_from
    }));
  } catch (error) {
    console.error('[REMINDERS] Error getting overdue reminders:', error);
    return [];
  }
}

/**
 * Mark reminder as sent/dismissed
 */
export async function updateReminderStatus(
  reminderId: string,
  userId: string,
  status: 'sent' | 'dismissed'
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('reminders')
      .update({ status })
      .eq('id', reminderId)
      .eq('user_id', userId);

    if (error) {
      console.error('[REMINDERS] Failed to update reminder status:', error);
      return false;
    }

    console.log('[REMINDERS] Reminder status updated:', reminderId, status);
    return true;
  } catch (error) {
    console.error('[REMINDERS] Error updating reminder status:', error);
    return false;
  }
}

/**
 * Auto-generate reminders for an email
 */
export async function autoGenerateReminders(
  userId: string,
  emailId: string,
  emailSubject: string,
  emailBody: string,
  emailFrom: string
): Promise<Reminder[]> {
  console.log('[REMINDERS] Auto-generating reminders for email:', emailId);

  try {
    // Extract deadlines
    const deadlines = await extractDeadlines(emailSubject, emailBody, emailFrom);

    // Filter high-confidence deadlines
    const highConfidenceDeadlines = deadlines.filter(d => d.confidence >= 0.7);

    console.log('[REMINDERS] Found high-confidence deadlines:', highConfidenceDeadlines.length);

    // Create reminders
    const reminders: Reminder[] = [];
    for (const deadline of highConfidenceDeadlines) {
      const reminder = await createReminder(userId, emailId, deadline, emailSubject, emailFrom);
      reminders.push(reminder);
    }

    return reminders;
  } catch (error) {
    console.error('[REMINDERS] Failed to auto-generate reminders:', error);
    return [];
  }
}

/**
 * Get reminder statistics
 */
export async function getReminderStats(userId: string): Promise<{
  total: number;
  pending: number;
  overdue: number;
  upcoming: number;
  byType: Record<string, number>;
}> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) {
      return { total: 0, pending: 0, overdue: 0, upcoming: 0, byType: {} };
    }

    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: data.length,
      pending: data.filter(r => r.status === 'pending').length,
      overdue: data.filter(r => r.status === 'pending' && new Date(r.reminder_date) < now).length,
      upcoming: data.filter(r => r.status === 'pending' && new Date(r.reminder_date) >= now && new Date(r.reminder_date) <= next7Days).length,
      byType: {} as Record<string, number>
    };

    // Count by type
    data.forEach(r => {
      stats.byType[r.type] = (stats.byType[r.type] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('[REMINDERS] Error getting reminder stats:', error);
    return { total: 0, pending: 0, overdue: 0, upcoming: 0, byType: {} };
  }
}

