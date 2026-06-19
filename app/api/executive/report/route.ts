// Executive Report API - Phase 5
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTodayReport } from '@/lib/executive/executive-agent'
import { isQuotaExceededError } from '@/lib/ai-provider'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('========== EXECUTIVE REPORT API ==========')
    console.log('User:', session.user.id)

    const report = await getTodayReport(session.user.id)

    console.log('Report Generated Successfully')
    console.log('Health Score:', report.inboxHealth.healthScore)
    console.log('High Priority:', report.highPriority.count)
    console.log('Recommendations:', report.recommendations.length)
    console.log('==========================================')

    return NextResponse.json({
      success: true,
      report,
    })
  } catch (error: any) {
    console.error('Executive report error:', error)
    
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
        error: 'Failed to generate report',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
