// Multi-Search Executor
// Executes multiple search operations based on query plan

import { Intent } from './query-planner'
import {
  searchByKeyword,
  searchBySender,
  searchLatestEmail,
  searchByDate,
  searchUnread,
  searchByCategory,
  convertToRAGFormat,
} from './sql-search'
import { retrieveRelevantEmails } from '../retrieval'
import { EmailResult } from './result-merger'

export interface SearchResults {
  sql: EmailResult[]
  rag: EmailResult[]
  executedSearches: string[]
  individualResults?: Map<string, EmailResult[]> // BUG FIX: Track individual search results for intersection
}

/**
 * Execute all searches based on detected intents
 * Returns combined SQL and RAG results
 */
export async function executeMultiSearch(
  intents: Intent[],
  userId: string,
  originalQuery: string
): Promise<SearchResults> {
  console.log('========== MULTI-SEARCH EXECUTOR ==========')
  console.log('Intents to execute:', intents.length)

  const sqlResults: EmailResult[] = []
  const executedSearches: string[] = []
  const individualResults = new Map<string, EmailResult[]>() // BUG FIX: Track each search separately
  let needsSemanticSearch = false

  // Execute all SQL-based searches
  for (const intent of intents) {
    try {
      switch (intent.type) {
        case 'keyword':
          if (intent.data?.keyword) {
            console.log(`Executing: Keyword Search - "${intent.data.keyword}"`)
            const results = await searchByKeyword(intent.data.keyword, userId, 50) // BUG FIX: Fetch more for intersection
            const formatted = convertToRAGFormat(results, 0.95, 'keyword')
            sqlResults.push(...formatted)
            individualResults.set(`keyword:${intent.data.keyword}`, formatted) // BUG FIX: Track individually
            executedSearches.push(`Keyword: "${intent.data.keyword}"`)
          }
          break

        case 'sender':
          if (intent.data?.sender) {
            console.log(`Executing: Sender Search - ${intent.data.sender}`)
            const results = await searchBySender(intent.data.sender, userId, 50)
            const formatted = convertToRAGFormat(results, 0.95, 'exact_sender')
            sqlResults.push(...formatted)
            individualResults.set(`sender:${intent.data.sender}`, formatted) // BUG FIX: Track individually
            executedSearches.push(`Sender: ${intent.data.sender}`)
          }
          break

        case 'latest':
          console.log('Executing: Latest Email Search')
          const latestResults = await searchLatestEmail(userId)
          const latestFormatted = convertToRAGFormat(latestResults, 0.95, 'date')
          sqlResults.push(...latestFormatted)
          individualResults.set('latest', latestFormatted) // BUG FIX: Track individually
          executedSearches.push('Latest Email')
          break

        case 'date':
          if (intent.data?.dateRange) {
            console.log(`Executing: Date Search - ${intent.data.dateRange}`)
            const results = await searchByDate(intent.data.dateRange, userId, 50)
            const formatted = convertToRAGFormat(results, 0.95, 'date')
            sqlResults.push(...formatted)
            individualResults.set(`date:${intent.data.dateRange}`, formatted) // BUG FIX: Track individually
            executedSearches.push(`Date: ${intent.data.dateRange}`)
          }
          break

        case 'unread':
          console.log('Executing: Unread Search')
          const unreadResults = await searchUnread(userId, 50)
          const unreadFormatted = convertToRAGFormat(unreadResults, 0.95, 'keyword')
          sqlResults.push(...unreadFormatted)
          individualResults.set('unread', unreadFormatted) // BUG FIX: Track individually
          executedSearches.push('Unread Emails')
          break

        case 'category':
          if (intent.data?.category) {
            console.log(`Executing: Category Search - ${intent.data.category}`)
            const results = await searchByCategory(intent.data.category, userId, 50)
            const formatted = convertToRAGFormat(results, 0.95, 'category')
            sqlResults.push(...formatted)
            individualResults.set(`category:${intent.data.category}`, formatted) // BUG FIX: Track individually
            executedSearches.push(`Category: ${intent.data.category}`)
          }
          break

        case 'summary':
          console.log('Executing: Summary Search (Recent Emails)')
          const summaryResults = await searchByDate('today', userId, 20)
          const summaryFormatted = convertToRAGFormat(summaryResults, 0.95, 'date')
          sqlResults.push(...summaryFormatted)
          individualResults.set('summary', summaryFormatted) // BUG FIX: Track individually
          executedSearches.push('Summary: Today\'s emails')
          break

        case 'semantic':
          needsSemanticSearch = true
          break
      }
    } catch (error) {
      console.error(`Error executing ${intent.type} search:`, error)
      // Continue with other searches
    }
  }

  // Execute semantic search if needed OR as fallback
  let ragResults: EmailResult[] = []

  if (needsSemanticSearch || sqlResults.length === 0) {
    try {
      console.log('Executing: Semantic Search (RAG)')
      const semanticResults = await retrieveRelevantEmails(originalQuery, userId, 10, 0.4)
      ragResults = semanticResults.map(r => ({
        ...r,
        matchType: 'semantic' as const
      }))
      individualResults.set('semantic', ragResults) // BUG FIX: Track individually
      executedSearches.push('Semantic Search (RAG)')
    } catch (error) {
      console.error('Error executing semantic search:', error)
    }
  }

  console.log('SQL Results:', sqlResults.length)
  console.log('RAG Results:', ragResults.length)
  console.log('Individual Searches:', individualResults.size)
  console.log('Executed Searches:', executedSearches.join(', '))
  console.log('==========================================')

  return {
    sql: sqlResults,
    rag: ragResults,
    executedSearches,
    individualResults, // BUG FIX: Return individual results for intersection
  }
}

/**
 * Automatic fallback chain
 * If SQL returns nothing -> Try semantic
 * If semantic returns nothing -> Try keyword
 * If still nothing -> Return empty
 */
export async function executeWithFallback(
  intents: Intent[],
  userId: string,
  originalQuery: string
): Promise<SearchResults> {
  console.log('========== FALLBACK CHAIN ==========')

  // First attempt: Execute planned searches
  let results = await executeMultiSearch(intents, userId, originalQuery)

  // If no SQL results and no semantic intent, try semantic as fallback
  if (results.sql.length === 0 && !intents.some((i) => i.type === 'semantic')) {
    console.log('No SQL results, trying semantic fallback...')
    try {
      const semanticResults = await retrieveRelevantEmails(originalQuery, userId, 10, 0.4)
      results.rag = semanticResults.map(r => ({
        ...r,
        matchType: 'semantic' as const
      }))
      results.executedSearches.push('Semantic Fallback')
    } catch (error) {
      console.error('Semantic fallback error:', error)
    }
  }

  // If still no results and query is short, try keyword search
  if (
    results.sql.length === 0 &&
    results.rag.length === 0 &&
    originalQuery.split(/\s+/).length <= 3
  ) {
    console.log('No results, trying keyword fallback...')
    try {
      const keywordResults = await searchByKeyword(originalQuery.trim(), userId, 10)
      const formatted = convertToRAGFormat(keywordResults, 0.9, 'keyword')
      results.sql = formatted
      results.executedSearches.push('Keyword Fallback')
    } catch (error) {
      console.error('Keyword fallback error:', error)
    }
  }

  console.log('Final SQL Results:', results.sql.length)
  console.log('Final RAG Results:', results.rag.length)
  console.log('===================================')

  return results
}
