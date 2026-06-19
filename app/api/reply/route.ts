// Thread-aware reply generation using Gemini + shared retrieval
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { retrieveThreadEmails, formatEmailContext } from '@/lib/retrieval'
import { safeGenerateContent, isQuotaExceededError } from '@/lib/ai-provider'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { threadId, prompt } = await request.json()

    if (!threadId || !prompt) {
      return NextResponse.json(
        { error: 'Thread ID and prompt are required' },
        { status: 400 }
      )
    }

    // Use shared retrieval function to get full thread context
    const threadEmails = await retrieveThreadEmails(threadId, session.user.id)

    if (threadEmails.length === 0) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      )
    }

    // Format thread as context
    const threadContext = formatEmailContext(threadEmails, true)

    // Get the latest email for reply metadata
    const latestEmail = threadEmails[threadEmails.length - 1]

    // Generate reply with full thread awareness
    const fullPrompt = `You are replying to an email thread. Here is the full conversation:

${threadContext}

User's instruction for the reply: ${prompt}

Generate a professional reply that:
- Acknowledges the thread context
- Addresses the user's instruction
- Maintains appropriate tone
- Is concise but complete
- No placeholder text like [Your Name] - leave signature blank

Generate ONLY the email body, nothing else.`

    const aiResult = await safeGenerateContent(fullPrompt)
    
    // Handle quota exceeded error
    if (!aiResult.success && aiResult.error?.isQuotaExceeded) {
      console.warn('⚠️ Reply generation quota exceeded')
      return NextResponse.json({
        success: false,
        error: 'AI_QUOTA_EXCEEDED',
        message: 'AI service is temporarily unavailable. Please try again in a moment.',
      })
    }
    
    // Handle other errors
    if (!aiResult.success || !aiResult.text) {
      throw aiResult.error?.originalError || new Error('Failed to generate reply')
    }
    
    const replyBody = aiResult.text

    // Subject is typically Re: original subject
    const originalSubject = latestEmail.subject || '(No subject)'
    const replySubject = originalSubject.startsWith('Re:') 
      ? originalSubject 
      : `Re: ${originalSubject}`

    return NextResponse.json({
      success: true,
      draft: {
        subject: replySubject,
        body: replyBody.trim(),
        to: latestEmail.sender, // Reply to sender
        threadId: threadId,
        inReplyTo: latestEmail.gmail_message_id,
      },
    })
  } catch (error: any) {
    console.error('Reply error:', error)
    
    // Check if it's a quota error
    if (isQuotaExceededError(error)) {
      console.warn('⚠️ Gemini API quota exceeded')
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
        error: 'Failed to generate reply',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
