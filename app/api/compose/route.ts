// AI-assisted email composition using Gemini + shared retrieval
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { retrieveRelevantEmails, formatEmailContext, hasQualityResults } from '@/lib/retrieval'
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

    const { prompt, to } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Use shared retrieval function to get relevant context
    // This helps the AI understand the user's communication style and relevant info
    const relevantEmails = await retrieveRelevantEmails(
      prompt,
      session.user.id,
      3, // Just top 3 for compose context
      0.6 // Slightly lower threshold for compose
    )

    let context = ''
    if (hasQualityResults(relevantEmails, 0.6)) {
      context = `Here are some relevant emails from the user's inbox for context:\n\n${formatEmailContext(relevantEmails, false)}\n\n`
    }

    // Generate email draft
    const fullPrompt = `${context}Write a professional email about: ${prompt}

${to ? `The email is addressed to: ${to}\n` : ''}
Requirements:
- Professional and clear tone
- Proper email structure (greeting, body, closing)
- Concise but complete
- No placeholder text like [Your Name] - leave signature blank

Generate ONLY the email body, nothing else.`

    const bodyResult = await safeGenerateContent(fullPrompt)
    
    // Handle quota exceeded error
    if (!bodyResult.success && bodyResult.error?.isQuotaExceeded) {
      console.warn('⚠️ Compose generation quota exceeded')
      return NextResponse.json({
        success: false,
        error: 'AI_QUOTA_EXCEEDED',
        message: 'AI service is temporarily unavailable. Please try again in a moment.',
      })
    }
    
    // Handle other errors
    if (!bodyResult.success || !bodyResult.text) {
      throw bodyResult.error?.originalError || new Error('Failed to generate email body')
    }
    
    const emailBody = bodyResult.text

    // Generate subject line
    const subjectPrompt = `Based on this email body, generate a clear, professional subject line (maximum 60 characters, no quotes):

${emailBody}`

    const subjectResult = await safeGenerateContent(subjectPrompt)
    
    // Handle quota exceeded error for subject
    if (!subjectResult.success && subjectResult.error?.isQuotaExceeded) {
      console.warn('⚠️ Subject generation quota exceeded')
      return NextResponse.json({
        success: false,
        error: 'AI_QUOTA_EXCEEDED',
        message: 'AI service is temporarily unavailable. Please try again in a moment.',
      })
    }
    
    // Handle other errors for subject
    if (!subjectResult.success || !subjectResult.text) {
      throw subjectResult.error?.originalError || new Error('Failed to generate subject line')
    }
    
    const subject = subjectResult.text

    return NextResponse.json({
      success: true,
      draft: {
        subject: subject.trim().replace(/^["']|["']$/g, ''), // Remove quotes if present
        body: emailBody.trim(),
        to: to || '',
      },
    })
  } catch (error: any) {
    console.error('Compose error:', error)
    
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
        error: 'Failed to generate draft',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
