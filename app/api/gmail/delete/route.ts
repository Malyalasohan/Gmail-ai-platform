// Gmail Delete API Route — Phase 4
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteEmails } from '@/lib/gmail/delete'
import { saveActionHistory } from '@/lib/gmail/history'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { emailIds, permanent } = await request.json()

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'Email IDs are required' },
        { status: 400 }
      )
    }

    // Fetch Gmail message IDs from database
    const supabase = createServiceClient()
    const { data: emails, error } = await supabase
      .from('emails')
      .select('id, gmail_message_id, thread_id')
      .in('id', emailIds)
      .eq('user_id', session.user.id)

    if (error || !emails || emails.length === 0) {
      return NextResponse.json(
        { error: 'Emails not found' },
        { status: 404 }
      )
    }

    const gmailMessageIds = emails.map((e) => e.gmail_message_id)
    const threadIds = [...new Set(emails.map((e) => e.thread_id))]

    // Delete emails
    const result = await deleteEmails({
      emailIds,
      gmailMessageIds,
      userEmail: session.user.email,
      moveToTrash: !permanent,
    })

    // Save to action history
    await saveActionHistory({
      user_id: session.user.id,
      action: permanent ? 'delete_permanent' : 'trash',
      email_ids: emailIds,
      thread_ids: threadIds,
      status: result.success ? 'success' : 'failure',
      metadata: {
        deleted: result.deleted,
        permanent,
      },
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Delete API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete emails' },
      { status: 500 }
    )
  }
}
