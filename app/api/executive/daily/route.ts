// Executive Daily Brief API - Phase 5
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isQuotaExceededError } from '@/lib/ai-provider'
import { answerExecutiveQuestion, getSmartFocus } from '@/lib/executive/executive-agent'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { question, timeAvailable } = await request.json()

    console.log('========== EXECUTIVE DAILY API ==========')
    console.log('User:', session.user.id)
    console.log('Question:', question)
    console.log('Time Available:', timeAvailable)

    // Handle specific questions
    if (question) {
      const response = await answerExecutiveQuestion(
        session.user.id,
        question
      )

      console.log('Response Generated')
      console.log('Recommendations:', response.recommendations.length)
      console.log('=========================================')

      return NextResponse.json({
        success: true,
        response,
      })
    }

    // Handle smart focus recommendations
    const focus = await getSmartFocus(session.user.id, timeAvailable)

    console.log('Smart Focus Generated')
    console.log('Recommendations:', focus.recommendations.length)
    console.log('=========================================')

    return NextResponse.json({
      success: true,
      focus,
    })
  } catch (error: any) {
    console.error('Executive daily error:', error)
    
    // Check if it's a quota error
    if (isQuotaExceededError(error)) {
      console.warn('⚠️ Gemini API quota exceeded')
      return NextResponse.json(
        {
          success: false,
          error: 'AI_QUOTA_EXCEEDED',
          message: 'AI service is temporarily unavailable. Please try again in a moment.',
        },
        { status: 200 }
      )
    }
    
    return NextResponse.json(
      {
        error: 'Failed to process request',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('========== SMART FOCUS API (GET) ==========')
    console.log('User:', session.user.id)

    const focus = await getSmartFocus(session.user.id)

    console.log('Smart Focus Generated')
    console.log('Recommendations:', focus.recommendations.length)
    console.log('===========================================')

    return NextResponse.json({
      success: true,
      focus,
    })
  } catch (error: any) {
    console.error('Smart focus error:', error)
    
    // Check if it's a quota error
    if (isQuotaExceededError(error)) {
      console.warn('⚠️ Gemini API quota exceeded')
      return NextResponse.json(
        {
          success: false,
          error: 'AI_QUOTA_EXCEEDED',
          message: 'AI service is temporarily unavailable. Please try again in a moment.',
        },
        { status: 200 }
      )
    }
    
    return NextResponse.json(
      {
        error: 'Failed to generate smart focus',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
