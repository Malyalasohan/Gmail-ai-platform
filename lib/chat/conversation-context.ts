// Conversation Context Manager — Phase 3
// Manages conversational memory for context-aware interactions

import { RetrievedEmail } from '../retrieval'

export interface ConversationContext {
  userId: string
  lastQuery: string | null
  lastIntent: string[] | null
  selectedEmail: RetrievedEmail | null
  selectedThread: string | null
  retrievedEmails: RetrievedEmail[]
  retrievedSources: Array<{
    id: string
    sender: string
    subject: string
    received_at: string
    similarity: number
    thread_id: string
  }>
  lastResponse: string | null
  conversationHistory: ConversationMessage[]
  timestamp: Date
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Array<{
    id: string
    sender: string
    subject: string
  }>
}

// In-memory context store (scoped per user)
const contextStore = new Map<string, ConversationContext>()

/**
 * Initialize empty context for a user
 */
export function initializeContext(userId: string): ConversationContext {
  const context: ConversationContext = {
    userId,
    lastQuery: null,
    lastIntent: null,
    selectedEmail: null,
    selectedThread: null,
    retrievedEmails: [],
    retrievedSources: [],
    lastResponse: null,
    conversationHistory: [],
    timestamp: new Date(),
  }
  
  contextStore.set(userId, context)
  return context
}

/**
 * Get conversation context for a user
 */
export function getConversationContext(userId: string): ConversationContext {
  let context = contextStore.get(userId)
  
  if (!context) {
    context = initializeContext(userId)
  }
  
  return context
}

/**
 * Update conversation context with new query and results
 */
export function updateConversationContext(
  userId: string,
  updates: {
    query?: string
    intents?: string[]
    retrievedEmails?: RetrievedEmail[]
    sources?: Array<{
      id: string
      sender: string
      subject: string
      received_at: string
      similarity: number
      thread_id: string
    }>
    response?: string
    userMessage?: string
    assistantMessage?: string
  }
): ConversationContext {
  const context = getConversationContext(userId)
  
  // Update query and intent
  if (updates.query) {
    context.lastQuery = updates.query
  }
  
  if (updates.intents) {
    context.lastIntent = updates.intents
  }
  
  // Update retrieved emails and sources
  if (updates.retrievedEmails) {
    context.retrievedEmails = updates.retrievedEmails
    
    // Auto-select first email if results exist
    if (updates.retrievedEmails.length > 0) {
      context.selectedEmail = updates.retrievedEmails[0]
      context.selectedThread = updates.retrievedEmails[0].thread_id
    }
  }
  
  if (updates.sources) {
    context.retrievedSources = updates.sources
  }
  
  // Update response
  if (updates.response) {
    context.lastResponse = updates.response
  }
  
  // Update conversation history (keep last 10 interactions)
  if (updates.userMessage) {
    context.conversationHistory.push({
      role: 'user',
      content: updates.userMessage,
      timestamp: new Date(),
    })
  }
  
  if (updates.assistantMessage) {
    context.conversationHistory.push({
      role: 'assistant',
      content: updates.assistantMessage,
      timestamp: new Date(),
      sources: updates.sources?.map(s => ({
        id: s.id,
        sender: s.sender,
        subject: s.subject,
      })),
    })
  }
  
  // Keep only last 10 messages (5 user + 5 assistant)
  if (context.conversationHistory.length > 20) {
    context.conversationHistory = context.conversationHistory.slice(-20)
  }
  
  context.timestamp = new Date()
  contextStore.set(userId, context)
  
  return context
}

/**
 * Clear conversation context (reset selected email/thread, keep history)
 */
export function clearConversationContext(userId: string): void {
  const context = getConversationContext(userId)
  
  context.selectedEmail = null
  context.selectedThread = null
  context.retrievedEmails = []
  context.retrievedSources = []
  
  contextStore.set(userId, context)
  
  console.log('========== CONTEXT CLEARED ==========')
  console.log('User:', userId)
  console.log('History Preserved:', context.conversationHistory.length, 'messages')
  console.log('=====================================')
}

/**
 * Set selected email
 */
export function setSelectedEmail(
  userId: string,
  email: RetrievedEmail | null
): void {
  const context = getConversationContext(userId)
  context.selectedEmail = email
  context.selectedThread = email?.thread_id || null
  contextStore.set(userId, context)
  
  console.log('========== SELECTED EMAIL CHANGED ==========')
  console.log('User:', userId)
  console.log('Email:', email ? `${email.subject} (${email.sender})` : 'None')
  console.log('===========================================')
}

/**
 * Set selected thread
 */
export function setSelectedThread(userId: string, threadId: string | null): void {
  const context = getConversationContext(userId)
  context.selectedThread = threadId
  contextStore.set(userId, context)
}

/**
 * Get selected email
 */
export function getSelectedEmail(userId: string): RetrievedEmail | null {
  const context = getConversationContext(userId)
  return context.selectedEmail
}

/**
 * Get selected thread
 */
export function getSelectedThread(userId: string): string | null {
  const context = getConversationContext(userId)
  return context.selectedThread
}

/**
 * Get conversation history (last N messages)
 */
export function getConversationHistory(
  userId: string,
  limit: number = 10
): ConversationMessage[] {
  const context = getConversationContext(userId)
  return context.conversationHistory.slice(-limit)
}

/**
 * Reset all context for a user (complete reset)
 */
export function resetConversationContext(userId: string): void {
  contextStore.delete(userId)
  
  console.log('========== CONTEXT RESET ==========')
  console.log('User:', userId)
  console.log('All memory cleared')
  console.log('===================================')
}
