// Gmail Forward API Route — Phase 4
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forwardEmail } from '@/lib/gmail/forward'
import { saveActionHistory } from '@/lib/gmail/history'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { emailId, threadId, forwardTo, message } = await request.json()

    if (!emailId || !threadId) {
      return NextResponse.json(
        { error: 'Email ID and Thread ID are required' },
        { status: 400 }
      )
    }

    if (!forwardTo) {
      return NextResponse.json(
        { error: 'Forward recipient is required' },
        { status: 400 }
      )
    }

    // Forward email
    const result = await forwardEmail({
      emailId,
      threadId,
      userId: session.user.id,
      userEmail: session.user.email,
      forwardTo,
      message,
    })

    // Save to action history
    await saveActionHistory({
      user_id: session.user.id,
      action: 'forward',
      email_ids: [emailId],
      thread_ids: [threadId],
      status: result.success ? 'success' : 'failure',
      metadata: {
        forwardTo,
      },
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Forward API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to forward email' },
      { status: 500 }
    )
  }
}
