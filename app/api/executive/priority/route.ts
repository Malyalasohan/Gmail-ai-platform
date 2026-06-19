// Executive Priority API - Phase 5
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isQuotaExceededError } from '@/lib/ai-provider'
import {
  getHighPriorityEmails,
  explainEmailPriority,
} from '@/lib/executive/executive-agent'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('emailId')
    const minPriority = searchParams.get('minPriority')

    // If emailId is provided, explain priority for that email
    if (emailId) {
      console.log('========== EXPLAIN PRIORITY API ==========')
      console.log('User:', session.user.id)
      console.log('Email ID:', emailId)

      const explanation = await explainEmailPriority(
        session.user.id,
        emailId
      )

      console.log('Explanation Generated')
      console.log('==========================================')

      return NextResponse.json({
        success: true,
        emailId,
        explanation,
      })
    }

    // Otherwise, return high priority emails
    console.log('========== HIGH PRIORITY API ==========')
    console.log('User:', session.user.id)
    console.log('Min Priority:', minPriority || 70)

    const highPriority = await getHighPriorityEmails(
      session.user.id,
      minPriority ? parseInt(minPriority) : 70
    )

    console.log('High Priority Emails:', highPriority.length)
    console.log('=======================================')

    return NextResponse.json({
      success: true,
      emails: highPriority.map((item) => ({
        ...item.email,
        priorityScore: item.priorityScore,
      })),
      count: highPriority.length,
    })
  } catch (error: any) {
    console.error('Executive priority error:', error)
    
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
        error: 'Failed to fetch priority data',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
