# Hybrid Retrieval System Documentation

## Overview

The Hybrid Retrieval System combines **SQL-based structured search** with **Vector-based semantic search (RAG)** to provide accurate and reliable email retrieval for the AI Chat feature.

## Architecture

```
User Query
    ↓
Intent Detection (intents.ts)
    ↓
Route to Search Method
    ├─→ SQL Search (sql-search.ts)
    │   ├─ Keyword Search
    │   ├─ Sender Search
    │   ├─ Latest Email
    │   ├─ Date Search
    │   ├─ Unread Search
    │   └─ Category Search
    │
    └─→ Semantic Search (retrieval.ts)
        └─ Vector Similarity (RAG)
    ↓
Fallback to RAG (if SQL returns 0 results)
    ↓
Gemini AI Response Generation
    ↓
Answer with Source Attribution
```

## Components

### 1. Intent Detection (`lib/chat/intents.ts`)

**Purpose:** Analyzes user queries to determine the best retrieval strategy.

**Supported Intents:**

| Intent Type | Example Queries | Confidence |
|-------------|----------------|------------|
| `keyword_search` | "Samsung", "AWS", "job", "meeting" | 0.7-0.85 |
| `sender_search` | "emails from Reddit", "mails by Amazon" | 0.9 |
| `latest_email` | "latest email", "most recent mail", "last message" | 0.95 |
| `date_search` | "today's emails", "yesterday mails", "last week" | 0.85-0.9 |
| `unread_search` | "unread emails", "emails I haven't read" | 0.9 |
| `category_search` | "promotional emails", "work emails", "social" | 0.85 |
| `summary_request` | "summarize today's emails", "overview of inbox" | 0.85 |
| `semantic_search` | Complex questions, "What internships did I receive?" | 0.6 |

**Key Functions:**

- `detectIntent(query: string)`: Returns detected intent with confidence score
- `describeIntent(intent)`: Human-readable description for logging

### 2. SQL Search Service (`lib/chat/sql-search.ts`)

**Purpose:** Executes structured database queries for deterministic searches.

**Functions:**

#### `searchByKeyword(keyword, userId, limit)`
- Searches `subject`, `sender`, and `body_text` using ILIKE
- Case-insensitive partial matching
- Returns most recent matches first

#### `searchBySender(sender, userId, limit)`
- Searches `sender` field using ILIKE
- Supports partial names (e.g., "Reddit" matches "notifications@reddit.com")

#### `searchLatestEmail(userId)`
- Returns single most recent email
- Ordered by `received_at` descending

#### `searchByDate(dateRange, userId, limit)`
- Supported ranges: `today`, `yesterday`, `week`, `month`
- Filters by `received_at` timestamp

#### `searchUnread(userId, limit)`
- **Note:** Requires `is_read` field (not yet implemented)
- Currently returns recent emails as fallback

#### `searchByCategory(category, userId, limit)`
- Exact match on `category` field
- Categories: Work, Personal, Newsletter, Promotions, Social, Updates, Primary, Action Required

#### `convertToRAGFormat(results, similarity)`
- Converts SQL results to match RAG format
- Adds `similarity` score and `chunk_text` field

### 3. Updated Chat Route (`app/api/chat/route.ts`)

**Workflow:**

1. **Authenticate** user session
2. **Store** user message in `chat_messages`
3. **Detect intent** using `detectIntent()`
4. **Route to search method:**
   - If intent is SQL-compatible → execute SQL search
   - If SQL returns 0 results → fallback to RAG
   - If intent is `semantic_search` → use RAG directly
5. **Quality check** using `hasQualityResults()`
6. **Generate response** with Gemini
7. **Store** assistant message with source attribution
8. **Return** response with sources

**Enhanced Logging:**

```typescript
========== HYBRID RETRIEVAL START ==========
Detected Intent: keyword_search
Intent Description: Searching for keyword: "Samsung"
Confidence: 0.85
==========================================
========== SQL KEYWORD SEARCH ==========
Keyword: Samsung
User: <user_id>
Limit: 10
Results: 5
1. Samsung Account Update from accounts@samsung.com
2. Galaxy S24 Announcement from news@samsung.com
...
=======================================
========== FINAL RESULTS ==========
Method Used: SQL Search
Results Count: 5
==================================
```

## Usage Examples

### Keyword Search
```
User: "Samsung"
Intent: keyword_search (0.85)
Method: SQL - searchByKeyword("Samsung")
Result: All emails mentioning Samsung in subject/sender/body
```

### Sender Search
```
User: "emails from Reddit"
Intent: sender_search (0.9)
Method: SQL - searchBySender("Reddit")
Result: All emails from Reddit
```

### Latest Email
```
User: "show latest email"
Intent: latest_email (0.95)
Method: SQL - searchLatestEmail()
Result: Most recent email by received_at
```

### Date Search
```
User: "today's emails"
Intent: date_search (0.9, dateRange: today)
Method: SQL - searchByDate("today")
Result: All emails received today
```

### Semantic Search (Complex Query)
```
User: "What internship opportunities did I receive this month?"
Intent: semantic_search (0.6)
Method: RAG - retrieveRelevantEmails()
Result: Vector similarity search on embeddings
```

### Fallback Scenario
```
User: "Samsung"
Intent: keyword_search (0.85)
Method: SQL - searchByKeyword("Samsung")
SQL Results: 0
Fallback: RAG - retrieveRelevantEmails("Samsung")
Result: Vector similarity search (backup)
```

## Benefits

### 1. **Deterministic Results**
SQL searches provide predictable, exact matches for structured queries (keywords, senders, dates).

### 2. **Improved Accuracy**
Queries like "latest email", "Samsung", "emails from Reddit" now work reliably instead of failing with RAG.

### 3. **Intelligent Fallback**
Automatic fallback to RAG ensures no query goes unanswered.

### 4. **Transparent Logging**
Comprehensive console logs show intent detection, search method, and result counts for debugging.

### 5. **Maintained Functionality**
All existing features (Compose, Reply, Summarize, Inbox) remain unchanged.

## Testing Queries

After implementation, test these queries:

### Should Use SQL
- ✅ "Samsung"
- ✅ "AWS"
- ✅ "Reddit"
- ✅ "Amazon"
- ✅ "latest email"
- ✅ "last mail"
- ✅ "show today's emails"
- ✅ "show yesterday emails"
- ✅ "show last week's emails"
- ✅ "emails from reddit"
- ✅ "emails from samsung"
- ✅ "job emails" (keyword)
- ✅ "meeting emails" (keyword)
- ✅ "promotional emails" (category)

### Should Use RAG
- ✅ "What internships did I receive?"
- ✅ "Summarize my important emails"
- ✅ "What did John say about the project?"
- ✅ "Find emails about Python development"

## Future Enhancements

### Phase 2 Improvements
1. **Add `is_read` field** to emails table for unread search
2. **Hybrid scoring** - combine SQL + RAG results with weighted scores
3. **Query expansion** - use LLM to expand keywords before SQL search
4. **Smart date parsing** - "last Monday", "two weeks ago", "Q1 2025"
5. **Multi-intent queries** - "unread emails from Reddit today"
6. **Performance optimization** - cache frequent queries, add more indexes

## Files Changed

| File | Status | Description |
|------|--------|-------------|
| `lib/chat/intents.ts` | ✅ Created | Intent detection logic |
| `lib/chat/sql-search.ts` | ✅ Created | SQL search functions |
| `app/api/chat/route.ts` | ✅ Modified | Hybrid retrieval integration |
| `lib/retrieval.ts` | ✅ Unchanged | Used for fallback RAG |
| `lib/gemini.ts` | ✅ Unchanged | Used for response generation |

## Migration Notes

- **No breaking changes** to existing API
- **No database migrations** required
- **No UI changes** needed
- **Backward compatible** with existing chat history
- **Drop-in replacement** for pure RAG system

## Debugging

Enable detailed logging by checking server console output:

```bash
npm run dev
```

Look for these log sections:
- `HYBRID RETRIEVAL START` - Intent detection
- `SQL [METHOD] SEARCH` - SQL query execution  
- `FALLBACK TO RAG` - When SQL returns 0 results
- `FINAL RESULTS` - Summary of retrieval method and count
