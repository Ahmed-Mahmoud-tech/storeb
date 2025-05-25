-- First, drop the junction table if it exists
DROP TABLE IF EXISTS store_branches;

-- Then, update the store table to allow null values for the type column if needed
ALTER TABLE store ALTER COLUMN type DROP NOT NULL;

-- Set default empty array for any null values
UPDATE store SET type = '{}' WHERE type IS NULL;
