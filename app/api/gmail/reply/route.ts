// Gmail Reply API Route — Phase 4
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { replyToEmail, generateReplyDraft } from '@/lib/gmail/reply'
import { saveActionHistory } from '@/lib/gmail/history'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      emailId,
      threadId,
      style,
      language,
      customInstructions,
      draftOnly,
    } = await request.json()

    if (!emailId || !threadId) {
      return NextResponse.json(
        { error: 'Email ID and Thread ID are required' },
        { status: 400 }
      )
    }

    // Generate draft only
    if (draftOnly) {
      const result = await generateReplyDraft({
        emailId,
        threadId,
        userId: session.user.id,
        userEmail: session.user.email,
        style,
        language,
        customInstructions,
      })

      return NextResponse.json(result)
    }

    // Generate and send reply
    const result = await replyToEmail({
      emailId,
      threadId,
      userId: session.user.id,
      userEmail: session.user.email,
      style,
      language,
      customInstructions,
    })

    // Save to action history
    await saveActionHistory({
      user_id: session.user.id,
      action: 'reply',
      email_ids: [emailId],
      thread_ids: [threadId],
      status: result.success ? 'success' : 'failure',
      metadata: {
        style,
        language,
      },
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Reply API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send reply' },
      { status: 500 }
    )
  }
}
