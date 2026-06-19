// Pending Reply Detection - Phase 5
// Detects emails that need replies based on conversation analysis

import { createServiceClient } from '../supabase/server'

export interface PendingReply {
  emailId: string
  threadId: string
  sender: string
  subject: string
  receivedAt: string
  daysPending: number
  reason: string
  urgency: 'critical' | 'high' | 'medium' | 'low'
  hasFollowUp: boolean
  followUpCount: number
  category?: string
}

export interface ReplyAnalysis {
  needsReply: PendingReply[]
  totalConversations: number
  avgResponseTime: number
}

/**
 * Detect emails that need replies for a user
 */
export async function detectPendingReplies(
  userId: string
): Promise<ReplyAnalysis> {
  console.log('========== REPLY DETECTION ==========')
  console.log('User:', userId)

  const supabase = createServiceClient()

  // Get all emails grouped by thread
  const { data: emails, error } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })

  if (error || !emails) {
    console.error('Reply detection error:', error)
    return {
      needsReply: [],
      totalConversations: 0,
      avgResponseTime: 0,
    }
  }

  // Group emails by thread
  const threads = new Map<string, any[]>()
  for (const email of emails) {
    if (!threads.has(email.thread_id)) {
      threads.set(email.thread_id, [])
    }
    threads.get(email.thread_id)!.push(email)
  }

  console.log('Total Threads:', threads.size)

  const pendingReplies: PendingReply[] = []

  // Analyze each thread
  for (const [threadId, threadEmails] of threads.entries()) {
    // Sort by date
    threadEmails.sort(
      (a, b) =>
        new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
    )

    const analysis = analyzeThread(threadEmails, userId)

    if (analysis) {
      pendingReplies.push(analysis)
    }
  }

  // Sort by urgency and days pending
  pendingReplies.sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    }
    return b.daysPending - a.daysPending
  })

  console.log('Pending Replies:', pendingReplies.length)
  console.log('Critical:', pendingReplies.filter((r) => r.urgency === 'critical').length)
  console.log('High:', pendingReplies.filter((r) => r.urgency === 'high').length)
  console.log('====================================')

  return {
    needsReply: pendingReplies,
    totalConversations: threads.size,
    avgResponseTime: calculateAvgResponseTime(Array.from(threads.values())),
  }
}

/**
 * Analyze a single thread to determine if it needs a reply
 */
function analyzeThread(
  threadEmails: any[],
  userId: string
): PendingReply | null {
  if (threadEmails.length === 0) return null

  // Get the last email in thread
  const lastEmail = threadEmails[threadEmails.length - 1]

  // Skip if last email is from user (already replied)
  // Note: We'd need user's email to properly detect this
  // For now, assume emails in 'sent' category are from user
  if (lastEmail.category === 'sent') {
    return null
  }

  // Check if it's a conversation (more than 1 email)
  const isConversation = threadEmails.length > 1

  // Count follow-ups from same sender
  const lastSender = lastEmail.sender
  const followUps = threadEmails.filter(
    (e) => e.sender === lastSender && e.id !== lastEmail.id
  )

  // Calculate days pending
  const now = new Date()
  const received = new Date(lastEmail.received_at)
  const daysPending = Math.floor(
    (now.getTime() - received.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Skip if very old (>30 days) and no follow-ups
  if (daysPending > 30 && followUps.length === 0) {
    return null
  }

  // Determine urgency and reason
  const { urgency, reason } = determineReplyUrgency(
    lastEmail,
    daysPending,
    followUps.length,
    isConversation
  )

  return {
    emailId: lastEmail.id,
    threadId: lastEmail.thread_id,
    sender: lastEmail.sender,
    subject: lastEmail.subject,
    receivedAt: lastEmail.received_at,
    daysPending,
    reason,
    urgency,
    hasFollowUp: followUps.length > 0,
    followUpCount: followUps.length,
    category: lastEmail.category,
  }
}

/**
 * Determine urgency of a pending reply
 */
function determineReplyUrgency(
  email: any,
  daysPending: number,
  followUpCount: number,
  isConversation: boolean
): { urgency: 'critical' | 'high' | 'medium' | 'low'; reason: string } {
  const subject = email.subject?.toLowerCase() || ''
  const body = email.body_text?.toLowerCase() || ''
  const text = `${subject} ${body}`

  const reasons: string[] = []

  // Critical indicators
  if (
    text.includes('interview') &&
    (text.includes('tomorrow') || text.includes('today'))
  ) {
    reasons.push('Interview confirmation required')
    return { urgency: 'critical', reason: reasons.join(', ') }
  }

  if (followUpCount >= 3) {
    reasons.push(`${followUpCount} follow-ups`)
    return { urgency: 'critical', reason: reasons.join(', ') }
  }

  if (
    text.includes('urgent') ||
    text.includes('asap') ||
    text.includes('immediately')
  ) {
    reasons.push('Marked as urgent')
    return { urgency: 'critical', reason: reasons.join(', ') }
  }

  // High priority indicators
  if (text.includes('interview') || text.includes('screening')) {
    reasons.push('Interview invitation')
  }

  if (text.includes('recruiter') || text.includes('hiring')) {
    reasons.push('Recruiter contact')
  }

  if (followUpCount >= 2) {
    reasons.push(`${followUpCount} follow-ups`)
  }

  if (daysPending >= 7) {
    reasons.push(`Pending ${daysPending} days`)
  }

  if (reasons.length > 0) {
    return { urgency: 'high', reason: reasons.join(', ') }
  }

  // Medium priority
  if (isConversation) {
    reasons.push('Active conversation')
  }

  if (followUpCount >= 1) {
    reasons.push('Has follow-up')
  }

  if (daysPending >= 3) {
    reasons.push(`Pending ${daysPending} days`)
  }

  if (reasons.length > 0) {
    return { urgency: 'medium', reason: reasons.join(', ') }
  }

  // Low priority
  return {
    urgency: 'low',
    reason: `Pending ${daysPending} days`,
  }
}

/**
 * Calculate average response time across all threads
 */
function calculateAvgResponseTime(threads: any[][]): number {
  let totalTime = 0
  let count = 0

  for (const thread of threads) {
    if (thread.length < 2) continue

    for (let i = 1; i < thread.length; i++) {
      const prev = new Date(thread[i - 1].received_at)
      const curr = new Date(thread[i].received_at)
      const hours = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60)

      if (hours > 0 && hours < 168) {
        // Exclude >1 week gaps
        totalTime += hours
        count++
      }
    }
  }

  return count > 0 ? totalTime / count : 0
}

/**
 * Get critical pending replies (need immediate attention)
 */
export function getCriticalPendingReplies(
  analysis: ReplyAnalysis
): PendingReply[] {
  return analysis.needsReply.filter((r) => r.urgency === 'critical')
}

/**
 * Get pending replies by category
 */
export function groupPendingRepliesByCategory(
  analysis: ReplyAnalysis
): Map<string, PendingReply[]> {
  const grouped = new Map<string, PendingReply[]>()

  for (const reply of analysis.needsReply) {
    const category = reply.category || 'uncategorized'
    if (!grouped.has(category)) {
      grouped.set(category, [])
    }
    grouped.get(category)!.push(reply)
  }

  return grouped
}
