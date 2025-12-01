-- Clean migration for phone country code separation
-- Handles current database format where customer_support is {'phone:type'}

-- Step 1: Add columns to user table if they don't exist
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS country_code VARCHAR(10);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Step 2: Set default country code for users
UPDATE "user" SET country_code = '+20' WHERE country_code IS NULL OR country_code = '';

-- Step 3: Handle customer_support in branches
-- Current format: text array like {'11114444:phone', '22225555:whatsapp'}
-- Target format: JSONB array like [{"country_code":"+20","phone":"11114444","type":"phone"}]

-- Step 3a: Create new JSONB column for customer_support
ALTER TABLE branches ADD COLUMN IF NOT EXISTS customer_support_new JSONB;

-- Step 3b: Migrate data from text array to JSONB format
UPDATE branches 
SET customer_support_new = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'country_code', '+20',
      'phone', SPLIT_PART(elem, ':', 1),
      'type', COALESCE(NULLIF(SPLIT_PART(elem, ':', 2), ''), 'phone')
    )
  )
  FROM UNNEST(customer_support) AS elem
)
WHERE customer_support IS NOT NULL AND array_length(customer_support, 1) > 0;

-- Step 3c: Handle branches with no customer support
UPDATE branches 
SET customer_support_new = '[]'::jsonb
WHERE customer_support IS NULL OR customer_support = ARRAY[]::text[];

-- Step 3d: Drop old column and rename new one
ALTER TABLE branches DROP COLUMN IF EXISTS customer_support;
ALTER TABLE branches RENAME COLUMN customer_support_new TO customer_support;

-- Step 4: Verify the migration worked
-- Check a sample row: SELECT id, customer_support FROM branches LIMIT 1;
-- Expected output: [{"country_code":"+20","phone":"11114444","type":"phone"}]
