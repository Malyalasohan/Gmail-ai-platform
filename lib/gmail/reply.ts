// Gmail Reply Action — Phase 4
import { sendEmail, getThreadContext } from '@/lib/gmail'
import { safeGenerateContent } from '@/lib/ai-provider'

export interface ReplyOptions {
  emailId: string
  threadId: string
  userId: string
  userEmail: string
  style?: 'professional' | 'friendly' | 'short' | 'formal' | 'detailed'
  language?: string
  customInstructions?: string
}

/**
 * Generate and send a reply to an email
 */
export async function replyToEmail(
  options: ReplyOptions
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('========== REPLY ACTION ==========')
    console.log('Email ID:', options.emailId)
    console.log('Thread ID:', options.threadId)
    console.log('Style:', options.style || 'default')
    console.log('Language:', options.language || 'default')
    console.log('==================================')

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

    // Find the email to reply to
    const targetEmail = threadEmails.find((e) => e.id === options.emailId)
    if (!targetEmail) {
      return {
        success: false,
        error: 'Email not found',
      }
    }

    // Generate reply using AI
    const replyContent = await generateReply(
      targetEmail,
      threadEmails,
      options.style,
      options.language,
      options.customInstructions
    )

    // Send reply via Gmail API
    const result = await sendEmail(options.userEmail, {
      to: targetEmail.sender,
      subject: targetEmail.subject.startsWith('Re:')
        ? targetEmail.subject
        : `Re: ${targetEmail.subject}`,
      body: replyContent,
      threadId: options.threadId,
      inReplyTo: targetEmail.gmail_message_id,
      references: targetEmail.gmail_message_id,
    })

    if (result.success) {
      console.log('========== REPLY SENT ==========')
      console.log('Message ID:', result.messageId)
      console.log('To:', targetEmail.sender)
      console.log('Subject:', targetEmail.subject)
      console.log('================================')

      return {
        success: true,
        message: `Reply sent successfully to ${targetEmail.sender}`,
      }
    }

    return {
      success: false,
      error: result.error || 'Failed to send reply',
    }
  } catch (error: any) {
    console.error('Reply action error:', error)
    
    // Provide user-friendly error for insufficient permissions
    if (error.message?.includes('INSUFFICIENT_PERMISSIONS')) {
      return {
        success: false,
        error: 'Insufficient permissions. Please sign out and sign in again to grant required Gmail permissions.',
      }
    }
    
    return {
      success: false,
      error: error.message || 'Failed to send reply',
    }
  }
}

/**
 * Generate reply content using AI
 */
async function generateReply(
  targetEmail: any,
  threadEmails: any[],
  style?: string,
  language?: string,
  customInstructions?: string
): Promise<string> {
  // Build thread context
  const threadContext = threadEmails
    .map(
      (email, idx) =>
        `[Email ${idx + 1}]
From: ${email.sender}
To: ${email.recipient}
Date: ${new Date(email.received_at).toLocaleString()}
Subject: ${email.subject}

${email.body_text}
`
    )
    .join('\n\n---\n\n')

  // Build style instructions
  const styleInstructions = {
    professional:
      'Write in a professional, business-appropriate tone. Be polite and formal.',
    friendly:
      'Write in a friendly, warm tone. Be casual but respectful.',
    short:
      'Write a brief, concise reply. Keep it to 2-3 sentences maximum.',
    formal:
      'Write in a very formal, respectful tone. Use proper business language.',
    detailed:
      'Write a comprehensive, detailed reply. Address all points thoroughly.',
  }

  const styleInstruction = style
    ? styleInstructions[style as keyof typeof styleInstructions]
    : 'Write in an appropriate tone matching the original email'

  const languageInstruction = language
    ? `Write the reply in ${language}.`
    : 'Write the reply in the same language as the original email.'

  const prompt = `You are an AI Email Assistant helping draft a reply.

THREAD CONTEXT (oldest to newest):
${threadContext}

EMAIL TO REPLY TO:
From: ${targetEmail.sender}
Subject: ${targetEmail.subject}
Date: ${new Date(targetEmail.received_at).toLocaleString()}

${targetEmail.body_text}

INSTRUCTIONS:
- ${styleInstruction}
- ${languageInstruction}
- Be helpful and address the sender's message appropriately
- Do NOT include email headers (To, From, Subject) - just write the body
- Do NOT add signature or closing - just the message content
${customInstructions ? `- ${customInstructions}` : ''}

Write the reply:`

  const aiResult = await safeGenerateContent(prompt)
  
  // If quota exceeded or error, throw to be handled by caller
  if (!aiResult.success || !aiResult.text) {
    throw aiResult.error?.originalError || new Error('Failed to generate reply')
  }

  return aiResult.text.trim()
}

/**
 * Generate reply draft without sending
 */
export async function generateReplyDraft(
  options: ReplyOptions
): Promise<{ success: boolean; draft?: string; error?: string }> {
  try {
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

    const targetEmail = threadEmails.find((e) => e.id === options.emailId)
    if (!targetEmail) {
      return {
        success: false,
        error: 'Email not found',
      }
    }

    const draft = await generateReply(
      targetEmail,
      threadEmails,
      options.style,
      options.language,
      options.customInstructions
    )

    return {
      success: true,
      draft,
    }
  } catch (error: any) {
    console.error('Generate reply draft error:', error)
    return {
      success: false,
      error: error.message || 'Failed to generate draft',
    }
  }
}
