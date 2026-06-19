/**
 * Local fallback response generation when Gemini API is unavailable
 * Generates lightweight summaries from retrieved email sources WITHOUT any AI API calls
 */

interface EmailSource {
  id: string
  sender: string
  subject: string
  received_at: string
  category?: string | null
  similarity?: number
  thread_id?: string
}

/**
 * Generate a local search response from email sources
 * Used when Gemini quota is exceeded
 */
export function generateLocalSearchResponse(
  emails: EmailSource[],
  query: string
): string {
  if (emails.length === 0) {
    return "I couldn't find any matching emails for your query."
  }

  if (emails.length === 1) {
    const email = emails[0]
    return `I found one matching email:\n\n**Subject:** ${email.subject}\n**From:** ${email.sender}\n**Received:** ${formatDate(email.received_at)}`
  }

  // Multiple emails
  let response = `I found ${emails.length} matching email(s).\n\n**Top Results:**\n\n`
  
  // Show top 10 results
  const topEmails = emails.slice(0, 10)
  
  topEmails.forEach((email, index) => {
    response += `${index + 1}. **${email.subject}**\n`
    response += `   From: ${email.sender}\n`
    response += `   Date: ${formatDate(email.received_at)}\n\n`
  })

  if (emails.length > 10) {
    response += `\n_...and ${emails.length - 10} more_`
  }

  return response
}

/**
 * Generate local response for sender-based queries
 */
export function generateLocalSenderSearch(
  emails: EmailSource[],
  sender: string
): string {
  if (emails.length === 0) {
    return `I couldn't find any emails from ${sender}.`
  }

  if (emails.length === 1) {
    const email = emails[0]
    return `I found one email from ${sender}:\n\n**Subject:** ${email.subject}\n**Received:** ${formatDate(email.received_at)}`
  }

  let response = `I found ${emails.length} email(s) from ${sender}.\n\n**Recent emails:**\n\n`
  
  const topEmails = emails.slice(0, 10)
  
  topEmails.forEach((email, index) => {
    response += `${index + 1}. ${email.subject}\n`
    response += `   ${formatDate(email.received_at)}\n\n`
  })

  if (emails.length > 10) {
    response += `\n_...and ${emails.length - 10} more_`
  }

  return response
}

/**
 * Generate local response for date-based queries
 */
export function generateLocalDateSearch(
  emails: EmailSource[],
  dateDescription: string
): string {
  if (emails.length === 0) {
    return `I couldn't find any emails from ${dateDescription}.`
  }

  if (emails.length === 1) {
    const email = emails[0]
    return `I found one email from ${dateDescription}:\n\n**Subject:** ${email.subject}\n**From:** ${email.sender}\n**Received:** ${formatDate(email.received_at)}`
  }

  let response = `I found ${emails.length} email(s) from ${dateDescription}.\n\n`
  
  const topEmails = emails.slice(0, 10)
  
  topEmails.forEach((email, index) => {
    response += `${index + 1}. **${email.subject}**\n`
    response += `   From: ${email.sender}\n`
    response += `   Date: ${formatDate(email.received_at)}\n\n`
  })

  if (emails.length > 10) {
    response += `\n_...and ${emails.length - 10} more_`
  }

  return response
}

/**
 * Generate local summary for category-based queries
 */
export function generateLocalCategorySummary(
  emails: EmailSource[],
  category: string
): string {
  if (emails.length === 0) {
    return `I couldn't find any ${category} emails.`
  }

  if (emails.length === 1) {
    const email = emails[0]
    return `I found one ${category} email:\n\n**Subject:** ${email.subject}\n**From:** ${email.sender}\n**Received:** ${formatDate(email.received_at)}`
  }

  let response = `I found ${emails.length} ${category} email(s).\n\n`
  
  const topEmails = emails.slice(0, 10)
  
  topEmails.forEach((email, index) => {
    response += `${index + 1}. **${email.subject}**\n`
    response += `   From: ${email.sender}\n`
    response += `   Date: ${formatDate(email.received_at)}\n\n`
  })

  if (emails.length > 10) {
    response += `\n_...and ${emails.length - 10} more_`
  }

  return response
}

/**
 * Generate local response for latest emails
 */
export function generateLocalLatestEmail(emails: EmailSource[]): string {
  if (emails.length === 0) {
    return "I couldn't find any recent emails."
  }

  if (emails.length === 1) {
    const email = emails[0]
    return `Your latest email:\n\n**Subject:** ${email.subject}\n**From:** ${email.sender}\n**Received:** ${formatDate(email.received_at)}`
  }

  let response = `Your ${emails.length} most recent email(s):\n\n`
  
  const topEmails = emails.slice(0, 10)
  
  topEmails.forEach((email, index) => {
    response += `${index + 1}. **${email.subject}**\n`
    response += `   From: ${email.sender}\n`
    response += `   Date: ${formatDate(email.received_at)}\n\n`
  })

  return response
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  
  // Check if today
  const isToday = 
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  
  if (isToday) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }
  
  // Check if yesterday
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const isYesterday = 
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  
  if (isYesterday) {
    return 'Yesterday'
  }
  
  // Check if this year
  const isThisYear = date.getFullYear() === now.getFullYear()
  
  if (isThisYear) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  
  // Different year
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Smart response generator that chooses the best format based on query
 * BUG FIX: Handle follow-up questions that require context
 */
export function generateSmartLocalResponse(
  emails: EmailSource[],
  query: string
): string {
  const lowerQuery = query.toLowerCase()
  
  // BUG FIX: Handle follow-up questions
  if (emails.length === 1) {
    const email = emails[0]
    
    // Who sent it?
    if (lowerQuery.includes('who sent') || lowerQuery.includes('sender')) {
      return `The sender is: **${email.sender}**`
    }
    
    // When was it received?
    if (lowerQuery.includes('when') && (lowerQuery.includes('received') || lowerQuery.includes('sent'))) {
      return `This email was received: **${formatDate(email.received_at)}**`
    }
    
    // Summarize it (cannot do without AI, return metadata)
    if (lowerQuery.includes('summarize') || lowerQuery.includes('summary')) {
      return `**Subject:** ${email.subject}\n**From:** ${email.sender}\n**Received:** ${formatDate(email.received_at)}\n\nI can't generate a full summary without AI, but here's what I can tell you about this email.`
    }
    
    // Show thread
    if (lowerQuery.includes('thread') || lowerQuery.includes('conversation')) {
      return `This email is part of thread: **${email.thread_id}**\n\n**Subject:** ${email.subject}\n**From:** ${email.sender}\n**Received:** ${formatDate(email.received_at)}`
    }
  }
  
  // Detect query type and generate appropriate response
  if (lowerQuery.includes('from') || lowerQuery.includes('sender')) {
    // Try to extract sender name
    const senderMatch = query.match(/from\s+([a-zA-Z\s]+)/i)
    const sender = senderMatch ? senderMatch[1].trim() : 'this sender'
    return generateLocalSenderSearch(emails, sender)
  }
  
  if (lowerQuery.includes('yesterday') || lowerQuery.includes('today') || lowerQuery.includes('last week')) {
    let dateDesc = 'recently'
    if (lowerQuery.includes('yesterday')) dateDesc = 'yesterday'
    else if (lowerQuery.includes('today')) dateDesc = 'today'
    else if (lowerQuery.includes('last week')) dateDesc = 'last week'
    return generateLocalDateSearch(emails, dateDesc)
  }
  
  if (lowerQuery.includes('latest') || lowerQuery.includes('recent') || lowerQuery.includes('newest')) {
    return generateLocalLatestEmail(emails)
  }
  
  // Check for category keywords
  const categories = ['work', 'personal', 'promotional', 'social', 'updates', 'forums']
  for (const category of categories) {
    if (lowerQuery.includes(category)) {
      return generateLocalCategorySummary(emails, category)
    }
  }
  
  // Default: generic search response
  return generateLocalSearchResponse(emails, query)
}
