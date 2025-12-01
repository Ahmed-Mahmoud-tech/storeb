const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'store2',
  user: 'postgres',
  password: 'password',
});

async function runMigration() {
  try {
    console.log('Starting database migration...\n');

    // Step 1: Add country_code and country columns to user table
    console.log(
      'Step 1: Adding country_code and country columns to user table...'
    );
    await pool.query(`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT '+20',
      ADD COLUMN IF NOT EXISTS country VARCHAR(100);
    `);
    console.log('✓ Columns added to user table\n');

    // Step 2: Convert customer_support from text array to JSONB
    console.log('Step 2: Converting customer_support to JSONB format...');

    // First, create a temporary JSONB column
    await pool.query(`
      ALTER TABLE branches 
      ADD COLUMN IF NOT EXISTS customer_support_jsonb JSONB;
    `);
    console.log('✓ Temporary JSONB column created\n');

    // Step 3: Convert existing data from text array to JSONB
    console.log('Step 3: Converting existing customer_support data...');

    // Get all branches with customer_support
    const branches = await pool.query(`
      SELECT id, customer_support FROM branches WHERE customer_support IS NOT NULL
    `);

    for (const branch of branches.rows) {
      const supportArray = branch.customer_support;
      const jsonbArray = supportArray.map((entry) => {
        // Parse entry format: "+201113232886:whatsapp" or "+201113232886:phone"
        const parts = entry.split(':');
        const phone = parts[0]; // e.g., "+201113232886"
        const type = parts[1] || 'phone'; // e.g., "whatsapp" or "phone"

        // Extract country code (everything before the first digit that's not part of code)
        // Assuming format like +20, +1, +44, etc.
        let countryCode = '+20'; // default
        let phoneWithoutCode = phone;

        // Try to extract country code
        if (phone.startsWith('+')) {
          const match = phone.match(/^\+(\d{1,3})/);
          if (match) {
            countryCode = '+' + match[1];
            phoneWithoutCode = phone.substring(countryCode.length);
          }
        }

        return {
          country_code: countryCode,
          phone: phoneWithoutCode,
          type: type,
        };
      });

      // Update the temporary JSONB column
      await pool.query(
        `UPDATE branches SET customer_support_jsonb = $1 WHERE id = $2`,
        [JSON.stringify(jsonbArray), branch.id]
      );
    }
    console.log(`✓ Converted ${branches.rows.length} branches\n`);

    // Step 4: Drop old column and rename new one
    console.log('Step 4: Replacing old column with new JSONB column...');
    await pool.query(`
      ALTER TABLE branches DROP COLUMN customer_support;
    `);
    await pool.query(`
      ALTER TABLE branches RENAME COLUMN customer_support_jsonb TO customer_support;
    `);
    console.log('✓ Column replacement complete\n');

    // Step 5: Verify the changes
    console.log('Step 5: Verifying changes...');

    // Check user table
    const userColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user' AND (column_name = 'country_code' OR column_name = 'country')
      ORDER BY column_name;
    `);

    console.log('\nUser table new columns:');
    userColumns.rows.forEach((row) => {
      console.log(`  ✓ ${row.column_name}: ${row.data_type}`);
    });

    // Check branches table
    const branchColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branches' AND column_name = 'customer_support'
      ORDER BY column_name;
    `);

    console.log('\nBranches table customer_support:');
    branchColumns.rows.forEach((row) => {
      console.log(`  ✓ ${row.column_name}: ${row.data_type}`);
    });

    // Check sample data
    const sampleData = await pool.query(`
      SELECT id, customer_support 
      FROM branches 
      WHERE customer_support IS NOT NULL 
      LIMIT 1;
    `);

    if (sampleData.rows.length > 0) {
      console.log('\nSample customer_support data (JSONB):');
      console.log(JSON.stringify(sampleData.rows[0].customer_support, null, 2));
    }

    console.log('\n✅ Migration completed successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
