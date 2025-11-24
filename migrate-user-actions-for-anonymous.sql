-- Migration: Add support for anonymous users in user_actions table
-- This migration makes user_id nullable and adds anonymous_user_id column
-- to support tracking actions from users who are not authenticated

-- Step 1: Add anonymous_user_id column
ALTER TABLE user_actions 
ADD COLUMN IF NOT EXISTS anonymous_user_id VARCHAR(100) NULLABLE;

-- Step 2: Drop the existing foreign key constraint if it exists
ALTER TABLE user_actions 
DROP CONSTRAINT IF EXISTS "FK_f1d9acd183803eedaac746b9794";

-- Step 3: Make user_id nullable
ALTER TABLE user_actions 
ALTER COLUMN user_id DROP NOT NULL;

-- Step 4: Recreate the foreign key constraint with optional user_id
ALTER TABLE user_actions 
ADD CONSTRAINT "FK_user_actions_user_id" 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 5: Create index for anonymous_user_id
CREATE INDEX IF NOT EXISTS idx_user_actions_anonymous_user_id 
ON user_actions(anonymous_user_id);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_actions'
ORDER BY ordinal_position;
