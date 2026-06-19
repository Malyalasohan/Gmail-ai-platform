// Gmail Action History — Phase 4
import { createServiceClient } from '@/lib/supabase/server'

export interface ActionHistoryEntry {
  id?: string
  user_id: string
  action: string
  email_ids: string[]
  thread_ids: string[]
  status: 'success' | 'failure' | 'cancelled'
  metadata?: Record<string, any>
  created_at?: string
}

/**
 * Save action to history (gracefully fails if table doesn't exist)
 */
export async function saveActionHistory(
  entry: ActionHistoryEntry
): Promise<void> {
  const supabase = createServiceClient()

  try {
    const { error } = await supabase
      .from('action_history')
      .insert({
        user_id: entry.user_id,
        action: entry.action,
        email_ids: entry.email_ids,
        thread_ids: entry.thread_ids,
        status: entry.status,
        metadata: entry.metadata || {},
      })

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('⚠️ action_history table does not exist - skipping history save')
        return
      }
      console.error('Failed to save action history:', error)
    }
  } catch (error: any) {
    // Gracefully handle missing table
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('⚠️ action_history table does not exist - skipping history save')
      return
    }
    console.error('Action history error:', error)
  }
}

/**
 * Get recent action history for user (gracefully fails if table doesn't exist)
 */
export async function getActionHistory(
  userId: string,
  limit: number = 50
): Promise<ActionHistoryEntry[]> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('action_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('⚠️ action_history table does not exist - returning empty history')
        return []
      }
      console.error('Failed to get action history:', error)
      return []
    }

    return data || []
  } catch (error: any) {
    // Gracefully handle missing table
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('⚠️ action_history table does not exist - returning empty history')
      return []
    }
    console.error('Get action history error:', error)
    return []
  }
}
