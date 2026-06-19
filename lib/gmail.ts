// Gmail API utilities with rate limiting and error handling
import { google } from 'googleapis'
import { createServiceClient } from './supabase/server'

interface GmailMessage {
  id: string
  threadId: string
  sender: string
  recipient: string
  subject: string
  bodyText: string
  receivedAt: string
}

// Initialize Gmail API client with refresh token and scope validation
export async function getGmailClient(userEmail: string) {
  const supabase = createServiceClient()
  
  const { data: user, error } = await supabase
    .from('users')
    .select('google_refresh_token')
    .eq('email', userEmail)
    .single()

  if (error || !user?.google_refresh_token) {
    throw new Error('Failed to retrieve refresh token')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + '/api/auth/callback/google'
  )

  oauth2Client.setCredentials({
    refresh_token: user.google_refresh_token,
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  // Validate scope by testing profile access
  try {
    await gmail.users.getProfile({ userId: 'me' })
  } catch (error: any) {
    // Check if error is insufficient permissions
    if (error.code === 401 || error.code === 403 || error.message?.includes('insufficient')) {
      console.error('Insufficient Gmail permissions detected:', error.message)
      throw new Error('INSUFFICIENT_PERMISSIONS: Please re-authenticate to grant required Gmail permissions')
    }
    throw error
  }

  return gmail
}

// Exponential backoff retry for rate limiting (429 errors)
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // Only retry on rate limit errors
      if (error.code === 429 || error.status === 429) {
        const delay = baseDelay * Math.pow(2, i)
        console.log(`Rate limited. Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

// Parse Gmail message into structured format
function parseMessage(message: any): GmailMessage {
  const headers = message.payload?.headers || []
  
  const getHeader = (name: string) => {
    const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
    return header?.value || ''
  }

  // Extract plain text body
  let bodyText = ''
  if (message.payload?.body?.data) {
    bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
  } else if (message.payload?.parts) {
    // Multi-part message: find text/plain part
    const textPart = message.payload.parts.find((part: any) => 
      part.mimeType === 'text/plain' && part.body?.data
    )
    if (textPart?.body?.data) {
      bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
    }
  }

  return {
    id: message.id,
    threadId: message.threadId,
    sender: getHeader('From'),
    recipient: getHeader('To'),
    subject: getHeader('Subject'),
    bodyText: bodyText.trim(),
    receivedAt: new Date(parseInt(message.internalDate)).toISOString(),
  }
}

// Sync last N messages from Gmail
export async function syncRecentMessages(
  userEmail: string,
  userId: string,
  maxResults = 150
): Promise<{ synced: number; errors: number }> {
  const gmail = await getGmailClient(userEmail)
  const supabase = createServiceClient()

  let synced = 0
  let errors = 0

  try {
    // Fetch message list
    const listResponse = await retryWithBackoff(() =>
      gmail.users.messages.list({
        userId: 'me',
        maxResults,
      })
    )

    const messages = listResponse.data.messages || []
    console.log(`Found ${messages.length} messages to sync`)

    // Fetch full details for each message
    for (const msg of messages) {
      try {
        const fullMessage = await retryWithBackoff(() =>
          gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'full',
          })
        )

        const parsed = parseMessage(fullMessage.data)

        // Upsert to database (handles duplicates via unique constraint)
        const { error } = await supabase.from('emails').upsert({
          user_id: userId,
          gmail_message_id: parsed.id,
          thread_id: parsed.threadId,
          sender: parsed.sender,
          recipient: parsed.recipient,
          subject: parsed.subject,
          body_text: parsed.bodyText,
          received_at: parsed.receivedAt,
        }, {
          onConflict: 'user_id,gmail_message_id',
        })

        if (error) {
          console.error('Error upserting message:', error)
          errors++
        } else {
          synced++
        }
      } catch (msgError) {
        console.error(`Error processing message ${msg.id}:`, msgError)
        errors++
      }
    }

    return { synced, errors }
  } catch (error) {
    console.error('Sync error:', error)
    throw error
  }
}

// Send email via Gmail API
export async function sendEmail(
  userEmail: string,
  {
    to,
    subject,
    body,
    threadId,
    inReplyTo,
    references,
  }: {
    to: string
    subject: string
    body: string
    threadId?: string
    inReplyTo?: string
    references?: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const gmail = await getGmailClient(userEmail)

    // Build email message with proper headers
    const headers = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
    ]

    // For threaded replies, include proper headers
    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`)
    }
    if (references) {
      headers.push(`References: ${references}`)
    }

    const message = [
      ...headers,
      '',
      body,
    ].join('\n')

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const response = await retryWithBackoff(() =>
      gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: threadId, // Preserve thread association
        },
      })
    )

    return {
      success: true,
      messageId: response.data.id || undefined,
    }
  } catch (error: any) {
    console.error('Send email error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send email',
    }
  }
}

// Get thread context for reply generation
export async function getThreadContext(threadId: string, userId: string) {
  const supabase = createServiceClient()
  
  const { data: emails, error } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('thread_id', threadId)
    .order('received_at', { ascending: true })

  if (error) throw error
  return emails
}
