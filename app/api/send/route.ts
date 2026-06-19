// Send email via Gmail API
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/gmail'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { to, subject, body, threadId, inReplyTo } = await request.json()

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'To, subject, and body are required' },
        { status: 400 }
      )
    }

    // Build references header for proper threading
    let references = inReplyTo
    if (threadId && inReplyTo) {
      // In a real implementation, you'd fetch all message IDs in the thread
      // For now, just use the inReplyTo
      references = inReplyTo
    }

    // Send via Gmail API
    const result = await sendEmail(session.user.email, {
      to,
      subject,
      body,
      threadId,
      inReplyTo,
      references,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully',
    })
  } catch (error: any) {
    console.error('Send error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send email',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
