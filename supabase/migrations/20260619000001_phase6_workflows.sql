-- Phase 6: Autonomous Workflow Engine - Database Schema
-- Migration: 20260619000001_phase6_workflows.sql
-- Description: Adds tables for workflow execution, approvals, reminders, calendar events, automation rules, and undo support

-- ============================================================================
-- WORKFLOW HISTORY TABLE
-- ============================================================================
-- Stores complete history of all workflow executions for audit and analytics
CREATE TABLE IF NOT EXISTS workflow_history (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    total_steps INTEGER NOT NULL,
    completed_steps INTEGER NOT NULL,
    results JSONB, -- Array of execution results
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_history_user ON workflow_history(user_id);
CREATE INDEX idx_workflow_history_status ON workflow_history(status);
CREATE INDEX idx_workflow_history_started ON workflow_history(started_at DESC);

COMMENT ON TABLE workflow_history IS 'Complete audit trail of all workflow executions';

-- ============================================================================
-- WORKFLOW APPROVALS TABLE
-- ============================================================================
-- Manages approval requests for dangerous or sensitive workflows
CREATE TABLE IF NOT EXISTS workflow_approvals (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_plan JSONB NOT NULL, -- Full workflow plan including steps
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT NOT NULL, -- Why approval is required
    created_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_workflow_approvals_user ON workflow_approvals(user_id);
CREATE INDEX idx_workflow_approvals_status ON workflow_approvals(status);
CREATE INDEX idx_workflow_approvals_expires ON workflow_approvals(expires_at);

COMMENT ON TABLE workflow_approvals IS 'Approval requests for dangerous workflows (delete, bulk operations)';

-- ============================================================================
-- REMINDERS TABLE
-- ============================================================================
-- Stores reminders extracted from emails or manually created
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deadline', 'meeting', 'invoice', 'assignment', 'follow_up', 'custom')),
    title TEXT NOT NULL,
    description TEXT,
    reminder_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    email_subject TEXT,
    email_from TEXT
);

CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_reminders_status ON reminders(status);
CREATE INDEX idx_reminders_date ON reminders(reminder_date);
CREATE INDEX idx_reminders_email ON reminders(email_id);

COMMENT ON TABLE reminders IS 'AI-extracted and manual reminders for deadlines, meetings, and follow-ups';

-- ============================================================================
-- CALENDAR EVENTS TABLE
-- ============================================================================
-- Stores calendar events extracted from emails
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    attendees TEXT[], -- Array of email addresses
    type TEXT NOT NULL CHECK (type IN ('meeting', 'interview', 'deadline', 'event')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    email_subject TEXT,
    email_from TEXT
);

CREATE INDEX idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_type ON calendar_events(type);
CREATE INDEX idx_calendar_events_status ON calendar_events(status);
CREATE INDEX idx_calendar_events_email ON calendar_events(email_id);

COMMENT ON TABLE calendar_events IS 'AI-extracted calendar events from meeting invitations and schedules';

-- ============================================================================
-- AUTOMATION RULES TABLE
-- ============================================================================
-- Stores user-defined automation rules for email processing
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    trigger JSONB NOT NULL, -- { type, conditions }
    actions JSONB NOT NULL, -- Array of actions to execute
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_executed TIMESTAMPTZ,
    execution_count INTEGER DEFAULT 0
);

CREATE INDEX idx_automation_rules_user ON automation_rules(user_id);
CREATE INDEX idx_automation_rules_enabled ON automation_rules(enabled);

COMMENT ON TABLE automation_rules IS 'Natural language automation rules (e.g., "Always archive promotions")';

-- ============================================================================
-- UNDOABLE ACTIONS TABLE
-- ============================================================================
-- Tracks workflow actions that can be undone within a timeout window
CREATE TABLE IF NOT EXISTS undoable_actions (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    original_state JSONB NOT NULL, -- State before action
    new_state JSONB NOT NULL, -- State after action
    timestamp TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'undone', 'expired'))
);

CREATE INDEX idx_undoable_actions_user ON undoable_actions(user_id);
CREATE INDEX idx_undoable_actions_execution ON undoable_actions(execution_id);
CREATE INDEX idx_undoable_actions_expires ON undoable_actions(expires_at);
CREATE INDEX idx_undoable_actions_status ON undoable_actions(status);

COMMENT ON TABLE undoable_actions IS 'Tracks actions that can be undone within 5-minute window';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE workflow_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE undoable_actions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY workflow_history_policy ON workflow_history
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY workflow_approvals_policy ON workflow_approvals
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY reminders_policy ON reminders
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY calendar_events_policy ON calendar_events
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY automation_rules_policy ON automation_rules
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY undoable_actions_policy ON undoable_actions
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to cleanup expired approvals
CREATE OR REPLACE FUNCTION cleanup_expired_approvals()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE workflow_approvals
    SET status = 'rejected'
    WHERE status = 'pending'
    AND expires_at < NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_approvals IS 'Automatically reject expired approval requests';

-- Function to cleanup expired undo actions
CREATE OR REPLACE FUNCTION cleanup_expired_undo_actions()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE undoable_actions
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_undo_actions IS 'Automatically expire undo actions after timeout';

-- Function to get workflow statistics
CREATE OR REPLACE FUNCTION get_workflow_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_executions', COUNT(*),
        'successful_executions', COUNT(*) FILTER (WHERE status = 'completed'),
        'failed_executions', COUNT(*) FILTER (WHERE status = 'failed'),
        'average_duration_ms', AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)
    )
    INTO result
    FROM workflow_history
    WHERE user_id = p_user_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_workflow_stats IS 'Get aggregated workflow statistics for a user';

-- ============================================================================
-- SAMPLE DATA (Optional, for testing)
-- ============================================================================

-- No sample data inserted - tables start empty

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Phase 6 Workflow Engine schema created successfully';
    RAISE NOTICE 'Tables created: workflow_history, workflow_approvals, reminders, calendar_events, automation_rules, undoable_actions';
    RAISE NOTICE 'RLS enabled on all tables';
    RAISE NOTICE 'Helper functions created: cleanup_expired_approvals, cleanup_expired_undo_actions, get_workflow_stats';
END $$;
