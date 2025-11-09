-- Fix user_actions.product_id column type from UUID to VARCHAR
-- This allows storing product codes instead of just UUIDs

-- First, drop the foreign key constraint if it exists
ALTER TABLE user_actions DROP CONSTRAINT IF EXISTS "FK_user_actions_product";

-- Change the column type
ALTER TABLE user_actions ALTER COLUMN product_id TYPE VARCHAR(50);

-- Recreate the foreign key constraint
ALTER TABLE user_actions 
ADD CONSTRAINT "FK_user_actions_product" 
FOREIGN KEY (product_id) REFERENCES product(product_code) 
ON DELETE CASCADE;
