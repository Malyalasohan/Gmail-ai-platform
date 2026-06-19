// Context Manager — Phase 3
// High-level manager that orchestrates conversation context, references, and follow-ups

import {
  getConversationContext,
  updateConversationContext,
  clearConversationContext,
  setSelectedEmail,
  getSelectedEmail,
  ConversationContext,
} from './conversation-context'
import { detectReference, resolveOrdinalIndex, describeReference } from './reference-resolver'
import { analyzeQuery, describeAnalysis } from './followup-detector'
import { RetrievedEmail, retrieveThreadEmails } from '../retrieval'

export interface ContextDecision {
  // Query classification
  isFollowUp: boolean
  isNewTopic: boolean
  requiresSearch: boolean
  requiresContext: boolean
  shouldClearContext: boolean
  
  // Context to use
  selectedEmail: RetrievedEmail | null
  selectedThread: string | null
  contextEmails: RetrievedEmail[]
  conversationHistory: Array<{ role: string; content: string }>
  
  // Metadata
  confidence: number
  reason: string
  referenceType: string
}

/**
 * Main context manager - decides what context to use for the query
 */
export async function decideContext(
  query: string,
  userId: string
): Promise<ContextDecision> {
  console.log('========== CONTEXT MANAGER ==========')
  console.log('Query:', query)
  console.log('User:', userId)
  
  // Get current context
  const context = getConversationContext(userId)
  const hasContext = context.selectedEmail !== null || context.retrievedEmails.length > 0
  
  console.log('Has Context:', hasContext)
  if (hasContext) {
    console.log('Selected Email:', context.selectedEmail?.subject || 'None')
    console.log('Retrieved Emails:', context.retrievedEmails.length)
  }
  
  // Analyze query
  const analysis = analyzeQuery(query, context)
  const reference = detectReference(query)
  
  console.log('Analysis:', describeAnalysis(analysis))
  console.log('Reference:', describeReference(reference))
  
  // Handle ordinal references (first, second, third, etc.)
  if (reference.type === 'ordinal' && context.retrievedEmails.length > 0) {
    const index = resolveOrdinalIndex(reference, context.retrievedEmails.length)
    
    if (index !== null) {
      const selectedEmail = context.retrievedEmails[index]
      setSelectedEmail(userId, selectedEmail)
      
      console.log('Ordinal Reference Resolved:')
      console.log(`  Index: ${index}`)
      console.log(`  Email: ${selectedEmail.subject}`)
      console.log('=====================================')
      
      return {
        isFollowUp: true,
        isNewTopic: false,
        requiresSearch: false,
        requiresContext: true,
        shouldClearContext: false,
        selectedEmail,
        selectedThread: selectedEmail.thread_id,
        contextEmails: context.retrievedEmails,
        conversationHistory: formatConversationHistory(context),
        confidence: reference.confidence,
        reason: 'Ordinal reference resolved',
        referenceType: reference.type,
      }
    }
  }
  
  // Handle thread references
  if (reference.type === 'thread_reference' && context.selectedThread) {
    console.log('Thread Reference Detected - Loading full thread')
    
    // Load all emails in thread
    const threadEmails = await retrieveThreadEmails(context.selectedThread, userId)
    
    console.log('Thread Emails Loaded:', threadEmails.length)
    console.log('=====================================')
    
    return {
      isFollowUp: true,
      isNewTopic: false,
      requiresSearch: false,
      requiresContext: true,
      shouldClearContext: false,
      selectedEmail: context.selectedEmail,
      selectedThread: context.selectedThread,
      contextEmails: threadEmails,
      conversationHistory: formatConversationHistory(context),
      confidence: reference.confidence,
      reason: 'Thread reference - loaded full conversation',
      referenceType: reference.type,
    }
  }
  
  // Clear context if new topic
  if (analysis.shouldClearContext) {
    console.log('Context Cleared - New Topic')
    clearConversationContext(userId)
  }
  
  console.log('=====================================')
  
  // Build decision
  const decision: ContextDecision = {
    isFollowUp: analysis.classification === 'follow_up',
    isNewTopic: analysis.classification === 'new_topic',
    requiresSearch: analysis.shouldSearch,
    requiresContext: analysis.shouldUseContext,
    shouldClearContext: analysis.shouldClearContext,
    selectedEmail: analysis.shouldUseContext ? context.selectedEmail : null,
    selectedThread: analysis.shouldUseContext ? context.selectedThread : null,
    contextEmails: analysis.shouldUseContext ? context.retrievedEmails : [],
    conversationHistory: analysis.shouldUseContext ? formatConversationHistory(context) : [],
    confidence: analysis.confidence,
    reason: analysis.reason,
    referenceType: reference.type,
  }
  
  return decision
}

/**
 * Update context after search execution
 */
export function updateContextAfterSearch(
  userId: string,
  query: string,
  intents: string[],
  retrievedEmails: RetrievedEmail[],
  sources: Array<{
    id: string
    sender: string
    subject: string
    received_at: string
    similarity: number
    thread_id: string
  }>
): void {
  updateConversationContext(userId, {
    query,
    intents,
    retrievedEmails,
    sources,
  })
  
  console.log('========== CONTEXT UPDATED ==========')
  console.log('User:', userId)
  console.log('Query:', query)
  console.log('Intents:', intents.join(', '))
  console.log('Emails Retrieved:', retrievedEmails.length)
  console.log('Selected Email:', retrievedEmails[0]?.subject || 'None')
  console.log('=====================================')
}

/**
 * Update context after response generation
 */
export function updateContextAfterResponse(
  userId: string,
  userMessage: string,
  assistantMessage: string,
  sources: Array<{
    id: string
    sender: string
    subject: string
    received_at: string
    similarity: number
    thread_id: string
  }>
): void {
  updateConversationContext(userId, {
    response: assistantMessage,
    userMessage,
    assistantMessage,
    sources,
  })
  
  console.log('========== CONVERSATION UPDATED ==========')
  console.log('User:', userId)
  console.log('History Count:', getConversationContext(userId).conversationHistory.length)
  console.log('==========================================')
}

/**
 * Format conversation history for LLM context
 */
function formatConversationHistory(context: ConversationContext): Array<{ role: string; content: string }> {
  // Get last 10 messages (5 pairs of user/assistant)
  const recentHistory = context.conversationHistory.slice(-10)
  
  return recentHistory.map(msg => ({
    role: msg.role,
    content: msg.content,
  }))
}

/**
 * Build context string for LLM prompt
 */
export function buildContextForPrompt(decision: ContextDecision): string {
  const parts: string[] = []
  
  // Add conversation history
  if (decision.conversationHistory.length > 0) {
    parts.push('CONVERSATION HISTORY:')
    decision.conversationHistory.forEach((msg, idx) => {
      parts.push(`[${msg.role.toUpperCase()}]: ${msg.content}`)
    })
    parts.push('')
  }
  
  // Add selected email
  if (decision.selectedEmail) {
    parts.push('SELECTED EMAIL (Current Context):')
    parts.push(`From: ${decision.selectedEmail.sender}`)
    parts.push(`To: ${decision.selectedEmail.recipient}`)
    parts.push(`Subject: ${decision.selectedEmail.subject}`)
    parts.push(`Date: ${new Date(decision.selectedEmail.received_at).toLocaleString()}`)
    parts.push(`\n${decision.selectedEmail.body_text}`)
    parts.push('')
  }
  
  // Add context emails if different from selected
  if (decision.contextEmails.length > 1) {
    parts.push(`RETRIEVED EMAILS (${decision.contextEmails.length} total):`)
    decision.contextEmails.forEach((email, idx) => {
      parts.push(`\n[Email ${idx + 1}]`)
      parts.push(`From: ${email.sender}`)
      parts.push(`Subject: ${email.subject}`)
      parts.push(`Date: ${new Date(email.received_at).toLocaleString()}`)
    })
    parts.push('')
  }
  
  return parts.join('\n')
}

/**
 * Log context decision for debugging
 */
export function logContextDecision(decision: ContextDecision): void {
  console.log('========== CONTEXT DECISION ==========')
  console.log('Follow-up:', decision.isFollowUp)
  console.log('New Topic:', decision.isNewTopic)
  console.log('Requires Search:', decision.requiresSearch)
  console.log('Requires Context:', decision.requiresContext)
  console.log('Should Clear:', decision.shouldClearContext)
  console.log('Selected Email:', decision.selectedEmail ? decision.selectedEmail.subject : 'None')
  console.log('Selected Thread:', decision.selectedThread || 'None')
  console.log('Context Emails:', decision.contextEmails.length)
  console.log('History Messages:', decision.conversationHistory.length)
  console.log('Confidence:', decision.confidence.toFixed(2))
  console.log('Reason:', decision.reason)
  console.log('Reference Type:', decision.referenceType)
  console.log('======================================')
}
