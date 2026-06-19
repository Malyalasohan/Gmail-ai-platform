/**
 * Workflow Monitor
 * 
 * Real-time monitoring of workflow execution progress.
 */

import { WorkflowExecution } from './executor';
import { EventEmitter } from 'events';

export interface WorkflowProgress {
  executionId: string;
  workflowName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  currentStepName?: string;
  progress: number; // 0-100
  startedAt: Date;
  estimatedTimeRemaining?: number; // seconds
}

export interface StepProgress {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  output?: any;
  error?: string;
}

// Global event emitter for workflow events
const workflowEvents = new EventEmitter();

/**
 * Subscribe to workflow progress updates
 */
export function subscribeToWorkflow(
  executionId: string,
  callback: (progress: WorkflowProgress) => void
): () => void {
  const handler = (data: { executionId: string; progress: WorkflowProgress }) => {
    if (data.executionId === executionId) {
      callback(data.progress);
    }
  };

  workflowEvents.on('progress', handler);

  // Return unsubscribe function
  return () => {
    workflowEvents.off('progress', handler);
  };
}

/**
 * Emit workflow progress update
 */
export function emitWorkflowProgress(
  executionId: string,
  progress: WorkflowProgress
): void {
  workflowEvents.emit('progress', { executionId, progress });
}

/**
 * Subscribe to step progress updates
 */
export function subscribeToStep(
  executionId: string,
  callback: (progress: StepProgress) => void
): () => void {
  const handler = (data: { executionId: string; progress: StepProgress }) => {
    if (data.executionId === executionId) {
      callback(data.progress);
    }
  };

  workflowEvents.on('step', handler);

  return () => {
    workflowEvents.off('step', handler);
  };
}

/**
 * Emit step progress update
 */
export function emitStepProgress(
  executionId: string,
  progress: StepProgress
): void {
  workflowEvents.emit('step', { executionId, progress });
}

/**
 * Calculate workflow progress
 */
export function calculateProgress(execution: WorkflowExecution): WorkflowProgress {
  const completedSteps = execution.results.filter(r => r.success).length;
  const progress = execution.totalSteps > 0
    ? Math.round((completedSteps / execution.totalSteps) * 100)
    : 0;

  // Estimate time remaining based on completed steps
  let estimatedTimeRemaining: number | undefined;
  if (execution.results.length > 0) {
    const avgStepDuration = execution.results.reduce((sum, r) => sum + r.duration, 0) / execution.results.length;
    const remainingSteps = execution.totalSteps - execution.results.length;
    estimatedTimeRemaining = Math.round((avgStepDuration * remainingSteps) / 1000); // Convert to seconds
  }

  return {
    executionId: execution.id,
    workflowName: execution.workflowId,
    status: execution.status,
    currentStep: execution.currentStepIndex + 1,
    totalSteps: execution.totalSteps,
    progress,
    startedAt: execution.startedAt,
    estimatedTimeRemaining
  };
}

/**
 * Format step progress for display
 */
export function formatStepProgress(stepProgress: StepProgress): string {
  const status = stepProgress.status === 'completed' ? '✓' :
                 stepProgress.status === 'failed' ? '✗' :
                 stepProgress.status === 'running' ? '⋯' : '○';

  const duration = stepProgress.duration
    ? ` (${(stepProgress.duration / 1000).toFixed(1)}s)`
    : '';

  return `${status} ${stepProgress.stepName}${duration}`;
}

/**
 * Format workflow progress for display
 */
export function formatWorkflowProgress(progress: WorkflowProgress): string {
  const emoji = progress.status === 'completed' ? '✓' :
                progress.status === 'failed' ? '✗' :
                progress.status === 'running' ? '⋯' :
                progress.status === 'cancelled' ? '⊘' : '○';

  const timeRemaining = progress.estimatedTimeRemaining
    ? ` (~${progress.estimatedTimeRemaining}s remaining)`
    : '';

  return `${emoji} ${progress.workflowName}: ${progress.currentStep}/${progress.totalSteps} (${progress.progress}%)${timeRemaining}`;
}

/**
 * Get real-time execution log
 */
export function getExecutionLog(execution: WorkflowExecution): string[] {
  const log: string[] = [];
  
  log.push(`========== WORKFLOW EXECUTION ==========`);
  log.push(`Workflow: ${execution.workflowId}`);
  log.push(`Execution ID: ${execution.id}`);
  log.push(`Status: ${execution.status.toUpperCase()}`);
  log.push(`Started: ${execution.startedAt.toISOString()}`);
  
  if (execution.completedAt) {
    const duration = execution.completedAt.getTime() - execution.startedAt.getTime();
    log.push(`Completed: ${execution.completedAt.toISOString()}`);
    log.push(`Duration: ${(duration / 1000).toFixed(1)}s`);
  }

  log.push(`\nSteps: ${execution.currentStepIndex + 1}/${execution.totalSteps}`);
  log.push(`=========================================\n`);

  // Add step results
  execution.results.forEach((result, index) => {
    const status = result.success ? '✓ SUCCESS' : '✗ FAILED';
    log.push(`Step ${index + 1}: ${result.stepType} - ${status}`);
    if (result.error) {
      log.push(`  Error: ${result.error}`);
    }
    log.push(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
    log.push('');
  });

  if (execution.error) {
    log.push(`ERROR: ${execution.error}`);
  }

  log.push(`=========================================`);

  return log;
}

/**
 * Get execution summary
 */
export function getExecutionSummary(execution: WorkflowExecution): {
  total: number;
  completed: number;
  failed: number;
  duration: number;
  status: string;
} {
  const completed = execution.results.filter(r => r.success).length;
  const failed = execution.results.filter(r => !r.success).length;
  const duration = execution.completedAt
    ? execution.completedAt.getTime() - execution.startedAt.getTime()
    : Date.now() - execution.startedAt.getTime();

  return {
    total: execution.totalSteps,
    completed,
    failed,
    duration,
    status: execution.status
  };
}

/**
 * Check if workflow is still running
 */
export function isWorkflowRunning(execution: WorkflowExecution): boolean {
  return execution.status === 'running' || execution.status === 'pending';
}

/**
 * Check if workflow completed successfully
 */
export function isWorkflowSuccessful(execution: WorkflowExecution): boolean {
  return execution.status === 'completed' && execution.results.every(r => r.success);
}
