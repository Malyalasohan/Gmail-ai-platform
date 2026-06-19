/**
 * Workflow Execution API
 * 
 * POST /api/workflow/run - Execute a workflow from natural language or template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { executeAutomation, AutomationRequest } from '@/lib/workflows/automation';

export async function POST(req: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { type, request, templateId, params, emailIds } = body;

    // Validate request
    if (!type || !request) {
      return NextResponse.json(
        { error: 'Missing required fields: type, request' },
        { status: 400 }
      );
    }

    // Get email context if emailIds provided
    let emailContext: any[] | undefined;
    if (emailIds && emailIds.length > 0) {
      const { createServiceClient } = await import('@/lib/supabase/server');
      const supabase = createServiceClient();
      
      const { data: emails } = await supabase
        .from('emails')
        .select('id, gmail_message_id, subject, from, body, thread_id, category')
        .in('id', emailIds)
        .eq('user_id', session.user.id);

      if (emails) {
        emailContext = emails.map(e => ({
          id: e.id,
          gmail_message_id: e.gmail_message_id,
          subject: e.subject,
          from: e.from,
          body: e.body,
          threadId: e.thread_id,
          category: e.category
        }));
      }
    }

    // Build automation request
    const automationRequest: AutomationRequest = {
      userId: session.user.id,
      accessToken: session.accessToken,
      type,
      request,
      templateId,
      params,
      emailContext
    };

    console.log('[WORKFLOW API] Executing automation:', {
      type,
      request: request.substring(0, 100),
      emailCount: emailContext?.length || 0
    });

    // Execute automation
    const result = await executeAutomation(automationRequest);

    // Return result
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[WORKFLOW API] Error executing workflow:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to execute workflow' },
      { status: 500 }
    );
  }
}
