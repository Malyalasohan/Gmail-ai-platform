// Reference Resolver — Phase 3
// Detects and resolves references in user queries

export type ReferenceType =
  | 'pronoun' // it, them, this, that, these, those
  | 'ordinal' // first, second, third, last, latest
  | 'email_reference' // "this email", "that message", "previous email"
  | 'thread_reference' // "this thread", "conversation"
  | 'reply_intent' // "reply to", "respond to"
  | 'action_intent' // "summarize", "translate", "explain"
  | 'none'

export interface ResolvedReference {
  type: ReferenceType
  confidence: number
  requiresContext: boolean
  data?: {
    ordinalIndex?: number // 0-based index (0 = first, 1 = second, etc.)
    action?: string
    targetType?: 'email' | 'thread' | 'emails'
  }
}

/**
 * Detect if query contains references to previous context
 */
export function detectReference(query: string): ResolvedReference {
  const normalized = query.toLowerCase().trim()

  // 1. PRONOUN REFERENCES (it, them, this, that)
  const pronounPatterns = [
    /\b(it|them|this|that|these|those)\b/i,
    /^(summarize|translate|explain|what|when|who|where|why|how)\s+(it|them|this|that)/i,
  ]

  for (const pattern of pronounPatterns) {
    if (pattern.test(query)) {
      // Determine target type
      const isPlural = /\b(them|these|those)\b/i.test(query)
      
      return {
        type: 'pronoun',
        confidence: 0.95,
        requiresContext: true,
        data: {
          targetType: isPlural ? 'emails' : 'email',
        },
      }
    }
  }

  // 2. ORDINAL REFERENCES (first, second, third, last, latest)
  const ordinalPatterns = [
    { pattern: /\b(first|1st)\s+(one|email|message|result)/i, index: 0 },
    { pattern: /\b(second|2nd)\s+(one|email|message|result)/i, index: 1 },
    { pattern: /\b(third|3rd)\s+(one|email|message|result)/i, index: 2 },
    { pattern: /\b(fourth|4th)\s+(one|email|message|result)/i, index: 3 },
    { pattern: /\b(fifth|5th)\s+(one|email|message|result)/i, index: 4 },
    { pattern: /\b(last|latest|most recent)\s+(one|email|message|result)/i, index: 0 }, // 0 = most recent in list
  ]

  for (const { pattern, index } of ordinalPatterns) {
    if (pattern.test(query)) {
      return {
        type: 'ordinal',
        confidence: 0.95,
        requiresContext: true,
        data: {
          ordinalIndex: index,
          targetType: 'email',
        },
      }
    }
  }

  // Handle bare ordinal references (e.g., "open first one", "show second")
  const bareOrdinalPatterns = [
    { pattern: /\b(open|show|display|view|read)\s+(the\s+)?(first|1st)\b/i, index: 0 },
    { pattern: /\b(open|show|display|view|read)\s+(the\s+)?(second|2nd)\b/i, index: 1 },
    { pattern: /\b(open|show|display|view|read)\s+(the\s+)?(third|3rd)\b/i, index: 2 },
    { pattern: /\b(open|show|display|view|read)\s+(the\s+)?(last|latest)\b/i, index: 0 },
  ]

  for (const { pattern, index } of bareOrdinalPatterns) {
    if (pattern.test(query)) {
      return {
        type: 'ordinal',
        confidence: 0.9,
        requiresContext: true,
        data: {
          ordinalIndex: index,
          targetType: 'email',
        },
      }
    }
  }

  // 3. EMAIL REFERENCES
  const emailReferencePatterns = [
    /\b(this|that|the)\s+(email|message|mail)/i,
    /\b(previous|last|latest)\s+(email|message|mail)/i,
    /\b(selected|current)\s+(email|message|mail)/i,
  ]

  for (const pattern of emailReferencePatterns) {
    if (pattern.test(query)) {
      return {
        type: 'email_reference',
        confidence: 0.9,
        requiresContext: true,
        data: {
          targetType: 'email',
        },
      }
    }
  }

  // 4. THREAD REFERENCES
  const threadReferencePatterns = [
    /\b(this|that|the)\s+(thread|conversation|discussion)/i,
    /\b(entire|full|whole)\s+(thread|conversation)/i,
    /\b(thread|conversation)\s+(history|messages)/i,
  ]

  for (const pattern of threadReferencePatterns) {
    if (pattern.test(query)) {
      return {
        type: 'thread_reference',
        confidence: 0.9,
        requiresContext: true,
        data: {
          targetType: 'thread',
        },
      }
    }
  }

  // 5. REPLY INTENT
  const replyPatterns = [
    /\b(reply|respond|answer)\s+(to\s+)?(it|this|that|them)/i,
    /\b(reply|respond|answer)\s+to\s+(the\s+)?(email|message|mail)/i,
    /\b(draft|compose|write)\s+a\s+(reply|response)/i,
  ]

  for (const pattern of replyPatterns) {
    if (pattern.test(query)) {
      return {
        type: 'reply_intent',
        confidence: 0.95,
        requiresContext: true,
        data: {
          action: 'reply',
          targetType: 'email',
        },
      }
    }
  }

  // 6. ACTION INTENTS (on selected email)
  const actionPatterns = [
    { pattern: /\b(summarize|summary|sum up)\b/i, action: 'summarize' },
    { pattern: /\b(translate|translation)\s+(to|into)\s+(\w+)/i, action: 'translate' },
    { pattern: /\b(explain|clarify|elaborate)\b/i, action: 'explain' },
    { pattern: /\bwho\s+(sent|is\s+the\s+sender|from)/i, action: 'get_sender' },
    { pattern: /\bwhen\s+(was\s+it\s+sent|received|did\s+I\s+get)/i, action: 'get_date' },
    { pattern: /\b(what('?s|\s+is)\s+the\s+)?(deadline|due date)/i, action: 'extract_deadline' },
    { pattern: /\b(attachments?|files?|attached)/i, action: 'list_attachments' },
    // BUG FIX: Add Gmail action keywords that should trigger follow-up behavior
    { pattern: /\b(delete|remove|trash)\b/i, action: 'delete' },
    { pattern: /\b(archive)\b/i, action: 'archive' },
    { pattern: /\b(reply|respond|answer|write back)\b/i, action: 'reply' },
    { pattern: /\b(forward|fwd|send this to)\b/i, action: 'forward' },
    { pattern: /\b(star|flag|mark as important)\b/i, action: 'star' },
    { pattern: /\b(unstar|unflag|remove star)\b/i, action: 'unstar' },
    { pattern: /\b(mark as read|mark read)\b/i, action: 'mark_read' },
    { pattern: /\b(mark as unread|mark unread)\b/i, action: 'mark_unread' },
    { pattern: /\b(show thread|open it|display it)\b/i, action: 'show' },
  ]

  for (const { pattern, action } of actionPatterns) {
    if (pattern.test(query)) {
      // BUG FIX: Gmail actions REQUIRE context when context exists
      const isGmailAction = [
        'delete', 'archive', 'reply', 'forward', 'star', 'unstar',
        'mark_read', 'mark_unread', 'show'
      ].includes(action)
      
      return {
        type: 'action_intent',
        confidence: 0.95,
        requiresContext: isGmailAction, // Gmail actions REQUIRE context
        data: {
          action,
          targetType: 'email',
        },
      }
    }
  }

  // No reference detected
  return {
    type: 'none',
    confidence: 1.0,
    requiresContext: false,
  }
}

/**
 * Check if query is a follow-up question
 */
export function isFollowUpQuery(query: string, hasContext: boolean): boolean {
  const reference = detectReference(query)
  
  // If requires context and we have context, it's a follow-up
  if (reference.requiresContext && hasContext) {
    return true
  }
  
  // Short queries without new search terms are likely follow-ups
  const normalized = query.toLowerCase().trim()
  const wordCount = normalized.split(/\s+/).length
  
  if (wordCount <= 5 && hasContext) {
    // Check for question words that indicate follow-up
    const followUpIndicators = [
      /^(who|what|when|where|why|how|which)/i,
      /^(summarize|translate|explain|show|tell)/i,
      /^(reply|respond|answer)/i,
    ]
    
    for (const pattern of followUpIndicators) {
      if (pattern.test(query)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Resolve ordinal reference to email index
 */
export function resolveOrdinalIndex(
  reference: ResolvedReference,
  emailCount: number
): number | null {
  if (reference.type !== 'ordinal' || reference.data?.ordinalIndex === undefined) {
    return null
  }
  
  const index = reference.data.ordinalIndex
  
  // Validate index is within bounds
  if (index >= emailCount) {
    return null
  }
  
  return index
}

/**
 * Get human-readable description of reference
 */
export function describeReference(reference: ResolvedReference): string {
  switch (reference.type) {
    case 'pronoun':
      return `Pronoun reference (${reference.data?.targetType})`
    case 'ordinal':
      return `Ordinal reference (index ${reference.data?.ordinalIndex})`
    case 'email_reference':
      return 'Email reference'
    case 'thread_reference':
      return 'Thread reference'
    case 'reply_intent':
      return 'Reply intent'
    case 'action_intent':
      return `Action intent (${reference.data?.action})`
    case 'none':
      return 'No reference detected'
    default:
      return 'Unknown reference'
  }
}
