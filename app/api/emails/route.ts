// Fetch emails for inbox view
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = createServiceClient()

    let query = supabase
      .from('emails')
      .select('*')
      .eq('user_id', session.user.id)
      .order('received_at', { ascending: false })
      .limit(limit)

    // Filter by category if provided
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const { data: emails, error } = await query

    if (error) throw error

    // Group by thread_id for thread view
    const threads = new Map<string, any[]>()
    
    emails?.forEach(email => {
      if (!threads.has(email.thread_id)) {
        threads.set(email.thread_id, [])
      }
      threads.get(email.thread_id)!.push(email)
    })

    // Get the latest email from each thread for list view
    const threadList = Array.from(threads.entries()).map(([threadId, threadEmails]) => {
      // Sort by received_at to get latest
      const sorted = threadEmails.sort((a, b) => 
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      )
      const latest = sorted[0]
      
      return {
        thread_id: threadId,
        email_count: threadEmails.length,
        latest_email: latest,
        all_emails: sorted,
      }
    })

    return NextResponse.json({
      success: true,
      threads: threadList,
      total: threadList.length,
    })
  } catch (error: any) {
    console.error('Fetch emails error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch emails',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
