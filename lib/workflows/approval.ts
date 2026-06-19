/**
 * Workflow Approval System
 * 
 * Manages approval requests for dangerous or sensitive workflows.
 */

import { WorkflowPlan } from './planner';
import { createServiceClient } from '../supabase/server';

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  userId: string;
  workflow: WorkflowPlan;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  createdAt: Date;
  respondedAt?: Date;
  expiresAt: Date;
}

/**
 * Create an approval request
 */
export async function createApprovalRequest(
  workflow: WorkflowPlan,
  userId: string,
  reason: string
): Promise<ApprovalRequest> {
  const requestId = `approval_${Date.now()}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const request: ApprovalRequest = {
    id: requestId,
    workflowId: workflow.id,
    userId,
    workflow,
    status: 'pending',
    reason,
    createdAt: new Date(),
    expiresAt
  };

  console.log('[APPROVAL] Created approval request:', {
    id: requestId,
    workflowName: workflow.name,
    reason
  });

  try {
    const supabase = createServiceClient();
    
    await supabase
      .from('workflow_approvals')
      .insert({
        id: request.id,
        workflow_id: workflow.id,
        user_id: userId,
        workflow_plan: workflow,
        status: request.status,
        reason: request.reason,
        created_at: request.createdAt,
        expires_at: request.expiresAt
      });
  } catch (error) {
    console.error('[APPROVAL] Failed to save approval request:', error);
  }

  return request;
}

/**
 * Approve a workflow
 */
export async function approveWorkflow(requestId: string, userId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('workflow_approvals')
      .update({
        status: 'approved',
        responded_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      console.error('[APPROVAL] Failed to approve workflow:', error);
      return false;
    }

    console.log('[APPROVAL] Workflow approved:', requestId);
    return true;
  } catch (error) {
    console.error('[APPROVAL] Error approving workflow:', error);
    return false;
  }
}

/**
 * Reject a workflow
 */
export async function rejectWorkflow(requestId: string, userId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('workflow_approvals')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      console.error('[APPROVAL] Failed to reject workflow:', error);
      return false;
    }

    console.log('[APPROVAL] Workflow rejected:', requestId);
    return true;
  } catch (error) {
    console.error('[APPROVAL] Error rejecting workflow:', error);
    return false;
  }
}

/**
 * Get pending approval requests for a user
 */
export async function getPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('workflow_approvals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('[APPROVAL] Failed to get pending approvals:', error);
      return [];
    }

    return data.map(row => ({
      id: row.id,
      workflowId: row.workflow_id,
      userId: row.user_id,
      workflow: row.workflow_plan,
      status: row.status,
      reason: row.reason,
      createdAt: new Date(row.created_at),
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      expiresAt: new Date(row.expires_at)
    }));
  } catch (error) {
    console.error('[APPROVAL] Error getting pending approvals:', error);
    return [];
  }
}

/**
 * Check if a workflow is approved
 */
export async function isWorkflowApproved(requestId: string, userId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('workflow_approvals')
      .select('status')
      .eq('id', requestId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.status === 'approved';
  } catch (error) {
    console.error('[APPROVAL] Error checking approval status:', error);
    return false;
  }
}

/**
 * Clean up expired approvals
 */
export async function cleanupExpiredApprovals(): Promise<number> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('workflow_approvals')
      .update({ status: 'rejected' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      console.error('[APPROVAL] Failed to cleanup expired approvals:', error);
      return 0;
    }

    console.log('[APPROVAL] Cleaned up expired approvals:', data?.length || 0);
    return data?.length || 0;
  } catch (error) {
    console.error('[APPROVAL] Error cleaning up expired approvals:', error);
    return 0;
  }
}

/**
 * Determine approval reason based on workflow
 */
export function getApprovalReason(workflow: WorkflowPlan): string {
  const reasons: string[] = [];

  // Check for dangerous operations
  const dangerousOps = workflow.steps.filter(step => step.type === 'delete');
  if (dangerousOps.length > 0) {
    reasons.push(`Delete ${dangerousOps.length} email(s)`);
  }

  // Check for bulk operations
  const emailCount = workflow.context.emailIds?.length || 0;
  if (emailCount > 10) {
    reasons.push(`Bulk operation (${emailCount} emails)`);
  }

  // Check for forward operations (security concern)
  const forwardOps = workflow.steps.filter(step => step.type === 'forward');
  if (forwardOps.length > 0) {
    reasons.push(`Forward ${forwardOps.length} email(s)`);
  }

  if (reasons.length === 0) {
    return 'This workflow requires approval';
  }

  return reasons.join(', ');
}

