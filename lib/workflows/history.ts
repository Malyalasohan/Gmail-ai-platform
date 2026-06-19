/**
 * Workflow History
 * 
 * Tracks all workflow executions for audit and analysis.
 */

import { WorkflowExecution } from './executor';
import { createServiceClient } from '../supabase/server';

export interface WorkflowHistoryEntry {
  id: string;
  workflowId: string;
  workflowName: string;
  userId: string;
  status: 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt: Date;
  duration: number; // milliseconds
  totalSteps: number;
  completedSteps: number;
  results: any[];
  error?: string;
}

export interface WorkflowStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  mostUsedWorkflows: { name: string; count: number }[];
  recentExecutions: WorkflowHistoryEntry[];
}

/**
 * Get workflow history for a user
 */
export async function getWorkflowHistory(
  userId: string,
  limit: number = 50
): Promise<WorkflowHistoryEntry[]> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('workflow_history')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error('[WORKFLOW HISTORY] Failed to get history:', error);
      return [];
    }

    return data.map(row => ({
      id: row.id,
      workflowId: row.workflow_id,
      workflowName: row.workflow_name || 'Unnamed Workflow',
      userId: row.user_id,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: new Date(row.completed_at),
      duration: new Date(row.completed_at).getTime() - new Date(row.started_at).getTime(),
      totalSteps: row.total_steps,
      completedSteps: row.completed_steps,
      results: row.results || [],
      error: row.error
    }));
  } catch (error) {
    console.error('[WORKFLOW HISTORY] Error getting history:', error);
    return [];
  }
}

/**
 * Get a specific workflow execution
 */
export async function getWorkflowExecution(
  executionId: string,
  userId: string
): Promise<WorkflowHistoryEntry | null> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('workflow_history')
      .select('*')
      .eq('id', executionId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      workflowId: data.workflow_id,
      workflowName: data.workflow_name || 'Unnamed Workflow',
      userId: data.user_id,
      status: data.status,
      startedAt: new Date(data.started_at),
      completedAt: new Date(data.completed_at),
      duration: new Date(data.completed_at).getTime() - new Date(data.started_at).getTime(),
      totalSteps: data.total_steps,
      completedSteps: data.completed_steps,
      results: data.results || [],
      error: data.error
    };
  } catch (error) {
    console.error('[WORKFLOW HISTORY] Error getting execution:', error);
    return null;
  }
}

/**
 * Get workflow statistics
 */
export async function getWorkflowStats(userId: string): Promise<WorkflowStats> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('workflow_history')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) {
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        mostUsedWorkflows: [],
        recentExecutions: []
      };
    }

    const totalExecutions = data.length;
    const successfulExecutions = data.filter(e => e.status === 'completed').length;
    const failedExecutions = data.filter(e => e.status === 'failed').length;
    
    // Calculate average duration
    const durations = data
      .filter(e => e.completed_at)
      .map(e => new Date(e.completed_at).getTime() - new Date(e.started_at).getTime());
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    // Count most used workflows
    const workflowCounts: Record<string, number> = {};
    data.forEach(e => {
      const name = e.workflow_name || 'Unnamed Workflow';
      workflowCounts[name] = (workflowCounts[name] || 0) + 1;
    });

    const mostUsedWorkflows = Object.entries(workflowCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get recent executions
    const recentExecutions = data
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 10)
      .map(row => ({
        id: row.id,
        workflowId: row.workflow_id,
        workflowName: row.workflow_name || 'Unnamed Workflow',
        userId: row.user_id,
        status: row.status,
        startedAt: new Date(row.started_at),
        completedAt: new Date(row.completed_at),
        duration: new Date(row.completed_at).getTime() - new Date(row.started_at).getTime(),
        totalSteps: row.total_steps,
        completedSteps: row.completed_steps,
        results: row.results || [],
        error: row.error
      }));

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageDuration,
      mostUsedWorkflows,
      recentExecutions
    };
  } catch (error) {
    console.error('[WORKFLOW HISTORY] Error getting stats:', error);
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      mostUsedWorkflows: [],
      recentExecutions: []
    };
  }
}

/**
 * Delete workflow execution from history
 */
export async function deleteWorkflowExecution(
  executionId: string,
  userId: string
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('workflow_history')
      .delete()
      .eq('id', executionId)
      .eq('user_id', userId);

    if (error) {
      console.error('[WORKFLOW HISTORY] Failed to delete execution:', error);
      return false;
    }

    console.log('[WORKFLOW HISTORY] Execution deleted:', executionId);
    return true;
  } catch (error) {
    console.error('[WORKFLOW HISTORY] Error deleting execution:', error);
    return false;
  }
}

/**
 * Clear all workflow history for a user
 */
export async function clearWorkflowHistory(userId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('workflow_history')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[WORKFLOW HISTORY] Failed to clear history:', error);
      return false;
    }

    console.log('[WORKFLOW HISTORY] History cleared for user:', userId);
    return true;
  } catch (error) {
    console.error('[WORKFLOW HISTORY] Error clearing history:', error);
    return false;
  }
}

/**
 * Get workflow success rate
 */
export async function getWorkflowSuccessRate(
  workflowName: string,
  userId: string
): Promise<number> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('workflow_history')
      .select('status')
      .eq('user_id', userId)
      .eq('workflow_name', workflowName);

    if (error || !data || data.length === 0) {
      return 0;
    }

    const successful = data.filter(e => e.status === 'completed').length;
    return (successful / data.length) * 100;
  } catch (error) {
    console.error('[WORKFLOW HISTORY] Error getting success rate:', error);
    return 0;
  }
}

