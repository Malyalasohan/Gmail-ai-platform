/**
 * Workflow Planner
 * 
 * Generates step-by-step execution plans for user requests.
 * Analyzes context and determines optimal action sequences.
 */

import { generateText } from '../ai-provider';

export interface WorkflowStep {
  id: string;
  type: 'read' | 'reply' | 'archive' | 'delete' | 'forward' | 'label' | 'star' | 'unstar' | 'mark_read' | 'mark_unread' | 'create_reminder' | 'create_calendar_event';
  description: string;
  params: Record<string, any>;
  requiresApproval: boolean;
  estimatedTime: number; // in seconds
}

export interface WorkflowPlan {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  totalEstimatedTime: number;
  requiresApproval: boolean;
  context: {
    emailIds?: string[];
    threadIds?: string[];
    labels?: string[];
  };
}

export interface PlanRequest {
  userRequest: string;
  emailContext?: {
    id: string;
    subject: string;
    from: string;
    body: string;
    threadId: string;
  }[];
  availableLabels?: string[];
}

/**
 * Generate a workflow plan from a user request
 */
export async function generateWorkflowPlan(request: PlanRequest): Promise<WorkflowPlan> {
  console.log('[WORKFLOW PLANNER] Generating plan for:', request.userRequest);

  const prompt = `You are a workflow planner for an AI email assistant. Analyze this user request and generate a step-by-step execution plan.

USER REQUEST: "${request.userRequest}"

${request.emailContext ? `
EMAIL CONTEXT:
${request.emailContext.map((email, i) => `
Email ${i + 1}:
- ID: ${email.id}
- From: ${email.from}
- Subject: ${email.subject}
- Thread: ${email.threadId}
`).join('\n')}
` : ''}

${request.availableLabels ? `
AVAILABLE LABELS: ${request.availableLabels.join(', ')}
` : ''}

AVAILABLE ACTIONS:
- read: Read email content
- reply: Generate and send a reply
- archive: Archive email
- delete: Delete email
- forward: Forward email
- label: Add label to email
- star: Star email
- unstar: Unstar email
- mark_read: Mark as read
- mark_unread: Mark as unread
- create_reminder: Create a reminder
- create_calendar_event: Create calendar event

RULES:
1. Break complex requests into simple, sequential steps
2. Mark dangerous actions (delete, bulk operations) as requiresApproval: true
3. Estimate time for each step (in seconds)
4. Provide clear descriptions for each step
5. Include all necessary parameters for each action

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "name": "Brief workflow name",
  "description": "What this workflow does",
  "steps": [
    {
      "id": "step_1",
      "type": "action_type",
      "description": "What this step does",
      "params": { "emailId": "id", ... },
      "requiresApproval": false,
      "estimatedTime": 2
    }
  ]
}`;

  try {
    const response = await generateText(prompt, { temperature: 0.3 });
    const parsed = JSON.parse(response);

    // Calculate total time and approval requirements
    const totalEstimatedTime = parsed.steps.reduce((sum: number, step: WorkflowStep) => sum + step.estimatedTime, 0);
    const requiresApproval = parsed.steps.some((step: WorkflowStep) => step.requiresApproval);

    // Extract context
    const emailIds = request.emailContext?.map(e => e.id) || [];
    const threadIds = [...new Set(request.emailContext?.map(e => e.threadId) || [])];

    const plan: WorkflowPlan = {
      id: `workflow_${Date.now()}`,
      name: parsed.name,
      description: parsed.description,
      steps: parsed.steps,
      totalEstimatedTime,
      requiresApproval,
      context: {
        emailIds,
        threadIds,
        labels: request.availableLabels || []
      }
    };

    console.log('[WORKFLOW PLANNER] Generated plan:', {
      name: plan.name,
      steps: plan.steps.length,
      requiresApproval: plan.requiresApproval,
      estimatedTime: plan.totalEstimatedTime
    });

    return plan;
  } catch (error) {
    console.error('[WORKFLOW PLANNER] Error generating plan:', error);
    throw new Error('Failed to generate workflow plan');
  }
}

/**
 * Validate a workflow plan
 */
export function validateWorkflowPlan(plan: WorkflowPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!plan.name) errors.push('Workflow name is required');
  if (!plan.steps || plan.steps.length === 0) errors.push('Workflow must have at least one step');

  // Validate each step
  plan.steps.forEach((step, index) => {
    if (!step.id) errors.push(`Step ${index + 1}: ID is required`);
    if (!step.type) errors.push(`Step ${index + 1}: Type is required`);
    if (!step.description) errors.push(`Step ${index + 1}: Description is required`);
    if (step.estimatedTime <= 0) errors.push(`Step ${index + 1}: Estimated time must be positive`);

    // Validate parameters for specific actions
    if (['reply', 'forward', 'label', 'star', 'unstar', 'archive', 'delete', 'mark_read', 'mark_unread'].includes(step.type)) {
      if (!step.params.emailId && !step.params.threadId) {
        errors.push(`Step ${index + 1}: emailId or threadId required for ${step.type}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a workflow requires approval
 */
export function requiresApprovalCheck(plan: WorkflowPlan): boolean {
  // Dangerous operations
  const dangerousTypes = ['delete'];
  
  // Bulk operations (more than 10 emails)
  const isBulkOperation = (plan.context.emailIds?.length || 0) > 10;

  // Check for dangerous operations
  const hasDangerousOp = plan.steps.some(step => dangerousTypes.includes(step.type));

  return hasDangerousOp || isBulkOperation || plan.requiresApproval;
}

/**
 * Get workflow templates
 */
export function getWorkflowTemplates(): Record<string, WorkflowPlan> {
  return {
    handle_interview: {
      id: 'template_interview',
      name: 'Handle Interview Request',
      description: 'Reply professionally, add interview label, star, and create calendar event',
      steps: [
        {
          id: 'step_1',
          type: 'reply',
          description: 'Generate professional reply confirming interview',
          params: { tone: 'professional', intent: 'confirm_interview' },
          requiresApproval: false,
          estimatedTime: 3
        },
        {
          id: 'step_2',
          type: 'label',
          description: 'Add Interview label',
          params: { label: 'Interview' },
          requiresApproval: false,
          estimatedTime: 1
        },
        {
          id: 'step_3',
          type: 'star',
          description: 'Star the email',
          params: {},
          requiresApproval: false,
          estimatedTime: 1
        },
        {
          id: 'step_4',
          type: 'create_calendar_event',
          description: 'Create calendar event for interview',
          params: { extractFromEmail: true },
          requiresApproval: false,
          estimatedTime: 2
        },
        {
          id: 'step_5',
          type: 'create_reminder',
          description: 'Create reminder one day before',
          params: { daysBefore: 1, message: 'Interview tomorrow' },
          requiresApproval: false,
          estimatedTime: 1
        }
      ],
      totalEstimatedTime: 8,
      requiresApproval: false,
      context: {}
    },
    handle_invoice: {
      id: 'template_invoice',
      name: 'Handle Invoice',
      description: 'Label as Bills, star, and create payment reminder',
      steps: [
        {
          id: 'step_1',
          type: 'label',
          description: 'Add Bills label',
          params: { label: 'Bills' },
          requiresApproval: false,
          estimatedTime: 1
        },
        {
          id: 'step_2',
          type: 'star',
          description: 'Star for importance',
          params: {},
          requiresApproval: false,
          estimatedTime: 1
        },
        {
          id: 'step_3',
          type: 'create_reminder',
          description: 'Create payment reminder',
          params: { daysFromNow: 7, message: 'Payment due soon' },
          requiresApproval: false,
          estimatedTime: 1
        }
      ],
      totalEstimatedTime: 3,
      requiresApproval: false,
      context: {}
    },
    handle_meeting: {
      id: 'template_meeting',
      name: 'Handle Meeting Request',
      description: 'Reply to accept, add Meeting label, and create calendar event',
      steps: [
        {
          id: 'step_1',
          type: 'reply',
          description: 'Accept meeting invitation',
          params: { tone: 'professional', intent: 'accept_meeting' },
          requiresApproval: false,
          estimatedTime: 3
        },
        {
          id: 'step_2',
          type: 'label',
          description: 'Add Meeting label',
          params: { label: 'Meeting' },
          requiresApproval: false,
          estimatedTime: 1
        },
        {
          id: 'step_3',
          type: 'create_calendar_event',
          description: 'Create calendar event',
          params: { extractFromEmail: true },
          requiresApproval: false,
          estimatedTime: 2
        }
      ],
      totalEstimatedTime: 6,
      requiresApproval: false,
      context: {}
    },
    clean_promotions: {
      id: 'template_clean_promotions',
      name: 'Archive Promotions',
      description: 'Archive all promotional emails',
      steps: [
        {
          id: 'step_1',
          type: 'archive',
          description: 'Archive promotional emails',
          params: { category: 'Promotion' },
          requiresApproval: true,
          estimatedTime: 5
        }
      ],
      totalEstimatedTime: 5,
      requiresApproval: true,
      context: {}
    },
    clean_newsletters: {
      id: 'template_clean_newsletters',
      name: 'Archive Newsletters',
      description: 'Archive all newsletter emails',
      steps: [
        {
          id: 'step_1',
          type: 'archive',
          description: 'Archive newsletter emails',
          params: { category: 'Newsletter' },
          requiresApproval: true,
          estimatedTime: 5
        }
      ],
      totalEstimatedTime: 5,
      requiresApproval: true,
      context: {}
    }
  };
}
