// Gmail Forward Action — Phase 4
import { sendEmail, getThreadContext } from '@/lib/gmail'

export interface ForwardOptions {
  emailId: string
  threadId: string
  userId: string
  userEmail: string
  forwardTo: string
  message?: string // Optional message to prepend
}

/**
 * Forward an email to another recipient
 */
export async function forwardEmail(
  options: ForwardOptions
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('========== FORWARD ACTION ==========')
    console.log('Email ID:', options.emailId)
    console.log('Forward To:', options.forwardTo)
    console.log('====================================')

    // Get thread context
    const threadEmails = await getThreadContext(
      options.threadId,
      options.userId
    )

    if (threadEmails.length === 0) {
      return {
        success: false,
        error: 'Thread not found',
      }
    }

    // Find the email to forward
    const targetEmail = threadEmails.find((e) => e.id === options.emailId)
    if (!targetEmail) {
      return {
        success: false,
        error: 'Email not found',
      }
    }

    // Build forwarded message body
    let forwardedBody = ''
    
    if (options.message) {
      forwardedBody += `${options.message}\n\n`
    }
    
    forwardedBody += `---------- Forwarded message ---------\n`
    forwardedBody += `From: ${targetEmail.sender}\n`
    forwardedBody += `Date: ${new Date(targetEmail.received_at).toLocaleString()}\n`
    forwardedBody += `Subject: ${targetEmail.subject}\n`
    forwardedBody += `To: ${targetEmail.recipient}\n\n`
    forwardedBody += targetEmail.body_text

    // Send forwarded email
    const result = await sendEmail(options.userEmail, {
      to: options.forwardTo,
      subject: targetEmail.subject.startsWith('Fwd:')
        ? targetEmail.subject
        : `Fwd: ${targetEmail.subject}`,
      body: forwardedBody,
    })

    if (result.success) {
      console.log('========== FORWARD SENT ==========')
      console.log('Message ID:', result.messageId)
      console.log('To:', options.forwardTo)
      console.log('==================================')

      return {
        success: true,
        message: `Email forwarded successfully to ${options.forwardTo}`,
      }
    }

    return {
      success: false,
      error: result.error || 'Failed to forward email',
    }
  } catch (error: any) {
    console.error('Forward action error:', error)
    return {
      success: false,
      error: error.message || 'Failed to forward email',
    }
  }
}
