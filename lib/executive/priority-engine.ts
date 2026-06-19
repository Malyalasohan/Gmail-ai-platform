// Priority Scoring Engine - Phase 5
// Analyzes emails and assigns priority scores (0-100) based on multiple factors

import { generateText } from '../ai-provider'

export interface PriorityScore {
  priority: number // 0-100
  reason: string
  factors: PriorityFactors
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low'
}

export interface PriorityFactors {
  senderImportance: number // 0-25
  urgencyWords: number // 0-20
  hasDeadline: number // 0-15
  isInterview: number // 0-15
  isInvoice: number // 0-10
  hasCalendarEvent: number // 0-10
  isFollowUp: number // 0-15
  isUnread: number // 0-5
  isStarred: number // 0-5
  userInteraction: number // 0-10
  recency: number // 0-10
}

export interface EmailForPriority {
  id: string
  sender: string
  subject: string
  body_text: string
  received_at: string
  is_unread?: boolean
  is_starred?: boolean
  category?: string | null
  thread_id: string
}

const URGENCY_KEYWORDS = [
  'urgent',
  'asap',
  'immediately',
  'critical',
  'emergency',
  'deadline',
  'today',
  'tomorrow',
  'tonight',
  'right now',
  'time-sensitive',
  'breaking',
  'important',
]

const DEADLINE_PATTERNS = [
  /due\s+(today|tomorrow|this\s+week)/i,
  /deadline\s+(is|:)/i,
  /by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /before\s+\d{1,2}\/\d{1,2}/i,
  /submit\s+by/i,
  /expires?\s+(on|in)/i,
]

const INTERVIEW_KEYWORDS = [
  'interview',
  'interviewing',
  'meet with',
  'screening call',
  'technical interview',
  'phone screen',
  'onsite',
  'assessment',
  'coding challenge',
]

const INVOICE_KEYWORDS = [
  'invoice',
  'bill',
  'payment',
  'overdue',
  'balance due',
  'statement',
  'receipt',
  'charge',
  'subscription',
]

const IMPORTANT_SENDERS = [
  'recruiter',
  'hiring',
  'hr@',
  'jobs@',
  'careers@',
  'noreply@linkedin',
  'indeed',
  'glassdoor',
  'professor',
  'dean',
  'registrar',
  'bursar',
  'financial aid',
]

/**
 * Calculate priority score for a single email
 */
export async function calculatePriorityScore(
  email: EmailForPriority,
  userInteractionHistory?: Map<string, number>
): Promise<PriorityScore> {
  const factors: PriorityFactors = {
    senderImportance: 0,
    urgencyWords: 0,
    hasDeadline: 0,
    isInterview: 0,
    isInvoice: 0,
    hasCalendarEvent: 0,
    isFollowUp: 0,
    isUnread: 0,
    isStarred: 0,
    userInteraction: 0,
    recency: 0,
  }

  const textToAnalyze = `${email.subject} ${email.body_text}`.toLowerCase()

  // 1. Sender Importance (0-25)
  factors.senderImportance = calculateSenderImportance(email.sender)

  // 2. Urgency Words (0-20)
  factors.urgencyWords = calculateUrgencyScore(textToAnalyze)

  // 3. Deadline Detection (0-15)
  factors.hasDeadline = detectDeadline(textToAnalyze)

  // 4. Interview Detection (0-15)
  factors.isInterview = detectInterview(textToAnalyze)

  // 5. Invoice Detection (0-10)
  factors.isInvoice = detectInvoice(textToAnalyze)

  // 6. Calendar Event (0-10)
  factors.hasCalendarEvent = detectCalendarEvent(textToAnalyze)

  // 7. Follow-up Detection (0-15)
  factors.isFollowUp = detectFollowUp(email.subject, email.body_text)

  // 8. Unread Status (0-5)
  factors.isUnread = email.is_unread ? 5 : 0

  // 9. Starred Status (0-5)
  factors.isStarred = email.is_starred ? 5 : 0

  // 10. User Interaction History (0-10)
  if (userInteractionHistory) {
    const interactionCount = userInteractionHistory.get(email.sender) || 0
    factors.userInteraction = Math.min(10, interactionCount * 2)
  }

  // 11. Recency (0-10)
  factors.recency = calculateRecencyScore(email.received_at)

  // Calculate total priority
  const priority = Object.values(factors).reduce((sum, val) => sum + val, 0)

  // Determine urgency level
  const urgencyLevel = getUrgencyLevel(priority)

  // Generate human-readable reason
  const reason = generatePriorityReason(factors, email)

  return {
    priority: Math.min(100, priority),
    reason,
    factors,
    urgencyLevel,
  }
}

/**
 * Batch calculate priority scores for multiple emails
 */
export async function calculateBatchPriorityScores(
  emails: EmailForPriority[],
  userInteractionHistory?: Map<string, number>
): Promise<Map<string, PriorityScore>> {
  console.log('========== PRIORITY ENGINE ==========')
  console.log('Analyzing Emails:', emails.length)

  const scores = new Map<string, PriorityScore>()

  for (const email of emails) {
    const score = await calculatePriorityScore(email, userInteractionHistory)
    scores.set(email.id, score)
  }

  const avgPriority =
    Array.from(scores.values()).reduce((sum, s) => sum + s.priority, 0) /
    scores.size

  console.log('Average Priority:', avgPriority.toFixed(1))
  console.log(
    'High Priority Count:',
    Array.from(scores.values()).filter((s) => s.urgencyLevel === 'high' || s.urgencyLevel === 'critical').length
  )
  console.log('=====================================')

  return scores
}

/**
 * AI-powered priority explanation
 */
export async function explainPriority(
  email: EmailForPriority,
  score: PriorityScore
): Promise<string> {
  const prompt = `You are an AI executive assistant explaining why an email is marked as high priority.

Email Details:
From: ${email.sender}
Subject: ${email.subject}
Received: ${new Date(email.received_at).toLocaleString()}
Category: ${email.category || 'Uncategorized'}

Priority Score: ${score.priority}/100
Urgency Level: ${score.urgencyLevel.toUpperCase()}

Scoring Factors:
- Sender Importance: ${score.factors.senderImportance}/25
- Urgency Words: ${score.factors.urgencyWords}/20
- Deadline Detected: ${score.factors.hasDeadline}/15
- Interview Related: ${score.factors.isInterview}/15
- Invoice/Bill: ${score.factors.isInvoice}/10
- Calendar Event: ${score.factors.hasCalendarEvent}/10
- Follow-up: ${score.factors.isFollowUp}/15
- Unread: ${score.factors.isUnread}/5
- Starred: ${score.factors.isStarred}/5
- User Interaction: ${score.factors.userInteraction}/10
- Recency: ${score.factors.recency}/10

Write a 2-3 sentence explanation of why this email received this priority score. Be specific and actionable.`

  return await generateText(prompt)
}

// ========== HELPER FUNCTIONS ==========

function calculateSenderImportance(sender: string): number {
  const senderLower = sender.toLowerCase()

  // Check if sender matches important patterns
  for (const pattern of IMPORTANT_SENDERS) {
    if (senderLower.includes(pattern)) {
      return 25
    }
  }

  // Check if it's from a known domain (not Gmail, Yahoo, etc.)
  if (
    !senderLower.includes('@gmail.com') &&
    !senderLower.includes('@yahoo.com') &&
    !senderLower.includes('@hotmail.com') &&
    !senderLower.includes('@outlook.com')
  ) {
    return 15
  }

  return 5
}

function calculateUrgencyScore(text: string): number {
  let score = 0

  for (const keyword of URGENCY_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 2
    }
  }

  return Math.min(20, score)
}

function detectDeadline(text: string): number {
  for (const pattern of DEADLINE_PATTERNS) {
    if (pattern.test(text)) {
      return 15
    }
  }
  return 0
}

function detectInterview(text: string): number {
  for (const keyword of INTERVIEW_KEYWORDS) {
    if (text.includes(keyword)) {
      return 15
    }
  }
  return 0
}

function detectInvoice(text: string): number {
  for (const keyword of INVOICE_KEYWORDS) {
    if (text.includes(keyword)) {
      return 10
    }
  }
  return 0
}

function detectCalendarEvent(text: string): number {
  const patterns = [
    /meeting\s+(at|on)/i,
    /scheduled\s+for/i,
    /zoom\s+link/i,
    /google\s+meet/i,
    /calendar\s+invite/i,
    /rsvp/i,
  ]

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return 10
    }
  }

  return 0
}

function detectFollowUp(subject: string, body: string): number {
  const followUpPatterns = [
    /re:/i,
    /fwd:/i,
    /follow[\s-]?up/i,
    /following up/i,
    /checking in/i,
    /reminder/i,
    /second request/i,
    /haven'?t heard/i,
  ]

  const text = `${subject} ${body}`.toLowerCase()

  for (const pattern of followUpPatterns) {
    if (pattern.test(text)) {
      return 15
    }
  }

  return 0
}

function calculateRecencyScore(receivedAt: string): number {
  const now = new Date()
  const received = new Date(receivedAt)
  const hoursDiff = (now.getTime() - received.getTime()) / (1000 * 60 * 60)

  if (hoursDiff < 2) return 10
  if (hoursDiff < 6) return 8
  if (hoursDiff < 24) return 6
  if (hoursDiff < 48) return 4
  if (hoursDiff < 72) return 2
  return 0
}

function getUrgencyLevel(priority: number): 'critical' | 'high' | 'medium' | 'low' {
  if (priority >= 80) return 'critical'
  if (priority >= 60) return 'high'
  if (priority >= 40) return 'medium'
  return 'low'
}

function generatePriorityReason(factors: PriorityFactors, email: EmailForPriority): string {
  const reasons: string[] = []

  if (factors.isInterview > 0) {
    reasons.push('Interview invitation')
  }
  if (factors.hasDeadline > 0) {
    reasons.push('Contains deadline')
  }
  if (factors.urgencyWords > 15) {
    reasons.push('Urgent language detected')
  }
  if (factors.isInvoice > 0) {
    reasons.push('Payment or invoice')
  }
  if (factors.hasCalendarEvent > 0) {
    reasons.push('Calendar event')
  }
  if (factors.isFollowUp > 0) {
    reasons.push('Follow-up email')
  }
  if (factors.senderImportance >= 20) {
    reasons.push('Important sender')
  }
  if (factors.isStarred > 0) {
    reasons.push('Starred by you')
  }
  if (factors.recency >= 8) {
    reasons.push('Very recent')
  }

  if (reasons.length === 0) {
    return 'Standard priority email'
  }

  return reasons.join(', ')
}
