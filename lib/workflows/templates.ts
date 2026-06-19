/**
 * Workflow Templates
 * 
 * Pre-built workflow templates for common use cases.
 */

import { WorkflowPlan, WorkflowStep } from './planner';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'recruitment' | 'business' | 'personal' | 'productivity' | 'communication';
  tags: string[];
  steps: WorkflowStep[];
  requiredParams: string[];
}

/**
 * Get all workflow templates
 */
export function getWorkflowTemplates(): WorkflowTemplate[] {
  return [
    {
      id: 'handle_interview',
      name: 'Handle Interview Request',
      description: 'Reply professionally, add Interview label, star, create calendar event, and set reminder',
      category: 'recruitment',
      tags: ['interview', 'recruitment', 'calendar', 'reminder'],
      requiredParams: ['emailId'],
      steps: [
        {
          id: 'step_1',
          type: 'reply',
          description: 'Send professional confirmation reply',
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
          description: 'Star for importance',
          params: {},
          requiresApproval: false,
          estimatedTime: 1
        },
        {
          id: 'step_4',
          type: 'create_calendar_event',
          description: 'Create calendar event',
          params: { extractFromEmail: true },
          requiresApproval: false,
          estimatedTime: 2
        },
        {
          id: 'step_5',
          type: 'create_reminder',
          description: 'Set reminder one day before',
          params: { daysBefore: 1, message: 'Interview tomorrow' },
          requiresApproval: false,
          estimatedTime: 1
        }
      ]
    },
    {
      id: 'handle_invoice',
      name: 'Handle Invoice',
      description: 'Label as Bills, star, and create payment reminder',
      category: 'business',
      tags: ['invoice', 'bills', 'payment', 'reminder'],
      requiredParams: ['emailId'],
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
        },
        {
          id: 'step_4',
          type: 'mark_read',
          description: 'Mark as read',
          params: {},
          requiresApproval: false,
          estimatedTime: 1
        }
      ]
    },
    {
      id: 'handle_meeting',
      name: 'Handle Meeting Request',
      description: 'Accept meeting, add Meeting label, and create calendar event',
      category: 'business',
      tags: ['meeting', 'calendar', 'business'],
      requiredParams: ['emailId'],
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
        },
        {
          id: 'step_4',
          type: 'star',
          description: 'Star for importance',
          params: {},
          requiresApproval: false,
          estimatedTime: 1
        }
      ]
    },
    {
      id: 'handle_assignment',
      name: 'Handle Assignment/Project',
      description: 'Label as Work, star, extract deadline, and create reminder',
      category: 'productivity',
      tags: ['assignment', 'project', 'deadline', 'reminder'],
      requiredParams: ['emailId'],
      steps: [
        {
          id: 'step_1',
          type: 'label',
          description: 'Add Work label',
          params: { label: 'Work' },
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
          description: 'Create deadline reminder',
          params: { extractFromEmail: true },
          requiresApproval: false,
          estimatedTime: 2
        }
      ]
    },
    {
      id: 'handle_recruiter',
      name: 'Handle Recruiter Email',
      description: 'Label as Recruitment, star, and send interested reply',
      category: 'recruitment',
      tags: ['recruiter', 'recruitment', 'job'],
      requiredParams: ['emailId'],
      steps: [
        {
          id: 'step_1',
          type: 'label',
          description: 'Add Recruitment label',
          params: { label: 'Recruitment' },
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
          type: 'reply',
          description: 'Send interested reply',
          params: { tone: 'professional', intent: 'express_interest' },
          requiresApproval: true,
          estimatedTime: 3
        }
      ]
    },
    {
      id: 'clean_promotions',
      name: 'Clean Up Promotions',
      description: 'Archive all promotional emails',
      category: 'productivity',
      tags: ['cleanup', 'promotions', 'archive'],
      requiredParams: [],
      steps: [
        {
          id: 'step_1',
          type: 'archive',
          description: 'Archive all promotional emails',
          params: { category: 'Promotion' },
          requiresApproval: true,
          estimatedTime: 5
        }
      ]
    },
    {
      id: 'clean_newsletters',
      name: 'Clean Up Newsletters',
      description: 'Archive all newsletter emails',
      category: 'productivity',
      tags: ['cleanup', 'newsletters', 'archive'],
      requiredParams: [],
      steps: [
        {
          id: 'step_1',
          type: 'archive',
          description: 'Archive all newsletter emails',
          params: { category: 'Newsletter' },
          requiresApproval: true,
          estimatedTime: 5
        }
      ]
    },
    {
      id: 'handle_client',
      name: 'Handle Client Email',
      description: 'Label as Client, star, and prepare professional reply',
      category: 'business',
      tags: ['client', 'business', 'communication'],
      requiredParams: ['emailId'],
      steps: [
        {
          id: 'step_1',
          type: 'label',
          description: 'Add Client label',
          params: { label: 'Client' },
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
          type: 'reply',
          description: 'Send professional reply',
          params: { tone: 'professional', intent: 'respond_to_client' },
          requiresApproval: true,
          estimatedTime: 3
        }
      ]
    },
    {
      id: 'follow_up_reminder',
      name: 'Set Follow-Up Reminder',
      description: 'Create reminder to follow up on email',
      category: 'productivity',
      tags: ['follow-up', 'reminder', 'productivity'],
      requiredParams: ['emailId'],
      steps: [
        {
          id: 'step_1',
          type: 'create_reminder',
          description: 'Create follow-up reminder',
          params: { daysFromNow: 3, message: 'Follow up on this email' },
          requiresApproval: false,
          estimatedTime: 1
        },
        {
          id: 'step_2',
          type: 'star',
          description: 'Star for tracking',
          params: {},
          requiresApproval: false,
          estimatedTime: 1
        }
      ]
    },
    {
      id: 'urgent_action',
      name: 'Mark as Urgent',
      description: 'Star, label as Urgent, and create immediate reminder',
      category: 'productivity',
      tags: ['urgent', 'priority', 'reminder'],
      requiredParams: ['emailId'],
      steps: [
        {
          id: 'step_1',
          type: 'star',
          description: 'Star for importance',
          params: {},
          requiresApproval: false,
          estimatedTime: 1
        },
        {
          id: 'step_2',
          type: 'label',
          description: 'Add Urgent label',
          params: { label: 'Urgent' },
          requiresApproval: false,
          estimatedTime: 1
        },
        {
          id: 'step_3',
          type: 'create_reminder',
          description: 'Create immediate reminder',
          params: { daysFromNow: 0, message: 'Urgent: needs immediate attention' },
          requiresApproval: false,
          estimatedTime: 1
        }
      ]
    }
  ];
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return getWorkflowTemplates().find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: WorkflowTemplate['category']): WorkflowTemplate[] {
  return getWorkflowTemplates().filter(t => t.category === category);
}

/**
 * Get templates by tag
 */
export function getTemplatesByTag(tag: string): WorkflowTemplate[] {
  return getWorkflowTemplates().filter(t => t.tags.includes(tag));
}

/**
 * Convert template to workflow plan
 */
export function templateToWorkflowPlan(
  template: WorkflowTemplate,
  params: Record<string, any>
): WorkflowPlan {
  // Validate required params
  const missingParams = template.requiredParams.filter(p => !params[p]);
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }

  // Inject params into steps
  const steps = template.steps.map(step => ({
    ...step,
    params: {
      ...step.params,
      ...params
    }
  }));

  const totalEstimatedTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);
  const requiresApproval = steps.some(step => step.requiresApproval);

  return {
    id: `workflow_${Date.now()}`,
    name: template.name,
    description: template.description,
    steps,
    totalEstimatedTime,
    requiresApproval,
    context: {
      emailIds: params.emailId ? [params.emailId] : [],
      threadIds: params.threadId ? [params.threadId] : [],
      labels: []
    }
  };
}
