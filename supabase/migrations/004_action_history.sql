-- Phase 4: Action History Table
-- Stores history of all Gmail actions performed by users

CREATE TABLE IF NOT EXISTS action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  email_ids TEXT[] NOT NULL DEFAULT '{}',
  thread_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_action_history_user_id 
  ON action_history(user_id);

-- Index for recent actions
CREATE INDEX IF NOT EXISTS idx_action_history_created_at 
  ON action_history(created_at DESC);

-- Index for action type filtering
CREATE INDEX IF NOT EXISTS idx_action_history_action 
  ON action_history(action);

-- Row Level Security
ALTER TABLE action_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own action history
CREATE POLICY action_history_select_own 
  ON action_history FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can only insert their own actions
CREATE POLICY action_history_insert_own 
  ON action_history FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- No updates allowed (immutable history)
CREATE POLICY action_history_no_update 
  ON action_history FOR UPDATE 
  USING (false);

-- No deletes allowed (preserve history)
CREATE POLICY action_history_no_delete 
  ON action_history FOR DELETE 
  USING (false);

-- Grant permissions
GRANT SELECT, INSERT ON action_history TO authenticated;

COMMENT ON TABLE action_history IS 'Phase 4: Stores history of all Gmail actions performed by users';
COMMENT ON COLUMN action_history.action IS 'Type of action performed (reply, archive, delete, etc.)';
COMMENT ON COLUMN action_history.email_ids IS 'Array of email IDs affected by the action';
COMMENT ON COLUMN action_history.thread_ids IS 'Array of thread IDs affected by the action';
COMMENT ON COLUMN action_history.status IS 'Result of the action: success, failure, or cancelled';
COMMENT ON COLUMN action_history.metadata IS 'Additional action-specific data (reply style, forward recipient, etc.)';
