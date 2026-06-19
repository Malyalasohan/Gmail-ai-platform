// Task Extraction Engine - Phase 5
// Automatically extracts actionable tasks from emails using AI

import { generateText } from '../ai-provider'

export interface ExtractedTask {
  id: string
  title: string
  description?: string
  deadline?: string
  emailSource: {
    id: string
    subject: string
    sender: string
    received_at: string
  }
  priority: number
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  category: string
  estimatedMinutes?: number
  keywords: string[]
  createdAt: string
}

export interface TaskExtractionResult {
  tasks: ExtractedTask[]
  emailsProcessed: number
  tasksFound: number
}

const TASK_INDICATORS = [
  'submit',
  'complete',
  'finish',
  'send',
  'reply',
  'respond',
  'review',
  'approve',
  'sign',
  'fill out',
  'upload',
  'download',
  'register',
  'apply',
  'schedule',
  'book',
  'confirm',
  'rsvp',
  'pay',
  'purchase',
  'order',
  'prepare',
  'read',
  'join',
  'attend',
  'call',
  'contact',
]

/**
 * Extract tasks from a single email using AI
 */
export async function extractTasksFromEmail(
  emailId: string,
  sender: string,
  subject: string,
  bodyText: string,
  receivedAt: string,
  priority: number
): Promise<ExtractedTask[]> {
  // Quick filter: check if email contains task indicators
  const textLower = `${subject} ${bodyText}`.toLowerCase()
  const hasTaskIndicator = TASK_INDICATORS.some((indicator) =>
    textLower.includes(indicator)
  )

  if (!hasTaskIndicator) {
    return []
  }

  // Use AI to extract structured tasks
  const prompt = `You are an AI task extraction system. Analyze this email and extract ONLY actionable tasks for the recipient.

Email Details:
From: ${sender}
Subject: ${subject}
Date: ${new Date(receivedAt).toLocaleString()}

Body:
${bodyText.slice(0, 2000)}

RULES:
- Only extract tasks that require the recipient to DO something
- Ignore informational content or updates
- Extract deadline if mentioned
- Categorize each task (work, personal, academic, financial, etc.)
- Estimate time needed in minutes (5, 15, 30, 60, 120, etc.)
- Keep task titles concise and action-oriented

Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "title": "Submit assignment for CS101",
    "description": "Complete and submit the final project",
    "deadline": "2024-03-15T23:59:00Z",
    "category": "academic",
    "estimatedMinutes": 120,
    "keywords": ["assignment", "submission", "CS101"]
  }
]

If no actionable tasks found, return: []`

  try {
    const response = await generateText(prompt)

    // Clean response - remove markdown code blocks if present
    const cleaned = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()

    const tasksData = JSON.parse(cleaned)

    if (!Array.isArray(tasksData)) {
      return []
    }

    // Convert to ExtractedTask format
    return tasksData.map((task: any, index: number) => ({
      id: `${emailId}-task-${index}`,
      title: task.title || 'Untitled Task',
      description: task.description,
      deadline: task.deadline,
      emailSource: {
        id: emailId,
        subject,
        sender,
        received_at: receivedAt,
      },
      priority,
      status: 'pending' as const,
      category: task.category || 'other',
      estimatedMinutes: task.estimatedMinutes,
      keywords: task.keywords || [],
      createdAt: new Date().toISOString(),
    }))
  } catch (error) {
    console.error('Task extraction error:', error)
    return []
  }
}

/**
 * Extract tasks from multiple emails in batch
 */
export async function extractTasksFromEmails(
  emails: Array<{
    id: string
    sender: string
    subject: string
    body_text: string
    received_at: string
    priority: number
  }>
): Promise<TaskExtractionResult> {
  console.log('========== TASK EXTRACTION ==========')
  console.log('Processing Emails:', emails.length)

  const allTasks: ExtractedTask[] = []

  for (const email of emails) {
    const tasks = await extractTasksFromEmail(
      email.id,
      email.sender,
      email.subject,
      email.body_text,
      email.received_at,
      email.priority
    )

    allTasks.push(...tasks)

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  console.log('Tasks Extracted:', allTasks.length)
  console.log('Task Categories:')
  const categories = new Map<string, number>()
  allTasks.forEach((task) => {
    categories.set(task.category, (categories.get(task.category) || 0) + 1)
  })
  categories.forEach((count, category) => {
    console.log(`  - ${category}: ${count}`)
  })
  console.log('====================================')

  return {
    tasks: allTasks,
    emailsProcessed: emails.length,
    tasksFound: allTasks.length,
  }
}

/**
 * Group tasks by category
 */
export function groupTasksByCategory(
  tasks: ExtractedTask[]
): Map<string, ExtractedTask[]> {
  const grouped = new Map<string, ExtractedTask[]>()

  for (const task of tasks) {
    const category = task.category || 'other'
    if (!grouped.has(category)) {
      grouped.set(category, [])
    }
    grouped.get(category)!.push(task)
  }

  return grouped
}

/**
 * Get tasks due today or overdue
 */
export function getUrgentTasks(tasks: ExtractedTask[]): ExtractedTask[] {
  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  return tasks.filter((task) => {
    if (!task.deadline) return false
    const deadline = new Date(task.deadline)
    return deadline <= endOfToday && task.status === 'pending'
  })
}

/**
 * Sort tasks by priority and deadline
 */
export function sortTasksByUrgency(tasks: ExtractedTask[]): ExtractedTask[] {
  return tasks.sort((a, b) => {
    // First by status
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1

    // Then by deadline
    if (a.deadline && !b.deadline) return -1
    if (!a.deadline && b.deadline) return 1
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    }

    // Finally by priority
    return b.priority - a.priority
  })
}

/**
 * Calculate total estimated work time
 */
export function calculateTotalWorkTime(tasks: ExtractedTask[]): number {
  return tasks
    .filter((task) => task.status === 'pending')
    .reduce((sum, task) => sum + (task.estimatedMinutes || 30), 0)
}
