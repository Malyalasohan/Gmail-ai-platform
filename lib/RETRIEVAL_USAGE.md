# Shared Retrieval Function — Usage Guide

**Location:** `lib/retrieval.ts`

This is the **single source of truth** for email retrieval across the entire application. Use these functions instead of writing custom retrieval logic.

## Functions

### 1. `retrieveRelevantEmails()`

**Purpose:** Semantic search over user's emails using vector similarity

**Signature:**
```typescript
async function retrieveRelevantEmails(
  query: string,
  userId: string,
  topK: number = 5,
  similarityThreshold: number = 0.7
): Promise<RetrievedEmail[]>
```

**Usage:**
```typescript
import { retrieveRelevantEmails } from '@/lib/retrieval'

const results = await retrieveRelevantEmails(
  "What did my manager say about the project deadline?",
  session.user.id,
  5,      // Get top 5 results
  0.7     // Minimum 70% similarity
)
```

**Use Cases:**
- Phase 3: Thread summarization context
- Phase 4: Compose/reply draft generation
- Phase 5: Chat agent RAG queries

---

### 2. `retrieveThreadEmails()`

**Purpose:** Get all emails in a specific Gmail thread

**Signature:**
```typescript
async function retrieveThreadEmails(
  threadId: string,
  userId: string
): Promise<RetrievedEmail[]>
```

**Usage:**
```typescript
import { retrieveThreadEmails } from '@/lib/retrieval'

const threadEmails = await retrieveThreadEmails(
  email.thread_id,
  session.user.id
)
```

**Use Cases:**
- Phase 4: Thread-aware reply generation
- Any feature that needs full conversation history

---

### 3. `hasQualityResults()`

**Purpose:** Hallucination prevention — check if results meet quality threshold

**Signature:**
```typescript
function hasQualityResults(
  results: RetrievedEmail[],
  minSimilarity: number = 0.7
): boolean
```

**Usage:**
```typescript
import { retrieveRelevantEmails, hasQualityResults } from '@/lib/retrieval'

const results = await retrieveRelevantEmails(query, userId)

if (!hasQualityResults(results)) {
  return "I couldn't find anything in your emails about that"
}

// Safe to use results for LLM generation
```

**Use Cases:**
- Phase 5: Chat agent response validation
- Any feature that needs to avoid hallucination

---

### 4. `formatEmailContext()`

**Purpose:** Format retrieved emails as context for LLM prompts

**Signature:**
```typescript
function formatEmailContext(
  emails: RetrievedEmail[],
  includeBody: boolean = true
): string
```

**Usage:**
```typescript
import { retrieveRelevantEmails, formatEmailContext } from '@/lib/retrieval'

const results = await retrieveRelevantEmails(query, userId)
const context = formatEmailContext(results)

const prompt = `Based on these emails:\n\n${context}\n\nAnswer: ${query}`
```

**Output Format:**
```
[Email 1]
From: sender@example.com
To: recipient@example.com
Subject: Meeting Tomorrow
Date: 6/18/2026, 10:30:00 AM
Category: Work

Email body text here...

---

[Email 2]
...
```

**Use Cases:**
- All LLM prompt construction (summarization, drafts, chat)

---

## RetrievedEmail Type

```typescript
interface RetrievedEmail {
  id: string                    // Email UUID
  gmail_message_id: string      // Gmail's message ID
  thread_id: string             // Gmail thread ID
  sender: string                // From header
  recipient: string             // To header
  subject: string               // Email subject
  body_text: string             // Full email body
  received_at: string           // ISO timestamp
  category: string | null       // AI-assigned category
  similarity: number            // Similarity score (0-1)
  chunk_text: string            // The specific chunk that matched
}
```

## Best Practices

### ✅ DO
- Use the shared function instead of writing custom queries
- Check `hasQualityResults()` before generating LLM responses
- Use `formatEmailContext()` for consistent prompt formatting
- Pass appropriate `topK` based on use case (3-10 typical)
- Adjust `similarityThreshold` if needed (0.7 is a good default)

### ❌ DON'T
- Don't query `email_embeddings` directly — use these functions
- Don't skip the hallucination check in user-facing features
- Don't generate embeddings manually — they're auto-generated after sync
- Don't duplicate retrieval logic in other files

## Examples by Phase

### Phase 3: Thread Summarization
```typescript
// Get thread emails for context
const threadEmails = await retrieveThreadEmails(threadId, userId)

// Format as context
const context = formatEmailContext(threadEmails)

// Generate summary
const summary = await generateText(
  "Summarize this email thread in 2-3 sentences, flag any action items:",
  context
)
```

### Phase 4: Compose Draft
```typescript
// Get relevant emails for context
const relevantEmails = await retrieveRelevantEmails(
  userPrompt, 
  userId, 
  3  // Just top 3 for compose context
)

const context = formatEmailContext(relevantEmails)

// Generate draft
const draft = await generateText(
  `Write an email about: ${userPrompt}`,
  context
)
```

### Phase 5: Chat Agent
```typescript
// Retrieve relevant emails
const results = await retrieveRelevantEmails(userMessage, userId, 5, 0.7)

// Hallucination check
if (!hasQualityResults(results, 0.7)) {
  return {
    role: 'assistant',
    content: "I couldn't find anything in your emails about that",
    source_email_ids: []
  }
}

// Format and generate response
const context = formatEmailContext(results)
const response = await generateText(
  `Answer this question based ONLY on the provided emails: ${userMessage}`,
  context
)

// Store with attribution
const sourceIds = results.map(r => r.id)
```

## Performance Notes

- Vector search is indexed (IVFFlat on pgvector)
- Typical query time: 50-200ms for 5 results
- Scales well up to ~10K emails per user
- For larger datasets, consider increasing `match_threshold` to reduce search space

## Debugging

If retrieval isn't working:

1. **Check embeddings exist:**
   ```sql
   SELECT COUNT(*) FROM email_embeddings WHERE email_id IN (
     SELECT id FROM emails WHERE user_id = 'your-user-id'
   );
   ```

2. **Test raw vector search:**
   ```sql
   SELECT search_emails(
     ARRAY[0.1, 0.2, ...]::vector(768),  -- Dummy embedding
     0.3,  -- threshold
     5,    -- limit
     'your-user-id'::uuid
   );
   ```

3. **Use the test endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/retrieval/test \
     -H "Content-Type: application/json" \
     -d '{"query": "test", "topK": 5}'
   ```

---

**Remember:** This function is built once, used everywhere. Don't duplicate its logic!
