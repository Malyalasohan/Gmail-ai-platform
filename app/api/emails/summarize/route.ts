// Thread summarization using Gemini + shared retrieval function
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
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

    const { threadId } = await request.json()

    if (!threadId) {
      return NextResponse.json(
        { error: 'Thread ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Check if summary already exists
    const { data: existingEmail } = await supabase
      .from('emails')
      .select('summary')
      .eq('user_id', session.user.id)
      .eq('thread_id', threadId)
      .not('summary', 'is', null)
      .limit(1)
      .maybeSingle()

    if (existingEmail?.summary) {
      return NextResponse.json({
        success: true,
        summary: existingEmail.summary,
        cached: true,
      })
    }

    // Get all emails in thread
    const threadEmails = await retrieveThreadEmails(threadId, session.user.id)

    if (!threadEmails || threadEmails.length === 0) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      )
    }

    // Format thread context
    let context = formatEmailContext(threadEmails, true)

    // Prevent Gemini token overflow
    if (context.length > 20000) {
      context = context.substring(0, 20000)
    }

    const prompt = `
You are an AI email assistant.

Summarize the following email thread in 2-3 concise sentences.

Include:
- Main topic
- Important dates (if any)
- Action items (if any)

If it is a newsletter or promotional email,
only summarize the important information.

Email Thread:

${context}
`

    console.log("Generating summary...")

    const aiResult = await safeGenerateContent(prompt)
    
    // Handle quota exceeded error
    if (!aiResult.success && aiResult.error?.isQuotaExceeded) {
      console.warn('⚠️ Summary generation quota exceeded')
      return NextResponse.json({
        success: false,
        error: 'AI_QUOTA_EXCEEDED',
        message: 'AI service is temporarily unavailable. Please try again in a moment.',
      })
    }
    
    // Handle other errors
    if (!aiResult.success || !aiResult.text) {
      throw aiResult.error?.originalError || new Error('Failed to generate summary')
    }
    
    const summary = aiResult.text

    console.log("Summary generated successfully.")

    // Cache summary
    await supabase
      .from('emails')
      .update({ summary })
      .eq('user_id', session.user.id)
      .eq('thread_id', threadId)

    return NextResponse.json({
      success: true,
      summary,
      cached: false,
    })

  } catch (error: any) {

    console.error("===================================")
    console.error("SUMMARY ERROR")
    console.error(error)
    console.error("MESSAGE:", error?.message)
    console.error("===================================")
    
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
        error: error?.message || "Failed to generate summary",
      },
      { status: 500 }
    )
  }
}
