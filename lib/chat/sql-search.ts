// SQL-based Email Search for Hybrid Retrieval System
// Provides structured queries for keyword, sender, date, and category searches

import { createServiceClient } from '../supabase/server'

export interface SQLSearchResult {
  id: string
  gmail_message_id: string
  thread_id: string
  sender: string
  recipient: string
  subject: string
  body_text: string
  received_at: string
  category: string | null
  summary: string | null
}

/**
 * Search emails by keyword in subject, sender, or body
 * Uses ILIKE for case-insensitive partial matching
 */
export async function searchByKeyword(
  keyword: string,
  userId: string,
  limit: number = 10
): Promise<SQLSearchResult[]> {
  const supabase = createServiceClient()

  console.log('========== SQL KEYWORD SEARCH ==========')
  console.log('Keyword:', keyword)
  console.log('User:', userId)
  console.log('Limit:', limit)

  try {
    const searchPattern = `%${keyword}%`

    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .or(`subject.ilike.${searchPattern},sender.ilike.${searchPattern},body_text.ilike.${searchPattern}`)
      .order('received_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    console.log('Results:', data?.length ?? 0)
    if (data && data.length > 0) {
      data.forEach((email, index) => {
        console.log(`${index + 1}. ${email.subject} from ${email.sender}`)
      })
    }
    console.log('=======================================')

    return data || []
  } catch (error) {
    console.error('Keyword search error:', error)
    throw error
  }
}

/**
 * Search emails by sender
 * Uses ILIKE for case-insensitive partial matching
 */
export async function searchBySender(
  sender: string,
  userId: string,
  limit: number = 10
): Promise<SQLSearchResult[]> {
  const supabase = createServiceClient()

  console.log('========== SQL SENDER SEARCH ==========')
  console.log('Sender:', sender)
  console.log('User:', userId)
  console.log('Limit:', limit)

  try {
    const searchPattern = `%${sender}%`

    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .ilike('sender', searchPattern)
      .order('received_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    console.log('Results:', data?.length ?? 0)
    if (data && data.length > 0) {
      data.forEach((email, index) => {
        console.log(`${index + 1}. ${email.subject} from ${email.sender}`)
      })
    }
    console.log('======================================')

    return data || []
  } catch (error) {
    console.error('Sender search error:', error)
    throw error
  }
}

/**
 * Get the latest email
 * Ordered by received_at descending
 */
export async function searchLatestEmail(
  userId: string
): Promise<SQLSearchResult[]> {
  const supabase = createServiceClient()

  console.log('========== SQL LATEST EMAIL ==========')
  console.log('User:', userId)

  try {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .order('received_at', { ascending: false })
      .limit(1)

    if (error) throw error

    console.log('Results:', data?.length ?? 0)
    if (data && data.length > 0) {
      console.log(`1. ${data[0].subject} from ${data[0].sender}`)
    }
    console.log('=====================================')

    return data || []
  } catch (error) {
    console.error('Latest email search error:', error)
    throw error
  }
}

/**
 * Search emails by date range
 * Supports today, yesterday, week, month ranges
 */
export async function searchByDate(
  dateRange: 'today' | 'yesterday' | 'week' | 'month',
  userId: string,
  limit: number = 10
): Promise<SQLSearchResult[]> {
  const supabase = createServiceClient()

  console.log('========== SQL DATE SEARCH ==========')
  console.log('Date Range:', dateRange)
  console.log('User:', userId)
  console.log('Limit:', limit)

  try {
    const now = new Date()
    let startDate: Date

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        
        const { data: yesterdayData, error: yesterdayError } = await supabase
          .from('emails')
          .select('*')
          .eq('user_id', userId)
          .gte('received_at', startDate.toISOString())
          .lt('received_at', endOfYesterday.toISOString())
          .order('received_at', { ascending: false })
          .limit(limit)

        if (yesterdayError) throw yesterdayError

        console.log('Results:', yesterdayData?.length ?? 0)
        if (yesterdayData && yesterdayData.length > 0) {
          yesterdayData.forEach((email, index) => {
            console.log(`${index + 1}. ${email.subject} from ${email.sender}`)
          })
        }
        console.log('====================================')

        return yesterdayData || []
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .gte('received_at', startDate.toISOString())
      .order('received_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    console.log('Results:', data?.length ?? 0)
    if (data && data.length > 0) {
      data.forEach((email, index) => {
        console.log(`${index + 1}. ${email.subject} from ${email.sender}`)
      })
    }
    console.log('====================================')

    return data || []
  } catch (error) {
    console.error('Date search error:', error)
    throw error
  }
}

/**
 * Search unread emails
 * Note: Requires is_read field to be added to schema
 * Currently returns all emails as fallback
 */
export async function searchUnread(
  userId: string,
  limit: number = 10
): Promise<SQLSearchResult[]> {
  const supabase = createServiceClient()

  console.log('========== SQL UNREAD SEARCH ==========')
  console.log('User:', userId)
  console.log('Limit:', limit)

  try {
    // Check if is_read column exists
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .order('received_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    console.log('Results:', data?.length ?? 0)
    console.log('Note: is_read field not yet implemented, returning recent emails')
    if (data && data.length > 0) {
      data.forEach((email, index) => {
        console.log(`${index + 1}. ${email.subject} from ${email.sender}`)
      })
    }
    console.log('======================================')

    return data || []
  } catch (error) {
    console.error('Unread search error:', error)
    throw error
  }
}

/**
 * Search emails by category
 * Uses exact match on category field
 */
export async function searchByCategory(
  category: string,
  userId: string,
  limit: number = 10
): Promise<SQLSearchResult[]> {
  const supabase = createServiceClient()

  console.log('========== SQL CATEGORY SEARCH ==========')
  console.log('Category:', category)
  console.log('User:', userId)
  console.log('Limit:', limit)

  try {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .order('received_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    console.log('Results:', data?.length ?? 0)
    if (data && data.length > 0) {
      data.forEach((email, index) => {
        console.log(`${index + 1}. ${email.subject} from ${email.sender}`)
      })
    }
    console.log('========================================')

    return data || []
  } catch (error) {
    console.error('Category search error:', error)
    throw error
  }
}

/**
 * Convert SQL search results to format compatible with RAG results
 * Adds similarity score, chunk_text, and matchType for consistency
 */
export function convertToRAGFormat(
  results: SQLSearchResult[],
  similarity: number = 0.95,
  matchType: 'exact_sender' | 'keyword' | 'date' | 'category' | 'semantic' = 'keyword'
) {
  return results.map((email) => ({
    ...email,
    similarity,
    chunk_text: email.body_text,
    matchType,
  }))
}
