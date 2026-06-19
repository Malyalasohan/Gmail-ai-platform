// Smart Email Categories - Phase 5
// AI-powered email categorization beyond basic labels

export type SmartCategory =
  | 'interview'
  | 'recruitment'
  | 'work'
  | 'university'
  | 'finance'
  | 'shopping'
  | 'bills'
  | 'social'
  | 'travel'
  | 'newsletter'
  | 'promotion'
  | 'spam'
  | 'personal'
  | 'urgent'
  | 'other'

export interface CategoryDefinition {
  name: SmartCategory
  keywords: string[]
  senderPatterns: string[]
  priority: number
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    name: 'interview',
    keywords: [
      'interview',
      'interviewing',
      'screening call',
      'technical interview',
      'phone screen',
      'onsite',
      'meet with team',
      'coding challenge',
      'assessment',
    ],
    senderPatterns: [
      'recruiter',
      'hiring',
      'talent',
      'hr@',
      'careers@',
    ],
    priority: 95,
  },
  {
    name: 'recruitment',
    keywords: [
      'job opportunity',
      'position',
      'opening',
      'application',
      'career',
      'hiring',
      'resume',
      'cv',
    ],
    senderPatterns: [
      'linkedin',
      'indeed',
      'glassdoor',
      'recruiter',
      'jobs@',
      'careers@',
    ],
    priority: 85,
  },
  {
    name: 'work',
    keywords: [
      'project',
      'deadline',
      'meeting',
      'report',
      'client',
      'presentation',
      'review',
    ],
    senderPatterns: ['@company.com', 'slack', 'teams'],
    priority: 80,
  },
  {
    name: 'university',
    keywords: [
      'class',
      'course',
      'assignment',
      'exam',
      'grades',
      'professor',
      'lecture',
      'semester',
      'registration',
    ],
    senderPatterns: ['.edu', 'registrar', 'academic', 'student'],
    priority: 75,
  },
  {
    name: 'finance',
    keywords: [
      'invoice',
      'bill',
      'payment',
      'statement',
      'account',
      'balance',
      'transaction',
      'credit',
      'debit',
    ],
    senderPatterns: ['bank', 'paypal', 'stripe', 'billing@'],
    priority: 70,
  },
  {
    name: 'bills',
    keywords: [
      'bill',
      'due',
      'overdue',
      'payment required',
      'subscription',
      'renewal',
    ],
    senderPatterns: ['billing@', 'noreply@'],
    priority: 75,
  },
  {
    name: 'shopping',
    keywords: [
      'order',
      'shipped',
      'delivery',
      'tracking',
      'purchase',
      'cart',
    ],
    senderPatterns: [
      'amazon',
      'ebay',
      'shopify',
      'orders@',
      'shipping@',
    ],
    priority: 40,
  },
  {
    name: 'travel',
    keywords: [
      'flight',
      'hotel',
      'booking',
      'reservation',
      'itinerary',
      'check-in',
      'boarding pass',
    ],
    senderPatterns: [
      'airbnb',
      'booking.com',
      'expedia',
      'airline',
      'hotel',
    ],
    priority: 65,
  },
  {
    name: 'social',
    keywords: [
      'tagged you',
      'mentioned you',
      'commented',
      'liked',
      'friend request',
    ],
    senderPatterns: [
      'facebook',
      'twitter',
      'instagram',
      'linkedin',
      'notification@',
    ],
    priority: 30,
  },
  {
    name: 'newsletter',
    keywords: [
      'newsletter',
      'digest',
      'weekly update',
      'unsubscribe',
      'view in browser',
    ],
    senderPatterns: ['newsletter@', 'updates@', 'news@'],
    priority: 20,
  },
  {
    name: 'promotion',
    keywords: [
      'sale',
      'discount',
      'offer',
      'deal',
      'promo',
      '% off',
      'limited time',
    ],
    senderPatterns: ['marketing@', 'promotions@', 'deals@'],
    priority: 15,
  },
  {
    name: 'spam',
    keywords: [
      'click here',
      'act now',
      'winner',
      'congratulations',
      'claim your',
      'free money',
    ],
    senderPatterns: [],
    priority: 5,
  },
  {
    name: 'urgent',
    keywords: [
      'urgent',
      'asap',
      'immediately',
      'critical',
      'emergency',
      'time-sensitive',
    ],
    senderPatterns: [],
    priority: 100,
  },
]

/**
 * Categorize an email based on content and sender
 */
export function categorizeEmail(
  sender: string,
  subject: string,
  bodyText: string
): SmartCategory {
  const text = `${subject} ${bodyText}`.toLowerCase()
  const senderLower = sender.toLowerCase()

  let bestMatch: { category: SmartCategory; score: number } = {
    category: 'other',
    score: 0,
  }

  for (const def of CATEGORY_DEFINITIONS) {
    let score = 0

    // Check keywords
    for (const keyword of def.keywords) {
      if (text.includes(keyword)) {
        score += 2
      }
    }

    // Check sender patterns
    for (const pattern of def.senderPatterns) {
      if (senderLower.includes(pattern)) {
        score += 3
      }
    }

    if (score > bestMatch.score) {
      bestMatch = { category: def.name, score }
    }
  }

  // Return best match if score is meaningful
  return bestMatch.score >= 2 ? bestMatch.category : 'other'
}

/**
 * Batch categorize multiple emails
 */
export function categorizeEmails(
  emails: Array<{
    id: string
    sender: string
    subject: string
    body_text: string
  }>
): Map<string, SmartCategory> {
  console.log('========== CATEGORIZATION ==========')
  console.log('Categorizing Emails:', emails.length)

  const categorized = new Map<string, SmartCategory>()

  for (const email of emails) {
    const category = categorizeEmail(
      email.sender,
      email.subject,
      email.body_text
    )
    categorized.set(email.id, category)
  }

  // Log category distribution
  const distribution = new Map<SmartCategory, number>()
  for (const category of categorized.values()) {
    distribution.set(category, (distribution.get(category) || 0) + 1)
  }

  console.log('Category Distribution:')
  distribution.forEach((count, category) => {
    console.log(`  - ${category}: ${count}`)
  })
  console.log('====================================')

  return categorized
}

/**
 * Group emails by category
 */
export function groupByCategory(
  emails: any[],
  categories: Map<string, SmartCategory>
): Map<SmartCategory, any[]> {
  const grouped = new Map<SmartCategory, any[]>()

  for (const email of emails) {
    const category = categories.get(email.id) || 'other'
    if (!grouped.has(category)) {
      grouped.set(category, [])
    }
    grouped.get(category)!.push(email)
  }

  return grouped
}

/**
 * Get category priority score
 */
export function getCategoryPriority(category: SmartCategory): number {
  const def = CATEGORY_DEFINITIONS.find((d) => d.name === category)
  return def?.priority || 50
}

/**
 * Get high priority categories
 */
export function getHighPriorityCategories(): SmartCategory[] {
  return CATEGORY_DEFINITIONS.filter((d) => d.priority >= 70).map(
    (d) => d.name
  )
}
