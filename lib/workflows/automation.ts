/**
 * Workflow Automation Orchestrator
 * 
 * Main orchestrator that ties together all workflow components.
 * This is the main entry point for autonomous workflow execution.
 */

import { generateWorkflowPlan, WorkflowPlan, PlanRequest } from './planner';
import { executeWorkflow, WorkflowExecution } from './executor';
import { createApprovalRequest, isWorkflowApproved, getApprovalReason } from './approval';
import { autoGenerateReminders } from './reminders';
import { autoGenerateCalendarEvents } from './calendar';
import { getWorkflowTemplates, templateToWorkflowPlan } from './templates';
import { processEmailAgainstRules } from './rules';
import { calculateProgress, emitWorkflowProgress } from './monitor';
import { withRetry } from './retry';

export interface AutomationRequest {
  userId: string;
  accessToken: string;
  type: 'natural_language' | 'template' | 'manual';
  request: string;
  emailContext?: {
    id: string;
    gmail_message_id: string;
    subject: string;
    from: string;
    body: string;
    threadId: string;
    category?: string;
  }[];
  templateId?: string;
  params?: Record<string, any>;
}

export interface AutomationResult {
  success: boolean;
  workflow?: WorkflowPlan;
  execution?: WorkflowExecution;
  requiresApproval?: boolean;
  approvalId?: string;
  error?: string;
  summary: string;
}

/**
 * Main automation entry point
 * 
 * Handles the complete workflow: plan → approve → execute
 */
export async function executeAutomation(request: AutomationRequest): Promise<AutomationResult> {
  console.log('[AUTOMATION] Starting automation:', {
    type: request.type,
    request: request.request
  });

  try {
    // Step 1: Generate or retrieve workflow plan
    let plan: WorkflowPlan;

    if (request.type === 'template' && request.templateId) {
      // Use template
      const templates = getWorkflowTemplates();
      const template = templates.find(t => t.id === request.templateId);
      
      if (!template) {
        return {
          success: false,
          error: 'Template not found',
          summary: `Template ${request.templateId} does not exist`
        };
      }

      plan = templateToWorkflowPlan(template, request.params || {});
      console.log('[AUTOMATION] Using template:', template.name);
    } else {
      // Generate plan from natural language
      const planRequest: PlanRequest = {
        userRequest: request.request,
        emailContext: request.emailContext?.map(e => ({
          id: e.id,
          subject: e.subject,
          from: e.from,
          body: e.body.substring(0, 1000),
          threadId: e.threadId
        }))
      };

      plan = await generateWorkflowPlan(planRequest);
      console.log('[AUTOMATION] Generated plan:', plan.name);
    }

    // Step 2: Check if approval is required
    if (plan.requiresApproval) {
      const reason = getApprovalReason(plan);
      const approval = await createApprovalRequest(plan, request.userId, reason);

      console.log('[AUTOMATION] Approval required:', reason);

      return {
        success: false,
        workflow: plan,
        requiresApproval: true,
        approvalId: approval.id,
        summary: `Workflow requires approval: ${reason}`
      };
    }

    // Step 3: Execute workflow
    console.log('[AUTOMATION] Executing workflow...');
    
    const execution = await withRetry(
      () => executeWorkflow(plan, request.userId, request.accessToken),
      undefined,
      plan.name
    );

    // Emit final progress
    const progress = calculateProgress(execution);
    emitWorkflowProgress(execution.id, progress);

    // Step 4: Generate summary
    const summary = generateExecutionSummary(execution, plan);

    return {
      success: execution.status === 'completed',
      workflow: plan,
      execution,
      summary
    };
  } catch (error: any) {
    console.error('[AUTOMATION] Automation failed:', error);
    
    return {
      success: false,
      error: error.message,
      summary: `Automation failed: ${error.message}`
    };
  }
}

/**
 * Execute approved workflow
 */
export async function executeApprovedWorkflow(
  approvalId: string,
  userId: string,
  accessToken: string
): Promise<AutomationResult> {
  console.log('[AUTOMATION] Executing approved workflow:', approvalId);

  try {
    // Check if approved
    const approved = await isWorkflowApproved(approvalId, userId);
    
    if (!approved) {
      return {
        success: false,
        error: 'Workflow not approved',
        summary: 'Workflow has not been approved or approval expired'
      };
    }

    // Get workflow from approval
    const { createServiceClient } = await import('../supabase/server');
    const supabase = createServiceClient();
    
    const { data } = await supabase
      .from('workflow_approvals')
      .select('workflow_plan')
      .eq('id', approvalId)
      .single();

    if (!data) {
      return {
        success: false,
        error: 'Workflow not found',
        summary: 'Could not retrieve workflow details'
      };
    }

    const plan: WorkflowPlan = data.workflow_plan;

    // Execute workflow
    const execution = await executeWorkflow(plan, userId, accessToken);
    
    const summary = generateExecutionSummary(execution, plan);

    return {
      success: execution.status === 'completed',
      workflow: plan,
      execution,
      summary
    };
  } catch (error: any) {
    console.error('[AUTOMATION] Failed to execute approved workflow:', error);
    
    return {
      success: false,
      error: error.message,
      summary: `Execution failed: ${error.message}`
    };
  }
}

/**
 * Handle new email with automation rules
 */
export async function handleNewEmail(
  userId: string,
  email: {
    id: string;
    gmail_message_id: string;
    subject: string;
    from: string;
    body: string;
    threadId: string;
    category?: string;
  },
  accessToken: string
): Promise<{
  rulesExecuted: number;
  remindersCreated: number;
  eventsCreated: number;
}> {
  console.log('[AUTOMATION] Processing new email:', email.subject);

  try {
    // Apply automation rules
    const rulesExecuted = await processEmailAgainstRules(userId, email, accessToken);

    // Auto-generate reminders
    const reminders = await autoGenerateReminders(
      userId,
      email.id,
      email.subject,
      email.body,
      email.from
    );

    // Auto-generate calendar events
    const events = await autoGenerateCalendarEvents(
      userId,
      email.id,
      email.subject,
      email.body,
      email.from
    );

    console.log('[AUTOMATION] Email processed:', {
      rulesExecuted,
      remindersCreated: reminders.length,
      eventsCreated: events.length
    });

    return {
      rulesExecuted,
      remindersCreated: reminders.length,
      eventsCreated: events.length
    };
  } catch (error) {
    console.error('[AUTOMATION] Failed to process email:', error);
    return {
      rulesExecuted: 0,
      remindersCreated: 0,
      eventsCreated: 0
    };
  }
}

/**
 * Generate execution summary
 */
function generateExecutionSummary(execution: WorkflowExecution, plan: WorkflowPlan): string {
  if (execution.status === 'completed') {
    const duration = execution.completedAt
      ? ((execution.completedAt.getTime() - execution.startedAt.getTime()) / 1000).toFixed(1)
      : '0';

    const steps = execution.results.map(r => 
      `  ${r.success ? '✓' : '✗'} ${r.stepType}`
    ).join('\n');

    return `Workflow "${plan.name}" completed successfully in ${duration}s\n\nSteps executed:\n${steps}`;
  } else if (execution.status === 'failed') {
    const failedStep = execution.results.find(r => !r.success);
    return `Workflow "${plan.name}" failed at step ${execution.currentStepIndex + 1}${failedStep ? `: ${failedStep.error}` : ''}`;
  } else {
    return `Workflow "${plan.name}" status: ${execution.status}`;
  }
}

/**
 * Get workflow suggestions for an email
 */
export async function getWorkflowSuggestions(
  email: {
    subject: string;
    from: string;
    body: string;
    category?: string;
  }
): Promise<string[]> {
  const suggestions: string[] = [];

  // Check category
  if (email.category === 'Interview') {
    suggestions.push('handle_interview');
  } else if (email.category === 'Bills' || email.subject.toLowerCase().includes('invoice')) {
    suggestions.push('handle_invoice');
  } else if (email.subject.toLowerCase().includes('meeting')) {
    suggestions.push('handle_meeting');
  } else if (email.from.toLowerCase().includes('recruiter') || email.from.toLowerCase().includes('hiring')) {
    suggestions.push('handle_recruiter');
  }

  // Check keywords
  const body = email.body.toLowerCase();
  if (body.includes('deadline') || body.includes('due date')) {
    suggestions.push('handle_assignment');
  }

  return [...new Set(suggestions)]; // Remove duplicates
}

