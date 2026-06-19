// Result Merger for Multi-Intent Query System
// Merges results from multiple search operations, removes duplicates, and ranks by relevance

export interface EmailResult {
  id: string
  gmail_message_id: string
  thread_id: string
  sender: string
  recipient: string
  subject: string
  body_text: string
  received_at: string
  category: string | null
  summary?: string | null
  similarity: number
  chunk_text: string
  // Metadata for ranking
  matchType?: 'exact_sender' | 'keyword' | 'date' | 'category' | 'semantic'
  matchScore?: number
}

export interface MergedResults {
  emails: EmailResult[]
  totalSources: number
  deduplicatedCount: number
  sources: {
    sql: number
    rag: number
  }
}

/**
 * Merge results from multiple searches and remove duplicates
 * Ranks results by relevance using multiple factors
 * BUG FIX: When multiple structural searches exist, use intersection instead of union
 */
export function mergeResults(
  sqlResults: EmailResult[],
  ragResults: EmailResult[],
  individualResults?: Map<string, EmailResult[]>
): MergedResults {
  console.log('========== RESULT MERGER ==========')
  console.log('SQL Results:', sqlResults.length)
  console.log('RAG Results:', ragResults.length)
  
  // BUG FIX: Implement intersection logic for multi-intent queries
  let finalResults: EmailResult[] = []
  
  if (individualResults && individualResults.size > 1) {
    // Multiple searches - need intersection
    console.log('Multiple search intents detected - applying INTERSECTION logic')
    const searchKeys = Array.from(individualResults.keys())
    console.log('Search keys:', searchKeys.join(', '))
    
    // Start with first search results
    const firstKey = searchKeys[0]
    const firstResults = individualResults.get(firstKey) || []
    const candidateMap = new Map<string, EmailResult>()
    
    firstResults.forEach(email => {
      candidateMap.set(email.id, email)
    })
    
    console.log(`Starting with ${candidateMap.size} emails from ${firstKey}`)
    
    // For each subsequent search, keep only emails that exist in ALL searches
    for (let i = 1; i < searchKeys.length; i++) {
      const currentKey = searchKeys[i]
      const currentResults = individualResults.get(currentKey) || []
      const currentIds = new Set(currentResults.map(e => e.id))
      
      console.log(`Intersecting with ${currentResults.length} emails from ${currentKey}`)
      
      // Keep only emails that exist in current search
      const intersection = new Map<string, EmailResult>()
      for (const [id, email] of candidateMap.entries()) {
        if (currentIds.has(id)) {
          intersection.set(id, email)
        }
      }
      
      candidateMap.clear()
      intersection.forEach((email, id) => candidateMap.set(id, email))
      
      console.log(`After intersection: ${candidateMap.size} emails remain`)
    }
    
    finalResults = Array.from(candidateMap.values())
    console.log(`Final intersection result: ${finalResults.length} emails`)
    
    // If intersection is empty, fall back to union (original behavior)
    if (finalResults.length === 0) {
      console.log('⚠️ Intersection is empty - falling back to union')
      const emailMap = new Map<string, EmailResult>()
      
      sqlResults.forEach(email => {
        if (!emailMap.has(email.id)) {
          emailMap.set(email.id, {
            ...email,
            matchType: email.matchType || 'keyword',
            matchScore: calculateMatchScore(email),
          })
        }
      })
      
      finalResults = Array.from(emailMap.values())
    } else {
      // Add match scores to intersection results
      finalResults = finalResults.map(email => ({
        ...email,
        matchType: email.matchType || 'keyword',
        matchScore: calculateMatchScore(email),
      }))
    }
  } else {
    // Single search or no individual tracking - use original union logic
    console.log('Single search intent - applying UNION logic')
    const emailMap = new Map<string, EmailResult>()
    
    // Add SQL results first (higher priority)
    for (const email of sqlResults) {
      if (!emailMap.has(email.id)) {
        emailMap.set(email.id, {
          ...email,
          matchType: email.matchType || 'keyword',
          matchScore: calculateMatchScore(email),
        })
      }
    }
    
    // Add RAG results (only if not already included)
    for (const email of ragResults) {
      if (!emailMap.has(email.id)) {
        emailMap.set(email.id, {
          ...email,
          matchType: email.matchType || 'semantic',
          matchScore: calculateMatchScore(email),
        })
      } else {
        // Update similarity if RAG has higher score
        const existing = emailMap.get(email.id)!
        if (email.similarity > existing.similarity) {
          existing.similarity = email.similarity
          existing.matchScore = calculateMatchScore(email)
        }
      }
    }
    
    finalResults = Array.from(emailMap.values())
  }

  // Rank the final results
  const rankedEmails = rankResults(finalResults)

  const totalSources = sqlResults.length + ragResults.length
  const deduplicatedCount = totalSources - finalResults.length

  console.log('Merged Unique Emails:', finalResults.length)
  console.log('Deduplicated Count:', deduplicatedCount)
  console.log('==================================')

  return {
    emails: rankedEmails,
    totalSources,
    deduplicatedCount,
    sources: { sql: sqlResults.length, rag: ragResults.length },
  }
}

/**
 * Calculate match score for ranking
 * Higher score = more relevant
 */
function calculateMatchScore(email: EmailResult): number {
  let score = 0

  // Base similarity score (0-100)
  score += email.similarity * 100

  // Match type bonus
  switch (email.matchType) {
    case 'exact_sender':
      score += 50
      break
    case 'keyword':
      score += 40
      break
    case 'date':
      score += 30
      break
    case 'category':
      score += 20
      break
    case 'semantic':
      score += 10
      break
  }

  // Recency bonus (more recent = higher score)
  const receivedDate = new Date(email.received_at)
  const now = new Date()
  const daysDiff = (now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24)

  if (daysDiff < 1) {
    score += 15 // Today
  } else if (daysDiff < 7) {
    score += 10 // This week
  } else if (daysDiff < 30) {
    score += 5 // This month
  }

  return score
}

/**
 * Rank results by relevance
 * Priority order:
 * 1. Exact sender match
 * 2. Keyword match
 * 3. Date match
 * 4. Category match
 * 5. Semantic similarity
 * 6. Recency (newest first)
 */
function rankResults(emails: EmailResult[]): EmailResult[] {
  return emails.sort((a, b) => {
    // First, compare by match score
    const scoreDiff = (b.matchScore || 0) - (a.matchScore || 0)
    if (scoreDiff !== 0) return scoreDiff

    // If scores are equal, prefer higher similarity
    const simDiff = b.similarity - a.similarity
    if (simDiff !== 0) return simDiff

    // Finally, prefer more recent emails
    const dateA = new Date(a.received_at).getTime()
    const dateB = new Date(b.received_at).getTime()
    return dateB - dateA
  })
}

/**
 * Merge multiple SQL result arrays
 * Used when combining results from different SQL searches
 */
export function mergeSQLResults(...resultArrays: EmailResult[][]): EmailResult[] {
  const emailMap = new Map<string, EmailResult>()

  for (const results of resultArrays) {
    for (const email of results) {
      if (!emailMap.has(email.id)) {
        emailMap.set(email.id, email)
      }
    }
  }

  return Array.from(emailMap.values())
}

/**
 * Apply filters to merged results
 * Used for additional filtering after merge
 */
export function applyFilters(
  emails: EmailResult[],
  filters: {
    sender?: string
    dateRange?: { start: Date; end: Date }
    category?: string
    unread?: boolean
  }
): EmailResult[] {
  let filtered = [...emails]

  if (filters.sender) {
    const senderPattern = filters.sender.toLowerCase()
    filtered = filtered.filter((email) =>
      email.sender.toLowerCase().includes(senderPattern)
    )
  }

  if (filters.dateRange) {
    filtered = filtered.filter((email) => {
      const emailDate = new Date(email.received_at)
      return (
        emailDate >= filters.dateRange!.start &&
        emailDate <= filters.dateRange!.end
      )
    })
  }

  if (filters.category) {
    filtered = filtered.filter((email) => email.category === filters.category)
  }

  return filtered
}

/**
 * Limit results to top N by rank
 */
export function limitResults(emails: EmailResult[], limit: number): EmailResult[] {
  return emails.slice(0, limit)
}
