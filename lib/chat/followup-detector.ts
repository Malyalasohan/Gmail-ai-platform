// Follow-up Detector — Phase 3
// Determines if query should use context or trigger new search

import { detectReference, isFollowUpQuery } from './reference-resolver'
import { ConversationContext } from './conversation-context'

export type QueryClassification =
  | 'follow_up' // Use existing context
  | 'new_topic' // Clear context and search
  | 'hybrid' // Use context but may need new search

export interface QueryAnalysis {
  classification: QueryClassification
  shouldSearch: boolean
  shouldUseContext: boolean
  shouldClearContext: boolean
  confidence: number
  reason: string
}

/**
 * Analyze query to determine if it's a follow-up or new topic
 */
export function analyzeQuery(
  query: string,
  context: ConversationContext
): QueryAnalysis {
  const normalized = query.toLowerCase().trim()
  const hasContext = context.selectedEmail !== null || context.retrievedEmails.length > 0
  
  // Detect reference in query
  const reference = detectReference(query)
  const isFollowUp = isFollowUpQuery(query, hasContext)
  
  // 1. STRONG FOLLOW-UP INDICATORS (use context, no search)
  if (reference.requiresContext && hasContext) {
    return {
      classification: 'follow_up',
      shouldSearch: false,
      shouldUseContext: true,
      shouldClearContext: false,
      confidence: reference.confidence,
      reason: `Reference detected: ${reference.type}`,
    }
  }
  
  // 2. NEW TOPIC INDICATORS (clear context, new search)
  const newTopicIndicators = [
    // Different subject matter
    /\b(show|find|search|get|list)\s+(emails?|messages?|mail)/i,
    // Explicit new search terms
    /\b(from|by|sent by)\s+[a-z0-9@\.\-]+/i,
    // Time-based queries (usually new search)
    /\b(today|yesterday|this week|last week|this month)/i,
    // Category changes
    /\b(promotional|social|updates|primary|unread)\s+(emails?|messages?)/i,
  ]
  
  for (const pattern of newTopicIndicators) {
    if (pattern.test(query)) {
      // Check if it's completely unrelated to current context
      const isUnrelated = !containsContextTerms(query, context)
      
      if (isUnrelated) {
        return {
          classification: 'new_topic',
          shouldSearch: true,
          shouldUseContext: false,
          shouldClearContext: true,
          confidence: 0.85,
          reason: 'New topic detected - unrelated to current context',
        }
      }
    }
  }
  
  // 3. HYBRID (might use context AND search)
  if (isFollowUp && hasContext) {
    // Check if query might need additional information
    const needsMoreInfo = requiresAdditionalSearch(query, context)
    
    if (needsMoreInfo) {
      return {
        classification: 'hybrid',
        shouldSearch: true,
        shouldUseContext: true,
        shouldClearContext: false,
        confidence: 0.7,
        reason: 'Follow-up query that may need additional search',
      }
    }
    
    // Pure follow-up
    return {
      classification: 'follow_up',
      shouldSearch: false,
      shouldUseContext: true,
      shouldClearContext: false,
      confidence: 0.8,
      reason: 'Follow-up query using existing context',
    }
  }
  
  // 4. NO CONTEXT - NEW SEARCH
  if (!hasContext) {
    return {
      classification: 'new_topic',
      shouldSearch: true,
      shouldUseContext: false,
      shouldClearContext: false,
      confidence: 0.9,
      reason: 'No existing context - new search required',
    }
  }
  
  // 5. DEFAULT - NEW TOPIC
  return {
    classification: 'new_topic',
    shouldSearch: true,
    shouldUseContext: false,
    shouldClearContext: true,
    confidence: 0.7,
    reason: 'Default classification - treating as new topic',
  }
}

/**
 * Check if query contains terms related to current context
 */
function containsContextTerms(query: string, context: ConversationContext): boolean {
  if (!context.selectedEmail) return false
  
  const normalized = query.toLowerCase()
  const email = context.selectedEmail
  
  // Check for sender name or email
  if (email.sender) {
    const senderName = email.sender.split('<')[0].trim().toLowerCase()
    const senderEmail = email.sender.match(/<([^>]+)>/)?.[1]?.toLowerCase()
    
    if (senderName && normalized.includes(senderName)) return true
    if (senderEmail && normalized.includes(senderEmail)) return true
  }
  
  // Check for subject terms
  if (email.subject) {
    const subjectWords = email.subject
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
    
    for (const word of subjectWords) {
      if (normalized.includes(word)) return true
    }
  }
  
  return false
}

/**
 * Check if query requires additional search beyond context
 */
function requiresAdditionalSearch(query: string, context: ConversationContext): boolean {
  const normalized = query.toLowerCase()
  
  // Comparison queries (compare with other emails)
  const comparisonPatterns = [
    /\bcompare\s+with\b/i,
    /\bother\s+(emails?|messages?)/i,
    /\bsimilar\s+(emails?|messages?)/i,
    /\brelated\s+(emails?|messages?)/i,
  ]
  
  for (const pattern of comparisonPatterns) {
    if (pattern.test(query)) return true
  }
  
  // Thread expansion queries
  const threadPatterns = [
    /\bwhole\s+(thread|conversation)/i,
    /\bentire\s+(thread|conversation)/i,
    /\ball\s+(replies|messages)\s+in\s+this/i,
  ]
  
  for (const pattern of threadPatterns) {
    if (pattern.test(query)) {
      // Only needs search if we don't have full thread
      return context.selectedThread === null
    }
  }
  
  // Queries asking for "more" or "additional"
  if (/\b(more|additional|other)\b/i.test(query)) {
    return true
  }
  
  return false
}

/**
 * Detect if query indicates topic change
 */
export function detectTopicChange(
  currentQuery: string,
  context: ConversationContext
): boolean {
  if (!context.lastQuery) return false
  
  const analysis = analyzeQuery(currentQuery, context)
  return analysis.shouldClearContext
}

/**
 * Get human-readable description of query analysis
 */
export function describeAnalysis(analysis: QueryAnalysis): string {
  const parts = []
  
  parts.push(`Classification: ${analysis.classification}`)
  parts.push(`Search: ${analysis.shouldSearch ? 'Yes' : 'No'}`)
  parts.push(`Use Context: ${analysis.shouldUseContext ? 'Yes' : 'No'}`)
  parts.push(`Clear Context: ${analysis.shouldClearContext ? 'Yes' : 'No'}`)
  parts.push(`Confidence: ${analysis.confidence.toFixed(2)}`)
  parts.push(`Reason: ${analysis.reason}`)
  
  return parts.join(' | ')
}
