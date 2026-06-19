// Gmail Archive Action — Phase 4
import { getGmailClient } from '@/lib/gmail'

export interface ArchiveOptions {
  emailIds: string[]
  gmailMessageIds: string[]
  userEmail: string
}

/**
 * Archive emails (remove from inbox)
 */
export async function archiveEmails(
  options: ArchiveOptions
): Promise<{ success: boolean; archived: number; error?: string }> {
  try {
    console.log('========== ARCHIVE ACTION ==========')
    console.log('Email Count:', options.emailIds.length)
    console.log('====================================')

    const gmail = await getGmailClient(options.userEmail)

    let archived = 0

    for (const gmailMessageId of options.gmailMessageIds) {
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: gmailMessageId,
          requestBody: {
            removeLabelIds: ['INBOX'],
          },
        })
        archived++
      } catch (error: any) {
        // Check for insufficient permissions
        if (error.message?.includes('INSUFFICIENT_PERMISSIONS')) {
          throw error
        }
        console.error(
          `Failed to archive message ${gmailMessageId}:`,
          error
        )
      }
    }

    console.log('========== ARCHIVE COMPLETE ==========')
    console.log('Archived:', archived)
    console.log('======================================')

    return {
      success: true,
      archived,
    }
  } catch (error: any) {
    console.error('Archive action error:', error)
    
    // Provide user-friendly error for insufficient permissions
    if (error.message?.includes('INSUFFICIENT_PERMISSIONS')) {
      return {
        success: false,
        archived: 0,
        error: 'Insufficient permissions. Please sign out and sign in again to grant required Gmail permissions.',
      }
    }
    
    return {
      success: false,
      archived: 0,
      error: error.message || 'Failed to archive emails',
    }
  }
}
