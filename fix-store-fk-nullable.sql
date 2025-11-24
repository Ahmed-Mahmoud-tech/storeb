-- Fix all foreign key constraints in user_actions to be nullable
-- This allows recording user actions for anonymous users and handles missing references gracefully

-- 1. Drop and recreate store_id foreign key with SET NULL on delete
ALTER TABLE user_actions
DROP CONSTRAINT IF EXISTS "FK_f1d9acd183803eedaac746b9794";

ALTER TABLE user_actions
ADD CONSTRAINT "FK_f1d9acd183803eedaac746b9794"
FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE SET NULL;

-- 2. Drop and recreate product_id foreign key with SET NULL on delete
ALTER TABLE user_actions
DROP CONSTRAINT IF EXISTS "FK_user_actions_product";

ALTER TABLE user_actions
ADD CONSTRAINT "FK_user_actions_product"
FOREIGN KEY (product_id) REFERENCES product(product_code) ON DELETE SET NULL;

-- 3. Ensure user_id can be null (for anonymous users)
-- The user_id foreign key should already allow NULL, but let's verify the constraint exists
ALTER TABLE user_actions
DROP CONSTRAINT IF EXISTS "FK_user_actions_user";

ALTER TABLE user_actions
ADD CONSTRAINT "FK_user_actions_user"
FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- Verify the changes
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS foreign_table,
    confdeltype AS on_delete_action
FROM pg_constraint
WHERE conrelid = 'user_actions'::regclass
AND contype = 'f';
