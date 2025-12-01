-- Migration to separate country code from phone numbers
-- This separates phone numbers into country_code and phone columns for users
-- and updates the customer_support column format in branches

-- Step 1: Add country_code column to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT '+20';

-- Step 1b: Add country column to user table (for customer/user country)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Step 2: Set default country code for all users if not already set
UPDATE "user" SET country_code = '+20' WHERE country_code IS NULL OR country_code = '';

-- Step 3: Handle customer_support in branches
-- The current format is: {'11114444:phone', '22225555:phone'}
-- We need to update it to: [{"country_code":"+20","phone":"11114444","type":"phone"}]

-- Step 3a: First, convert from text array to JSONB format
-- Create temporary column for new format
ALTER TABLE branches ADD COLUMN IF NOT EXISTS customer_support_new JSONB;

-- Parse and convert existing customer_support data
UPDATE branches 
SET customer_support_new = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'country_code', '+20',  -- Default to Egypt
      'phone', SPLIT_PART(elem, ':', 1),
      'type', COALESCE(SPLIT_PART(elem, ':', 2), 'phone')
    )
  )
  FROM UNNEST(customer_support) AS elem
  WHERE customer_support IS NOT NULL AND array_length(customer_support, 1) > 0
)
WHERE customer_support IS NOT NULL;

-- Drop old column and rename new one
ALTER TABLE branches DROP COLUMN IF EXISTS customer_support;
ALTER TABLE branches RENAME COLUMN customer_support_new TO customer_support;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS parse_customer_support(TEXT);
-- Step 6: Drop the function after use (optional)
DROP FUNCTION IF EXISTS parse_customer_support(TEXT);
