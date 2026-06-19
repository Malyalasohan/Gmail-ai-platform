// Executive Tasks API - Phase 5
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isQuotaExceededError } from '@/lib/ai-provider'
import { getPendingTasks } from '@/lib/executive/executive-agent'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('========== EXECUTIVE TASKS API ==========')
    console.log('User:', session.user.id)

    const tasks = await getPendingTasks(session.user.id)

    console.log('Tasks Retrieved:', tasks.length)
    console.log('=========================================')

    return NextResponse.json({
      success: true,
      tasks,
      count: tasks.length,
    })
  } catch (error: any) {
    console.error('Executive tasks error:', error)
    
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
        error: 'Failed to fetch tasks',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
