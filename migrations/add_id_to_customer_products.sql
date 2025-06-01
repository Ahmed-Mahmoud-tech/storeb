-- Add UUID extension if not exists (for PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add new id column
ALTER TABLE customer_products ADD COLUMN id UUID DEFAULT uuid_generate_v4();

-- Make sure the new column has unique values
UPDATE customer_products 
SET id = uuid_generate_v4() 
WHERE id IS NULL;

-- Make the id column NOT NULL
ALTER TABLE customer_products ALTER COLUMN id SET NOT NULL;

-- Create a primary key on the id column
ALTER TABLE customer_products 
  DROP CONSTRAINT IF EXISTS customer_products_pkey;

ALTER TABLE customer_products 
  ADD PRIMARY KEY (id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_customer_products_phone ON customer_products(phone);
CREATE INDEX IF NOT EXISTS idx_customer_products_employee ON customer_products(employee);
