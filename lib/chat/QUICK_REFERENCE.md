# Phase 2 - Quick Reference Guide

## For Developers

### Import the Multi-Intent System

```typescript
import { planQuery } from '@/lib/chat/query-planner'
import { executeWithFallback } from '@/lib/chat/multi-search'
import { mergeResults, limitResults } from '@/lib/chat/result-merger'
```

### Basic Usage Pattern

```typescript
// 1. Plan the query
const plan = planQuery(userMessage)

// 2. Execute all searches
const results = await executeWithFallback(
  plan.intents,
  userId,
  userMessage
)

// 3. Merge and rank
const merged = mergeResults(results.sql, results.rag)

// 4. Limit to top results
const topResults = limitResults(merged.emails, 10)

// 5. Use the results
console.log(`Found ${topResults.length} unique emails`)
```

---

## Supported Intent Types

| Intent Type | Description | Example Query |
|-------------|-------------|---------------|
| `keyword` | Specific terms | "Samsung", "internship" |
| `sender` | Email sender | "from Deloitte", "emails by Reddit" |
| `date` | Time-based | "yesterday", "this week" |
| `latest` | Most recent | "latest email", "newest message" |
| `category` | Email category | "promotional", "social" |
| `semantic` | Complex queries | "tell me about..." |
| `summary` | Summary request | "summarize", "overview" |
| `unread` | Unread status | "unread emails" |

---

## Date Ranges Supported

- `today` - Emails from today
- `yesterday` - Emails from yesterday
- `week` - Last 7 days
- `month` - Last 30 days

---

## Categories Supported

- Promotions
- Social
- Updates
- Primary
- Work
- Personal
- Newsletter
- Action Required

---

## Match Types (for Ranking)

| Match Type | Priority | Points |
|------------|----------|--------|
| `exact_sender` | Highest | +50 |
| `keyword` | High | +40 |
| `date` | Medium | +30 |
| `category` | Low | +20 |
| `semantic` | Lowest | +10 |

*Plus recency bonus: +5 to +15 points*

---

## Console Log Format

### Query Plan Log
```
========== QUERY PLAN ==========
Original Query: [query]
Detected Intents: [count]
  1. [type] (confidence: [0-1])
Execution Plan: [description]
================================
```

### Search Execution Log
```
========== SEARCH EXECUTION ==========
Executing: [Search Type]
SQL Results: [count]
RAG Results: [count]
=====================================
```

### Merge Results Log
```
========== MERGE & RANK ==========
Total Sources: [count]
Unique Emails: [count]
Deduplicated: [count]
================================
```

---

## Common Patterns

### Pattern 1: Add New Intent Type

```typescript
// 1. Add to IntentType in query-planner.ts
export type IntentType = | 'keyword' | 'mynewtype'

// 2. Add detection logic in planQuery()
if (/\bmypattern\b/i.test(query)) {
  intents.push({
    type: 'mynewtype',
    confidence: 0.9,
    data: { ... }
  })
}

// 3. Add execution in multi-search.ts
case 'mynewtype':
  // Execute your search
  break
```

### Pattern 2: Customize Ranking

```typescript
// In result-merger.ts, modify calculateMatchScore()
function calculateMatchScore(email: EmailResult): number {
  let score = email.similarity * 100
  
  // Add your custom scoring
  if (email.matchType === 'mynewtype') {
    score += 60 // Custom priority
  }
  
  return score
}
```

### Pattern 3: Add Filters

```typescript
import { applyFilters } from '@/lib/chat/result-merger'

const filtered = applyFilters(emails, {
  sender: 'john@example.com',
  dateRange: { start: startDate, end: endDate },
  category: 'Work'
})
```

---

## Performance Tips

1. **SQL First**: Always try SQL search before semantic (faster)
2. **Parallel Execution**: Multiple SQL searches run concurrently
3. **Limit Results**: Use `limitResults()` to cap response size
4. **Cache Embeddings**: Ensure email embeddings are pre-generated
5. **Index Database**: Make sure `emails` table has proper indexes

---

## Debugging Checklist

Problem: **No results found**
- [ ] Check if emails are synced
- [ ] Verify embeddings exist
- [ ] Try simpler query
- [ ] Check console logs for errors

Problem: **Wrong intent detected**
- [ ] Check detection patterns in query-planner.ts
- [ ] Try rewording query
- [ ] Add custom pattern for your use case

Problem: **Slow performance**
- [ ] Check if semantic search is being used
- [ ] Verify database has indexes
- [ ] Monitor API response times
- [ ] Check embedding generation time

Problem: **Duplicate results**
- [ ] This shouldn't happen! Check merge logic
- [ ] Verify email IDs are unique
- [ ] Report as bug

---

## API Response Format

```typescript
{
  success: true,
  message: {
    id: string,
    user_id: string,
    role: 'assistant',
    content: string,
    source_email_ids: string[],
    created_at: string
  },
  sources: [
    {
      id: string,
      sender: string,
      subject: string,
      received_at: string,
      similarity: number,
      thread_id: string
    }
  ],
  hasSource: boolean
}
```

---

## TypeScript Types

```typescript
// Query Plan
interface QueryPlan {
  intents: Intent[]
  confidence: number
  originalQuery: string
  requiresMultiSearch: boolean
}

// Intent
interface Intent {
  type: IntentType
  confidence: number
  data?: {
    keyword?: string
    sender?: string
    dateRange?: 'today' | 'yesterday' | 'week' | 'month'
    category?: string
  }
}

// Search Results
interface SearchResults {
  sql: EmailResult[]
  rag: EmailResult[]
  executedSearches: string[]
}

// Email Result
interface EmailResult {
  id: string
  sender: string
  subject: string
  body_text: string
  received_at: string
  similarity: number
  matchType?: 'exact_sender' | 'keyword' | 'date' | 'category' | 'semantic'
  matchScore?: number
  // ... other fields
}

// Merged Results
interface MergedResults {
  emails: EmailResult[]
  totalSources: number
  deduplicatedCount: number
  sources: { sql: number; rag: number }
}
```

---

## Testing Shortcuts

```typescript
// Quick test in Node.js console
import { planQuery } from './lib/chat/query-planner'

const plan = planQuery("Samsung emails from yesterday")
console.log(plan)
```

```bash
# Test via curl (PowerShell)
$body = @{ message = "Samsung emails from yesterday" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method POST -Body $body -Headers @{"Content-Type"="application/json"}
```

---

## File Locations

```
gmail-ai-platform/
├── lib/
│   └── chat/
│       ├── query-planner.ts      # Multi-intent detection
│       ├── multi-search.ts       # Search executor
│       ├── result-merger.ts      # Merge & rank results
│       ├── sql-search.ts         # SQL search functions
│       ├── intents.ts            # OLD (Phase 1) - kept for reference
│       ├── HYBRID_PHASE2.md      # Full documentation
│       └── QUICK_REFERENCE.md    # This file
└── app/
    └── api/
        └── chat/
            └── route.ts          # Main chat endpoint (updated)
```

---

## Migration from Phase 1

**No migration needed!** Just replace imports:

**Before** (Phase 1):
```typescript
import { detectIntent } from '@/lib/chat/intents'
const intent = detectIntent(message)
```

**After** (Phase 2):
```typescript
import { planQuery } from '@/lib/chat/query-planner'
const plan = planQuery(message)
```

---

## Common Queries & Expected Intents

| Query | Detected Intents |
|-------|------------------|
| "Samsung" | keyword |
| "latest email" | latest |
| "emails from Reddit" | sender |
| "yesterday's emails" | date |
| "Samsung from yesterday" | keyword + date |
| "internship from Deloitte" | keyword + sender |
| "summarize today" | summary + date |

---

## Need Help?

1. **Full Docs**: Read `HYBRID_PHASE2.md`
2. **Testing**: See `../../../PHASE2_TESTING_GUIDE.md`
3. **Summary**: See `../../../PHASE2_IMPLEMENTATION_SUMMARY.md`
4. **Console Logs**: Enable verbose logging in route.ts

---

**Quick Reference Version**: 1.0  
**Phase**: 2  
**Last Updated**: June 19, 2026
