/**
 * Undo Support
 * 
 * Tracks workflow actions and allows undo within a timeout window.
 */

import { createServiceClient } from '../supabase/server';
import { ExecutionResult } from './executor';

export interface UndoableAction {
  id: string;
  executionId: string;
  userId: string;
  stepId: string;
  actionType: string;
  originalState: any;
  newState: any;
  timestamp: Date;
  expiresAt: Date;
  status: 'pending' | 'undone' | 'expired';
}

// Undo timeout: 5 minutes
const UNDO_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Record an undoable action
 */
export async function recordUndoableAction(
  executionId: string,
  userId: string,
  stepId: string,
  actionType: string,
  originalState: any,
  newState: any
): Promise<UndoableAction> {
  const actionId = `undo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + UNDO_TIMEOUT_MS);

  const action: UndoableAction = {
    id: actionId,
    executionId,
    userId,
    stepId,
    actionType,
    originalState,
    newState,
    timestamp: now,
    expiresAt,
    status: 'pending'
  };

  console.log('[UNDO] Recording undoable action:', {
    id: actionId,
    type: actionType,
    expiresAt
  });

  try {
    const supabase = createServiceClient();
    
    await supabase
      .from('undoable_actions')
      .insert({
        id: action.id,
        execution_id: executionId,
        user_id: userId,
        step_id: stepId,
        action_type: actionType,
        original_state: originalState,
        new_state: newState,
        timestamp: now,
        expires_at: expiresAt,
        status: action.status
      });

    console.log('[UNDO] Action recorded:', actionId);
  } catch (error) {
    console.error('[UNDO] Failed to record action:', error);
  }

  return action;
}

/**
 * Undo an action
 */
export async function undoAction(
  actionId: string,
  userId: string,
  userEmail: string
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    // Get the action
    const { data: action, error } = await supabase
      .from('undoable_actions')
      .select('*')
      .eq('id', actionId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (error || !action) {
      console.error('[UNDO] Action not found or already undone:', actionId);
      return false;
    }

    // Check if expired
    if (new Date(action.expires_at) < new Date()) {
      console.log('[UNDO] Action expired:', actionId);
      await supabase
        .from('undoable_actions')
        .update({ status: 'expired' })
        .eq('id', actionId);
      return false;
    }

    // Perform undo based on action type
    const success = await performUndo(action, userEmail);

    if (success) {
      // Mark as undone
      await supabase
        .from('undoable_actions')
        .update({ status: 'undone' })
        .eq('id', actionId);

      console.log('[UNDO] Action undone successfully:', actionId);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[UNDO] Error undoing action:', error);
    return false;
  }
}

/**
 * Perform the actual undo operation
 */
async function performUndo(action: any, userEmail: string): Promise<boolean> {
  const { manageLabels } = await import('../gmail/labels');
  const { starEmails } = await import('../gmail/star');

  try {
    const gmailMessageId = action.original_state.gmailMessageId || action.original_state.emailId;
    const emailId = action.original_state.emailId;

    switch (action.action_type) {
      case 'archive':
        // Undo archive: move back to inbox
        await manageLabels({
          emailIds: [emailId],
          gmailMessageIds: [gmailMessageId],
          userEmail,
          operation: 'add_label',
          labelName: 'INBOX'
        });
        return true;

      case 'star':
        // Undo star: unstar
        await starEmails({
          emailIds: [emailId],
          gmailMessageIds: [gmailMessageId],
          userEmail,
          star: false
        });
        return true;

      case 'unstar':
        // Undo unstar: star
        await starEmails({
          emailIds: [emailId],
          gmailMessageIds: [gmailMessageId],
          userEmail,
          star: true
        });
        return true;

      case 'mark_read':
        // Undo mark read: mark unread
        await manageLabels({
          emailIds: [emailId],
          gmailMessageIds: [gmailMessageId],
          userEmail,
          operation: 'unread'
        });
        return true;

      case 'mark_unread':
        // Undo mark unread: mark read
        await manageLabels({
          emailIds: [emailId],
          gmailMessageIds: [gmailMessageId],
          userEmail,
          operation: 'read'
        });
        return true;

      case 'label':
        // Undo label: remove label
        await manageLabels({
          emailIds: [emailId],
          gmailMessageIds: [gmailMessageId],
          userEmail,
          operation: 'remove_label',
          labelName: action.original_state.label
        });
        return true;

      default:
        console.log('[UNDO] Action type not undoable:', action.action_type);
        return false;
    }
  } catch (error) {
    console.error('[UNDO] Failed to perform undo:', error);
    return false;
  }
}

/**
 * Get undoable actions for an execution
 */
export async function getUndoableActions(
  executionId: string,
  userId: string
): Promise<UndoableAction[]> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('undoable_actions')
      .select('*')
      .eq('execution_id', executionId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('timestamp', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(row => ({
      id: row.id,
      executionId: row.execution_id,
      userId: row.user_id,
      stepId: row.step_id,
      actionType: row.action_type,
      originalState: row.original_state,
      newState: row.new_state,
      timestamp: new Date(row.timestamp),
      expiresAt: new Date(row.expires_at),
      status: row.status
    }));
  } catch (error) {
    console.error('[UNDO] Error getting undoable actions:', error);
    return [];
  }
}

/**
 * Get all user's undoable actions
 */
export async function getUserUndoableActions(userId: string): Promise<UndoableAction[]> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('undoable_actions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error || !data) {
      return [];
    }

    return data.map(row => ({
      id: row.id,
      executionId: row.execution_id,
      userId: row.user_id,
      stepId: row.step_id,
      actionType: row.action_type,
      originalState: row.original_state,
      newState: row.new_state,
      timestamp: new Date(row.timestamp),
      expiresAt: new Date(row.expires_at),
      status: row.status
    }));
  } catch (error) {
    console.error('[UNDO] Error getting user undoable actions:', error);
    return [];
  }
}

/**
 * Clean up expired undo actions
 */
export async function cleanupExpiredUndoActions(): Promise<number> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('undoable_actions')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      console.error('[UNDO] Failed to cleanup expired actions:', error);
      return 0;
    }

    console.log('[UNDO] Cleaned up expired actions:', data?.length || 0);
    return data?.length || 0;
  } catch (error) {
    console.error('[UNDO] Error cleaning up expired actions:', error);
    return 0;
  }
}

/**
 * Check if action is undoable
 */
export function isActionUndoable(actionType: string): boolean {
  const undoableActions = ['archive', 'star', 'unstar', 'mark_read', 'mark_unread', 'label'];
  return undoableActions.includes(actionType);
}

