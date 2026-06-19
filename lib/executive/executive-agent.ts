// Executive AI Agent - Phase 5
// Main orchestrator for all executive assistant features

import { createServiceClient } from '../supabase/server'
import {
  calculateBatchPriorityScores,
  explainPriority,
  type EmailForPriority,
  type PriorityScore,
} from './priority-engine'
import {
  extractTasksFromEmails,
  sortTasksByUrgency,
  type ExtractedTask,
} from './task-extractor'
import { detectPendingReplies, type PendingReply } from './reply-detector'
import { generateDailyBrief, type DailyBrief } from './daily-brief'
import {
  categorizeEmails,
  groupByCategory,
  type SmartCategory,
} from './categories'
import {
  answerQuestion,
  generateFocusRecommendations,
  type RecommendationRequest,
  type RecommendationResponse,
} from './recommendation-engine'
import {
  generateTimelines,
  getThreadsWaitingForUser,
  type EmailTimeline,
} from './timeline'

export interface ExecutiveAnalysis {
  userId: string
  generatedAt: string
  priorityScores: Map<string, PriorityScore>
  tasks: ExtractedTask[]
  pendingReplies: PendingReply[]
  categories: Map<string, SmartCategory>
  timelines: Map<string, EmailTimeline>
  dailyBrief?: DailyBrief
}

/**
 * Analyze user's entire inbox and generate executive intelligence
 */
export async function analyzeInbox(
  userId: string,
  options?: {
    includeDailyBrief?: boolean
    emailLimit?: number
  }
): Promise<ExecutiveAnalysis> {
  console.log('========== EXECUTIVE ANALYSIS ==========')
  console.log('User:', userId)
  console.log('Options:', options)
  console.log('========================================')

  const supabase = createServiceClient()

  // Fetch emails
  const { data: emails, error } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(options?.emailLimit || 100)

  if (error || !emails) {
    throw new Error('Failed to fetch emails')
  }

  console.log('Emails Fetched:', emails.length)

  // 1. Calculate priority scores
  const emailsForPriority: EmailForPriority[] = emails.map((e) => ({
    id: e.id,
    sender: e.sender,
    subject: e.subject,
    body_text: e.body_text,
    received_at: e.received_at,
    is_unread: e.is_unread,
    is_starred: e.is_starred,
    category: e.category,
    thread_id: e.thread_id,
  }))

  const priorityScores = await calculateBatchPriorityScores(
    emailsForPriority
  )

  // 2. Detect pending replies
  const replyAnalysis = await detectPendingReplies(userId)

  // 3. Categorize emails
  const categories = categorizeEmails(
    emails.map((e) => ({
      id: e.id,
      sender: e.sender,
      subject: e.subject,
      body_text: e.body_text,
    }))
  )

  const groupedByCategory = groupByCategory(emails, categories)

  // 4. Extract tasks from high-priority emails
  const highPriorityEmails = emails
    .filter((e) => {
      const score = priorityScores.get(e.id)
      return score && score.priority >= 50
    })
    .map((e) => ({
      id: e.id,
      sender: e.sender,
      subject: e.subject,
      body_text: e.body_text,
      received_at: e.received_at,
      priority: priorityScores.get(e.id)?.priority || 50,
    }))

  const taskExtraction = await extractTasksFromEmails(
    highPriorityEmails.slice(0, 20)
  ) // Limit to top 20 for performance

  const sortedTasks = sortTasksByUrgency(taskExtraction.tasks)

  // 5. Generate timelines
  const timelines = await generateTimelines(
    emails.map((e) => ({
      id: e.id,
      sender: e.sender,
      recipient: e.recipient,
      subject: e.subject,
      received_at: e.received_at,
      thread_id: e.thread_id,
    }))
  )

  // 6. Generate daily brief (optional)
  let dailyBrief: DailyBrief | undefined

  if (options?.includeDailyBrief) {
    const emailsWithScores = emails.map((e) => ({
      ...e,
      priorityScore: priorityScores.get(e.id),
    }))

    dailyBrief = await generateDailyBrief({
      emails: emailsWithScores,
      tasks: sortedTasks,
      pendingReplies: replyAnalysis.needsReply,
      categories: groupedByCategory,
    })
  }

  console.log('========== ANALYSIS COMPLETE ==========')
  console.log('Priority Scores:', priorityScores.size)
  console.log('Tasks Extracted:', sortedTasks.length)
  console.log('Pending Replies:', replyAnalysis.needsReply.length)
  console.log('Categories:', categories.size)
  console.log('Timelines:', timelines.size)
  console.log('========================================')

  return {
    userId,
    generatedAt: new Date().toISOString(),
    priorityScores,
    tasks: sortedTasks,
    pendingReplies: replyAnalysis.needsReply,
    categories,
    timelines,
    dailyBrief,
  }
}

/**
 * Get today's executive report
 */
export async function getTodayReport(userId: string): Promise<DailyBrief> {
  const analysis = await analyzeInbox(userId, {
    includeDailyBrief: true,
    emailLimit: 100,
  })

  if (!analysis.dailyBrief) {
    throw new Error('Failed to generate daily brief')
  }

  return analysis.dailyBrief
}

/**
 * Answer executive questions about the inbox
 */
export async function answerExecutiveQuestion(
  userId: string,
  question: string
): Promise<RecommendationResponse> {
  const analysis = await analyzeInbox(userId, { emailLimit: 100 })

  const supabase = createServiceClient()
  const { data: emails } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(100)

  const request: RecommendationRequest = {
    question,
    emails: emails || [],
    tasks: analysis.tasks,
    pendingReplies: analysis.pendingReplies,
    priorityScores: analysis.priorityScores,
  }

  return await answerQuestion(request)
}

/**
 * Get high-priority emails
 */
export async function getHighPriorityEmails(
  userId: string,
  minPriority: number = 70
): Promise<
  Array<{
    email: any
    priorityScore: PriorityScore
  }>
> {
  const analysis = await analyzeInbox(userId, { emailLimit: 100 })

  const supabase = createServiceClient()
  const { data: emails } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(100)

  if (!emails) return []

  const highPriority = emails
    .map((email) => ({
      email,
      priorityScore: analysis.priorityScores.get(email.id),
    }))
    .filter((item) => item.priorityScore && item.priorityScore.priority >= minPriority)
    .sort((a, b) => b.priorityScore!.priority - a.priorityScore!.priority)

  return highPriority as Array<{ email: any; priorityScore: PriorityScore }>
}

/**
 * Get pending tasks
 */
export async function getPendingTasks(
  userId: string
): Promise<ExtractedTask[]> {
  const analysis = await analyzeInbox(userId, { emailLimit: 50 })
  return analysis.tasks.filter((t) => t.status === 'pending')
}

/**
 * Explain why an email is prioritized
 */
export async function explainEmailPriority(
  userId: string,
  emailId: string
): Promise<string> {
  const supabase = createServiceClient()

  const { data: email, error } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('id', emailId)
    .single()

  if (error || !email) {
    throw new Error('Email not found')
  }

  const emailForPriority: EmailForPriority = {
    id: email.id,
    sender: email.sender,
    subject: email.subject,
    body_text: email.body_text,
    received_at: email.received_at,
    is_unread: email.is_unread,
    is_starred: email.is_starred,
    category: email.category,
    thread_id: email.thread_id,
  }

  const scores = await calculateBatchPriorityScores([emailForPriority])
  const score = scores.get(emailId)

  if (!score) {
    throw new Error('Failed to calculate priority score')
  }

  return await explainPriority(emailForPriority, score)
}

/**
 * Get email timeline
 */
export async function getEmailTimeline(
  userId: string,
  threadId: string,
  userEmail?: string
): Promise<EmailTimeline> {
  const supabase = createServiceClient()

  const { data: emails, error } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('thread_id', threadId)
    .order('received_at', { ascending: true })

  if (error || !emails) {
    throw new Error('Thread not found')
  }

  const timelines = await generateTimelines(
    emails.map((e) => ({
      id: e.id,
      sender: e.sender,
      recipient: e.recipient,
      subject: e.subject,
      received_at: e.received_at,
      thread_id: e.thread_id,
    })),
    userEmail
  )

  const timeline = timelines.get(threadId)

  if (!timeline) {
    throw new Error('Failed to generate timeline')
  }

  return timeline
}

/**
 * Get smart focus recommendations
 */
export async function getSmartFocus(
  userId: string,
  timeAvailable?: number
): Promise<any> {
  const analysis = await analyzeInbox(userId, { emailLimit: 100 })

  const supabase = createServiceClient()
  const { data: emails } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(100)

  const recommendations = await generateFocusRecommendations({
    emails: emails || [],
    tasks: analysis.tasks,
    pendingReplies: analysis.pendingReplies,
    priorityScores: analysis.priorityScores,
    timeAvailable,
  })

  return {
    recommendations,
    summary: `Based on your inbox analysis, here are your top ${recommendations.length} priorities.`,
    estimatedTime: recommendations.reduce(
      (sum, r) => sum + parseInt(r.estimatedTime),
      0
    ),
  }
}
