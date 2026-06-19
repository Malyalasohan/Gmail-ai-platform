// Gmail Action Layer — Phase 4
// Detects and routes Gmail actions from natural language queries

import { safeGenerateContent } from '@/lib/ai-provider'

export type ActionType =
  | 'reply'
  | 'reply_all'
  | 'forward'
  | 'archive'
  | 'delete'
  | 'trash'
  | 'star'
  | 'unstar'
  | 'mark_read'
  | 'mark_unread'
  | 'add_label'
  | 'remove_label'
  | 'move_category'
  | 'create_draft'
  | 'send_draft'
  | 'none'

export interface ActionIntent {
  type: ActionType
  confidence: number
  requiresConfirmation: boolean
  data?: {
    // For reply/forward
    replyStyle?: 'professional' | 'friendly' | 'short' | 'formal' | 'detailed'
    language?: string
    forwardTo?: string
    
    // For label/category
    labelName?: string
    categoryName?: string
    
    // For selection
    targetSelection?: 'current' | 'first' | 'last' | 'all' | 'sender' | 'subject'
    targetValue?: string // sender email or subject keyword
    
    // For draft
    draftContent?: string
  }
}

/**
 * Detect if query contains an action intent
 */
export async function detectActionIntent(
  query: string,
  conversationContext?: string
): Promise<ActionIntent> {
  const lowercaseQuery = query.toLowerCase()

  // Quick pattern matching for common actions
  const patterns = {
    reply: [
      'reply',
      'respond',
      'write back',
      'answer',
      'send a response',
    ],
    forward: ['forward', 'fwd', 'send this to'],
    archive: ['archive'],
    delete: ['delete', 'remove'],
    star: ['star', 'mark as important', 'flag'],
    unstar: ['unstar', 'unflag', 'remove star'],
    mark_read: ['mark as read', 'mark read'],
    mark_unread: ['mark as unread', 'mark unread'],
    add_label: ['add label', 'label as', 'tag as'],
    move_category: ['move to', 'categorize as'],
    create_draft: ['draft', 'compose', 'write email'],
  }

  // Check for action patterns
  let detectedAction: ActionType = 'none'
  let confidence = 0

  for (const [action, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords) {
      if (lowercaseQuery.includes(keyword)) {
        detectedAction = action as ActionType
        confidence = 0.9
        break
      }
    }
    if (detectedAction !== 'none') break
  }

  // If no action detected, return early
  if (detectedAction === 'none') {
    return {
      type: 'none',
      confidence: 0,
      requiresConfirmation: false,
    }
  }

  // Use AI to extract action details
  const actionData = await extractActionDetails(
    query,
    detectedAction,
    conversationContext
  )

  // Determine if action requires confirmation
  const requiresConfirmation = isDangerousAction(
    detectedAction,
    actionData
  )

  return {
    type: detectedAction,
    confidence,
    requiresConfirmation,
    data: actionData,
  }
}

/**
 * Extract action details using AI
 */
async function extractActionDetails(
  query: string,
  action: ActionType,
  conversationContext?: string
): Promise<ActionIntent['data']> {
  const prompt = `You are analyzing a user's email action request.

User Query: "${query}"
Action Type: ${action}
${conversationContext ? `Conversation Context:\n${conversationContext}` : ''}

Extract the following details as JSON:
- replyStyle: (professional|friendly|short|formal|detailed) if it's a reply
- language: the language for the reply if specified
- forwardTo: email address if forwarding
- labelName: label name if adding/removing label
- categoryName: category name if moving to category
- targetSelection: (current|first|last|all|sender|subject) which email(s) to act on
- targetValue: sender email or subject keyword if targeting specific emails

Return ONLY valid JSON with the extracted fields. If a field is not mentioned, omit it.

Examples:
"Reply professionally" → {"replyStyle":"professional","targetSelection":"current"}
"Archive first email" → {"targetSelection":"first"}
"Delete all Reddit emails" → {"targetSelection":"sender","targetValue":"reddit"}
"Forward this to john@example.com" → {"forwardTo":"john@example.com","targetSelection":"current"}

JSON:`

  try {
    const aiResult = await safeGenerateContent(prompt)
    
    // If quota exceeded or other error, return default
    if (!aiResult.success || !aiResult.text) {
      console.warn('Failed to extract action details, using defaults')
      return { targetSelection: 'current' }
    }
    
    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('Failed to extract action details:', error)
  }

  // Fallback: return default based on action type
  return {
    targetSelection: 'current',
  }
}

/**
 * Determine if action is dangerous and requires confirmation
 */
function isDangerousAction(
  action: ActionType,
  data?: ActionIntent['data']
): boolean {
  // Destructive actions always require confirmation
  if (action === 'delete' || action === 'trash') {
    // Deleting multiple emails is dangerous
    if (
      data?.targetSelection === 'all' ||
      data?.targetSelection === 'sender' ||
      data?.targetSelection === 'subject'
    ) {
      return true
    }
    // Deleting a single email still requires confirmation
    return true
  }

  // Safe actions don't require confirmation
  return false
}

/**
 * Format action for confirmation message
 */
export function formatActionConfirmation(
  action: ActionIntent,
  emailCount: number
): string {
  const actionVerb: Record<string, string> = {
    delete: 'delete',
    trash: 'trash',
    archive: 'archive',
    star: 'star',
    mark_read: 'mark as read',
    move_category: 'move',
  }
  
  const verb = actionVerb[action.type] || action.type

  const emailText =
    emailCount === 1 ? '1 email' : `${emailCount} emails`

  let message = `Are you sure you want to ${verb} ${emailText}?`

  if (action.data?.targetValue) {
    message += ` (${action.data.targetSelection}: ${action.data.targetValue})`
  }

  return message
}

/**
 * Check if user query is a confirmation (yes/no)
 */
export function isConfirmation(query: string): boolean | null {
  const lowercaseQuery = query.toLowerCase().trim()

  // Yes variations
  if (
    ['yes', 'y', 'yep', 'yeah', 'sure', 'ok', 'okay', 'confirm', 'do it', 'go ahead', 'proceed'].includes(
      lowercaseQuery
    )
  ) {
    return true
  }

  // No variations
  if (
    ['no', 'n', 'nope', 'nah', 'cancel', 'stop', 'abort', 'nevermind', 'never mind'].includes(
      lowercaseQuery
    )
  ) {
    return false
  }

  // Not a clear confirmation
  return null
}
