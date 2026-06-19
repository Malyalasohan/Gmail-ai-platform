import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { formatEmailContext, hasQualityResults } from '@/lib/retrieval'
import { safeGenerateContent, isQuotaExceededError } from '@/lib/ai-provider'
import { planQuery, describePlan } from '@/lib/chat/query-planner'
import { executeWithFallback } from '@/lib/chat/multi-search'
import { mergeResults, limitResults } from '@/lib/chat/result-merger'
import {
  decideContext,
  updateContextAfterSearch,
  updateContextAfterResponse,
  buildContextForPrompt,
  logContextDecision,
} from '@/lib/chat/context-manager'
import { generateSmartLocalResponse } from '@/lib/chat/local-response'
// Phase 4: Action imports
import {
  detectActionIntent,
  isConfirmation,
  formatActionConfirmation,
} from '@/lib/gmail/actions'
import {
  storePendingConfirmation,
  getPendingConfirmation,
  hasPendingConfirmation,
  cancelPendingConfirmation,
} from '@/lib/gmail/confirmations'
import { replyToEmail } from '@/lib/gmail/reply'
import { archiveEmails } from '@/lib/gmail/archive'
import { deleteEmails } from '@/lib/gmail/delete'
import { starEmails } from '@/lib/gmail/star'
import { manageLabels } from '@/lib/gmail/labels'
import { forwardEmail } from '@/lib/gmail/forward'
import { saveActionHistory } from '@/lib/gmail/history'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { message } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // ========== PHASE 4: ACTION DETECTION ==========
    // Check if user is confirming/cancelling a pending action
    if (hasPendingConfirmation(session.user.id)) {
      const confirmation = isConfirmation(message)

      if (confirmation !== null) {
        const pending = getPendingConfirmation(session.user.id)

        if (!pending) {
          return NextResponse.json({
            success: true,
            message: {
              role: 'assistant',
              content:
                'Your confirmation has expired. Please make a new request.',
            },
          })
        }

        // User cancelled
        if (confirmation === false) {
          cancelPendingConfirmation(session.user.id)

          await supabase.from('chat_messages').insert([
            { user_id: session.user.id, role: 'user', content: message },
            {
              user_id: session.user.id,
              role: 'assistant',
              content: 'Action cancelled.',
            },
          ])

          return NextResponse.json({
            success: true,
            message: {
              role: 'assistant',
              content: 'Action cancelled.',
            },
          })
        }

        // User confirmed - execute the action
        console.log('========== ACTION EXECUTION ==========')
        console.log('Action:', pending.action.type)
        console.log('Email Count:', pending.emailIds.length)
        console.log('======================================')

        const actionResult = await executeAction(
          pending.action.type,
          pending.emailIds,
          session.user.id,
          session.user.email!,
          pending.action.data
        )

        // Store messages
        await supabase.from('chat_messages').insert([
          { user_id: session.user.id, role: 'user', content: message },
          {
            user_id: session.user.id,
            role: 'assistant',
            content: actionResult.message,
            source_email_ids: pending.emailIds,
          },
        ])

        // Save to history
        await saveActionHistory({
          user_id: session.user.id,
          action: pending.action.type,
          email_ids: pending.emailIds,
          thread_ids: [],
          status: actionResult.success ? 'success' : 'failure',
          metadata: pending.action.data,
        })

        return NextResponse.json({
          success: true,
          message: {
            role: 'assistant',
            content: actionResult.message,
          },
          actionExecuted: true,
        })
      }
    }

    // ========== PHASE 3: CONVERSATION CONTEXT ==========
    console.log('========== CONVERSATION CONTEXT ==========')
    
    // Step 1: Analyze query and decide context strategy
    const contextDecision = await decideContext(message, session.user.id)
    logContextDecision(contextDecision)
    
    // Store user message
    const { error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: session.user.id,
        role: 'user',
        content: message,
      })
      .select()
      .single()

    if (userMessageError) throw userMessageError

    // ========== PHASE 4: ACTION DETECTION (Check BEFORE search) ==========
    // Build preliminary context string for action detection
    const preliminaryContext = buildContextForPrompt(contextDecision)
    const actionIntent = await detectActionIntent(message, preliminaryContext)

    // If action detected AND we have context emails, execute on context
    if (actionIntent.type !== 'none' && contextDecision.contextEmails.length > 0) {
      console.log('========== ACTION DETECTED WITH CONTEXT ==========')
      console.log('Action Type:', actionIntent.type)
      console.log('Confidence:', actionIntent.confidence)
      console.log('Using Context Emails:', contextDecision.contextEmails.length)
      console.log('Selected Email:', contextDecision.selectedEmail?.subject || 'None')
      console.log('=================================================')

      // Select target emails from context (NOT from search)
      const targetEmails = selectTargetEmails(
        contextDecision.contextEmails,
        actionIntent.data
      )

      if (targetEmails.length === 0) {
        return NextResponse.json({
          success: true,
          message: {
            role: 'assistant',
            content: "I couldn't find the emails you're referring to. Could you be more specific?",
          },
        })
      }

      // For dangerous actions, require confirmation
      if (actionIntent.requiresConfirmation) {
        const confirmationMessage = formatActionConfirmation(
          actionIntent,
          targetEmails.length
        )

        storePendingConfirmation(
          session.user.id,
          actionIntent,
          targetEmails.map((e) => e.id)
        )

        await supabase.from('chat_messages').insert([
          {
            user_id: session.user.id,
            role: 'assistant',
            content: confirmationMessage,
            source_email_ids: targetEmails.map((e) => e.id),
          },
        ])

        return NextResponse.json({
          success: true,
          message: {
            role: 'assistant',
            content: confirmationMessage,
          },
          requiresConfirmation: true,
          sources: targetEmails.map((email) => ({
            id: email.id,
            sender: email.sender,
            subject: email.subject,
            received_at: email.received_at,
            thread_id: email.thread_id,
          })),
        })
      }

      // Execute safe actions immediately
      const actionResult = await executeAction(
        actionIntent.type,
        targetEmails.map((e) => e.id),
        session.user.id,
        session.user.email!,
        actionIntent.data
      )

      // Store messages
      await supabase.from('chat_messages').insert([
        {
          user_id: session.user.id,
          role: 'assistant',
          content: actionResult.message,
          source_email_ids: targetEmails.map((e) => e.id),
        },
      ])

      // Save to history
      await saveActionHistory({
        user_id: session.user.id,
        action: actionIntent.type,
        email_ids: targetEmails.map((e) => e.id),
        thread_ids: [...new Set(targetEmails.map((e) => e.thread_id))],
        status: actionResult.success ? 'success' : 'failure',
        metadata: actionIntent.data,
      })

      return NextResponse.json({
        success: true,
        message: {
          role: 'assistant',
          content: actionResult.message,
        },
        actionExecuted: true,
        sources: targetEmails.map((email) => ({
          id: email.id,
          sender: email.sender,
          subject: email.subject,
          received_at: email.received_at,
          thread_id: email.thread_id,
        })),
      })
    }

    // Step 2: If follow-up with context, skip search and use existing context
    if (contextDecision.isFollowUp && !contextDecision.requiresSearch) {
      console.log('========== FOLLOW-UP QUERY (No Search) ==========')
      console.log('Using Existing Context')
      console.log('Selected Email:', contextDecision.selectedEmail?.subject || 'None')
      console.log('Context Emails:', contextDecision.contextEmails.length)
      console.log('Conversation History:', contextDecision.conversationHistory.length)
      console.log('=================================================')
      
      // Build context string for LLM
      const contextString = buildContextForPrompt(contextDecision)
      
      // Generate response using context
      const prompt = `You are an AI Email Assistant helping a user with their Gmail.
The user is asking a follow-up question about previously retrieved emails.

CRITICAL RULES:
- Use the SELECTED EMAIL and CONVERSATION HISTORY provided below
- This is a follow-up question - reference the previous context
- Answer based ONLY on the information provided
- Be conversational and reference previous exchanges naturally
- If you need information not in the context, say so

${contextString}

Current User Question: ${message}

Your answer:`

      const aiResult = await safeGenerateContent(prompt)
      
      // Handle quota exceeded error - generate local response
      if (!aiResult.success && aiResult.error?.isQuotaExceeded) {
        console.log('⚠️ Quota exceeded - generating local response from context')
        
        const sources = contextDecision.contextEmails.map(email => ({
          id: email.id,
          sender: email.sender,
          subject: email.subject,
          received_at: email.received_at,
          similarity: email.similarity,
          thread_id: email.thread_id,
          category: email.category ?? undefined,
        }))
        
        // Generate local response from retrieved emails
        const localResponse = generateSmartLocalResponse(sources, message)
        
        const sourceIds = sources.map(email => email.id)
        
        const { data: assistantMessage } = await supabase
          .from('chat_messages')
          .insert({
            user_id: session.user.id,
            role: 'assistant',
            content: localResponse,
            source_email_ids: sourceIds,
          })
          .select()
          .single()

        return NextResponse.json({
          success: true,
          localResponse: true,
          message: assistantMessage,
          sources,
          hasSource: true,
          isFollowUp: true,
        })
      }
      
      // Handle other errors
      if (!aiResult.success || !aiResult.text) {
        throw aiResult.error?.originalError || new Error('Failed to generate response')
      }
      
      const response = aiResult.text
      
      // Get source IDs from context
      const sourceIds = contextDecision.contextEmails.map(email => email.id)
      
      // Store assistant response
      const { data: assistantMessage, error: assistantError } = await supabase
        .from('chat_messages')
        .insert({
          user_id: session.user.id,
          role: 'assistant',
          content: response,
          source_email_ids: sourceIds,
        })
        .select()
        .single()

      if (assistantError) throw assistantError
      
      // Update conversation history
      const sources = contextDecision.contextEmails.map(email => ({
        id: email.id,
        sender: email.sender,
        subject: email.subject,
        received_at: email.received_at,
        similarity: email.similarity,
        thread_id: email.thread_id,
      }))
      
      updateContextAfterResponse(
        session.user.id,
        message,
        response,
        sources
      )

      return NextResponse.json({
        success: true,
        message: assistantMessage,
        sources,
        hasSource: true,
        isFollowUp: true,
      })
    }

    // ========== MULTI-INTENT QUERY PLANNER ==========
    console.log('========== QUERY PLAN ==========')
    console.log('Original Query:', message)
    
    // Step 1: Detect ALL intents in the query
    const plan = planQuery(message)
    
    console.log('Detected Intents:', plan.intents.length)
    plan.intents.forEach((intent, idx) => {
      console.log(`  ${idx + 1}. ${intent.type} (confidence: ${intent.confidence.toFixed(2)})`)
      if (intent.data) {
        console.log(`     Data:`, intent.data)
      }
    })
    console.log('Execution Plan:', describePlan(plan))
    console.log('Requires Multi-Search:', plan.requiresMultiSearch)
    console.log('Overall Confidence:', plan.confidence.toFixed(2))
    console.log('================================')

    // Step 2: Execute ALL required searches
    console.log('========== SEARCH EXECUTION ==========')
    const searchResults = await executeWithFallback(
      plan.intents,
      session.user.id,
      message
    )
    
    console.log('SQL Results:', searchResults.sql.length)
    console.log('RAG Results:', searchResults.rag.length)
    console.log('Executed Searches:', searchResults.executedSearches.join(' | '))
    console.log('=====================================')

    // Step 3: Merge and deduplicate results
    console.log('========== MERGE & RANK ==========')
    const merged = mergeResults(searchResults.sql, searchResults.rag, searchResults.individualResults)
    const relevantEmails = limitResults(merged.emails, 10)
    
    console.log('Total Sources:', merged.totalSources)
    console.log('Unique Emails:', merged.emails.length)
    console.log('Deduplicated:', merged.deduplicatedCount)
    console.log('Final Results:', relevantEmails.length)
    console.log('================================')

    console.log('========== FINAL RESULTS ==========')
    console.log('Method Used: Multi-Intent Query Planning')
    console.log('Results Count:', relevantEmails.length)
    if (relevantEmails.length > 0) {
      console.log('Top Results:')
      relevantEmails.slice(0, 5).forEach((email, idx) => {
        console.log(`  ${idx + 1}. ${email.subject} (${email.matchType}, score: ${email.matchScore?.toFixed(2)})`)
      })
    }
    console.log('==================================')

    // Step 3: Update context with search results
    const intentTypes = plan.intents.map(intent => intent.type)
    updateContextAfterSearch(
      session.user.id,
      message,
      intentTypes,
      relevantEmails,
      relevantEmails.map(email => ({
        id: email.id,
        sender: email.sender,
        subject: email.subject,
        received_at: email.received_at,
        similarity: email.similarity,
        thread_id: email.thread_id,
      }))
    )

    // ========== CONTINUE WITH REGULAR SEARCH-BASED RESPONSE ==========

    // Hallucination prevention: check quality
    if (!hasQualityResults(relevantEmails, 0.4)) {
      // No quality results found - return explicit "not found" response
      const notFoundResponse = "I couldn't find anything in your emails about that. Could you try rephrasing your question or asking about something else?"

      const { data: assistantMessage } = await supabase
        .from('chat_messages')
        .insert({
          user_id: session.user.id,
          role: 'assistant',
          content: notFoundResponse,
          source_email_ids: [], // Empty array - no sources
        })
        .select()
        .single()

      return NextResponse.json({
        success: true,
        message: assistantMessage,
        sources: [],
        hasSource: false,
        isFollowUp: false,
      })
    }

    // Format context for LLM (combine search results + conversation history)
    const emailContext = formatEmailContext(relevantEmails, true)
    const conversationHistoryContext = buildContextForPrompt(contextDecision)

    // Generate response with context-aware instructions
    const searchDetails = searchResults.executedSearches.length > 1
      ? `multiple search methods: ${searchResults.executedSearches.join(', ')}`
      : searchResults.executedSearches[0] || 'semantic search'

    const isContextAware = contextDecision.conversationHistory.length > 0

    const prompt = `You are an AI Email Assistant helping a user search their Gmail inbox.
${isContextAware ? 'This is a CONVERSATIONAL interaction - the user may be asking follow-up questions.' : ''}
Answer questions based ONLY on the emails provided below.

CRITICAL RULES:
- Only use information from the emails and conversation history provided
- Never hallucinate or make up information
- If the emails don't contain the answer, say "I couldn't find that information in these emails"
- Cite which email(s) you're referencing when relevant (e.g., "In the email from John...")
- Be specific, accurate, and conversational
- Keep responses concise but complete
${isContextAware ? '- Reference previous conversation naturally when relevant' : ''}

SEARCH METHOD USED: ${searchDetails}
${plan.requiresMultiSearch ? `This query required multiple search operations to find the most relevant results.` : ''}

${conversationHistoryContext ? `${conversationHistoryContext}\n\n` : ''}Emails from the user's inbox:

${emailContext}

User's question: ${message}

Your answer:`

    console.log("Retrieved Emails:", relevantEmails.length)
    if (relevantEmails.length > 0) {
      console.log("Sources (unique emails only):")
      relevantEmails.forEach((email, index) => {
        console.log(
          `${index + 1}. ${email.subject} | Match: ${email.matchType} | Similarity: ${email.similarity.toFixed(2)}`
        )
      })
    }

    const aiResult = await safeGenerateContent(prompt)
    
    // Handle quota exceeded error - generate local response
    if (!aiResult.success && aiResult.error?.isQuotaExceeded) {
      console.log('⚠️ Quota exceeded - generating local response from search results')
      
      const sources = relevantEmails.map(email => ({
        id: email.id,
        sender: email.sender,
        subject: email.subject,
        received_at: email.received_at,
        similarity: email.similarity,
        thread_id: email.thread_id,
        category: email.category ?? undefined,
      }))
      
      // Generate local response from retrieved emails
      const localResponse = generateSmartLocalResponse(sources, message)
      
      const sourceIds = sources.map(email => email.id)
      
      const { data: assistantMessage } = await supabase
        .from('chat_messages')
        .insert({
          user_id: session.user.id,
          role: 'assistant',
          content: localResponse,
          source_email_ids: sourceIds,
        })
        .select()
        .single()

      return NextResponse.json({
        success: true,
        localResponse: true,
        message: assistantMessage,
        sources,
        hasSource: true,
        isFollowUp: contextDecision.isFollowUp,
      })
    }
    
    // Handle other errors
    if (!aiResult.success || !aiResult.text) {
      throw aiResult.error?.originalError || new Error('Failed to generate response')
    }
    
    const response = aiResult.text

    // Extract source email IDs for attribution
    const sourceIds = relevantEmails.map(email => email.id)

    // Store assistant response with source attribution
    const { data: assistantMessage, error: assistantError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: session.user.id,
        role: 'assistant',
        content: response,
        source_email_ids: sourceIds,
      })
      .select()
      .single()

    if (assistantError) throw assistantError

    // Return response with source emails for frontend display
    const sources = relevantEmails.map(email => ({
      id: email.id,
      sender: email.sender,
      subject: email.subject,
      received_at: email.received_at,
      similarity: email.similarity,
      thread_id: email.thread_id,
    }))

    // Update conversation history
    updateContextAfterResponse(
      session.user.id,
      message,
      response,
      sources
    )

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      sources,
      hasSource: true,
      isFollowUp: contextDecision.isFollowUp,
    })
  } catch (error: any) {
    console.error('Chat error:', error)
    
    // Check if it's a quota error that wasn't caught earlier
    if (isQuotaExceededError(error)) {
      console.warn('⚠️ Gemini API quota exceeded (uncaught)')
      return NextResponse.json(
        {
          success: false,
          error: 'AI_QUOTA_EXCEEDED',
          message: 'AI service is temporarily unavailable. Please try again in a moment.',
        },
        { status: 200 } // Return 200 to prevent client-side error
      )
    }
    
    return NextResponse.json(
      {
        error: 'Failed to process message',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}

// ========== PHASE 4: ACTION HELPERS ==========

/**
 * Select target emails based on action data
 */
function selectTargetEmails(emails: any[], actionData?: any): any[] {
  if (!actionData?.targetSelection || actionData.targetSelection === 'current') {
    // Default: first email or all if multiple
    return emails.length === 1 ? emails : [emails[0]]
  }

  switch (actionData.targetSelection) {
    case 'first':
      return emails.slice(0, 1)
    case 'last':
      return emails.slice(-1)
    case 'all':
      return emails
    case 'sender':
      if (actionData.targetValue) {
        return emails.filter((e) =>
          e.sender.toLowerCase().includes(actionData.targetValue.toLowerCase())
        )
      }
      return emails
    case 'subject':
      if (actionData.targetValue) {
        return emails.filter((e) =>
          e.subject
            .toLowerCase()
            .includes(actionData.targetValue.toLowerCase())
        )
      }
      return emails
    default:
      return [emails[0]]
  }
}

/**
 * Execute an action on selected emails
 */
async function executeAction(
  actionType: string,
  emailIds: string[],
  userId: string,
  userEmail: string,
  actionData?: any
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient()

  // Fetch email details
  const { data: emails, error } = await supabase
    .from('emails')
    .select('id, gmail_message_id, thread_id, sender, subject')
    .in('id', emailIds)
    .eq('user_id', userId)

  if (error || !emails || emails.length === 0) {
    return {
      success: false,
      message: 'Failed to find emails.',
    }
  }

  const gmailMessageIds = emails.map((e) => e.gmail_message_id)
  const threadIds = [...new Set(emails.map((e) => e.thread_id))]

  try {
    switch (actionType) {
      case 'reply':
        if (emails.length > 1) {
          return {
            success: false,
            message:
              'I can only reply to one email at a time. Please specify which email.',
          }
        }
        const replyResult = await replyToEmail({
          emailId: emails[0].id,
          threadId: emails[0].thread_id,
          userId,
          userEmail,
          style: actionData?.replyStyle,
          language: actionData?.language,
        })
        return {
          success: replyResult.success,
          message:
            replyResult.message ||
            replyResult.error ||
            'Reply sent.',
        }

      case 'archive':
        const archiveResult = await archiveEmails({
          emailIds,
          gmailMessageIds,
          userEmail,
        })
        return {
          success: archiveResult.success,
          message: `Archived ${archiveResult.archived} email(s).`,
        }

      case 'delete':
      case 'trash':
        const deleteResult = await deleteEmails({
          emailIds,
          gmailMessageIds,
          userEmail,
          moveToTrash: true,
        })
        return {
          success: deleteResult.success,
          message: `Deleted ${deleteResult.deleted} email(s).`,
        }

      case 'star':
        const starResult = await starEmails({
          emailIds,
          gmailMessageIds,
          userEmail,
          star: true,
        })
        return {
          success: starResult.success,
          message: `Starred ${starResult.modified} email(s).`,
        }

      case 'unstar':
        const unstarResult = await starEmails({
          emailIds,
          gmailMessageIds,
          userEmail,
          star: false,
        })
        return {
          success: unstarResult.success,
          message: `Unstarred ${unstarResult.modified} email(s).`,
        }

      case 'mark_read':
        const readResult = await manageLabels({
          emailIds,
          gmailMessageIds,
          userEmail,
          operation: 'read',
        })
        return {
          success: readResult.success,
          message: `Marked ${readResult.modified} email(s) as read.`,
        }

      case 'mark_unread':
        const unreadResult = await manageLabels({
          emailIds,
          gmailMessageIds,
          userEmail,
          operation: 'unread',
        })
        return {
          success: unreadResult.success,
          message: `Marked ${unreadResult.modified} email(s) as unread.`,
        }

      case 'forward':
        if (emails.length > 1) {
          return {
            success: false,
            message:
              'I can only forward one email at a time. Please specify which email.',
          }
        }
        if (!actionData?.forwardTo) {
          return {
            success: false,
            message: 'Please specify the email address to forward to.',
          }
        }
        const forwardResult = await forwardEmail({
          emailId: emails[0].id,
          threadId: emails[0].thread_id,
          userId,
          userEmail,
          forwardTo: actionData.forwardTo,
        })
        return {
          success: forwardResult.success,
          message:
            forwardResult.message ||
            forwardResult.error ||
            'Email forwarded.',
        }

      default:
        return {
          success: false,
          message: `Action "${actionType}" is not yet implemented.`,
        }
    }
  } catch (error: any) {
    console.error('Execute action error:', error)
    return {
      success: false,
      message: error.message || 'Failed to execute action.',
    }
  }
}

// Get chat history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceClient()

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(100) // Last 100 messages

    if (error) throw error

    // For each assistant message with sources, fetch source email details
    const messagesWithSources = await Promise.all(
      messages.map(async (msg) => {
        if (msg.role === 'assistant' && msg.source_email_ids?.length > 0) {
          const { data: sourceEmails } = await supabase
            .from('emails')
            .select('id, sender, subject, received_at, thread_id')
            .in('id', msg.source_email_ids)

          return {
            ...msg,
            sources: sourceEmails || [],
          }
        }
        return {
          ...msg,
          sources: [],
        }
      })
    )

    return NextResponse.json({
      success: true,
      messages: messagesWithSources,
    })
  } catch (error: any) {
    console.error('Get chat history error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch chat history',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
