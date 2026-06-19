// Gmail Label Management Action — Phase 4
import { getGmailClient } from '@/lib/gmail'

export interface LabelOptions {
  emailIds: string[]
  gmailMessageIds: string[]
  userEmail: string
  operation: 'read' | 'unread' | 'add_label' | 'remove_label'
  labelName?: string
}

/**
 * Manage email labels (read/unread, custom labels)
 */
export async function manageLabels(
  options: LabelOptions
): Promise<{ success: boolean; modified: number; error?: string }> {
  try {
    console.log('========== LABEL ACTION ==========')
    console.log('Email Count:', options.emailIds.length)
    console.log('Operation:', options.operation)
    console.log('Label:', options.labelName || 'N/A')
    console.log('==================================')

    const gmail = await getGmailClient(options.userEmail)

    let modified = 0

    // Determine label modifications
    let addLabelIds: string[] = []
    let removeLabelIds: string[] = []

    switch (options.operation) {
      case 'read':
        removeLabelIds = ['UNREAD']
        break
      case 'unread':
        addLabelIds = ['UNREAD']
        break
      case 'add_label':
        if (options.labelName) {
          // Find or create label
          const labelId = await findOrCreateLabel(
            gmail,
            options.labelName
          )
          if (labelId) {
            addLabelIds = [labelId]
          }
        }
        break
      case 'remove_label':
        if (options.labelName) {
          const labelId = await findLabel(gmail, options.labelName)
          if (labelId) {
            removeLabelIds = [labelId]
          }
        }
        break
    }

    // Apply label changes to all emails
    for (const gmailMessageId of options.gmailMessageIds) {
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: gmailMessageId,
          requestBody: {
            addLabelIds,
            removeLabelIds,
          },
        })
        modified++
      } catch (error: any) {
        // Check for insufficient permissions
        if (error.message?.includes('INSUFFICIENT_PERMISSIONS')) {
          throw error
        }
        console.error(
          `Failed to modify labels for message ${gmailMessageId}:`,
          error
        )
      }
    }

    console.log('========== LABEL COMPLETE ==========')
    console.log('Modified:', modified)
    console.log('====================================')

    return {
      success: true,
      modified,
    }
  } catch (error: any) {
    console.error('Label action error:', error)
    
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
      error: error.message || 'Failed to manage labels',
    }
  }
}

/**
 * Find label by name
 */
async function findLabel(
  gmail: any,
  labelName: string
): Promise<string | null> {
  try {
    const response = await gmail.users.labels.list({
      userId: 'me',
    })

    const label = response.data.labels?.find(
      (l: any) => l.name.toLowerCase() === labelName.toLowerCase()
    )

    return label?.id || null
  } catch (error) {
    console.error('Find label error:', error)
    return null
  }
}

/**
 * Find or create label
 */
async function findOrCreateLabel(
  gmail: any,
  labelName: string
): Promise<string | null> {
  try {
    // First, try to find existing label
    const existingLabel = await findLabel(gmail, labelName)
    if (existingLabel) {
      return existingLabel
    }

    // Create new label
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    })

    return response.data.id || null
  } catch (error) {
    console.error('Create label error:', error)
    return null
  }
}
