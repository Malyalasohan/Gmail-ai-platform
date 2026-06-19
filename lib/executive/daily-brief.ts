// Daily Brief Generator - Phase 5
// Generates comprehensive daily summaries and recommendations

import { generateText } from '../ai-provider'
import type { PriorityScore } from './priority-engine'
import type { ExtractedTask } from './task-extractor'
import type { PendingReply } from './reply-detector'
import type { SmartCategory } from './categories'

export interface DailyBrief {
  generatedAt: string
  summary: string
  inboxHealth: InboxHealth
  highPriority: BriefSection
  urgentDeadlines: BriefSection
  pendingReplies: BriefSection
  upcomingInterviews: BriefSection
  meetings: BriefSection
  invoices: BriefSection
  recommendations: Recommendation[]
  estimatedWorkTime: number
}

export interface InboxHealth {
  totalEmails: number
  unread: number
  urgent: number
  needReply: number
  healthScore: number // 0-100
  healthStatus: 'excellent' | 'good' | 'needs-attention' | 'critical'
}

export interface BriefSection {
  count: number
  items: BriefItem[]
  summary: string
}

export interface BriefItem {
  id: string
  title: string
  subtitle: string
  timestamp: string
  priority: number
  action?: string
}

export interface Recommendation {
  priority: number
  action: string
  reason: string
  estimatedMinutes: number
  relatedEmailId?: string
}

/**
 * Generate a comprehensive daily brief
 */
export async function generateDailyBrief(data: {
  emails: Array<{
    id: string
    sender: string
    subject: string
    body_text: string
    received_at: string
    is_unread?: boolean
    category?: string
    priorityScore?: PriorityScore
  }>
  tasks: ExtractedTask[]
  pendingReplies: PendingReply[]
  categories: Map<string, any[]>
}): Promise<DailyBrief> {
  console.log('========== DAILY BRIEF GENERATION ==========')
  console.log('Emails:', data.emails.length)
  console.log('Tasks:', data.tasks.length)
  console.log('Pending Replies:', data.pendingReplies.length)

  // Calculate inbox health
  const inboxHealth = calculateInboxHealth(
    data.emails,
    data.pendingReplies.length
  )

  // Extract high priority emails
  const highPriority = extractHighPrioritySection(data.emails)

  // Extract urgent deadlines
  const urgentDeadlines = extractUrgentDeadlines(data.tasks)

  // Format pending replies
  const pendingRepliesSection = formatPendingReplies(data.pendingReplies)

  // Extract interviews
  const upcomingInterviews = extractInterviews(data.emails, data.categories)

  // Extract meetings
  const meetings = extractMeetings(data.emails)

  // Extract invoices
  const invoices = extractInvoices(data.emails, data.categories)

  // Generate AI recommendations
  const recommendations = await generateRecommendations({
    emails: data.emails,
    tasks: data.tasks,
    pendingReplies: data.pendingReplies,
    inboxHealth,
  })

  // Calculate total estimated work time
  const estimatedWorkTime = calculateEstimatedWorkTime(
    data.tasks,
    recommendations
  )

  // Generate executive summary
  const summary = await generateExecutiveSummary({
    inboxHealth,
    highPriority: highPriority.count,
    urgentDeadlines: urgentDeadlines.count,
    pendingReplies: pendingRepliesSection.count,
    interviews: upcomingInterviews.count,
    meetings: meetings.count,
    invoices: invoices.count,
    estimatedWorkTime,
  })

  console.log('Health Score:', inboxHealth.healthScore)
  console.log('High Priority:', highPriority.count)
  console.log('Urgent Deadlines:', urgentDeadlines.count)
  console.log('Pending Replies:', pendingRepliesSection.count)
  console.log('Recommendations:', recommendations.length)
  console.log('===========================================')

  return {
    generatedAt: new Date().toISOString(),
    summary,
    inboxHealth,
    highPriority,
    urgentDeadlines,
    pendingReplies: pendingRepliesSection,
    upcomingInterviews,
    meetings,
    invoices,
    recommendations,
    estimatedWorkTime,
  }
}

/**
 * Calculate inbox health metrics
 */
function calculateInboxHealth(
  emails: any[],
  needReplyCount: number
): InboxHealth {
  const totalEmails = emails.length
  const unread = emails.filter((e) => e.is_unread).length
  const urgent = emails.filter(
    (e) => e.priorityScore && e.priorityScore.urgencyLevel === 'critical'
  ).length

  // Health score formula
  let healthScore = 100

  // Penalty for unread emails
  healthScore -= Math.min(30, unread * 2)

  // Penalty for urgent emails
  healthScore -= Math.min(20, urgent * 5)

  // Penalty for pending replies
  healthScore -= Math.min(25, needReplyCount * 3)

  // Bonus for low inbox count
  if (totalEmails < 50) healthScore += 10

  healthScore = Math.max(0, Math.min(100, healthScore))

  let healthStatus: InboxHealth['healthStatus'] = 'excellent'
  if (healthScore < 70) healthStatus = 'good'
  if (healthScore < 50) healthStatus = 'needs-attention'
  if (healthScore < 30) healthStatus = 'critical'

  return {
    totalEmails,
    unread,
    urgent,
    needReply: needReplyCount,
    healthScore,
    healthStatus,
  }
}

/**
 * Extract high priority section
 */
function extractHighPrioritySection(emails: any[]): BriefSection {
  const highPriorityEmails = emails
    .filter(
      (e) =>
        e.priorityScore &&
        (e.priorityScore.urgencyLevel === 'critical' ||
          e.priorityScore.urgencyLevel === 'high')
    )
    .sort((a, b) => b.priorityScore.priority - a.priorityScore.priority)
    .slice(0, 5)

  const items: BriefItem[] = highPriorityEmails.map((e) => ({
    id: e.id,
    title: e.subject,
    subtitle: `From ${e.sender}`,
    timestamp: e.received_at,
    priority: e.priorityScore.priority,
    action: e.priorityScore.reason,
  }))

  return {
    count: highPriorityEmails.length,
    items,
    summary:
      items.length > 0
        ? `${items.length} high priority emails require attention`
        : 'No high priority emails',
  }
}

/**
 * Extract urgent deadlines section
 */
function extractUrgentDeadlines(tasks: ExtractedTask[]): BriefSection {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const urgentTasks = tasks
    .filter((t) => {
      if (!t.deadline || t.status !== 'pending') return false
      const deadline = new Date(t.deadline)
      return deadline <= tomorrow
    })
    .sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
    )

  const items: BriefItem[] = urgentTasks.map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: t.description || `From ${t.emailSource.sender}`,
    timestamp: t.deadline!,
    priority: t.priority,
    action: `Due ${formatDeadline(t.deadline!)}`,
  }))

  return {
    count: urgentTasks.length,
    items,
    summary:
      items.length > 0
        ? `${items.length} tasks due today or tomorrow`
        : 'No urgent deadlines',
  }
}

/**
 * Format pending replies section
 */
function formatPendingReplies(pendingReplies: PendingReply[]): BriefSection {
  const urgent = pendingReplies
    .filter(
      (r) => r.urgency === 'critical' || r.urgency === 'high'
    )
    .slice(0, 5)

  const items: BriefItem[] = urgent.map((r) => ({
    id: r.emailId,
    title: r.subject,
    subtitle: `From ${r.sender}`,
    timestamp: r.receivedAt,
    priority: r.urgency === 'critical' ? 95 : 75,
    action: r.reason,
  }))

  return {
    count: pendingReplies.length,
    items,
    summary:
      items.length > 0
        ? `${pendingReplies.length} emails awaiting your reply`
        : 'No pending replies',
  }
}

/**
 * Extract interviews section
 */
function extractInterviews(
  emails: any[],
  categories: Map<string, any[]>
): BriefSection {
  const interviewEmails = emails.filter((e) => {
    const text = `${e.subject} ${e.body_text}`.toLowerCase()
    return (
      text.includes('interview') ||
      text.includes('screening') ||
      e.category === 'interview'
    )
  })

  const items: BriefItem[] = interviewEmails.slice(0, 5).map((e) => ({
    id: e.id,
    title: e.subject,
    subtitle: `From ${e.sender}`,
    timestamp: e.received_at,
    priority: e.priorityScore?.priority || 80,
    action: 'Interview invitation',
  }))

  return {
    count: interviewEmails.length,
    items,
    summary:
      items.length > 0
        ? `${items.length} interview-related emails`
        : 'No upcoming interviews',
  }
}

/**
 * Extract meetings section
 */
function extractMeetings(emails: any[]): BriefSection {
  const meetingEmails = emails.filter((e) => {
    const text = `${e.subject} ${e.body_text}`.toLowerCase()
    return (
      text.includes('meeting') ||
      text.includes('zoom') ||
      text.includes('google meet') ||
      text.includes('calendar invite')
    )
  })

  const items: BriefItem[] = meetingEmails.slice(0, 5).map((e) => ({
    id: e.id,
    title: e.subject,
    subtitle: `From ${e.sender}`,
    timestamp: e.received_at,
    priority: e.priorityScore?.priority || 70,
    action: 'Meeting scheduled',
  }))

  return {
    count: meetingEmails.length,
    items,
    summary:
      items.length > 0
        ? `${items.length} meetings scheduled`
        : 'No upcoming meetings',
  }
}

/**
 * Extract invoices section
 */
function extractInvoices(
  emails: any[],
  categories: Map<string, any[]>
): BriefSection {
  const invoiceEmails = emails.filter((e) => {
    const text = `${e.subject} ${e.body_text}`.toLowerCase()
    return (
      text.includes('invoice') ||
      text.includes('bill') ||
      text.includes('payment') ||
      e.category === 'finance'
    )
  })

  const items: BriefItem[] = invoiceEmails.slice(0, 5).map((e) => ({
    id: e.id,
    title: e.subject,
    subtitle: `From ${e.sender}`,
    timestamp: e.received_at,
    priority: e.priorityScore?.priority || 65,
    action: 'Payment due',
  }))

  return {
    count: invoiceEmails.length,
    items,
    summary:
      items.length > 0
        ? `${items.length} invoices or bills`
        : 'No pending invoices',
  }
}

/**
 * Generate AI-powered recommendations
 */
async function generateRecommendations(data: {
  emails: any[]
  tasks: ExtractedTask[]
  pendingReplies: PendingReply[]
  inboxHealth: InboxHealth
}): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = []

  // Priority 1: Critical pending replies
  const criticalReplies = data.pendingReplies.filter(
    (r) => r.urgency === 'critical'
  )
  for (const reply of criticalReplies.slice(0, 2)) {
    recommendations.push({
      priority: 1,
      action: `Reply to ${reply.sender}`,
      reason: reply.reason,
      estimatedMinutes: 10,
      relatedEmailId: reply.emailId,
    })
  }

  // Priority 2: Tasks due today
  const tasksToday = data.tasks.filter((t) => {
    if (!t.deadline || t.status !== 'pending') return false
    const deadline = new Date(t.deadline)
    const today = new Date()
    return (
      deadline.getDate() === today.getDate() &&
      deadline.getMonth() === today.getMonth() &&
      deadline.getFullYear() === today.getFullYear()
    )
  })

  for (const task of tasksToday.slice(0, 3)) {
    recommendations.push({
      priority: 2,
      action: task.title,
      reason: `Due today`,
      estimatedMinutes: task.estimatedMinutes || 30,
      relatedEmailId: task.emailSource.id,
    })
  }

  // Priority 3: High priority emails
  const highPriorityEmails = data.emails
    .filter(
      (e) =>
        e.priorityScore && e.priorityScore.urgencyLevel === 'high'
    )
    .slice(0, 2)

  for (const email of highPriorityEmails) {
    recommendations.push({
      priority: 3,
      action: `Review email from ${email.sender}`,
      reason: email.priorityScore.reason,
      estimatedMinutes: 5,
      relatedEmailId: email.id,
    })
  }

  // Sort by priority
  recommendations.sort((a, b) => a.priority - b.priority)

  return recommendations.slice(0, 10)
}

/**
 * Calculate total estimated work time
 */
function calculateEstimatedWorkTime(
  tasks: ExtractedTask[],
  recommendations: Recommendation[]
): number {
  const taskTime = tasks
    .filter((t) => t.status === 'pending')
    .reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0)

  const recommendationTime = recommendations.reduce(
    (sum, r) => sum + r.estimatedMinutes,
    0
  )

  return Math.min(taskTime, recommendationTime)
}

/**
 * Generate executive summary using AI
 */
async function generateExecutiveSummary(stats: {
  inboxHealth: InboxHealth
  highPriority: number
  urgentDeadlines: number
  pendingReplies: number
  interviews: number
  meetings: number
  invoices: number
  estimatedWorkTime: number
}): Promise<string> {
  const prompt = `You are an executive AI assistant. Generate a brief, professional summary of today's email situation.

Inbox Stats:
- Health Score: ${stats.inboxHealth.healthScore}/100 (${stats.inboxHealth.healthStatus})
- Total Emails: ${stats.inboxHealth.totalEmails}
- Unread: ${stats.inboxHealth.unread}
- Urgent: ${stats.inboxHealth.urgent}
- High Priority: ${stats.highPriority}
- Urgent Deadlines: ${stats.urgentDeadlines}
- Pending Replies: ${stats.pendingReplies}
- Interviews: ${stats.interviews}
- Meetings: ${stats.meetings}
- Invoices: ${stats.invoices}
- Estimated Work Time: ${stats.estimatedWorkTime} minutes

Write a 2-3 sentence summary that:
1. States the inbox health status
2. Highlights the most important items requiring attention
3. Provides a brief recommendation

Be concise, professional, and actionable.`

  return await generateText(prompt)
}

/**
 * Format deadline as human-readable string
 */
function formatDeadline(deadline: string): string {
  const now = new Date()
  const due = new Date(deadline)
  const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (diffHours < 0) return 'Overdue'
  if (diffHours < 1) return 'Due in less than 1 hour'
  if (diffHours < 24) return `Due in ${Math.floor(diffHours)} hours`
  if (diffHours < 48) return 'Due tomorrow'

  const diffDays = Math.floor(diffHours / 24)
  return `Due in ${diffDays} days`
}
