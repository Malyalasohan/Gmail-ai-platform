// AI Recommendation Engine - Phase 5
// Intelligent reasoning over inbox to provide actionable recommendations

import { generateText } from '../ai-provider'
import type { PriorityScore } from './priority-engine'
import type { ExtractedTask } from './task-extractor'
import type { PendingReply } from './reply-detector'

export interface RecommendationRequest {
  question: string
  emails: any[]
  tasks: ExtractedTask[]
  pendingReplies: PendingReply[]
  priorityScores: Map<string, PriorityScore>
}

export interface RecommendationResponse {
  answer: string
  reasoning: string
  recommendations: ActionRecommendation[]
  priorityOrder: string[]
}

export interface ActionRecommendation {
  rank: number
  action: string
  reason: string
  emailId?: string
  estimatedTime: string
  impact: 'high' | 'medium' | 'low'
}

/**
 * Answer complex questions about what the user should do
 */
export async function answerQuestion(
  request: RecommendationRequest
): Promise<RecommendationResponse> {
  console.log('========== RECOMMENDATION ENGINE ==========')
  console.log('Question:', request.question)
  console.log('Emails:', request.emails.length)
  console.log('Tasks:', request.tasks.length)
  console.log('Pending Replies:', request.pendingReplies.length)

  // Build context for AI
  const context = buildRecommendationContext(request)

  // Generate AI response
  const prompt = `You are an executive AI assistant helping a busy professional manage their inbox and tasks.

${context}

USER QUESTION: ${request.question}

RULES:
- Analyze the inbox data comprehensively
- Provide specific, actionable recommendations
- Prioritize based on urgency, importance, and impact
- Consider deadlines, follow-ups, and sender importance
- Be concise but thorough
- Recommend a clear order of actions

Respond in this JSON format:
{
  "answer": "Direct answer to the user's question",
  "reasoning": "Your reasoning process (2-3 sentences)",
  "recommendations": [
    {
      "rank": 1,
      "action": "Reply to John's email about project deadline",
      "reason": "Urgent deadline tomorrow, already 2 follow-ups",
      "emailId": "email-123",
      "estimatedTime": "10 minutes",
      "impact": "high"
    }
  ],
  "priorityOrder": ["email-123", "email-456", "email-789"]
}

Return ONLY valid JSON (no markdown, no explanation).`

  try {
    const response = await generateText(prompt)

    // Clean and parse response
    const cleaned = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    console.log('Recommendations:', parsed.recommendations?.length || 0)
    console.log('===========================================')

    return parsed
  } catch (error) {
    console.error('Recommendation engine error:', error)

    // Fallback response
    return {
      answer: "I couldn't analyze your inbox right now. Please try again.",
      reasoning: 'An error occurred while processing your request.',
      recommendations: [],
      priorityOrder: [],
    }
  }
}

/**
 * Build context string for AI reasoning
 */
function buildRecommendationContext(
  request: RecommendationRequest
): string {
  const sections: string[] = []

  // Inbox overview
  sections.push(`INBOX OVERVIEW:
- Total Emails: ${request.emails.length}
- Unread: ${request.emails.filter((e) => e.is_unread).length}
- Pending Replies: ${request.pendingReplies.length}
- Tasks: ${request.tasks.length}`)

  // High priority emails
  const highPriorityEmails = request.emails
    .filter((e) => {
      const score = request.priorityScores.get(e.id)
      return score && score.urgencyLevel === 'critical'
    })
    .slice(0, 5)

  if (highPriorityEmails.length > 0) {
    sections.push(`\nHIGH PRIORITY EMAILS:`)
    highPriorityEmails.forEach((email, idx) => {
      const score = request.priorityScores.get(email.id)
      sections.push(
        `${idx + 1}. From: ${email.sender} | Subject: ${email.subject} | Priority: ${score?.priority}/100 | Reason: ${score?.reason}`
      )
    })
  }

  // Critical pending replies
  const criticalReplies = request.pendingReplies
    .filter((r) => r.urgency === 'critical' || r.urgency === 'high')
    .slice(0, 5)

  if (criticalReplies.length > 0) {
    sections.push(`\nCRITICAL PENDING REPLIES:`)
    criticalReplies.forEach((reply, idx) => {
      sections.push(
        `${idx + 1}. From: ${reply.sender} | Subject: ${reply.subject} | Reason: ${reply.reason} | Days Pending: ${reply.daysPending}`
      )
    })
  }

  // Urgent tasks
  const urgentTasks = request.tasks
    .filter((t) => {
      if (!t.deadline || t.status !== 'pending') return false
      const deadline = new Date(t.deadline)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return deadline <= tomorrow
    })
    .slice(0, 5)

  if (urgentTasks.length > 0) {
    sections.push(`\nURGENT TASKS:`)
    urgentTasks.forEach((task, idx) => {
      sections.push(
        `${idx + 1}. ${task.title} | Deadline: ${task.deadline} | Category: ${task.category} | Est. Time: ${task.estimatedMinutes} min`
      )
    })
  }

  return sections.join('\n')
}

/**
 * Generate smart focus recommendations
 */
export async function generateFocusRecommendations(data: {
  emails: any[]
  tasks: ExtractedTask[]
  pendingReplies: PendingReply[]
  priorityScores: Map<string, PriorityScore>
  timeAvailable?: number
}): Promise<ActionRecommendation[]> {
  const recommendations: ActionRecommendation[] = []

  // 1. Critical replies (highest priority)
  const criticalReplies = data.pendingReplies.filter(
    (r) => r.urgency === 'critical'
  )
  for (const reply of criticalReplies) {
    recommendations.push({
      rank: recommendations.length + 1,
      action: `Reply to ${reply.sender}: ${reply.subject}`,
      reason: reply.reason,
      emailId: reply.emailId,
      estimatedTime: '10 minutes',
      impact: 'high',
    })
  }

  // 2. Tasks due today
  const tasksToday = data.tasks.filter((t) => {
    if (!t.deadline || t.status !== 'pending') return false
    const deadline = new Date(t.deadline)
    const today = new Date()
    return (
      deadline.getDate() === today.getDate() &&
      deadline.getMonth() === today.getMonth()
    )
  })

  for (const task of tasksToday) {
    recommendations.push({
      rank: recommendations.length + 1,
      action: task.title,
      reason: 'Due today',
      emailId: task.emailSource.id,
      estimatedTime: `${task.estimatedMinutes || 30} minutes`,
      impact: 'high',
    })
  }

  // 3. High priority unread emails
  const highPriorityUnread = data.emails
    .filter((e) => {
      const score = data.priorityScores.get(e.id)
      return (
        e.is_unread &&
        score &&
        (score.urgencyLevel === 'critical' || score.urgencyLevel === 'high')
      )
    })
    .slice(0, 3)

  for (const email of highPriorityUnread) {
    const score = data.priorityScores.get(email.id)
    recommendations.push({
      rank: recommendations.length + 1,
      action: `Review email from ${email.sender}`,
      reason: score?.reason || 'High priority',
      emailId: email.id,
      estimatedTime: '5 minutes',
      impact: 'medium',
    })
  }

  // If time constraint, filter recommendations
  if (data.timeAvailable) {
    return filterByTimeConstraint(recommendations, data.timeAvailable)
  }

  return recommendations.slice(0, 10)
}

/**
 * Filter recommendations by available time
 */
function filterByTimeConstraint(
  recommendations: ActionRecommendation[],
  minutesAvailable: number
): ActionRecommendation[] {
  const filtered: ActionRecommendation[] = []
  let timeUsed = 0

  for (const rec of recommendations) {
    const timeNeeded = parseEstimatedTime(rec.estimatedTime)
    if (timeUsed + timeNeeded <= minutesAvailable) {
      filtered.push(rec)
      timeUsed += timeNeeded
    }
  }

  return filtered
}

/**
 * Parse estimated time string to minutes
 */
function parseEstimatedTime(timeStr: string): number {
  const match = timeStr.match(/(\d+)/)
  return match ? parseInt(match[1]) : 15
}
