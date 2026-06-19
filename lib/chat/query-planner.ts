// Multi-Intent Query Planner
// Detects and extracts ALL intents from a single user query
// Replaces single-intent detection with comprehensive multi-intent analysis

export type IntentType =
  | 'keyword'
  | 'sender'
  | 'date'
  | 'latest'
  | 'category'
  | 'semantic'
  | 'summary'
  | 'unread'

export interface Intent {
  type: IntentType
  confidence: number
  data?: {
    keyword?: string
    sender?: string
    dateRange?: 'today' | 'yesterday' | 'week' | 'month'
    category?: string
  }
}

export interface QueryPlan {
  intents: Intent[]
  confidence: number
  originalQuery: string
  requiresMultiSearch: boolean
}

/**
 * Analyze query and detect ALL relevant intents
 * Returns a complete execution plan with all detected intents
 */
export function planQuery(query: string): QueryPlan {
  const normalizedQuery = query.toLowerCase().trim()
  const intents: Intent[] = []

  // 1. LATEST EMAIL DETECTION
  const latestPatterns = [
    /\b(latest|last|most recent|newest)\s+(email|mail|message)/i,
    /\bshow\s+(me\s+)?(the\s+)?(latest|last|most recent|newest)/i,
  ]

  for (const pattern of latestPatterns) {
    if (pattern.test(query)) {
      intents.push({
        type: 'latest',
        confidence: 0.95,
      })
      break
    }
  }

  // 2. DATE DETECTION
  const datePatterns = {
    today: /\b(today('?s)?|this morning|this afternoon)\b/i,
    yesterday: /\b(yesterday('?s)?|last night)\b/i,
    week: /\b(this week|last week|past week|7 days)\b/i,
    month: /\b(this month|last month|30 days)\b/i,
  }

  for (const [range, pattern] of Object.entries(datePatterns)) {
    if (pattern.test(query)) {
      intents.push({
        type: 'date',
        confidence: 0.9,
        data: { dateRange: range as 'today' | 'yesterday' | 'week' | 'month' },
      })
      break
    }
  }

  // 3. UNREAD DETECTION
  const unreadPatterns = [
    /\bunread\s+(email|mail|message)s?\b/i,
    /\b(email|mail|message)s?\s+I\s+haven't\s+read/i,
    /\bshow\s+(me\s+)?unread/i,
  ]

  for (const pattern of unreadPatterns) {
    if (pattern.test(query)) {
      intents.push({
        type: 'unread',
        confidence: 0.9,
      })
      break
    }
  }

  // 4. SENDER DETECTION
  const fromPatterns = /\b(from|by|sent by)\s+([a-z0-9@\.\-\s]+?)(?:\s+(?:yesterday|today|this week|last week|received|about|regarding|$))/i
  const senderMatch = fromPatterns.exec(query)

  if (senderMatch) {
    const sender = senderMatch[2].trim()
    if (sender && sender.length > 1) {
      intents.push({
        type: 'sender',
        confidence: 0.9,
        data: { sender },
      })
    }
  }

  // 5. KEYWORD DETECTION (BUG FIX: Prioritize before category detection)
  // Named entities like LinkedIn, Samsung, Google should be treated as keywords first
  const keywordPatterns = [
    /\b(samsung|apple|google|microsoft|amazon|meta|aws|azure|gcp)\b/i,
    /\b(deloitte|accenture|pwc|kpmg|ey)\b/i,
    /\b(reddit|twitter|facebook|instagram|youtube|linkedin)\b/i, // BUG FIX: Added linkedin here
    /\b(netflix|spotify|disney|hulu)\b/i,
    /\b(openai|anthropic|github|gitlab|bitbucket)\b/i, // BUG FIX: Added more tech companies
    /\b(job|internship|interview|offer|application|opportunity|opportunities)\b/i,
    /\b(meeting|calendar|schedule|appointment)\b/i,
    /\b(invoice|payment|receipt|order|shipping|delivery)\b/i,
    /\b(password|reset|verification|2fa|security)\b/i,
  ]

  for (const pattern of keywordPatterns) {
    const match = pattern.exec(query)
    if (match) {
      const keyword = match[0].trim()
      // Check if we already have this as a keyword intent
      const existingKeyword = intents.find(
        (i) => i.type === 'keyword' && i.data?.keyword === keyword
      )
      if (!existingKeyword) {
        intents.push({
          type: 'keyword',
          confidence: 0.95, // BUG FIX: Higher confidence for named entities
          data: { keyword },
        })
      }
    }
  }

  // 6. CATEGORY DETECTION (comes after keyword detection)
  // BUG FIX: If keyword already detected, skip category for that term
  const hasKeywordIntent = intents.some((i) => i.type === 'keyword')
  
  if (!hasKeywordIntent) {
    const categoryMap: Record<string, string> = {
      'promotional|promotions|promo|promos|ads|advertisement': 'Promotions',
      'social|social media': 'Social', // BUG FIX: Removed specific platforms from category
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
        intents.push({
          type: 'category',
          confidence: 0.75, // BUG FIX: Lower confidence than keywords
          data: { category },
        })
        break
      }
    }
  }

  // 7. SUMMARY DETECTION
  const summaryPatterns = [
    /\b(summarize|summary|sum up|overview)\b/i,
    /\bwhat('?s|\s+is)\s+in\s+my\s+inbox/i,
  ]

  for (const pattern of summaryPatterns) {
    if (pattern.test(query)) {
      intents.push({
        type: 'summary',
        confidence: 0.85,
      })
      break
    }
  }

  // 8. SEMANTIC FALLBACK
  // If query is complex and no strong structured intents found
  const hasStructuredIntent = intents.some(
    (i) => i.type !== 'semantic' && i.confidence >= 0.8
  )

  if (!hasStructuredIntent || intents.length === 0) {
    intents.push({
      type: 'semantic',
      confidence: 0.6,
    })
  }

  // Calculate overall confidence
  const avgConfidence =
    intents.length > 0
      ? intents.reduce((sum, i) => sum + i.confidence, 0) / intents.length
      : 0

  return {
    intents,
    confidence: avgConfidence,
    originalQuery: query,
    requiresMultiSearch: intents.length > 1,
  }
}

/**
 * Get human-readable execution plan description
 */
export function describePlan(plan: QueryPlan): string {
  const { intents, requiresMultiSearch } = plan

  if (intents.length === 0) {
    return 'No clear intent detected'
  }

  if (intents.length === 1) {
    return describeIntent(intents[0])
  }

  const descriptions = intents.map((intent) => describeIntent(intent))
  return `Multi-search required:\n  - ${descriptions.join('\n  - ')}`
}

function describeIntent(intent: Intent): string {
  switch (intent.type) {
    case 'keyword':
      return `Keyword: "${intent.data?.keyword}"`
    case 'sender':
      return `Sender: ${intent.data?.sender}`
    case 'date':
      return `Date: ${intent.data?.dateRange}`
    case 'latest':
      return 'Latest email'
    case 'category':
      return `Category: ${intent.data?.category}`
    case 'unread':
      return 'Unread emails'
    case 'summary':
      return 'Summary request'
    case 'semantic':
      return 'Semantic search'
    default:
      return 'Unknown intent'
  }
}
