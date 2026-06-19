// Gmail Delete Action — Phase 4
import { getGmailClient } from '@/lib/gmail'

export interface DeleteOptions {
  emailIds: string[]
  gmailMessageIds: string[]
  userEmail: string
  moveToTrash?: boolean // if false, permanently delete
}

/**
 * Delete or trash emails
 */
export async function deleteEmails(
  options: DeleteOptions
): Promise<{ success: boolean; deleted: number; error?: string }> {
  try {
    console.log('========== DELETE ACTION ==========')
    console.log('Email Count:', options.emailIds.length)
    console.log(
      'Operation:',
      options.moveToTrash ? 'Move to Trash' : 'Permanent Delete'
    )
    console.log('===================================')

    const gmail = await getGmailClient(options.userEmail)

    let deleted = 0

    for (const gmailMessageId of options.gmailMessageIds) {
      try {
        if (options.moveToTrash) {
          // Move to trash (recoverable)
          await gmail.users.messages.trash({
            userId: 'me',
            id: gmailMessageId,
          })
        } else {
          // Permanent delete (not recoverable)
          await gmail.users.messages.delete({
            userId: 'me',
            id: gmailMessageId,
          })
        }
        deleted++
      } catch (error: any) {
        // Check for insufficient permissions
        if (error.message?.includes('INSUFFICIENT_PERMISSIONS')) {
          throw error
        }
        console.error(
          `Failed to delete message ${gmailMessageId}:`,
          error
        )
      }
    }

    console.log('========== DELETE COMPLETE ==========')
    console.log('Deleted:', deleted)
    console.log('=====================================')

    return {
      success: true,
      deleted,
    }
  } catch (error: any) {
    console.error('Delete action error:', error)
    
    // Provide user-friendly error for insufficient permissions
    if (error.message?.includes('INSUFFICIENT_PERMISSIONS')) {
      return {
        success: false,
        deleted: 0,
        error: 'Insufficient permissions. Please sign out and sign in again to grant required Gmail permissions.',
      }
    }
    
    return {
      success: false,
      deleted: 0,
      error: error.message || 'Failed to delete emails',
    }
  }
}
