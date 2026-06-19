// Email sync API endpoint with database-backed job locking
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncRecentMessages } from '@/lib/gmail'
import { jobManager } from '@/lib/job-manager'

export async function POST(request: NextRequest) {
  let jobId: string | null = null

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Check if sync is already running for this user
    const canStart = await jobManager.canStartSync(userId)
    if (!canStart) {
      const status = await jobManager.getJobStatus(userId, 'sync')
      return NextResponse.json({
        success: true,
        message: 'Sync already running',
        startedAt: status?.started_at,
      })
    }

    // Start sync job (acquire database lock)
    jobId = await jobManager.startSync(userId)
    if (!jobId) {
      return NextResponse.json({
        success: true,
        message: 'Sync already running',
      })
    }

    console.log('🔄 Sync Job Started')

    try {
      // Sync last 150 messages
      const result = await syncRecentMessages(
        session.user.email,
        userId,
        150
      )

      console.log(`✅ Sync Job Completed - ${result.synced} emails synced`)

      // Mark job as completed
      await jobManager.completeSync(jobId)

      // Trigger background tasks AFTER sync completes and lock is released
      // Use setTimeout to ensure these don't block the response
      if (result.synced > 0) {
        // Start embedding generation in true background (non-blocking)
        setTimeout(() => {
          fetch(`${process.env.NEXTAUTH_URL}/api/embeddings/generate`, {
            method: 'POST',
            headers: {
              Cookie: request.headers.get('Cookie') || '',
            },
          }).catch((err) =>
            console.error('Background embedding generation failed:', err)
          )
        }, 100)

        // Start categorization in true background (non-blocking)
        setTimeout(() => {
          fetch(`${process.env.NEXTAUTH_URL}/api/emails/categorize`, {
            method: 'POST',
            headers: {
              Cookie: request.headers.get('Cookie') || '',
            },
          }).catch((err) =>
            console.error('Background categorization failed:', err)
          )
        }, 100)
      }

      return NextResponse.json({
        success: true,
        synced: result.synced,
        errors: result.errors,
        message: `Synced ${result.synced} emails${
          result.errors > 0 ? ` (${result.errors} errors)` : ''
        }`,
      })
    } catch (syncError: any) {
      // Mark job as failed
      if (jobId) {
        await jobManager.failSync(jobId, syncError.message || 'Unknown error')
      }
      throw syncError
    }
  } catch (error: any) {
    console.error('💥 Sync error:', error)
    
    // Make sure job is marked as failed
    if (jobId) {
      await jobManager.failSync(jobId, error.message || 'Unknown error')
    }

    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
