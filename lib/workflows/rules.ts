/**
 * Automation Rules
 * 
 * Natural language automation rules that trigger workflows automatically.
 */

import { generateText } from '../ai-provider';
import { createServiceClient } from '../supabase/server';
import { WorkflowPlan } from './planner';

export interface AutomationRule {
  id: string;
  userId: string;
  name: string;
  description: string;
  trigger: RuleTrigger;
  actions: RuleAction[];
  enabled: boolean;
  createdAt: Date;
  lastExecuted?: Date;
  executionCount: number;
}

export interface RuleTrigger {
  type: 'email_received' | 'email_sent' | 'label_added' | 'category_match' | 'sender_match' | 'keyword_match' | 'schedule';
  conditions: {
    category?: string;
    sender?: string;
    keywords?: string[];
    subject?: string;
    schedule?: string; // cron expression
  };
}

export interface RuleAction {
  type: 'archive' | 'label' | 'star' | 'delete' | 'forward' | 'reply' | 'mark_read' | 'notify';
  params: Record<string, any>;
}

/**
 * Create automation rule from natural language
 */
export async function createAutomationRuleFromNL(
  userId: string,
  naturalLanguage: string
): Promise<AutomationRule> {
  console.log('[AUTOMATION] Creating rule from NL:', naturalLanguage);

  const prompt = `Convert this natural language automation rule into a structured format.

USER REQUEST: "${naturalLanguage}"

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "name": "Brief rule name",
  "description": "What this rule does",
  "trigger": {
    "type": "email_received|email_sent|label_added|category_match|sender_match|keyword_match|schedule",
    "conditions": {
      "category": "Category name (optional)",
      "sender": "Sender email pattern (optional)",
      "keywords": ["keyword1", "keyword2"] (optional),
      "subject": "Subject pattern (optional)",
      "schedule": "cron expression (optional)"
    }
  },
  "actions": [
    {
      "type": "archive|label|star|delete|forward|reply|mark_read|notify",
      "params": { ... }
    }
  ]
}

Examples:
- "Always archive promotions" -> category_match trigger with archive action
- "Star all recruiter emails" -> sender_match trigger with star action
- "Whenever invoice arrives, label as Bills" -> keyword_match trigger with label action`;

  try {
    const response = await generateText(prompt, { temperature: 0.3 });
    const parsed = JSON.parse(response);

    const ruleId = `rule_${Date.now()}`;
    const rule: AutomationRule = {
      id: ruleId,
      userId,
      name: parsed.name,
      description: parsed.description,
      trigger: parsed.trigger,
      actions: parsed.actions,
      enabled: true,
      createdAt: new Date(),
      executionCount: 0
    };

    // Save to database
    const supabase = createServiceClient();
    await supabase
      .from('automation_rules')
      .insert({
        id: rule.id,
        user_id: userId,
        name: rule.name,
        description: rule.description,
        trigger: rule.trigger,
        actions: rule.actions,
        enabled: rule.enabled,
        created_at: rule.createdAt,
        execution_count: 0
      });

    console.log('[AUTOMATION] Rule created:', ruleId);
    return rule;
  } catch (error) {
    console.error('[AUTOMATION] Failed to create rule:', error);
    throw new Error('Failed to create automation rule');
  }
}

/**
 * Get all rules for a user
 */
export async function getAutomationRules(userId: string): Promise<AutomationRule[]> {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      trigger: row.trigger,
      actions: row.actions,
      enabled: row.enabled,
      createdAt: new Date(row.created_at),
      lastExecuted: row.last_executed ? new Date(row.last_executed) : undefined,
      executionCount: row.execution_count
    }));
  } catch (error) {
    console.error('[AUTOMATION] Error getting rules:', error);
    return [];
  }
}

/**
 * Check if email matches rule trigger
 */
export function doesEmailMatchTrigger(
  email: {
    category?: string;
    from: string;
    subject: string;
    body: string;
  },
  trigger: RuleTrigger
): boolean {
  switch (trigger.type) {
    case 'email_received':
      return true; // All received emails match

    case 'category_match':
      if (trigger.conditions.category && email.category) {
        return email.category.toLowerCase() === trigger.conditions.category.toLowerCase();
      }
      return false;

    case 'sender_match':
      if (trigger.conditions.sender) {
        const pattern = trigger.conditions.sender.toLowerCase();
        return email.from.toLowerCase().includes(pattern);
      }
      return false;

    case 'keyword_match':
      if (trigger.conditions.keywords && trigger.conditions.keywords.length > 0) {
        const text = `${email.subject} ${email.body}`.toLowerCase();
        return trigger.conditions.keywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        );
      }
      return false;

    default:
      return false;
  }
}

/**
 * Execute rule actions on an email
 */
export async function executeRuleActions(
  rule: AutomationRule,
  emailId: string,
  gmailMessageId: string,
  userEmail: string
): Promise<boolean> {
  console.log('[AUTOMATION] Executing rule actions:', rule.name);

  try {
    const { manageLabels } = await import('../gmail/labels');
    const { starEmails } = await import('../gmail/star');
    const { archiveEmails } = await import('../gmail/archive');
    const { deleteEmails } = await import('../gmail/delete');

    for (const action of rule.actions) {
      switch (action.type) {
        case 'archive':
          await archiveEmails({
            emailIds: [emailId],
            gmailMessageIds: [gmailMessageId],
            userEmail
          });
          break;

        case 'label':
          if (action.params.label) {
            await manageLabels({
              emailIds: [emailId],
              gmailMessageIds: [gmailMessageId],
              userEmail,
              operation: 'add_label',
              labelName: action.params.label
            });
          }
          break;

        case 'star':
          await starEmails({
            emailIds: [emailId],
            gmailMessageIds: [gmailMessageId],
            userEmail,
            star: true
          });
          break;

        case 'delete':
          await deleteEmails({
            emailIds: [emailId],
            gmailMessageIds: [gmailMessageId],
            userEmail,
            moveToTrash: true
          });
          break;

        case 'mark_read':
          await manageLabels({
            emailIds: [emailId],
            gmailMessageIds: [gmailMessageId],
            userEmail,
            operation: 'read'
          });
          break;

        case 'notify':
          // Notification would be handled by the frontend
          console.log('[AUTOMATION] Notification:', action.params.message);
          break;

        default:
          console.log('[AUTOMATION] Unknown action type:', action.type);
      }
    }

    // Update execution count
    const supabase = createServiceClient();
    await supabase
      .from('automation_rules')
      .update({
        last_executed: new Date().toISOString(),
        execution_count: rule.executionCount + 1
      })
      .eq('id', rule.id);

    console.log('[AUTOMATION] Rule executed successfully');
    return true;
  } catch (error) {
    console.error('[AUTOMATION] Failed to execute rule actions:', error);
    return false;
  }
}

/**
 * Toggle rule enabled status
 */
export async function toggleRule(ruleId: string, userId: string, enabled: boolean): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('automation_rules')
      .update({ enabled })
      .eq('id', ruleId)
      .eq('user_id', userId);

    if (error) {
      console.error('[AUTOMATION] Failed to toggle rule:', error);
      return false;
    }

    console.log('[AUTOMATION] Rule toggled:', ruleId, enabled);
    return true;
  } catch (error) {
    console.error('[AUTOMATION] Error toggling rule:', error);
    return false;
  }
}

/**
 * Delete automation rule
 */
export async function deleteRule(ruleId: string, userId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', userId);

    if (error) {
      console.error('[AUTOMATION] Failed to delete rule:', error);
      return false;
    }

    console.log('[AUTOMATION] Rule deleted:', ruleId);
    return true;
  } catch (error) {
    console.error('[AUTOMATION] Error deleting rule:', error);
    return false;
  }
}

/**
 * Process incoming email against all rules
 */
export async function processEmailAgainstRules(
  userId: string,
  email: {
    id: string;
    gmail_message_id: string;
    category?: string;
    from: string;
    subject: string;
    body: string;
  },
  userEmail: string
): Promise<number> {
  const rules = await getAutomationRules(userId);
  const enabledRules = rules.filter(r => r.enabled);
  
  let executedCount = 0;

  for (const rule of enabledRules) {
    if (doesEmailMatchTrigger(email, rule.trigger)) {
      console.log('[AUTOMATION] Email matches rule:', rule.name);
      
      const success = await executeRuleActions(
        rule,
        email.id,
        email.gmail_message_id,
        userEmail
      );
      if (success) {
        executedCount++;
      }
    }
  }

  return executedCount;
}

