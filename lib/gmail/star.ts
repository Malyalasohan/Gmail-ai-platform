// Gmail Star Action — Phase 4
import { getGmailClient } from '@/lib/gmail'

export interface StarOptions {
  emailIds: string[]
  gmailMessageIds: string[]
  userEmail: string
  star: boolean // true = star, false = unstar
}

/**
 * Star or unstar emails
 */
export async function starEmails(
  options: StarOptions
): Promise<{ success: boolean; modified: number; error?: string }> {
  try {
    console.log('========== STAR ACTION ==========')
    console.log('Email Count:', options.emailIds.length)
    console.log('Operation:', options.star ? 'Star' : 'Unstar')
    console.log('=================================')

    const gmail = await getGmailClient(options.userEmail)

    let modified = 0

    for (const gmailMessageId of options.gmailMessageIds) {
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: gmailMessageId,
          requestBody: options.star
            ? {
                addLabelIds: ['STARRED'],
              }
            : {
                removeLabelIds: ['STARRED'],
              },
        })
        modified++
      } catch (error: any) {
        // Check for insufficient permissions
        if (error.message?.includes('INSUFFICIENT_PERMISSIONS')) {
          throw error
        }
        console.error(
          `Failed to ${options.star ? 'star' : 'unstar'} message ${gmailMessageId}:`,
          error
        )
      }
    }

    console.log('========== STAR COMPLETE ==========')
    console.log('Modified:', modified)
    console.log('===================================')

    return {
      success: true,
      modified,
    }
  } catch (error: any) {
    console.error('Star action error:', error)
    
    // Provide user-friendly error for insufficient permissions
    if (error.message?.includes('INSUFFICIENT_PERMISSIONS')) {
      return {
        success: false,
        modified: 0,
        error: 'Insufficient permissions. Please sign out and sign in again to grant required Gmail permissions.',
      }
    }
    
    return {
      success: false,
      modified: 0,
      error: error.message || 'Failed to modify star status',
    }
  }
}
