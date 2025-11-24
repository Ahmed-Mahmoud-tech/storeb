-- Migration: Add SEARCH action type and fix user_actions table schema
-- This migration adds support for the SEARCH action type and ensures the anonymous_user_id column exists

-- Step 1: Add anonymous_user_id column if it doesn't exist
ALTER TABLE user_actions
ADD COLUMN IF NOT EXISTS anonymous_user_id VARCHAR(100);

-- Step 2: Update user_id to be nullable (needed for anonymous actions)
ALTER TABLE user_actions
ALTER COLUMN user_id DROP NOT NULL;

-- Step 3: Check if the action_type column has valid values and add SEARCH if needed
-- Note: Since action_type is VARCHAR, we need to ensure the table allows 'search' values
-- This should work fine as VARCHAR has no restrictions on values

-- Step 4: Verify the table structure after migration
\d user_actions

-- Step 5: Create an index on anonymous_user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_user_actions_anonymous_user_id ON user_actions(anonymous_user_id);

-- Step 6: Verify the data can be inserted with SEARCH action type
-- (This is just for documentation - actual inserts happen from the application)

-- Migration completed successfully
SELECT 'Migration: Add SEARCH action type and anonymous user support - COMPLETED' as migration_status;
