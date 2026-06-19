// Intent Detection for Hybrid Retrieval System
// Determines which retrieval method to use based on user query

export type IntentType =
  | 'keyword_search'
  | 'sender_search'
  | 'latest_email'
  | 'date_search'
  | 'summary_request'
  | 'category_search'
  | 'unread_search'
  | 'semantic_search'

export interface DetectedIntent {
  type: IntentType
  confidence: number
  extractedData?: {
    keyword?: string
    sender?: string
    dateRange?: 'today' | 'yesterday' | 'week' | 'month'
    category?: string
  }
}

/**
 * Detect user intent from query using rule-based pattern matching
 * Returns the most likely intent and extracted parameters
 */
export function detectIntent(query: string): DetectedIntent {
  const normalizedQuery = query.toLowerCase().trim()

  // Latest Email Patterns
  const latestPatterns = [
    /\b(latest|last|most recent|newest)\s+(email|mail|message)/i,
    /\bshow\s+(me\s+)?(the\s+)?(latest|last|most recent|newest)/i,
    /\bwhat('?s|\s+is)\s+(the\s+)?(latest|last|most recent)/i,
  ]

  for (const pattern of latestPatterns) {
    if (pattern.test(query)) {
      return {
        type: 'latest_email',
        confidence: 0.95,
      }
    }
  }

  // Date Search Patterns
  const todayPatterns = /\b(today('?s)?|this morning|this afternoon)\b/i
  const yesterdayPatterns = /\b(yesterday('?s)?|last night)\b/i
  const weekPatterns = /\b(this week|last week|past week|7 days)\b/i
  const monthPatterns = /\b(this month|last month|30 days)\b/i

  if (todayPatterns.test(query)) {
    return {
      type: 'date_search',
      confidence: 0.9,
      extractedData: { dateRange: 'today' },
    }
  }

  if (yesterdayPatterns.test(query)) {
    return {
      type: 'date_search',
      confidence: 0.9,
      extractedData: { dateRange: 'yesterday' },
    }
  }

  if (weekPatterns.test(query)) {
    return {
      type: 'date_search',
      confidence: 0.85,
      extractedData: { dateRange: 'week' },
    }
  }

  if (monthPatterns.test(query)) {
    return {
      type: 'date_search',
      confidence: 0.85,
      extractedData: { dateRange: 'month' },
    }
  }

  // Unread Search Patterns
  const unreadPatterns = [
    /\bunread\s+(email|mail|message)s?\b/i,
    /\b(email|mail|message)s?\s+I\s+haven't\s+read/i,
    /\bshow\s+(me\s+)?unread/i,
  ]

  for (const pattern of unreadPatterns) {
    if (pattern.test(query)) {
      return {
        type: 'unread_search',
        confidence: 0.9,
      }
    }
  }

  // Sender Search Patterns
  const fromPatterns = /\b(from|by|sent by)\s+([a-z0-9@\.\-\s]+)/i
  const senderPatterns = /\b(email|mail|message)s?\s+(from|by)\s+([a-z0-9@\.\-\s]+)/i

  const fromMatch = fromPatterns.exec(query)
  const senderMatch = senderPatterns.exec(query)

  if (fromMatch || senderMatch) {
    const sender = (fromMatch?.[2] || senderMatch?.[3] || '').trim()
    if (sender) {
      return {
        type: 'sender_search',
        confidence: 0.9,
        extractedData: { sender },
      }
    }
  }

  // Category Search Patterns
  const categoryMap: Record<string, string> = {
    'promotional|promotions|promo|promos|ads|advertisement': 'Promotions',
    'social|social media|facebook|twitter|linkedin': 'Social',
    'updates|update|notifications': 'Updates',
    'primary|important|inbox': 'Primary',
    'work|business|professional': 'Work',
    'personal|private': 'Personal',
    'newsletter|newsletters|subscription': 'Newsletter',
    'action required|action|urgent|todo': 'Action Required',
  }

  for (const [patterns, category] of Object.entries(categoryMap)) {
    const regex = new RegExp(`\\b(${patterns})\\b`, 'i')
    if (regex.test(query)) {
      return {
        type: 'category_search',
        confidence: 0.85,
        extractedData: { category },
      }
    }
  }

  // Summary Request Patterns
  const summaryPatterns = [
    /\b(summarize|summary|sum up|overview)\b/i,
    /\bwhat('?s|\s+is)\s+in\s+my\s+inbox/i,
    /\bgive\s+me\s+(a\s+)?(summary|overview)/i,
  ]

  for (const pattern of summaryPatterns) {
    if (pattern.test(query)) {
      return {
        type: 'summary_request',
        confidence: 0.85,
      }
    }
  }

  // Keyword Search Patterns (company names, specific terms)
  const keywordPatterns = [
    /\b(samsung|apple|google|microsoft|amazon|meta|aws|azure|gcp)\b/i,
    /\b(deloitte|accenture|pwc|kpmg|ey)\b/i,
    /\b(reddit|twitter|facebook|instagram|youtube)\b/i,
    /\b(netflix|spotify|disney|hulu)\b/i,
    /\b(job|internship|interview|offer|application)\b/i,
    /\b(meeting|calendar|schedule|appointment)\b/i,
    /\b(invoice|payment|receipt|order|shipping|delivery)\b/i,
    /\b(password|reset|verification|2fa|security)\b/i,
  ]

  // Check if query is short (1-3 words) and matches keyword patterns
  const wordCount = normalizedQuery.split(/\s+/).length
  
  if (wordCount <= 3) {
    for (const pattern of keywordPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'keyword_search',
          confidence: 0.85,
          extractedData: { keyword: query.trim() },
        }
      }
    }

    // Even without pattern match, short queries likely want keyword search
    return {
      type: 'keyword_search',
      confidence: 0.7,
      extractedData: { keyword: query.trim() },
    }
  }

  // Default to semantic search for complex queries
  return {
    type: 'semantic_search',
    confidence: 0.6,
  }
}

/**
 * Get human-readable description of detected intent
 */
export function describeIntent(intent: DetectedIntent): string {
  const { type, extractedData } = intent

  switch (type) {
    case 'keyword_search':
      return `Searching for keyword: "${extractedData?.keyword}"`
    case 'sender_search':
      return `Searching emails from: ${extractedData?.sender}`
    case 'latest_email':
      return 'Retrieving latest email'
    case 'date_search':
      return `Searching emails from: ${extractedData?.dateRange}`
    case 'unread_search':
      return 'Searching unread emails'
    case 'category_search':
      return `Searching ${extractedData?.category} emails`
    case 'summary_request':
      return 'Generating summary of recent emails'
    case 'semantic_search':
      return 'Using semantic search'
    default:
      return 'Processing query'
  }
}
