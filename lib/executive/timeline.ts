// Email Timeline Generator - Phase 5
// Tracks conversation history and identifies current status

export interface EmailTimeline {
  threadId: string
  subject: string
  participants: string[]
  events: TimelineEvent[]
  currentStatus: ThreadStatus
  lastActivity: string
  waitingFor: string | null
  messageCount: number
}

export interface TimelineEvent {
  timestamp: string
  actor: string
  action: 'sent' | 'received' | 'replied' | 'forwarded'
  subject: string
  isFromUser: boolean
}

export interface ThreadStatus {
  status: 'waiting_for_reply' | 'waiting_for_user' | 'completed' | 'active'
  description: string
  daysSinceLastMessage: number
}

/**
 * Generate timeline for an email thread
 */
export async function generateTimeline(
  threadId: string,
  emails: Array<{
    id: string
    sender: string
    recipient: string
    subject: string
    received_at: string
    thread_id: string
  }>,
  userEmail?: string
): Promise<EmailTimeline> {
  // Filter emails for this thread
  const threadEmails = emails
    .filter((e) => e.thread_id === threadId)
    .sort(
      (a, b) =>
        new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
    )

  if (threadEmails.length === 0) {
    throw new Error('No emails found for thread')
  }

  // Extract participants
  const participantSet = new Set<string>()
  for (const email of threadEmails) {
    participantSet.add(email.sender)
    participantSet.add(email.recipient)
  }

  const participants = Array.from(participantSet)

  // Build timeline events
  const events: TimelineEvent[] = threadEmails.map((email, index) => {
    const isFromUser = userEmail
      ? email.sender.toLowerCase().includes(userEmail.toLowerCase())
      : false

    let action: TimelineEvent['action'] = 'sent'
    if (!isFromUser) {
      action = 'received'
    } else if (index > 0) {
      action = 'replied'
    }

    return {
      timestamp: email.received_at,
      actor: email.sender,
      action,
      subject: email.subject,
      isFromUser,
    }
  })

  // Determine current status
  const lastEmail = threadEmails[threadEmails.length - 1]
  const lastFromUser = userEmail
    ? lastEmail.sender.toLowerCase().includes(userEmail.toLowerCase())
    : false

  const status = determineThreadStatus(lastFromUser, threadEmails)

  return {
    threadId,
    subject: threadEmails[0].subject,
    participants,
    events,
    currentStatus: status,
    lastActivity: lastEmail.received_at,
    waitingFor: status.status === 'waiting_for_reply' ? lastEmail.recipient : null,
    messageCount: threadEmails.length,
  }
}

/**
 * Generate timelines for multiple threads
 */
export async function generateTimelines(
  emails: Array<{
    id: string
    sender: string
    recipient: string
    subject: string
    received_at: string
    thread_id: string
  }>,
  userEmail?: string
): Promise<Map<string, EmailTimeline>> {
  console.log('========== TIMELINE GENERATION ==========')

  // Group by thread
  const threads = new Map<string, typeof emails>()
  for (const email of emails) {
    if (!threads.has(email.thread_id)) {
      threads.set(email.thread_id, [])
    }
    threads.get(email.thread_id)!.push(email)
  }

  console.log('Total Threads:', threads.size)

  const timelines = new Map<string, EmailTimeline>()

  for (const [threadId, threadEmails] of threads.entries()) {
    try {
      const timeline = await generateTimeline(threadId, emails, userEmail)
      timelines.set(threadId, timeline)
    } catch (error) {
      console.error(`Timeline generation error for thread ${threadId}:`, error)
    }
  }

  console.log('Timelines Generated:', timelines.size)
  console.log('=========================================')

  return timelines
}

/**
 * Determine thread status
 */
function determineThreadStatus(
  lastFromUser: boolean,
  emails: any[]
): ThreadStatus {
  const lastEmail = emails[emails.length - 1]
  const now = new Date()
  const lastMessageTime = new Date(lastEmail.received_at)
  const daysSince = Math.floor(
    (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (lastFromUser) {
    // User sent last message - waiting for reply
    if (daysSince === 0) {
      return {
        status: 'waiting_for_reply',
        description: 'Awaiting response (sent today)',
        daysSinceLastMessage: daysSince,
      }
    } else if (daysSince === 1) {
      return {
        status: 'waiting_for_reply',
        description: 'Awaiting response (sent yesterday)',
        daysSinceLastMessage: daysSince,
      }
    } else {
      return {
        status: 'waiting_for_reply',
        description: `Awaiting response (${daysSince} days)`,
        daysSinceLastMessage: daysSince,
      }
    }
  } else {
    // Other person sent last message - user needs to reply
    if (daysSince === 0) {
      return {
        status: 'waiting_for_user',
        description: 'Needs your reply (received today)',
        daysSinceLastMessage: daysSince,
      }
    } else if (daysSince === 1) {
      return {
        status: 'waiting_for_user',
        description: 'Needs your reply (received yesterday)',
        daysSinceLastMessage: daysSince,
      }
    } else if (daysSince > 7) {
      return {
        status: 'completed',
        description: `No activity for ${daysSince} days`,
        daysSinceLastMessage: daysSince,
      }
    } else {
      return {
        status: 'waiting_for_user',
        description: `Needs your reply (${daysSince} days)`,
        daysSinceLastMessage: daysSince,
      }
    }
  }
}

/**
 * Get threads waiting for user reply
 */
export function getThreadsWaitingForUser(
  timelines: Map<string, EmailTimeline>
): EmailTimeline[] {
  return Array.from(timelines.values()).filter(
    (t) => t.currentStatus.status === 'waiting_for_user'
  )
}

/**
 * Get threads waiting for reply from others
 */
export function getThreadsWaitingForReply(
  timelines: Map<string, EmailTimeline>
): EmailTimeline[] {
  return Array.from(timelines.values()).filter(
    (t) => t.currentStatus.status === 'waiting_for_reply'
  )
}

/**
 * Get active conversations
 */
export function getActiveConversations(
  timelines: Map<string, EmailTimeline>,
  maxDaysSinceLastActivity: number = 7
): EmailTimeline[] {
  return Array.from(timelines.values()).filter(
    (t) =>
      t.currentStatus.daysSinceLastMessage <= maxDaysSinceLastActivity &&
      t.currentStatus.status !== 'completed'
  )
}

/**
 * Format timeline as human-readable string
 */
export function formatTimeline(timeline: EmailTimeline): string {
  const lines: string[] = []

  lines.push(`Thread: ${timeline.subject}`)
  lines.push(`Participants: ${timeline.participants.join(', ')}`)
  lines.push(`Messages: ${timeline.messageCount}`)
  lines.push(`Status: ${timeline.currentStatus.description}`)
  lines.push('')
  lines.push('Timeline:')

  for (const event of timeline.events) {
    const date = new Date(event.timestamp).toLocaleString()
    const prefix = event.isFromUser ? '→' : '←'
    lines.push(`  ${prefix} ${date} - ${event.actor}: ${event.action}`)
  }

  return lines.join('\n')
}
