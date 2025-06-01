-- Add foreign key constraint to customer_products table
ALTER TABLE customer_products 
ADD CONSTRAINT fk_customer_products_employee
FOREIGN KEY (employee) REFERENCES "user" (id)
ON DELETE SET NULL;

-- Add index for better join performance
CREATE INDEX idx_customer_products_employee ON customer_products (employee);
